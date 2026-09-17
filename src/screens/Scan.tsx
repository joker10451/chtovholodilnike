import { useEffect, useMemo, useRef, useState } from 'react';
import { IconClose, IconFlash, IconImage } from '../components/icons';
import { Sheet, Spinner, toast, useOnline, useToday } from '../components/ui';
import { addShoppingItems, deleteRecords, saveItems, useScans } from '../data/repo';
import { enqueueScan, processScanQueue, removeScan, retryScan } from '../data/scanQueue';
import type { ScanJob } from '../data/types';
import { AiRequestError, OfflineError, readPackage } from '../lib/ai';
import { emptyProduct, fromPackage, lookupBarcode, mergeProduct, rememberProduct, type ProductInfo } from '../lib/barcode';
import { useCamera } from '../lib/camera';
import { makeItem } from '../lib/convert';
import { shrinkPhoto, toImagePart } from '../lib/image';
import { detectCodes, isValidGtin, prepareScanner } from '../lib/scanner';
import { useObjectUrls } from '../hooks';
import { go, href } from '../router';
import { shortDate } from '../shared/dates';
import { formatQty } from '../shared/units';
import { plural } from './Fridge';
import { ProductCard, type CardError, type CardResult } from './ProductCard';
import { VoiceScanner } from './VoiceScanner';

type Mode = 'barcode' | 'package' | 'shelf' | 'receipt' | 'voice';

const MODES: { value: Mode; label: string }[] = [
  { value: 'barcode', label: 'Штрихкод' },
  { value: 'package', label: 'Упаковка' },
  { value: 'shelf', label: 'Полки' },
  { value: 'receipt', label: 'Чек' },
  { value: 'voice', label: 'Голос' },
];

const MAX_SHOTS: Partial<Record<Mode, number>> = { package: 3, shelf: 6, receipt: 4 };

const HINTS: Record<Mode, string> = {
  barcode: 'Наведите на штрихкод — он прочитается сам',
  package: 'Снимите упаковку этикеткой к камере, затем сторону с датой',
  shelf: 'Одна полка — один снимок',
  receipt: 'Чек целиком, длинный — в 2–3 снимка',
  voice: '',
};

type Flow =
  | { step: 'scan' }
  | { step: 'lookup'; code: string; message: string }
  | { step: 'card'; product: ProductInfo; photo: Blob | null; reading: boolean; error: CardError | null; note: string | null }
  | { step: 'capture'; product: ProductInfo; photo: Blob | null; what: 'package' | 'date'; note: string | null; fromCard: boolean };

/** Что добавлено за этот заход — чтобы видеть итог и отменить ошибку */
interface Added {
  key: string;
  name: string;
  detail: string;
  to: 'fridge' | 'shopping';
  itemId?: string;
}

const MODE_KEY = 'holodilnik:scan-mode';
const STREAM_KEY = 'holodilnik:stream-scan';

function playScanBeep(success = true) {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (success) {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.11);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.13);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.14);
    } else {
      osc.type = 'square';
      osc.frequency.setValueAtTime(260, ctx.currentTime);
      osc.frequency.setValueAtTime(220, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.14, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.24);
    }
  } catch {
    /* аудио может быть заблокировано до жеста пользователя */
  }
}

function cardError(e: unknown): CardError {
  if (e instanceof OfflineError) return { message: 'Нет интернета — упаковку прочитать не получится. Заполните карточку вручную или повторите позже.' };
  if (e instanceof AiRequestError && e.status === 401) {
    return { message: 'Нейросеть не приняла код доступа. Введите код в настройках — он совпадает с тем, что задан на сервере.', settings: true };
  }
  if (e instanceof AiRequestError && e.status === 429) return { message: 'Бесплатный лимит нейросети на сегодня закончился. Заполните карточку вручную — завтра всё заработает.' };
  return { message: e instanceof Error ? e.message : 'Не получилось прочитать упаковку.' };
}

export function Scan() {
  const online = useOnline();
  const today = useToday();
  const scans = useScans();
  const [mode, setModeState] = useState<Mode>(() => {
    try { return (localStorage.getItem(MODE_KEY) as Mode) || 'barcode'; } catch { return 'barcode'; }
  });
  const [streamMode, setStreamModeState] = useState<boolean>(() => {
    try { return localStorage.getItem(STREAM_KEY) === '1'; } catch { return false; }
  });
  const [streamToast, setStreamToast] = useState<{ item?: Added; unknownCode?: string; message: string } | null>(null);
  const lastScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  function setStreamMode(val: boolean | ((prev: boolean) => boolean)) {
    setStreamModeState((prev) => {
      const next = typeof val === 'function' ? val(prev) : val;
      try { localStorage.setItem(STREAM_KEY, next ? '1' : '0'); } catch { /* приватный режим */ }
      return next;
    });
  }

  const [flow, setFlow] = useState<Flow>({ step: 'scan' });
  const [shots, setShots] = useState<Blob[]>([]);
  const [session, setSession] = useState<Added[]>([]);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [slowHint, setSlowHint] = useState(false);
  const [flash, setFlash] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [jobsOpen, setJobsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const cam = useCamera(mode !== 'voice');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shotUrls = useObjectUrls(shots);

  const pending = (scans ?? []).filter((s) => s.status !== 'applied');
  const ready = pending.filter((s) => s.status === 'ready').length;

  function setMode(m: Mode) {
    setModeState(m);
    setShots([]);
    setFlow({ step: 'scan' });
    try { localStorage.setItem(MODE_KEY, m); } catch { /* приватный режим */ }
  }

  useEffect(() => { void prepareScanner().catch(() => {}); }, []);

  // Штрихкоды мелкие: на iPhone с широкоугольной камерой помогает небольшое приближение
  const { zoomRange, setZoom } = cam;
  useEffect(() => {
    if (!zoomRange) return;
    const wanted = mode === 'barcode' && flow.step !== 'capture' ? Math.min(zoomRange.max, Math.max(zoomRange.min, 1.6)) : zoomRange.min;
    setZoom(wanted);
  }, [mode, flow.step, zoomRange, setZoom]);

  useEffect(() => {
    if (!streamToast) return;
    const t = setTimeout(() => setStreamToast(null), 4000);
    return () => clearTimeout(t);
  }, [streamToast]);

  async function handleStreamBarcode(code: string) {
    setFlash(true);
    setTimeout(() => setFlash(false), 180);

    const { product } = await lookupBarcode(code);
    if (product) {
      playScanBeep(true);
      navigator.vibrate?.([50, 40, 50]);

      const item = makeItem({
        name: product.name,
        productKey: product.productKey,
        category: product.category,
        qty: product.qty || 1,
        unit: product.unit || 'pcs',
        location: product.location || 'fridge',
        packageDate: product.expiresAt,
        purchasedAt: today,
        source: 'barcode',
        nutriments: product.nutriments ?? undefined,
      });

      await saveItems([item]);
      await rememberProduct(product);

      const detail = [
        formatQty(item.qty, item.unit),
        item.expiresAt ? `${item.isEstimate ? '~' : 'до '}${shortDate(item.expiresAt)}` : null,
      ].filter(Boolean).join(' · ');

      const added: Added = { key: item.id, name: item.name, detail, to: 'fridge', itemId: item.id };
      setSession((s) => [added, ...s]);
      setStreamToast({
        item: added,
        message: `В холодильнике: ${item.name}`,
      });
    } else {
      playScanBeep(false);
      navigator.vibrate?.([80, 50, 80]);
      setStreamToast({
        unknownCode: code,
        message: `Штрихкод ${code} не найден в базе`,
      });
    }
  }

  // Непрерывный поиск штрихкода в центральной полосе кадра
  const { grabBand, status, capture } = cam;
  useEffect(() => {
    if (mode !== 'barcode' || flow.step !== 'scan' || status !== 'live') return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const startedAt = Date.now();
    setSlowHint(false);
    const canvas = (canvasRef.current ??= document.createElement('canvas'));
    const tick = async () => {
      if (stopped) return;
      try {
        if (grabBand(canvas)) {
          const codes = await detectCodes(canvas);
          if (stopped) return;
          if (codes.length) {
            const code = codes[0].value;
            const now = Date.now();
            if (code === lastScanRef.current.code && now - lastScanRef.current.time < 2500) {
              timer = setTimeout(tick, 120);
              return;
            }

            if (streamMode) {
              lastScanRef.current = { code, time: now };
              await handleStreamBarcode(code);
              timer = setTimeout(tick, 450);
              return;
            }

            // Одиночный режим: снимок и открытие карточки
            const frame = await capture(1600).catch(() => null);
            if (stopped) return;
            void openCode(code, frame);
            return;
          }
        }
      } catch { /* кадр не прочитался — пробуем следующий */ }
      if (Date.now() - startedAt > 9000) setSlowHint(true);
      timer = setTimeout(tick, 110);
    };
    timer = setTimeout(tick, 250);
    return () => { stopped = true; clearTimeout(timer); };
  }, [mode, flow.step, status, grabBand, capture, streamMode]); // eslint-disable-line react-hooks/exhaustive-deps

  async function openCode(code: string, photo: Blob | null) {
    playScanBeep(true);
    navigator.vibrate?.(40);
    setFlash(true);
    setTimeout(() => setFlash(false), 220);
    setFlow({ step: 'lookup', code, message: `Ищу товар ${code}…` });
    const { product, note } = await lookupBarcode(code);
    if (product) {
      setFlow({ step: 'card', product, photo, reading: false, error: null, note: null });
      return;
    }
    const base = emptyProduct(code);
    if (!navigator.onLine) {
      setFlow({ step: 'card', product: base, photo, reading: false, error: null, note });
      return;
    }
    if (photo && (await readPhotos([photo], base, photo, { note, auto: true }))) return;
    // На кадре со штрихкодом названия не видно — просим снять лицевую сторону, не выходя из камеры
    setFlow({ step: 'capture', product: base, photo, what: 'package', note, fromCard: false });
  }

  /**
   * Отправляет фото упаковки нейросети и показывает карточку товара.
   * В режиме auto (снимок со штрихкодом) возвращает false, если названия на фото не видно.
   */
  async function readPhotos(
    photos: Blob[], base: ProductInfo, cardPhoto: Blob | null,
    { note = null, auto = false }: { note?: string | null; auto?: boolean } = {},
  ): Promise<boolean> {
    if (auto) setFlow({ step: 'lookup', code: base.barcode ?? '', message: 'Товара нет в базах — читаю упаковку по снимку…' });
    else setFlow({ step: 'card', product: base, photo: cardPhoto, reading: true, error: null, note });

    let current = base;
    try {
      if (!current.barcode) {
        for (const p of photos) {
          const [code] = await detectCodes(p).catch(() => []);
          if (!code) continue;
          const { product: known } = await lookupBarcode(code.value);
          current = known ? mergeProduct(known, current) : { ...current, barcode: code.value };
          break;
        }
      }
      const pkg = await readPackage({
        task: 'package',
        today,
        images: await Promise.all(photos.map(toImagePart)),
        barcode: current.barcode,
        hint: current.name ? [current.name, current.brand].filter(Boolean).join(', ') : null,
      });
      if (!pkg.found || !pkg.name.trim()) {
        if (auto) return false;
        throw new Error('На фото не видно упаковки. Снимите товар крупнее, этикеткой к камере.');
      }
      const fromPhoto = fromPackage(pkg, current.barcode);
      const barcode = fromPhoto.barcode && isValidGtin(fromPhoto.barcode) ? fromPhoto.barcode : current.barcode;
      const merged = mergeProduct(current, { ...fromPhoto, barcode });
      setFlow({ step: 'card', product: merged, photo: cardPhoto, reading: false, error: null, note: null });
      return true;
    } catch (e) {
      setFlow({ step: 'card', product: current, photo: cardPhoto, reading: false, error: cardError(e), note });
      return true;
    }
  }

  async function handlePhoto(blob: Blob) {
    if (flow.step === 'capture') {
      const { product, photo, what, note } = flow;
      await readPhotos([blob], product, what === 'package' ? blob : photo ?? blob, { note });
      return;
    }
    if (mode === 'barcode') {
      const [code] = await detectCodes(blob).catch(() => []);
      if (code) return openCode(code.value, blob);
      if (!navigator.onLine) {
        toast('Штрихкод на фото не найден. Без интернета упаковку не прочитать — введите цифры кода.');
        return;
      }
      await readPhotos([blob], emptyProduct(null), blob);
      return;
    }
    const max = MAX_SHOTS[mode] ?? 1;
    setShots((s) => (s.length >= max ? s : [...s, blob]));
  }

  async function shoot() {
    if (busy) return;
    setBusy(true);
    try {
      const blob = await cam.capture(1600);
      if (!blob) return;
      setFlash(true);
      setTimeout(() => setFlash(false), 160);
      await handlePhoto(blob);
    } finally {
      setBusy(false);
    }
  }

  async function fromGallery(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const list = [...files].slice(0, MAX_SHOTS[mode] ?? 1);
      for (const f of list) await handlePhoto(await shrinkPhoto(f));
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function finishShots() {
    if (mode === 'package') {
      const photos = shots;
      setShots([]);
      await readPhotos(photos, emptyProduct(null), photos[0]);
      return;
    }
    if (mode !== 'shelf' && mode !== 'receipt') return;
    const id = await enqueueScan(mode, shots);
    setShots([]);
    if (navigator.onLine) go(href('review', id));
    else toast('Фото сохранены. Распознаю, когда появится интернет.');
  }

  async function toFridge(r: CardResult) {
    const p = r.product;
    const item = makeItem({
      name: p.name, productKey: p.productKey, category: p.category, qty: r.qty, unit: r.unit, location: p.location,
      packageDate: r.expiresAt, purchasedAt: today, source: p.barcode ? 'barcode' : 'photo', nutriments: p.nutriments ?? undefined,
    });
    await saveItems([item]);
    await rememberProduct({ ...p, qty: r.qty, unit: r.unit });
    const detail = [formatQty(item.qty, item.unit), item.expiresAt ? `${item.isEstimate ? '~' : 'до '}${shortDate(item.expiresAt)}` : null].filter(Boolean).join(' · ');
    setSession((s) => [{ key: item.id, name: item.name, detail, to: 'fridge', itemId: item.id }, ...s]);
    toast(`В холодильнике: ${item.name}`);
    setFlow({ step: 'scan' });
  }

  async function toShopping(r: CardResult) {
    const p = r.product;
    await addShoppingItems([{ name: p.name, productKey: p.productKey, category: p.category, qty: r.qty, unit: r.unit }]);
    await rememberProduct({ ...p, qty: r.qty, unit: r.unit });
    setSession((s) => [{ key: `shop-${Date.now()}`, name: p.name, detail: `в покупках · ${formatQty(r.qty, r.unit)}`, to: 'shopping' }, ...s]);
    toast(`В покупках: ${p.name}`);
    setFlow({ step: 'scan' });
  }

  async function undo(a: Added) {
    if (a.itemId) await deleteRecords([a.itemId]);
    setSession((s) => s.filter((x) => x.key !== a.key));
    toast(`Убрано: ${a.name}`);
  }

  function manualCard(f: Extract<Flow, { step: 'capture' }>) {
    setFlow({ step: 'card', product: f.product, photo: f.photo, reading: false, error: null, note: f.note });
  }

  const cameraMode = mode !== 'voice';
  const capturing = flow.step === 'capture';
  const collecting = !capturing && (mode === 'package' || mode === 'shelf' || mode === 'receipt');
  const max = MAX_SHOTS[mode] ?? 0;
  const reticle = capturing ? 'tall' : mode === 'barcode' ? 'wide' : mode === 'package' ? 'tall' : mode === 'receipt' ? 'receipt' : null;
  const hint = capturing
    ? null
    : mode === 'barcode'
      ? streamMode
        ? '⚡ Режим конвейера: подносите товары один за другим'
        : slowHint
          ? 'Не читается? Отодвиньте телефон на 15–20 см или нажмите кнопку съёмки — нейросеть прочитает упаковку'
          : HINTS[mode]
      : HINTS[mode];
  const inFridge = session.filter((a) => a.to === 'fridge').length;

  return (
    <div className="cam">
      {cameraMode && <video ref={cam.videoRef} className="cam-video" playsInline muted autoPlay />}
      {flash && <div className="cam-flash" />}

      <header className="cam-top">
        <a className="cam-round" href={href('fridge')} aria-label="Закрыть"><IconClose /></a>
        {mode === 'barcode' && flow.step === 'scan' && (
          <button
            type="button"
            className={`cam-pill stream-badge${streamMode ? ' hot' : ''}`}
            onClick={() => setStreamMode((m) => !m)}
            title="Конвейер: сканирование товаров подряд без пауз"
          >
            ⚡ Конвейер {streamMode ? 'ВКЛ' : 'ВЫКЛ'}
          </button>
        )}
        {session.length > 0 && (
          <button className="cam-pill hot" onClick={() => setSessionOpen(true)}>
            Добавлено {session.length} · Итог
          </button>
        )}
        <div className="grow" />
        {pending.length > 0 && (
          <button className={`cam-pill${ready ? ' hot' : ''}`} onClick={() => setJobsOpen(true)}>
            {ready ? `Проверить: ${ready}` : `Распознаётся: ${pending.length}`}
          </button>
        )}
        {cameraMode && cam.torchSupported && (
          <button className={`cam-round${cam.torchOn ? ' on' : ''}`} onClick={cam.toggleTorch} aria-label="Фонарик"><IconFlash /></button>
        )}
      </header>

      {capturing && (
        <div className="cam-guide">
          <span className="cam-guide-step">
            {flow.what === 'date' ? 'Дата на упаковке' : flow.fromCard ? 'Лицевая сторона' : 'Товара нет в базах'}
          </span>
          <b>
            {flow.what === 'date'
              ? 'Снимите крупно «годен до» или дату изготовления со сроком'
              : 'Снимите лицевую сторону упаковки'}
          </b>
          <span>
            {flow.what === 'date'
              ? 'Приложение само посчитает, до какого числа годен продукт'
              : 'Нейросеть заполнит название, вес, КБЖУ и срок. Товар запомнится — в следующий раз хватит штрихкода'}
          </span>
          {flow.product.barcode && !flow.fromCard && <span className="mono cam-guide-code">{flow.product.barcode}</span>}
        </div>
      )}

      {cameraMode && cam.status === 'live' && reticle && (
        <div className={`cam-reticle ${reticle}${flow.step === 'lookup' ? ' hit' : ''}`}>
          <i /><i /><i /><i />
          {mode === 'barcode' && !capturing && flow.step === 'scan' && <span className="cam-laser" />}
        </div>
      )}
      {cameraMode && cam.status === 'live' && flow.step === 'scan' && hint && <p className="cam-hint">{hint}</p>}

      {cameraMode && (cam.status === 'denied' || cam.status === 'unavailable' || cam.status === 'error') && (
        <div className="cam-message">
          <b>Камера не включилась</b>
          <p>{cam.error}</p>
          <div className="stack" style={{ width: '100%' }}>
            <label className="btn block file-btn">
              <IconImage /> Выбрать фото
              <input type="file" accept="image/*" multiple onChange={(e) => { void fromGallery(e.target.files); e.target.value = ''; }} />
            </label>
            {mode === 'barcode' && !capturing && <button className="btn ghost block" onClick={() => setManualOpen(true)}>Ввести цифры штрихкода</button>}
            <button className="btn quiet" onClick={cam.restart}>Попробовать снова</button>
          </div>
        </div>
      )}
      {cameraMode && cam.status === 'starting' && <div className="cam-message quiet"><Spinner /></div>}

      {mode === 'voice' && <div className="cam-panel"><VoiceScanner /></div>}

      {flow.step === 'lookup' && <div className="cam-toast"><Spinner /> {flow.message}</div>}

      {streamToast && (
        <div className={`cam-stream-toast${streamToast.unknownCode ? ' unknown' : ''}`}>
          <div className="cam-stream-msg">
            <b>{streamToast.item ? streamToast.item.name : streamToast.message}</b>
            <small>{streamToast.item ? streamToast.item.detail : 'Нажмите «Заполнить» для ввода'}</small>
          </div>
          {streamToast.item ? (
            <button
              type="button"
              className="cam-stream-action undo"
              onClick={() => {
                if (streamToast.item) void undo(streamToast.item);
                setStreamToast(null);
              }}
            >
              Отмена
            </button>
          ) : streamToast.unknownCode ? (
            <button
              type="button"
              className="cam-stream-action edit"
              onClick={() => {
                const code = streamToast.unknownCode!;
                setStreamToast(null);
                void openCode(code, null);
              }}
            >
              Заполнить
            </button>
          ) : null}
        </div>
      )}

      {flow.step !== 'card' && (
        <footer className="cam-bottom">
          {collecting && shots.length > 0 && (
            <div className="cam-tray">
              {shotUrls.map((url, i) => (
                <div key={url} className="cam-shot">
                  <img src={url} alt={`Снимок ${i + 1}`} />
                  <button aria-label="Убрать снимок" onClick={() => setShots(shots.filter((_, j) => j !== i))}><IconClose /></button>
                </div>
              ))}
              <span className="cam-count num">{shots.length}/{max}</span>
            </div>
          )}

          {cameraMode && (
            <div className="cam-controls">
              <div className="cam-side">
                {flow.step === 'capture' ? (
                  <button className="cam-text" onClick={() => (flow.fromCard ? manualCard(flow) : setFlow({ step: 'scan' }))}>
                    {flow.fromCard ? 'Назад' : 'Отмена'}
                  </button>
                ) : (
                  <label className="cam-round big" aria-label="Фото из галереи">
                    <IconImage />
                    <input type="file" accept="image/*" multiple={collecting} onChange={(e) => { void fromGallery(e.target.files); e.target.value = ''; }} />
                  </label>
                )}
              </div>
              <button
                className={`cam-shutter${busy ? ' busy' : ''}`}
                aria-label={mode === 'barcode' && !capturing ? 'Сфотографировать упаковку' : 'Сделать снимок'}
                disabled={cam.status !== 'live' || busy || flow.step === 'lookup' || (collecting && shots.length >= max)}
                onClick={shoot}
              ><span /></button>
              <div className="cam-side">
                {flow.step === 'capture' ? (
                  <button className="cam-text" onClick={() => manualCard(flow)}>Вручную</button>
                ) : collecting && shots.length > 0 ? (
                  <button className="cam-done" onClick={finishShots}>
                    {mode === 'package' ? 'Прочитать' : online ? 'Готово' : 'Сохранить'}
                  </button>
                ) : mode === 'barcode' ? (
                  <button className="cam-text" onClick={() => setManualOpen(true)} aria-label="Ввести цифры штрихкода">123</button>
                ) : null}
              </div>
            </div>
          )}

          {!capturing && (
            <nav className="cam-modes" aria-label="Режим">
              {MODES.map((m) => (
                <button key={m.value} className={m.value === mode ? 'on' : ''} onClick={() => setMode(m.value)}>{m.label}</button>
              ))}
            </nav>
          )}
        </footer>
      )}

      {flow.step === 'card' && (
        <>
          <div className="cam-scrim" />
          <ProductCard
            product={flow.product}
            photo={flow.photo}
            today={today}
            reading={flow.reading}
            readError={flow.error}
            online={online}
            note={flow.note}
            onPhoto={(what) => setFlow({ step: 'capture', product: flow.product, photo: flow.photo, what, note: flow.note, fromCard: true })}
            onCancel={() => setFlow({ step: 'scan' })}
            onFridge={toFridge}
            onShopping={toShopping}
          />
        </>
      )}

      <ManualCodeSheet open={manualOpen} onClose={() => setManualOpen(false)} onSubmit={(code) => { setManualOpen(false); void openCode(code, null); }} />

      <Sheet
        open={sessionOpen}
        onClose={() => setSessionOpen(false)}
        title={`Добавлено: ${session.length}`}
        footer={
          <div className="row-gap">
            <button className="btn ghost" onClick={() => setSessionOpen(false)}>Продолжить</button>
            <a className="btn" href={href('fridge')}>Готово</a>
          </div>
        }
      >
        <p className="small muted" style={{ marginBottom: 10 }}>
          {inFridge > 0
            ? `${inFridge} ${plural(inFridge, 'продукт уже лежит', 'продукта уже лежат', 'продуктов уже лежат')} в холодильнике. Ошиблись — уберите лишнее.`
            : 'Всё добавленное — в списке покупок.'}
        </p>
        <div className="list">
          {session.map((a) => (
            <div key={a.key} className="item-row">
              <span className="nm">
                <b>{a.name}</b>
                <small className="num">{a.detail}</small>
              </span>
              {a.to === 'fridge' && <button className="btn small quiet" onClick={() => undo(a)}>Убрать</button>}
            </div>
          ))}
        </div>
      </Sheet>

      <Sheet open={jobsOpen} onClose={() => setJobsOpen(false)} title="Распознавание фото">
        <div className="list">{pending.map((job) => <ScanRow key={job.id} job={job} online={online} />)}</div>
      </Sheet>
    </div>
  );
}

function ManualCodeSheet({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (code: string) => void }) {
  const [code, setCode] = useState('');
  const digits = code.replace(/\D/g, '');
  const valid = isValidGtin(digits);
  return (
    <Sheet open={open} onClose={onClose} title="Цифры под штрихкодом">
      <form className="stack" onSubmit={(e) => { e.preventDefault(); if (valid) { onSubmit(digits); setCode(''); } }}>
        <input className="input mono" inputMode="numeric" autoFocus placeholder="4607004891234" value={code} onChange={(e) => setCode(e.target.value)} />
        {digits.length >= 8 && !valid && <p className="small error-text">Похоже, в цифрах опечатка — проверьте код ещё раз.</p>}
        <button className="btn block" type="submit" disabled={!valid}>Найти товар</button>
      </form>
    </Sheet>
  );
}

function ScanRow({ job, online }: { job: ScanJob; online: boolean }) {
  const [thumb] = useObjectUrls(useMemo(() => job.photos.slice(0, 1), [job.photos]));
  const label = job.mode === 'receipt' ? 'Чек' : `Полки · ${job.photos.length} фото`;
  return (
    <div className="scan-job">
      {thumb ? <img className="thumb" src={thumb} alt="" /> : <span className="thumb" />}
      <div className="grow">
        <b>{label}</b>
        <div className="small muted">
          {job.status === 'queued' && (online ? 'В очереди…' : 'Ждёт интернета')}
          {job.status === 'processing' && 'Нейросеть смотрит фото…'}
          {job.status === 'ready' && `Найдено: ${job.result?.items.length ?? 0}`}
          {job.status === 'error' && <span className="error-text">{job.error}</span>}
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
