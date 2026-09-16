import react from '@vitejs/plugin-react';
import type { IncomingMessage } from 'node:http';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/** Функции из папки api/: путь → модуль и обработчик */
const DEV_ROUTES: Record<string, [string, string]> = {
  '/api/ai': ['/server/ai.ts', 'handleAiRequest'],
  '/api/barcode': ['/server/barcode.ts', 'handleBarcodeRequest'],
  '/api/push': ['/server/push.ts', 'handlePushRequest'],
  '/api/backup': ['/server/backup.ts', 'handleBackupRequest'],
  '/api/log': ['/server/log.ts', 'handleLogRequest'],
};

/** В режиме разработки отвечает на /api/* тем же кодом, что и функции на Vercel */
function devApi(): Plugin {
  return {
    name: 'dev-api',
    configureServer(server) {
      for (const [route, [modulePath, handlerName]] of Object.entries(DEV_ROUTES)) server.middlewares.use(route, async (req: IncomingMessage, res) => {
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
          const request = new Request(`http://localhost${req.url ?? ''}`, {
            method: req.method,
            headers,
            body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
          });
          const mod = (await server.ssrLoadModule(modulePath)) as Record<string, (r: Request) => Promise<Response>>;
          const response = await mod[handlerName](request);
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (error) {
          console.error(error);
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: (error as Error).message }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Серверные ключи (GEMINI_API_KEY и др.) из .env.local — только для dev-сервера, в браузер не попадают
  for (const [k, v] of Object.entries(loadEnv(mode, process.cwd(), ''))) process.env[k] ??= v;

  return {
    define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.7.1') },
    server: { host: true },
    plugins: [
      react(),
      devApi(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'logo.svg'],
        manifest: {
          id: '/',
          name: 'Что в холодильнике',
          short_name: 'Холодильник',
          description: 'Продукты со сроками, рецепты из того, что есть, и нейросеть-шеф',
          lang: 'ru',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#EAF0ED',
          theme_color: '#EAF0ED',
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,wasm}'],
          // Обработчики уведомлений о сроках
          importScripts: ['push-sw.js'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              // Фото блюд из каталога — чтобы сохранённые рецепты показывались без интернета
              urlPattern: /^https:\/\/www\.themealdb\.com\/images\//,
              handler: 'CacheFirst',
              options: {
                cacheName: 'meal-images',
                expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 180 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
    },
  };
});
