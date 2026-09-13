import { useState } from 'react';
import { IconCamera, IconSpark } from '../components/icons';
import { Header, Plate, Segmented, Spinner, toast, useOnline } from '../components/ui';
import { getItems, getSettings, saveRecipe } from '../data/repo';
import { AiRequestError, generateRecipe } from '../lib/ai';
import { generatedToRecipe } from '../lib/convert';
import { shrinkPhoto, toImagePart } from '../lib/image';
import { go, href } from '../router';
import { todayISO } from '../shared/dates';
import { daysLeft } from '../shared/freshness';
import { getProduct } from '../shared/products';
import type { Recipe } from '../shared/recipeTypes';
import { formatQty } from '../shared/units';

type Mode = 'invent' | 'import';

const WISHES = ['Быстро, до 20 минут', 'Без духовки', 'На завтрак', 'Суп', 'Что-то лёгкое', 'Для гостей'];

export function Chef() {
  const online = useOnline();
  const [mode, setMode] = useState<Mode>('invent');
  const [result, setResult] = useState<Recipe | null>(null);
  const [note, setNote] = useState<string | null>(null);

  return (
    <main className="screen">
      <Header title="Шеф" sub="Нейросеть придумывает и переводит рецепты" />
      <Segmented<Mode> value={mode} onChange={(m) => { setMode(m); setResult(null); }} options={[
        { value: 'invent', label: 'Придумать из продуктов' },
        { value: 'import', label: 'Импорт рецепта' },
      ]} />

      {!online && <div className="notice" style={{ marginBottom: 12 }}>Шефу нужен интернет. Сохранённые рецепты и подборка работают и без него.</div>}

      {result ? (
        <ResultCard recipe={result} note={note} onReset={() => setResult(null)} />
      ) : mode === 'invent' ? (
        <Invent disabled={!online} onResult={(r, n) => { setResult(r); setNote(n); }} />
      ) : (
        <Import disabled={!online} onResult={(r, n) => { setResult(r); setNote(n); }} />
      )}
    </main>
  );
}

function Invent({ disabled, onResult }: { disabled: boolean; onResult: (r: Recipe, note: string | null) => void }) {
  const [wish, setWish] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const [items, settings] = await Promise.all([getItems(), getSettings()]);
      const today = todayISO();
      const inventory = items
        .filter((i) => (daysLeft(i.expiresAt, today) ?? 0) >= 0)
        .map((i) => ({ name: i.name, product_key: i.productKey, qty: i.qty, unit: i.unit, days_left: daysLeft(i.expiresAt, today) }));
      const g = await generateRecipe({ task: 'recipe', today, wish, servings: settings.servings, staples: settings.staples, inventory });
      onResult(generatedToRecipe(g), g.note);
    } catch (e) {
      setError(e instanceof AiRequestError || e instanceof Error ? e.message : 'Не получилось');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack-lg">
      <p className="muted">Шеф посмотрит, что лежит в холодильнике, и придумает блюдо — в первую очередь из того, что скоро испортится.</p>
      <label className="field">
        <span>Пожелание (необязательно)</span>
        <input className="input" placeholder="Например, что-нибудь с курицей" value={wish} onChange={(e) => setWish(e.target.value)} />
      </label>
      <div className="wrap-gap">
        {WISHES.map((w) => <button key={w} className={`chip${wish === w ? ' on' : ''}`} onClick={() => setWish(wish === w ? '' : w)}>{w}</button>)}
      </div>
      {error && <div className="notice error">{error}</div>}
      <button className="btn block" disabled={disabled || busy} onClick={run}>
        {busy ? <><Spinner /> Шеф думает…</> : <><IconSpark /> Придумать рецепт</>}
      </button>
    </div>
  );
}

function Import({ disabled, onResult }: { disabled: boolean; onResult: (r: Recipe, note: string | null) => void }) {
  const [source, setSource] = useState('');
  const [photos, setPhotos] = useState<Blob[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = source.trim();
  const isUrl = /^https?:\/\/\S+$/i.test(trimmed);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const images = await Promise.all(photos.map(toImagePart));
      const g = await generateRecipe({
        task: 'import', today: todayISO(), url: isUrl ? trimmed : null, text: !isUrl && trimmed ? trimmed : null, images,
      });
      if (g.ingredients.length === 0) throw new Error('Рецепт не найден. Попробуйте вставить сам текст рецепта.');
      onResult(generatedToRecipe(g, isUrl ? new URL(trimmed).hostname.replace(/^www\./, '') : 'импорт'), g.note);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack-lg">
      <p className="muted">Вставьте ссылку на рецепт, его текст на любом языке или сфотографируйте страницу книги. Нейросеть переведёт, пересчитает меры в граммы и сохранит рецепт в приложение.</p>
      <label className="field">
        <span>Ссылка или текст</span>
        <textarea className="textarea" placeholder="https://… или текст рецепта" value={source} onChange={(e) => setSource(e.target.value)} />
      </label>
      <div className="capture" style={{ gridTemplateColumns: '1fr' }}>
        <label className="btn ghost">
          <IconCamera /> {photos.length ? `Фото страниц: ${photos.length}` : 'Фото страницы книги'}
          <input type="file" accept="image/*" multiple onChange={async (e) => {
            const files = [...(e.target.files ?? [])].slice(0, 4);
            e.target.value = '';
            setPhotos(await Promise.all(files.map(shrinkPhoto)));
          }} />
        </label>
      </div>
      {error && <div className="notice error">{error}</div>}
      <button className="btn block" disabled={disabled || busy || (!trimmed && photos.length === 0)} onClick={run}>
        {busy ? <><Spinner /> Перевожу и разбираю…</> : 'Импортировать'}
      </button>
    </div>
  );
}

export function ResultCard({ recipe, note, onReset }: { recipe: Recipe; note: string | null; onReset: () => void }) {
  async function save(thenCook: boolean) {
    await saveRecipe(recipe);
    toast('Рецепт сохранён');
    go(thenCook ? `${href('cook', recipe.id)}?portions=${recipe.servings}` : href('recipe', recipe.id));
  }
  return (
    <div className="stack-lg">
      <div className="card stack">
        <Plate big color={recipe.color} photo={recipe.image} />
        <h2 style={{ fontSize: 20 }}>{recipe.title}</h2>
        <span className="meta num"><span>{recipe.time} мин</span><span>{recipe.servings} порц.</span>{recipe.kcal && <span>{recipe.kcal} ккал</span>}</span>
        {note && <div className="notice info">{note}</div>}
        <div className="section-label">Ингредиенты</div>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
          {recipe.ingredients.map((i, n) => (
            <li key={n}>{i.name ?? getProduct(i.key)?.name} <span className="muted mono small">{formatQty(i.qty, i.unit)}</span></li>
          ))}
        </ul>
        <div className="section-label">Шаги</div>
        <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
          {recipe.steps.map((s, n) => <li key={n}>{s.text}</li>)}
        </ol>
      </div>
      <button className="btn block" onClick={() => save(false)}>Сохранить в мои рецепты</button>
      <button className="btn ghost block" onClick={() => save(true)}>Сохранить и готовить</button>
      <button className="btn quiet" onClick={onReset}>Попробовать другой вариант</button>
    </div>
  );
}
