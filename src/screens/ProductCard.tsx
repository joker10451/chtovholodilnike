import { useEffect, useMemo, useState } from 'react';
import { IconCamera } from '../components/icons';
import { Spinner, Stepper } from '../components/ui';
import { isComplete, packageExpiry, type ProductInfo } from '../lib/barcode';
import { addDays, daysBetween, shortDate } from '../shared/dates';
import { CATEGORY_LABELS, LOCATION_LABELS, LOCATIONS } from '../shared/products';
import { formatQty, UNIT_LABELS, type BaseUnit } from '../shared/units';
import { useObjectUrls } from '../hooks';

const SOURCE_LABEL: Record<ProductInfo['source'], string> = {
  memory: 'Из вашей базы',
  openfoodfacts: 'Open Food Facts',
  photo: 'Прочитано с упаковки',
  manual: 'Нет в базах',
};

export interface CardResult {
  product: ProductInfo;
  qty: number;
  unit: BaseUnit;
  expiresAt: string | null;
}

export function ProductCard({
  product, photo, today, reading, readError, note, online, onPhoto, onCancel, onFridge, onShopping,
}: {
  product: ProductInfo;
  photo: Blob | null;
  today: string;
  reading: boolean;
  readError: string | null;
  /** Почему товар не нашёлся в базах */
  note: string | null;
  online: boolean;
  onPhoto: (what: 'package' | 'date') => void;
  onCancel: () => void;
  onFridge: (r: CardResult) => void;
  onShopping: (r: CardResult) => void;
}) {
  const [name, setName] = useState(product.name);
  const [qty, setQty] = useState(product.qty);
  const [unit, setUnit] = useState<BaseUnit>(product.unit);
  const [location, setLocation] = useState(product.location);
  const [date, setDate] = useState<string>(packageExpiry(product) ?? '');
  const [dateTouched, setDateTouched] = useState(false);
  const [photoUrl] = useObjectUrls(useMemo(() => (photo ? [photo] : []), [photo]));

  // Нейросеть дочитала упаковку — подставляем новые сведения, не трогая то, что человек уже поправил
  useEffect(() => {
    setName((n) => (n.trim() ? n : product.name));
    setQty(product.qty);
    setUnit(product.unit);
    setLocation(product.location);
    if (!dateTouched) setDate(packageExpiry(product) ?? '');
  }, [product]); // eslint-disable-line react-hooks/exhaustive-deps

  const complete = isComplete({ ...product, name });
  const result = (): CardResult => ({ product: { ...product, name: name.trim(), location }, qty, unit, expiresAt: date || null });
  const left = date ? daysBetween(today, date) : null;
  const image = product.imageUrl ?? photoUrl;
  const n = product.nutriments;
  const meta = [
    product.brand && product.brand.toLowerCase() !== name.trim().toLowerCase() ? product.brand : null,
    product.qty > 0 && !(product.qty === 1 && product.unit === 'pcs') ? formatQty(product.qty, product.unit) : null,
    product.fatPercent !== null && !name.includes('%') ? `${String(product.fatPercent).replace('.', ',')}%` : null,
    product.category !== 'other' ? CATEGORY_LABELS[product.category] : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="pcard" role="dialog" aria-label="Товар">
      <div className="pcard-grab" />
      <div className="pcard-head">
        <div className="pcard-img">{image ? <img src={image} alt="" /> : <span>{(name || '?').slice(0, 1).toUpperCase()}</span>}</div>
        <div className="grow stack" style={{ gap: 4 }}>
          <div className="row-gap" style={{ gap: 6, flexWrap: 'wrap' }}>
            <span className={`stk ${product.source === 'manual' ? 'plain' : 'brand'}`}>{SOURCE_LABEL[product.source]}</span>
            {product.barcode && <span className="mono small muted">{product.barcode}</span>}
          </div>
          <input className="pcard-name" value={name} placeholder="Как называется товар?" onChange={(e) => setName(e.target.value)} />
          {meta && <span className="small muted">{meta}</span>}
        </div>
      </div>

      {note && product.source === 'manual' && <p className="small muted">{note}</p>}

      {reading && (
        <div className="notice info row-gap"><Spinner /> <span>{product.barcode && product.source === 'manual' ? 'В базах товара нет — нейросеть читает упаковку по снимку…' : 'Нейросеть читает упаковку: название, вес, КБЖУ и срок…'}</span></div>
      )}
      {readError && <div className="notice error">{readError}</div>}

      {!reading && !complete && (
        <button className="pcard-cta" onClick={() => onPhoto('package')} disabled={!online}>
          <IconCamera />
          <span className="grow">
            <b>{product.barcode ? 'Сфотографируйте лицевую сторону упаковки' : 'Сфотографируйте упаковку'}</b>
            <small>{online ? 'Нейросеть прочитает название, вес, КБЖУ и срок годности' : 'Нужен интернет. Пока можно ввести название вручную'}</small>
          </span>
        </button>
      )}

      {!reading && complete && product.source !== 'photo' && (!n || (product.qty === 1 && product.unit === 'pcs' && product.category !== 'eggs')) && (
        <button className="btn ghost small" onClick={() => onPhoto('package')} disabled={!online}>
          <IconCamera /> Дополнить по фото упаковки: {!n ? 'КБЖУ, ' : ''}вес, срок
        </button>
      )}

      {n && (
        <div className="pcard-kbju num">
          <div><b>{n.kcal ?? '—'}</b><span>ккал</span></div>
          <div><b>{n.proteins ?? '—'}</b><span>белки</span></div>
          <div><b>{n.fat ?? '—'}</b><span>жиры</span></div>
          <div><b>{n.carbs ?? '—'}</b><span>углев.</span></div>
          <small>на 100 {unit === 'ml' ? 'мл' : 'г'}</small>
        </div>
      )}

      <div className="pcard-section">
        <div className="row-gap" style={{ justifyContent: 'space-between' }}>
          <b>Годен до</b>
          <span className={`small ${left !== null && left <= 2 ? 'warn' : 'muted'}`}>
            {left === null ? 'посчитаем по типу продукта' : left < 0 ? `истёк ${-left} дн. назад` : left === 0 ? 'истекает сегодня' : `ещё ${left} дн.`}
          </span>
        </div>
        {product.manufacturedAt && product.shelfLifeDays && !product.expiresAt && (
          <span className="small muted">Изготовлено {shortDate(product.manufacturedAt)}, срок {product.shelfLifeDays} дн.</span>
        )}
        {!product.manufacturedAt && product.shelfLifeDays && !product.expiresAt && !date && (
          <span className="small muted">Срок годности {product.shelfLifeDays} дн. от даты изготовления — снимите дату, и приложение посчитает, до какого числа.</span>
        )}
        <div className="row-gap">
          <input className="input" type="date" value={date} onChange={(e) => { setDate(e.target.value); setDateTouched(true); }} />
          <button className="btn ghost small pcard-datebtn" onClick={() => onPhoto('date')} disabled={!online || reading}>
            <IconCamera /> Снять дату
          </button>
        </div>
        <div className="quick-expiry-chips">
          {[3, 7, 14, 30].map((d) => {
            const target = addDays(today, d);
            return (
              <button key={d} type="button" className={`quick-chip${date === target ? ' active' : ''}`} onClick={() => { setDate(target); setDateTouched(true); }}>
                +{d} дн.
              </button>
            );
          })}
        </div>
      </div>

      <div className="pcard-section">
        <div className="field-row">
          <Stepper label="Количество" value={qty} step={unit === 'pcs' ? 1 : qty >= 500 ? 100 : 50} onChange={setQty} />
          <select className="select" value={unit} onChange={(e) => setUnit(e.target.value as BaseUnit)} aria-label="Единицы">
            {(['pcs', 'g', 'ml'] as BaseUnit[]).map((u) => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
          </select>
        </div>
        <div className="wrap-gap">
          {LOCATIONS.map((l) => (
            <button key={l} type="button" className={`chip${location === l ? ' on' : ''}`} onClick={() => setLocation(l)}>{LOCATION_LABELS[l]}</button>
          ))}
        </div>
      </div>

      {(product.storage || product.afterOpeningDays || product.composition) && (
        <div className="pcard-facts small">
          {product.storage && <div><span>Хранение</span>{product.storage}</div>}
          {product.afterOpeningDays && <div><span>После вскрытия</span>{product.afterOpeningDays} дн.</div>}
          {product.composition && <div><span>Состав</span>{product.composition}</div>}
        </div>
      )}

      <div className="pcard-actions">
        <button className="btn quiet" onClick={onCancel}>Отмена</button>
        <button className="btn ghost" disabled={!name.trim()} onClick={() => onShopping(result())}>В покупки</button>
        <button className="btn grow" disabled={!name.trim() || reading} onClick={() => onFridge(result())}>В холодильник</button>
      </div>
    </div>
  );
}
