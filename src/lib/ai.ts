import type { z } from 'zod';
import { getMeta } from '../data/db';
import {
  GeneratedRecipeSchema, RecognitionSchema, type AiRequest, type GeneratedRecipe, type Recognition,
} from '../shared/aiSchemas';

export class OfflineError extends Error {
  constructor() {
    super('Нет интернета. Проверьте подключение или VPN.');
    this.name = 'OfflineError';
  }
}

export class AiRequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'AiRequestError';
  }
}

async function call<T extends z.ZodType>(body: AiRequest, schema: T): Promise<z.infer<T>> {
  if (!navigator.onLine) throw new OfflineError();
  const { accessCode } = await getMeta();
  let res: Response;
  try {
    res = await fetch('/api/ai', {
      method: 'POST',
      // В заголовках допустима только латиница, а код может быть по-русски
      headers: { 'content-type': 'application/json', 'x-access-code': encodeURIComponent(accessCode) },
      body: JSON.stringify(body),
    });
  } catch {
    throw new OfflineError();
  }
  const payload = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) {
    const fallback = res.status === 404
      ? 'Нейросеть недоступна: серверная функция не найдена.'
      : `Сервер ответил ошибкой ${res.status}.`;
    throw new AiRequestError(res.status, payload?.error ?? fallback);
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new AiRequestError(502, 'Нейросеть ответила в неожиданном формате. Попробуйте ещё раз.');
  return parsed.data;
}

export function recognize(body: Extract<AiRequest, { task: 'shelf' | 'receipt' | 'text' }>): Promise<Recognition> {
  return call(body, RecognitionSchema);
}

export function generateRecipe(body: Extract<AiRequest, { task: 'recipe' | 'import' }>): Promise<GeneratedRecipe> {
  return call(body, GeneratedRecipeSchema);
}
