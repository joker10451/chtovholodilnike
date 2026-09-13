// Распознавание штрихкодов на телефоне: ZXing-C++, собранный в WebAssembly.
// Работает в Safari на iPhone (там нет встроенного BarcodeDetector) и без интернета:
// .wasm-файл лежит в самом приложении, а не на CDN.
import { BarcodeDetector, prepareZXingModule, type BarcodeFormat } from 'barcode-detector/ponyfill';
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';

/** Форматы, которые печатают на продуктах */
const FORMATS: BarcodeFormat[] = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'itf', 'qr_code', 'data_matrix'];

let detector: BarcodeDetector | null = null;
let ready: Promise<void> | null = null;

/** Загружает декодер заранее, чтобы первый кадр распознавался без задержки */
export function prepareScanner(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await prepareZXingModule({
        overrides: {
          locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path),
        },
        fireImmediately: true,
      });
      detector = new BarcodeDetector({ formats: FORMATS });
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

export interface DetectedCode {
  value: string;
  format: string;
}

/**
 * Товарный код из «Честного знака» (DataMatrix) начинается с 01 + GTIN-14.
 * Из него достаём обычный штрихкод EAN-13, по которому ищется товар.
 */
export function normalizeCode(raw: string, format: string): string | null {
  const value = raw.trim();
  if (format === 'data_matrix' || format === 'qr_code') {
    const gs1 = value.replace(//g, '').match(/^01(\d{14})/);
    if (gs1) return gs1[1].replace(/^0/, '');
    return /^\d{8,14}$/.test(value) ? value : null;
  }
  const digits = value.replace(/\D/g, '');
  if (format === 'ean_13' || format === 'ean_8' || format === 'upc_a' || format === 'upc_e') {
    return isValidGtin(digits) ? digits : null;
  }
  return digits.length >= 8 && digits.length <= 14 ? digits : null;
}

/** Проверка контрольной цифры EAN/UPC — отсекает ошибочно прочитанные коды */
export function isValidGtin(code: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

export async function detectCodes(source: CanvasImageSource | Blob | ImageData): Promise<DetectedCode[]> {
  await prepareScanner();
  const found = await detector!.detect(source as ImageBitmapSource);
  const out: DetectedCode[] = [];
  for (const b of found) {
    const value = normalizeCode(b.rawValue, b.format);
    if (value && !out.some((o) => o.value === value)) out.push({ value, format: b.format });
  }
  return out;
}
