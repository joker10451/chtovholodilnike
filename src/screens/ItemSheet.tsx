import { useEffect, useState } from 'react';
import { Sheet, Stepper, toast, useToday } from '../components/ui';
import { deleteRecords, saveItem } from '../data/repo';
import type { InventoryItem } from '../data/types';
import { estimateExpiry } from '../shared/freshness';
import { getProduct, LOCATION_LABELS, LOCATIONS, type Location } from '../shared/products';
import { UNIT_LABELS, type ItemUnit } from '../shared/units';

const UNITS: ItemUnit[] = ['g', 'ml', 'pcs', 'portion'];

export function ItemSheet({ item, onClose }: { item: InventoryItem | null; onClose: () => void }) {
  const today = useToday();
  const [draft, setDraft] = useState<InventoryItem | null>(item);
  useEffect(() => setDraft(item), [item]);
  if (!item || !draft) return <Sheet open={false} onClose={onClose}>{null}</Sheet>;

  const product = getProduct(draft.productKey);
  const step = draft.unit === 'g' || draft.unit === 'ml' ? (draft.qty >= 500 ? 100 : 50) : 1;

  function recompute(next: InventoryItem): InventoryItem {
    const packageDate = item!.expiresAt;
    const { expiresAt, isEstimate } = estimateExpiry({
      productKey: next.productKey, category: next.category, location: next.location,
      purchasedAt: next.purchasedAt, openedAt: next.openedAt, packageDate,
    });
    return { ...next, expiresAt, isEstimate };
  }

  const setLocation = (location: Location) => setDraft(recompute({ ...draft, location }));
  const setOpened = (opened: boolean) => setDraft(recompute({ ...draft, openedAt: opened ? today : null }));

  async function save() {
    if (!draft) return;
    if (draft.qty <= 0) return finish();
    await saveItem({ ...draft, name: draft.name.trim() || item!.name });
    toast('Сохранено');
    onClose();
  }

  async function finish() {
    await deleteRecords([item!.id]);
    toast(`${item!.name}: закончилось`);
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title={item.name}>
      <div className="stack-lg">
        <label className="field">
          <span>Название</span>
          <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </label>

        {item.nutriments && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 6,
              background: 'var(--surface-2)',
              padding: '8px 10px',
              borderRadius: 12,
              textAlign: 'center',
              fontSize: 12,
            }}
          >
            <div>
              <b style={{ display: 'block', fontSize: 13, color: 'var(--brand)' }}>
                {item.nutriments.kcal ?? '—'}
              </b>
              <span className="muted" style={{ fontSize: 10 }}>ккал/100г</span>
            </div>
            <div>
              <b style={{ display: 'block', fontSize: 13 }}>
                {item.nutriments.proteins ?? '—'}г
              </b>
              <span className="muted" style={{ fontSize: 10 }}>Белки</span>
            </div>
            <div>
              <b style={{ display: 'block', fontSize: 13 }}>
                {item.nutriments.fat ?? '—'}г
              </b>
              <span className="muted" style={{ fontSize: 10 }}>Жиры</span>
            </div>
            <div>
              <b style={{ display: 'block', fontSize: 13 }}>
                {item.nutriments.carbs ?? '—'}г
              </b>
              <span className="muted" style={{ fontSize: 10 }}>Углеводы</span>
            </div>
          </div>
        )}

        <div className="field-row">
          <label className="field">
            <span>Количество</span>
            <Stepper label="Количество" value={draft.qty} step={step} onChange={(qty) => setDraft({ ...draft, qty })} />
          </label>
          <label className="field">
            <span>Единицы</span>
            <select className="select" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value as ItemUnit })}>
              {UNITS.map((u) => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
            </select>
          </label>
        </div>

        <div className="field">
          <span>Где лежит</span>
          <div className="wrap-gap">
            {LOCATIONS.map((l) => (
              <button key={l} type="button" className={`chip${draft.location === l ? ' on' : ''}`} onClick={() => setLocation(l)}>
                {LOCATION_LABELS[l]}
              </button>
            ))}
          </div>
        </div>

        <div className="field-row">
          <label className="field">
            <span>Годен до{draft.isEstimate && draft.expiresAt ? ' (примерно)' : ''}</span>
            <input
              className="input"
              type="date"
              value={draft.expiresAt ?? ''}
              onChange={(e) => setDraft({ ...draft, expiresAt: e.target.value || null, isEstimate: false })}
            />
          </label>
          {product?.opened !== undefined && (
            <label className="check" style={{ alignSelf: 'end', minHeight: 46 }}>
              <input type="checkbox" checked={!!draft.openedAt} onChange={(e) => setOpened(e.target.checked)} />
              Упаковка открыта
            </label>
          )}
        </div>
        {product?.opened !== undefined && draft.openedAt && (
          <p className="small muted">После вскрытия {product.name.toLowerCase()} хранится около {product.opened} дн. — срок пересчитан.</p>
        )}

        <div className="sheet-footer">
          <button className="btn danger" style={{ flex: 1 }} onClick={finish}>Закончилось</button>
          <button className="btn primary" style={{ flex: 2 }} onClick={save}>Сохранить</button>
        </div>
      </div>
    </Sheet>
  );
}
