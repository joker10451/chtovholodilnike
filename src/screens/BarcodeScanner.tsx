import { useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { IconCamera } from '../components/icons';
import { CATEGORY_DOT, Spinner, Stepper, toast } from '../components/ui';
import { addShoppingItems, saveItems } from '../data/repo';
import { recognize } from '../lib/ai';
import { lookupBarcode, type ScannedProduct } from '../lib/barcode';
import { makeItem } from '../lib/convert';
import { shrinkPhoto, toImagePart } from '../lib/image';
import { addDays, daysBetween, formatDateHuman, todayISO } from '../shared/dates';
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
  const fileInputId = useId();

  const today = todayISO();

  // Запуск камеры со сканером Html5Qrcode
  useEffect(() => {
    if (product) return;

    let mounted = true;
    const elementId = 'barcode-reader-box';

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
          () => {}
        ).catch((err) => {
          if (!mounted) return;
          console.warn('Camera start error:', err);
          setCameraError(
            'Камера недоступна или доступ заблокирован. Разрешите камеру в настройках браузера или введите штрихкод вручную.'
          );
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

    if (scannerRef.current?.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch {}
    }

    try {
      const p = await lookupBarcode(code, today);
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
        setDate(addDays(today, 7)); // по умолчанию неделя срока
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
      let decodedText: string | null = null;
      try {
        const fileScanner = new Html5Qrcode(tempId, {
          formatsToSupport: FORMATS,
          verbose: false,
        });
        decodedText = await fileScanner.scanFile(file, true);
        fileScanner.clear();
      } catch {}

      if (decodedText) {
        await handleBarcodeFound(decodedText);
        return;
      }

      // Если штрихкод не считался полосками — пробуем распознать упаковку через AI
      try {
        const shrunk = await shrinkPhoto(file);
        const imagePart = await toImagePart(shrunk);
        const res = await recognize({ task: 'shelf', today, images: [imagePart] });
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
          setDate(first.expires_at || addDays(today, 7));
          toast(`Распознан: ${first.name}`);
          return;
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.message) {
          toast(err.message);
          return;
        }
      }

      toast('Штрихкод на фото не найден. Попробуйте направить камеру точнее или введите цифры.');
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
      purchasedAt: today,
      opened: false,
      source: 'barcode',
      nutriments: product?.nutriments,
    });
    await saveItems([item]);
    toast(`Добавлено в ${LOCATION_LABELS[location].toLowerCase()}: ${item.name}`);
    setProduct(null);
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
    setProduct(null);
  }

  // Текст подсказки по сроку
  const dateDiff = date ? daysBetween(today, date) : null;
  const expiryNote =
    dateDiff !== null
      ? dateDiff < 0
        ? `Истёк ${Math.abs(dateDiff)} дн. назад`
        : dateDiff === 0
        ? 'Срок истекает сегодня'
        : `Испортится через ${dateDiff} дн. (${formatDateHuman(date)})`
      : 'Без срока (посчитается по типу продукта)';

  return (
    <div className="scanner-page">
      <div id="barcode-file-temp" style={{ display: 'none' }} />

      {busy && (
        <div className="scanner-loading-badge">
          <Spinner /> <span>Загрузка данных о товаре…</span>
        </div>
      )}

      {/* Окно сканера */}
      {!product && (
        <div className="scanner-viewfinder-wrap">
          <div className="barcode-box">
            {cameraError ? (
              <div className="camera-error-view">
                <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Доступ к камере закрыт</div>
                <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.4 }}>
                  {cameraError}
                </div>
              </div>
            ) : (
              <>
                <div id="barcode-reader-box" className="barcode-reader-box" />
                {/* Рамка видоискателя с уголками и бегущим лазером */}
                <div className="barcode-hud-overlay">
                  <div className="barcode-hud-reticle">
                    <span className="hud-corner top-left" />
                    <span className="hud-corner top-right" />
                    <span className="hud-corner bottom-left" />
                    <span className="hud-corner bottom-right" />
                    <div className="barcode-hud-laser" />
                  </div>
                </div>
                <div className="barcode-hud-tip">
                  <span>🎯 Наведите камеру на полосы штрихкода</span>
                </div>
              </>
            )}
          </div>

          {/* Панель альтернативных действий */}
          <div className="scanner-toolbar">
            <label htmlFor={fileInputId} className="scanner-tool-btn">
              <IconCamera width={18} height={18} />
              <span>Снять / Фото</span>
              <input
                id={fileInputId}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handlePhotoFile(f);
                  e.target.value = '';
                }}
              />
            </label>

            <button
              type="button"
              className={`scanner-tool-btn${showManual ? ' active' : ''}`}
              onClick={() => setShowManual((v) => !v)}
            >
              <span>⌨️ Цифры вручную</span>
            </button>
          </div>

          {showManual && (
            <form onSubmit={handleManualSubmit} className="scanner-manual-form">
              <input
                className="input"
                style={{ flex: 1, fontSize: 15 }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="4607004891234"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                autoFocus
              />
              <button type="submit" className="btn primary" disabled={!manualCode.trim()}>
                Найти
              </button>
            </form>
          )}
        </div>
      )}

      {/* Карточка найденного продукта */}
      {product && (
        <div className="barcode-card-modern">
          <div className="product-summary-row">
            {product.imageUrl ? (
              <img className="product-avatar-img" src={product.imageUrl} alt={name} />
            ) : (
              <div
                className="product-avatar-placeholder"
                style={{ background: CATEGORY_DOT[product.category] || 'var(--brand)' }}
              >
                {product.category === 'dairy' ? '🥛' :
                 product.category === 'meat' || product.category === 'poultry' ? '🥩' :
                 product.category === 'fish' ? '🐟' :
                 product.category === 'vegetables' ? '🥦' :
                 product.category === 'fruits' ? '🍎' :
                 product.category === 'drinks' ? '🧃' :
                 product.category === 'bakery' ? '🍞' : '📦'}
              </div>
            )}
            <div className="product-header-info">
              <div className="product-badge-row">
                <span className="product-verified-badge">
                  {product.barcode === 'фото' ? 'Распознано по фото' : `Штрихкод ${product.barcode}`}
                </span>
              </div>
              <input
                className="product-name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Название продукта"
              />
            </div>
          </div>

          {/* КБЖУ бейджи */}
          {product.nutriments && (
            <div className="product-kbju-grid">
              <div className="kbju-cell kcal">
                <span className="kbju-value">{product.nutriments.kcal ?? '—'}</span>
                <span className="kbju-sub">ккал / 100г</span>
              </div>
              <div className="kbju-cell">
                <span className="kbju-value">{product.nutriments.proteins ?? '—'}г</span>
                <span className="kbju-sub">Белки</span>
              </div>
              <div className="kbju-cell">
                <span className="kbju-value">{product.nutriments.fat ?? '—'}г</span>
                <span className="kbju-sub">Жиры</span>
              </div>
              <div className="kbju-cell">
                <span className="kbju-value">{product.nutriments.carbs ?? '—'}г</span>
                <span className="kbju-sub">Углеводы</span>
              </div>
            </div>
          )}

          {/* Срок окончания (Годен до) */}
          <div className="form-section-card">
            <div className="form-section-title-row">
              <span className="form-section-title">Годен до (дата окончания)</span>
              <span className="form-section-desc">{expiryNote}</span>
            </div>

            <div className="quick-expiry-chips">
              {[
                { label: '+3 дня', days: 3 },
                { label: '+5 дней', days: 5 },
                { label: '+7 дней', days: 7 },
                { label: '+14 дней', days: 14 },
                { label: '+30 дней', days: 30 },
              ].map((chip) => {
                const target = addDays(today, chip.days);
                const isSelected = date === target;
                return (
                  <button
                    key={chip.days}
                    type="button"
                    className={`quick-chip${isSelected ? ' active' : ''}`}
                    onClick={() => setDate(target)}
                  >
                    {chip.label}
                  </button>
                );
              })}
              <button
                type="button"
                className={`quick-chip${!date ? ' active' : ''}`}
                onClick={() => setDate('')}
              >
                Без даты
              </button>
            </div>

            <input
              className="input date-picker-input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Место хранения */}
          <div className="form-section-card">
            <span className="form-section-title">Где хранить</span>
            <div className="location-pills-row">
              {LOCATIONS.map((loc: Location) => (
                <button
                  key={loc}
                  type="button"
                  className={`location-pill${location === loc ? ' active' : ''}`}
                  onClick={() => setLocation(loc)}
                >
                  <span className="loc-emoji">
                    {loc === 'fridge' ? '❄️' : loc === 'freezer' ? '🧊' : '🥫'}
                  </span>
                  <span>{LOCATION_LABELS[loc]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Количество и единицы */}
          <div className="form-section-card">
            <div className="field-row" style={{ alignItems: 'flex-end', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <span className="form-section-title" style={{ marginBottom: 6, display: 'block' }}>
                  Количество
                </span>
                <Stepper
                  label="Количество"
                  value={qty}
                  step={unit === 'g' || unit === 'ml' ? 50 : 1}
                  onChange={setQty}
                />
              </div>
              <div style={{ width: 110 }}>
                <span className="form-section-title" style={{ marginBottom: 6, display: 'block' }}>
                  Единицы
                </span>
                <select
                  className="select"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as BaseUnit)}
                  style={{ width: '100%', height: 44 }}
                >
                  {(['pcs', 'g', 'ml'] as BaseUnit[]).map((u) => (
                    <option key={u} value={u}>
                      {UNIT_LABELS[u]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Кнопки действий */}
          <div className="product-actions-footer">
            <button
              type="button"
              className="btn quiet"
              style={{ flex: 1, minHeight: 48 }}
              onClick={() => setProduct(null)}
            >
              Отмена
            </button>
            <button
              type="button"
              className="btn ghost"
              style={{ flex: 1.2, minHeight: 48 }}
              onClick={addToShopping}
            >
              В покупки 🛒
            </button>
            <button
              type="button"
              className="btn primary"
              style={{ flex: 2, minHeight: 48, fontWeight: 700, fontSize: 16 }}
              onClick={addToFridge}
            >
              В холодильник ✓
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
