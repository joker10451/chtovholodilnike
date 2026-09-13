import { Component, type ReactNode } from 'react';

/** Устаревший кусок приложения после обновления: сервер уже отдаёт новую версию */
function isChunkError(error: Error): boolean {
  return /dynamically imported module|Importing a module script failed|Failed to fetch dynamically|Loading chunk/i.test(error.message);
}

const RELOAD_KEY = 'holodilnik:chunk-reload';

interface State { error: Error | null }

/** Если экран упал, показываем понятное сообщение вместо белого экрана. Данные остаются на телефоне */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
    if (isChunkError(error)) {
      // Один раз перезагружаем сами — обычно после этого открывается новая версия
      try {
        if (sessionStorage.getItem(RELOAD_KEY) !== '1') {
          sessionStorage.setItem(RELOAD_KEY, '1');
          location.reload();
        }
      } catch { /* sessionStorage недоступен */ }
    }
  }

  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const offline = !navigator.onLine && isChunkError(error);
    return (
      <main className="screen crash">
        <div className="crash-card">
          <b>{offline ? 'Этот раздел ещё не скачан' : 'Что-то пошло не так'}</b>
          <p>
            {offline
              ? 'Откройте его один раз с интернетом — дальше он будет работать и без сети.'
              : 'Продукты и рецепты сохранены на телефоне. Попробуйте открыть экран заново.'}
          </p>
          <div className="stack">
            <button className="btn block" onClick={() => location.reload()}>Перезагрузить</button>
            <a className="btn ghost block" href="#/fridge" onClick={() => this.setState({ error: null })}>К холодильнику</a>
          </div>
          {!offline && <details><summary>Подробности для разработчика</summary><code>{error.message}</code></details>}
        </div>
      </main>
    );
  }
}
