// Текст утреннего уведомления о сроках — отдельно от отправки, чтобы проверять тестами.

export interface DigestItem {
  name: string;
  expiresAt: string | null;
}

export interface Digest {
  title: string;
  body: string;
  url: string;
}

function list(names: string[], max = 3): string {
  const shown = names.slice(0, max).map((n) => n.toLowerCase());
  const rest = names.length - shown.length;
  return rest > 0 ? `${shown.join(', ')} и ещё ${rest}` : shown.join(', ');
}

/** null — сегодня писать не о чем */
export function expiryDigest(items: DigestItem[], today: string, tomorrow: string): Digest | null {
  const unique = (xs: DigestItem[]) => [...new Set(xs.map((i) => i.name.trim()).filter(Boolean))];
  const todayNames = unique(items.filter((i) => i.expiresAt === today));
  const tomorrowNames = unique(items.filter((i) => i.expiresAt === tomorrow));
  if (todayNames.length === 0 && tomorrowNames.length === 0) return null;

  const url = '/#/recipes?shelf=rescue';
  if (todayNames.length > 0) {
    return {
      title: todayNames.length === 1 ? `Сегодня последний день: ${todayNames[0].toLowerCase()}` : `Сегодня истекает: ${list(todayNames)}`,
      body: tomorrowNames.length
        ? `Завтра — ${list(tomorrowNames, 2)}. Посмотрите, что из этого приготовить.`
        : 'Посмотрите, что из этого приготовить.',
      url,
    };
  }
  return {
    title: `Завтра истекает: ${list(tomorrowNames)}`,
    body: 'Успейте приготовить — подобрали рецепты.',
    url,
  };
}

/** Дата YYYY-MM-DD в часовом поясе семьи */
export function localDate(now: Date, timeZone: string, addDays = 0): string {
  const shifted = new Date(now.getTime() + addDays * 86_400_000);
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(shifted);
  } catch {
    return shifted.toISOString().slice(0, 10);
  }
}
