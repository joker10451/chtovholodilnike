import {
  BarcodeFormat,
  BrowserMultiFormatReader,
  DecodeHintType,
} from '@zxing/library';
import type { Nutriments } from '../data/types';
import { estimateExpiry } from '../shared/freshness';
import { getProduct, guessProductKey, type Category, type Location } from '../shared/products';
import type { ItemUnit } from '../shared/units';

export interface ScannedProduct {
  barcode: string;
  name: string;
  brand?: string;
  productKey: string | null;
  category: Category;
  location: Location;
  qty: number;
  unit: ItemUnit;
  imageUrl?: string;
  expiresAt: string | null;
  isEstimate: boolean;
  nutriments?: Nutriments;
}

const CACHE = new Map<string, ScannedProduct>();

// Настройка ZXing для чтения всех популярных форматов штрихкодов в магазинах
const hints = new Map();
hints.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.QR_CODE,
]);
hints.set(DecodeHintType.TRY_HARDER, true);

let zxingReader: BrowserMultiFormatReader | null = null;

export function getZXingReader(): BrowserMultiFormatReader {
  if (!zxingReader) {
    zxingReader = new BrowserMultiFormatReader(hints);
  }
  return zxingReader;
}

export function hasBarcodeDetector(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window;
}

/** Проверяет, поддерживается ли сканирование штрихкодов (с ZXing поддерживается везде) */
export function isBarcodeSupported(): boolean {
  return true;
}

/** Декодирует штрихкод из видеопотока или элемента */
export async function detectBarcode(
  source: HTMLVideoElement | HTMLImageElement
): Promise<string | null> {
  if (!source) return null;

  if (source instanceof HTMLVideoElement) {
    if (source.videoWidth === 0 || source.videoHeight === 0 || source.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return null;
    }
  }

  // 1. Сначала пробуем нативный BarcodeDetector (если поддерживается браузером, например Android Chrome)
  if (hasBarcodeDetector()) {
    try {
      const Detector = (window as unknown as {
        BarcodeDetector: new (opts: { formats: string[] }) => {
          detect: (s: unknown) => Promise<Array<{ rawValue?: string }>>;
        };
      }).BarcodeDetector;
      const detector = new Detector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'],
      });
      const results = await detector.detect(source);
      if (results && results.length > 0) {
        for (const res of results) {
          const val = res.rawValue?.trim();
          if (val) return val;
        }
      }
    } catch {
      // Игнорируем и переходим к универсальному ZXing
    }
  }

  // 2. Универсальное чтение через ZXing (работает на iPhone Safari, Mac, Windows, Firefox)
  try {
    const reader = getZXingReader();
    const res = reader.decode(source);
    if (res && res.getText()) {
      return res.getText().trim();
    }
  } catch {
    // В текущем кадре штрихкод не найден — штатная ситуация при непрерывном сканировании
  }

  return null;
}

/** Декодирует штрихкод из файла/Blob (фото с камеры или галереи) */
export async function detectBarcodeFromBlob(blob: Blob): Promise<string | null> {
  // 1. Попытка нативного BarcodeDetector через createImageBitmap
  if (hasBarcodeDetector() && typeof createImageBitmap !== 'undefined') {
    try {
      const bitmap = await createImageBitmap(blob);
      const Detector = (window as unknown as {
        BarcodeDetector: new (opts: { formats: string[] }) => {
          detect: (s: unknown) => Promise<Array<{ rawValue?: string }>>;
        };
      }).BarcodeDetector;
      const detector = new Detector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'],
      });
      const results = await detector.detect(bitmap);
      bitmap.close?.();
      if (results && results.length > 0) {
        for (const res of results) {
          const val = res.rawValue?.trim();
          if (val) return val;
        }
      }
    } catch {
      // Переходим к ZXing
    }
  }

  // 2. Надёжное чтение через HTMLImageElement + ZXing с ожиданием загрузки
  return new Promise<string | null>((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const reader = getZXingReader();
        const res = reader.decode(img);
        URL.revokeObjectURL(url);
        resolve(res?.getText()?.trim() || null);
      } catch {
        URL.revokeObjectURL(url);
        resolve(null);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    img.src = url;
  });
}

/** Поиск товара по штрихкоду в базе Open Food Facts */
export async function lookupBarcode(barcode: string, todayIso: string): Promise<ScannedProduct | null> {
  const code = barcode.trim().replace(/\D/g, '');
  if (!code) return null;

  if (CACHE.has(code)) {
    return CACHE.get(code)!;
  }

  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=code,product_name,product_name_ru,brands,quantity,categories_tags,image_url,nutriments`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ChtoVHolodilnike/1.0 (Family Fridge Assistant)' },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.status === 1 && data.product) {
        const p = data.product;
        const rawName = p.product_name_ru || p.product_name || p.brands || `Товар ${code}`;
        const brand = p.brands ? p.brands.split(',')[0].trim() : undefined;
        const fullName = brand && !rawName.toLowerCase().includes(brand.toLowerCase())
          ? `${rawName} (${brand})`
          : rawName;

        const category = mapCategories(p.categories_tags);
        const productKey = guessProductKey(fullName);
        const matchedProd = getProduct(productKey);
        const location = matchedProd?.location ?? (category === 'frozen' ? 'freezer' : category === 'grains' ? 'pantry' : 'fridge');
        const { qty, unit } = parseQuantity(p.quantity);

        const { expiresAt, isEstimate } = estimateExpiry({
          productKey,
          category,
          location,
          purchasedAt: todayIso,
          openedAt: null,
          packageDate: null,
        });

        const n = p.nutriments || {};
        const rawKcal = n['energy-kcal_100g'] ?? n['energy-kcal'] ?? n['energy-kcal_value'];
        const rawProteins = n['proteins_100g'] ?? n['proteins_value'];
        const rawFat = n['fat_100g'] ?? n['fat_value'];
        const rawCarbs = n['carbohydrates_100g'] ?? n['carbohydrates_value'];

        const nutriments: Nutriments | undefined =
          rawKcal !== undefined || rawProteins !== undefined
            ? {
                kcal: rawKcal !== undefined ? Math.round(Number(rawKcal)) : undefined,
                proteins: rawProteins !== undefined ? Math.round(Number(rawProteins) * 10) / 10 : undefined,
                fat: rawFat !== undefined ? Math.round(Number(rawFat) * 10) / 10 : undefined,
                carbs: rawCarbs !== undefined ? Math.round(Number(rawCarbs) * 10) / 10 : undefined,
              }
            : undefined;

        const item: ScannedProduct = {
          barcode: code,
          name: fullName,
          brand,
          productKey,
          category,
          location,
          qty,
          unit,
          imageUrl: p.image_url,
          expiresAt,
          isEstimate,
          nutriments,
        };

        CACHE.set(code, item);
        return item;
      }
    }
  } catch {
    // Сеть недоступна
  }

  // Заглушка, если продукт не найден в Open Food Facts
  const fallbackKey = guessProductKey(code);
  const fallbackProd = getProduct(fallbackKey);
  const category = fallbackProd?.category ?? 'other';
  const location = fallbackProd?.location ?? 'fridge';
  const { expiresAt, isEstimate } = estimateExpiry({
    productKey: fallbackKey,
    category,
    location,
    purchasedAt: todayIso,
    openedAt: null,
    packageDate: null,
  });

  const fallback: ScannedProduct = {
    barcode: code,
    name: '',
    productKey: fallbackKey,
    category,
    location,
    qty: 1,
    unit: 'pcs',
    expiresAt,
    isEstimate,
  };

  return fallback;
}

export function parseQuantity(raw?: string): { qty: number; unit: ItemUnit } {
  if (!raw) return { qty: 1, unit: 'pcs' };
  const text = raw.toLowerCase().replace(',', '.').trim();

  const match = text.match(/(\d+(?:\.\d+)?)\s*(кг|kg|г|g|л|l|мл|ml|шт|pcs|уп)/);
  if (match) {
    const val = parseFloat(match[1]);
    const u = match[2];
    if (u === 'кг' || u === 'kg') return { qty: Math.round(val * 1000), unit: 'g' };
    if (u === 'г' || u === 'g') return { qty: Math.round(val), unit: 'g' };
    if (u === 'л' || u === 'l') return { qty: Math.round(val * 1000), unit: 'ml' };
    if (u === 'мл' || u === 'ml') return { qty: Math.round(val), unit: 'ml' };
    if (u === 'шт' || u === 'pcs' || u === 'уп') return { qty: Math.max(1, Math.round(val)), unit: 'pcs' };
  }

  return { qty: 1, unit: 'pcs' };
}

export function mapCategories(tags?: string[]): Category {
  if (!tags || tags.length === 0) return 'other';
  const s = tags.join(' ').toLowerCase();

  if (s.includes('dair') || s.includes('milk') || s.includes('yogurt') || s.includes('cheese') || s.includes('butter') || s.includes('cottage') || s.includes('kefir') || s.includes('sour-cream')) {
    return 'dairy';
  }
  if (s.includes('egg')) return 'eggs';
  if (s.includes('poultry') || s.includes('chicken') || s.includes('turkey')) return 'poultry';
  if (s.includes('meat') || s.includes('pork') || s.includes('beef') || s.includes('sausage') || s.includes('ham')) return 'meat';
  if (s.includes('fish') || s.includes('seafood') || s.includes('salmon') || s.includes('tuna')) return 'fish';
  if (s.includes('herb') || s.includes('green') || s.includes('parsley') || s.includes('dill')) return 'greens';
  if (s.includes('vegetable') || s.includes('tomato') || s.includes('cucumber') || s.includes('carrot') || s.includes('potato') || s.includes('salad')) {
    return 'vegetables';
  }
  if (s.includes('fruit') || s.includes('apple') || s.includes('banana') || s.includes('citrus') || s.includes('berry')) return 'fruits';
  if (s.includes('bread') || s.includes('bakery') || s.includes('toast') || s.includes('croissant')) return 'bakery';
  if (s.includes('cereal') || s.includes('grain') || s.includes('pasta') || s.includes('rice') || s.includes('flour') || s.includes('buckwheat') || s.includes('oat')) {
    return 'grains';
  }
  if (s.includes('canned') || s.includes('preserve') || s.includes('canned-foods')) return 'canned';
  if (s.includes('frozen') || s.includes('ice-cream') || s.includes('frozen-foods')) return 'frozen';
  if (s.includes('beverage') || s.includes('drink') || s.includes('juice') || s.includes('water') || s.includes('tea') || s.includes('coffee') || s.includes('soda')) {
    return 'drinks';
  }
  if (s.includes('sauce') || s.includes('condiment') || s.includes('ketchup') || s.includes('mayo') || s.includes('mustard') || s.includes('oil')) {
    return 'sauces';
  }
  if (s.includes('sweet') || s.includes('chocolate') || s.includes('candy') || s.includes('biscuit') || s.includes('cake') || s.includes('cookie')) {
    return 'sweets';
  }
  if (s.includes('nut') || s.includes('seed') || s.includes('almond') || s.includes('walnut')) return 'nuts';
  if (s.includes('spice') || s.includes('seasoning') || s.includes('pepper') || s.includes('salt')) return 'spices';

  return 'other';
}
