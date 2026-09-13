// Бесплатный каталог напитков и смузи TheCocktailDB (non-alcoholic)
const BASE = 'https://www.thecocktaildb.com/api/json/v1/1';

export interface DrinkSummary {
  id: string;
  title: string;
  thumb: string;
}

export interface DrinkDetails extends DrinkSummary {
  category: string | null;
  instructions: string;
  ingredients: { name: string; measure: string }[];
}

type RawDrink = Record<string, string | null>;

async function get(path: string): Promise<RawDrink[]> {
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) throw new Error(`Каталог напитков не ответил (${res.status}). Попробуйте позже.`);
  const data = (await res.json()) as { drinks: RawDrink[] | null | string };
  return Array.isArray(data.drinks) ? data.drinks : [];
}

function summary(d: RawDrink): DrinkSummary {
  return { id: d.idDrink ?? '', title: d.strDrink ?? '', thumb: d.strDrinkThumb ?? '' };
}

export async function nonAlcoholicDrinks(): Promise<DrinkSummary[]> {
  return (await get('filter.php?a=Non_Alcoholic')).map(summary);
}

export async function searchDrinks(query: string): Promise<DrinkSummary[]> {
  return (await get(`search.php?s=${encodeURIComponent(query.trim())}`)).map(summary);
}

export async function drinkDetails(id: string): Promise<DrinkDetails | null> {
  const [d] = await get(`lookup.php?i=${encodeURIComponent(id)}`);
  if (!d) return null;
  const ingredients: DrinkDetails['ingredients'] = [];
  for (let i = 1; i <= 15; i++) {
    const name = d[`strIngredient${i}`]?.trim();
    if (name) ingredients.push({ name, measure: d[`strMeasure${i}`]?.trim() ?? '' });
  }
  return {
    ...summary(d),
    category: d.strCategory ?? null,
    instructions: d.strInstructions ?? '',
    ingredients,
  };
}

/** Текст напитка для перевода нейросетью */
export function drinkToText(drink: DrinkDetails): string {
  return [
    `Title: ${drink.title}`,
    drink.category ? `Category: ${drink.category}` : 'Category: Non-alcoholic drink',
    'Ingredients:',
    ...drink.ingredients.map((i) => `- ${i.measure} ${i.name}`.replace(/\s+/g, ' ')),
    'Instructions:',
    drink.instructions,
    'Source: TheCocktailDB',
  ].filter(Boolean).join('\n');
}
