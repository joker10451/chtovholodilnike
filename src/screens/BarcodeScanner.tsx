import { useEffect, useRef, useState } from 'react';
import { IconCamera } from '../components/icons';
import { CATEGORY_DOT, Spinner, Stepper, toast } from '../components/ui';
import { addShoppingItems, saveItems } from '../data/repo';
import { makeItem } from '../lib/convert';
import { detectBarcode, detectBarcodeFromBlob, hasBarcodeDetector, lookupBarcode, type ScannedProduct } from '../lib/barcode';
import { todayISO } from '../shared/dates';
import { LOCATION_LABELS, LOCATIONS, type Location } from '../shared/products';
import { UNIT_LABELS, type BaseUnit } from '../shared/units';

export function BarcodeScanner() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const active = true;
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [showManual, setShowManual] = useState(false);

  // Текущий распознанный товар
  const [product, setProduct] = useState<ScannedProduct | null>(null);
  const [name, setName] = useState('');
  const [qty, setQty] = useState(1);
  const [unit, setUnit] = useState<BaseUnit>('pcs');
  const [location, setLocation] = useState<Location>('fridge');
  const [date, setDate] = useState<string>('');

  const supported = hasBarcodeDetector();

  // Запуск камеры
  useEffect(() => {
    if (!active || product) return;

    let stopped = false;
    async function startCam() {
      try {
        setCameraError(null);
        if (!navigator.mediaDevices?.getUserMedia) {
          setCameraError('Камера недоступна в этом браузере');
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (err) {
        if (!stopped) {
          setCameraError('Доступ к камере заблокирован. Разрешите камеру в настройках Safari или введите штрихкод вручную.');
        }
      }
    }

    void startCam();

    return () => {
      stopped = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [active, product]);

  // Непрерывное сканирование кадров
  useEffect(() => {
    if (!active || product || !supported) return;

    let animId: number;
    let isDetecting = false;

    async function tick() {
      if (videoRef.current && videoRef.current.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && !isDetecting) {
        isDetecting = true;
        try {
          const code = await detectBarcode(videoRef.current);
          if (code) {
            handleBarcodeFound(code);
            return; // прекращаем тик
          }
        } finally {
          isDetecting = false;
        }
      }
      animId = requestAnimationFrame(tick);
    }

    animId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animId);
  }, [active, product, supported]);

  async function handleBarcodeFound(code: string) {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(60);
      } catch {}
    }
    setBusy(true);
    try {
      const p = await lookupBarcode(code, todayISO());
      if (p) {
        setProduct(p);
        setName(p.name || `Товар ${p.barcode}`);
        setQty(p.qty || 1);
        setUnit(p.unit as BaseUnit);
        setLocation(p.location || 'fridge');
        setDate(p.expiresAt || '');
      } else {
        toast(`Штрихкод ${code} не найден`);
      }
    } catch {
      toast('Не удалось загрузить данные о товаре');
    } finally {
      setBusy(false);
    }
  }

  // Сканирование по загруженному фото
  async function handlePhotoFile(file: File) {
    setBusy(true);
    try {
      const code = await detectBarcodeFromBlob(file);
      if (code) {
        await handleBarcodeFound(code);
      } else {
        toast('На фото не удалось различить штрихкод');
      }
    } catch {
      toast('Ошибка обработки фото');
    } finally {
      setBusy(false);
    }
  }

  // Ручной ввод
  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manualCode.trim()) return;
    await handleBarcodeFound(manualCode.trim());
    setManualCode('');
  }

  // Добавление в холодильник
  async function addToFridge() {
    if (!name.trim()) return;
    const item = makeItem({
      name: name.trim(),
      productKey: product?.productKey || null,
      qty,
      unit,
      location,
      packageDate: date || null,
      purchasedAt: todayISO(),
      opened: false,
      source: 'barcode',
    });
    await saveItems([item]);
    toast(`Добавлено: ${item.name}`);
    setProduct(null); // возобновляем сканер
  }

  // Добавление в покупки
  async function addToShopping() {
    if (!name.trim()) return;
    await addShoppingItems([
      {
        name: name.trim(),
        productKey: product?.productKey || null,
        category: product?.category || 'other',
        qty,
        unit,
      },
    ]);
    toast(`В покупках: ${name.trim()}`);
    setProduct(null); // возобновляем сканер
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      {busy && (
        <div className="card flat row-gap" style={{ justifyContent: 'center', padding: 14 }}>
          <Spinner /> <span>Ищу товар в базе продуктов…</span>
        </div>
      )}

      {/* Окно сканера */}
      {!product && (
        <>
          <div className="barcode-box">
            {cameraError ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#fff', fontSize: 13 }}>
                {cameraError}
              </div>
            ) : (
              <>
                <video ref={videoRef} className="barcode-video" autoPlay playsInline muted />
                <div className="barcode-reticle">
                  <div className="barcode-laser" />
                </div>
              </>
            )}
          </div>

          <div style={{ textAlign: 'center' }}>
            <p className="small muted" style={{ margin: 0 }}>
              Наведите штрихкод на рамку. Камера считает его за доли секунды.
            </p>
          </div>

          {/* Альтернативные способы: фото или ручной ввод */}
          <div className="row-gap" style={{ justifyContent: 'center' }}>
            <label className="btn small ghost" style={{ position: 'relative' }}>
              <IconCamera width={16} height={16} /> Снять фото штрихкода
              <input
                type="file"
                accept="image/*"
                capture="environment"
                style={{ position: 'absolute', inset: 0, opacity: 0 }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handlePhotoFile(f);
                  e.target.value = '';
                }}
              />
            </label>

            <button
              type="button"
              className="btn small quiet"
              onClick={() => setShowManual((v) => !v)}
            >
              {showManual ? 'Скрыть ввод' : 'Ввести цифры'}
            </button>
          </div>

          {showManual && (
            <form onSubmit={handleManualSubmit} className="row-gap" style={{ marginTop: 6 }}>
              <input
                className="input"
                style={{ flex: 1 }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="4810268031793"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
              />
              <button type="submit" className="btn primary" disabled={!manualCode.trim()}>
                Найти
              </button>
            </form>
          )}
        </>
      )}

      {/* Карточка найденного продукта */}
      {product && (
        <div className="barcode-card">
          <div className="barcode-card-header">
            {product.imageUrl ? (
              <img className="barcode-img" src={product.imageUrl} alt={name} />
            ) : (
              <span
                className="barcode-img"
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  background: CATEGORY_DOT[product.category] || 'var(--line)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 20,
                }}
              >
                {name[0]?.toUpperCase() || '📦'}
              </span>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="small muted">Штрихкод: {product.barcode}</div>
              <input
                className="input"
                style={{ fontWeight: 700, fontSize: 16, marginTop: 4, width: '100%' }}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Название товара"
              />
            </div>
          </div>

          <div className="field-row">
            <label className="field">
              <span>Количество</span>
              <Stepper
                label="Количество"
                value={qty}
                step={unit === 'g' || unit === 'ml' ? 50 : 1}
                onChange={setQty}
              />
            </label>
            <label className="field">
              <span>Единицы</span>
              <select
                className="select"
                value={unit}
                onChange={(e) => setUnit(e.target.value as BaseUnit)}
              >
                {(['pcs', 'g', 'ml'] as BaseUnit[]).map((u) => (
                  <option key={u} value={u}>
                    {UNIT_LABELS[u]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="field">
            <span>Куда положить</span>
            <div className="wrap-gap">
              {LOCATIONS.map((loc: Location) => (
                <button
                  key={loc}
                  type="button"
                  className={`chip${location === loc ? ' on' : ''}`}
                  onClick={() => setLocation(loc)}
                >
                  {LOCATION_LABELS[loc]}
                </button>
              ))}
            </div>
          </div>

          <label className="field">
            <span>Срок годности</span>
            <input
              className="input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>

          <div className="sheet-footer" style={{ borderTop: 'none', padding: 0 }}>
            <button
              type="button"
              className="btn quiet"
              style={{ flex: 1 }}
              onClick={() => setProduct(null)}
            >
              Пропустить
            </button>
            <button
              type="button"
              className="btn ghost"
              style={{ flex: 1.2 }}
              onClick={addToShopping}
            >
              В покупки
            </button>
            <button
              type="button"
              className="btn primary"
              style={{ flex: 2 }}
              onClick={addToFridge}
            >
              В холодильник
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
