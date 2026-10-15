-- JomBit account profiles and versioned app state.
-- Run this migration with the Supabase CLI, or paste it once into the SQL Editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'JomBit Member' check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jombit_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  schema_version integer not null default 1 check (schema_version > 0),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  device_id text not null check (char_length(device_id) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.jombit_states enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "states_select_own" on public.jombit_states
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "states_insert_own" on public.jombit_states
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "states_update_own" on public.jombit_states
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "states_delete_own" on public.jombit_states
  for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists jombit_states_set_updated_at on public.jombit_states;
create trigger jombit_states_set_updated_at before update on public.jombit_states
for each row execute function public.set_updated_at();

create or replace function public.create_jombit_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'JomBit Member'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_jombit_profile_after_signup on auth.users;
create trigger create_jombit_profile_after_signup
after insert on auth.users for each row execute function public.create_jombit_profile();

do $$
begin
  alter publication supabase_realtime add table public.jombit_states;
exception
  when duplicate_object then null;
end $$;
