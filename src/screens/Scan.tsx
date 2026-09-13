import { useEffect, useMemo, useState } from 'react';
import { IconCamera, IconImage } from '../components/icons';
import { Header, Segmented, Spinner, toast, useOnline } from '../components/ui';
import { useScans } from '../data/repo';
import { enqueueScan, processScanQueue, removeScan, retryScan } from '../data/scanQueue';
import type { ScanJob, ScanMode } from '../data/types';
import { shrinkPhoto } from '../lib/image';
import { go, href } from '../router';

const MAX_PHOTOS: Record<ScanMode, number> = { shelf: 6, receipt: 4 };

export function Scan() {
  const online = useOnline();
  const scans = useScans();
  const [mode, setMode] = useState<ScanMode>('shelf');
  const [photos, setPhotos] = useState<Blob[]>([]);
  const [busy, setBusy] = useState(false);
  const previews = useObjectUrls(photos);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const room = MAX_PHOTOS[mode] - photos.length;
      const shrunk = await Promise.all([...files].slice(0, room).map(shrinkPhoto));
      setPhotos((p) => [...p, ...shrunk]);
      if (files.length > room) toast(`За раз можно до ${MAX_PHOTOS[mode]} фото`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    const id = await enqueueScan(mode, photos);
    setPhotos([]);
    if (online) go(href('review', id));
    else toast('Фото сохранены. Распознаю, когда появится интернет.');
  }

  const pending = (scans ?? []).filter((s) => s.status !== 'applied');
  const full = photos.length >= MAX_PHOTOS[mode];

  return (
    <main className="screen">
      <Header title="Скан" sub={mode === 'shelf' ? 'Сфотографируйте каждую полку по очереди' : 'Сфотографируйте чек целиком, чтобы был виден весь список'} />
      <Segmented<ScanMode>
        value={mode}
        onChange={(m) => { setMode(m); setPhotos([]); }}
        options={[{ value: 'shelf', label: 'Полки холодильника' }, { value: 'receipt', label: 'Чек из магазина' }]}
      />

      <div className="stack-lg">
        {photos.length > 0 && (
          <div className="shots">
            {previews.map((url, i) => (
              <div key={url} className="shot">
                <img src={url} alt={`Фото ${i + 1}`} />
                <button aria-label="Убрать фото" onClick={() => setPhotos(photos.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
          </div>
        )}

        <div className="capture">
          <label className={`btn ${photos.length ? 'ghost' : ''}`} aria-disabled={full}>
            {busy ? <Spinner /> : <IconCamera />} {photos.length ? 'Ещё фото' : 'Снять'}
            <input type="file" accept="image/*" capture="environment" disabled={full || busy} onChange={(e) => { void addFiles(e.target.files); e.target.value = ''; }} />
          </label>
          <label className="btn ghost" aria-disabled={full}>
            <IconImage /> Из галереи
            <input type="file" accept="image/*" multiple disabled={full || busy} onChange={(e) => { void addFiles(e.target.files); e.target.value = ''; }} />
          </label>
        </div>

        {photos.length > 0 && (
          <button className="btn block" onClick={submit}>
            {online ? `Распознать ${photos.length} фото` : `Сохранить ${photos.length} фото до появления интернета`}
          </button>
        )}

        {photos.length === 0 && (
          <div className="card flat stack">
            <b>{mode === 'shelf' ? 'Как снимать, чтобы нейросеть всё нашла' : 'Как снимать чек'}</b>
            {mode === 'shelf' ? (
              <ul className="small muted" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
                <li>Одна полка — одно фото, дверца — отдельным снимком.</li>
                <li>Поверните упаковки этикетками к камере, если не трудно.</li>
                <li>Включите свет, снимайте без вспышки.</li>
                <li>Дату «годен до» нейросеть прочитает, если она видна крупно.</li>
              </ul>
            ) : (
              <p className="small muted">Разгладьте чек и снимайте сверху. Длинный чек можно снять в 2–3 фото. Бытовая химия и пакеты в список не попадут.</p>
            )}
          </div>
        )}

        {!online && (
          <div className="notice">Нет интернета. Фото можно снять сейчас — нейросеть разберёт их, когда телефон подключится (например, через VPN).</div>
        )}

        {pending.length > 0 && (
          <div className="stack">
            <div className="section-label">Распознавание</div>
            <div className="list">{pending.map((job) => <ScanRow key={job.id} job={job} online={online} />)}</div>
          </div>
        )}
      </div>
    </main>
  );
}

function ScanRow({ job, online }: { job: ScanJob; online: boolean }) {
  const [thumb] = useObjectUrls(useMemo(() => job.photos.slice(0, 1), [job.photos]));
  const label = job.mode === 'shelf' ? `Полки · ${job.photos.length} фото` : 'Чек';
  const time = new Date(job.createdAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <div className="scan-job">
      {thumb ? <img className="thumb" src={thumb} alt="" /> : <span className="thumb" />}
      <div className="grow">
        <b>{label}</b>
        <div className="small muted">
          {job.status === 'queued' && (online ? 'В очереди…' : 'Ждёт интернета')}
          {job.status === 'processing' && 'Нейросеть смотрит фото…'}
          {job.status === 'ready' && `Найдено: ${job.result?.items.length ?? 0} · ${time}`}
          {job.status === 'error' && <span style={{ color: 'var(--bad)' }}>{job.error}</span>}
        </div>
      </div>
      {job.status === 'processing' && <Spinner />}
      {job.status === 'ready' && <a className="btn small" href={href('review', job.id)}>Проверить</a>}
      {job.status === 'error' && <button className="btn small ghost" onClick={() => retryScan(job.id)}>Повторить</button>}
      {(job.status === 'queued' || job.status === 'error') && (
        <button className="btn small quiet" onClick={() => removeScan(job.id)}>Удалить</button>
      )}
      {job.status === 'queued' && online && <QueueKick />}
    </div>
  );
}

function QueueKick() {
  useEffect(() => { void processScanQueue(); }, []);
  return null;
}

export function useObjectUrls(blobs: Blob[]): string[] {
  const urls = useMemo(() => blobs.map((b) => URL.createObjectURL(b)), [blobs]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  return urls;
}
