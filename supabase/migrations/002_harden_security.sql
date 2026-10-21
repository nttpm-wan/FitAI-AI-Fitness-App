-- Tighten client privileges after 001_initial_schema.sql has been applied.

-- Profiles are created by the auth.users trigger. Clients may edit profile fields,
-- but may not create rows or write leaderboard-owned counters.
drop policy if exists users_insert_own on public.users;
revoke all on table public.users from public, anon, authenticated;
grant select on table public.users to authenticated;
grant update (name, age, gender, height, weight, handle)
  on table public.users to authenticated;

-- Workout rows are inserted through a rate-limited SECURITY DEFINER function so
-- the client cannot write score/workout counters directly.
drop policy if exists workouts_own on public.workouts;
create policy workouts_select_own
  on public.workouts for select to authenticated
  using ((select auth.uid()) = user_id);
revoke all on table public.workouts from public, anon, authenticated;
grant select on table public.workouts to authenticated;

create or replace function public.create_workout(
  p_id uuid,
  p_name text,
  p_type text,
  p_muscle text,
  p_sets integer,
  p_reps integer,
  p_kcal integer,
  p_duration integer,
  p_level text,
  p_tag text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_id uuid;
  v_workout_id uuid := coalesce(p_id, gen_random_uuid());
  v_workout_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_name is null or length(btrim(p_name)) not between 1 and 120
     or coalesce(p_sets, -1) not between 1 and 100
     or coalesce(p_reps, -1) not between 1 and 5000
     or coalesce(p_kcal, -1) not between 0 and 5000
     or coalesce(p_duration, -1) not between 1 and 1440 then
    raise exception 'Invalid workout data' using errcode = '22023';
  end if;

  -- Serialize each user's submissions so parallel requests cannot bypass the cap.
  perform 1 from public.users where id = v_user_id for update;
  if not found then
    raise exception 'User profile is missing' using errcode = '23503';
  end if;

  select id into v_existing_id
  from public.workouts
  where id = v_workout_id and user_id = v_user_id;
  if found then
    return v_existing_id;
  end if;

  select count(*) into v_workout_count
  from public.workouts
  where user_id = v_user_id
    and created_at >= now() - interval '24 hours';
  if v_workout_count >= 20 then
    raise exception 'Daily workout entry limit reached' using errcode = '22023';
  end if;

  insert into public.workouts (
    id, user_id, name, type, muscle, sets, reps, kcal, duration, level, tag
  ) values (
    v_workout_id,
    v_user_id,
    btrim(p_name),
    left(coalesce(nullif(btrim(p_type), ''), 'strength'), 40),
    left(nullif(btrim(p_muscle), ''), 80),
    p_sets,
    p_reps,
    p_kcal,
    p_duration,
    left(nullif(btrim(p_level), ''), 40),
    left(nullif(btrim(p_tag), ''), 40)
  );

  update public.users
  set workouts = workouts + 1,
      score = score + 10,
      updated_at = now()
  where id = v_user_id;

  return v_workout_id;
end;
$$;

revoke all on function public.create_workout(uuid, text, text, text, integer, integer, integer, integer, text, text) from public, anon;
grant execute on function public.create_workout(uuid, text, text, text, integer, integer, integer, integer, text, text) to authenticated;

-- Feed authorship is taken from the authenticated user's profile. Clients may
-- only create content; they cannot forge names, counts, or likes on a post.
drop policy if exists posts_update_own on public.posts;
revoke all on table public.posts from public, anon, authenticated;
grant insert (id, user_id, content) on table public.posts to authenticated;
grant select, delete on table public.posts to authenticated;

create or replace function public.set_fitai_post_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  select coalesce(nullif(btrim(u.name), ''), 'FITAI Member')
  into v_name
  from public.users as u
  where u.id = new.user_id;

  new.user_name := coalesce(v_name, 'FITAI Member');
  new.user_initials := upper(left(new.user_name, 2));
  new.avatar_color := '#FF6B1A';
  new.likes := '{}'::uuid[];
  new.comments := 0;
  return new;
end;
$$;

drop trigger if exists set_fitai_post_author_before_insert on public.posts;
create trigger set_fitai_post_author_before_insert
  before insert on public.posts
  for each row execute function public.set_fitai_post_author();

alter table public.posts
  add constraint posts_content_length_check
  check (length(btrim(content)) between 1 and 2000) not valid;

create table public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index post_likes_user_idx on public.post_likes (user_id, created_at desc);
alter table public.post_likes enable row level security;

create policy post_likes_read_authenticated
  on public.post_likes for select to authenticated using (true);
create policy post_likes_insert_own
  on public.post_likes for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy post_likes_delete_own
  on public.post_likes for delete to authenticated
  using ((select auth.uid()) = user_id);
revoke all on table public.post_likes from public, anon, authenticated;
grant select, insert, delete on table public.post_likes to authenticated;

create or replace function public.toggle_post_like(p_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  perform 1 from public.posts where id = p_post_id for update;
  if not found then
    raise exception 'Post not found' using errcode = 'P0002';
  end if;

  delete from public.post_likes
  where post_id = p_post_id and user_id = v_user_id;
  if found then
    return false;
  end if;

  insert into public.post_likes (post_id, user_id)
  values (p_post_id, v_user_id)
  on conflict (post_id, user_id) do nothing;
  return true;
end;
$$;

revoke all on function public.toggle_post_like(uuid) from public, anon;
grant execute on function public.toggle_post_like(uuid) to authenticated;
