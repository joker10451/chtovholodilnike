import { describe, expect, it } from 'vitest';
import { expiryDigest, localDate } from './expiryDigest';

describe('утреннее уведомление о сроках', () => {
  const today = '2026-09-14';
  const tomorrow = '2026-09-15';

  it('ничего не истекает — не беспокоим', () => {
    expect(expiryDigest([{ name: 'Сыр', expiresAt: '2026-09-30' }], today, tomorrow)).toBeNull();
  });

  it('один продукт сегодня и два завтра', () => {
    const d = expiryDigest([
      { name: 'Кефир', expiresAt: today },
      { name: 'Курица', expiresAt: tomorrow },
      { name: 'Сметана', expiresAt: tomorrow },
    ], today, tomorrow)!;
    expect(d.title).toBe('Сегодня последний день: кефир');
    expect(d.body).toBe('Завтра — курица, сметана. Посмотрите, что из этого приготовить.');
    expect(d.url).toBe('/#/recipes?shelf=rescue');
  });

  it('много продуктов сворачиваются в «и ещё»', () => {
    const d = expiryDigest(['Молоко', 'Творог', 'Йогурт', 'Салат', 'Укроп'].map((name) => ({ name, expiresAt: today })), today, tomorrow)!;
    expect(d.title).toBe('Сегодня истекает: молоко, творог, йогурт и ещё 2');
  });

  it('только завтра', () => {
    expect(expiryDigest([{ name: 'Фарш', expiresAt: tomorrow }], today, tomorrow)!.title).toBe('Завтра истекает: фарш');
  });

  it('дата считается в часовом поясе семьи', () => {
    const lateUtc = new Date('2026-09-13T22:30:00Z'); // в Москве уже 14 сентября
    expect(localDate(lateUtc, 'Europe/Moscow')).toBe('2026-09-14');
    expect(localDate(lateUtc, 'Europe/Moscow', 1)).toBe('2026-09-15');
    expect(localDate(lateUtc, 'UTC')).toBe('2026-09-13');
  });
});
