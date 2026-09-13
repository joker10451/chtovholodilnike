import { useEffect, useMemo, useState } from 'react';
import { Empty, Header, Sheet, Spinner, useOnline, useToday } from '../components/ui';
import { useItems } from '../data/repo';
import { AiRequestError, generateRecipe } from '../lib/ai';
import { generatedToRecipe } from '../lib/convert';
import { MEALDB_INGREDIENTS, mealDetails, mealsByIngredient, mealToText, searchMeals, type MealDetails, type MealSummary } from '../lib/mealdb';
import { todayISO } from '../shared/dates';
import { daysLeft } from '../shared/freshness';
import { getProduct, guessProductKey } from '../shared/products';
import type { Recipe } from '../shared/recipeTypes';
import { ResultCard } from './Chef';

export function Catalog() {
  const online = useOnline();
  const items = useItems();
  const today = useToday();
  const [pick, setPick] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [meals, setMeals] = useState<MealSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  // Продукты из холодильника, по которым можно искать в каталоге; сначала те, что скоро испортятся
  const chips = useMemo(() => {
    const seen = new Set<string>();
    const fromFridge = [...(items ?? [])]
      .sort((a, b) => (daysLeft(a.expiresAt, today) ?? 999) - (daysLeft(b.expiresAt, today) ?? 999))
      .filter((i) => i.productKey && MEALDB_INGREDIENTS[i.productKey] && !seen.has(i.productKey) && seen.add(i.productKey))
      .map((i) => i.productKey!)
      .slice(0, 12);
    return fromFridge.length ? fromFridge : ['chicken_breast', 'minced_meat', 'potato', 'egg', 'salmon', 'rice', 'mushrooms'];
  }, [items, today]);

  useEffect(() => {
    if (!pick && chips.length) setPick(chips[0]);
  }, [chips, pick]);

  useEffect(() => {
    if (!online || !pick) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    mealsByIngredient(pick)
      .then((m) => { if (!cancelled) setMeals(m); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [pick, online]);

  async function search() {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setPick(null);
    try {
      // Русское название продукта ищем по ингредиенту, остальное — по названию блюда
      const key = /[а-яё]/i.test(q) ? guessProductKey(q) : null;
      if (key && MEALDB_INGREDIENTS[key]) setMeals(await mealsByIngredient(key));
      else if (/[а-яё]/i.test(q)) {
        setMeals([]);
        setError('Каталог английский: по-русски ищутся только продукты (курица, фарш, рис). Название блюда введите по-английски, например pancakes.');
      } else setMeals(await searchMeals(q));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="screen no-tabs">
      <Header title="Каталог" sub="TheMealDB · ~600 блюд, перевод нейросетью" backTo="#/recipes" />
      {!online ? (
        <Empty title="Нужен интернет">Каталог открывается онлайн. Рецепты, которые вы уже сохранили, доступны без интернета.</Empty>
      ) : (
        <div className="stack-lg">
          <form className="row-gap" onSubmit={(e) => { e.preventDefault(); void search(); }}>
            <input className="input" type="search" placeholder="Продукт по-русски или блюдо по-английски" value={query} onChange={(e) => setQuery(e.target.value)} />
            <button className="btn small" type="submit" style={{ minHeight: 46 }}>Найти</button>
          </form>

          {chips.length > 0 && (
            <div className="seg">
              {chips.map((k) => (
                <button key={k} className={pick === k ? 'on' : ''} onClick={() => { setQuery(''); setPick(k); }}>{getProduct(k)?.name}</button>
              ))}
            </div>
          )}

          {error && <div className="notice">{error}</div>}
          {loading && <div className="row-gap muted"><Spinner /> Ищу рецепты…</div>}
          {!loading && meals && meals.length === 0 && !error && <Empty title="Ничего не нашлось">Попробуйте другой продукт.</Empty>}
          {!loading && meals && meals.length > 0 && (
            <div className="meal-grid">
              {meals.map((m) => (
                <button key={m.id} className="meal" onClick={() => setOpenId(m.id)}>
                  <img src={`${m.thumb}/small`} alt="" loading="lazy" />
                  <b>{m.title}</b>
                </button>
              ))}
            </div>
          )}
          <p className="small muted">Названия в каталоге на английском — при сохранении нейросеть переведёт рецепт и пересчитает меры в граммы.</p>
        </div>
      )}
      <MealSheet id={openId} onClose={() => setOpenId(null)} />
    </main>
  );
}

function MealSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [meal, setMeal] = useState<MealDetails | null>(null);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMeal(null); setRecipe(null); setError(null);
    if (!id) return;
    mealDetails(id).then(setMeal).catch((e: Error) => setError(e.message));
  }, [id]);

  async function translate() {
    if (!meal) return;
    setBusy(true);
    setError(null);
    try {
      const g = await generateRecipe({ task: 'import', today: todayISO(), url: null, text: mealToText(meal), images: [] });
      const r = generatedToRecipe(g, 'TheMealDB');
      setRecipe({ ...r, image: meal.thumb, origin: meal.source ?? `TheMealDB: ${meal.title}` });
      setNote(g.note);
    } catch (e) {
      setError(e instanceof AiRequestError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={!!id} onClose={onClose} title={recipe ? undefined : meal?.title ?? 'Загружаю…'}>
      {recipe ? (
        <ResultCard recipe={recipe} note={note} onReset={() => setRecipe(null)} />
      ) : !meal ? (
        error ? <div className="notice error">{error}</div> : <div className="row-gap muted"><Spinner /> Загружаю рецепт…</div>
      ) : (
        <div className="stack-lg">
          <img src={meal.thumb} alt="" style={{ borderRadius: 16, aspectRatio: '16 / 10', objectFit: 'cover', width: '100%' }} />
          <span className="meta">{[meal.area, meal.category].filter(Boolean).join(' · ')} · {meal.ingredients.length} ингредиентов</span>
          <p className="small muted" lang="en" style={{ maxHeight: 120, overflow: 'hidden' }}>
            {meal.ingredients.map((i) => i.name).join(', ')}
          </p>
          {error && <div className="notice error">{error}</div>}
          <button className="btn block" disabled={busy} onClick={translate}>
            {busy ? <><Spinner /> Перевожу…</> : 'Перевести на русский'}
          </button>
        </div>
      )}
    </Sheet>
  );
}
