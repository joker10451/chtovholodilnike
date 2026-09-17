import { useEffect, useMemo, useState } from 'react';
import { IconMore, IconPlus } from '../components/icons';
import { ProductIcon } from '../components/foodIcons';
import { Empty, Header, Segmented, Sticker, toast, useToday } from '../components/ui';
import { addShoppingItems, finishItem, restoreRecords, useItems } from '../data/repo';
import type { InventoryItem } from '../data/types';
import { SwipeRow } from '../components/SwipeRow';
import { go, href, useRoute } from '../router';
import { daysLeft, RESCUE_DAYS } from '../shared/freshness';
import { LOCATION_LABELS, type Location } from '../shared/products';
import { formatQty } from '../shared/units';
import { AddSheet } from './AddSheet';
import { ItemSheet } from './ItemSheet';

type Filter = 'all' | Location;

export function Fridge() {
  const route = useRoute();
  const items = useItems();
  const today = useToday();
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [adding, setAdding] = useState(route.query.get('add') === '1');

  useEffect(() => {
    if (route.query.get('add') === '1') {
      setAdding(true);
    }
  }, [route.query]);

  const handleCloseAdd = () => {
    setAdding(false);
    if (route.query.get('add') === '1') {
      go(href('fridge'), true);
    }
  };

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

  async function handleEat(item: InventoryItem) {
    await finishItem(item, false);
    toast(`«${item.name}» съедено`, {
      label: 'Вернуть',
      run: () => void restoreRecords([item.id]),
    });
  }

  async function handleAddShopping(item: InventoryItem) {
    await addShoppingItems([
      {
        name: item.name,
        productKey: item.productKey,
        category: item.category,
        qty: item.qty,
        unit: item.unit,
      },
    ]);
    toast(`«${item.name}» добавлено в покупки`);
  }

  return (
    <main className="screen">
      <Header
        title="Холодильник"
        sub={items ? `${sorted.length} ${plural(sorted.length, 'продукт', 'продукта', 'продуктов')}` : ' '}
        right={
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <a className="icon-btn" href={href('settings')} aria-label="Настройки">
              <IconMore width={18} height={18} />
            </a>
            <button className="icon-btn primary" aria-label="Добавить продукт" onClick={() => setAdding(true)}>
              <IconPlus />
            </button>
          </div>
        }
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
        <div className="stack" style={{ gap: 10 }}>
          <div className="list">
            {visible.map((item) => (
              <SwipeRow
                key={item.id}
                onEat={() => void handleEat(item)}
                onAddShopping={() => void handleAddShopping(item)}
                onClick={() => setEditing(item)}
              >
                <div className="item-row">
                  <ProductIcon productKey={item.productKey} category={item.category} />
                  <span className="nm">
                    <b>{item.name}</b>
                    <small className="num">
                      {formatQty(item.qty, item.unit)}
                      {item.openedAt ? ' · открыт' : ''}
                      {filter === 'all' && item.location !== 'fridge' ? ` · ${LOCATION_LABELS[item.location].toLowerCase()}` : ''}
                    </small>
                  </span>
                  <Sticker expiresAt={item.expiresAt} isEstimate={item.isEstimate} today={today} />
                </div>
              </SwipeRow>
            ))}
          </div>

          <div className="swipe-tip">💡 Свайп вправо — съели · влево — в покупки</div>

          <button
            type="button"
            className="btn ghost block"
            onClick={() => setAdding(true)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }}
          >
            <IconPlus width={18} height={18} /> Добавить продукт
          </button>
        </div>
      )}

      <ItemSheet item={editing} onClose={() => setEditing(null)} />
      <AddSheet open={adding} onClose={handleCloseAdd} />
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
