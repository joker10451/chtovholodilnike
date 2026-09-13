import { describe, expect, it } from 'vitest';
import { SubscribeSchema } from './push';

const base = { keys: { p256dh: 'k', auth: 'a' }, items: [{ name: 'Кефир', expiresAt: '2026-09-14' }] };

describe('подписка на уведомления', () => {
  it('принимает адреса push-сервисов Apple и Google', () => {
    expect(SubscribeSchema.safeParse({ ...base, endpoint: 'https://web.push.apple.com/QGxyz' }).success).toBe(true);
    expect(SubscribeSchema.safeParse({ ...base, endpoint: 'https://fcm.googleapis.com/fcm/send/abc' }).success).toBe(true);
  });

  it('не принимает чужие адреса — сервер не будет слать запросы куда попало', () => {
    for (const endpoint of ['https://evil.example/push', 'http://web.push.apple.com/x', 'https://web.push.apple.com.evil.example/x', 'не адрес']) {
      expect(SubscribeSchema.safeParse({ ...base, endpoint }).success, endpoint).toBe(false);
    }
  });

  it('по умолчанию московское время, даты только в формате ГГГГ-ММ-ДД', () => {
    const ok = SubscribeSchema.parse({ ...base, endpoint: 'https://web.push.apple.com/x' });
    expect(ok.timeZone).toBe('Europe/Moscow');
    expect(SubscribeSchema.safeParse({ ...base, endpoint: 'https://web.push.apple.com/x', items: [{ name: 'Кефир', expiresAt: 'завтра' }] }).success).toBe(false);
  });
});
