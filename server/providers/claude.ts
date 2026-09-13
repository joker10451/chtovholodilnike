import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod';
import type { ImagePart } from '../../src/shared/aiSchemas.js';
import { AiError } from '../errors.js';

export const DEFAULT_CLAUDE_MODEL = 'claude-opus-5';

export async function generateWithClaude<T extends z.ZodType>(opts: {
  system: string;
  text: string;
  images: ImagePart[];
  schema: T;
}): Promise<z.infer<T>> {
  if (!process.env.ANTHROPIC_API_KEY) throw new AiError(500, 'На сервере не задан ANTHROPIC_API_KEY');
  const client = new Anthropic();

  try {
    const response = await client.beta.messages.parse({
      model: process.env.CLAUDE_MODEL || DEFAULT_CLAUDE_MODEL,
      max_tokens: 16000,
      // Если модель откажется отвечать, сервер сам повторит запрос на запасной модели.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: opts.system,
      messages: [
        {
          role: 'user',
          content: [
            ...opts.images.map((img) => ({
              type: 'image' as const,
              source: { type: 'base64' as const, media_type: img.mime_type, data: img.data },
            })),
            { type: 'text' as const, text: opts.text },
          ],
        },
      ],
      output_config: { format: betaZodOutputFormat(opts.schema) },
    });

    if (response.stop_reason === 'refusal') throw new AiError(422, 'Модель отказалась обрабатывать этот запрос.');
    if (response.stop_reason === 'max_tokens') throw new AiError(502, 'Ответ получился слишком длинным. Попробуйте меньше фото за раз.');
    if (!response.parsed_output) throw new AiError(502, 'Claude ответил в неожиданном формате. Попробуйте ещё раз.');
    return response.parsed_output as z.infer<T>;
  } catch (error) {
    if (error instanceof AiError) throw error;
    if (error instanceof Anthropic.RateLimitError) throw new AiError(429, 'Слишком много запросов к Claude. Попробуйте через минуту.');
    if (error instanceof Anthropic.AuthenticationError) throw new AiError(500, 'Неверный ANTHROPIC_API_KEY на сервере.');
    if (error instanceof Anthropic.BadRequestError) throw new AiError(502, `Claude отклонил запрос: ${error.message}`);
    if (error instanceof Anthropic.APIError) throw new AiError(502, `Ошибка Claude (${error.status}). Попробуйте ещё раз.`);
    throw error;
  }
}
