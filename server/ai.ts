import { z } from 'zod';
import {
  AiRequestSchema, GeneratedRecipeSchema, PackageSchema, RecognitionSchema, type AiRequest, type ImagePart,
} from '../src/shared/aiSchemas.js';
import { checkAccess } from './access.js';
import { AiError } from './errors.js';
import { systemPrompt, userText } from './prompts.js';
import { generateWithClaude } from './providers/claude.js';
import { generateWithGemini } from './providers/gemini.js';

const MAX_PAGE_CHARS = 25_000;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')
    || /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(h)
    || h.startsWith('[');
}

/** Скачивает страницу рецепта и оставляет из неё только текст */
async function fetchPageText(url: string): Promise<string> {
  const parsed = new URL(url);
  if (!/^https?:$/.test(parsed.protocol) || isPrivateHost(parsed.hostname)) {
    throw new AiError(400, 'Можно импортировать только обычные ссылки на сайты.');
  }
  let res: Response;
  try {
    res = await fetch(parsed, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; HolodilnikBot/1.0)', accept: 'text/html' },
      signal: AbortSignal.timeout(12_000),
      redirect: 'follow',
    });
  } catch {
    throw new AiError(502, 'Не удалось открыть ссылку. Скопируйте текст рецепта и вставьте его вместо ссылки.');
  }
  if (!res.ok) throw new AiError(502, `Сайт ответил ошибкой ${res.status}. Скопируйте текст рецепта и вставьте его вместо ссылки.`);
  const html = await res.text();

  // На многих сайтах рецепт лежит в разметке schema.org — она точнее текста страницы.
  const ld = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1])
    .filter((s) => /recipe/i.test(s))
    .join('\n');

  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(nav|footer|header|aside)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|li|h\d|div)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();

  return `${ld ? `Разметка рецепта:\n${ld}\n\n` : ''}${text}`.slice(0, MAX_PAGE_CHARS);
}

async function generate<T extends z.ZodType>(system: string, text: string, images: ImagePart[], schema: T): Promise<z.infer<T>> {
  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
  if (provider === 'claude') return generateWithClaude({ system, text, images, schema });
  if (provider === 'gemini') return generateWithGemini({ system, text, images, schema });
  throw new AiError(500, `Неизвестный AI_PROVIDER: ${provider}. Укажите gemini или claude.`);
}

async function run(req: AiRequest): Promise<unknown> {
  const system = systemPrompt(req.task);
  switch (req.task) {
    case 'shelf':
    case 'receipt':
      return generate(system, userText(req), req.images, RecognitionSchema);
    case 'text':
      return generate(system, userText(req), [], RecognitionSchema);
    case 'package':
      return generate(system, userText(req), req.images, PackageSchema);
    case 'recipe':
      return generate(system, userText(req), [], GeneratedRecipeSchema);
    case 'import': {
      if (!req.url && !req.text && req.images.length === 0) {
        throw new AiError(400, 'Добавьте ссылку, текст или фото рецепта.');
      }
      const pageText = req.url ? await fetchPageText(req.url) : undefined;
      return generate(system, userText(req, pageText), req.images, GeneratedRecipeSchema);
    }
  }
}

/** Общий обработчик для Vercel Functions и dev-сервера Vite */
export async function handleAiRequest(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'Используйте POST' });

  const denied = checkAccess(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Некорректный запрос' });
  }
  const parsed = AiRequestSchema.safeParse(body);
  if (!parsed.success) return json(400, { error: 'Некорректный запрос', details: z.prettifyError(parsed.error) });

  try {
    return json(200, await run(parsed.data));
  } catch (error) {
    if (error instanceof AiError) return json(error.status, { error: error.message });
    console.error('AI request failed', error);
    return json(500, { error: 'Не получилось обработать запрос. Попробуйте ещё раз.' });
  }
}
