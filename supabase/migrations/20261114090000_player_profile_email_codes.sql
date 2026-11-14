begin;
alter table public.players add column if not exists location text;

create or replace function public.get_my_player_profile()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare player jsonb;
begin
  player := public.get_my_player();
  return player || jsonb_build_object('location', (
    select location from public.players where profile_id = (select auth.uid())
  ));
end;
$$;

create or replace function public.update_my_player_profile(
  p_name text, p_location text, p_birth_date date,
  p_player_role text, p_batting_style text, p_bowling_style text
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null or not exists (
    select 1 from public.profiles where id = uid and account_status not in ('suspended', 'disabled')
  ) then
    raise exception 'An active account is required.' using errcode = '42501';
  end if;
  if coalesce(length(btrim(p_name)), 0) not between 1 and 100
     or length(btrim(p_location)) > 120 or p_birth_date > current_date then
    raise exception 'Check your name, location and date of birth.' using errcode = '22023';
  end if;
  perform public.update_my_player(p_player_role, p_batting_style, p_bowling_style);
  update public.players set display_name = btrim(p_name), location = nullif(btrim(p_location), ''),
    date_of_birth = p_birth_date where profile_id = uid;
  update public.profiles set display_name = btrim(p_name) where id = uid;
  return public.get_my_player_profile();
end;
$$;
revoke all on function public.get_my_player_profile() from public, anon;
revoke all on function public.update_my_player_profile(text,text,date,text,text,text) from public, anon;
grant execute on function public.get_my_player_profile() to authenticated;
grant execute on function public.update_my_player_profile(text,text,date,text,text,text) to authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_mobile text := private.clean_mobile(new.raw_user_meta_data ->> 'mobile_number');
  name text := nullif(coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name'), '');
begin
  insert into public.profiles (id, display_name, mobile_number)
  values (new.id, name, clean_mobile)
  on conflict (id) do nothing;

  insert into public.user_role_assignments (user_id, role, scope_type, notes)
  values (new.id, 'player', 'global', 'Automatic: every registered user is a player')
  on conflict do nothing;

  -- Claim an unregistered player added earlier with the same mobile number, or create one.
  if clean_mobile is not null and exists (
       select 1 from public.players where mobile_number = clean_mobile and profile_id is null) then
    update public.players set profile_id = new.id
     where mobile_number = clean_mobile and profile_id is null;
  elsif not exists (select 1 from public.players where profile_id = new.id) then
    insert into public.players (profile_id, display_name, mobile_number, created_by, player_role, batting_style, bowling_style)
    values (new.id, coalesce(name, 'Player'),
            case when exists (select 1 from public.players where mobile_number = clean_mobile) then null else clean_mobile end,
            new.id,
            case when new.raw_user_meta_data->>'player_role' in ('batter','bowler','all_rounder','wicket_keeper') then new.raw_user_meta_data->>'player_role' end,
            case when new.raw_user_meta_data->>'batting_style' in ('right_hand','left_hand') then new.raw_user_meta_data->>'batting_style' end,
            case when new.raw_user_meta_data->>'bowling_style' in ('right_arm_fast','right_arm_medium','right_arm_off_spin','right_arm_leg_spin','left_arm_fast','left_arm_medium','left_arm_orthodox','left_arm_chinaman','none') then new.raw_user_meta_data->>'bowling_style' end);
  end if;

  return new;
end;
$$;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
commit;
