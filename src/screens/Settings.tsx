import { useState } from 'react';
import { Header, Sheet, Spinner, Stepper, toast, useOnline } from '../components/ui';
import { db, setMeta } from '../data/db';
import { saveSettings, useCookLog, useMeta, useSettings } from '../data/repo';
import {
  createHousehold, joinHousehold, sendLoginCode, signOut, syncNow, useSyncStatus, verifyLoginCode,
} from '../data/sync';
import type { SyncRecord } from '../data/types';
import { usePwaUpdate } from '../lib/pwaUpdate';
import { supabase } from '../lib/supabase';
import { PRODUCTS } from '../shared/products';

export function Settings() {
  const settings = useSettings();
  const meta = useMeta();
  const cooked = useCookLog();
  const { hasUpdate, applyUpdate, checkForUpdate } = usePwaUpdate();
  const [staplesOpen, setStaplesOpen] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

  return (
    <main className="screen">
      <Header title="Настройки" />
      <div className="stack-lg">
        {!standalone && (
          <div className="notice info">
            <b>Установите на экран «Домой»</b>
            <span>В Safari нажмите «Поделиться» → «На экран “Домой”». Так приложение откроется на весь экран, будет работать без интернета и не потеряет данные.</span>
          </div>
        )}

        <section className="stack">
          <div className="section-label">Семья</div>
          <div className="card flat row-gap">
            <div className="grow"><b>Порций по умолчанию</b></div>
            <div style={{ width: 150 }}><Stepper label="Порций" value={settings.servings} min={1} onChange={(v) => saveSettings({ servings: Math.max(1, Math.round(v)) })} /></div>
          </div>
          <div className="card flat stack">
            <b>Время на готовку в будни</b>
            <div className="wrap-gap">
              {[20, 30, 45, 60, 90].map((m) => (
                <button key={m} className={`chip${settings.timeLimit === m ? ' on' : ''}`} onClick={() => saveSettings({ timeLimit: m })}>до {m} мин</button>
              ))}
            </div>
          </div>
          <button className="card flat row-gap" style={{ border: '1px solid var(--line)', textAlign: 'left' }} onClick={() => setStaplesOpen(true)}>
            <div className="grow"><b>Базовые запасы</b><div className="small muted">{settings.staples.length} продуктов всегда есть дома</div></div>
            <span className="muted">›</span>
          </button>
        </section>

        <SyncSection />

        <section className="stack">
          <div className="section-label">Нейросеть</div>
          <div className="card flat stack">
            <b>Код доступа</b>
            <p className="small muted">Защищает бесплатный лимит нейросети от чужих. Совпадает с APP_ACCESS_CODE на сервере.</p>
            <div className="row-gap">
              <input className="input" type="password" autoComplete="off" placeholder={meta.accessCode ? '••••••' : 'Код не задан'}
                value={code ?? ''} onChange={(e) => setCode(e.target.value)} />
              <button className="btn small" style={{ minHeight: 46 }} disabled={code === null} onClick={async () => {
                await setMeta({ accessCode: (code ?? '').trim() });
                setCode(null);
                toast('Код сохранён');
              }}>Сохранить</button>
            </div>
          </div>
        </section>

        <section className="stack">
          <div className="section-label">Приложение</div>
          <div className="card flat stack">
            <div className="row-gap">
              <div className="grow">
                <b>Версия 0.2.0</b>
                <div className="small muted">
                  {standalone ? 'Установлено на экран «Домой»' : 'Запущено в браузере'}
                </div>
              </div>
              {hasUpdate ? (
                <button
                  className="btn small primary"
                  onClick={() => void applyUpdate()}
                >
                  Обновить сейчас
                </button>
              ) : (
                <button
                  className="btn small ghost"
                  onClick={async () => {
                    toast('Проверяю обновления…');
                    const found = await checkForUpdate();
                    if (!found) {
                      toast('У вас установлена последняя версия');
                    }
                  }}
                >
                  Проверить
                </button>
              )}
            </div>
            {hasUpdate && (
              <div className="notice info" style={{ margin: 0 }}>
                ✨ Новая версия уже скачана! Нажмите «Обновить сейчас» для перезагрузки.
              </div>
            )}
            <p className="small muted">
              Приложение проверяет наличие обновлений в фоне при каждом открытии и показывает всплывающее окно, когда готова новая версия.
            </p>
          </div>
        </section>

        <BackupSection />

        <p className="small muted" style={{ textAlign: 'center' }}>
          Приготовлено блюд: {cooked?.length ?? 0} · версия 0.1
        </p>
      </div>

      <StaplesSheet open={staplesOpen} onClose={() => setStaplesOpen(false)} selected={settings.staples} />
    </main>
  );
}

function StaplesSheet({ open, onClose, selected }: { open: boolean; onClose: () => void; selected: string[] }) {
  const set = new Set(selected);
  const options = PRODUCTS.filter((p) => p.staple);
  return (
    <Sheet open={open} onClose={onClose} title="Всегда есть дома">
      <div className="check-grid">
        {options.map((p) => (
          <label key={p.key} className="check">
            <input type="checkbox" checked={set.has(p.key)} onChange={(e) => {
              const next = new Set(set);
              if (e.target.checked) next.add(p.key); else next.delete(p.key);
              void saveSettings({ staples: [...next] });
            }} />
            {p.name}
          </label>
        ))}
      </div>
    </Sheet>
  );
}

function SyncSection() {
  const meta = useMeta();
  const status = useSyncStatus();
  const online = useOnline();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [houseName, setHouseName] = useState('Наш дом');
  const [invite, setInvite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  if (!supabase) {
    return (
      <section className="stack">
        <div className="section-label">Общий холодильник</div>
        <div className="card flat stack">
          <b>Синхронизация не настроена</b>
          <p className="small muted">Сейчас данные хранятся только на этом телефоне. Чтобы видеть один холодильник с двух телефонов, подключите бесплатный Supabase — инструкция в README проекта.</p>
        </div>
      </section>
    );
  }

  const lastSync = status.lastSyncAt ?? meta.lastSyncAt;

  return (
    <section className="stack">
      <div className="section-label">Общий холодильник</div>
      <div className="card flat stack">
        {status.state === 'signed-out' && (
          !codeSent ? (
            <>
              <b>Войдите, чтобы синхронизировать телефоны</b>
              <p className="small muted">Пришлём код на почту. Пароль не нужен.</p>
              <input className="input" type="email" inputMode="email" autoComplete="email" placeholder="Почта" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button className="btn block" disabled={busy || !online || !email.includes('@')} onClick={() => run(async () => { await sendLoginCode(email); setCodeSent(true); })}>
                {busy && <Spinner />} Получить код
              </button>
            </>
          ) : (
            <>
              <b>Введите код из письма</b>
              <p className="small muted">Отправили на {email}.</p>
              <input className="input mono" inputMode="numeric" autoComplete="one-time-code" placeholder="Код" value={otp} onChange={(e) => setOtp(e.target.value)} />
              <button className="btn block" disabled={busy || otp.trim().length < 6} onClick={() => run(() => verifyLoginCode(email, otp))}>
                {busy && <Spinner />} Войти
              </button>
              <button className="btn quiet" onClick={() => { setCodeSent(false); setOtp(''); }}>Другая почта</button>
            </>
          )
        )}

        {status.state === 'no-household' && (
          <>
            <b>Создайте дом или присоединитесь</b>
            <p className="small muted">Первый телефон создаёт дом, второй вводит код приглашения.</p>
            <div className="row-gap">
              <input className="input" value={houseName} onChange={(e) => setHouseName(e.target.value)} aria-label="Название дома" />
              <button className="btn small" style={{ minHeight: 46 }} disabled={busy || !online} onClick={() => run(() => createHousehold(houseName))}>Создать</button>
            </div>
            <div className="row-gap">
              <input className="input mono" placeholder="Код приглашения" value={invite} onChange={(e) => setInvite(e.target.value.toUpperCase())} maxLength={6} />
              <button className="btn small ghost" style={{ minHeight: 46 }} disabled={busy || !online || invite.length < 6} onClick={() => run(() => joinHousehold(invite))}>Войти в дом</button>
            </div>
            <button className="btn quiet" onClick={() => void signOut()}>Выйти из аккаунта</button>
          </>
        )}

        {meta.householdId && status.state !== 'signed-out' && status.state !== 'no-household' && (
          <>
            <div className="row-gap">
              <div className="grow">
                <b>{meta.householdName}</b>
                <div className="small muted">
                  {status.state === 'syncing' && 'Синхронизирую…'}
                  {status.state === 'idle' && (lastSync ? `Синхронизировано в ${new Date(lastSync).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : 'Синхронизировано')}
                  {status.state === 'offline' && 'Нет интернета — изменения отправятся позже'}
                  {status.state === 'error' && <span style={{ color: 'var(--bad)' }}>Ошибка: {status.error}</span>}
                </div>
              </div>
              <button className="btn small ghost" disabled={status.state === 'syncing'} onClick={() => void syncNow()}>Обновить</button>
            </div>
            {meta.inviteCode && (
              <div className="notice info">
                <span>Код для второго телефона</span>
                <b className="mono" style={{ fontSize: 26, letterSpacing: '.12em' }}>{meta.inviteCode}</b>
              </div>
            )}
            <button className="btn quiet" onClick={() => { if (confirm('Выйти? Данные останутся на телефоне, но перестанут синхронизироваться.')) void signOut(); }}>Выйти</button>
          </>
        )}
        {error && <div className="notice error">{error}</div>}
      </div>
    </section>
  );
}

function BackupSection() {
  async function exportData() {
    const records = await db.records.filter((r) => !r.deleted).toArray();
    const blob = new Blob([JSON.stringify({ app: 'holodilnik', version: 1, exportedAt: new Date().toISOString(), records }, null, 2)], { type: 'application/json' });
    const file = new File([blob], `holodilnik-${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file] }); } catch { /* закрыли окно */ }
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importData(file: File | undefined) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as { app?: string; records?: SyncRecord[] };
      if (parsed.app !== 'holodilnik' || !Array.isArray(parsed.records)) throw new Error();
      const now = Date.now();
      await db.records.bulkPut(parsed.records.map((r) => ({ ...r, updatedAt: now, dirty: 1 as const })));
      toast(`Восстановлено записей: ${parsed.records.length}`);
      void syncNow();
    } catch {
      toast('Это не файл резервной копии приложения');
    }
  }

  return (
    <section className="stack">
      <div className="section-label">Резервная копия</div>
      <div className="card flat stack">
        <p className="small muted">Сохраните продукты, свои рецепты и настройки в файл или перенесите их на другой телефон без синхронизации.</p>
        <div className="field-row">
          <button className="btn small ghost" onClick={exportData}>Сохранить файл</button>
          <label className="btn small ghost" style={{ position: 'relative' }}>
            Восстановить
            <input type="file" accept="application/json,.json" style={{ position: 'absolute', inset: 0, opacity: 0 }} onChange={(e) => { void importData(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        </div>
      </div>
    </section>
  );
}
