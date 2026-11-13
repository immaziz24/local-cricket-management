-- Phase 6, Category M, features #237–253.
do $migration$
declare
  admin_id uuid;
begin
  select user_id into admin_id
  from public.user_role_assignments
  where role = 'super_admin' and is_active
  order by granted_at, user_id
  limit 1;

  if admin_id is null then
    raise exception 'An active super-admin account is required to publish these articles.';
  end if;

  insert into public.articles (
    kind, level, title, summary, body, author_id, byline,
    status, is_official, published_at, reading_minutes
  )
  select 'rules', 'beginner', seed.title, seed.summary, seed.body, admin_id,
    'Local Cricket Coaching Desk', 'published', true, now(), 1
  from (values
    ('Women''s ODI playing conditions', 'Each side bats once for up to 50 overs, with a 10-over limit per bowler in a full innings.', $article$## Match format
Each side bats once for up to 50 overs, with a 10-over limit per bowler in a full innings. Two new white balls are used, one from each end. If the match is shortened to 25 overs per side or fewer before the first innings begins, each team starts with one new ball. See clauses 4 and 13 for the details.

## Official reference
[ICC Women's ODI Playing Conditions (PDF)](https://images.icc-cricket.com/image/upload/prd/qunpw1kfh3ibxlz58jlw.pdf)$article$),
    ('ICC tournament playing conditions', 'Use the conditions for the exact tournament and year.', $article$## Find the event edition
Use the conditions for the exact tournament and year. Check the group-stage and knockout rules separately, especially the minimum overs for a result, reserve days, how ties are settled and what happens if play cannot resume.

## Official reference
[ICC playing conditions and regulations](https://www.icc-cricket.com/about/cricket/rules-and-regulations/playing-conditions)$article$),
    ('Cricket equipment regulations', 'The playing conditions cover match equipment such as bats, balls and stumps.', $article$## Check what is permitted
The playing conditions cover match equipment such as bats, balls and stumps. The ICC clothing and equipment regulations also cover what players can wear and display. Consult the event documents for any additional restrictions.

## Official reference
[ICC playing conditions and regulations](https://www.icc-cricket.com/about/cricket/rules-and-regulations/playing-conditions)$article$),
    ('Bat regulations', 'The blade must be made of wood.', $article$## Blade and handle
The blade must be made of wood. The rules limit the bat’s size and specify what can be used to protect or repair it. Check clause 5 and Appendix B of the applicable playing conditions before using an unfamiliar bat.

## Official reference
[ICC playing conditions and regulations](https://www.icc-cricket.com/about/cricket/rules-and-regulations/playing-conditions)$article$),
    ('Ball regulations', 'Check clause 4 for the ball’s size, weight, colour and when a new ball is available.', $article$## Match balls and replacements
Check clause 4 for the ball’s size, weight, colour and when a new ball is available. If a ball is lost or becomes unfit through normal use, the umpires choose a replacement with comparable wear.

## Official reference
[ICC playing conditions and regulations](https://www.icc-cricket.com/about/cricket/rules-and-regulations/playing-conditions)$article$),
    ('Player eligibility regulations', 'A board should check the player’s eligibility to represent that country before nomination.', $article$## Confirm before selection
A board should check the player’s eligibility to represent that country before nomination. The ICC regulations explain nationality and residency routes, evidence requirements and rules for players who have represented another country.

## Official reference
[ICC playing conditions and regulations](https://www.icc-cricket.com/about/cricket/rules-and-regulations/playing-conditions)$article$),
    ('Concussion replacement regulations', 'The team’s medical representative assesses the player.', $article$## Approval by the match referee
The team’s medical representative assesses the player. The team submits a replacement request to the match referee, who considers whether the proposed player is a like-for-like replacement and can set conditions on their role.

## Official reference
[ICC playing conditions and regulations](https://www.icc-cricket.com/about/cricket/rules-and-regulations/playing-conditions)$article$),
    ('Substitute player regulations', 'An umpire may allow a substitute fielder when a player is injured, ill or has another acceptable reason for being absent.', $article$## Substitute fielders
An umpire may allow a substitute fielder when a player is injured, ill or has another acceptable reason for being absent. A substitute cannot bowl or captain the side and needs umpire consent to keep wicket. See clause 24.

## Official reference
[ICC playing conditions and regulations](https://www.icc-cricket.com/about/cricket/rules-and-regulations/playing-conditions)$article$),
    ('Over-rate regulations', 'The officials account for permitted delays when assessing the bowling rate.', $article$## How time is counted
The officials account for permitted delays when assessing the bowling rate. Check the match format’s playing conditions for the time allowances and any in-match penalty, and the Code of Conduct for disciplinary sanctions.

## Official reference
[ICC playing conditions and regulations](https://www.icc-cricket.com/about/cricket/rules-and-regulations/playing-conditions)$article$),
    ('DRS regulations', 'Where the Decision Review System is in use, a player can request a review of an eligible on-field decision.', $article$## Reviewing a decision
Where the Decision Review System is in use, a player can request a review of an eligible on-field decision. The third umpire checks the available evidence. The match conditions specify the request deadline, the review allowance and when the original decision stands.

## Official reference
[ICC playing conditions and regulations](https://www.icc-cricket.com/about/cricket/rules-and-regulations/playing-conditions)$article$),
    ('Player code of conduct', 'The ICC Code of Conduct covers behaviour such as dissent, abuse and conduct against the spirit of cricket.', $article$## Conduct during a match
The ICC Code of Conduct covers behaviour such as dissent, abuse and conduct against the spirit of cricket. Read the code for the offence levels, how a charge is brought and the sanctions that can follow.

## Official reference
[ICC playing conditions and regulations](https://www.icc-cricket.com/about/cricket/rules-and-regulations/playing-conditions)$article$),
    ('Match referee regulations', 'The match referee oversees matters assigned by the applicable playing conditions, including concussion replacement requests.', $article$## The referee’s role
The match referee oversees matters assigned by the applicable playing conditions, including concussion replacement requests. The Code of Conduct also sets out the referee’s role in handling reports and charges.

## Official reference
[ICC playing conditions and regulations](https://www.icc-cricket.com/about/cricket/rules-and-regulations/playing-conditions)$article$),
    ('Anti-corruption regulations', 'The ICC Anti-Corruption Code covers conduct including fixing, betting and misuse of inside information.', $article$## Recognise and report approaches
The ICC Anti-Corruption Code covers conduct including fixing, betting and misuse of inside information. Participants should follow the code’s reporting requirements when approached and use the official ICC channels.

## Official reference
[ICC playing conditions and regulations](https://www.icc-cricket.com/about/cricket/rules-and-regulations/playing-conditions)$article$),
    ('Anti-doping regulations', 'Players should check the current anti-doping rules and prohibited list before using medication or supplements.', $article$## Check before taking medication
Players should check the current anti-doping rules and prohibited list before using medication or supplements. The code covers testing and the process for seeking a Therapeutic Use Exemption when required.

## Official reference
[ICC playing conditions and regulations](https://www.icc-cricket.com/about/cricket/rules-and-regulations/playing-conditions)$article$),
    ('Anti-discrimination regulations', 'The ICC Anti-Discrimination Code sets out prohibited conduct by participants and the process for reporting and handling an alleged breach.', $article$## Reporting discrimination
The ICC Anti-Discrimination Code sets out prohibited conduct by participants and the process for reporting and handling an alleged breach. Use the code and the event’s reporting channels for a specific incident.

## Official reference
[ICC playing conditions and regulations](https://www.icc-cricket.com/about/cricket/rules-and-regulations/playing-conditions)$article$),
    ('Player disciplinary regulations', 'A report can lead to a charge under the applicable code.', $article$## From report to decision
A report can lead to a charge under the applicable code. The code sets out how the participant can respond, how a hearing is handled, which sanctions are available and when an appeal is possible.

## Official reference
[ICC playing conditions and regulations](https://www.icc-cricket.com/about/cricket/rules-and-regulations/playing-conditions)$article$),
    ('Umpire regulations', 'Check clause 2 of the relevant playing conditions for umpire appointments, responsibilities and the third umpire’s role.', $article$## Appointment and match duties
Check clause 2 of the relevant playing conditions for umpire appointments, responsibilities and the third umpire’s role. The ICC separately publishes a code of conduct for match officials.

## Official reference
[ICC playing conditions and regulations](https://www.icc-cricket.com/about/cricket/rules-and-regulations/playing-conditions)$article$)
  ) as seed(title, summary, body)
  where not exists (
    select 1 from public.articles existing
    where existing.kind = 'rules' and existing.is_official and existing.title = seed.title
  );
end;
$migration$;
