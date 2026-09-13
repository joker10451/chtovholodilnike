import { useEffect, useMemo, useState } from 'react';
import { IconCheck } from '../components/icons';
import { CATEGORY_DOT, Empty, Header, Spinner, Stepper, Sticker, toast, useToday } from '../components/ui';
import { db } from '../data/db';
import { saveItems, useScan } from '../data/repo';
import { removeScan, retryScan } from '../data/scanQueue';
import { draftToItem, toReviewDraft, type ReviewDraft } from '../lib/convert';
import { useObjectUrls } from '../hooks';
import { go, href } from '../router';
import { addDays, isISODate, shortDate } from '../shared/dates';
import { estimateExpiry } from '../shared/freshness';
import { getProduct, LOCATION_LABELS, LOCATIONS, PRODUCTS } from '../shared/products';
import { formatQty, UNIT_LABELS, type BaseUnit } from '../shared/units';
import { plural } from './Fridge';

export function Review({ id }: { id: string }) {
  const job = useScan(id);
  const today = useToday();
  const [drafts, setDrafts] = useState<ReviewDraft[] | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [openUid, setOpenUid] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const photos = useMemo(() => job?.photos ?? [], [job?.photos]);
  const urls = useObjectUrls(photos);

  useEffect(() => {
    if (job?.status === 'ready' && job.result && drafts === null) {
      setDrafts(job.result.items.map(toReviewDraft));
    }
  }, [job, drafts]);

  const kind = job?.mode === 'receipt' ? 'Чек' : 'Полки';

  if (job === undefined) return <main className="screen no-tabs" />;
  if (job === null) {
    return (
      <main className="screen no-tabs">
        <Header title="Скан не найден" backTo="#/scan" />
        <Empty title="Этого скана уже нет" action={<a className="btn" href={href('scan')}>Открыть камеру</a>}>
          Возможно, его уже добавили в холодильник или удалили.
        </Empty>
      </main>
    );
  }
  if (job.status === 'queued' || job.status === 'processing') {
    return (
      <main className="screen no-tabs">
        <Header title={kind} sub={job.status === 'queued' && !navigator.onLine ? 'Ждёт интернета' : 'Нейросеть разбирает фото'} backTo="#/scan" />
        <div className="review-wait">
          {urls[0] && <img src={urls[0]} alt="" />}
          <div className="stack" style={{ alignItems: 'center', gap: 8 }}>
            <Spinner />
            <b>{job.mode === 'receipt' ? 'Читаю позиции чека…' : 'Ищу продукты на полках…'}</b>
            <p className="small muted">Обычно 10–30 секунд. Экран можно закрыть — скан появится в камере в разделе «Проверить».</p>
          </div>
        </div>
      </main>
    );
  }
  if (job.status === 'error') {
    const codeProblem = /код доступа/i.test(job.error ?? '');
    return (
      <main className="screen no-tabs">
        <Header title="Не получилось" sub={kind} backTo="#/scan" />
        <div className="stack">
          <div className="notice error">
            <span>{job.error}</span>
            {codeProblem && <a className="notice-link" href={href('settings')}>Открыть настройки</a>}
          </div>
          <button className="btn block" onClick={() => retryScan(job.id)}>Попробовать ещё раз</button>
          <button className="btn quiet" onClick={async () => { await removeScan(job.id); go(href('scan'), true); }}>Удалить скан</button>
        </div>
      </main>
    );
  }
  if (job.status === 'applied') {
    return (
      <main className="screen no-tabs">
        <Header title="Уже в холодильнике" sub={kind} backTo="#/scan" />
        <Empty title="Продукты с этого скана добавлены" action={<a className="btn" href={href('fridge')}>Открыть холодильник</a>} />
      </main>
    );
  }
  if (!drafts) return <main className="screen no-tabs" />;

  if (drafts.length === 0) {
    return (
      <main className="screen no-tabs">
        <Header title={kind} backTo="#/scan" />
        <Empty
          title={job.mode === 'receipt' ? 'В чеке не нашлось продуктов' : 'Продукты не нашлись'}
          action={
            <div className="stack" style={{ width: '100%', maxWidth: 320 }}>
              <a className="btn block" href={href('scan')}>Снять заново</a>
              <button className="btn quiet" onClick={async () => { await removeScan(job.id); go(href('scan'), true); }}>Удалить скан</button>
            </div>
          }
        >
          {job.mode === 'receipt'
            ? 'Снимите чек ближе и при хорошем свете, чтобы строки читались.'
            : 'Снимите полку ближе, этикетками к камере, без вспышки.'}
        </Empty>
      </main>
    );
  }

  const purchasedAt = job.mode === 'receipt' && isISODate(job.result?.purchase_date) ? job.result!.purchase_date! : today;
  const questions = drafts.filter((d) => d.include && d.question && !d.answered);
  const selected = drafts.filter((d) => d.include);
  const allOn = selected.length === drafts.length;
  const update = (uid: string, patch: Partial<ReviewDraft>) => setDrafts(drafts.map((d) => (d.uid === uid ? { ...d, ...patch } : d)));
  const boxes = drafts.filter((d) => d.include && d.box && d.photoIndex === photoIndex);

  async function apply() {
    setSaving(true);
    const source = job!.mode === 'receipt' ? 'receipt' : 'photo';
    const items = selected.map((d) => draftToItem(d, purchasedAt, source));
    await saveItems(items);
    await db.scans.update(job!.id, { status: 'applied' });
    toast(`В холодильник добавлено: ${items.length}`);
    go(href('fridge'), true);
  }

  return (
    <main className="screen no-tabs review">
      <Header
        title={`${kind}: ${drafts.length} ${plural(drafts.length, 'продукт', 'продукта', 'продуктов')}`}
        sub={job.mode === 'receipt' ? `Покупка ${shortDate(purchasedAt)} · срок посчитаем от этой даты` : `${photos.length} ${plural(photos.length, 'снимок', 'снимка', 'снимков')} · проверьте и уберите лишнее`}
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
                  <button key={i} className={`chip${i === photoIndex ? ' on' : ''}`} onClick={() => setPhotoIndex(i)}>Снимок {i + 1}</button>
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
          <div className="row-gap" style={{ justifyContent: 'space-between' }}>
            <div className="section-label">Выбрано {selected.length} из {drafts.length}</div>
            <button className="btn small quiet" onClick={() => setDrafts(drafts.map((d) => ({ ...d, include: !allOn })))}>
              {allOn ? 'Снять все' : 'Выбрать все'}
            </button>
          </div>
          <div className="list">
            {drafts.map((d) => (
              <DraftRow
                key={d.uid}
                draft={d}
                today={today}
                purchasedAt={purchasedAt}
                open={openUid === d.uid}
                onToggleOpen={() => setOpenUid(openUid === d.uid ? null : d.uid)}
                onChange={(p) => update(d.uid, p)}
              />
            ))}
          </div>
          <p className="small muted">Коснитесь продукта, чтобы поправить название, количество или срок.</p>
        </div>
      </div>

      <div className="review-actions">
        <button className="btn block" disabled={selected.length === 0 || questions.length > 0 || saving} onClick={apply}>
          {questions.length > 0
            ? `Ответьте на ${questions.length} ${plural(questions.length, 'вопрос', 'вопроса', 'вопросов')}`
            : `Добавить ${selected.length} в холодильник`}
        </button>
      </div>
    </main>
  );
}

function DraftRow({ draft: d, today, purchasedAt, open, onToggleOpen, onChange }: {
  draft: ReviewDraft; today: string; purchasedAt: string; open: boolean; onToggleOpen: () => void; onChange: (p: Partial<ReviewDraft>) => void;
}) {
  const product = getProduct(d.productKey);
  const { expiresAt, isEstimate } = estimateExpiry({
    productKey: d.productKey, category: d.category, location: d.location, purchasedAt, openedAt: null, packageDate: d.packageDate,
  });
  const step = d.unit === 'pcs' ? 1 : d.qty >= 500 ? 100 : 50;
  const unsure = d.confidence < 0.75 && !d.answered;

  return (
    <div className={`draft${d.include ? '' : ' off'}${open ? ' open' : ''}`}>
      <div className="top">
        <button
          type="button"
          className={`round-check${d.include ? ' on' : ''}`}
          aria-label={d.include ? `Не добавлять ${d.name}` : `Добавить ${d.name}`}
          aria-pressed={d.include}
          onClick={() => onChange({ include: !d.include })}
        >
          {d.include && <IconCheck />}
        </button>
        <span className="dot"><i style={{ background: CATEGORY_DOT[d.category] }} /></span>
        <button type="button" className="draft-name" onClick={onToggleOpen} aria-expanded={open}>
          <b>{d.name}</b>
          <small className="num">
            {d.fill !== null && d.fill < 1 ? `осталось ~${Math.round(d.fill * 100)}% · ` : ''}
            {formatQty(d.qty, d.unit)} · {LOCATION_LABELS[d.location].toLowerCase()}
            {unsure && <span className="warn"> · проверьте</span>}
          </small>
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
        <div className="draft-edit">
          <label className="field">
            <span>Название</span>
            <input className="input" value={d.name} onChange={(e) => onChange({ name: e.target.value })} />
          </label>
          <div className="field-row">
            <Stepper label="Количество" value={d.qty} step={step} onChange={(qty) => onChange({ qty })} />
            <select className="select" value={d.unit} aria-label="Единицы" onChange={(e) => onChange({ unit: e.target.value as BaseUnit })}>
              {(['pcs', 'g', 'ml'] as BaseUnit[]).map((u) => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
            </select>
          </div>
          <div className="wrap-gap">
            {LOCATIONS.map((l) => (
              <button key={l} type="button" className={`chip${d.location === l ? ' on' : ''}`} onClick={() => onChange({ location: l })}>{LOCATION_LABELS[l]}</button>
            ))}
          </div>
          <div className="field">
            <span>Годен до</span>
            <div className="quick-expiry-chips">
              {[3, 7, 14, 30].map((days) => {
                const target = addDays(today, days);
                return (
                  <button key={days} type="button" className={`quick-chip${d.packageDate === target ? ' active' : ''}`} onClick={() => onChange({ packageDate: target })}>
                    +{days} дн.
                  </button>
                );
              })}
              <button type="button" className={`quick-chip${!d.packageDate ? ' active' : ''}`} onClick={() => onChange({ packageDate: null })}>
                По типу продукта
              </button>
            </div>
            <input className="input" type="date" value={d.packageDate ?? ''} onChange={(e) => onChange({ packageDate: e.target.value || null })} />
          </div>
        </div>
      )}
    </div>
  );
}
