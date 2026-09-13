import { useMemo, useState, type FormEvent } from 'react';
import { IconCheck, IconClose, IconPlus, IconShare } from '../components/icons';
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
import { parseProductsText } from '../lib/parseText';
import { href } from '../router';
import type { Category } from '../shared/products';
import { formatQty } from '../shared/units';
import { plural } from './Fridge';

const DEPARTMENTS: { title: string; categories: Category[] }[] = [
  { title: 'Овощи и фрукты', categories: ['vegetables', 'greens', 'fruits'] },
  { title: 'Молочное и яйца', categories: ['dairy', 'eggs'] },
  { title: 'Мясо и рыба', categories: ['meat', 'poultry', 'fish'] },
  { title: 'Хлеб и бакалея', categories: ['grains', 'bakery', 'canned', 'spices', 'nuts'] },
  { title: 'Заморозка', categories: ['frozen'] },
  { title: 'Другое', categories: ['drinks', 'sauces', 'sweets', 'ready', 'other'] },
];

export function Shopping() {
  const items = useShoppingList();
  const today = useToday();
  const [input, setInput] = useState('');

  const toBuy = items?.filter((i) => !i.checked) ?? [];
  const inCart = items?.filter((i) => i.checked) ?? [];

  const groups = useMemo(() => {
    if (!items) return [];
    return DEPARTMENTS
      .map((d) => ({
        title: d.title,
        items: items
          .filter((i) => d.categories.includes(i.category))
          .sort((a, b) => Number(a.checked) - Number(b.checked) || b.createdAt - a.createdAt),
      }))
      .filter((g) => g.items.length > 0);
  }, [items]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    const parsed = parseProductsText(text);
    await addShoppingItems(parsed.length > 0 ? parsed.map((p) => ({ name: p.name, productKey: p.productKey, qty: p.qty, unit: p.unit })) : [{ name: text }]);
    setInput('');
  }

  async function handleTransfer() {
    const moved = await transferCheckedToFridge(today);
    toast(`В холодильник: ${moved} ${plural(moved, 'продукт', 'продукта', 'продуктов')}. Сроки посчитаны по типу продукта`);
  }

  async function handleShare() {
    if (toBuy.length === 0) return;
    const text = ['Купить:', ...toBuy.map((i) => `— ${i.name}${i.qty ? `, ${formatQty(i.qty, i.unit)}` : ''}`)].join('\n');
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast('Список скопирован — вставьте его в сообщение');
    } catch {
      toast('Не получилось скопировать список');
    }
  }

  return (
    <main className="screen">
      <Header
        title="Покупки"
        sub={items ? (items.length === 0 ? 'Список пуст' : `Купить ${toBuy.length}${inCart.length ? ` · в корзине ${inCart.length}` : ''}`) : ' '}
        right={toBuy.length > 0 && (
          <button className="icon-btn" onClick={handleShare} aria-label="Отправить список">
            <IconShare />
          </button>
        )}
      />

      <div className="stack-lg">
        <form className="add-row" onSubmit={handleAdd}>
          <input
            className="input"
            placeholder="Что купить: 2 л молока, хлеб"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            enterKeyHint="done"
          />
          <button className="btn" type="submit" disabled={!input.trim()} aria-label="Добавить в список">
            <IconPlus />
          </button>
        </form>

        {inCart.length > 0 && (
          <div className="cart-banner">
            <div className="grow">
              <b>В корзине {inCart.length} {plural(inCart.length, 'товар', 'товара', 'товаров')}</b>
              <span>Дома перенесите в холодильник — срок посчитается сам</span>
            </div>
            <div className="cart-banner-actions">
              <button className="btn small" onClick={handleTransfer}>В холодильник</button>
              <button className="btn small quiet" onClick={async () => { await clearCheckedShoppingItems(); toast('Корзина очищена'); }}>Убрать</button>
            </div>
          </div>
        )}

        {items && items.length === 0 && (
          <Empty
            title="Список покупок пуст"
            action={
              <div className="stack" style={{ width: '100%', maxWidth: 320 }}>
                <a className="btn block" href={href('plan')}>Собрать из рациона</a>
                <a className="btn ghost block" href={href('recipes')}>Подобрать рецепт</a>
              </div>
            }
          >
            Добавьте продукты строкой выше, соберите покупки из рациона на неделю или отправьте недостающее со страницы рецепта.
          </Empty>
        )}

        {groups.map((group) => (
          <section key={group.title} className="stack" style={{ gap: 6 }}>
            <div className="section-label">{group.title} · {group.items.length}</div>
            <div className="list">
              {group.items.map((item) => <ShoppingRow key={item.id} item={item} />)}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

function ShoppingRow({ item }: { item: ShoppingItem }) {
  return (
    <div className={`shop-row${item.checked ? ' done' : ''}`}>
      <button
        type="button"
        className={`round-check${item.checked ? ' on' : ''}`}
        onClick={() => toggleShoppingItem(item.id, !item.checked)}
        aria-label={item.checked ? `Вернуть ${item.name} в список` : `Отметить ${item.name} купленным`}
        aria-pressed={item.checked}
      >
        {item.checked && <IconCheck />}
      </button>
      <span className="dot"><i style={{ background: CATEGORY_DOT[item.category] }} /></span>
      <span className="nm">
        <b>{item.name}</b>
        {item.recipeTitle && <small>для: {item.recipeTitle}</small>}
      </span>
      <span className="qty num">{formatQty(item.qty, item.unit)}</span>
      <button type="button" className="row-remove" onClick={() => deleteShoppingItem(item.id)} aria-label={`Удалить ${item.name}`}>
        <IconClose />
      </button>
    </div>
  );
}
