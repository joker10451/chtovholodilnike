import { useMemo, useState } from 'react';
import { IconBack, IconCart, IconLock, IconMore, IconSpark, IconSwap, IconUnlock } from '../components/icons';
import { Empty, Header, Plate, Sheet, toast, useToday } from '../components/ui';
import { deleteRecords, saveFullMealPlan, saveSettings, savePlannedMeal, useAllRecipes, useMealPlan, useSettings } from '../data/repo';
import type { MealSlot, PlannedMeal } from '../data/types';
import { useMatchContext } from '../hooks';
import { addWeekPlanToShopping, DEFAULT_PLAN_OPTIONS, generateWeekPlan, leftoverLabel, type PlanOptions } from '../lib/planGenerator';
import { isFavorite, tasteOf } from '../lib/taste';
import { go, href } from '../router';
import { addDays, formatWeekRange, getDayDisplay, getMonday, getWeekDays, shortDate } from '../shared/dates';
import type { Recipe } from '../shared/recipeTypes';
import { plural } from './Fridge';

const SLOT_TITLES: Record<MealSlot, string> = { breakfast: 'Завтрак', lunch: 'Обед', dinner: 'Ужин' };
const SLOT_ORDER: Record<MealSlot, number> = { breakfast: 0, lunch: 1, dinner: 2 };

export function Plan() {
  const today = useToday();
  const settings = useSettings();
  const ctx = useMatchContext();
  const recipes = useAllRecipes();

  // В воскресенье планируем уже следующую неделю
  const [monday, setMonday] = useState(() => (getWeekDays(getMonday(today))[6] === today ? addDays(getMonday(today), 7) : getMonday(today)));
  const [activeDate, setActiveDate] = useState(() => (getWeekDays(getMonday(today))[6] === today ? addDays(getMonday(today), 7) : today));
  const [swapSlot, setSwapSlot] = useState<PlannedMeal | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const options: PlanOptions = settings.plan ?? DEFAULT_PLAN_OPTIONS;

  const weekDays = useMemo(() => getWeekDays(monday), [monday]);
  const planned = useMealPlan(monday);
  const byId = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);

  const dayMeals = useMemo(
    () => (planned ?? []).filter((m) => m.date === activeDate).sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]),
    [planned, activeDate],
  );
  const dayKcal = dayMeals.reduce((sum, m) => sum + (byId.get(m.recipeId)?.kcal ?? 0), 0);
  const hasPlan = (planned?.length ?? 0) > 0;

  function shiftWeek(delta: number) {
    const next = addDays(monday, delta * 7);
    setMonday(next);
    setActiveDate(getWeekDays(next).includes(today) ? today : next);
  }

  async function generate() {
    if (!ctx) return;
    const next = generateWeekPlan({ mondayIso: monday, ctx, recipes, existingMeals: planned ?? [], servings: settings.servings, options });
    // Приёмы пищи, которые больше не планируются, убираем
    const keep = new Set(next.map((m) => m.id));
    const stale = (planned ?? []).filter((m) => !keep.has(m.id) && !m.locked).map((m) => m.id);
    if (stale.length) await deleteRecords(stale);
    await saveFullMealPlan(next);
    toast(hasPlan ? 'Рацион пересобран, закреплённые блюда остались' : 'Рацион на неделю готов');
  }

  async function swap(recipe: Recipe) {
    if (!swapSlot) return;
    await savePlannedMeal({ ...swapSlot, recipeId: recipe.id, title: recipe.title, isLeftover: false, leftoverFromDate: undefined, locked: true });
    setSwapSlot(null);
    toast(`${SLOT_TITLES[swapSlot.slot]}: ${recipe.title}`);
  }

  async function toShopping() {
    if (!ctx || !planned?.length) return;
    const count = await addWeekPlanToShopping({ meals: planned, recipes, inventoryItems: ctx.items, staples: ctx.staples });
    toast(count > 0 ? `В покупки добавлено: ${count} ${plural(count, 'позиция', 'позиции', 'позиций')}` : 'Всё для рациона уже есть дома');
    if (count > 0) go(href('shopping'));
  }

  return (
    <main className="screen">
      <Header
        title="Рацион"
        sub={`На ${settings.servings} ${plural(settings.servings, 'человека', 'человек', 'человек')} · ${options.meals.map((m) => SLOT_TITLES[m].toLowerCase()).join(', ')}`}
        right={
          <div className="row-gap" style={{ gap: 6 }}>
            {hasPlan && <button className="icon-btn" onClick={generate} aria-label="Пересобрать рацион"><IconSpark /></button>}
            <button className="icon-btn" onClick={() => setOptionsOpen(true)} aria-label="Настройки рациона"><IconMore /></button>
          </div>
        }
      />

      <div className="stack-lg">
        <div className="week-nav">
          <button type="button" className="icon-btn" onClick={() => shiftWeek(-1)} aria-label="Предыдущая неделя"><IconBack /></button>
          <b>{formatWeekRange(monday)}</b>
          <button type="button" className="icon-btn flip" onClick={() => shiftWeek(1)} aria-label="Следующая неделя"><IconBack /></button>
        </div>

        <div className="week-days">
          {weekDays.map((d) => {
            const { short, num } = getDayDisplay(d);
            const count = (planned ?? []).filter((m) => m.date === d).length;
            return (
              <button
                key={d}
                type="button"
                className={`week-day${d === activeDate ? ' on' : ''}${d === today ? ' today' : ''}`}
                onClick={() => setActiveDate(d)}
                aria-pressed={d === activeDate}
                aria-label={`${short} ${num}${count ? `, блюд: ${count}` : ''}`}
              >
                <span>{short}</span>
                <b className="num">{num}</b>
              </button>
            );
          })}
        </div>

        {planned && !hasPlan && (
          <Empty
            title="Рацион на эту неделю не составлен"
            action={<button className="btn" onClick={generate}><IconSpark /> Составить рацион</button>}
          >
            Приложение расставит завтраки, обеды и ужины: сначала блюда из продуктов, которые скоро испортятся, и из того, что уже есть дома.
          </Empty>
        )}

        {hasPlan && dayMeals.length === 0 && (
          activeDate < today
            ? <Empty title="Этот день уже прошёл" />
            : <Empty title="На этот день блюд нет" action={<button className="btn ghost" onClick={generate}>Заполнить пустые дни</button>} />
        )}

        {dayMeals.length > 0 && (
          <section className="stack">
            <div className="row-gap" style={{ justifyContent: 'space-between' }}>
              <div className="section-label">{activeDate === today ? 'Сегодня' : shortDate(activeDate)}</div>
              {dayKcal > 0 && <span className="stk plain num">≈ {dayKcal} ккал на человека</span>}
            </div>
            {dayMeals.map((meal) => {
              const recipe = byId.get(meal.recipeId);
              return (
                <article key={meal.id} className={`meal-slot${meal.locked ? ' locked' : ''}`}>
                  <header>
                    <span className="meal-slot-title">
                      {SLOT_TITLES[meal.slot]}
                      {recipe && !meal.isLeftover && <span className="muted"> · {recipe.time} мин</span>}
                    </span>
                    <div className="row-gap" style={{ gap: 4 }}>
                      <button
                        type="button"
                        className={`slot-btn${meal.locked ? ' on' : ''}`}
                        onClick={() => savePlannedMeal({ ...meal, locked: !meal.locked })}
                        aria-label={meal.locked ? 'Открепить блюдо' : 'Закрепить блюдо при пересборке'}
                        aria-pressed={!!meal.locked}
                      >
                        {meal.locked ? <IconLock /> : <IconUnlock />}
                      </button>
                      <button type="button" className="slot-btn" onClick={() => setSwapSlot(meal)} aria-label="Заменить блюдо">
                        <IconSwap />
                      </button>
                    </div>
                  </header>
                  <a className="meal-slot-body" href={href('recipe', meal.recipeId)}>
                    {recipe && <Plate color={recipe.color} photo={recipe.image} />}
                    <span className="grow stack" style={{ gap: 5 }}>
                      <b>{meal.title}</b>
                      <span className="wrap-gap">
                        {meal.isLeftover && <span className="stk brand">{leftoverLabel(meal)}</span>}
                        {meal.note && <span className="stk soon">{meal.note}</span>}
                        {!meal.isLeftover && meal.servings > settings.servings && <span className="stk plain">{meal.servings} порц. — на завтра</span>}
                        {recipe && isFavorite(tasteOf(ctx?.tastes, recipe.id)) && <span className="stk fresh">любимое</span>}
                        {meal.locked && <span className="stk plain">закреплено</span>}
                      </span>
                    </span>
                  </a>
                </article>
              );
            })}
          </section>
        )}

        {hasPlan && (
          <div className="stack">
            <button className="btn block" onClick={toShopping}><IconCart /> Собрать покупки на неделю</button>
            <p className="small muted" style={{ textAlign: 'center' }}>Закреплённые блюда не меняются, когда рацион пересобирается.</p>
          </div>
        )}
      </div>

      <PlanOptionsSheet
        open={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        options={options}
        onChange={(plan) => saveSettings({ plan })}
      />

      <SwapRecipeSheet
        open={Boolean(swapSlot)}
        onClose={() => setSwapSlot(null)}
        recipes={recipes}
        slot={swapSlot}
        onSelect={swap}
      />
    </main>
  );
}

function SwapRecipeSheet({ open, onClose, recipes, slot, onSelect }: {
  open: boolean; onClose: () => void; recipes: Recipe[]; slot: PlannedMeal | null; onSelect: (r: Recipe) => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const suitable = recipes.filter((r) => {
      if (r.tags.includes('напиток')) return false;
      if (!slot) return true;
      return slot.slot === 'breakfast' ? r.tags.includes('завтрак') : r.tags.includes('обед') || r.tags.includes('ужин');
    });
    return (q ? recipes.filter((r) => r.title.toLowerCase().includes(q)) : suitable);
  }, [recipes, search, slot]);

  return (
    <Sheet open={open} onClose={onClose} title={slot ? `Заменить: ${SLOT_TITLES[slot.slot].toLowerCase()}` : 'Заменить блюдо'}>
      <div className="stack">
        <input className="input" type="search" placeholder="Найти блюдо" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="list">
          {filtered.map((r) => (
            <button key={r.id} type="button" className="item-row" onClick={() => onSelect(r)}>
              <Plate color={r.color} photo={r.image} />
              <span className="nm">
                <b>{r.title}</b>
                <small>{r.time} мин · {r.servings} порц.</small>
              </span>
            </button>
          ))}
          {filtered.length === 0 && <p className="small muted" style={{ padding: 14 }}>Ничего не нашлось</p>}
        </div>
      </div>
    </Sheet>
  );
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function PlanOptionsSheet({ open, onClose, options, onChange }: {
  open: boolean; onClose: () => void; options: PlanOptions; onChange: (o: PlanOptions) => void;
}) {
  const toggleMeal = (slot: MealSlot) => {
    const meals = options.meals.includes(slot) ? options.meals.filter((m) => m !== slot) : [...options.meals, slot];
    if (meals.length) onChange({ ...options, meals });
  };
  const toggleDay = (d: number) => {
    const cookDays = options.cookDays.includes(d) ? options.cookDays.filter((x) => x !== d) : [...options.cookDays, d].sort();
    onChange({ ...options, cookDays });
  };
  return (
    <Sheet open={open} onClose={onClose} title="Настройки рациона" footer={<button className="btn block" onClick={onClose}>Готово</button>}>
      <div className="stack-lg">
        <div className="stack">
          <b>Что планировать</b>
          <div className="wrap-gap">
            {(['breakfast', 'lunch', 'dinner'] as MealSlot[]).map((s) => (
              <button key={s} type="button" className={`chip${options.meals.includes(s) ? ' on' : ''}`} aria-pressed={options.meals.includes(s)} onClick={() => toggleMeal(s)}>
                {SLOT_TITLES[s]}
              </button>
            ))}
          </div>
        </div>
        <div className="stack">
          <b>Дни, когда готовите впрок</b>
          <span className="small muted">В эти дни ужин готовится на две трапезы — на следующий день обед уже есть. В остальные дни — быстрые блюда.</span>
          <div className="week-picker">
            {WEEKDAYS.map((d, i) => (
              <button key={d} type="button" className={`chip${options.cookDays.includes(i) ? ' on' : ''}`} aria-pressed={options.cookDays.includes(i)} onClick={() => toggleDay(i)}>{d}</button>
            ))}
          </div>
        </div>
        <p className="small muted">После изменения нажмите «Пересобрать рацион» — закреплённые блюда останутся.</p>
      </div>
    </Sheet>
  );
}
