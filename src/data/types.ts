import type { Recognition } from '../shared/aiSchemas';
import type { Category, Location } from '../shared/products';
import type { ItemUnit } from '../shared/units';

export type ItemSource = 'manual' | 'photo' | 'receipt' | 'text' | 'leftover' | 'barcode';

export interface Nutriments {
  kcal?: number;
  proteins?: number;
  fat?: number;
  carbs?: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  productKey: string | null;
  category: Category;
  qty: number;
  unit: ItemUnit;
  location: Location;
  purchasedAt: string;
  openedAt: string | null;
  expiresAt: string | null;
  isEstimate: boolean;
  source: ItemSource;
  createdAt: number;
  nutriments?: Nutriments;
}

/** Настройки семьи: порции, время на готовку, запасы, рацион */
export interface HouseholdSettings {
  servings: number;
  staples: string[];
  timeLimit: number;
  /** Какие приёмы пищи планировать и в какие дни готовить впрок */
  plan?: { meals: MealSlot[]; cookDays: number[] };
}

export interface CookLogEntry {
  /** Совпадает с id записи; у старых записей может отсутствовать */
  id?: string;
  recipeId: string;
  title: string;
  portions: number;
  cookedAt: number;
  /** Оценка семьи: 1 — не понравилось, 3 — нормально, 5 — очень вкусно */
  rating?: 1 | 3 | 5;
  /** Блюдо оценили, не готовя по приложению */
  ratedOnly?: boolean;
  /** Продукты с подходящим к концу сроком, которые ушли в блюдо */
  rescued?: string[];
}

/** Продукт выбросили — для итогов месяца и подсказок «берите меньше» */
export interface WasteEntry {
  id: string;
  name: string;
  productKey: string | null;
  qty: number;
  unit: ItemUnit;
  at: number;
}

export interface ShoppingItem {
  id: string;
  name: string;
  productKey: string | null;
  category: Category;
  qty: number;
  unit: ItemUnit;
  checked: boolean;
  recipeTitle?: string;
  createdAt: number;
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner';

export interface PlannedMeal {
  id: string; // e.g. `${date}_${slot}`
  date: string; // YYYY-MM-DD
  slot: MealSlot;
  recipeId: string;
  title: string;
  servings: number;
  isLeftover?: boolean;
  leftoverFromDate?: string;
  locked?: boolean;
  note?: string;
  createdAt: number;
}

export type RecordKind = 'item' | 'recipe' | 'settings' | 'cooklog' | 'shopping' | 'plan' | 'barcode' | 'waste';

/** Любая запись приложения. dirty — поле от прежней синхронизации, оставлено ради совместимости базы на телефоне */
export interface SyncRecord<T = unknown> {
  id: string;
  kind: RecordKind;
  data: T;
  updatedAt: number;
  deleted: 0 | 1;
  dirty: 0 | 1;
}

/** Режимы, фото которых разбираются в очереди и проверяются на отдельном экране */
export type ScanMode = 'shelf' | 'receipt';
export type ScanStatus = 'queued' | 'processing' | 'ready' | 'error' | 'applied';

/** Фото, ожидающие распознавания. Хранятся только на этом телефоне */
export interface ScanJob {
  id: string;
  mode: ScanMode;
  createdAt: number;
  status: ScanStatus;
  photos: Blob[];
  result?: Recognition;
  error?: string;
  hint?: string | null;
}

/** Настройки только этого телефона */
export interface DeviceMeta {
  onboarded: boolean;
  accessCode: string;
  /** Когда последний раз сохраняли резервную копию в файл */
  lastBackupAt: number | null;
  /** Последние сроки, отправленные серверу уведомлений — чтобы не слать одно и то же */
  pushScheduleHash?: string | null;
  /** Облачная копия: когда сохранили и отпечаток данных, чтобы не сохранять одно и то же */
  lastCloudBackupAt?: number | null;
  cloudBackupHash?: string | null;
}
