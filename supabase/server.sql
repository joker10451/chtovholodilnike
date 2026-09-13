-- Серверные таблицы: уведомления о сроках, облачные копии, журнал ошибок и лимиты запросов.
-- Выполните в Supabase: SQL Editor → New query → Run. Вход по почте для этого не нужен.
-- Таблицы читает и пишет только сервер (функции из папки api/) ключом service_role.

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

-- Журнал ошибок с телефона: без продуктов и личных данных; хранится 90 дней.
create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  app_version text not null,
  screen text not null,
  kind text not null,
  message text not null,
  stack text,
  device text,
  count integer not null default 1
);

create index if not exists client_errors_created_idx on public.client_errors (created_at desc);

alter table public.client_errors enable row level security;
revoke all on public.client_errors from anon, authenticated;

-- Лимиты запросов: защищают бесплатную квоту нейросети и журнал ошибок от перерасхода.
create table if not exists public.api_usage (
  bucket text primary key,
  count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.api_usage enable row level security;
revoke all on public.api_usage from anon, authenticated;

create or replace function public.take_quota(p_bucket text, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  used integer;
begin
  insert into api_usage as u (bucket, count, updated_at) values (p_bucket, 1, now())
    on conflict (bucket) do update set count = u.count + 1, updated_at = now()
    returning u.count into used;
  if random() < 0.02 then
    delete from api_usage where updated_at < now() - interval '3 days';
    delete from client_errors where created_at < now() - interval '90 days';
  end if;
  return used <= p_limit;
end;
$$;

revoke execute on function public.take_quota(text, integer) from public, anon, authenticated;
grant execute on function public.take_quota(text, integer) to service_role;
