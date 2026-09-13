import { ApiError, GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import type { ImagePart } from '../../src/shared/aiSchemas.js';
import { AiError } from '../errors.js';

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

const FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
];

function jsonSchema(schema: z.ZodType): unknown {
  const rest = z.toJSONSchema(schema) as Record<string, unknown>;
  delete rest['$schema'];
  return rest;
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

  // Формируем цепочку моделей: заданная пользователем -> стабильная 2.5-flash -> latest -> 3.5 -> 3.6
  const modelsToTry: string[] = [];
  if (process.env.GEMINI_MODEL) modelsToTry.push(process.env.GEMINI_MODEL.trim());
  for (const m of FALLBACK_MODELS) {
    if (!modelsToTry.includes(m)) modelsToTry.push(m);
  }

  let raw: string | undefined;
  let lastError: unknown = null;

  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              ...opts.images.map((img) => ({
                inlineData: { mimeType: img.mime_type, data: img.data },
              })),
              { text: opts.text },
            ],
          },
        ],
        config: {
          systemInstruction: opts.system,
          responseMimeType: 'application/json',
          responseJsonSchema: jsonSchema(opts.schema),
        },
      });

      raw = response.text;
      if (raw) break; // Успешно получено
    } catch (error) {
      lastError = error;
      console.warn(`[Gemini] Модель ${model} вернула ошибку:`, error instanceof Error ? error.message : error);
      // Если квота исчерпана на весь ключ (429), пробуем подождать или следующую модель
      if (error instanceof ApiError && error.status === 429) {
        continue;
      }
      // При 503 (перегрузка) пробуем другую модель
      if (error instanceof ApiError && (error.status === 503 || error.status === 500 || error.status === 404)) {
        continue;
      }
      // Неверный запрос или ключ не исправит другая модель — не тратим время функции на повторы
      break;
    }
  }

  if (!raw) {
    if (lastError instanceof ApiError) {
      if (lastError.status === 429) {
        throw new AiError(429, 'Исчерпан бесплатный лимит Gemini. Попробуйте через минуту или завтра.');
      }
      if (lastError.status === 400 || lastError.status === 403) {
        throw new AiError(502, `Gemini отклонил запрос: ${lastError.message}`);
      }
      throw new AiError(502, `Ошибка Gemini (${lastError.status}): ${lastError.message}`);
    }
    throw new AiError(502, 'Нейросеть Gemini временно недоступна. Попробуйте ещё раз.');
  }

  try {
    const parsedJson = JSON.parse(raw);
    const parsed = opts.schema.safeParse(parsedJson);
    if (!parsed.success) {
      throw new AiError(502, 'Gemini ответил в неожиданном формате. Попробуйте ещё раз.');
    }
    return parsed.data;
  } catch (err) {
    if (err instanceof AiError) throw err;
    throw new AiError(502, 'Не удалось разобрать ответ нейросети.');
  }
}
