// Серверное хранилище (Supabase) для уведомлений и облачных копий. Доступ только ключом service_role.
import { createClient } from '@supabase/supabase-js';

export function serverDb() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}
