import { useEffect, useState } from 'react';
import { Spinner, toast } from '../components/ui';
import { currentSubscription, disablePush, enablePush, pushAvailability, type PushAvailability } from '../lib/push';

const EXPLAIN: Record<Exclude<PushAvailability, 'ready'>, string> = {
  'not-configured': 'Пока не настроены на сервере. Когда настроим, утром будет приходить «Сегодня последний день: кефир» с рецептами.',
  'install-first': 'Добавьте приложение на экран «Домой»: iPhone показывает уведомления только установленным приложениям.',
  unsupported: 'Этот браузер не умеет показывать уведомления.',
};

export function NotificationsSection() {
  const [availability, setAvailability] = useState<PushAvailability | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const a = await pushAvailability();
      const sub = a === 'ready' ? await currentSubscription() : null;
      if (!cancelled) {
        setAvailability(a);
        setEnabled(Boolean(sub));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function toggle() {
    setBusy(true);
    try {
      if (enabled) {
        await disablePush();
        setEnabled(false);
        toast('Уведомления выключены');
      } else {
        await enablePush();
        setEnabled(true);
        toast('Готово — напомним утром, если что-то истекает');
      }
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="stack">
      <div className="section-label">Уведомления</div>
      <div className="card flat stack">
        <div className="row-gap">
          <div className="grow">
            <b>Сроки годности</b>
            <div className="small muted">
              {availability === 'ready'
                ? enabled ? 'Включены — около 9 утра, если что-то истекает сегодня или завтра' : 'Утром напомним, что истекает сегодня и завтра, и предложим рецепты'
                : availability ? EXPLAIN[availability] : 'Проверяю…'}
            </div>
          </div>
          {availability === 'ready' && (
            <button className={`btn small${enabled ? ' ghost' : ''}`} onClick={toggle} disabled={busy}>
              {busy ? <Spinner /> : enabled ? 'Выключить' : 'Включить'}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
