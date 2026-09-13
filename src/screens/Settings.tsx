import { useState } from 'react';
import { IconBack } from '../components/icons';
import { Header, Sheet, Spinner, Stepper, toast, useOnline } from '../components/ui';
import { setMeta } from '../data/db';
import { saveSettings, useCookLog, useMeta, useSettings } from '../data/repo';
import { AiRequestError, recognize } from '../lib/ai';
import { applyBackupRecords, backupFile, formatBackupDate, localRecords, parseBackupFile, saveCloudBackup } from '../lib/cloudBackup';
import { usePwaUpdate } from '../lib/pwaUpdate';
import { monthKey } from '../lib/stats';
import { href } from '../router';
import { todayISO } from '../shared/dates';
import { PRODUCTS } from '../shared/products';
import { plural } from './Fridge';
import { CloudRestoreSheet } from './CloudRestoreSheet';
import { NotificationsSection } from './NotificationsSection';

export function Settings() {
  const settings = useSettings();
  const meta = useMeta();
  const cooked = useCookLog();
  const thisMonth = monthKey(Date.now());
  const cookedThisMonth = cooked?.filter((e) => !e.ratedOnly && monthKey(e.cookedAt) === thisMonth).length ?? 0;
  const online = useOnline();
  const { hasUpdate, isUpdating, applyUpdate, checkForUpdate } = usePwaUpdate();
  const [staplesOpen, setStaplesOpen] = useState(false);
  const [code, setCode] = useState('');
  const [checkingAi, setCheckingAi] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

  async function saveCode() {
    await setMeta({ accessCode: code.trim() });
    setCode('');
    setAiStatus(null);
    toast('Код сохранён');
  }

  async function checkAi() {
    setCheckingAi(true);
    setAiStatus(null);
    try {
      await recognize({ task: 'text', today: todayISO(), text: 'яйца' });
      setAiStatus({ ok: true, text: 'Нейросеть отвечает — скан упаковок и чеков работает' });
    } catch (e) {
      const text = e instanceof AiRequestError && e.status === 401
        ? 'Код не подошёл. Проверьте его — он совпадает с кодом на сервере.'
        : (e as Error).message;
      setAiStatus({ ok: false, text });
    } finally {
      setCheckingAi(false);
    }
  }

  async function checkUpdate() {
    setCheckingUpdate(true);
    const found = await checkForUpdate();
    setCheckingUpdate(false);
    if (!found) toast('Установлена последняя версия');
  }

  return (
    <main className="screen">
      <Header title="Настройки" backTo="#/fridge" />
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
            <div className="grow"><b>Сколько человек едят</b><div className="small muted">Под это число пересчитываются порции</div></div>
            <div style={{ width: 140 }}><Stepper label="Человек" value={settings.servings} min={1} onChange={(v) => saveSettings({ servings: Math.max(1, Math.round(v)) })} /></div>
          </div>
          <div className="card flat stack">
            <b>Время на готовку в будни</b>
            <div className="wrap-gap">
              {[20, 30, 45, 60, 90].map((m) => (
                <button key={m} className={`chip${settings.timeLimit === m ? ' on' : ''}`} onClick={() => saveSettings({ timeLimit: m })}>до {m} мин</button>
              ))}
            </div>
          </div>
          <button className="card flat row-gap settings-link" onClick={() => setStaplesOpen(true)}>
            <div className="grow">
              <b>Всегда есть дома</b>
              <div className="small muted">{settings.staples.length} {plural(settings.staples.length, 'продукт', 'продукта', 'продуктов')}: соль, масло, мука… — рецепты считают их имеющимися</div>
            </div>
            <IconBack className="chevron" />
          </button>
        </section>

        <section className="stack">
          <div className="section-label">Итоги</div>
          <a className="card flat row-gap settings-link" href={href('stats')}>
            <div className="grow">
              <b>Итоги месяца</b>
              <div className="small muted">
                {cookedThisMonth > 0
                  ? `В этом месяце: ${cookedThisMonth} ${plural(cookedThisMonth, 'блюдо', 'блюда', 'блюд')} · что спасли и что выбросили`
                  : 'Что готовили, сколько продуктов спасли и что выбросили'}
              </div>
            </div>
            <IconBack className="chevron" />
          </a>
        </section>

        <NotificationsSection />

        <section className="stack">
          <div className="section-label">Нейросеть</div>
          <div className="card flat stack">
            <div>
              <b>Код доступа</b>
              <div className="small muted">
                {meta.accessCode ? 'Сохранён на этом телефоне. Введите новый, чтобы заменить.' : 'Нужен для нейросети, уведомлений и копии в облаке.'}
              </div>
            </div>
            <form className="row-gap" onSubmit={(e) => { e.preventDefault(); if (code.trim()) void saveCode(); }}>
              <input className="input" type="password" autoComplete="off" placeholder={meta.accessCode ? '••••••' : 'Код доступа'}
                value={code} onChange={(e) => setCode(e.target.value)} />
              <button className="btn small" type="submit" style={{ minHeight: 46 }} disabled={!code.trim()}>Сохранить</button>
            </form>
            <button className="btn ghost small" onClick={checkAi} disabled={!online || checkingAi}>
              {checkingAi ? <Spinner /> : null} Проверить нейросеть
            </button>
            {aiStatus && <div className={`notice ${aiStatus.ok ? 'info' : 'error'}`}>{aiStatus.text}</div>}
          </div>
        </section>

        <section className="stack">
          <div className="section-label">Приложение</div>
          <div className="card flat row-gap">
            <div className="grow">
              <b>Версия {__APP_VERSION__}</b>
              <div className="small muted">
                {hasUpdate ? 'Новая версия скачана' : standalone ? 'Установлено на экран «Домой»' : 'Открыто в браузере'}
              </div>
            </div>
            {hasUpdate ? (
              <button className="btn small" onClick={() => void applyUpdate()} disabled={isUpdating}>
                {isUpdating ? <Spinner /> : 'Обновить'}
              </button>
            ) : (
              <button className="btn small ghost" onClick={checkUpdate} disabled={!online || checkingUpdate}>
                {checkingUpdate ? <Spinner /> : 'Проверить'}
              </button>
            )}
          </div>
        </section>

        <BackupSection />

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

function BackupSection() {
  const meta = useMeta();
  const online = useOnline();
  const [saving, setSaving] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);

  async function saveNow() {
    setSaving(true);
    try {
      await saveCloudBackup();
      toast('Копия сохранена в облаке');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function exportData() {
    const blob = new Blob([JSON.stringify(backupFile(await localRecords()), null, 2)], { type: 'application/json' });
    const file = new File([blob], `holodilnik-${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        await setMeta({ lastBackupAt: Date.now() });
        toast('Копия сохранена');
      } catch { /* закрыли окно «Поделиться» */ }
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
    await setMeta({ lastBackupAt: Date.now() });
  }

  async function importData(input: File | undefined) {
    if (!input) return;
    try {
      const { records } = parseBackupFile(await input.text());
      const products = records.filter((r) => r.kind === 'item').length;
      if (!confirm(`Восстановить копию? В ней продуктов: ${products}, всего записей: ${records.length}. Совпадающие записи на телефоне заменятся.`)) return;
      await applyBackupRecords(records);
      toast(`Восстановлено записей: ${records.length}`);
    } catch {
      toast('Это не файл резервной копии приложения');
    }
  }

  return (
    <section className="stack">
      <div className="section-label">Резервная копия</div>
      <div className="card flat stack">
        <div>
          <b>Копия в облаке</b>
          <div className="small muted">
            {!meta.accessCode
              ? 'Включится, когда введёте код доступа выше: копия шифруется им и сохраняется сама раз в день.'
              : meta.lastCloudBackupAt
                ? `Сохраняется сама раз в день, зашифрована кодом доступа. Последняя: ${formatBackupDate(meta.lastCloudBackupAt)}`
                : 'Сохраняется сама раз в день, когда есть интернет. Зашифрована кодом доступа — без него копию не прочитать.'}
          </div>
        </div>
        <div className="field-row">
          <button className="btn small ghost" onClick={saveNow} disabled={!meta.accessCode || !online || saving}>
            {saving ? <Spinner /> : 'Сохранить сейчас'}
          </button>
          <button className="btn small ghost" onClick={() => setRestoreOpen(true)} disabled={!meta.accessCode || !online}>Восстановить</button>
        </div>
      </div>
      <div className="card flat stack">
        <div>
          <b>Файл</b>
          <div className="small muted">
            {meta.lastBackupAt
              ? `Последний файл: ${new Date(meta.lastBackupAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`
              : 'Можно сохранить копию в «Файлы» или отправить себе в мессенджер.'}
          </div>
        </div>
        <div className="field-row">
          <button className="btn small ghost" onClick={exportData}>Сохранить файл</button>
          <label className="btn small ghost file-btn">
            Из файла
            <input type="file" accept="application/json,.json" onChange={(e) => { void importData(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        </div>
      </div>
      <CloudRestoreSheet open={restoreOpen} onClose={() => setRestoreOpen(false)} />
    </section>
  );
}
