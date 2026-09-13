// Бесплатный каталог рецептов TheMealDB (на английском).
// Рецепт переводит и структурирует нейросеть при сохранении.

const BASE = 'https://www.themealdb.com/api/json/v1/1';

/** Ключ справочника → название ингредиента в TheMealDB */
export const MEALDB_INGREDIENTS: Record<string, string> = {
  potato: 'potatoes', onion: 'onion', carrot: 'carrots', garlic: 'garlic', tomato: 'tomatoes',
  cucumber: 'cucumber', zucchini: 'courgettes', bell_pepper: 'red_pepper', cabbage: 'cabbage',
  broccoli: 'broccoli', eggplant: 'aubergine', beet: 'beetroot', pumpkin: 'pumpkin', mushrooms: 'mushrooms',
  avocado: 'avocado', green_onion: 'spring_onions', dill: 'dill', parsley: 'parsley', cilantro: 'coriander',
  lettuce: 'lettuce', spinach: 'spinach', lemon: 'lemon', apple: 'apples', banana: 'banana', orange: 'orange',
  milk: 'milk', sour_cream: 'sour_cream', cottage_cheese: 'cottage_cheese', yogurt: 'greek_yogurt',
  butter: 'butter', cheese: 'cheese', mozzarella: 'mozzarella', feta: 'feta', cream: 'double_cream',
  cream_cheese: 'cream_cheese', egg: 'eggs', chicken_breast: 'chicken_breast', chicken_thigh: 'chicken_thighs',
  chicken_whole: 'chicken', minced_chicken: 'chicken', minced_meat: 'minced_beef', pork: 'pork', beef: 'beef',
  sausages: 'sausages', ham: 'ham', bacon: 'bacon', white_fish: 'white_fish', salmon: 'salmon', shrimp: 'prawns',
  rice: 'rice', buckwheat: 'buckwheat', oats: 'oats', pasta: 'spaghetti', bulgur: 'bulgur_wheat', lentils: 'lentils',
  bread: 'bread', lavash: 'tortillas', tuna_canned: 'tuna', chickpeas_canned: 'chickpeas',
  beans_canned: 'kidney_beans', corn_canned: 'sweetcorn', tomatoes_canned: 'chopped_tomatoes',
  tomato_paste: 'tomato_puree', honey: 'honey', frozen_peas: 'peas', peas_canned: 'peas', mayonnaise: 'mayonnaise',
};

export interface MealSummary {
  id: string;
  title: string;
  thumb: string;
}

export interface MealDetails extends MealSummary {
  category: string | null;
  area: string | null;
  instructions: string;
  ingredients: { name: string; measure: string }[];
  source: string | null;
  youtube: string | null;
}

type RawMeal = Record<string, string | null>;

async function get(path: string): Promise<RawMeal[]> {
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) throw new Error(`Каталог рецептов не ответил (${res.status}). Попробуйте позже.`);
  const data = (await res.json()) as { meals: RawMeal[] | null | string };
  return Array.isArray(data.meals) ? data.meals : [];
}

function summary(m: RawMeal): MealSummary {
  return { id: m.idMeal ?? '', title: m.strMeal ?? '', thumb: m.strMealThumb ?? '' };
}

export async function mealsByIngredient(productKey: string): Promise<MealSummary[]> {
  const name = MEALDB_INGREDIENTS[productKey];
  if (!name) return [];
  return (await get(`filter.php?i=${encodeURIComponent(name)}`)).map(summary);
}

export async function searchMeals(query: string): Promise<MealSummary[]> {
  return (await get(`search.php?s=${encodeURIComponent(query.trim())}`)).map(summary);
}

export async function mealDetails(id: string): Promise<MealDetails | null> {
  const [m] = await get(`lookup.php?i=${encodeURIComponent(id)}`);
  if (!m) return null;
  const ingredients: MealDetails['ingredients'] = [];
  for (let i = 1; i <= 20; i++) {
    const name = m[`strIngredient${i}`]?.trim();
    if (name) ingredients.push({ name, measure: m[`strMeasure${i}`]?.trim() ?? '' });
  }
  return {
    ...summary(m),
    category: m.strCategory ?? null,
    area: m.strArea ?? null,
    instructions: m.strInstructions ?? '',
    ingredients,
    source: m.strSource || null,
    youtube: m.strYoutube || null,
  };
}

/** Текст рецепта для перевода нейросетью */
export function mealToText(meal: MealDetails): string {
  return [
    `Title: ${meal.title}`,
    meal.area || meal.category ? `Cuisine: ${[meal.area, meal.category].filter(Boolean).join(', ')}` : '',
    'Ingredients:',
    ...meal.ingredients.map((i) => `- ${i.measure} ${i.name}`.replace(/\s+/g, ' ')),
    'Instructions:',
    meal.instructions,
    'Source: TheMealDB',
  ].filter(Boolean).join('\n');
}
