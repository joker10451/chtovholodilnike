import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { IconCamera } from '../components/icons';
import { CATEGORY_DOT, Spinner, Stepper, toast } from '../components/ui';
import { addShoppingItems, saveItems } from '../data/repo';
import { recognize } from '../lib/ai';
import { lookupBarcode, type ScannedProduct } from '../lib/barcode';
import { makeItem } from '../lib/convert';
import { shrinkPhoto, toImagePart } from '../lib/image';
import { todayISO } from '../shared/dates';
import { getProduct, guessProductKey, LOCATION_LABELS, LOCATIONS, type Location } from '../shared/products';
import { UNIT_LABELS, type BaseUnit } from '../shared/units';

const FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.QR_CODE,
];

export function BarcodeScanner() {
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

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isHandlingRef = useRef(false);

  // Запуск камеры со сканером Html5Qrcode
  useEffect(() => {
    if (product) return;

    let mounted = true;
    const elementId = 'barcode-reader-box';

    // Даём DOM обновиться
    const timer = setTimeout(() => {
      if (!mounted) return;
      const el = document.getElementById(elementId);
      if (!el) return;

      try {
        const qr = new Html5Qrcode(elementId, {
          formatsToSupport: FORMATS,
          verbose: false,
        });
        scannerRef.current = qr;
        isHandlingRef.current = false;

        qr.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: (w) => {
              const width = Math.min(w * 0.88, 300);
              const height = Math.min(width * 0.65, 180);
              return { width: Math.round(width), height: Math.round(height) };
            },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (isHandlingRef.current) return;
            isHandlingRef.current = true;
            void handleBarcodeFound(decodedText);
          },
          () => {
            // Кадр без штрихкода (штатный пропуск)
          }
        ).catch((err) => {
          if (!mounted) return;
          console.warn('Camera start error:', err);
          setCameraError('Камера недоступна или доступ заблокирован. Разрешите камеру в настройках Safari или введите цифры вручную.');
        });
      } catch (err) {
        if (!mounted) return;
        setCameraError('Ошибка инициализации сканера');
      }
    }, 100);

    return () => {
      mounted = false;
      clearTimeout(timer);
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(() => {});
          }
        } catch {}
        scannerRef.current = null;
      }
    };
  }, [product]);

  async function handleBarcodeFound(code: string) {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(60);
      } catch {}
    }
    setBusy(true);

    // Останавливаем сканер пока показываем карточку
    if (scannerRef.current?.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch {}
    }

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
        setProduct({
          barcode: code,
          name: '',
          productKey: null,
          category: 'other',
          location: 'fridge',
          qty: 1,
          unit: 'pcs',
          expiresAt: null,
          isEstimate: false,
        });
        setName('');
        setQty(1);
        setUnit('pcs');
        setLocation('fridge');
        toast(`Штрихкод ${code} считан. Введите название.`);
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
    const tempId = 'barcode-file-temp';
    try {
      // 1. Сначала пробуем распознать штрихкод из файла через Html5Qrcode
      let decodedText: string | null = null;
      try {
        const fileScanner = new Html5Qrcode(tempId, {
          formatsToSupport: FORMATS,
          verbose: false,
        });
        decodedText = await fileScanner.scanFile(file, true);
        fileScanner.clear();
      } catch {
        // не нашёл штрихкод
      }

      if (decodedText) {
        await handleBarcodeFound(decodedText);
        return;
      }

      // 2. Если полосы штрихкода не распознались, запускаем нейросеть по фото упаковки
      try {
        const shrunk = await shrinkPhoto(file);
        const imagePart = await toImagePart(shrunk);
        const res = await recognize({ task: 'shelf', today: todayISO(), images: [imagePart] });
        if (res.items && res.items.length > 0) {
          const first = res.items[0];
          const productKey = first.product_key || guessProductKey(first.name);
          const matched = getProduct(productKey);
          setProduct({
            barcode: 'фото',
            name: first.name,
            productKey,
            category: first.category || matched?.category || 'other',
            location: first.location || matched?.location || 'fridge',
            qty: first.qty || 1,
            unit: (first.unit as BaseUnit) || 'pcs',
            expiresAt: first.expires_at || null,
            isEstimate: !first.expires_at,
          });
          setName(first.name);
          setQty(first.qty || 1);
          setUnit((first.unit as BaseUnit) || 'pcs');
          setLocation(first.location || matched?.location || 'fridge');
          setDate(first.expires_at || '');
          toast(`Распознан: ${first.name}`);
          return;
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.message) {
          toast(err.message);
          return;
        }
      }

      toast('Не удалось распознать штрихкод. Поднесите ближе или введите вручную.');
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
      nutriments: product?.nutriments,
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
      <div id="barcode-file-temp" style={{ display: 'none' }} />

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
              <div id="barcode-reader-box" style={{ width: '100%', height: '100%' }} />
            )}
          </div>

          <div style={{ textAlign: 'center' }}>
            <p className="small muted" style={{ margin: 0 }}>
              Наведите полосы штрихкода в прямоугольник. Сканирование сработает мгновенно.
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

          {product.nutriments && (
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
                  {product.nutriments.kcal ?? '—'}
                </b>
                <span className="muted" style={{ fontSize: 10 }}>ккал/100г</span>
              </div>
              <div>
                <b style={{ display: 'block', fontSize: 13 }}>
                  {product.nutriments.proteins ?? '—'}г
                </b>
                <span className="muted" style={{ fontSize: 10 }}>Белки</span>
              </div>
              <div>
                <b style={{ display: 'block', fontSize: 13 }}>
                  {product.nutriments.fat ?? '—'}г
                </b>
                <span className="muted" style={{ fontSize: 10 }}>Жиры</span>
              </div>
              <div>
                <b style={{ display: 'block', fontSize: 13 }}>
                  {product.nutriments.carbs ?? '—'}г
                </b>
                <span className="muted" style={{ fontSize: 10 }}>Углеводы</span>
              </div>
            </div>
          )}

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
