import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../data/db';
import { AiRequestError, OfflineError, recognize } from './ai';

const answer = { items: [], purchase_date: null };
const photo = { mime_type: 'image/jpeg' as const, data: 'AAAA' };

function respond(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('запросы к нейросети', () => {
  beforeEach(async () => {
    vi.stubGlobal('navigator', { onLine: true });
    await db.aicache.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('одно и то же фото не отправляется второй раз, даже на следующий день', async () => {
    const fetchMock = vi.fn(async () => respond(200, answer));
    vi.stubGlobal('fetch', fetchMock);
    await recognize({ task: 'shelf', today: '2026-09-13', images: [photo] });
    const again = await recognize({ task: 'shelf', today: '2026-09-14', images: [photo] });
    expect(again).toEqual(answer);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('другое фото отправляется', async () => {
    const fetchMock = vi.fn(async () => respond(200, answer));
    vi.stubGlobal('fetch', fetchMock);
    await recognize({ task: 'shelf', today: '2026-09-13', images: [photo] });
    await recognize({ task: 'shelf', today: '2026-09-13', images: [{ ...photo, data: 'BBBB' }] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('ошибка не запоминается — следующая попытка снова идёт на сервер', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(respond(429, { error: 'Лимит' }))
      .mockResolvedValueOnce(respond(200, answer));
    vi.stubGlobal('fetch', fetchMock);
    await expect(recognize({ task: 'text', today: '2026-09-13', text: 'яйца' })).rejects.toBeInstanceOf(AiRequestError);
    await expect(recognize({ task: 'text', today: '2026-09-13', text: 'яйца' })).resolves.toEqual(answer);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('при обрыве связи повторяет запрос один раз', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(respond(200, answer));
    vi.stubGlobal('fetch', fetchMock);
    await expect(recognize({ task: 'text', today: '2026-09-13', text: 'молоко' })).resolves.toEqual(answer);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('если сеть так и не появилась — понятная ошибка про интернет', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(recognize({ task: 'text', today: '2026-09-13', text: 'сыр' })).rejects.toBeInstanceOf(OfflineError);
  });

  it('ответ сервера без текста ошибки превращается в понятное сообщение', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Gateway Timeout</html>', { status: 504 })));
    await expect(recognize({ task: 'text', today: '2026-09-13', text: 'хлеб' })).rejects.toThrow('не успела ответить');
  });
});
