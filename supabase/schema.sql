-- RoutineCheck 初期スキーマ / 秘密の質問ログイン版
-- Supabase SQL Editorでこのファイル全体を実行してください。

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.routine_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  memo text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.routine_checks (
  id uuid primary key default gen_random_uuid(),
  routine_item_id uuid not null references public.routine_items(id) on delete cascade,
  check_date date not null,
  checked boolean not null default true,
  checked_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint routine_checks_item_date_unique unique (routine_item_id, check_date)
);

create index if not exists routine_items_active_sort_idx
  on public.routine_items (is_active, sort_order, created_at);

create index if not exists routine_checks_date_idx
  on public.routine_checks (check_date);

create index if not exists routine_checks_item_date_idx
  on public.routine_checks (routine_item_id, check_date);

drop trigger if exists set_routine_items_updated_at on public.routine_items;
create trigger set_routine_items_updated_at
before update on public.routine_items
for each row execute function public.set_updated_at();

drop trigger if exists set_routine_checks_updated_at on public.routine_checks;
create trigger set_routine_checks_updated_at
before update on public.routine_checks
for each row execute function public.set_updated_at();

-- shohin-api-worker の秘密の質問ログイン後に発行される Supabase Auth セッションだけを許可します。
alter table public.routine_items enable row level security;
alter table public.routine_checks enable row level security;

-- 旧MVP版のanon許可ポリシーを削除します。
drop policy if exists "routine_items_select_anon" on public.routine_items;
drop policy if exists "routine_items_insert_anon" on public.routine_items;
drop policy if exists "routine_items_update_anon" on public.routine_items;
drop policy if exists "routine_checks_select_anon" on public.routine_checks;
drop policy if exists "routine_checks_insert_anon" on public.routine_checks;
drop policy if exists "routine_checks_update_anon" on public.routine_checks;

-- ログイン済みユーザーのみ許可します。
drop policy if exists "routine_items_select_authenticated" on public.routine_items;
create policy "routine_items_select_authenticated"
  on public.routine_items for select
  to authenticated
  using (true);

drop policy if exists "routine_items_insert_authenticated" on public.routine_items;
create policy "routine_items_insert_authenticated"
  on public.routine_items for insert
  to authenticated
  with check (true);

drop policy if exists "routine_items_update_authenticated" on public.routine_items;
create policy "routine_items_update_authenticated"
  on public.routine_items for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "routine_checks_select_authenticated" on public.routine_checks;
create policy "routine_checks_select_authenticated"
  on public.routine_checks for select
  to authenticated
  using (true);

drop policy if exists "routine_checks_insert_authenticated" on public.routine_checks;
create policy "routine_checks_insert_authenticated"
  on public.routine_checks for insert
  to authenticated
  with check (true);

drop policy if exists "routine_checks_update_authenticated" on public.routine_checks;
create policy "routine_checks_update_authenticated"
  on public.routine_checks for update
  to authenticated
  using (true)
  with check (true);

-- サンプル項目。不要なら実行後に画面から非表示にできます。
insert into public.routine_items (name, category, sort_order)
values
  ('受注確認', '朝', 10),
  ('RMS確認', '朝', 20),
  ('Yahoo確認', '朝', 30),
  ('Amazon確認', '朝', 40),
  ('NEエラー確認', '朝', 50),
  ('発注確認', '午後', 60)
on conflict do nothing;
