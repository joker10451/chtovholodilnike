// Журнал ошибок: если на телефоне что-то сломалось, короткая запись уходит на сервер,
// чтобы починить, не дожидаясь скриншотов. Продукты, рецепты и код доступа не отправляются.

export type ErrorKind = 'crash' | 'error' | 'ai' | 'scan' | 'backup' | 'push';

export interface ErrorEntry {
  version: string;
  screen: string;
  kind: ErrorKind;
  message: string;
  stack?: string;
  device?: string;
  count: number;
}

const QUEUE_KEY = 'holodilnik:error-queue';
const MAX_QUEUE = 20;

/** Нет связи, пользователь отменил, ошибки чужих расширений — это не поломки приложения */
const NOISE = [
  /failed to fetch|load failed|networkerror|network request failed|нет связи|нет интернета/i,
  /aborterror|timeouterror|the operation was aborted/i,
  /resizeobserver loop/i,
  /неверный код доступа/i,
  /dynamically imported module|importing a module script failed|loading chunk/i,
  /^script error\.?$/i,
];

export function isNoise(message: string): boolean {
  return NOISE.some((re) => re.test(message));
}

export function describeDevice(ua: string, standalone: boolean): string {
  const ios = ua.match(/(iPhone|iPad).*?OS (\d+)[_.](\d+)/);
  const android = ua.match(/Android (\d+(?:\.\d+)?)/);
  const base = ios ? `${ios[1]} iOS ${ios[2]}.${ios[3]}` : android ? `Android ${android[1]}` : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'другое';
  return `${base}${standalone ? ' · с экрана «Домой»' : ' · в браузере'}`;
}

/** Оставляет от стека только места в коде приложения, без адресов страниц с параметрами */
export function trimStack(stack: string | undefined): string | undefined {
  if (!stack) return undefined;
  return stack
    .split('\n')
    .map((l) => l.replace(/https?:\/\/[^/\s]+/g, '').replace(/\?[^:\s)]*/g, '').trim())
    .filter(Boolean)
    .slice(0, 12)
    .join('\n')
    .slice(0, 2000);
}

function readQueue(): ErrorEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as ErrorEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(entries: ErrorEntry[]) {
  try {
    if (entries.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(entries.slice(-MAX_QUEUE)));
    else localStorage.removeItem(QUEUE_KEY);
  } catch { /* хранилище недоступно — запись потеряется, это не страшно */ }
}

/** Одинаковые ошибки за сессию склеиваем в одну запись со счётчиком */
const seen = new Map<string, ErrorEntry>();
let timer: ReturnType<typeof setTimeout> | undefined;
let sending = false;

function enabled(): boolean {
  if (!import.meta.env.DEV) return true;
  try { return localStorage.getItem('holodilnik:log-dev') === '1'; } catch { return false; }
}

export function reportError(kind: ErrorKind, error: unknown, context?: string): void {
  try {
    if (!enabled()) return;
    const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : JSON.stringify(error));
    const message = `${context ? `${context}: ` : ''}${err.message || err.name}`.slice(0, 500);
    if (isNoise(message)) return;
    const screen = (location.hash.replace(/^#\/?/, '').split(/[/?]/)[0] || 'fridge').slice(0, 40);
    const key = `${kind}|${screen}|${message}`;
    const existing = seen.get(key);
    if (existing) {
      existing.count += 1;
      return;
    }
    const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
    const entry: ErrorEntry = {
      version: __APP_VERSION__,
      screen,
      kind,
      message,
      stack: trimStack(err.stack),
      device: describeDevice(navigator.userAgent, standalone),
      count: 1,
    };
    seen.set(key, entry);
    writeQueue([...readQueue(), entry]);
    scheduleFlush();
  } catch { /* журнал не должен ломать приложение */ }
}

function scheduleFlush(delay = 3000) {
  clearTimeout(timer);
  timer = setTimeout(() => void flushErrors(), delay);
}

export async function flushErrors(): Promise<void> {
  if (sending || !navigator.onLine) return;
  const queue = readQueue();
  if (queue.length === 0) return;
  sending = true;
  try {
    // Счётчики повторов могли вырасти после постановки в очередь
    const entries = queue.map((e) => seen.get(`${e.kind}|${e.screen}|${e.message}`) ?? e);
    const res = await fetch('/api/log', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entries }),
      keepalive: true,
      signal: AbortSignal.timeout(10_000),
    });
    // 400 и 429 не повторяем — такие записи сервер всё равно не примет
    if (res.ok || res.status === 400 || res.status === 429) writeQueue(readQueue().slice(queue.length));
  } catch {
    // Отправим при следующем запуске или когда вернётся интернет
  } finally {
    sending = false;
  }
}

/** Ловит всё, что не поймал код: необработанные ошибки и отклонённые промисы */
export function installErrorLog(): void {
  window.addEventListener('error', (e) => reportError('error', e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => reportError('error', e.reason));
  window.addEventListener('online', () => scheduleFlush(1000));
  scheduleFlush(5000);
}
