// Упаковка резервной копии для облака: сжатие и шифрование кодом доступа.
// Сервер хранит только зашифрованные байты — прочитать копию без кода нельзя.

const MAGIC = [0x48, 0x42, 0x31]; // «HB1»
const FLAG_GZIP = 1;
const ITERATIONS = 200_000;

export class BackupCodeError extends Error {
  constructor() {
    super('Копия зашифрована другим кодом доступа. Введите код, который был, когда копию сохраняли.');
  }
}

async function transform(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
  const out = await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer();
  return new Uint8Array(out);
}

async function deriveKey(code: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(code.trim()), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const raw = atob(text);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function sealBackup(json: string, code: string): Promise<string> {
  let body = new TextEncoder().encode(json) as Uint8Array<ArrayBuffer>;
  let flags = 0;
  if (typeof CompressionStream !== 'undefined') {
    body = await transform(body, new CompressionStream('gzip'));
    flags |= FLAG_GZIP;
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await deriveKey(code, salt), body));
  const packed = new Uint8Array(4 + salt.length + iv.length + cipher.length);
  packed.set([...MAGIC, flags], 0);
  packed.set(salt, 4);
  packed.set(iv, 20);
  packed.set(cipher, 32);
  return toBase64(packed);
}

export async function openBackup(payload: string, code: string): Promise<string> {
  const packed = fromBase64(payload);
  if (packed.length < 33 || MAGIC.some((b, i) => packed[i] !== b)) throw new Error('Повреждённая резервная копия');
  const flags = packed[3];
  const salt = packed.slice(4, 20);
  const iv = packed.slice(20, 32);
  let body: Uint8Array<ArrayBuffer>;
  try {
    body = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await deriveKey(code, salt), packed.slice(32)));
  } catch {
    throw new BackupCodeError();
  }
  if (flags & FLAG_GZIP) body = await transform(body, new DecompressionStream('gzip'));
  return new TextDecoder().decode(body);
}
