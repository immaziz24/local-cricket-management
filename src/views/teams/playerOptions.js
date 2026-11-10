// Shared option lists for player details (#63 batting style, #64 bowling style, #65 player role).
// Values must match the checks in supabase/migrations/20261110100000_phase2_players_teams.sql.

export const ROLE_OPTIONS = [
  ['batter', 'Batter'],
  ['bowler', 'Bowler'],
  ['all_rounder', 'All-rounder'],
  ['wicket_keeper', 'Wicket-keeper']
];

export const BATTING_OPTIONS = [
  ['right_hand', 'Right-hand bat'],
  ['left_hand', 'Left-hand bat']
];

export const BOWLING_OPTIONS = [
  ['right_arm_fast', 'Right-arm fast'],
  ['right_arm_medium', 'Right-arm medium'],
  ['right_arm_off_spin', 'Right-arm off-spin'],
  ['right_arm_leg_spin', 'Right-arm leg-spin'],
  ['left_arm_fast', 'Left-arm fast'],
  ['left_arm_medium', 'Left-arm medium'],
  ['left_arm_orthodox', 'Left-arm orthodox spin'],
  ['left_arm_chinaman', 'Left-arm wrist spin'],
  ['none', 'Does not bowl']
];

export const labelOf = (list, value) => (list.find(([v]) => v === value) || [null, ''])[1];
