import { useEffect } from 'react';
import { IconBook, IconCal, IconCart, IconFridge, IconScan } from './components/icons';
import { ToastHost } from './components/ui';
import { UpdatePrompt } from './components/UpdatePrompt';
import { useMetaLoading, useShoppingList } from './data/repo';
import { processScanQueue, recoverScans } from './data/scanQueue';
import { startSync } from './data/sync';
import { href, useRoute } from './router';
import { Catalog } from './screens/Catalog';
import { Chef } from './screens/Chef';
import { Cook } from './screens/Cook';
import { Fridge } from './screens/Fridge';
import { Onboarding } from './screens/Onboarding';
import { Plan } from './screens/Plan';
import { RecipeDetail } from './screens/RecipeDetail';
import { Recipes } from './screens/Recipes';
import { Review } from './screens/Review';
import { Scan } from './screens/Scan';
import { Settings } from './screens/Settings';
import { Shopping } from './screens/Shopping';

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
  const shopping = useShoppingList();
  const unboughtCount = shopping?.filter((i) => !i.checked).length ?? 0;

  useEffect(() => startSync(), []);
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
  const showTabs = !['cook', 'recipe', 'catalog', 'scan'].includes(route.name);
  const tab = TAB_OF[route.name] ?? 'fridge';

  return (
    <div className="app">
      {screen}
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
          <a className={`tab${tab === 'shopping' ? ' on' : ''}`} href={href('shopping')} style={{ position: 'relative' }}>
            <IconCart />
            Покупки
            {unboughtCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 'calc(50% - 16px)',
                  background: 'var(--brand)',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  height: 16,
                  minWidth: 16,
                  padding: '0 4px',
                  borderRadius: 999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
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