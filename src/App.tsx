import { useEffect } from 'react';
import { IconBook, IconChef, IconFridge, IconMore, IconScan } from './components/icons';
import { ToastHost } from './components/ui';
import { useMetaLoading } from './data/repo';
import { processScanQueue, recoverScans } from './data/scanQueue';
import { startSync } from './data/sync';
import { href, useRoute } from './router';
import { Catalog } from './screens/Catalog';
import { Chef } from './screens/Chef';
import { Cook } from './screens/Cook';
import { Fridge } from './screens/Fridge';
import { Onboarding } from './screens/Onboarding';
import { RecipeDetail } from './screens/RecipeDetail';
import { Recipes } from './screens/Recipes';
import { Review } from './screens/Review';
import { Scan } from './screens/Scan';
import { Settings } from './screens/Settings';

const TAB_OF: Record<string, string> = {
  fridge: 'fridge', recipes: 'recipes', recipe: 'recipes', catalog: 'recipes', scan: 'scan', review: 'scan', chef: 'chef', settings: 'settings',
};

export function App() {
  const meta = useMetaLoading();
  const route = useRoute();

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
    case 'chef': screen = <Chef />; break;
    case 'settings': screen = <Settings />; break;
    default: screen = <Fridge />;
  }
  const showTabs = !['cook', 'recipe', 'catalog'].includes(route.name);
  const tab = TAB_OF[route.name] ?? 'fridge';

  return (
    <div className="app">
      {screen}
      {showTabs && (
        <nav className="tabbar" aria-label="Разделы">
          <a className={`tab${tab === 'fridge' ? ' on' : ''}`} href={href('fridge')}><IconFridge />Холодильник</a>
          <a className={`tab${tab === 'recipes' ? ' on' : ''}`} href={href('recipes')}><IconBook />Рецепты</a>
          <div className="fab-wrap"><a className="fab" href={href('scan')} aria-label="Скан"><IconScan /></a></div>
          <a className={`tab${tab === 'chef' ? ' on' : ''}`} href={href('chef')}><IconChef />Шеф</a>
          <a className={`tab${tab === 'settings' ? ' on' : ''}`} href={href('settings')}><IconMore />Настройки</a>
        </nav>
      )}
      <ToastHost />
    </div>
  );
}
