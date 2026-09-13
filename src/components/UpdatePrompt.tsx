import { usePwaUpdate } from '../lib/pwaUpdate';
import { Spinner } from './ui';

export function UpdatePrompt() {
  const { hasUpdate, isUpdating, dismissed, applyUpdate, dismissUpdate } = usePwaUpdate();

  if (!hasUpdate || dismissed) return null;

  return (
    <div className="update-prompt-scrim" onClick={dismissUpdate}>
      <div
        className="update-prompt-card"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-label="Доступно обновление"
      >
        <div className="update-prompt-badge">✨ Вышло обновление</div>
        <h3 style={{ margin: '8px 0 6px', fontSize: 19, fontWeight: 700 }}>
          Приложение обновилось
        </h3>
        <p className="small muted" style={{ margin: '0 0 18px', lineHeight: 1.45 }}>
          Доступны новые функции и улучшения. Обновите сейчас, чтобы применить свежую версию без потери данных.
        </p>
        <div className="row-gap" style={{ width: '100%' }}>
          <button
            type="button"
            className="btn quiet"
            style={{ flex: 1 }}
            onClick={dismissUpdate}
            disabled={isUpdating}
          >
            Позже
          </button>
          <button
            type="button"
            className="btn primary"
            style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            onClick={() => void applyUpdate()}
            disabled={isUpdating}
          >
            {isUpdating ? <Spinner /> : null}
            {isUpdating ? 'Обновляю…' : 'Обновить'}
          </button>
        </div>
      </div>
    </div>
  );
}
