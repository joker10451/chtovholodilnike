import { lazy, Suspense, useEffect } from 'react';
import { IconBook, IconCal, IconCart, IconFridge, IconScan } from './components/icons';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Spinner, ToastHost, useOnline } from './components/ui';
import { UpdatePrompt } from './components/UpdatePrompt';
import { useMetaLoading, useShoppingList } from './data/repo';
import { processScanQueue, recoverScans } from './data/scanQueue';
import { startSync } from './data/sync';
import { href, useRoute } from './router';
import { Fridge } from './screens/Fridge';
import { Onboarding } from './screens/Onboarding';

// Холодильник открывается сразу, остальные экраны подгружаются при первом переходе.
// Все они заранее сохранены в кэше приложения, поэтому работают и без интернета.
const screens = {
  Recipes: () => import('./screens/Recipes').then((m) => ({ default: m.Recipes })),
  RecipeDetail: () => import('./screens/RecipeDetail').then((m) => ({ default: m.RecipeDetail })),
  Cook: () => import('./screens/Cook').then((m) => ({ default: m.Cook })),
  Catalog: () => import('./screens/Catalog').then((m) => ({ default: m.Catalog })),
  Scan: () => import('./screens/Scan').then((m) => ({ default: m.Scan })),
  Review: () => import('./screens/Review').then((m) => ({ default: m.Review })),
  Plan: () => import('./screens/Plan').then((m) => ({ default: m.Plan })),
  Shopping: () => import('./screens/Shopping').then((m) => ({ default: m.Shopping })),
  Chef: () => import('./screens/Chef').then((m) => ({ default: m.Chef })),
  Settings: () => import('./screens/Settings').then((m) => ({ default: m.Settings })),
};
const Recipes = lazy(screens.Recipes);
const RecipeDetail = lazy(screens.RecipeDetail);
const Cook = lazy(screens.Cook);
const Catalog = lazy(screens.Catalog);
const Scan = lazy(screens.Scan);
const Review = lazy(screens.Review);
const Plan = lazy(screens.Plan);
const Shopping = lazy(screens.Shopping);
const Chef = lazy(screens.Chef);
const Settings = lazy(screens.Settings);

/** Когда приложение открылось и ничего не делает — заранее загружаем частые экраны, чтобы переходы были мгновенными */
function preloadScreens() {
  const run = () => { void screens.Scan(); void screens.Recipes(); void screens.Shopping(); void screens.Plan(); };
  if ('requestIdleCallback' in window) (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(run);
  else setTimeout(run, 1500);
}

const TAB_OF: Record<string, string> = {
  fridge: 'fridge',
  recipes: 'recipes',
  recipe: 'recipes',
  catalog: 'recipes',
  scan: 'scan',
  review: 'scan',
  plan: 'plan',
  shopping: 'shopping',
  chef: 'recipes',
  settings: 'fridge',
};

export function App() {
  const meta = useMetaLoading();
  const route = useRoute();
  const online = useOnline();
  const shopping = useShoppingList();
  const unboughtCount = shopping?.filter((i) => !i.checked).length ?? 0;

  useEffect(() => startSync(), []);
  useEffect(() => {
    preloadScreens();
    try { sessionStorage.removeItem('holodilnik:chunk-reload'); } catch { /* недоступно */ }
    // Просим браузер не удалять данные приложения при нехватке места
    void navigator.storage?.persisted?.().then((ok) => { if (!ok) void navigator.storage.persist?.(); }).catch(() => {});
  }, []);
  useEffect(() => {
    void recoverScans().then(processScanQueue);
    const onOnline = () => void processScanQueue();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  if (!meta) return null;
  if (!meta.onboarded) return <Onboarding />;

  const [param] = route.params;
  let screen;
  switch (route.name) {
    case 'recipes': screen = <Recipes />; break;
    case 'recipe': screen = <RecipeDetail id={param} />; break;
    case 'cook': screen = <Cook id={param} portions={Number(route.query.get('portions')) || 2} />; break;
    case 'catalog': screen = <Catalog />; break;
    case 'scan': screen = <Scan />; break;
    case 'review': screen = <Review id={param} />; break;
    case 'plan': screen = <Plan />; break;
    case 'shopping': screen = <Shopping />; break;
    case 'chef': screen = <Chef />; break;
    case 'settings': screen = <Settings />; break;
    default: screen = <Fridge />;
  }
  const showTabs = !['cook', 'recipe', 'catalog', 'scan', 'review'].includes(route.name);
  const tab = TAB_OF[route.name] ?? 'fridge';

  return (
    <div className="app">
      {!online && showTabs && (
        <div className="offline-bar" role="status">Нет интернета · нейросеть и синхронизация подождут</div>
      )}
      <ErrorBoundary resetKey={route.name + route.params.join('/')}>
        <Suspense fallback={<main className="screen screen-loading"><Spinner /></main>}>{screen}</Suspense>
      </ErrorBoundary>
      {showTabs && (
        <nav className="tabbar" aria-label="Разделы">
          <a className={`tab${tab === 'fridge' ? ' on' : ''}`} href={href('fridge')}>
            <IconFridge />
            Холодильник
          </a>
          <a className={`tab${tab === 'recipes' ? ' on' : ''}`} href={href('recipes')}>
            <IconBook />
            Рецепты
          </a>
          <div className="fab-wrap">
            <a className="fab" href={href('scan')} aria-label="Скан">
              <IconScan />
            </a>
          </div>
          <a className={`tab${tab === 'plan' ? ' on' : ''}`} href={href('plan')}>
            <IconCal />
            Рацион
          </a>
          <a className={`tab${tab === 'shopping' ? ' on' : ''}`} href={href('shopping')}>
            <IconCart />
            Покупки
            {unboughtCount > 0 && (
              <span className="tab-badge num">
                {unboughtCount}
              </span>
            )}
          </a>
        </nav>
      )}
      <ToastHost />
      <UpdatePrompt />
    </div>
  );
}