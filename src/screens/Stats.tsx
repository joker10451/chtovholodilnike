import { useMemo } from 'react';
import { Empty, Header } from '../components/ui';
import { useCookLog, useWasteLog } from '../data/repo';
import { monthKey, monthStats, monthTitle, shiftMonth } from '../lib/stats';
import { RATING_LABELS } from '../lib/taste';
import { go, href, useRoute } from '../router';
import { plural } from './Fridge';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function Stats() {
  const route = useRoute();
  const log = useCookLog();
  const waste = useWasteLog();
  const current = monthKey(Date.now());
  const month = route.query.get('month') ?? current;
  const stats = useMemo(() => (log && waste ? monthStats(log, waste, month) : null), [log, waste, month]);
  const setMonth = (m: string) => go(`${href('stats')}?month=${m}`, true);

  const repeatWaste = stats?.wasteByProduct.filter((w) => w.times >= 2) ?? [];
  const empty = stats && stats.cooked === 0 && stats.wasted === 0;

  return (
    <main className="screen">
      <Header title="Итоги" sub={monthTitle(month)} backTo={href('settings')} />

      <div className="row-gap" style={{ marginBottom: 12 }}>
        <button className="btn small ghost" onClick={() => setMonth(shiftMonth(month, -1))}>← {monthTitle(shiftMonth(month, -1)).split(' ')[0]}</button>
        <div className="grow" />
        {month < current && (
          <button className="btn small ghost" onClick={() => setMonth(shiftMonth(month, 1))}>{monthTitle(shiftMonth(month, 1)).split(' ')[0]} →</button>
        )}
      </div>

      {!stats ? null : empty ? (
        <Empty title="Пока нечего подводить">
          {month === current
            ? 'Готовьте по рецептам из приложения и отмечайте, что выбросили, — здесь появятся блюда месяца и спасённые продукты.'
            : 'В этом месяце по приложению не готовили.'}
        </Empty>
      ) : (
        <div className="stack-lg">
          <div className="kpis">
            <div className="kpi">
              <b className="num">{stats.cooked}</b>
              <span>{plural(stats.cooked, 'блюдо', 'блюда', 'блюд')}</span>
            </div>
            <div className="kpi fresh">
              <b className="num">{stats.rescued}</b>
              <span>{plural(stats.rescued, 'продукт спасён', 'продукта спасено', 'продуктов спасено')}</span>
            </div>
            <div className={`kpi${stats.wasted ? ' bad' : ''}`}>
              <b className="num">{stats.wasted}</b>
              <span>выброшено</span>
            </div>
          </div>

          {stats.wasted === 0 && stats.cooked > 0 && (
            <div className="notice info">Ничего не выбросили — отличный месяц.</div>
          )}

          {stats.topDishes.length > 0 && (
            <section className="stack">
              <div className="section-label">Чаще всего готовили</div>
              <div className="card flat stack">
                {stats.topDishes.map((d) => (
                  <a key={d.recipeId} className="row-gap stat-row" href={href('recipe', d.recipeId)}>
                    <span className="grow">{d.title}</span>
                    {d.lastRating && <span className={`stk ${d.lastRating === 5 ? 'fresh' : d.lastRating === 1 ? 'expired' : 'plain'}`}>{RATING_LABELS[d.lastRating].toLowerCase()}</span>}
                    <span className="mono small muted">×{d.times}</span>
                  </a>
                ))}
              </div>
              {stats.portions > 0 && <p className="small muted">Всего {stats.portions} {plural(stats.portions, 'порция', 'порции', 'порций')}.</p>}
            </section>
          )}

          {stats.wasteByProduct.length > 0 && (
            <section className="stack">
              <div className="section-label">Выбросили</div>
              <div className="card flat stack">
                {stats.wasteByProduct.map((w) => (
                  <div key={w.name} className="row-gap stat-row">
                    <span className="grow">{w.name}</span>
                    <span className="mono small muted">×{w.times}</span>
                  </div>
                ))}
              </div>
              {repeatWaste.length > 0 && (
                <div className="notice">
                  {capitalize(repeatWaste.map((w) => w.name.toLowerCase()).join(', '))} {repeatWaste.length === 1 ? 'выбрасывается' : 'выбрасываются'} не первый раз — возьмите упаковку поменьше или заморозьте часть сразу после покупки.
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </main>
  );
}
