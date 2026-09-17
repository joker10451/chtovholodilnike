import { useLiveQuery } from 'dexie-react-hooks';
import { RatingPicker } from '../components/RatingPicker';
import type { Rating } from '../lib/taste';
import { useEffect, useMemo, useRef, useState } from 'react';
import { IconClose } from '../components/icons';
import { Header, Sheet, Stepper, toast } from '../components/ui';
import { newId } from '../data/db';
import { deleteRecords, getRecipe, logCooking, saveItems } from '../data/repo';
import { useMatchContext } from '../hooks';
import { planDeduction } from '../lib/cooking';
import { makeItem } from '../lib/convert';
import { go, href } from '../router';
import { todayISO } from '../shared/dates';
import { daysLeft, RESCUE_DAYS } from '../shared/freshness';
import { getProduct } from '../shared/products';
import { formatQty } from '../shared/units';
import { plural } from './Fridge';

export function Cook({ id, portions }: { id: string; portions: number }) {
  const recipe = useLiveQuery(() => getRecipe(id).then((r) => r ?? null), [id]);
  const [step, setStep] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [showIngredients, setShowIngredients] = useState(false);
  const wakeLockActive = useWakeLock(!finishing);

  if (recipe === undefined) return <div className="cook" />;
  if (recipe === null) return <main className="screen"><Header title="Рецепт не найден" backTo="#/recipes" /></main>;

  const total = recipe.steps.length;
  const current = recipe.steps[step];
  const next = () => (step < total - 1 ? setStep(step + 1) : setFinishing(true));

  return (
    <div className="cook">
      <div className="cook-bar">
        {recipe.steps.map((_, i) => <i key={i} className={i <= step ? 'on' : ''} />)}
      </div>

      <div className="cook-top">
        <div className="cook-top-title">
          <b>{recipe.title}</b>
          <span>Шаг {step + 1} из {total} · {portions} {plural(portions, 'порция', 'порции', 'порций')}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {wakeLockActive && <span className="cook-wakelock">☀️ Не гаснет</span>}
          <button type="button" className="btn small quiet" onClick={() => setShowIngredients(true)}>
            Ингредиенты
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => go(href('recipe', recipe.id), true)}
            aria-label="Закрыть режим готовки"
          >
            <IconClose width={18} height={18} />
          </button>
        </div>
      </div>

      <button className="cook-tap" onClick={next} aria-label="Следующий шаг">
        <p className="cook-text">{current.text}</p>
      </button>

      {current.timer && <Timer key={step} seconds={current.timer} />}
      <p className="cook-hint">Коснитесь карточки — следующий шаг</p>

      <div className="cook-nav">
        <button className="btn ghost prev" disabled={step === 0} onClick={() => setStep(Math.max(0, step - 1))}>
          Назад
        </button>
        <button className="btn next" onClick={next}>
          {step < total - 1 ? 'Дальше' : 'Готово'}
        </button>
      </div>

      <Sheet
        open={showIngredients}
        onClose={() => setShowIngredients(false)}
        title={`Ингредиенты на ${portions} ${plural(portions, 'порцию', 'порции', 'порций')}`}
      >
        <div className="list">
          {recipe.ingredients.map((ing, idx) => {
            const factor = portions / recipe.servings;
            const name = ing.name ?? getProduct(ing.key)?.name ?? 'Ингредиент';
            return (
              <div key={idx} className="ing" style={{ padding: '10px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="nm"><b>{name}</b></span>
                <span className="mono bold">{formatQty(ing.qty * factor, ing.unit)}</span>
              </div>
            );
          })}
        </div>
        <button className="btn block" style={{ marginTop: 12 }} onClick={() => setShowIngredients(false)}>
          Понятно, к готовке
        </button>
      </Sheet>

      <FinishSheet open={finishing} onClose={() => setFinishing(false)} recipeId={recipe.id} portions={portions} />
    </div>
  );
}

function Timer({ seconds }: { seconds: number }) {
  const [totalSec, setTotalSec] = useState(seconds);
  const [left, setLeft] = useState(seconds);
  const [running, setRunning] = useState(false);
  const endAt = useRef(0);

  useEffect(() => {
    setTotalSec(seconds);
    setLeft(seconds);
    setRunning(false);
  }, [seconds]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const l = Math.max(0, Math.round((endAt.current - Date.now()) / 1000));
      setLeft(l);
      if (l === 0) {
        setRunning(false);
        navigator.vibrate?.([300, 150, 300, 150, 300]);
        beep();
      }
    }, 250);
    return () => clearInterval(id);
  }, [running]);

  const toggle = () => {
    if (running) setRunning(false);
    else {
      endAt.current = Date.now() + (left === 0 ? totalSec : left) * 1000;
      if (left === 0) setLeft(totalSec);
      setRunning(true);
    }
  };

  const addMinute = () => {
    setTotalSec((t) => t + 60);
    setLeft((l) => {
      const next = l + 60;
      if (running) {
        endAt.current += 60 * 1000;
      }
      return next;
    });
  };

  const reset = () => {
    setRunning(false);
    setTotalSec(seconds);
    setLeft(seconds);
  };

  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  const percent = totalSec > 0 ? Math.round(((totalSec - left) / totalSec) * 100) : 0;

  return (
    <div className="cook-timer-box">
      <button
        type="button"
        className="cook-timer-btn"
        style={{ ['--p' as string]: `${percent}%` }}
        onClick={toggle}
        aria-label={running ? 'Пауза таймера' : 'Запустить таймер'}
      >
        <span className="cook-timer-digits">{left === 0 ? 'Готово!' : `${mm}:${ss}`}</span>
        <span className="cook-timer-state">{running ? 'Пауза' : left === 0 ? 'Заново' : 'Старт'}</span>
      </button>
      <div className="cook-timer-actions">
        <button type="button" className="btn small quiet" onClick={addMinute}>
          +1 мин
        </button>
        <button type="button" className="btn small quiet" onClick={reset} disabled={left === totalSec && !running}>
          Сброс
        </button>
      </div>
    </div>
  );
}

function beep() {
  try {
    const ctx = new AudioContext();
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      o.connect(g).connect(ctx.destination);
      g.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.35);
      g.gain.setValueAtTime(0, ctx.currentTime + i * 0.35 + 0.2);
      o.start(ctx.currentTime + i * 0.35);
      o.stop(ctx.currentTime + i * 0.35 + 0.22);
    }
  } catch { /* звук недоступен */ }
}

/** Не даёт экрану погаснуть, пока открыт режим готовки */
function useWakeLock(active: boolean): boolean {
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) {
      setLocked(false);
      return;
    }
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
        if (cancelled) void lock.release();
        else setLocked(true);
      } catch {
        setLocked(false);
      }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') void request(); };
    void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
      setLocked(false);
    };
  }, [active]);
  return locked;
}

function FinishSheet({ open, onClose, recipeId, portions }: { open: boolean; onClose: () => void; recipeId: string; portions: number }) {
  const ctx = useMatchContext();
  const recipe = useLiveQuery(() => getRecipe(recipeId), [recipeId]);
  const lines = useMemo(() => (ctx && recipe && open ? planDeduction(ctx, recipe, portions) : []), [ctx, recipe, portions, open]);
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [leftovers, setLeftovers] = useState(0);
  const [rating, setRating] = useState<Rating | null>(null);
  const [saving, setSaving] = useState(false);
  // Кнопка «Списать» оказывается там же, где «Готово» — защищаемся от случайного двойного касания
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    setArmed(false);
    if (!open) return;
    const id = setTimeout(() => setArmed(true), 600);
    return () => clearTimeout(id);
  }, [open]);

  if (!recipe) return null;

  async function apply() {
    if (!ctx || !recipe) return;
    setSaving(true);
    const chosen = lines.filter((l) => !skip.has(l.key));
    const byItem = new Map<string, number>();
    for (const l of chosen) byItem.set(l.itemId, (byItem.get(l.itemId) ?? ctx.items.find((i) => i.id === l.itemId)!.qty) - l.take);

    const toDelete: string[] = [];
    const toSave = [];
    for (const [itemId, qty] of byItem) {
      const item = ctx.items.find((i) => i.id === itemId)!;
      if (qty <= 0) toDelete.push(itemId);
      else toSave.push({ ...item, qty: Math.round(qty * 100) / 100, openedAt: item.openedAt ?? todayISO() });
    }
    if (leftovers > 0) {
      toSave.push({
        ...makeItem({ name: `${recipe.title} (остатки)`, category: 'ready', qty: leftovers, unit: 'portion', location: 'fridge', purchasedAt: todayISO(), source: 'leftover' }),
        id: newId(),
      });
    }
    await saveItems(toSave);
    if (toDelete.length) await deleteRecords(toDelete);
    // Что из подходящего к концу срока ушло в блюдо — для итогов месяца
    const rescued = [...new Set(chosen
      .map((l) => ctx.items.find((i) => i.id === l.itemId)!)
      .filter((i) => { const d = daysLeft(i.expiresAt, todayISO()); return d !== null && d >= 0 && d <= RESCUE_DAYS; })
      .map((i) => i.name))];
    await logCooking({ recipeId: recipe.id, title: recipe.title, portions, cookedAt: Date.now(), ...(rating ? { rating } : {}), ...(rescued.length ? { rescued } : {}) });
    toast('Приятного аппетита! Холодильник обновлён');
    go(href('fridge'), true);
  }

  return (
    <Sheet open={open} onClose={onClose} title="Готово! Списать продукты?">
      <div className="stack-lg">
        {lines.length === 0 ? (
          <p className="muted">Из холодильника ничего не списывается — всё из базовых запасов или не было добавлено в приложение.</p>
        ) : (
          <div className="list">
            {lines.map((l) => (
              <label key={l.key} className="item-row">
                <input type="checkbox" style={{ width: 20, height: 20, accentColor: 'var(--brand)' }} checked={!skip.has(l.key)}
                  onChange={(e) => {
                    const next = new Set(skip);
                    if (e.target.checked) next.delete(l.key); else next.add(l.key);
                    setSkip(next);
                  }} />
                <span className="nm">
                  <b>{l.itemName}</b>
                  <small className="num">{l.after <= 0 ? 'закончится' : `останется ${formatQty(l.after, l.unit)}`}</small>
                </span>
                <span className="mono small">−{formatQty(l.take, l.unit)}</span>
              </label>
            ))}
          </div>
        )}

        <div className="card flat row-gap">
          <div className="grow">
            <b>Остались порции?</b>
            <div className="small muted">Положим в холодильник на 3 дня</div>
          </div>
          <div style={{ width: 140 }}><Stepper label="Порций осталось" value={leftovers} onChange={(v) => setLeftovers(Math.max(0, Math.round(v)))} /></div>
        </div>

        <div className="card flat stack">
          <b>Как вам блюдо?</b>
          <RatingPicker value={rating} onChange={setRating} />
          <span className="small muted">Любимые блюда чаще попадут в подборку и рацион, нелюбимые — пропадут</span>
        </div>

        <button className="btn block" disabled={saving || !armed} onClick={apply}>Списать и закончить</button>
      </div>
    </Sheet>
  );
}
