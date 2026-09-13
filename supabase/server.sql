-- Серверные таблицы: уведомления о сроках и облачные резервные копии.
-- Выполните в Supabase: SQL Editor → New query → Run. Вход по почте для этого не нужен.
-- Таблицы читает и пишет только сервер (api/push, api/cron/expiry, api/backup) ключом service_role.

create table if not exists public.push_devices (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  time_zone text not null default 'Europe/Moscow',
  items jsonb not null default '[]'::jsonb,
  last_sent_on date,
  updated_at timestamptz not null default now()
);

-- Политик нет: из браузера таблица недоступна, service_role обходит RLS
alter table public.push_devices enable row level security;
revoke all on public.push_devices from anon, authenticated;

-- Облачные резервные копии. Зашифрованы на телефоне кодом доступа; хранятся последние 5.
create table if not exists public.backups (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  records integer not null,
  products integer not null,
  size integer not null,
  payload text not null
);

create index if not exists backups_created_idx on public.backups (created_at desc);

alter table public.backups enable row level security;
revoke all on public.backups from anon, authenticated;
