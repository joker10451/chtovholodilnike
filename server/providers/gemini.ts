import { ApiError, GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import type { ImagePart } from '../../src/shared/aiSchemas.js';
import { AiError } from '../errors.js';

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

/** У каждой модели на бесплатном тарифе свой лимит — если одна исчерпана или перегружена, пробуем следующую */
const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3.5-flash', 'gemini-3.6-flash'];

/** Функция на Vercel живёт 60 секунд; оставляем запас на ответ приложению */
const TOTAL_BUDGET_MS = 52_000;
const ATTEMPT_MS = 35_000;
const MIN_ATTEMPT_MS = 8_000;

function jsonSchema(schema: z.ZodType): unknown {
  const rest = z.toJSONSchema(schema) as Record<string, unknown>;
  delete rest['$schema'];
  return rest;
}

/** Ошибка, которую может обойти другая модель */
function worthRetry(error: unknown): boolean {
  if (error instanceof ApiError) return [429, 500, 503, 404].includes(error.status);
  // Таймаут или обрыв соединения с Google
  return true;
}

export async function generateWithGemini<T extends z.ZodType>(opts: {
  system: string;
  text: string;
  images: ImagePart[];
  schema: T;
}): Promise<z.infer<T>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AiError(500, 'На сервере не задан GEMINI_API_KEY');

  const ai = new GoogleGenAI({ apiKey });
  const models = [...new Set([process.env.GEMINI_MODEL?.trim(), ...FALLBACK_MODELS].filter((m): m is string => !!m))];
  const deadline = Date.now() + TOTAL_BUDGET_MS;

  let raw: string | undefined;
  let lastError: unknown = null;

  for (const model of models) {
    const left = deadline - Date.now();
    if (left < MIN_ATTEMPT_MS) break;
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{
          role: 'user',
          parts: [
            ...opts.images.map((img) => ({ inlineData: { mimeType: img.mime_type, data: img.data } })),
            { text: opts.text },
          ],
        }],
        config: {
          systemInstruction: opts.system,
          responseMimeType: 'application/json',
          responseJsonSchema: jsonSchema(opts.schema),
          abortSignal: AbortSignal.timeout(Math.min(ATTEMPT_MS, left)),
        },
      });
      raw = response.text;
      if (raw) break;
    } catch (error) {
      lastError = error;
      console.warn(`[Gemini] ${model}:`, error instanceof Error ? error.message : error);
      if (!worthRetry(error)) break;
    }
  }

  if (!raw) {
    if (lastError instanceof ApiError) {
      if (lastError.status === 429) throw new AiError(429, 'Бесплатный лимит нейросети на сегодня закончился. Попробуйте через час или завтра.');
      if (lastError.status === 400 || lastError.status === 403) throw new AiError(502, `Нейросеть отклонила запрос: ${lastError.message}`);
      throw new AiError(502, `Нейросеть временно недоступна (${lastError.status}). Попробуйте ещё раз.`);
    }
    if (lastError || Date.now() >= deadline - MIN_ATTEMPT_MS) {
      throw new AiError(504, 'Нейросеть не успела ответить. Попробуйте ещё раз — лучше с одним фото.');
    }
    throw new AiError(502, 'Нейросеть вернула пустой ответ. Попробуйте ещё раз.');
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new AiError(502, 'Не удалось разобрать ответ нейросети. Попробуйте ещё раз.');
  }
  const parsed = opts.schema.safeParse(json);
  if (!parsed.success) throw new AiError(502, 'Нейросеть ответила в неожиданном формате. Попробуйте ещё раз.');
  return parsed.data;
}
