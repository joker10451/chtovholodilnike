import { useMemo, useState } from 'react';
import {
  IconCart,
  IconLock,
  IconMore,
  IconSpark,
  IconSwap,
  IconUnlock,
} from '../components/icons';
import { Header, Plate, Sheet, toast, useToday } from '../components/ui';
import {
  saveFullMealPlan,
  savePlannedMeal,
  useAllRecipes,
  useMealPlan,
  useSettings,
} from '../data/repo';
import type { PlannedMeal } from '../data/types';
import { useMatchContext } from '../hooks';
import { addWeekPlanToShopping, generateWeekPlan } from '../lib/planGenerator';
import { go, href } from '../router';
import {
  addDays,
  formatWeekRange,
  getDayDisplay,
  getMonday,
  getWeekDays,
} from '../shared/dates';
import type { Recipe } from '../shared/recipeTypes';

const SLOT_TITLES: Record<string, string> = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
};

export function Plan() {
  const today = useToday();
  const settings = useSettings();
  const ctx = useMatchContext();
  const recipes = useAllRecipes();

  // Текущая выбранная неделя (понедельник)
  const [monday, setMonday] = useState(() => getMonday(today));
  // Текущий выбранный день недели
  const [activeDate, setActiveDate] = useState(today);
  // Модалка замены блюда
  const [swapSlot, setSwapSlot] = useState<PlannedMeal | null>(null);

  const weekDays = useMemo(() => getWeekDays(monday), [monday]);
  const planned = useMealPlan(monday);

  // Сгенерировать план, если на эту неделю ещё нет записей
  const mealsByDay = useMemo(() => {
    const map = new Map<string, PlannedMeal[]>();
    for (const d of weekDays) {
      map.set(d, []);
    }
    for (const m of planned ?? []) {
      const arr = map.get(m.date);
      if (arr) arr.push(m);
    }
    // сортируем слоты внутри дня: breakfast, lunch, dinner
    const order = { breakfast: 0, lunch: 1, dinner: 2 };
    for (const arr of map.values()) {
      arr.sort((a, b) => (order[a.slot] ?? 0) - (order[b.slot] ?? 0));
    }
    return map;
  }, [weekDays, planned]);

  const activeDayMeals = mealsByDay.get(activeDate) ?? [];

  const activeDayKcal = useMemo(() => {
    return activeDayMeals.reduce((acc, m) => {
      const rec = recipes.find((r) => r.id === m.recipeId);
      return acc + (rec?.kcal ?? 0);
    }, 0);
  }, [activeDayMeals, recipes]);

  async function handleAutoGenerate() {
    if (!ctx || recipes.length === 0) return;
    const newPlan = generateWeekPlan({
      mondayIso: monday,
      ctx,
      recipes,
      existingMeals: planned ?? [],
      servings: settings.servings,
    });
    await saveFullMealPlan(newPlan);
    toast('Рацион на неделю сформирован');
  }

  async function handleToggleLock(m: PlannedMeal) {
    await savePlannedMeal({ ...m, locked: !m.locked });
  }

  async function handleSwapSelect(recipe: Recipe) {
    if (!swapSlot) return;
    await savePlannedMeal({
      ...swapSlot,
      recipeId: recipe.id,
      title: recipe.title,
      isLeftover: false,
      leftoverFromDate: undefined,
      locked: true, // заменяемое вручную блюдо фиксируем
    });
    setSwapSlot(null);
    toast(`Выбрано «${recipe.title}»`);
  }

  async function handleCreateShoppingList() {
    if (!ctx || !planned || planned.length === 0) return;
    const count = await addWeekPlanToShopping({
      meals: planned,
      recipes,
      inventoryItems: ctx.items,
      staples: ctx.staples,
    });
    if (count > 0) {
      toast(`Добавлено ${count} поз. в список покупок`);
    } else {
      toast('Все продукты на неделю уже есть в холодильнике!');
    }
    go(href('shopping'));
  }

  return (
    <main className="screen">
      <Header
        title="Рацион"
        sub={`${formatWeekRange(monday)} · на ${settings.servings} персон`}
        right={
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              className="icon-btn"
              onClick={handleAutoGenerate}
              aria-label="Сгенерировать рацион"
            >
              <IconSpark width={18} height={18} />
            </button>
            <a className="icon-btn" href={href('settings')} aria-label="Настройки">
              <IconMore width={18} height={18} />
            </a>
          </div>
        }
      />

      <div className="stack" style={{ gap: 14 }}>
        {/* Переключатель недели */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              const prev = addDays(monday, -7);
              setMonday(prev);
              setActiveDate(prev);
            }}
            aria-label="Предыдущая неделя"
          >
            ‹
          </button>
          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{formatWeekRange(monday)}</span>
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              const next = addDays(monday, 7);
              setMonday(next);
              setActiveDate(next);
            }}
            aria-label="Следующая неделя"
          >
            ›
          </button>
        </div>

        {/* Полоса дней недели */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 6,
            background: 'var(--surface-2)',
            padding: 6,
            borderRadius: 16,
          }}
        >
          {weekDays.map((d) => {
            const { short, num } = getDayDisplay(d);
            const isSelected = d === activeDate;
            const isToday = d === today;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setActiveDate(d)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                  padding: '8px 4px',
                  borderRadius: 12,
                  border: 'none',
                  background: isSelected ? 'var(--brand)' : 'transparent',
                  color: isSelected ? '#fff' : 'var(--ink)',
                  cursor: 'pointer',
                  position: 'relative',
                  fontWeight: isSelected ? 600 : 400,
                }}
              >
                <span style={{ fontSize: '0.75rem', opacity: isSelected ? 0.9 : 0.6 }}>
                  {short}
                </span>
                <b style={{ fontSize: '1rem', fontVariantNumeric: 'tabular-nums' }}>
                  {num}
                </b>
                {isToday && (
                  <span
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: 99,
                      background: isSelected ? '#fff' : 'var(--brand)',
                      position: 'absolute',
                      bottom: 3,
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Если на неделю ещё не составлен план */}
        {(!planned || planned.length === 0) && (
          <div
            className="card flat"
            style={{
              padding: '16px',
              background: 'var(--surface)',
              borderRadius: 16,
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '1rem' }}>
              Рацион на эту неделю не составлен
            </div>
            <div className="small muted" style={{ maxWidth: 300, lineHeight: 1.4 }}>
              Умный алгоритм учтет продукты со сроками из вашего холодильника и расставит
              блюда по дням.
            </div>
            <button className="btn primary" onClick={handleAutoGenerate}>
              <IconSpark /> Составить рацион
            </button>
          </div>
        )}

        {/* Слоты выбранного дня */}
        {activeDayMeals.length > 0 && (
          <div className="stack" style={{ gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Меню на день</span>
              {activeDayKcal > 0 && (
                <span
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--brand)',
                    background: 'var(--surface-2)',
                    padding: '3px 8px',
                    borderRadius: 8,
                  }}
                >
                  🔥 ~{activeDayKcal} ккал
                </span>
              )}
            </div>
            {activeDayMeals.map((meal) => {
              const recipe = recipes.find((r) => r.id === meal.recipeId);
              return (
                <div
                  key={meal.id}
                  className="card flat"
                  style={{
                    padding: '12px 14px',
                    borderRadius: 16,
                    background: 'var(--surface)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    border: '1px solid var(--line)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      className="small muted"
                      style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}
                    >
                      {SLOT_TITLES[meal.slot] ?? meal.slot}
                      {recipe && ` · ${recipe.time} мин`}
                    </span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => handleToggleLock(meal)}
                        aria-label={meal.locked ? 'Разблокировать блюдо' : 'Зафиксировать блюдо'}
                        style={{ color: meal.locked ? 'var(--brand)' : 'var(--ink-3)', width: 32, height: 32 }}
                      >
                        {meal.locked ? <IconLock width={16} height={16} /> : <IconUnlock width={16} height={16} />}
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => setSwapSlot(meal)}
                        aria-label="Заменить блюдо"
                        style={{ width: 32, height: 32, color: 'var(--ink-2)' }}
                      >
                        <IconSwap width={16} height={16} />
                      </button>
                    </div>
                  </div>

                  <a
                    href={href('recipe', meal.recipeId)}
                    style={{
                      textDecoration: 'none',
                      color: 'var(--ink)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    {recipe && <Plate color={recipe.color} photo={recipe.image} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ fontSize: '1rem', display: 'block' }}>{meal.title}</b>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                        {meal.isLeftover && (
                          <span className="stk brand" style={{ fontSize: '0.75rem' }}>
                            остатки с вчера
                          </span>
                        )}
                        {recipe?.tags.slice(0, 2).map((t) => (
                          <span key={t} className="stk plain" style={{ fontSize: '0.75rem' }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </a>
                </div>
              );
            })}
          </div>
        )}

        {/* Кнопка сбора покупок */}
        {planned && planned.length > 0 && (
          <div className="stack" style={{ gap: 8, marginTop: 6 }}>
            <button className="btn primary block" onClick={handleCreateShoppingList}>
              <IconCart /> Собрать покупки на неделю →
            </button>
            <button className="btn quiet block small" onClick={handleAutoGenerate}>
              Пересобрать рацион
            </button>
          </div>
        )}
      </div>

      {/* Модалка выбора замены блюда */}
      <SwapRecipeSheet
        open={Boolean(swapSlot)}
        onClose={() => setSwapSlot(null)}
        recipes={recipes}
        slot={swapSlot}
        onSelect={handleSwapSelect}
      />
    </main>
  );
}

function SwapRecipeSheet({
  open,
  onClose,
  recipes,
  slot,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  recipes: Recipe[];
  slot: PlannedMeal | null;
  onSelect: (r: Recipe) => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recipes.filter((r) => (q ? r.title.toLowerCase().includes(q) : true));
  }, [recipes, search]);

  return (
    <Sheet open={open} onClose={onClose} title={`Заменить ${slot ? SLOT_TITLES[slot.slot].toLowerCase() : 'блюдо'}`}>
      <div className="stack" style={{ gap: 10 }}>
        <input
          className="input"
          type="search"
          placeholder="Поиск блюда"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="list" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {filtered.map((r) => (
            <button
              key={r.id}
              type="button"
              className="item-row"
              onClick={() => onSelect(r)}
              style={{ textAlign: 'left', cursor: 'pointer' }}
            >
              <Plate color={r.color} photo={r.image} />
              <div className="nm">
                <b>{r.title}</b>
                <small className="muted">
                  {r.time} мин · {r.servings} порц.
                </small>
              </div>
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}