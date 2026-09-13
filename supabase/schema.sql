-- Pyramid Game: production-oriented Supabase schema.
-- Run in Supabase SQL editor. Requires pgcrypto (available in Supabase).
create extension if not exists pgcrypto;

create type public.game_status as enum ('waiting','voting','results','finished');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 30),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 60),
  room_code text not null unique check (room_code ~ '^[A-Z0-9-]{6,16}$'),
  host_id uuid not null references auth.users(id),
  status public.game_status not null default 'waiting',
  max_players int not null check (max_players between 3 and 64),
  total_rounds int not null check (total_rounds between 1 and 30),
  current_round int not null default 0,
  voting_seconds int not null check (voting_seconds between 30 and 3600),
  votes_per_player int not null check (votes_per_player between 1 and 10),
  allow_self_vote boolean not null default false,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);

create table public.game_secrets (
  game_id uuid primary key references public.games(id) on delete cascade,
  password_hash text not null
);

create table public.room_join_attempts (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  room_code text not null,
  attempted_at timestamptz not null default now()
);
create index room_join_attempts_lookup_idx on public.room_join_attempts(user_id,room_code,attempted_at desc);

create table public.game_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  current_rank int,
  previous_rank int,
  points int not null default 0,
  joined_at timestamptz not null default now(),
  unique(game_id,user_id)
);

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  round_number int not null,
  status text not null check(status in ('voting','results','closed')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  unique(game_id,round_number)
);

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  voter_id uuid not null references auth.users(id) on delete cascade,
  target_id uuid not null references public.game_players(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(round_id,voter_id,target_id)
);

create table public.rankings (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  player_id uuid not null references public.game_players(id) on delete cascade,
  rank int not null,
  score int not null default 0,
  previous_rank int,
  unique(round_id,player_id),
  unique(round_id,rank)
);

create index game_players_game_idx on public.game_players(game_id);
create index votes_round_idx on public.votes(round_id);
create index rankings_round_rank_idx on public.rankings(round_id,rank);

alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.game_secrets enable row level security;
alter table public.game_players enable row level security;
alter table public.room_join_attempts enable row level security;
alter table public.rounds enable row level security;
alter table public.votes enable row level security;
alter table public.rankings enable row level security;

create or replace function public.is_game_member(p_game_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql security definer stable set search_path=public
as $$
  select exists(select 1 from public.game_players gp where gp.game_id=p_game_id and gp.user_id=p_user_id);
$$;

-- Profiles are readable, but only the owner can mutate their profile.
create policy profiles_select_authenticated on public.profiles for select to authenticated using (true);
create policy profiles_insert_self on public.profiles for insert to authenticated with check (id=auth.uid());
create policy profiles_update_self on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());

-- Game discovery intentionally exposes only safe metadata; password_hash is not selected by client RPCs.
create policy games_select_members on public.games for select to authenticated using (
  public.is_game_member(games.id,auth.uid()) or host_id=auth.uid()
);
-- No direct INSERT/UPDATE/DELETE policies: all game mutations go through validated RPCs.
-- game_secrets intentionally has no SELECT policy; its password hash is server-only.

create policy players_select_members on public.game_players for select to authenticated using (
  public.is_game_member(game_players.game_id,auth.uid())
);
-- No direct INSERT policy: joining is only possible through join_game, which verifies the room password.
-- room_join_attempts is server-only and has no client policies.

create policy rounds_select_members on public.rounds for select to authenticated using (
  public.is_game_member(rounds.game_id,auth.uid())
);

-- CRITICAL: votes have NO SELECT or INSERT policy. Players cannot read or directly write raw votes.
-- Only submit_votes can create votes after validating membership, deadline and vote count.

create policy rankings_select_members on public.rankings for select to authenticated using (
  exists(select 1 from public.game_players gp where gp.id=rankings.player_id and public.is_game_member(gp.game_id,auth.uid()))
);

create or replace function public.ensure_profile()
returns public.profiles
language plpgsql security definer set search_path=public
as $$ declare p public.profiles; begin
  insert into public.profiles(id,display_name) values(auth.uid(),coalesce(auth.jwt()->'user_metadata'->>'display_name','Player'))
  on conflict(id) do update set display_name=excluded.display_name,updated_at=now();
  select * into p from public.profiles where id=auth.uid(); return p;
end $$;

create or replace function public.create_game(p_name text,p_password text,p_max_players int,p_total_rounds int,p_voting_seconds int,p_votes_per_player int)
returns jsonb language plpgsql security definer set search_path=public
as $$ declare g public.games; code text; begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if char_length(p_password)<8 then raise exception 'Room password must be at least 8 characters'; end if;
  perform public.ensure_profile();
  loop
    code := 'PYR-' || upper(substr( encode(extensions.gen_random_bytes(4),'hex'),1,6));
    exit when not exists(select 1 from public.games where room_code=code);
  end loop;
  insert into public.games(name,room_code,host_id,max_players,total_rounds,voting_seconds,votes_per_player)
  values(p_name,code,auth.uid(),p_max_players,p_total_rounds,p_voting_seconds,p_votes_per_player) returning * into g;
  insert into public.game_secrets(game_id,password_hash) values(extensions.crypt(p_password,extensions.gen_salt('bf')) );
  insert into public.game_players(game_id,user_id) values(g.id,auth.uid());
  return jsonb_build_object('game_id',g.id,'room_code',g.room_code);
end $$;

create or replace function public.join_game(p_room_code text,p_password text)
returns jsonb language plpgsql security definer set search_path=public
as $$ declare g public.games; count_players int; begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if (select count(*) from public.room_join_attempts where user_id=auth.uid() and room_code=upper(trim(p_room_code)) and attempted_at>now()-interval '10 minutes') >= 10 then raise exception 'Too many room access attempts. Try again later.'; end if;
  insert into public.room_join_attempts(user_id,room_code) values(auth.uid(),upper(trim(p_room_code)));
  select * into g from public.games where room_code=upper(trim(p_room_code)) and status='waiting';
  if not found then raise exception 'Invalid room credentials'; end if;
  if not exists(select 1 from public.game_secrets s where s.game_id=g.id and s.password_hash=crypt(p_password,s.password_hash)) then raise exception 'Invalid room credentials'; end if;
  select count(*) into count_players from public.game_players where game_id=g.id;
  if count_players >= g.max_players then raise exception 'Room is full'; end if;
  perform public.ensure_profile();
  insert into public.game_players(game_id,user_id) values(g.id,auth.uid()) on conflict do nothing;
  return jsonb_build_object('game_id',g.id,'room_code',g.room_code);
end $$;

create or replace function public.submit_votes(p_round_id uuid,p_target_ids uuid[])
returns jsonb language plpgsql security definer set search_path=public
as $$ declare r public.rounds; g public.games; mine public.game_players; target uuid; seen int:=0; begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into r from public.rounds where id=p_round_id for update;
  if not found or r.status<>'voting' or now()>r.ends_at then raise exception 'Voting is closed'; end if;
  select * into g from public.games where id=r.game_id;
  select * into mine from public.game_players where game_id=g.id and user_id=auth.uid();
  if not found then raise exception 'You are not a member of this game'; end if;
  if coalesce(array_length(p_target_ids,1),0)<>g.votes_per_player then raise exception 'Exactly % votes are required',g.votes_per_player; end if;
  -- A player gets exactly one submission per round. Without this guard, a client
  -- could submit multiple different batches and exceed its vote allowance.
  if exists(select 1 from public.votes where round_id=r.id and voter_id=auth.uid()) then
    raise exception 'Vote already submitted for this round';
  end if;
  foreach target in array p_target_ids loop
    if not exists(select 1 from public.game_players where id=target and game_id=g.id) then raise exception 'Invalid vote target'; end if;
    if not g.allow_self_vote and target=mine.id then raise exception 'Self-voting is disabled'; end if;
    if exists(select 1 from public.votes where round_id=r.id and voter_id=auth.uid() and target_id=target) then raise exception 'Duplicate vote target'; end if;
    insert into public.votes(round_id,voter_id,target_id) values(r.id,auth.uid(),target); seen:=seen+1;
  end loop;
  return jsonb_build_object('accepted',seen);
end $$;

-- Start game: only host, only waiting state, enough players. Creates first voting round.
create or replace function public.start_game(p_game_id uuid)
returns jsonb language plpgsql security definer set search_path=public
as $$ declare g public.games; c int; r public.rounds; begin
  select * into g from public.games where id=p_game_id for update;
  if not found or g.host_id<>auth.uid() then raise exception 'Host permission required'; end if;
  if g.status<>'waiting' then raise exception 'Game has already started'; end if;
  select count(*) into c from public.game_players where game_id=g.id;
  if c<3 then raise exception 'At least 3 players are required'; end if;
  update public.games set status='voting',current_round=1,started_at=now() where id=g.id;
  insert into public.rounds(game_id,round_number,status,starts_at,ends_at) values(g.id,1,'voting',now(),now()+make_interval(secs=>g.voting_seconds)) returning * into r;
  return jsonb_build_object('game_id',g.id,'round_id',r.id,'ends_at',r.ends_at);
end $$;

create or replace function public.start_next_round(p_game_id uuid)
returns jsonb language plpgsql security definer set search_path=public
as $$ declare g public.games; last_round public.rounds; r public.rounds; begin
  select * into g from public.games where id=p_game_id for update;
  if not found or g.host_id<>auth.uid() then raise exception 'Host permission required'; end if;
  if g.status<>'results' then raise exception 'Game is not ready for the next round'; end if;
  select * into last_round from public.rounds where game_id=g.id order by round_number desc limit 1;
  if last_round.round_number>=g.total_rounds then raise exception 'Game is complete'; end if;
  insert into public.rounds(game_id,round_number,status,starts_at,ends_at) values(g.id,last_round.round_number+1,'voting',now(),now()+make_interval(secs=>g.voting_seconds)) returning * into r;
  update public.games set status='voting',current_round=r.round_number where id=g.id;
  return jsonb_build_object('game_id',g.id,'round_id',r.id,'ends_at',r.ends_at);
end $$;

-- Secure round close: only after deadline; fewer 'least trustworthy' votes means a higher rank. Ties use prior rank, then player UUID.
create or replace function public.close_round(p_round_id uuid)
returns jsonb language plpgsql security definer set search_path=public
as $$ declare r public.rounds; g public.games; n int; begin
  select * into r from public.rounds where id=p_round_id for update;
  if not found then raise exception 'Round not found'; end if;
  if now()<r.ends_at then raise exception 'Voting is still open'; end if;
  if r.status<>'voting' then return jsonb_build_object('status',r.status); end if;
  select * into g from public.games where id=r.game_id;
  if g.host_id<>auth.uid() then raise exception 'Host permission required'; end if;
  insert into public.rankings(round_id,player_id,rank,score,previous_rank)
  select r.id,gp.id,row_number() over(order by count(v.id) asc,coalesce(gp.current_rank,2147483647),gp.id)::int,((select count(*) from public.game_players x where x.game_id=g.id)-count(v.id))::int,gp.current_rank
  from public.game_players gp left join public.votes v on v.target_id=gp.id and v.round_id=r.id
  where gp.game_id=g.id group by gp.id,gp.current_rank;
  update public.game_players gp set previous_rank=gp.current_rank,current_rank=rr.rank,points=gp.points+rr.score
  from public.rankings rr where rr.round_id=r.id and rr.player_id=gp.id;
  update public.rounds set status='results' where id=r.id;
  if r.round_number>=g.total_rounds then
    update public.games set status='finished',ended_at=now() where id=g.id;
  else
    update public.games set status='results' where id=g.id;
  end if;
  return jsonb_build_object('status',case when r.round_number>=g.total_rounds then 'finished' else 'results' end,'round_id',r.id);
end $$;

revoke insert, update, delete on public.games from authenticated;
revoke insert, update, delete on public.game_players from authenticated;
revoke select, insert, update, delete on public.game_secrets from authenticated;
revoke select, insert, update, delete on public.votes from authenticated;
revoke select, insert, update, delete on public.room_join_attempts from authenticated;

revoke all on function public.create_game(text,text,int,int,int,int) from public;
grant execute on function public.create_game(text,text,int,int,int,int) to authenticated;
revoke all on function public.join_game(text,text) from public;
grant execute on function public.join_game(text,text) to authenticated;
revoke all on function public.submit_votes(uuid,uuid[]) from public;
grant execute on function public.submit_votes(uuid,uuid[]) to authenticated;
revoke all on function public.start_game(uuid) from public;
grant execute on function public.start_game(uuid) to authenticated;
revoke all on function public.close_round(uuid) from public;
grant execute on function public.close_round(uuid) to authenticated;
revoke all on function public.start_next_round(uuid) from public;
grant execute on function public.start_next_round(uuid) to authenticated;
revoke all on function public.is_game_member(uuid,uuid) from public;
grant execute on function public.is_game_member(uuid,uuid) to authenticated;

revoke all on function public.ensure_profile() from public;
grant execute on function public.ensure_profile() to authenticated;
