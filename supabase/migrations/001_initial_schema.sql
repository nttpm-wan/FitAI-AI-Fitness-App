create extension if not exists pgcrypto;

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  name text not null default 'FITAI Member',
  age smallint check (age is null or age between 1 and 120),
  gender text,
  height numeric(5, 2),
  weight numeric(5, 2),
  handle text,
  plan text not null default 'free',
  workouts integer not null default 0 check (workouts >= 0),
  streak integer not null default 0 check (streak >= 0),
  score integer not null default 0 check (score >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null default 'strength',
  muscle text,
  sets integer not null default 0 check (sets >= 0),
  reps integer not null default 0 check (reps >= 0),
  kcal integer not null default 0 check (kcal >= 0),
  duration integer not null default 0 check (duration >= 0),
  level text,
  tag text,
  created_at timestamptz not null default now()
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  category text not null default 'general',
  target numeric(12, 2) not null default 0,
  current numeric(12, 2) not null default 0,
  unit text not null default '',
  color text,
  icon text,
  deadline text,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  meal text not null default 'snack',
  food text not null,
  kcal integer not null default 0 check (kcal >= 0),
  protein numeric(8, 2) not null default 0 check (protein >= 0),
  carbs numeric(8, 2) not null default 0 check (carbs >= 0),
  fat numeric(8, 2) not null default 0 check (fat >= 0),
  time text,
  created_at timestamptz not null default now()
);

create table public.progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  weight numeric(5, 2),
  height numeric(5, 2),
  body_fat numeric(5, 2),
  bmi numeric(5, 2),
  created_at timestamptz not null default now()
);

create table public.sleep (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  hours numeric(4, 2) not null default 0 check (hours between 0 and 24),
  quality smallint check (quality is null or quality between 0 and 100),
  deep numeric(4, 2) not null default 0,
  light numeric(4, 2) not null default 0,
  rem numeric(4, 2) not null default 0,
  bed_time text,
  wake_time text,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null default 'workout',
  title text not null,
  body text not null default '',
  icon text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null,
  user_name text not null default 'FITAI Member',
  user_initials text not null default 'FM',
  avatar_color text not null default '#FF6B1A',
  likes uuid[] not null default '{}',
  comments integer not null default 0 check (comments >= 0),
  created_at timestamptz not null default now()
);

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  category text not null check (category in ('active', 'upcoming', 'completed')),
  icon text,
  members integer not null default 0 check (members >= 0),
  days_left integer not null default 0 check (days_left >= 0),
  reward text,
  progress numeric(5, 4) not null default 0 check (progress between 0 and 1),
  created_at timestamptz not null default now()
);

create table public.challenge_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, challenge_id)
);

create table public.settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_name text not null,
  level text not null default 'info' check (level in ('info', 'warning', 'error')),
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index workouts_user_created_idx on public.workouts (user_id, created_at desc);
create index goals_user_created_idx on public.goals (user_id, created_at desc);
create index meals_user_created_idx on public.meals (user_id, created_at desc);
create index progress_user_created_idx on public.progress (user_id, created_at desc);
create index sleep_user_created_idx on public.sleep (user_id, created_at desc);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index posts_created_idx on public.posts (created_at desc);
create index challenge_members_user_idx on public.challenge_members (user_id);
create index challenge_members_challenge_idx on public.challenge_members (challenge_id);
create index analytics_events_user_created_idx on public.analytics_events (user_id, created_at desc);

alter table public.users enable row level security;
alter table public.workouts enable row level security;
alter table public.goals enable row level security;
alter table public.meals enable row level security;
alter table public.progress enable row level security;
alter table public.sleep enable row level security;
alter table public.notifications enable row level security;
alter table public.posts enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_members enable row level security;
alter table public.settings enable row level security;
alter table public.analytics_events enable row level security;

create policy users_select_own on public.users for select to authenticated using ((select auth.uid()) = id);
create policy users_insert_own on public.users for insert to authenticated with check ((select auth.uid()) = id);
create policy users_update_own on public.users for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy workouts_own on public.workouts for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy goals_own on public.goals for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy meals_own on public.meals for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy progress_own on public.progress for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy sleep_own on public.sleep for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy notifications_own on public.notifications for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy posts_read_authenticated on public.posts for select to authenticated using (true);
create policy posts_insert_own on public.posts for insert to authenticated with check ((select auth.uid()) = user_id);
create policy posts_update_own on public.posts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy posts_delete_own on public.posts for delete to authenticated using ((select auth.uid()) = user_id);
create policy challenges_read_authenticated on public.challenges for select to authenticated using (true);
create policy challenge_members_own on public.challenge_members for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy settings_own on public.settings for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy analytics_events_insert_own on public.analytics_events for insert to authenticated with check ((select auth.uid()) = user_id);
create policy analytics_events_select_own on public.analytics_events for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.create_fitai_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email, name, age, gender)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1), 'FITAI Member'),
    case
      when (new.raw_user_meta_data ->> 'age') ~ '^[0-9]{1,3}$'
        then (new.raw_user_meta_data ->> 'age')::smallint
      else null
    end,
    nullif(new.raw_user_meta_data ->> 'gender', '')
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_fitai on auth.users;
create trigger on_auth_user_created_fitai
  after insert on auth.users
  for each row execute procedure public.create_fitai_user_profile();

create or replace function public.get_leaderboard()
returns table (id uuid, name text, streak integer, score integer, workouts integer)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.name, u.streak, u.score, u.workouts
  from public.users as u
  order by u.score desc, u.streak desc
  limit 50;
$$;

revoke all on function public.get_leaderboard() from public;
grant execute on function public.get_leaderboard() to authenticated;

insert into public.challenges (id, title, description, category, icon, days_left, reward, progress)
values
  ('72aa448a-5b88-4a72-8f10-2a1f1c500001', '7 วันเริ่มขยับ', 'สะสมการออกกำลังกายให้ครบ 7 วัน', 'active', '🔥', 7, 'Starter badge', 0),
  ('72aa448a-5b88-4a72-8f10-2a1f1c500002', 'เดินให้ครบ 50,000 ก้าว', 'ค่อย ๆ สะสมจำนวนก้าวในสัปดาห์นี้', 'upcoming', '👟', 5, 'Walker badge', 0),
  ('72aa448a-5b88-4a72-8f10-2a1f1c500003', 'ดื่มน้ำทุกวัน', 'บันทึกการดื่มน้ำต่อเนื่อง 5 วัน', 'completed', '💧', 0, 'Hydration badge', 1)
on conflict (id) do nothing;
