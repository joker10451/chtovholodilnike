import { useState } from 'react';
import { Sheet, Spinner, toast, useOnline } from '../components/ui';
import { saveRecipe } from '../data/repo';
import { generateRecipe } from '../lib/ai';
import { generatedToRecipe } from '../lib/convert';
import { todayISO } from '../shared/dates';
import { getProduct } from '../shared/products';
import type { Recipe } from '../shared/recipeTypes';
import { formatQty } from '../shared/units';

const QUICK = ['На 4 порции', 'Без лука', 'Шаги подробнее', 'Меньше соли и масла', 'Исправь граммы'];

function recipeText(r: Recipe): string {
  return [
    `${r.title} — ${r.servings} порц., ${r.time} мин`,
    'Ингредиенты:',
    ...r.ingredients.map((i) => `- ${i.name ?? getProduct(i.key)?.name ?? i.key}: ${i.qty ? formatQty(i.qty, i.unit) : 'по вкусу'}`),
    'Шаги:',
    ...r.steps.map((s, n) => `${n + 1}. ${s.text}`),
  ].join('\n');
}

/** Поправить сохранённый рецепт просьбой обычными словами — нейросеть вернёт исправленный вариант */
export function FixRecipeSheet({ recipe, open, onClose }: { recipe: Recipe; open: boolean; onClose: () => void }) {
  const online = useOnline();
  const [wish, setWish] = useState('');
  const [draft, setDraft] = useState<Recipe | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setDraft(null);
    setError(null);
    setWish('');
    onClose();
  }

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const g = await generateRecipe({
        task: 'import',
        today: todayISO(),
        url: null,
        text: `Просьба: ${wish.trim()}\n\nРецепт:\n${recipeText(recipe)}`,
        images: [],
      });
      if (g.ingredients.length === 0) throw new Error('Не получилось поправить. Попробуйте сказать иначе.');
      const fixed = generatedToRecipe(g);
      setDraft({ ...fixed, id: recipe.id, color: recipe.color, image: recipe.image, origin: recipe.origin, tags: recipe.tags });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    await saveRecipe(draft!);
    toast('Рецепт исправлен');
    close();
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title="Поправить рецепт"
      footer={draft ? (
        <div className="field-row">
          <button className="btn ghost" onClick={() => setDraft(null)}>Заново</button>
          <button className="btn" onClick={save}>Сохранить</button>
        </div>
      ) : (
        <button className="btn block" disabled={!online || busy || !wish.trim()} onClick={run}>
          {busy ? <><Spinner /> Исправляю…</> : online ? 'Исправить' : 'Нужен интернет'}
        </button>
      )}
    >
      {draft ? (
        <div className="stack">
          <b>{draft.title}</b>
          <span className="small muted num">{draft.servings} порц. · {draft.time} мин</span>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
            {draft.ingredients.map((i, n) => (
              <li key={n}>{i.name ?? getProduct(i.key)?.name} <span className="muted mono small">{i.qty ? formatQty(i.qty, i.unit) : 'по вкусу'}</span></li>
            ))}
          </ul>
          <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
            {draft.steps.map((s, n) => <li key={n} className="small">{s.text}</li>)}
          </ol>
        </div>
      ) : (
        <div className="stack">
          <p className="small muted">Напишите, что поменять, — нейросеть перепишет рецепт, а вы проверите перед сохранением.</p>
          <textarea className="textarea" placeholder="Например: на 6 порций, вместо сливок сметана" value={wish} onChange={(e) => setWish(e.target.value)} />
          <div className="wrap-gap">
            {QUICK.map((q) => (
              <button key={q} type="button" className="chip" onClick={() => setWish((w) => (w.trim() ? `${w.trim()}, ${q.toLowerCase()}` : q))}>{q}</button>
            ))}
          </div>
          {error && <div className="notice error">{error}</div>}
        </div>
      )}
    </Sheet>
  );
}
