import type { SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** false — синхронизация не настроена, приложение работает только на этом телефоне */
export const syncConfigured = Boolean(url && anonKey);

let client: Promise<SupabaseClient> | null = null;

/** Библиотека Supabase загружается только тем, у кого включена синхронизация — запуск быстрее */
export function getSupabase(): Promise<SupabaseClient> {
  if (!syncConfigured) return Promise.reject(new Error('Синхронизация не настроена'));
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(url!, anonKey!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }),
  );
  return client;
}

export interface Household {
  id: string;
  name: string;
  invite_code: string;
}
