// Код доступа семьи: защищает нейросеть и уведомления от чужих.

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/** Клиент кодирует код доступа через encodeURIComponent — он может быть на кириллице */
function decodeHeader(value: string | null): string | null {
  if (value === null) return null;
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
}

/** null — доступ разрешён, иначе готовый ответ с ошибкой */
export function checkAccess(request: Request): Response | null {
  const accessCode = process.env.APP_ACCESS_CODE;
  if (!accessCode && process.env.VERCEL) {
    return json(500, { error: 'На сервере не задан APP_ACCESS_CODE. Без него приложением сможет пользоваться кто угодно.' });
  }
  if (accessCode && decodeHeader(request.headers.get('x-access-code')) !== accessCode.trim()) {
    return json(401, { error: 'Неверный код доступа. Проверьте его в настройках приложения.' });
  }
  return null;
}
