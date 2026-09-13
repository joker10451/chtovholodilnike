import { useEffect, useMemo, useState } from 'react';
import { Empty, Header, Spinner, Stepper, Sticker, toast, useToday } from '../components/ui';
import { db } from '../data/db';
import { saveItems, useScan } from '../data/repo';
import { retryScan } from '../data/scanQueue';
import { draftToItem, toReviewDraft, type ReviewDraft } from '../lib/convert';
import { go, href } from '../router';
import { addDays, isISODate } from '../shared/dates';
import { estimateExpiry } from '../shared/freshness';
import { getProduct, LOCATION_LABELS, LOCATIONS, PRODUCTS } from '../shared/products';
import { UNIT_LABELS, type BaseUnit } from '../shared/units';
import { useObjectUrls } from './Scan';
import { plural } from './Fridge';

export function Review({ id }: { id: string }) {
  const job = useScan(id);
  const today = useToday();
  const [drafts, setDrafts] = useState<ReviewDraft[] | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const photos = useMemo(() => job?.photos ?? [], [job?.photos]);
  const urls = useObjectUrls(photos);

  useEffect(() => {
    if (job?.status === 'ready' && job.result && drafts === null) {
      setDrafts(job.result.items.map(toReviewDraft));
    }
  }, [job, drafts]);

  if (job === undefined) return <main className="screen" />;
  if (job === null) {
    return <main className="screen"><Header title="Скан не найден" backTo="#/scan" /></main>;
  }
  if (job.status === 'queued' || job.status === 'processing') {
    return (
      <main className="screen">
        <Header title="Распознаю…" backTo="#/scan" />
        <Empty title="Нейросеть смотрит фото" action={<Spinner />}>
          Обычно это занимает 10–30 секунд. Можно закрыть экран — результат появится в разделе «Скан».
        </Empty>
      </main>
    );
  }
  if (job.status === 'error') {
    return (
      <main className="screen">
        <Header title="Не получилось" backTo="#/scan" />
        <div className="stack">
          <div className="notice error">{job.error}</div>
          <button className="btn block" onClick={() => retryScan(job.id)}>Попробовать ещё раз</button>
        </div>
      </main>
    );
  }
  if (job.status === 'applied') {
    return (
      <main className="screen">
        <Header title="Уже добавлено" backTo="#/scan" />
        <a className="btn block" href={href('fridge')}>Открыть холодильник</a>
      </main>
    );
  }
  if (!drafts) return <main className="screen" />;

  const purchasedAt = job.mode === 'receipt' && isISODate(job.result?.purchase_date) ? job.result!.purchase_date! : today;
  const questions = drafts.filter((d) => d.include && d.question && !d.answered);
  const selected = drafts.filter((d) => d.include);
  const update = (uid: string, patch: Partial<ReviewDraft>) => setDrafts(drafts.map((d) => (d.uid === uid ? { ...d, ...patch } : d)));
  const boxes = drafts.filter((d) => d.include && d.box && d.photoIndex === photoIndex);

  async function apply() {
    const source = job!.mode === 'receipt' ? 'receipt' : 'photo';
    const items = selected.map((d) => draftToItem(d, purchasedAt, source));
    await saveItems(items);
    await db.scans.update(job!.id, { status: 'applied' });
    toast(`Добавлено продуктов: ${items.length}`);
    go(href('fridge'), true);
  }

  return (
    <main className="screen">
      <Header
        title={`Нашли ${drafts.length} ${plural(drafts.length, 'продукт', 'продукта', 'продуктов')}`}
        sub={job.mode === 'receipt' ? `Чек от ${purchasedAt.split('-').reverse().join('.')}` : `Скан из ${photos.length} фото`}
        backTo="#/scan"
      />

      <div className="stack-lg">
        {job.mode === 'shelf' && urls.length > 0 && (
          <div>
            <div className="photo-view">
              <img src={urls[Math.min(photoIndex, urls.length - 1)]} alt="Снимок полки" />
              {boxes.map((d) => (
                <div
                  key={d.uid}
                  className={`bbox${d.question && !d.answered ? ' q' : ''}`}
                  style={{ left: `${d.box!.x * 100}%`, top: `${d.box!.y * 100}%`, width: `${d.box!.w * 100}%`, height: `${d.box!.h * 100}%` }}
                >
                  <span>{d.question && !d.answered ? `${d.name}?` : d.name}</span>
                </div>
              ))}
            </div>
            {urls.length > 1 && (
              <div className="photo-tabs">
                {urls.map((_, i) => (
                  <button key={i} className={`chip${i === photoIndex ? ' on' : ''}`} onClick={() => setPhotoIndex(i)}>Фото {i + 1}</button>
                ))}
              </div>
            )}
          </div>
        )}

        {questions.length > 0 && (
          <div className="stack">
            <div className="section-label">Нужно уточнить · {questions.length}</div>
            {questions.map((d) => (
              <div key={d.uid} className="card stack">
                <b>{d.question!.text}</b>
                <div className="wrap-gap">
                  {d.question!.options.map((opt) => (
                    <button key={opt} className="chip" onClick={() => {
                      const key = PRODUCTS.find((p) => p.name.toLowerCase() === opt.toLowerCase() || p.aliases.includes(opt.toLowerCase()))?.key ?? null;
                      const product = getProduct(key);
                      update(d.uid, { name: opt, productKey: key, category: product?.category ?? d.category, answered: true });
                    }}>{opt}</button>
                  ))}
                  <button className="chip" onClick={() => update(d.uid, { include: false, answered: true })}>Не добавлять</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="stack">
          <div className="section-label">Продукты · {selected.length} из {drafts.length}</div>
          <div className="list">
            {drafts.map((d) => <DraftRow key={d.uid} draft={d} today={today} purchasedAt={purchasedAt} onChange={(p) => update(d.uid, p)} />)}
          </div>
        </div>

        <button className="btn block" disabled={selected.length === 0 || questions.length > 0} onClick={apply}>
          {questions.length > 0 ? `Ответьте на вопросы (${questions.length})` : `Добавить ${selected.length} в холодильник`}
        </button>
      </div>
    </main>
  );
}

function DraftRow({ draft: d, today, purchasedAt, onChange }: { draft: ReviewDraft; today: string; purchasedAt: string; onChange: (p: Partial<ReviewDraft>) => void }) {
  const [open, setOpen] = useState(false);
  const product = getProduct(d.productKey);
  const { expiresAt, isEstimate } = estimateExpiry({
    productKey: d.productKey, category: d.category, location: d.location, purchasedAt,
    openedAt: d.fill !== null && d.fill < 1 ? purchasedAt : null, packageDate: d.packageDate,
  });
  const step = d.unit === 'pcs' ? 1 : d.qty >= 500 ? 100 : 50;

  return (
    <div className={`draft${d.include ? '' : ' off'}`}>
      <div className="top">
        <input type="checkbox" aria-label={`Добавить ${d.name}`} checked={d.include} onChange={(e) => onChange({ include: e.target.checked })} />
        <button className="grow" style={{ background: 'none', border: 0, textAlign: 'left', padding: 0 }} onClick={() => setOpen(!open)}>
          <b>{d.name}</b>
          <div className="small muted num">
            {d.fill !== null && d.fill < 1 ? `осталось ~${Math.round(d.fill * 100)}% · ` : ''}
            {d.qty} {UNIT_LABELS[d.unit]} · {LOCATION_LABELS[d.location].toLowerCase()}
            {d.confidence < 0.75 && !d.answered && <span className="conf"> · уверенность {Math.round(d.confidence * 100)}%</span>}
          </div>
        </button>
        <Sticker expiresAt={expiresAt} isEstimate={isEstimate} today={today} />
      </div>

      {product?.liquid && d.fill !== null && (
        <div className="stack" style={{ gap: 6 }}>
          <span className="small muted">Сколько осталось в упаковке</span>
          <div className="fill-scale">
            {[0.25, 0.5, 0.75, 1].map((v) => (
              <button key={v} aria-label={`${v * 100}%`} className={d.fill! >= v ? 'on' : ''} onClick={() => onChange({ fill: v })} />
            ))}
          </div>
        </div>
      )}

      {open && (
        <div className="stack">
          <input className="input" value={d.name} onChange={(e) => onChange({ name: e.target.value })} aria-label="Название" />
          <div className="field-row">
            <Stepper label="Количество" value={d.qty} step={step} onChange={(qty) => onChange({ qty })} />
            <select className="select" value={d.unit} onChange={(e) => onChange({ unit: e.target.value as BaseUnit })}>
              {(['pcs', 'g', 'ml'] as BaseUnit[]).map((u) => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
            </select>
          </div>
          <div className="wrap-gap">
            {LOCATIONS.map((l) => (
              <button key={l} className={`chip${d.location === l ? ' on' : ''}`} onClick={() => onChange({ location: l })}>{LOCATION_LABELS[l]}</button>
            ))}
          </div>
          <div className="field">
            <div className="row-between" style={{ marginBottom: 4 }}>
              <span className="small muted">Годен до (дата окончания)</span>
            </div>
            <div className="quick-expiry-chips" style={{ marginBottom: 6 }}>
              {[
                { label: '+3 дн', days: 3 },
                { label: '+7 дн', days: 7 },
                { label: '+14 дн', days: 14 },
                { label: '+30 дн', days: 30 },
              ].map((chip) => {
                const target = addDays(today, chip.days);
                return (
                  <button
                    key={chip.days}
                    type="button"
                    className={`quick-chip${d.packageDate === target ? ' active' : ''}`}
                    onClick={() => onChange({ packageDate: target })}
                  >
                    {chip.label}
                  </button>
                );
              })}
              <button
                type="button"
                className={`quick-chip${!d.packageDate ? ' active' : ''}`}
                onClick={() => onChange({ packageDate: null })}
              >
                Без даты
              </button>
            </div>
            <input className="input" type="date" value={d.packageDate ?? ''} onChange={(e) => onChange({ packageDate: e.target.value || null })} />
          </div>
        </div>
      )}
    </div>
  );
}
