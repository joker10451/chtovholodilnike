import { useState } from 'react';
import { Stepper } from '../components/ui';
import { setMeta } from '../data/db';
import { DEFAULT_SETTINGS, saveSettings } from '../data/repo';
import { PRODUCTS } from '../shared/products';

const STAPLE_OPTIONS = PRODUCTS.filter((p) => p.staple);

export function Onboarding() {
  const [servings, setServings] = useState(DEFAULT_SETTINGS.servings);
  const [staples, setStaples] = useState<Set<string>>(new Set(DEFAULT_SETTINGS.staples));
  const [timeLimit, setTimeLimit] = useState(DEFAULT_SETTINGS.timeLimit);

  async function finish() {
    await saveSettings({ servings, staples: [...staples], timeLimit });
    await setMeta({ onboarded: true });
    try { await navigator.storage?.persist?.(); } catch { /* не критично */ }
  }

  return (
    <main className="screen no-tabs">
      <div className="stack-lg" style={{ paddingTop: 12 }}>
        <div className="hero-mark"><img src="/pwa-192x192.png" alt="" /></div>
        <div className="stack">
          <h1 style={{ fontSize: 28 }}>Что в холодильнике</h1>
          <p className="muted">Три вопроса, чтобы рецепты подбирались под вашу семью. Потом всё можно поменять в настройках.</p>
        </div>

        <div className="card flat stack">
          <b>Сколько человек обычно ест?</b>
          <div style={{ maxWidth: 180 }}><Stepper label="Человек" value={servings} min={1} onChange={(v) => setServings(Math.max(1, Math.round(v)))} /></div>
        </div>

        <div className="card flat stack">
          <b>Сколько минут готовы готовить в будни?</b>
          <div className="wrap-gap">
            {[20, 30, 45, 60, 90].map((m) => (
              <button key={m} className={`chip${timeLimit === m ? ' on' : ''}`} onClick={() => setTimeLimit(m)}>до {m} мин</button>
            ))}
          </div>
        </div>

        <div className="card flat stack">
          <b>Что дома есть всегда?</b>
          <p className="small muted">Эти продукты не нужно сканировать — рецепты будут считать, что они есть.</p>
          <div className="check-grid">
            {STAPLE_OPTIONS.map((p) => (
              <label key={p.key} className="check">
                <input
                  type="checkbox"
                  checked={staples.has(p.key)}
                  onChange={(e) => {
                    const next = new Set(staples);
                    if (e.target.checked) next.add(p.key); else next.delete(p.key);
                    setStaples(next);
                  }}
                />
                {p.name}
              </label>
            ))}
          </div>
        </div>

        <button className="btn block" onClick={finish}>Начать</button>
      </div>
    </main>
  );
}
