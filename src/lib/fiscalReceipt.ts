/**
 * Парсер и утилиты для фискальных кассовых чеков РФ (54-ФЗ).
 * Стандартный формат QR-кода на кассовом чеке:
 * t=20260917T1523&s=1240.50&fn=9999078900012345&i=12345&fp=1234567890&n=1
 */

export interface FiscalReceipt {
  raw: string;
  purchaseDate: string; // YYYY-MM-DD
  purchaseTime: string | null; // HH:MM
  sum: number; // рубли с копейками, например 1240.50
  fn: string; // фискальный накопитель (ФН, 16 цифр)
  fd: string; // номер фискального документа (ФД)
  fp: string; // фискальный признак документа (ФП/ФПД)
  operationType: number; // 1 = приход (покупка)
}

/**
 * Проверяет, похожа ли строка на фискальный QR-код кассового чека РФ.
 */
export function isFiscalQr(raw: string): boolean {
  const str = raw.trim();
  return (
    str.includes('fn=') &&
    (str.includes('i=') || str.includes('fd=')) &&
    (str.includes('fp=') || str.includes('fpd=')) &&
    str.includes('s=')
  );
}

/**
 * Разбирает строку QR-кода кассового чека РФ.
 */
export function parseFiscalQr(raw: string): FiscalReceipt | null {
  if (!raw) return null;
  const str = raw.trim().replace(/^\?+/, '');

  // Поддержка разделителей & или пробелов/переводов строк
  const params = new Map<string, string>();
  const pairs = str.split(/[&\s\n]+/);
  for (const pair of pairs) {
    const eq = pair.indexOf('=');
    if (eq > 0) {
      const k = pair.slice(0, eq).toLowerCase();
      const v = pair.slice(eq + 1);
      params.set(k, decodeURIComponent(v));
    }
  }

  const fn = params.get('fn') ?? '';
  const fd = params.get('i') ?? params.get('fd') ?? '';
  const fp = params.get('fp') ?? params.get('fpd') ?? '';
  const sStr = (params.get('s') ?? '').replace(',', '.');
  const tStr = params.get('t') ?? '';

  if (!fn || !fd || !fp || !sStr) return null;

  const sum = parseFloat(sStr);
  if (isNaN(sum) || sum < 0) return null;

  // Разбор даты: YYYYMMDDTHHMM или YYYYMMDDTHHMMSS или YYYY-MM-DD...
  let purchaseDate = '';
  let purchaseTime: string | null = null;

  const compactMatch = tStr.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
  if (compactMatch) {
    const [, y, m, d, h, min] = compactMatch;
    purchaseDate = `${y}-${m}-${d}`;
    purchaseTime = `${h}:${min}`;
  } else {
    const isoMatch = tStr.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}:\d{2}))?/);
    if (isoMatch) {
      purchaseDate = isoMatch[1];
      purchaseTime = isoMatch[2] ?? null;
    } else {
      // Если даты нет или формат странный — ставим сегодняшнюю
      purchaseDate = new Date().toISOString().slice(0, 10);
    }
  }

  const operationType = parseInt(params.get('n') ?? '1', 10) || 1;

  return {
    raw: str,
    purchaseDate,
    purchaseTime,
    sum: Math.round(sum * 100) / 100,
    fn,
    fd,
    fp,
    operationType,
  };
}

/**
 * Форматирует сумму в рублях (например, «1 540,80 ₽»)
 */
export function formatFiscalSum(sum: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: sum % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(sum);
}

/**
 * Форматирует дату чека на русском языке.
 */
export function formatFiscalDate(dateIso: string, time?: string | null): string {
  const parts = dateIso.split('-');
  if (parts.length !== 3) return dateIso;
  const [y, m, d] = parts;
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const monthName = months[parseInt(m, 10) - 1] || m;
  const dateStr = `${parseInt(d, 10)} ${monthName} ${y}`;
  return time ? `${dateStr}, ${time}` : dateStr;
}

/**
 * Формирует компактную подсказку для ИИ, передающую точные реквизиты чека.
 */
export function fiscalReceiptToAiHint(receipt: FiscalReceipt): string {
  const parts = [
    `Дата покупки: ${receipt.purchaseDate}${receipt.purchaseTime ? ` ${receipt.purchaseTime}` : ''}`,
    `Итоговая сумма чека: ${receipt.sum} руб.`,
    `ФН: ${receipt.fn}, ФД: ${receipt.fd}`,
  ];
  return parts.join('; ');
}
