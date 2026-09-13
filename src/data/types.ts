import type { Recognition } from '../shared/aiSchemas';
import type { Category, Location } from '../shared/products';
import type { ItemUnit } from '../shared/units';

export type ItemSource = 'manual' | 'photo' | 'receipt' | 'text' | 'leftover';

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
}

/** Общие настройки дома — синхронизируются между телефонами */
export interface HouseholdSettings {
  servings: number;
  staples: string[];
  timeLimit: number;
}

export interface CookLogEntry {
  recipeId: string;
  title: string;
  portions: number;
  cookedAt: number;
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

export type RecordKind = 'item' | 'recipe' | 'settings' | 'cooklog' | 'shopping';

/** Любая синхронизируемая запись. dirty = 1 — ещё не отправлена на сервер */
export interface SyncRecord<T = unknown> {
  id: string;
  kind: RecordKind;
  data: T;
  updatedAt: number;
  deleted: 0 | 1;
  dirty: 0 | 1;
}

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
}

/** Настройки только этого телефона */
export interface DeviceMeta {
  onboarded: boolean;
  accessCode: string;
  householdId: string | null;
  householdName: string | null;
  inviteCode: string | null;
  syncCursor: string | null;
  lastSyncAt: number | null;
}
