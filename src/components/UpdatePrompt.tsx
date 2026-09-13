import { usePwaUpdate } from '../lib/pwaUpdate';
import { Spinner } from './ui';

export function UpdatePrompt() {
  const { hasUpdate, isUpdating, dismissed, applyUpdate, dismissUpdate } = usePwaUpdate();
  if (!hasUpdate || dismissed) return null;

  return (
    <div className="update-bar" role="status">
      <div className="grow">
        <b>Готова новая версия</b>
        <span>Установится сама, когда свернёте приложение</span>
      </div>
      <button type="button" className="btn small quiet" onClick={dismissUpdate} disabled={isUpdating}>Позже</button>
      <button type="button" className="btn small" onClick={() => void applyUpdate()} disabled={isUpdating}>
        {isUpdating ? <Spinner /> : 'Обновить'}
      </button>
    </div>
  );
}
