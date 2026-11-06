/**
 * Mock Data Store for Local Cricket Management Platform
 * 
 * NOTE: Entities are designed to match future Supabase PostgreSQL table schemas:
 * - snake_case attribute names
 * - ISO-8601 timestamps
 * - Foreign key references (tournament_id, team_id, etc.)
 */

export const mockStats = {
  active_tournaments: 4,
  registered_teams: 32,
  live_and_upcoming_matches: 14,
  profiled_players: 520,
  balls_bowled_season: 18450,
  active_grounds: 8
};

export const mockTournaments = [
  {
    id: "trn-001",
    name: "Premier City Cricket Championship 2026",
    code: "PCCC-26",
    format: "T20",
    status: "ongoing",
    teams_count: 16,
    matches_total: 31,
    matches_completed: 18,
    start_date: "2026-10-15",
    end_date: "2026-11-20",
    venue: "Central City Oval, Ground 1 & 2",
    banner_color: "#059669"
  },
  {
    id: "trn-002",
    name: "Monsoon Night Super League",
    code: "MNSL-26",
    format: "T20 (Floodlights)",
    status: "ongoing",
    teams_count: 8,
    matches_total: 16,
    matches_completed: 11,
    start_date: "2026-10-25",
    end_date: "2026-11-15",
    venue: "Greenfield Sports Complex",
    banner_color: "#1E3A8A"
  },
  {
    id: "trn-003",
    name: "Inter-Suburban Veterans Trophy",
    code: "ISVT-26",
    format: "35 Overs",
    status: "upcoming",
    teams_count: 6,
    matches_total: 15,
    matches_completed: 0,
    start_date: "2026-11-12",
    end_date: "2026-12-05",
    venue: "Railway Recreation Ground",
    banner_color: "#D97706"
  },
  {
    id: "trn-004",
    name: "Youth Talent Hunt Cup (U-19)",
    code: "YTHC-26",
    format: "T20",
    status: "registration",
    teams_count: 12,
    matches_total: 23,
    matches_completed: 0,
    start_date: "2026-11-25",
    end_date: "2026-12-20",
    venue: "St. Xavier Ground & Oval",
    banner_color: "#7C3AED"
  }
];

export const mockMatches = [
  {
    id: "mch-101",
    tournament_id: "trn-001",
    tournament_name: "Premier City Cricket Championship 2026",
    status: "live", // live | upcoming | completed
    stage: "Quarter Final 1",
    venue: "Central City Oval, Pitch A",
    match_date: "2026-11-05",
    match_time: "14:30 IST",
    format: "T20",
    batting_first_team: {
      id: "tm-01",
      name: "Royal Strikers CC",
      short_code: "RSC",
      score: 168,
      wickets: 4,
      overs: 18.2,
      run_rate: "9.16",
      color: "#DC2626"
    },
    bowling_team: {
      id: "tm-02",
      name: "Phoenix Warriors",
      short_code: "PHW",
      color: "#2563EB"
    },
    toss_summary: "Royal Strikers CC won toss & chose to bat",
    current_striker: { name: "R. Sharma", runs: 58, balls: 34, fours: 6, sixes: 3 },
    current_non_striker: { name: "A. Patel", runs: 24, balls: 15, fours: 2, sixes: 1 },
    current_bowler: { name: "K. Yadav", overs: 3.2, maidens: 0, runs: 29, wickets: 2 },
    penalty_applied: false
  },
  {
    id: "mch-102",
    tournament_id: "trn-001",
    tournament_name: "Premier City Cricket Championship 2026",
    status: "live",
    stage: "Quarter Final 2",
    venue: "Central City Oval, Pitch B",
    match_date: "2026-11-05",
    match_time: "15:00 IST",
    format: "T20",
    batting_first_team: {
      id: "tm-03",
      name: "Coastal Blasters",
      short_code: "CSB",
      score: 142,
      wickets: 10,
      overs: 19.4,
      run_rate: "7.22",
      color: "#0891B2"
    },
    bowling_team: {
      id: "tm-04",
      name: "Metro Super Kings",
      short_code: "MSK",
      score: 98,
      wickets: 2,
      overs: 11.0,
      run_rate: "8.91",
      target: 143,
      required_run_rate: "5.00",
      color: "#CA8A04"
    },
    toss_summary: "Coastal Blasters won toss & chose to bat",
    current_striker: { name: "S. Khan", runs: 42, balls: 28, fours: 4, sixes: 2 },
    current_non_striker: { name: "V. Iyer", runs: 31, balls: 22, fours: 3, sixes: 1 },
    current_bowler: { name: "T. Mishra", overs: 2.0, maidens: 0, runs: 16, wickets: 0 },
    penalty_applied: false
  },
  {
    id: "mch-103",
    tournament_id: "trn-002",
    tournament_name: "Monsoon Night Super League",
    status: "upcoming",
    stage: "League Match 12",
    venue: "Greenfield Sports Complex (Floodlights)",
    match_date: "2026-11-05",
    match_time: "19:00 IST",
    format: "T20",
    team_a: {
      id: "tm-05",
      name: "Night Owls Cricket Club",
      short_code: "NOC",
      color: "#4F46E5"
    },
    team_b: {
      id: "tm-06",
      name: "Thunderbolt XI",
      short_code: "TBX",
      color: "#E11D48"
    },
    toss_summary: "Toss scheduled at 18:30 IST",
    penalty_applied: false
  },
  {
    id: "mch-104",
    tournament_id: "trn-001",
    tournament_name: "Premier City Cricket Championship 2026",
    status: "completed",
    stage: "Group Stage Round 3",
    venue: "Central City Oval, Pitch A",
    match_date: "2026-11-04",
    match_time: "10:00 IST",
    format: "T20",
    team_a: {
      id: "tm-01",
      name: "Royal Strikers CC",
      short_code: "RSC",
      score: 185,
      wickets: 6,
      overs: 20.0
    },
    team_b: {
      id: "tm-07",
      name: "Apex Cricket Academy",
      short_code: "ACA",
      score: 162,
      wickets: 9,
      overs: 20.0
    },
    result: "Royal Strikers CC won by 23 runs",
    player_of_match: "R. Sharma (74 off 41)",
    penalty_applied: false
  }
];

export const mockTeams = [
  { id: "tm-01", name: "Royal Strikers CC", short_code: "RSC", captain: "R. Sharma", home_ground: "Central City Oval", titles: 3 },
  { id: "tm-02", name: "Phoenix Warriors", short_code: "PHW", captain: "M. Aziz", home_ground: "West End Pavilion", titles: 1 },
  { id: "tm-03", name: "Coastal Blasters", short_code: "CSB", captain: "A. Fernandes", home_ground: "Beachside Arena", titles: 2 },
  { id: "tm-04", name: "Metro Super Kings", short_code: "MSK", captain: "S. Rao", home_ground: "Metro Ground 3", titles: 4 }
];

export const mockCategoryQPenaltyPolicy = {
  category: "Category Q",
  title: "Late Arrival Penalty Rules (Confirmed Requirements)",
  summary: "Standard operational penalty workflow for late-arriving teams in local league and tournament matches.",
  rules: [
    {
      id: "q-rule-1",
      title: "Three Possible Penalty Methods",
      description: "Organisers may configure one of three penalty methods: Overs Deduction, Fielding Restriction, or Penalty Runs."
    },
    {
      id: "q-rule-2",
      title: "Single Method Constraint",
      description: "Only ONE penalty method can be active in a single match."
    },
    {
      id: "q-rule-3",
      title: "Organiser Selection",
      description: "The tournament or match organiser selects the applicable penalty method before match play."
    },
    {
      id: "q-rule-4",
      title: "Team Identification",
      description: "The organiser identifies the late-arriving team and the benefiting opponent."
    },
    {
      id: "q-rule-5",
      title: "Official Approval Required",
      description: "An authorised organiser or official umpire must approve the penalty before execution."
    },
    {
      id: "q-rule-6",
      title: "Advance Publication",
      description: "Local match rules governing penalties must be published in advance to participating teams."
    },
    {
      id: "q-rule-7",
      title: "Rule Integrity",
      description: "No additional calculations or deductions may be invented beyond these confirmed requirements."
    }
  ]
};

