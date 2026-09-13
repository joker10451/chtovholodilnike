import { useEffect, useState } from 'react';
import { Sheet, Spinner, toast } from '../components/ui';
import { setMeta } from '../data/db';
import { applyBackupRecords, fetchCloudBackup, formatBackupDate, listCloudBackups, type CloudBackupInfo } from '../lib/cloudBackup';
import { plural } from './Fridge';

/** Восстановление из облачной копии. askCode — телефон новый, код доступа ещё не введён */
export function CloudRestoreSheet({ open, onClose, askCode, onRestored }: {
  open: boolean;
  onClose: () => void;
  askCode?: boolean;
  onRestored?: () => void;
}) {
  const [code, setCode] = useState('');
  const [backups, setBackups] = useState<CloudBackupInfo[] | null>(null);
  const [chosen, setChosen] = useState<CloudBackupInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(withCode?: string) {
    setBusy(true);
    setError(null);
    try {
      setBackups(await listCloudBackups(withCode));
    } catch (e) {
      const message = (e as Error).message;
      setError(askCode && message.startsWith('Неверный код') ? 'Неверный код доступа. Попробуйте ещё раз.' : message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!open) { setBackups(null); setChosen(null); setError(null); return; }
    if (!askCode) void load();
  }, [open, askCode]);

  async function restore(b: CloudBackupInfo) {
    setBusy(true);
    setError(null);
    try {
      const file = await fetchCloudBackup(b.id, askCode ? code.trim() : undefined);
      await applyBackupRecords(file.records);
      // Копия с этого телефона уже есть в облаке — первую автокопию после восстановления не делаем
      await setMeta({ ...(askCode ? { accessCode: code.trim() } : {}), lastCloudBackupAt: Date.now() });
      toast(`Восстановлено: ${b.products} ${plural(b.products, 'продукт', 'продукта', 'продуктов')}`);
      onRestored?.();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const needCode = askCode && backups === null;

  return (
    <Sheet open={open} onClose={onClose} title="Копия в облаке">
      <div className="stack">
        {needCode ? (
          <>
            <p className="small muted">Введите код доступа, который был в приложении, — им зашифрованы копии.</p>
            <input className="input" type="password" autoComplete="off" placeholder="Код доступа" value={code} onChange={(e) => setCode(e.target.value)} />
            <button className="btn block" disabled={busy || !code.trim()} onClick={() => void load(code.trim())}>
              {busy ? <Spinner /> : 'Найти копии'}
            </button>
          </>
        ) : busy && !backups ? (
          <div className="row-gap muted small"><Spinner /> Ищу копии…</div>
        ) : backups && backups.length === 0 ? (
          <p className="small muted">В облаке пока нет копий. Они появятся сами, когда в приложении будут продукты и код доступа.</p>
        ) : backups ? (
          <>
            <p className="small muted">Хранятся последние {backups.length} {plural(backups.length, 'копия', 'копии', 'копий')}. Продукты и рецепты из копии добавятся к тому, что есть на телефоне.</p>
            <div className="stack">
              {backups.map((b) => (
                <div key={b.id} className="card flat row-gap">
                  <div className="grow">
                    <b>{formatBackupDate(b.createdAt)}</b>
                    <div className="small muted">{b.products} {plural(b.products, 'продукт', 'продукта', 'продуктов')} · {b.records} {plural(b.records, 'запись', 'записи', 'записей')}</div>
                  </div>
                  {chosen?.id === b.id ? (
                    <button className="btn small" disabled={busy} onClick={() => void restore(b)}>{busy ? <Spinner /> : 'Точно?'}</button>
                  ) : (
                    <button className="btn small ghost" disabled={busy} onClick={() => setChosen(b)}>Восстановить</button>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : null}
        {error && <p className="small" style={{ color: 'var(--bad)' }}>{error}</p>}
      </div>
    </Sheet>
  );
}
