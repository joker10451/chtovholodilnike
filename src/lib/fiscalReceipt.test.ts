import { describe, expect, it } from 'vitest';
import {
  formatFiscalDate,
  formatFiscalSum,
  isFiscalQr,
  parseFiscalQr,
  fiscalReceiptToAiHint,
} from './fiscalReceipt';

describe('фискальные чеки РФ (54-ФЗ)', () => {
  it('распознаёт валидные QR-коды чеков РФ', () => {
    const qr1 = 't=20260917T1523&s=1240.50&fn=9999078900012345&i=12345&fp=3456789012&n=1';
    expect(isFiscalQr(qr1)).toBe(true);

    const parsed1 = parseFiscalQr(qr1);
    expect(parsed1).not.toBeNull();
    expect(parsed1?.purchaseDate).toBe('2026-09-17');
    expect(parsed1?.purchaseTime).toBe('15:23');
    expect(parsed1?.sum).toBe(1240.5);
    expect(parsed1?.fn).toBe('9999078900012345');
    expect(parsed1?.fd).toBe('12345');
    expect(parsed1?.fp).toBe('3456789012');
  });

  it('поддерживает альтернативные имена параметров fd и fpd', () => {
    const qr2 = 't=20260917T143000&s=985.00&fn=8710000100543210&fd=45678&fpd=12345678&n=1';
    expect(isFiscalQr(qr2)).toBe(true);

    const parsed2 = parseFiscalQr(qr2);
    expect(parsed2).not.toBeNull();
    expect(parsed2?.purchaseDate).toBe('2026-09-17');
    expect(parsed2?.purchaseTime).toBe('14:30');
    expect(parsed2?.sum).toBe(985);
    expect(parsed2?.fd).toBe('45678');
    expect(parsed2?.fp).toBe('12345678');
  });

  it('отсекает нефискальные строки', () => {
    expect(isFiscalQr('https://example.com')).toBe(false);
    expect(isFiscalQr('4607004891694')).toBe(false);
    expect(parseFiscalQr('something=random')).toBeNull();
  });

  it('форматирует сумму и дату на русском языке', () => {
    const formattedSum = formatFiscalSum(1240.5);
    expect(formattedSum).toContain('1');
    expect(formattedSum).toContain('240');
    expect(formattedSum).toContain('50');

    const formattedDate = formatFiscalDate('2026-09-17', '15:23');
    expect(formattedDate).toContain('17 сентября 2026, 15:23');
  });

  it('генерирует информативную подсказку для ИИ', () => {
    const parsed = parseFiscalQr('t=20260917T1523&s=1240.50&fn=9999078900012345&i=12345&fp=3456789012&n=1')!;
    const hint = fiscalReceiptToAiHint(parsed);
    expect(hint).toContain('Дата покупки: 2026-09-17 15:23');
    expect(hint).toContain('Итоговая сумма чека: 1240.5 руб.');
    expect(hint).toContain('ФН: 9999078900012345, ФД: 12345');
  });
});
