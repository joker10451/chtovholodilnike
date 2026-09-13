import { useMemo, useState } from 'react';
import { IconPlus } from '../components/icons';
import { CATEGORY_DOT, Empty, Header, Segmented, Sticker, useToday } from '../components/ui';
import { useItems } from '../data/repo';
import type { InventoryItem } from '../data/types';
import { href } from '../router';
import { daysLeft, RESCUE_DAYS } from '../shared/freshness';
import { LOCATION_LABELS, type Location } from '../shared/products';
import { formatQty } from '../shared/units';
import { AddSheet } from './AddSheet';
import { ItemSheet } from './ItemSheet';

type Filter = 'all' | Location;

export function Fridge() {
  const items = useItems();
  const today = useToday();
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [adding, setAdding] = useState(false);

  const sorted = useMemo(
    () => [...(items ?? [])].sort((a, b) => (a.expiresAt ?? '9999').localeCompare(b.expiresAt ?? '9999') || a.name.localeCompare(b.name, 'ru')),
    [items],
  );
  const visible = filter === 'all' ? sorted : sorted.filter((i) => i.location === filter);
  const expiring = sorted.filter((i) => {
    const left = daysLeft(i.expiresAt, today);
    return left !== null && left <= RESCUE_DAYS;
  });
  const count = (loc: Location) => sorted.filter((i) => i.location === loc).length;

  return (
    <main className="screen">
      <Header
        title="Холодильник"
        sub={items ? `${sorted.length} ${plural(sorted.length, 'продукт', 'продукта', 'продуктов')}` : ' '}
        right={<button className="icon-btn" aria-label="Добавить продукт" onClick={() => setAdding(true)}><IconPlus /></button>}
      />

      <Segmented<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'Всё', count: sorted.length },
          ...(['fridge', 'freezer', 'pantry'] as Location[]).map((l) => ({ value: l, label: LOCATION_LABELS[l], count: count(l) })),
        ]}
      />

      {expiring.length > 0 && (
        <a className="alert" href={href('recipes') + '?shelf=rescue'} style={{ color: 'inherit', textDecoration: 'none' }}>
          <b>Срок подходит к концу: {expiring.length} {plural(expiring.length, 'продукт', 'продукта', 'продуктов')}</b>
          <span>Что из них приготовить →</span>
        </a>
      )}

      {items && sorted.length === 0 && (
        <Empty
          title="Холодильник пока пуст"
          action={
            <div className="stack" style={{ width: '100%', maxWidth: 320 }}>
              <a className="btn block" href={href('scan')}>Сфотографировать полки</a>
              <button className="btn ghost block" onClick={() => setAdding(true)}>Добавить вручную</button>
            </div>
          }
        >
          Сфотографируйте полки — нейросеть сама найдёт продукты и посчитает сроки. Или добавьте продукты текстом.
        </Empty>
      )}

      {visible.length > 0 && (
        <div className="list">
          {visible.map((item) => (
            <button key={item.id} className="item-row" onClick={() => setEditing(item)}>
              <span className="dot"><i style={{ background: CATEGORY_DOT[item.category] }} /></span>
              <span className="nm">
                <b>{item.name}</b>
                <small className="num">
                  {formatQty(item.qty, item.unit)}
                  {item.openedAt ? ' · открыт' : ''}
                  {filter === 'all' && item.location !== 'fridge' ? ` · ${LOCATION_LABELS[item.location].toLowerCase()}` : ''}
                </small>
              </span>
              <Sticker expiresAt={item.expiresAt} isEstimate={item.isEstimate} today={today} />
            </button>
          ))}
        </div>
      )}

      <ItemSheet item={editing} onClose={() => setEditing(null)} />
      <AddSheet open={adding} onClose={() => setAdding(false)} />
    </main>
  );
}

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
