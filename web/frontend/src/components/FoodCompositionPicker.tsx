import React, { useEffect, useMemo, useState } from 'react';
import { Search, Utensils, Check, Sparkles, Edit3 } from 'lucide-react';
import { getSupabaseClient } from '../lib/supabase';
import type { FoodReference } from '../lib/foodComposition';

export interface QuickFoodItem {
  id: string;
  name: string;
  chineseName: string;
  icon: string;
  defaultPortion: number; // grams
  carbsPer100g: number;
  presets: { label: string; grams: number }[];
}

export const QUICK_FOODS: QuickFoodItem[] = [
  {
    id: 'rice',
    name: 'White Rice',
    chineseName: '白米饭',
    icon: '🍚',
    defaultPortion: 150,
    carbsPer100g: 28.2,
    presets: [
      { label: 'Small (100g)', grams: 100 },
      { label: '1 Bowl (150g)', grams: 150 },
      { label: 'Large (200g)', grams: 200 },
    ],
  },
  {
    id: 'bread',
    name: 'Bread',
    chineseName: '面包',
    icon: '🍞',
    defaultPortion: 60,
    carbsPer100g: 49.4,
    presets: [
      { label: '1 Slice (30g)', grams: 30 },
      { label: '2 Slices (60g)', grams: 60 },
      { label: '3 Slices (90g)', grams: 90 },
    ],
  },
  {
    id: 'noodles',
    name: 'Noodles / Pasta',
    chineseName: '面条 / 意面',
    icon: '🍜',
    defaultPortion: 180,
    carbsPer100g: 25.0,
    presets: [
      { label: 'Small (120g)', grams: 120 },
      { label: '1 Bowl (180g)', grams: 180 },
      { label: 'Large (240g)', grams: 240 },
    ],
  },
  {
    id: 'fruit',
    name: 'Fresh Fruit',
    chineseName: '水果 (苹果/橙)',
    icon: '🍎',
    defaultPortion: 150,
    carbsPer100g: 13.5,
    presets: [
      { label: 'Small (100g)', grams: 100 },
      { label: 'Medium (150g)', grams: 150 },
      { label: 'Large (220g)', grams: 220 },
    ],
  },
  {
    id: 'milk',
    name: 'Milk / Drink',
    chineseName: '牛奶 / 饮品',
    icon: '🥛',
    defaultPortion: 250,
    carbsPer100g: 4.8,
    presets: [
      { label: 'Small (120ml)', grams: 120 },
      { label: '1 Glass (250ml)', grams: 250 },
      { label: 'Large (350ml)', grams: 350 },
    ],
  },
  {
    id: 'lowcarb',
    name: 'Low-Carb Meal',
    chineseName: '低碳餐 (肉/蛋/菜)',
    icon: '🥗',
    defaultPortion: 200,
    carbsPer100g: 3.5,
    presets: [
      { label: 'Light (150g)', grams: 150 },
      { label: 'Regular (200g)', grams: 200 },
      { label: 'Hearty (300g)', grams: 300 },
    ],
  },
];

// Built-in offline dictionary of common items (carbs per 100g)
const COMMON_FOOD_DICTIONARY: Record<string, { en: string; cn: string; carbsPer100g: number }> = {
  rice: { en: 'Cooked white rice', cn: '白米饭', carbsPer100g: 28.17 },
  bread: { en: 'White bread', cn: '白面包', carbsPer100g: 49.42 },
  wholewheat_bread: { en: 'Whole wheat bread', cn: '全麦面包', carbsPer100g: 41.3 },
  noodles: { en: 'Boiled noodles', cn: '煮面条', carbsPer100g: 25.0 },
  pasta: { en: 'Cooked pasta', cn: '意大利面', carbsPer100g: 25.0 },
  oatmeal: { en: 'Cooked oatmeal / porridge', cn: '燕麦粥', carbsPer100g: 12.0 },
  egg: { en: 'Boiled egg', cn: '鸡蛋', carbsPer100g: 1.12 },
  milk: { en: 'Whole milk', cn: '全脂牛奶', carbsPer100g: 4.8 },
  apple: { en: 'Apple', cn: '苹果', carbsPer100g: 13.8 },
  banana: { en: 'Banana', cn: '香蕉', carbsPer100g: 22.8 },
  orange: { en: 'Orange', cn: '橙子', carbsPer100g: 11.8 },
  watermelon: { en: 'Watermelon', cn: '西瓜', carbsPer100g: 7.5 },
  potato: { en: 'Boiled potato', cn: '土豆 / 马铃薯', carbsPer100g: 20.0 },
  sweet_potato: { en: 'Sweet potato', cn: '红薯 / 地瓜', carbsPer100g: 17.7 },
  corn: { en: 'Sweet corn', cn: '甜玉米', carbsPer100g: 21.0 },
  cucumber: { en: 'Cucumber', cn: '黄瓜', carbsPer100g: 3.6 },
  tomato: { en: 'Tomato', cn: '西红柿 / 番茄', carbsPer100g: 3.9 },
  cabbage: { en: 'Cabbage', cn: '卷心菜', carbsPer100g: 5.5 },
  chicken: { en: 'Chicken breast (cooked)', cn: '鸡胸肉', carbsPer100g: 0.0 },
  fish: { en: 'Fish / Salmon', cn: '鱼肉', carbsPer100g: 0.0 },
  beef: { en: 'Beef steak / lean beef', cn: '牛肉', carbsPer100g: 0.0 },
  tofu: { en: 'Tofu / bean curd', cn: '豆腐', carbsPer100g: 1.9 },
  biscuit: { en: 'Plain biscuit / cracker', cn: '饼干', carbsPer100g: 65.0 },
  pizza: { en: 'Pizza slice', cn: '披萨', carbsPer100g: 26.0 },
  dumpling: { en: 'Dumplings / Jiaozi', cn: '水饺', carbsPer100g: 24.5 },
  fried_rice: { en: 'Fried rice', cn: '炒饭', carbsPer100g: 31.5 },
};

export interface FoodCompositionPickerProps {
  portion: string;
  carbohydrate?: string;
  description?: string;
  engine?: 'physiology' | 'conditional';
  disabled?: boolean;
  onSelect?: (food: FoodReference) => void;
  onSelectFood?: (
    foodName: string,
    portionGrams: number,
    carbsGrams: number,
    foodRef?: FoodReference
  ) => void;
  onUpdatePortion?: (portionGrams: number, carbsGrams: number) => void;
  onUpdateCarbs?: (carbsGrams: number) => void;
}

export function FoodCompositionPicker({
  portion,
  carbohydrate,
  description = '',
  disabled = false,
  onSelectFood,
  onSelect,
  onUpdatePortion,
  onUpdateCarbs,
}: FoodCompositionPickerProps) {
  const [selectedQuickId, setSelectedQuickId] = useState<string>(() => {
    const match = QUICK_FOODS.find((f) =>
      description.toLowerCase().includes(f.name.toLowerCase())
    );
    return match ? match.id : 'rice';
  });

  const [activeCarbsPer100g, setActiveCarbsPer100g] = useState<number>(() => {
    const match = QUICK_FOODS.find((f) => f.id === selectedQuickId);
    return match ? match.carbsPer100g : 28.2;
  });

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [supabaseResults, setSupabaseResults] = useState<
    Array<{ id: string; name: string; chineseName: string; carbsPer100g: number }>
  >([]);
  const [isSearching, setIsSearching] = useState(false);

  // Current portion number
  const portionNum = Number(portion) > 0 ? Number(portion) : 150;

  // Active quick food definition
  const currentQuickFood = useMemo(
    () => QUICK_FOODS.find((f) => f.id === selectedQuickId) ?? null,
    [selectedQuickId]
  );

  // Handle Quick Food Click
  const handleQuickClick = (food: QuickFoodItem) => {
    setSelectedQuickId(food.id);
    setActiveCarbsPer100g(food.carbsPer100g);
    setSearchOpen(false);

    const calculatedCarbs = Number(
      ((food.defaultPortion * food.carbsPer100g) / 100).toFixed(1)
    );

    if (onSelectFood) {
      onSelectFood(food.name, food.defaultPortion, calculatedCarbs);
    } else if (onUpdatePortion) {
      onUpdatePortion(food.defaultPortion, calculatedCarbs);
    }

    if (onSelect) {
      onSelect({
        id: food.id,
        name: food.name,
        chinese_name: food.chineseName,
        category: 'Quick Food',
        available_per_100g: food.carbsPer100g,
        fiber_per_100g: 0,
        basis: 'available_carbohydrate_per_100g_edible_portion',
        reference_sha256: 'a'.repeat(64),
      });
    }
  };

  // Handle Portion Preset Click
  const handlePresetClick = (grams: number) => {
    const calculatedCarbs = Number(((grams * activeCarbsPer100g) / 100).toFixed(1));
    if (onUpdatePortion) {
      onUpdatePortion(grams, calculatedCarbs);
    }
  };

  // Handle Manual Portion Gram Change
  const handlePortionInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    const calculatedCarbs =
      val > 0 ? Number(((val * activeCarbsPer100g) / 100).toFixed(1)) : 0;
    if (onUpdatePortion) {
      onUpdatePortion(val, calculatedCarbs);
    }
  };

  // Handle Manual Carbs Change
  const handleCarbsInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (onUpdateCarbs) {
      onUpdateCarbs(val);
    }
  };

  // Client-side + Supabase Search
  useEffect(() => {
    if (!searchQuery.trim() || !searchOpen) {
      setSupabaseResults([]);
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const queryLower = searchQuery.toLowerCase().trim();

        // 1. Search local dictionary
        const localMatches = Object.entries(COMMON_FOOD_DICTIONARY)
          .filter(
            ([key, item]) =>
              key.includes(queryLower) ||
              item.en.toLowerCase().includes(queryLower) ||
              item.cn.includes(queryLower)
          )
          .map(([key, item]) => ({
            id: `local_${key}`,
            name: item.en,
            chineseName: item.cn,
            carbsPer100g: item.carbsPer100g,
          }));

        // 2. Query Supabase directly if client exists
        let dbMatches: Array<{
          id: string;
          name: string;
          chineseName: string;
          carbsPer100g: number;
        }> = [];

        try {
          const client = getSupabaseClient();
          if (client) {
            const { data, error } = await client
              .from('food_composition')
              .select('id, englishName, foodName, CHO')
              .or(`englishName.ilike.%${queryLower}%,foodName.ilike.%${queryLower}%`)
              .limit(15);

            if (!error && Array.isArray(data)) {
              dbMatches = data.map((row: any) => ({
                id: String(row.id),
                name: row.englishName || row.foodName || 'Food item',
                chineseName: row.foodName || '',
                carbsPer100g: Number(row.CHO) || 0,
              }));
            }
          }
        } catch {
          // Graceful fallback to local matches
        }

        if (isMounted) {
          // Deduplicate by name
          const combined = [...localMatches, ...dbMatches];
          const seen = new Set<string>();
          const unique = combined.filter((item) => {
            if (seen.has(item.name.toLowerCase())) return false;
            seen.add(item.name.toLowerCase());
            return true;
          });
          setSupabaseResults(unique.slice(0, 15));
        }
      } catch {
        // Safe silent fallback
      } finally {
        if (isMounted) setIsSearching(false);
      }
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery, searchOpen]);

  // Select item from search
  const handleSelectSearchResult = (item: {
    id: string;
    name: string;
    chineseName: string;
    carbsPer100g: number;
  }) => {
    setSelectedQuickId('custom');
    setActiveCarbsPer100g(item.carbsPer100g);
    setSearchOpen(false);
    setSearchQuery('');

    const calculatedCarbs = Number(
      ((portionNum * item.carbsPer100g) / 100).toFixed(1)
    );

    if (onSelectFood) {
      onSelectFood(item.name, portionNum, calculatedCarbs);
    } else if (onUpdatePortion) {
      onUpdatePortion(portionNum, calculatedCarbs);
    }
  };

  return (
    <div className="space-y-3.5 rounded-2xl border border-teal-100 bg-gradient-to-b from-teal-50/70 to-emerald-50/30 p-4 text-xs text-slate-800 shadow-sm">
      {/* 1. Header & Quick Selection Grid */}
      <div>
        <div className="flex items-center justify-between pb-2">
          <span className="flex items-center gap-1.5 font-bold text-teal-900">
            <Utensils size={15} className="text-teal-600" />
            Choose Food
          </span>
          <span className="text-[11px] font-medium text-slate-500">
            Click to select or search
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {QUICK_FOODS.map((food) => {
            const isSelected = selectedQuickId === food.id && !searchOpen;
            return (
              <button
                key={food.id}
                type="button"
                disabled={disabled}
                onClick={() => handleQuickClick(food)}
                className={`flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition-all ${
                  isSelected
                    ? 'border-teal-600 bg-teal-600 font-semibold text-white shadow-sm ring-2 ring-teal-200'
                    : 'border-slate-200/80 bg-white text-slate-700 hover:border-teal-300 hover:bg-teal-50/50'
                }`}
              >
                <span className="text-xl">{food.icon}</span>
                <span className="mt-1 line-clamp-1 text-[11px] font-semibold">
                  {food.name}
                </span>
                <span
                  className={`text-[9px] ${
                    isSelected ? 'text-teal-100' : 'text-slate-400'
                  }`}
                >
                  ~{food.carbsPer100g}g / 100g
                </span>
              </button>
            );
          })}
        </div>

        {/* Search or Custom Toggle Button */}
        <div className="mt-2.5">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setSearchOpen(!searchOpen)}
            className={`flex w-full items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-semibold transition ${
              searchOpen
                ? 'border-teal-500 bg-teal-100/70 text-teal-900'
                : 'border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-700'
            }`}
          >
            <Search size={13} />
            {searchOpen ? 'Hide Food Search' : '🔍 Search other food or type custom'}
          </button>
        </div>
      </div>

      {/* 2. Search / Custom Box (Expands when clicked) */}
      {searchOpen && (
        <div className="space-y-2.5 rounded-xl border border-teal-200/90 bg-white p-3 shadow-inner">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              disabled={disabled}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type food name (e.g. apple, oats, rice, 苹果, 面条)..."
              className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 pl-9 text-xs outline-none focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100"
            />
            <Search
              size={14}
              className="absolute left-3 top-2.5 text-slate-400"
            />
          </div>

          {isSearching && (
            <p className="text-center text-[11px] text-slate-400">Searching food records…</p>
          )}

          {/* Search Result Suggestions */}
          {!isSearching && supabaseResults.length > 0 && (
            <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
              {supabaseResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectSearchResult(item)}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-1.5 text-left text-xs transition hover:border-teal-300 hover:bg-teal-50"
                >
                  <div>
                    <span className="font-semibold text-slate-800">{item.name}</span>
                    {item.chineseName && (
                      <span className="ml-1.5 text-[10px] text-slate-500">
                        {item.chineseName}
                      </span>
                    )}
                  </div>
                  <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-bold text-teal-800">
                    {item.carbsPer100g}g carbs / 100g
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Direct Custom Entry Fallback */}
          <div className="flex items-center justify-between rounded-lg bg-teal-50/80 p-2 text-[11px] text-teal-900">
            <span>
              Food not listed? You can also directly type any custom food name & carbs below.
            </span>
          </div>
        </div>
      )}

      {/* 3. Portion Presets & Custom Portion Grams */}
      <div className="rounded-xl border border-teal-100/80 bg-white/90 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-700">Portion Size:</span>
            <span className="ml-2 text-xs font-semibold text-teal-700">
              {portionNum} grams
            </span>
          </div>

          {/* Quick Portion Chips */}
          {currentQuickFood?.presets && (
            <div className="flex flex-wrap gap-1.5">
              {currentQuickFood.presets.map((preset) => {
                const isActive = portionNum === preset.grams;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    disabled={disabled}
                    onClick={() => handlePresetClick(preset.grams)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                      isActive
                        ? 'bg-teal-700 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-teal-100/70 hover:text-teal-800'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Custom Portions Slider / Gram Input */}
        <div className="mt-2.5 flex items-center gap-3">
          <input
            type="range"
            min={10}
            max={500}
            step={5}
            value={portionNum}
            disabled={disabled}
            onChange={handlePortionInputChange}
            className="h-1.5 flex-1 cursor-pointer accent-teal-600"
          />
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={2000}
              step={1}
              value={portion}
              disabled={disabled}
              onChange={handlePortionInputChange}
              className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-center text-xs font-bold text-slate-800 outline-none focus:border-teal-500"
            />
            <span className="text-[11px] font-semibold text-slate-500">grams</span>
          </div>
        </div>
      </div>

      {/* 4. Resulting Carbohydrates Display & Direct Editable Field */}
      <div className="flex items-center justify-between rounded-xl border border-teal-300/80 bg-teal-50 px-3.5 py-2.5">
        <div className="flex items-center gap-1.5">
          <Sparkles size={15} className="text-teal-600" />
          <div>
            <span className="text-[11px] font-bold text-teal-900">
              Estimated Total Carbohydrate:
            </span>
            <p className="text-[10px] text-teal-700">
              Auto-calculated for {portionNum}g portion. Editable for custom adjustments.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={0.1}
            max={150}
            step={0.1}
            value={carbohydrate ?? ''}
            disabled={disabled}
            onChange={handleCarbsInputChange}
            className="w-20 rounded-lg border border-teal-400 bg-white px-2 py-1.5 text-right text-sm font-extrabold text-teal-900 outline-none shadow-sm focus:ring-2 focus:ring-teal-200"
          />
          <span className="text-xs font-bold text-teal-800">g</span>
        </div>
      </div>
    </div>
  );
}
