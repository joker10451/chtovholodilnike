import { useState } from 'react';
import { Segmented, Sheet, Spinner, Stepper, toast, useOnline } from '../components/ui';
import { saveItems } from '../data/repo';
import { AiRequestError, OfflineError, recognize } from '../lib/ai';
import { makeItem, toReviewDraft } from '../lib/convert';
import { parseProductsText } from '../lib/parseText';
import { todayISO } from '../shared/dates';
import { getProduct, guessProductKey, LOCATION_LABELS, LOCATIONS, PRODUCTS, type Location } from '../shared/products';
import { formatQty, UNIT_LABELS, type BaseUnit } from '../shared/units';

type Mode = 'one' | 'list';

interface ListLine { name: string; productKey: string | null; qty: number; unit: BaseUnit; location: Location; include: boolean }

export function AddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>('one');
  return (
    <Sheet open={open} onClose={onClose} title="Добавить продукты">
      <Segmented<Mode> value={mode} onChange={setMode} options={[{ value: 'one', label: 'Один продукт' }, { value: 'list', label: 'Списком или голосом' }]} />
      {mode === 'one' ? <AddOne onDone={onClose} /> : <AddList onDone={onClose} />}
    </Sheet>
  );
}

function AddOne({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [qty, setQty] = useState(1);
  const [unit, setUnit] = useState<BaseUnit>('pcs');
  const [location, setLocation] = useState<Location>('fridge');
  const [date, setDate] = useState('');
  const [opened, setOpened] = useState(false);
  const [touched, setTouched] = useState(false);

  function onName(value: string) {
    setName(value);
    if (touched) return;
    const product = getProduct(guessProductKey(value));
    if (product) {
      setUnit(product.unit);
      setLocation(product.location);
      setQty(product.pack ?? (product.unit === 'pcs' ? 1 : 500));
    }
  }

  async function add() {
    if (!name.trim()) return;
    const item = makeItem({ name, qty, unit, location, packageDate: date || null, purchasedAt: todayISO(), opened, source: 'manual' });
    await saveItems([item]);
    toast(`Добавлено: ${item.name}`);
    onDone();
  }

  const step = unit === 'pcs' ? 1 : qty >= 500 ? 100 : 50;

  return (
    <div className="stack-lg">
      <label className="field">
        <span>Что добавить</span>
        <input className="input" list="products" placeholder="Например, творог" value={name} onChange={(e) => onName(e.target.value)} autoFocus />
        <datalist id="products">{PRODUCTS.map((p) => <option key={p.key} value={p.name} />)}</datalist>
      </label>
      <div className="field-row">
        <label className="field">
          <span>Сколько</span>
          <Stepper label="Количество" value={qty} step={step} onChange={(v) => { setTouched(true); setQty(v); }} />
        </label>
        <label className="field">
          <span>Единицы</span>
          <select className="select" value={unit} onChange={(e) => { setTouched(true); setUnit(e.target.value as BaseUnit); }}>
            {(['pcs', 'g', 'ml'] as BaseUnit[]).map((u) => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
          </select>
        </label>
      </div>
      <div className="field">
        <span>Где лежит</span>
        <div className="wrap-gap">
          {LOCATIONS.map((l) => (
            <button key={l} type="button" className={`chip${location === l ? ' on' : ''}`} onClick={() => { setTouched(true); setLocation(l); }}>{LOCATION_LABELS[l]}</button>
          ))}
        </div>
      </div>
      <div className="field-row">
        <label className="field">
          <span>Годен до (если есть на упаковке)</span>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="check" style={{ alignSelf: 'end', minHeight: 46 }}>
          <input type="checkbox" checked={opened} onChange={(e) => setOpened(e.target.checked)} /> Уже открыт
        </label>
      </div>
      <p className="small muted">Без даты срок посчитается примерно по типу продукта.</p>
      <button className="btn block" disabled={!name.trim()} onClick={add}>Добавить</button>
    </div>
  );
}

function AddList({ onDone }: { onDone: () => void }) {
  const online = useOnline();
  const [text, setText] = useState('');
  const [lines, setLines] = useState<ListLine[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function parse() {
    setBusy(true);
    setNote(null);
    try {
      if (online) {
        const result = await recognize({ task: 'text', today: todayISO(), text });
        setLines(result.items.map((it, i) => {
          const d = toReviewDraft(it, i);
          return { name: d.name, productKey: d.productKey, qty: d.qty, unit: d.unit as BaseUnit, location: d.location, include: true };
        }));
        return;
      }
      throw new OfflineError();
    } catch (e) {
      if (!(e instanceof OfflineError)) setNote(e instanceof AiRequestError ? `${e.message} Разобрал фразу без нейросети.` : 'Разобрал фразу без нейросети.');
      else setNote('Нет интернета — разобрал фразу без нейросети, проверьте результат.');
      setLines(parseProductsText(text).map((l) => ({ ...l, location: getProduct(l.productKey)?.location ?? 'fridge', include: true })));
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    const today = todayISO();
    const items = (lines ?? []).filter((l) => l.include).map((l) => makeItem({ ...l, purchasedAt: today, source: 'text' }));
    await saveItems(items);
    toast(`Добавлено продуктов: ${items.length}`);
    onDone();
  }

  if (lines) {
    const n = lines.filter((l) => l.include).length;
    return (
      <div className="stack">
        {note && <div className="notice">{note}</div>}
        <div className="list">
          {lines.map((l, i) => (
            <label key={i} className="item-row" style={{ opacity: l.include ? 1 : 0.5 }}>
              <input type="checkbox" checked={l.include} style={{ width: 20, height: 20, accentColor: 'var(--brand)' }}
                onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))} />
              <span className="nm"><b>{l.name}</b><small>{LOCATION_LABELS[l.location]}</small></span>
              <span className="mono small">{formatQty(l.qty, l.unit)}</span>
            </label>
          ))}
        </div>
        {lines.length === 0 && <p className="muted">Не нашёл продуктов в этой фразе.</p>}
        <button className="btn block" disabled={n === 0} onClick={add}>Добавить {n}</button>
        <button className="btn quiet" onClick={() => setLines(null)}>Изменить текст</button>
      </div>
    );
  }

  return (
    <div className="stack">
      <textarea
        className="textarea"
        placeholder="Десяток яиц, литр молока, полкило фарша, 3 помидора"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <p className="small muted">Чтобы надиктовать, нажмите микрофон на клавиатуре iPhone.</p>
      <button className="btn block" disabled={!text.trim() || busy} onClick={parse}>
        {busy ? <Spinner /> : null} Разобрать
      </button>
    </div>
  );
}
