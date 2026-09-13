import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { back } from '../router';
import { freshness, stickerText } from '../shared/freshness';
import { IconBack, IconClose } from './icons';

export function Header({ title, sub, backTo, right }: { title: string; sub?: ReactNode; backTo?: string | true; right?: ReactNode }) {
  return (
    <>
      {backTo && (
        <button className="back" onClick={() => back(typeof backTo === 'string' ? backTo : undefined)}>
          <IconBack width={18} height={18} /> Назад
        </button>
      )}
      <header className="head">
        <div className="titles">
          <h1>{title}</h1>
          {sub && <div className="sub">{sub}</div>}
        </div>
        {right}
      </header>
    </>
  );
}

export function Sticker({ expiresAt, isEstimate, today }: { expiresAt: string | null; isEstimate: boolean; today: string }) {
  return <span className={`stk ${freshness(expiresAt, today)}`}>{stickerText(expiresAt, isEstimate, today)}</span>;
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div
        className="scrim"
        onClick={onClose}
        onTouchEnd={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
        aria-hidden="true"
      />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="grab" onClick={onClose} />
        <div className="sheet-head">
          {title ? <h2>{title}</h2> : <span />}
          <button
            type="button"
            className="sheet-close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <IconClose />
          </button>
        </div>
        <div className="sheet-body">
          {children}
        </div>
        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </>
  );
}

export function Stepper({ value, onChange, step = 1, min = 0, label }: { value: number; onChange: (v: number) => void; step?: number; min?: number; label?: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = (v: number) => onChange(Math.max(min, Math.round(v * 100) / 100));
  return (
    <div className="stepper">
      <button type="button" aria-label="Меньше" onClick={() => commit(value - step)}>−</button>
      <input
        inputMode="decimal"
        aria-label={label}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const v = parseFloat(text.replace(',', '.'));
          if (Number.isFinite(v)) commit(v);
          else setText(String(value));
        }}
      />
      <button type="button" aria-label="Больше" onClick={() => commit(value + step)}>+</button>
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; count?: number }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count !== undefined && <span className="count num">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Plate({ color, big, photo }: { color: string; big?: boolean; photo?: string }) {
  return (
    <div className={`plate${big ? ' big' : ''}${photo ? ' photo' : ''}`} style={{ ['--plate' as string]: color }}>
      {photo && <img src={photo} alt="" loading="lazy" />}
    </div>
  );
}

export function Ring({ percent }: { percent: number }) {
  const p = Math.round(Math.max(0, Math.min(100, percent)));
  return <div className="ring" style={{ ['--p' as string]: p }} aria-label={`Есть ${p}% ингредиентов`}><b>{p}%</b></div>;
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Spinner() {
  return <span className="spinner" aria-hidden />;
}

// ——— Всплывающие сообщения ———

let toastText: string | null = null;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
const toastListeners = new Set<() => void>();

export function toast(text: string) {
  toastText = text;
  toastListeners.forEach((fn) => fn());
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastText = null;
    toastListeners.forEach((fn) => fn());
  }, 2800);
}

export function ToastHost() {
  const text = useSyncExternalStore(
    (fn) => { toastListeners.add(fn); return () => toastListeners.delete(fn); },
    () => toastText,
  );
  return text ? <div className="toast" role="status">{text}</div> : null;
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    (fn) => {
      window.addEventListener('online', fn);
      window.addEventListener('offline', fn);
      return () => { window.removeEventListener('online', fn); window.removeEventListener('offline', fn); };
    },
    () => navigator.onLine,
  );
}

/** Сегодняшняя дата, обновляется после полуночи и при возвращении в приложение */
export function useToday(): string {
  const [today, setToday] = useState(() => todayLocal());
  useEffect(() => {
    const tick = () => setToday(todayLocal());
    const id = setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, []);
  return today;
}

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const CATEGORY_DOT: Record<string, string> = {
  vegetables: '#7BA94A', greens: '#5E9E4B', fruits: '#E9A23B', dairy: '#DCE7F2', eggs: '#EFE2C9', meat: '#D9776A',
  poultry: '#E9A99A', fish: '#8FB6CF', grains: '#D9C39A', bakery: '#C99A5B', canned: '#B6A58A', sauces: '#D0633F',
  frozen: '#A9D2E6', sweets: '#B07A5A', drinks: '#9CC7C0', spices: '#B5563A', nuts: '#A7824F', ready: '#C9793A', other: '#AAB7B1',
};
