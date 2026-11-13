-- Feature #235. Publish through the existing Learn → Rules article feed.
do $migration$
declare
  article_title constant text := 'Men''s Test playing conditions';
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
    raise exception 'An active super-admin account is required to publish the Test rules article.';
  end if;

  insert into public.articles (
    kind, level, title, summary, body, author_id, byline,
    status, is_official, published_at, reading_minutes
  ) values (
    'rules', 'beginner', article_title,
    'How five-day Tests work, including the new ball, declarations, the follow-on and draws.',
$article$This guide covers the ICC standard five-day men's Test conditions effective October 2026.

## Match format
Each side has 11 players and can bat twice. Innings have no fixed overs limit. Play is scheduled over five days with lunch and tea breaks.

## The new ball
Each innings starts with a new ball. Once 80 complete overs have been bowled with a ball, the fielding captain can ask for a new one (clause 4.4).

## Declarations and the follow-on
A batting captain can declare the innings closed while the ball is dead. In a Test where play starts on day one, the team that bats first can make the other side bat again immediately if it leads by at least 200 after the first innings. Clause 14 adjusts the threshold if the whole first day is lost.

## How a Test ends
A side wins when it outscores the opposition after the opposition has completed both innings. A successful chase ends as soon as the winning run is scored. If all innings are complete and the aggregate scores are equal, the result is a tie. If time runs out before a win or tie is decided, the match is normally a draw.

## Official reference
[ICC Men's Test Match Playing Conditions, October 2026 (PDF)](https://images.icc-cricket.com/image/upload/prd/a8114zro5tkioifz0jqg.pdf)

[ICC playing conditions](https://www.icc-cricket.com/about/cricket/rules-and-regulations/playing-conditions)$article$,
    admin_id, 'Local Cricket Coaching Desk', 'published', true, now(), 2
  );
end;
$migration$;
