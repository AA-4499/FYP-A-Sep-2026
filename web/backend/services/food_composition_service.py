"""Authenticated food reference lookup. CHO is available carbohydrate per 100 g edible portion."""
import hashlib
import json
import math

import requests
from models.training.supabase_io import supabase_config, supabase_headers


def nutrient(value):
    if value is None or isinstance(value, bool) or not str(value).strip():
        return None
    try:
        number = float(value)
        return number if math.isfinite(number) and 0 <= number <= 100 else None
    except (ValueError, TypeError):
        return None


def search_foods(query=''):
    query = str(query).strip()
    if len(query) > 80:
        raise ValueError('Food search must be at most 80 characters.')
    # Do not allow input to become PostgREST filter syntax.
    term = ''.join(c for c in query if c.isalnum() or c.isspace() or c == '-').strip()
    url, key = supabase_config()
    params = {'select': 'id,foodName,englishName,categoryMain,CHO,dietaryFiber,edible', 'order': 'id.asc', 'limit': '31'}
    if term:
        params['or'] = f'(foodName.ilike.*{term}*,englishName.ilike.*{term}*)'
    try:
        response = requests.get(url + '/rest/v1/food_composition', headers=supabase_headers(key), params=params, timeout=20)
        response.raise_for_status()
        rows = response.json()
        if not isinstance(rows, list):
            raise ValueError()
    except (requests.RequestException, ValueError):
        raise RuntimeError('Food references could not be loaded. Check the backend food_composition access and try again; manual carbohydrate entry remains available.') from None
    foods = []
    for row in rows[:30]:
        if not isinstance(row, dict) or not isinstance(row.get('id'), int):
            continue
        cho, fibre = nutrient(row.get('CHO')), nutrient(row.get('dietaryFiber'))
        if cho is None:
            continue
        item = {'id': str(row['id']), 'name': str(row.get('englishName') or row.get('foodName') or '').strip(),
                'chinese_name': str(row.get('foodName') or ''), 'category': str(row.get('categoryMain') or ''),
                'available_per_100g': cho, 'fiber_per_100g': fibre,
                'basis': 'available_carbohydrate_per_100g_edible_portion'}
        item['reference_sha256'] = hashlib.sha256(json.dumps(item, sort_keys=True).encode()).hexdigest()
        foods.append(item)
    return {'foods': foods, 'has_more': len(rows) > 30, 'source': 'supabase.food_composition',
            'convention': 'CHO is available carbohydrate; add known dietaryFiber only when total carbohydrate is required.'}
