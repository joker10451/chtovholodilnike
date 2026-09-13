// Запасной путь к Open Food Facts через сервер приложения:
// выручает, когда телефон не может открыть сайт напрямую (VPN, блокировки, медленная сеть).

const OFF_FIELDS = [
  'product_name_ru', 'product_name', 'generic_name_ru', 'generic_name', 'brands', 'quantity', 'product_quantity',
  'product_quantity_unit', 'categories_tags', 'image_front_small_url', 'image_front_url', 'nutriments',
  'conservation_conditions_ru', 'conservation_conditions', 'ingredients_text_ru',
].join(',');

function json(status: number, body: unknown, cacheSeconds = 0): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cacheSeconds ? `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}` : 'no-store',
    },
  });
}

export async function handleBarcodeRequest(request: Request): Promise<Response> {
  const code = new URL(request.url).searchParams.get('code') ?? '';
  if (!/^\d{8,14}$/.test(code)) return json(400, { error: 'Нужен штрихкод из 8–14 цифр' });

  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${OFF_FIELDS}&lc=ru`, {
      headers: { 'user-agent': 'ChtoVHolodilnike/1.0 (family fridge app)' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) return json(200, { status: 0 }, 3600);
    if (!res.ok) return json(502, { error: `Open Food Facts ответил ошибкой ${res.status}` });
    const data = (await res.json()) as { status?: number; product?: unknown };
    return json(200, { status: data.status ?? 0, product: data.product ?? null }, data.status === 1 ? 86400 : 3600);
  } catch {
    return json(504, { error: 'Open Food Facts не ответил' });
  }
}
