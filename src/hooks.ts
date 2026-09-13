import { useEffect, useMemo } from 'react';
import { useToday } from './components/ui';
import { useCookLog, useItems, useSettings } from './data/repo';
import type { MatchContext } from './lib/matching';
import { tastesFromLog } from './lib/taste';

/** Всё, что нужно для подбора рецептов: продукты, базовые запасы, сегодняшняя дата */
export function useMatchContext(): MatchContext | null {
  const items = useItems();
  const settings = useSettings();
  const today = useToday();
  const log = useCookLog();
  const staplesKey = settings.staples.join(',');
  const tastes = useMemo(() => tastesFromLog(log ?? []), [log]);
  return useMemo(
    () => (items ? { items, staples: new Set(staplesKey ? staplesKey.split(',') : []), today, timeLimit: settings.timeLimit, tastes } : null),
    [items, staplesKey, today, settings.timeLimit, tastes],
  );
}

/** Временные ссылки на фото из памяти; освобождаются, когда фото больше не нужны */
export function useObjectUrls(blobs: Blob[]): string[] {
  const urls = useMemo(() => blobs.map((b) => URL.createObjectURL(b)), [blobs]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  return urls;
}
