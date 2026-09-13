import { useMemo, useState } from 'react';
import { IconGlobe, IconSpark } from '../components/icons';
import { Empty, Header, Plate, Ring, Segmented } from '../components/ui';
import { useAllRecipes } from '../data/repo';
import { useMatchContext } from '../hooks';
import { onShelf, rankRecipes, type RecipeMatch, type Shelf } from '../lib/matching';
import { go, href, useRoute } from '../router';
import { getProduct, normalizeName } from '../shared/products';
import { plural } from './Fridge';

export function Recipes() {
  const route = useRoute();
  const ctx = useMatchContext();
  const recipes = useAllRecipes();
  const [query, setQuery] = useState('');
  const shelfParam = route.query.get('shelf') as Shelf | null;

  const ranked = useMemo(() => (ctx ? rankRecipes(ctx, recipes) : []), [ctx, recipes]);
  const counts = useMemo(() => ({
    rescue: ranked.filter((m) => onShelf(m, 'rescue')).length,
    ready: ranked.filter((m) => onShelf(m, 'ready')).length,
    buy: ranked.filter((m) => onShelf(m, 'buy')).length,
    all: ranked.length,
  }), [ranked]);

  const defaultShelf: Shelf = counts.rescue > 0 ? 'rescue' : counts.ready > 0 ? 'ready' : 'all';
  const shelf = shelfParam ?? defaultShelf;
  const setShelf = (s: Shelf) => go(`${href('recipes')}?shelf=${s}`, true);

  const q = normalizeName(query);
  const visible = ranked.filter((m) => (q ? normalizeName(m.recipe.title).includes(q) : onShelf(m, shelf)));

  return (
    <main className="screen">
      <Header title="Что приготовить" sub={`${recipes.length} ${plural(recipes.length, 'рецепт', 'рецепта', 'рецептов')} · подобраны по холодильнику`} />

      <div className="stack">
        <input className="input" type="search" placeholder="Поиск по названию" value={query} onChange={(e) => setQuery(e.target.value)} />
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
      </div>

      <div className="stack">
        {visible.map((m) => <RecipeCard key={m.recipe.id} match={m} />)}
        {ctx && visible.length === 0 && (
          <Empty title={q ? 'Ничего не нашлось' : shelf === 'rescue' ? 'Спасать нечего' : 'Пока пусто'}>
            {q ? 'Попробуйте другое название или найдите рецепт в каталоге.'
              : shelf === 'rescue' ? 'Продуктов с истекающим сроком нет. Загляните в «Всё есть».'
                : 'Добавьте продукты в холодильник — подборка обновится сама.'}
          </Empty>
        )}
      </div>

      <div className="stack" style={{ marginTop: 18 }}>
        <div className="section-label">Больше рецептов</div>
        <a className="btn ghost block" href={href('chef')}><IconSpark /> Придумать из того, что есть</a>
        <a className="btn ghost block" href={href('catalog')}><IconGlobe /> Каталог с переводом</a>
      </div>
    </main>
  );
}

function RecipeCard({ match: m }: { match: RecipeMatch }) {
  const r = m.recipe;
  return (
    <a className="recipe-card" href={href('recipe', r.id)}>
      <Plate color={r.color} photo={r.image} />
      <div className="body">
        <span className="title">{r.title}</span>
        <span className="meta num">
          <span>{r.time} мин</span>
          <span>{r.servings} порц.</span>
          {r.source === 'ai' && <span>мой рецепт</span>}
        </span>
        <span className="wrap-gap">
          {m.rescueItemIds.length > 0 && <span className="stk soon">спасает {m.rescueItemIds.length}</span>}
          {m.missing.length === 0
            ? <span className="stk fresh">всё есть</span>
            : <span className="stk plain">нет: {m.missing.slice(0, 2).map((x) => x.ingredient.name ?? shortName(x.ingredient.key)).join(', ')}{m.missing.length > 2 ? '…' : ''}</span>}
        </span>
      </div>
      <Ring percent={m.coverage * 100} />
    </a>
  );
}

function shortName(key: string | null) {
  return (getProduct(key)?.name ?? '').toLowerCase();
}
