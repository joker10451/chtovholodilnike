-- Схема для синхронизации «Что в холодильнике» между двумя телефонами. Необязательно:
-- одному телефону она не нужна. Для уведомлений о сроках достаточно supabase/push.sql.
-- Выполните целиком в Supabase: SQL Editor → New query → Run.

-- Дом (семья) и его участники
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Наш дом',
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- Все данные приложения: продукты, рецепты, настройки, журнал готовки
create table if not exists public.records (
  household_id uuid not null references public.households(id) on delete cascade,
  id text not null,
  kind text not null check (kind in ('item', 'recipe', 'settings', 'cooklog', 'shopping', 'plan', 'barcode')),
  data jsonb not null,
  updated_at bigint not null,
  deleted boolean not null default false,
  synced_at timestamptz not null default now(),
  primary key (household_id, id)
);

create index if not exists records_sync_idx on public.records (household_id, synced_at);

-- Последнее изменение побеждает: более старая версия с другого телефона не перезапишет новую
create or replace function public.records_last_write_wins()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null;
  end if;
  new.synced_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists records_lww on public.records;
create trigger records_lww
  before insert or update on public.records
  for each row execute function public.records_last_write_wins();

-- Доступ только участникам дома
create or replace function public.is_household_member(p_household uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from household_members where household_id = p_household and user_id = auth.uid()
  );
$$;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.records enable row level security;

drop policy if exists "members read household" on public.households;
create policy "members read household" on public.households
  for select using (public.is_household_member(id));

drop policy if exists "members read members" on public.household_members;
create policy "members read members" on public.household_members
  for select using (public.is_household_member(household_id));

drop policy if exists "members read records" on public.records;
create policy "members read records" on public.records
  for select using (public.is_household_member(household_id));

drop policy if exists "members insert records" on public.records;
create policy "members insert records" on public.records
  for insert with check (public.is_household_member(household_id));

drop policy if exists "members update records" on public.records;
create policy "members update records" on public.records
  for update using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- Создать дом и сразу стать его участником
create or replace function public.create_household(p_name text)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  h public.households;
  code text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  loop
    code := upper(substr(translate(md5(random()::text || clock_timestamp()::text), '01', ''), 1, 6));
    exit when length(code) = 6 and not exists (select 1 from households where invite_code = code);
  end loop;
  insert into households (name, invite_code) values (coalesce(nullif(trim(p_name), ''), 'Наш дом'), code)
    returning * into h;
  insert into household_members (household_id, user_id) values (h.id, auth.uid());
  return h;
end;
$$;

-- Присоединиться к дому по коду приглашения
create or replace function public.join_household(p_code text)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  h public.households;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select * into h from households where invite_code = upper(trim(p_code));
  if h.id is null then
    raise exception 'household not found';
  end if;
  insert into household_members (household_id, user_id) values (h.id, auth.uid())
    on conflict do nothing;
  return h;
end;
$$;

-- Дом текущего пользователя (для входа на новом телефоне)
create or replace function public.my_household()
returns setof public.households
language sql
security definer
set search_path = public
stable
as $$
  select h.* from households h
  join household_members m on m.household_id = h.id
  where m.user_id = auth.uid()
  order by m.joined_at
  limit 1;
$$;

-- Функции дома — только для вошедших (по умолчанию Postgres разрешает их всем через public)
revoke execute on function public.create_household(text) from public, anon;
revoke execute on function public.join_household(text) from public, anon;
revoke execute on function public.my_household() from public, anon;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text) to authenticated;
grant execute on function public.my_household() to authenticated;

-- Мгновенные обновления между телефонами
do $$
begin
  alter publication supabase_realtime add table public.records;
exception when duplicate_object then null;
end;
$$;

-- Обновление для базы, созданной раньше: разрешаем покупки, рацион и семейную базу штрихкодов.
-- Без этого синхронизация останавливается на первой записи нового типа.
alter table public.records drop constraint if exists records_kind_check;
alter table public.records add constraint records_kind_check
  check (kind in ('item', 'recipe', 'settings', 'cooklog', 'shopping', 'plan', 'barcode'));
