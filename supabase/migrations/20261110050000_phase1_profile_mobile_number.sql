-- Phase 1 (#254 User registration): store the user's mobile number and name
-- on their profile when they sign up.
-- Mobile numbers are stored as the last 10 digits (Indian format) and must be unique.

alter table public.profiles
  add column if not exists mobile_number text
    check (mobile_number is null or mobile_number ~ '^[6-9][0-9]{9}$');

create unique index if not exists profiles_mobile_number_uidx
  on public.profiles (mobile_number) where mobile_number is not null;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw_mobile text := pg_catalog.regexp_replace(
    coalesce(new.raw_user_meta_data ->> 'mobile_number', ''), '[^0-9]', '', 'g');
  clean_mobile text;
begin
  clean_mobile := case
    when pg_catalog.length(raw_mobile) >= 10 then pg_catalog.right(raw_mobile, 10)
    else null
  end;

  insert into public.profiles (id, display_name, mobile_number)
  values (
    new.id,
    nullif(coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name'), ''),
    clean_mobile
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

-- Users may update their own mobile number.
grant update (mobile_number) on public.profiles to authenticated;
