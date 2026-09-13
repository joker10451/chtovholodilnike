import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { IconTimer } from '../components/icons';
import { Header, Plate, Stepper, toast } from '../components/ui';
import { deleteRecords, getRecipe } from '../data/repo';
import { useMatchContext } from '../hooks';
import { matchRecipe, type IngredientMatch } from '../lib/matching';
import { back, go, href } from '../router';
import { getProduct } from '../shared/products';
import { formatQty } from '../shared/units';

const MARK: Record<IngredientMatch['state'], string> = { have: '✓', sub: '⇄', staple: '✓', partial: '½', missing: '×' };

export function ingredientTitle(m: Pick<IngredientMatch, 'ingredient'>): string {
  return m.ingredient.name ?? getProduct(m.ingredient.key)?.name ?? 'Ингредиент';
}

export function RecipeDetail({ id }: { id: string }) {
  const recipe = useLiveQuery(() => getRecipe(id).then((r) => r ?? null), [id]);
  const ctx = useMatchContext();
  const [portions, setPortions] = useState<number | null>(null);

  const p = portions ?? recipe?.servings ?? 2;
  const match = useMemo(() => (recipe && ctx ? matchRecipe(ctx, recipe, p) : null), [recipe, ctx, p]);

  if (recipe === undefined) return <main className="screen no-tabs" />;
  if (recipe === null) return <main className="screen no-tabs"><Header title="Рецепт не найден" backTo="#/recipes" /></main>;

  const factor = p / recipe.servings;
  const missing = match?.missing ?? [];

  async function shareMissing() {
    const text = `Купить для «${recipe!.title}»:\n${missing.map((m) => `— ${ingredientTitle(m)}${m.ingredient.qty ? `, ${formatQty(m.ingredient.qty * factor, m.ingredient.unit)}` : ''}`).join('\n')}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast('Список скопирован');
      }
    } catch { /* пользователь закрыл окно «Поделиться» */ }
  }

  async function remove() {
    if (!confirm(`Удалить рецепт «${recipe!.title}»?`)) return;
    await deleteRecords([recipe!.id]);
    toast('Рецепт удалён');
    back('#/recipes');
  }

  return (
    <main className="screen no-tabs">
      <Header title={recipe.title} backTo="#/recipes" sub={
        <span className="meta num">
          <span>{recipe.time} мин</span>
          {recipe.kcal && <span>{recipe.kcal} ккал/порц.</span>}
          {recipe.tags.slice(0, 3).map((t) => <span key={t}>{t}</span>)}
        </span>
      } />

      <div className="stack-lg">
        <Plate big color={recipe.color} photo={recipe.image} />

        <div className="card flat row-gap">
          <div className="grow">
            <b>Порций</b>
            <div className="small muted">Количества пересчитаются</div>
          </div>
          <div style={{ width: 150 }}><Stepper label="Порций" value={p} min={1} onChange={(v) => setPortions(Math.max(1, Math.round(v)))} /></div>
        </div>

        {match && match.rescueItemIds.length > 0 && (
          <div className="notice">
            <b>Помогает доесть</b>
            <span>{ctx!.items.filter((i) => match.rescueItemIds.includes(i.id)).map((i) => i.name).join(', ')}</span>
          </div>
        )}

        <div className="stack">
          <div className="section-label">Ингредиенты</div>
          <div className="list">
            {(match?.ingredients ?? []).map((m, i) => (
              <div key={i} className="ing">
                <span className={`mark ${m.state}`}>{MARK[m.state]}</span>
                <span className="nm">
                  <span>{ingredientTitle(m)}</span>
                  {m.state === 'sub' && m.sub && <small>заменим: {getProduct(m.sub.key)?.name.toLowerCase()}</small>}
                  {m.state === 'staple' && <small>базовый запас</small>}
                  {m.state === 'partial' && <small>дома не хватает</small>}
                  {m.state === 'missing' && m.ingredient.role === 'basic' && <small>по желанию</small>}
                </span>
                <span className="q">{formatQty(m.ingredient.qty * factor, m.ingredient.unit)}</span>
              </div>
            ))}
          </div>
          {missing.length > 0 && (
            <button className="btn ghost block" onClick={shareMissing}>Отправить, что купить ({missing.length})</button>
          )}
        </div>

        <div className="stack">
          <div className="section-label">Как готовить</div>
          <ol className="steps list">
            {recipe.steps.map((s, i) => (
              <li key={i}>
                <span>
                  {s.text}
                  {s.timer && <span className="small muted" style={{ display: 'inline-flex', gap: 4, alignItems: 'center', marginLeft: 6 }}><IconTimer width={14} height={14} />{Math.round(s.timer / 60)} мин</span>}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {recipe.origin && <p className="small muted">Источник: {recipe.origin}</p>}

        <div className="stack">
          <button className="btn block" onClick={() => go(`${href('cook', recipe.id)}?portions=${p}`)}>Начать готовить</button>
          {recipe.source === 'ai' && <button className="btn quiet" onClick={remove}>Удалить рецепт</button>}
        </div>
      </div>
    </main>
  );
}
