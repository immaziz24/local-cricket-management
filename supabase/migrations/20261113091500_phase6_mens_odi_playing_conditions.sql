-- Feature #234. Publish through the existing Learn → Rules article feed.
do $migration$
declare
  article_title constant text := 'Men''s ODI playing conditions';
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
    raise exception 'An active super-admin account is required to publish the ODI rules article.';
  end if;

  insert into public.articles (
    kind, level, title, summary, body, author_id, byline,
    status, is_official, published_at, reading_minutes
  ) values (
    'rules', 'beginner', article_title,
    'A guide to 50-over internationals, including the two-ball rule, Powerplays and rain-shortened chases.',
$article$This guide covers the ICC standard men's ODI conditions effective October 2026. Individual tournaments can publish their own playing conditions.

## Teams and overs
Each side has 11 players and bats once for up to 50 overs. A bowler can bowl up to 10 overs in a full innings. In shortened matches, clause 13.9 explains how to adjust the limit.

## The white balls
The fielding side starts with two new balls, one at each end. After over 34, it chooses one to use for the rest of the innings. If the match is cut to 25 overs per side or fewer before play begins, each side starts with one new ball (clause 4.3).

## Powerplays
In a full innings, the 30-yard circle limits how many fielders can stand outside it at delivery.
- Overs 1–10: up to two outside.
- Overs 11–40: up to four outside.
- Overs 41–50: up to five outside.

Clause 28.7 gives the Powerplay breakdown for shortened innings.

## Rain and ties
Duckworth–Lewis–Stern (DLS) can revise the target or settle an interrupted chase. Both teams normally need a chance to bat for 20 overs. A side can be bowled out earlier, and the chasing side can win earlier by reaching its target. A completed tie goes to a Super Over when conditions allow.

## Official reference
[ICC Men's ODI Playing Conditions, October 2026 (PDF)](https://images.icc-cricket.com/image/upload/prd/bxkzkcyvfn6tvi70zh0w.pdf)

[ICC playing conditions](https://www.icc-cricket.com/about/cricket/rules-and-regulations/playing-conditions)$article$,
    admin_id, 'Local Cricket Coaching Desk', 'published', true, now(), 2
  );
end;
$migration$;
