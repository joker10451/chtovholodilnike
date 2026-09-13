import { useEffect, useMemo } from 'react';
import { useToday } from './components/ui';
import { useItems, useSettings } from './data/repo';
import type { MatchContext } from './lib/matching';

/** Всё, что нужно для подбора рецептов: продукты, базовые запасы, сегодняшняя дата */
export function useMatchContext(): MatchContext | null {
  const items = useItems();
  const settings = useSettings();
  const today = useToday();
  const staplesKey = settings.staples.join(',');
  return useMemo(
    () => (items ? { items, staples: new Set(staplesKey ? staplesKey.split(',') : []), today, timeLimit: settings.timeLimit } : null),
    [items, staplesKey, today, settings.timeLimit],
  );
}

/** Временные ссылки на фото из памяти; освобождаются, когда фото больше не нужны */
export function useObjectUrls(blobs: Blob[]): string[] {
  const urls = useMemo(() => blobs.map((b) => URL.createObjectURL(b)), [blobs]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  return urls;
}
