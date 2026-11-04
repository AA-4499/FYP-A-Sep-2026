"""Byte-stable model assets must survive Windows-to-Git-to-Linux deployment."""
import hashlib
import tempfile
import unittest
from pathlib import Path
from models.training.export_conditional_browser import write_json


class BrowserExportTests(unittest.TestCase):
    def test_export_is_utf8_lf_and_hash_survives_git_line_normalization(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / 'model.json'
            write_json(path, {'weights': [1.25, -2.5], 'version': 'v3'})
            exported = path.read_bytes()
            self.assertNotIn(b'\r', exported)
            self.assertTrue(exported.endswith(b'\n'))
            git_normalized = exported.replace(b'\r\n', b'\n')
            self.assertEqual(hashlib.sha256(exported).digest(), hashlib.sha256(git_normalized).digest())
            self.assertNotEqual(hashlib.sha256(exported).digest(), hashlib.sha256(exported.replace(b'\n', b'\r\n')).digest())
