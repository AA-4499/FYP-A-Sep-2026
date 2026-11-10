import gzip
import hashlib
import json
import os
from pathlib import Path
import tempfile
import unittest
import uuid
from unittest.mock import Mock, patch

import app as dashboard
from test_forecast_api import token, SECRET
from services import food_composition_service as foods, cloud_model_store as cloud, model_store as store


class FoodCompositionTests(unittest.TestCase):
    def test_lookup_is_authenticated_and_filters_are_sanitized(self):
        client=dashboard.app.test_client()
        with patch.dict(os.environ, {'SUPABASE_JWT_SECRET':SECRET}), patch.object(foods,'search_foods',return_value={'foods':[]}):
            self.assertEqual(401,client.get('/api/food-composition?q=rice').status_code)
            self.assertEqual(200,client.get('/api/food-composition?q=rice',headers=token()).status_code)

    def test_actual_schema_available_cho_and_missing_fibre_are_preserved(self):
        response=Mock();response.json.return_value=[{'id':1,'englishName':'Rice','foodName':'Rice','CHO':'25.9','dietaryFiber':'0.3'}, {'id':2,'englishName':'Unknown fibre','CHO':'10','dietaryFiber':'Tr'}, {'id':3,'CHO':'--'}]
        with patch.object(foods,'supabase_config',return_value=('https://example.test','key')),patch.object(foods.requests,'get',return_value=response) as get:
            result=foods.search_foods('rice),id.gt.0')
            self.assertEqual(2,len(result['foods']))
            self.assertEqual(25.9,result['foods'][0]['available_per_100g'])
            self.assertEqual(0.3,result['foods'][0]['fiber_per_100g'])
            self.assertIsNone(result['foods'][1]['fiber_per_100g'])
            self.assertNotIn(')',get.call_args.kwargs['params']['or'][1:-1])
            self.assertEqual(64,len(result['foods'][0]['reference_sha256']))

    def test_unavailable_food_service_has_a_manual_entry_message(self):
        import requests
        with patch.object(foods,'supabase_config',return_value=('url','key')),patch.object(foods.requests,'get',side_effect=requests.ConnectionError()):
            with self.assertRaisesRegex(RuntimeError,'manual carbohydrate entry'):
                foods.search_foods('rice')


class CloudModelStorageTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.directory=Path(self.temp.name);self.candidate=self.directory/'candidate.pt';self.candidate.write_bytes(b'validated-model-fixture')
        self.state={'active':None,'job':{'status':'idle'}};self.objects={}
        self.env=patch.dict(os.environ,{'T2DM_STORAGE_BACKEND':'supabase','T2DM_CACHE_DIR':str(self.directory/'cache')});self.env.start();self.addCleanup(self.env.stop)
        config=patch.object(cloud,'supabase_config',return_value=('https://example.test','key'));config.start();self.addCleanup(config.stop)

    def transaction(self,action='read',run_id=None,payload=None):
        if action=='activate':self.state['active']=dict(payload)
        return self.state

    def object_get(self,url,**kwargs):
        path=url.split('/model-artifacts/',1)[1]
        response=Mock(ok=path in self.objects,content=self.objects.get(path,b''))
        return response

    def test_cloud_release_baseline_and_checkpoint_survive_an_empty_local_cache(self):
        run=str(uuid.uuid4());baseline={'observations':{'hashed-identity':'content-hash'},'valid_observations':1}
        with patch.object(cloud,'control',side_effect=self.transaction),patch.object(cloud,'upload',side_effect=lambda path,content,mime:self.objects.update({path:content})),patch.object(cloud.requests,'get',side_effect=self.object_get) as get:
            active=cloud.activate(self.candidate,run_id=run,baseline=baseline,comparison={'accepted':True},activated_at='2026-11-10T00:00:00+00:00')
            self.assertNotIn('baseline',self.state['active'])
            self.assertEqual(baseline,cloud.read_active()['baseline'])
            self.assertEqual(self.candidate.read_bytes(),store.active_checkpoint_path().read_bytes())
            with patch.dict(os.environ,{'T2DM_CACHE_DIR':str(self.directory/'empty-after-redeploy')}):
                self.assertEqual(self.candidate.read_bytes(),store.active_checkpoint_path().read_bytes())
                self.assertEqual(baseline,cloud.read_active()['baseline'])
            self.assertIn('/object/authenticated/',get.call_args.args[0])

    def test_upload_failure_or_rejected_candidate_never_publishes_a_pointer(self):
        with patch.object(cloud,'control') as control,patch.object(cloud,'upload',side_effect=store.ModelStorageError('offline')):
            with self.assertRaises(store.ModelStorageError):cloud.activate(self.candidate,run_id=str(uuid.uuid4()),baseline={},comparison={'accepted':True},activated_at='now')
            control.assert_not_called()
        with patch.object(cloud,'upload') as upload,self.assertRaises(store.ModelStorageError):
            cloud.activate(self.candidate,run_id=str(uuid.uuid4()),baseline={},comparison={'accepted':False},activated_at='now')
        upload.assert_not_called()

    def test_digest_mismatch_never_uses_bundled_weights(self):
        path=f'legacy-gru/versions/{uuid.uuid4()}/model.pt';self.objects[path]=b'corrupt'
        with patch.object(cloud.requests,'get',side_effect=self.object_get),self.assertRaisesRegex(store.ModelStorageError,'SHA-256'):
            cloud.download(path,'a'*64,'.pt')

    def test_missing_migration_and_stale_lease_errors_are_clear(self):
        response=Mock(ok=False);response.json.return_value={'code':'PGRST202'}
        with patch.object(cloud.requests,'post',return_value=response):
            with self.assertRaisesRegex(store.ModelStorageError,'supabase_model_storage.sql'):cloud.control()
            response.json.return_value={'code':'P0001','message':'The training lease was lost or expired'}
            with self.assertRaisesRegex(store.ModelStorageError,'lease'):cloud.control('activate',str(uuid.uuid4()),{})

    def test_initialization_is_admin_only_and_actual_requests_still_require_auth(self):
        with patch.dict(os.environ,{'SUPABASE_JWT_SECRET':SECRET}):
            client=dashboard.app.test_client()
            self.assertEqual(401,client.post('/api/admin/model/storage/initialize').status_code)
            self.assertEqual(403,client.post('/api/admin/model/storage/initialize',headers=token('doctor')).status_code)
