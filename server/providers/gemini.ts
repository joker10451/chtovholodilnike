import { ApiError, GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import type { ImagePart } from '../../src/shared/aiSchemas.js';
import { AiError } from '../errors.js';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';

function jsonSchema(schema: z.ZodType): unknown {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
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
  let raw: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            ...opts.images.map((img) => ({ inlineData: { mimeType: img.mime_type, data: img.data } })),
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
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 429) throw new AiError(429, 'Исчерпан бесплатный лимит Gemini. Попробуйте через минуту или завтра.');
      if (error.status === 400 || error.status === 403) throw new AiError(502, `Gemini отклонил запрос: ${error.message}`);
      throw new AiError(502, `Ошибка Gemini (${error.status}). Попробуйте ещё раз.`);
    }
    throw error;
  }

  if (!raw) throw new AiError(502, 'Gemini вернул пустой ответ. Попробуйте ещё раз.');
  const parsed = opts.schema.safeParse(JSON.parse(raw));
  if (!parsed.success) throw new AiError(502, 'Gemini ответил в неожиданном формате. Попробуйте ещё раз.');
  return parsed.data;
}
