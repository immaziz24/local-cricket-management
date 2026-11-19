// Batch 10 (#115 #116 #117 #124 #125 #126): one-tap umpire decisions for the scoring screen.
export const DECISION_PRESETS = [
  { key: 'dead_ball', label: 'Dead ball', kind: 'decision', title: 'Dead ball called', help: 'Ball not counted; nothing scored. Re-bowl it.' },
  { key: 'short_run', label: 'Short run', kind: 'decision', title: 'Short run – runs reduced', help: 'Umpire signals short run; the short run is not counted.' },
  { key: 'overthrow', label: 'Overthrow', kind: 'decision', title: 'Overthrow – extra runs added', help: 'Enter the total runs for the ball when you score it.' },
  { key: 'no_ball_call', label: 'No-ball called', kind: 'decision', title: 'No-ball called by the umpire', help: 'Record the reason (front foot, height, fielders).' },
  { key: 'wide_call', label: 'Wide called', kind: 'decision', title: 'Wide called by the umpire', help: '' },
  { key: 'review', label: 'Decision changed', kind: 'decision', title: 'Umpire changed a decision', help: 'For example a dismissal given or withdrawn.' },
  { key: 'time_wasting', label: 'Time-wasting warning', kind: 'incident', title: 'Time-wasting warning', action: 'warning', needsTeam: true,
    help: 'Warns the team and tells their owner.' },
  { key: 'other', label: 'Other decision', kind: 'decision', title: '', custom: true, help: 'Write your own title.' }
];

export const TIME_WASTING_TITLE = 'Time-wasting warning';

/** Build the payload for add_match_report. */
export function buildDecisionReport(preset, { teamId = null, note = '', customTitle = '' } = {}) {
  if (!preset) return { error: 'Choose a decision.' };
  const title = preset.custom ? String(customTitle || '').trim() : preset.title;
  if (title.length < 2) return { error: 'Give the decision a short title.' };
  if (title.length > 120) return { error: 'Keep the title under 120 characters.' };
  if (preset.needsTeam && !teamId) return { error: 'Choose which team.' };
  const details = String(note || '').trim();
  if (details.length > 2000) return { error: 'Keep the note under 2000 characters.' };
  const report = { kind: preset.kind, title, details: details || null, action: preset.action || 'none' };
  if (teamId) report.team_id = teamId;
  return { report };
}

/**
 * Time-wasting: first warning, final warning, then (third time) the umpires may award 5 penalty runs.
 * Counts earlier warnings for this team name in the report list from list_match_reports.
 */
export function timeWastingStatus(reports, teamName) {
  const count = (reports || []).filter((r) => r.title === TIME_WASTING_TITLE && r.team === teamName).length;
  if (count === 0) return { count, next: 'First warning.' };
  if (count === 1) return { count, next: 'This would be the final warning.' };
  return { count, next: 'Already warned twice. Further time-wasting: the umpires may award 5 penalty runs to the batting side (use Penalty runs).' };
}

/** Short text for the decision log. */
export function describeReport(r) {
  const where = r.innings_no ? ` (innings ${r.innings_no}${r.over ? `, over ${r.over}` : ''})` : '';
  return `${r.title}${r.team ? ` – ${r.team}` : ''}${where}`;
}
