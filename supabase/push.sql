-- Уведомления о сроках: подписанные телефоны и сроки их продуктов (только названия и даты).
-- Выполните в Supabase: SQL Editor → New query → Run. Вход по почте для этого не нужен.
-- Таблицу читает и пишет только сервер (api/push, api/cron/expiry) ключом service_role.

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
