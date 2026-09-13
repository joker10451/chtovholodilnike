import { useMemo, useState } from 'react';
import { IconCamera, IconGlobe, IconScan, IconSpark } from '../components/icons';
import { Empty, Header, Plate, Ring, Segmented } from '../components/ui';
import { useAllRecipes } from '../data/repo';
import { useMatchContext } from '../hooks';
import { onShelf, rankRecipes, type RecipeMatch, type Shelf } from '../lib/matching';
import { go, href, useRoute } from '../router';
import { isFavorite, tasteOf } from '../lib/taste';
import { getProduct, normalizeName } from '../shared/products';
import { plural } from './Fridge';

const TAG_CHIPS = [
  { id: 'all', label: 'Все' },
  { id: 'favorite', label: 'Любимые' },
  { id: 'mine', label: 'Мои' },
  { id: 'завтрак', label: 'Завтраки' },
  { id: 'ужин', label: 'Обед и ужин' },
  { id: 'напиток', label: 'Смузи и напитки' },
  { id: 'quick', label: 'До 25 мин' },
  { id: 'впрок', label: 'Впрок' },
];

export function Recipes() {
  const route = useRoute();
  const ctx = useMatchContext();
  const recipes = useAllRecipes();
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string>('all');
  const shelfParam = route.query.get('shelf') as Shelf | null;

  const hasItems = (ctx?.items.length ?? 0) > 0;

  const ranked = useMemo(() => (ctx ? rankRecipes(ctx, recipes) : []), [ctx, recipes]);
  const counts = useMemo(() => ({
    rescue: ranked.filter((m) => onShelf(m, 'rescue', hasItems)).length,
    ready: ranked.filter((m) => onShelf(m, 'ready', hasItems)).length,
    buy: ranked.filter((m) => onShelf(m, 'buy', hasItems)).length,
    all: ranked.length,
  }), [ranked, hasItems]);

  const defaultShelf: Shelf = !hasItems
    ? 'all'
    : counts.rescue > 0
      ? 'rescue'
      : counts.ready > 0
        ? 'ready'
        : counts.buy > 0
          ? 'buy'
          : 'all';

  const shelf = shelfParam ?? defaultShelf;
  const setShelf = (s: Shelf) => go(`${href('recipes')}?shelf=${s}`, true);

  const q = normalizeName(query);
  const visible = ranked.filter((m) => {
    if (q) return normalizeName(m.recipe.title).includes(q);
    if (!onShelf(m, shelf, hasItems)) return false;
    if (tag === 'all') return true;
    if (tag === 'quick') return m.recipe.time <= 25;
    if (tag === 'favorite') return isFavorite(tasteOf(ctx?.tastes, m.recipe.id));
    if (tag === 'mine') return m.recipe.source === 'ai';
    return m.recipe.tags.includes(tag);
  });

  return (
    <main className="screen">
      <Header
        title="Что приготовить"
        sub={
          hasItems
            ? `${recipes.length} ${plural(recipes.length, 'рецепт', 'рецепта', 'рецептов')} · подобраны по холодильнику`
            : `${recipes.length} ${plural(recipes.length, 'рецепт', 'рецепта', 'рецептов')} · каталог блюд`
        }
        right={
          <a
            className="icon-btn"
            href={href('chef')}
            aria-label="Придумать рецепт из того, что есть"
            style={{ color: 'var(--brand)' }}
          >
            <IconSpark width={18} height={18} />
          </a>
        }
      />

      <div className="stack">
        <input
          className="input"
          type="search"
          placeholder="Поиск по названию"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {!hasItems && !q && (
          <div
            className="card flat"
            style={{
              padding: '14px 16px',
              background: 'var(--surface-2)',
              border: '1px solid var(--line)',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Холодильник пока пуст</div>
              <div className="small muted" style={{ marginTop: 2, lineHeight: 1.35 }}>
                Сфотографируйте полки или чек — рецепты сразу распределятся по полкам «Спасти», «Всё есть» и «Докупить 1–2».
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a
                className="btn small"
                href={href('scan')}
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <IconScan width={16} height={16} /> Сфотографировать полку
              </a>
              <a
                className="btn small ghost"
                href={href('fridge')}
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                Внести продукты
              </a>
            </div>
          </div>
        )}

        {!q && (
          <Segmented<Shelf>
            value={shelf}
            onChange={setShelf}
            options={[
              { value: 'rescue', label: 'Спасти продукты', count: counts.rescue },
              { value: 'ready', label: 'Всё есть', count: counts.ready },
              { value: 'buy', label: 'Докупить 1–2', count: counts.buy },
              { value: 'all', label: 'Все', count: counts.all },
            ]}
          />
        )}

        {!q && (
          <div className="seg chips-row">
            {TAG_CHIPS.map((c) => (
              <button
                key={c.id}
                className={`chip${tag === c.id ? ' on' : ''}`}
                onClick={() => setTag(c.id)}
                type="button"
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="stack" style={{ marginTop: 4 }}>
        {visible.map((m) => <RecipeCard key={m.recipe.id} match={m} hasItems={hasItems} favorite={isFavorite(tasteOf(ctx?.tastes, m.recipe.id))} />)}
        {ctx && visible.length === 0 && (
          <Empty
            title={
              q
                ? 'Ничего не нашлось'
                : !hasItems && shelf !== 'all'
                  ? 'В холодильнике пока пусто'
                  : shelf === 'rescue'
                    ? 'Спасать нечего'
                    : 'Пока пусто'
            }
          >
            {tag === 'favorite' && !q
              ? 'Оцените блюдо после готовки — оценка «Вкусно» добавит его сюда.'
              : tag === 'mine' && !q
              ? 'Здесь будут семейные рецепты: сфотографируйте тетрадь, вставьте ссылку или текст из заметок.'
              : q
              ? 'Попробуйте другое название или найдите рецепт в каталоге.'
              : !hasItems && shelf !== 'all'
                ? 'Добавьте продукты в холодильник — и подходящие блюда появятся на этой полке.'
                : shelf === 'rescue'
                  ? 'Продуктов с истекающим сроком нет. Загляните в «Всё есть».'
                  : 'Добавьте продукты в холодильник — подборка обновится сама.'}
          </Empty>
        )}
      </div>

      <div className="stack" style={{ marginTop: 18 }}>
        <div className="section-label">Больше рецептов</div>
        <a className="btn ghost block" href={`${href('chef')}?mode=import`}><IconCamera /> Добавить свой рецепт</a>
        <a className="btn ghost block" href={href('chef')}><IconSpark /> Придумать из того, что есть</a>
        <a className="btn ghost block" href={href('catalog')}><IconGlobe /> Каталог с переводом</a>
      </div>
    </main>
  );
}

function RecipeCard({ match: m, hasItems, favorite }: { match: RecipeMatch; hasItems: boolean; favorite: boolean }) {
  const r = m.recipe;
  return (
    <a className="recipe-card" href={href('recipe', r.id)}>
      <Plate recipe={r} />
      <div className="body">
        <span className="title">{r.title}</span>
        <span className="meta num">
          <span>{r.time} мин</span>
          <span>{r.servings} порц.</span>
          {r.source === 'ai' && <span>мой рецепт</span>}
        </span>
        <span className="wrap-gap">
          {favorite && <span className="stk fresh">любимое</span>}
          {m.rescueItemIds.length > 0 && <span className="stk soon">спасает {m.rescueItemIds.length}</span>}
          {!hasItems ? (
            r.tags.slice(0, 2).map((t) => <span key={t} className="stk plain">{t}</span>)
          ) : m.missing.length === 0 ? (
            <span className="stk fresh">всё есть</span>
          ) : (
            <span className="stk plain">
              нет: {m.missing.slice(0, 2).map((x) => x.ingredient.name ?? shortName(x.ingredient.key)).join(', ')}
              {m.missing.length > 2 ? '…' : ''}
            </span>
          )}
        </span>
      </div>
      <Ring percent={m.coverage * 100} />
    </a>
  );
}

function shortName(key: string | null) {
  return (getProduct(key)?.name ?? '').toLowerCase();
}