// Шрифты лежат в приложении, чтобы работать без интернета. Только кириллица и латиница.
import '@fontsource/onest/cyrillic-400.css';
import '@fontsource/onest/latin-400.css';
import '@fontsource/onest/cyrillic-600.css';
import '@fontsource/onest/latin-600.css';
import '@fontsource/onest/cyrillic-700.css';
import '@fontsource/onest/latin-700.css';
import '@fontsource/unbounded/cyrillic-500.css';
import '@fontsource/unbounded/latin-500.css';
import '@fontsource/unbounded/cyrillic-700.css';
import '@fontsource/unbounded/latin-700.css';
import '@fontsource/jetbrains-mono/cyrillic-600.css';
import '@fontsource/jetbrains-mono/latin-600.css';
import './styles.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';

// Новая версия приложения подтянется сама при следующем запуске
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
