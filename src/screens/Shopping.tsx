import { useMemo, useState, type FormEvent } from 'react';
import { IconCheck, IconPlus, IconShare, IconTrash } from '../components/icons';
import { CATEGORY_DOT, Empty, Header, toast, useToday } from '../components/ui';
import {
  addShoppingItems,
  clearCheckedShoppingItems,
  deleteShoppingItem,
  toggleShoppingItem,
  transferCheckedToFridge,
  useShoppingList,
} from '../data/repo';
import type { ShoppingItem } from '../data/types';
import { href } from '../router';
import { parseProductsText } from '../lib/parseText';
import type { Category } from '../shared/products';
import { formatQty } from '../shared/units';
import { plural } from './Fridge';

const DEPARTMENT_ORDER: { title: string; categories: Category[] }[] = [
  { title: 'Овощи и фрукты', categories: ['vegetables', 'greens', 'fruits'] },
  { title: 'Молочное и яйца', categories: ['dairy', 'eggs'] },
  { title: 'Мясо и рыба', categories: ['meat', 'poultry', 'fish'] },
  { title: 'Бакалея и хлеб', categories: ['grains', 'bakery', 'canned'] },
  { title: 'Другое', categories: ['drinks', 'sauces', 'sweets', 'spices', 'nuts', 'frozen', 'ready', 'other'] },
];

export function Shopping() {
  const items = useShoppingList();
  const today = useToday();
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const total = items?.length ?? 0;
  const checked = items?.filter((i) => i.checked) ?? [];
  const checkedCount = checked.length;

  const grouped = useMemo(() => {
    if (!items) return [];
    const res: { title: string; items: ShoppingItem[] }[] = [];
    const assigned = new Set<string>();

    for (const dept of DEPARTMENT_ORDER) {
      const deptItems = items.filter((i) => dept.categories.includes(i.category));
      if (deptItems.length > 0) {
        res.push({ title: dept.title, items: deptItems });
        deptItems.forEach((i) => assigned.add(i.id));
      }
    }

    const rest = items.filter((i) => !assigned.has(i.id));
    if (rest.length > 0) {
      res.push({ title: 'Разное', items: rest });
    }
    return res;
  }, [items]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    setSubmitting(true);
    try {
      // Пробуем распознать фразу офлайн
      const parsed = parseProductsText(text);
      if (parsed.length > 0) {
        await addShoppingItems(
          parsed.map((p) => ({
            name: p.name,
            productKey: p.productKey,
            qty: p.qty,
            unit: p.unit,
          })),
        );
      } else {
        await addShoppingItems([{ name: text }]);
      }
      setInput('');
      toast('Добавлено в список');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTransfer() {
    if (checkedCount === 0) return;
    const moved = await transferCheckedToFridge(today);
    toast(`${moved} ${plural(moved, 'продукт перенесён', 'продукта перенесено', 'продуктов перенесено')} в холодильник`);
  }

  async function handleShare() {
    if (!items || items.length === 0) return;
    const lines = items.map((i) => `${i.checked ? '✓' : '—'} ${i.name}${i.qty ? ` (${formatQty(i.qty, i.unit)})` : ''}${i.recipeTitle ? ` [для: ${i.recipeTitle}]` : ''}`);
    const text = `Список покупок (${items.length}):\n${lines.join('\n')}`;

    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        toast('Список скопирован в буфер');
      }
    } catch {
      /* отмена */
    }
  }

  async function handleClearDone() {
    if (checkedCount === 0) return;
    await clearCheckedShoppingItems();
    toast('Купленные позиции удалены');
  }

  return (
    <main className="screen">
      <Header
        title="Покупки"
        sub={
          items
            ? `${total} ${plural(total, 'позиция', 'позиции', 'позиций')}${checkedCount > 0 ? ` · ${checkedCount} куплено` : ''}`
            : ' '
        }
        right={
          <div style={{ display: 'flex', gap: 6 }}>
            {total > 0 && (
              <button className="icon-btn" onClick={handleShare} aria-label="Поделиться списком">
                <IconShare width={18} height={18} />
              </button>
            )}
            {checkedCount > 0 && (
              <button className="icon-btn" onClick={handleClearDone} aria-label="Очистить купленное">
                <IconTrash width={18} height={18} />
              </button>
            )}
          </div>
        }
      />

      <div className="stack">
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            type="text"
            placeholder="Что купить (например, «2 л молока»)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={submitting}
            style={{ flex: 1 }}
          />
          <button className="btn primary" type="submit" disabled={!input.trim() || submitting} style={{ minWidth: 44, padding: '0 14px' }}>
            <IconPlus />
          </button>
        </form>

        {checkedCount > 0 && (
          <div
            className="card flat"
            style={{
              padding: '12px 16px',
              background: 'var(--brand-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              borderRadius: 16,
            }}
          >
            <div>
              <b style={{ color: 'var(--brand)' }}>{checkedCount} {plural(checkedCount, 'товар куплен', 'товара куплено', 'товаров куплено')}</b>
              <div className="small" style={{ color: 'var(--ink-2)', marginTop: 2 }}>
                Перенести в холодильник со сроками
              </div>
            </div>
            <button className="btn primary sm" onClick={handleTransfer} type="button">
              В холодильник →
            </button>
          </div>
        )}

        {total === 0 && (
          <Empty
            title="Список покупок пуст"
            action={
              <div className="stack" style={{ width: '100%', maxWidth: 320 }}>
                <a className="btn block" href={href('recipes')}>Подобрать рецепты</a>
              </div>
            }
          >
            Добавляйте продукты перед походом в магазин или отправляйте недостающие ингредиенты прямо со страницы любого рецепта.
          </Empty>
        )}

        {grouped.map((group) => (
          <div key={group.title} className="stack" style={{ gap: 6 }}>
            <div className="section-label" style={{ marginTop: 8 }}>
              {group.title} <span className="small muted">({group.items.length})</span>
            </div>
            <div className="list">
              {group.items.map((item) => (
                <div
                  key={item.id}
                  className={`item-row${item.checked ? ' checked' : ''}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px',
                    opacity: item.checked ? 0.6 : 1,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleShoppingItem(item.id, !item.checked)}
                    aria-label={item.checked ? 'Отменить отметку' : 'Отметить купленным'}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      border: item.checked ? 'none' : '2px solid var(--line)',
                      background: item.checked ? 'var(--fresh)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      cursor: 'pointer',
                      flexShrink: 0,
                      padding: 0,
                    }}
                  >
                    {item.checked && <IconCheck width={16} height={16} />}
                  </button>

                  <span className="dot" style={{ margin: 0 }}>
                    <i style={{ background: CATEGORY_DOT[item.category] }} />
                  </span>

                  <span className="nm" style={{ flex: 1, textDecoration: item.checked ? 'line-through' : 'none' }}>
                    <b>{item.name}</b>
                    {item.recipeTitle && (
                      <small className="muted" style={{ display: 'block', fontSize: '0.8rem' }}>
                        для: {item.recipeTitle}
                      </small>
                    )}
                  </span>

                  <span className="q num" style={{ flexShrink: 0, color: 'var(--ink-2)', fontSize: '0.9rem' }}>
                    {formatQty(item.qty, item.unit)}
                  </span>

                  <button
                    type="button"
                    onClick={() => deleteShoppingItem(item.id)}
                    aria-label="Удалить"
                    className="icon-btn"
                    style={{ width: 28, height: 28, color: 'var(--ink-3)', padding: 0 }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}