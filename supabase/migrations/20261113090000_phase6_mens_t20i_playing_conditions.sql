-- Feature #233. Publish through the existing Learn → Rules article feed.
do $migration$
declare
  article_title constant text := 'Men''s T20 International playing conditions';
  admin_id uuid;
begin
  if exists (
    select 1 from public.articles
    where kind = 'rules' and title = article_title and is_official
  ) then
    return;
  end if;

  select user_id into admin_id
  from public.user_role_assignments
  where role = 'super_admin' and is_active
  order by granted_at, user_id
  limit 1;

  if admin_id is null then
    raise exception 'An active super-admin account is required to publish the T20I rules article.';
  end if;

  insert into public.articles (
    kind, level, title, summary, body, author_id, byline,
    status, is_official, published_at, reading_minutes
  ) values (
    'rules', 'beginner', article_title,
    'How men''s T20Is work, from the opening Powerplay to a rain-shortened chase or a Super Over.',
$article$This guide covers the ICC standard conditions effective October 2026. ICC tournaments can publish their own conditions.

## Teams, innings and bowlers
Each team fields 11 players and has one innings of up to 20 overs. An over has six legal deliveries. A bowler can bowl up to four overs in a full innings. In shortened innings, the umpires work out each bowler's limit using clause 13.9.

## Powerplay and fielding
In a full innings, only two fielders can stand outside the 30-yard circle during the first six overs. After that, up to five can stand outside. For a shortened innings, use the Powerplay table in clause 28.7.

## Extras and free hits
Wides and no-balls add an extra and do not use up a legal delivery. The delivery after a no-ball is a free hit. If that delivery is a wide or a no-ball, the free hit carries over. A batter can still be run out on a free hit.

## Breaks, rain and the result
The innings break is normally 15 minutes. It can be reduced to 10 minutes when time is lost. In an interrupted match, Duckworth–Lewis–Stern (DLS) can set a revised target or decide the result when the chase is cut short. The chasing team generally needs the chance to bat for at least five overs, unless the result is already decided.

## Ties
If the match is tied, the teams play a Super Over when conditions allow. If that is tied too, they play further Super Overs as permitted by Appendix F.

## Official reference
[ICC Men's T20I Playing Conditions, October 2026 (PDF)](https://images.icc-cricket.com/image/upload/prd/bsxcho7ufe2pjban0wjp.pdf)

[ICC playing conditions and addendums](https://www.icc-cricket.com/about/cricket/rules-and-regulations/playing-conditions)$article$,
    admin_id, 'Local Cricket Coaching Desk', 'published', true, now(), 2
  );
end;
$migration$;
