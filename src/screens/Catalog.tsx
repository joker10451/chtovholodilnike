import { useEffect, useMemo, useState } from 'react';
import { Empty, Header, Sheet, Spinner, useOnline, useToday } from '../components/ui';
import { useItems } from '../data/repo';
import { AiRequestError, generateRecipe } from '../lib/ai';
import {
  drinkDetails,
  drinkToText,
  nonAlcoholicDrinks,
  searchDrinks,
  type DrinkSummary,
} from '../lib/cocktaildb';
import { generatedToRecipe } from '../lib/convert';
import {
  MEALDB_INGREDIENTS,
  mealDetails,
  mealsByIngredient,
  mealToText,
  searchMeals,
  type MealSummary,
} from '../lib/mealdb';
import { todayISO } from '../shared/dates';
import { daysLeft } from '../shared/freshness';
import { getProduct, guessProductKey } from '../shared/products';
import type { Recipe } from '../shared/recipeTypes';
import { ResultCard } from './Chef';

type CatalogMode = 'meals' | 'drinks';

export function Catalog() {
  const online = useOnline();
  const items = useItems();
  const today = useToday();
  const [mode, setMode] = useState<CatalogMode>('meals');

  // Режим TheMealDB
  const [pick, setPick] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [meals, setMeals] = useState<MealSummary[] | null>(null);

  // Режим TheCocktailDB
  const [drinks, setDrinks] = useState<DrinkSummary[] | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  // Продукты из холодильника, по которым можно искать в каталоге блюд
  const chips = useMemo(() => {
    const seen = new Set<string>();
    const fromFridge = [...(items ?? [])]
      .sort((a, b) => (daysLeft(a.expiresAt, today) ?? 999) - (daysLeft(b.expiresAt, today) ?? 999))
      .filter((i) => i.productKey && MEALDB_INGREDIENTS[i.productKey] && !seen.has(i.productKey) && seen.add(i.productKey))
      .map((i) => i.productKey!)
      .slice(0, 12);
    return fromFridge.length ? fromFridge : ['chicken_breast', 'minced_meat', 'potato', 'egg', 'salmon', 'rice', 'mushrooms'];
  }, [items, today]);

  // Выбор первого чипса в режиме meals
  useEffect(() => {
    if (mode === 'meals' && !pick && chips.length) {
      setPick(chips[0]);
    }
  }, [mode, chips, pick]);

  // Загрузка блюд TheMealDB по ингредиенту
  useEffect(() => {
    if (!online || mode !== 'meals' || !pick) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    mealsByIngredient(pick)
      .then((m) => { if (!cancelled) setMeals(m); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [pick, online, mode]);

  // Загрузка каталога смузи и напитков TheCocktailDB
  useEffect(() => {
    if (!online || mode !== 'drinks') return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    nonAlcoholicDrinks()
      .then((d) => { if (!cancelled) setDrinks(d); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [mode, online]);

  async function search() {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);

    if (mode === 'meals') {
      setPick(null);
      try {
        const key = /[а-яё]/i.test(q) ? guessProductKey(q) : null;
        if (key && MEALDB_INGREDIENTS[key]) {
          setMeals(await mealsByIngredient(key));
        } else if (/[а-яё]/i.test(q)) {
          setMeals([]);
          setError('Каталог английский: по-русски ищутся только продукты (курица, фарш, рис). Название блюда введите по-английски, например pancakes.');
        } else {
          setMeals(await searchMeals(q));
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    } else {
      // Поиск коктейлей и смузи
      try {
        const res = await searchDrinks(q);
        setDrinks(res);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <main className="screen no-tabs">
      <Header
        title="Каталог рецептов"
        sub={mode === 'meals' ? 'TheMealDB · Блюда мира, перевод ИИ' : 'TheCocktailDB · Смузи и напитки, перевод ИИ'}
        backTo="#/recipes"
      />

      {/* Переключатель Еда / Напитки */}
      <div className="seg" style={{ margin: '8px 0 14px' }}>
        <button
          type="button"
          className={mode === 'meals' ? 'on' : ''}
          onClick={() => {
            setMode('meals');
            setQuery('');
            setError(null);
          }}
        >
          🍲 Блюда (TheMealDB)
        </button>
        <button
          type="button"
          className={mode === 'drinks' ? 'on' : ''}
          onClick={() => {
            setMode('drinks');
            setQuery('');
            setError(null);
          }}
        >
          🥤 Смузи и напитки (TheCocktailDB)
        </button>
      </div>

      {!online ? (
        <Empty title="Нужен интернет">Каталог открывается онлайн. Рецепты, которые вы уже сохранили, доступны без интернета.</Empty>
      ) : (
        <div className="stack-lg">
          <form className="row-gap" onSubmit={(e) => { e.preventDefault(); void search(); }}>
            <input
              className="input"
              type="search"
              placeholder={mode === 'meals' ? 'Продукт по-русски или блюдо по-английски' : 'Поиск напитка (напр. shake, smoothie, tea)'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="btn small" type="submit" style={{ minHeight: 46 }}>Найти</button>
          </form>

          {mode === 'meals' && chips.length > 0 && (
            <div className="seg">
              {chips.map((k) => (
                <button
                  key={k}
                  className={pick === k ? 'on' : ''}
                  onClick={() => {
                    setQuery('');
                    setPick(k);
                  }}
                >
                  {getProduct(k)?.name}
                </button>
              ))}
            </div>
          )}

          {error && <div className="notice">{error}</div>}
          {loading && <div className="row-gap muted"><Spinner /> Ищу рецепты…</div>}

          {/* Список TheMealDB */}
          {mode === 'meals' && !loading && meals && meals.length === 0 && !error && (
            <Empty title="Ничего не нашлось">Попробуйте другой продукт.</Empty>
          )}
          {mode === 'meals' && !loading && meals && meals.length > 0 && (
            <div className="meal-grid">
              {meals.map((m) => (
                <button key={m.id} className="meal" onClick={() => setOpenId(m.id)}>
                  <img src={`${m.thumb}/small`} alt="" loading="lazy" />
                  <b>{m.title}</b>
                </button>
              ))}
            </div>
          )}

          {/* Список TheCocktailDB */}
          {mode === 'drinks' && !loading && drinks && drinks.length === 0 && !error && (
            <Empty title="Ничего не нашлось">Попробуйте другой запрос.</Empty>
          )}
          {mode === 'drinks' && !loading && drinks && drinks.length > 0 && (
            <div className="meal-grid">
              {drinks.map((d) => (
                <button key={d.id} className="meal" onClick={() => setOpenId(d.id)}>
                  <img src={d.thumb} alt="" loading="lazy" />
                  <b>{d.title}</b>
                </button>
              ))}
            </div>
          )}

          <p className="small muted">
            Названия в каталоге на английском — при сохранении нейросеть переведёт рецепт на русский и пересчитает меры в граммы и миллилитры.
          </p>
        </div>
      )}

      <ItemSheetModal id={openId} mode={mode} onClose={() => setOpenId(null)} />
    </main>
  );
}

function ItemSheetModal({ id, mode, onClose }: { id: string | null; mode: CatalogMode; onClose: () => void }) {
  const [details, setDetails] = useState<{
    title: string;
    thumb: string;
    category?: string | null;
    area?: string | null;
    ingredients: { name: string; measure: string }[];
    rawText: string;
    origin: string;
  } | null>(null);

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDetails(null);
    setRecipe(null);
    setError(null);
    if (!id) return;

    if (mode === 'meals') {
      mealDetails(id)
        .then((m) => {
          if (!m) return;
          setDetails({
            title: m.title,
            thumb: m.thumb,
            category: m.category,
            area: m.area,
            ingredients: m.ingredients,
            rawText: mealToText(m),
            origin: m.source ?? `TheMealDB: ${m.title}`,
          });
        })
        .catch((e: Error) => setError(e.message));
    } else {
      drinkDetails(id)
        .then((d) => {
          if (!d) return;
          setDetails({
            title: d.title,
            thumb: d.thumb,
            category: d.category,
            area: 'Безалкогольный напиток',
            ingredients: d.ingredients,
            rawText: drinkToText(d),
            origin: `TheCocktailDB: ${d.title}`,
          });
        })
        .catch((e: Error) => setError(e.message));
    }
  }, [id, mode]);

  async function translate() {
    if (!details) return;
    setBusy(true);
    setError(null);
    try {
      const g = await generateRecipe({
        task: 'import',
        today: todayISO(),
        url: null,
        text: details.rawText,
        images: [],
      });
      const r = generatedToRecipe(g, mode === 'meals' ? 'TheMealDB' : 'TheCocktailDB');
      if (mode === 'drinks' && !r.tags.includes('напиток')) {
        r.tags.push('напиток');
      }
      setRecipe({ ...r, image: details.thumb, origin: details.origin });
      setNote(g.note);
    } catch (e) {
      setError(e instanceof AiRequestError ? e.message : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={!!id} onClose={onClose} title={recipe ? undefined : details?.title ?? 'Загружаю…'}>
      {recipe ? (
        <ResultCard recipe={recipe} note={note} onReset={() => setRecipe(null)} />
      ) : !details ? (
        error ? <div className="notice error">{error}</div> : <div className="row-gap muted"><Spinner /> Загружаю детали…</div>
      ) : (
        <div className="stack-lg">
          <img
            src={details.thumb}
            alt=""
            style={{ borderRadius: 16, aspectRatio: '16 / 10', objectFit: 'cover', width: '100%' }}
          />
          <span className="meta">
            {[details.area, details.category].filter(Boolean).join(' · ')} · {details.ingredients.length} ингредиентов
          </span>
          <p className="small muted" lang="en" style={{ maxHeight: 120, overflow: 'hidden' }}>
            {details.ingredients.map((i) => i.name).join(', ')}
          </p>
          {error && <div className="notice error">{error}</div>}
          <button className="btn block" disabled={busy} onClick={translate}>
            {busy ? <><Spinner /> Перевожу…</> : 'Перевести на русский и сохранить'}
          </button>
        </div>
      )}
    </Sheet>
  );
}
