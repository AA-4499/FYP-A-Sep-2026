export interface FoodReference {
  id: string;
  name: string;
  chinese_name: string;
  category: string;
  available_per_100g: number;
  fiber_per_100g: number | null;
  basis: 'available_carbohydrate_per_100g_edible_portion';
  reference_sha256: string;
}
