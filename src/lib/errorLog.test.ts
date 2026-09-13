import { describe, expect, it } from 'vitest';
import { LogBatchSchema } from '../../server/log';
import { describeDevice, isNoise, trimStack } from './errorLog';

describe('журнал ошибок', () => {
  it('понятно описывает телефон', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
    expect(describeDevice(ua, true)).toBe('iPhone iOS 17.5 · с экрана «Домой»');
    expect(describeDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', false)).toBe('Windows · в браузере');
  });

  it('не засоряется сетевыми сбоями и неверным кодом', () => {
    expect(isNoise('TypeError: Load failed')).toBe(true);
    expect(isNoise('Нет связи с сервером. Проверьте интернет (и VPN).')).toBe(true);
    expect(isNoise('Неверный код доступа. Проверьте его в настройках приложения.')).toBe(true);
    expect(isNoise("Cannot read properties of undefined (reading 'qty')")).toBe(false);
  });

  it('убирает из стека адреса и параметры', () => {
    const stack = 'TypeError: x\n    at Fridge (https://chtovholodilnike.vercel.app/assets/Fridge-abc.js?v=1:12:5)';
    expect(trimStack(stack)).toBe('TypeError: x\nat Fridge (/assets/Fridge-abc.js:12:5)');
  });

  it('сервер принимает только короткие записи известного вида', () => {
    const entry = { version: '0.7.0', screen: 'fridge', kind: 'crash', message: 'Ошибка', count: 1 };
    expect(LogBatchSchema.safeParse({ entries: [entry] }).success).toBe(true);
    expect(LogBatchSchema.safeParse({ entries: [{ ...entry, kind: 'spam' }] }).success).toBe(false);
    expect(LogBatchSchema.safeParse({ entries: [{ ...entry, message: 'x'.repeat(501) }] }).success).toBe(false);
    expect(LogBatchSchema.safeParse({ entries: Array(21).fill(entry) }).success).toBe(false);
  });
});
