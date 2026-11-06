import {
  mockStats,
  mockTournaments,
  mockMatches,
  mockTeams,
  mockCategoryQPenaltyPolicy
} from './mockData.js';

/**
 * Mock Client Provider
 * 
 * Simulates async data operations for all Phase 1 Category N features (#254-270).
 * Future Supabase client will implement identical async signatures.
 */

// Simulated network latency
const delay = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper to normalize mobile digits (extract last 10 digits)
const normalizeMobile = (phone) => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
};

// In-memory mock user store for Phase 1 Category N
const initialMockUsers = [
  {
    id: 'usr-1001',
    full_name: 'Munna Aziz',
    email: 'admin@localcricket.com',
    mobile_number: '9876543210',
    password: 'Password123!',
    role: 'Super-Admin',
    is_verified: true,
    is_suspended: false,
    created_at: '2026-11-05T06:00:00.000Z'
  },
  {
    id: 'usr-1002',
    full_name: 'Rahul Dravid',
    email: 'scorer@localcricket.com',
    mobile_number: '9876543211',
    password: 'Password123!',
    role: 'Scorer',
    is_verified: true,
    is_suspended: false,
    created_at: '2026-11-05T07:00:00.000Z'
  },
  {
    id: 'usr-1003',
    full_name: 'Rohit Sharma',
    email: 'captain@localcricket.com',
    mobile_number: '9876543212',
    password: 'Password123!',
    role: 'Captain',
    is_verified: true,
    is_suspended: false,
    created_at: '2026-11-05T08:00:00.000Z'
  },
  {
    id: 'usr-1004',
    full_name: 'Anil Kumble',
    email: 'umpire@localcricket.com',
    mobile_number: '9876543213',
    password: 'Password123!',
    role: 'Umpire',
    is_verified: true,
    is_suspended: false,
    created_at: '2026-11-05T09:00:00.000Z'
  },
  {
    id: 'usr-1005',
    full_name: 'Existing Member',
    email: 'registered@example.com',
    mobile_number: '9999999999',
    password: 'Password123!',
    role: 'Player',
    is_verified: false,
    is_suspended: false,
    created_at: '2026-11-05T10:00:00.000Z'
  }
];

let mockUsers = [...initialMockUsers];
let currentSessionUser = null;

// Initial role permissions store for #259–#264
const initialRolePermissions = {
  organiser: [
    { key: 'create_tournament', label: 'Create & Publish Tournaments', enabled: true, desc: 'Setup tournament brackets, venues, and registration fees' },
    { key: 'reschedule_match', label: 'Reschedule Fixtures & Change Grounds', enabled: true, desc: 'Modify match dates, timings, and grounds' },
    { key: 'penalty_policy_select', label: 'Select Late Arrival Penalty Policy', enabled: true, desc: 'Assign overs deduction, fielding penalty, or penalty runs (Cat Q)' },
    { key: 'collect_fees', label: 'Collect Team Registration Fees', enabled: true, desc: 'Record and track tournament entry payments' },
    { key: 'appoint_officials', label: 'Appoint Match Umpires & Scorers', enabled: true, desc: 'Assign official scorers and certified umpires to fixtures' }
  ],
  team_owner: [
    { key: 'manage_roster', label: 'Register & Manage Squad Rosters', enabled: true, desc: 'Add or release registered players from team squad' },
    { key: 'submit_entry', label: 'Submit Tournament Entry Applications', enabled: true, desc: 'Enter team into sanctioned local tournaments' },
    { key: 'sponsor_branding', label: 'Upload Jersey & Sponsor Assets', enabled: true, desc: 'Manage team crest, jersey numbers, and sponsor banners' },
    { key: 'team_finances', label: 'View Team Financial Statements', enabled: false, desc: 'Track tournament fee receipts and prize distributions' }
  ],
  captain: [
    { key: 'submit_playing_xi', label: 'Submit Official Playing XI & 12th Man', enabled: true, desc: 'Lock in line-up before the official toss call' },
    { key: 'toss_call', label: 'Record Coin Toss Nomination', enabled: true, desc: 'Confirm heads/tails call and bat/bowl decision with umpire' },
    { key: 'batting_order', label: 'Adjust Batting & Bowling Orders', enabled: true, desc: 'Submit live tactical order adjustments to scorer' },
    { key: 'score_dispute', label: 'Log Official Scorecard Dispute', enabled: true, desc: 'File a formal scoring review with match referee within 30 min' }
  ],
  scorer: [
    { key: 'ball_by_ball', label: 'Record Real-Time Ball-by-Ball Data', enabled: true, desc: 'Log runs, extras (wd, nb, b, lb), wickets, and pitch zones' },
    { key: 'wagon_wheel', label: 'Plot Wagon Wheels & Shot Directions', enabled: true, desc: 'Input fielding position coordinates and trajectory vectors' },
    { key: 'dls_calculator', label: 'Calculate Rain Interruptions (DLS / VJD)', enabled: true, desc: 'Recalculate revised targets in rain-curtailed matches' },
    { key: 'finalize_scorecard', label: 'Lock & Sign Off Official Scorecard', enabled: true, desc: 'Generate verified match summary signed by umpires' }
  ],
  umpire: [
    { key: 'match_signoff', label: 'Sanction & Sign Off Match Results', enabled: true, desc: 'Confirm final match outcome, bonus points, and player of match' },
    { key: 'pitch_report', label: 'Submit Pre-Match Ground & Pitch Report', enabled: true, desc: 'Log boundary lengths, pitch hardness, and weather condition' },
    { key: 'conduct_infraction', label: 'Report Code of Conduct Violations', enabled: true, desc: 'Issue formal cautions or level 1-4 disciplinary reports' },
    { key: 'award_penalties', label: 'Award Penalty Runs for Misconduct', enabled: true, desc: 'Enforce 5 penalty runs for unfair play or ball tampering' }
  ],
  player: [
    { key: 'view_profile', label: 'View Personal Career Statistics', enabled: true, desc: 'Access career batting averages, bowling economy, and strike rates' },
    { key: 'match_rsvp', label: 'RSVP Availability for Upcoming Fixtures', enabled: true, desc: 'Notify team captain of availability for weekend matches' },
    { key: 'transfer_request', label: 'Submit Team Transfer Request', enabled: true, desc: 'Initiate formal release and transfer to another registered club' },
    { key: 'export_stats', label: 'Download Verified Player Profile PDF', enabled: true, desc: 'Export certified playing credentials for league registration' }
  ]
};

let rolePermissionsState = JSON.parse(JSON.stringify(initialRolePermissions));

// Verification queue for #265
let verificationQueue = [
  {
    id: 'ver-201',
    user_id: 'usr-1003',
    user_name: 'Rohit Sharma',
    role: 'Captain / Player',
    document_type: 'National ID / Aadhaar',
    document_number: 'XXXX-XXXX-4921',
    submitted_at: '2026-11-05T14:30:00Z',
    status: 'pending',
    club_name: 'Deccan Chargers CC'
  },
  {
    id: 'ver-202',
    user_id: 'usr-1004',
    user_name: 'Anil Kumble',
    role: 'Certified Umpire',
    document_type: 'State Board Umpire Certificate',
    document_number: 'BCCI-LVL2-8821',
    submitted_at: '2026-11-05T16:15:00Z',
    status: 'pending',
    club_name: 'Karnataka State Panel'
  },
  {
    id: 'ver-203',
    user_id: 'usr-1002',
    user_name: 'Rahul Dravid',
    role: 'Official Scorer',
    document_type: 'Official Scorer License',
    document_number: 'KSCA-SCR-1049',
    submitted_at: '2026-11-04T11:00:00Z',
    status: 'verified',
    club_name: 'Bangalore Cricket Association'
  }
];

// Reported user incidents for #266
let userReports = [
  {
    id: 'rep-301',
    reported_user_id: 'usr-901',
    reported_user_name: 'Vikram Singh',
    reported_by: 'Anil Kumble (Umpire)',
    match_ref: 'MAT-2026-03 (Trophy Semi-Final)',
    incident_type: 'Dissent & Abuse towards Umpire',
    severity: 'High',
    status: 'under_review',
    date: '2026-11-05T17:45:00Z',
    description: 'Repeatedly questioned LBW decision in 18th over using aggressive language.'
  },
  {
    id: 'rep-302',
    reported_user_id: 'usr-902',
    reported_user_name: 'Karan Patel',
    reported_by: 'Rahul Dravid (Scorer)',
    match_ref: 'MAT-2026-07 (League Match)',
    incident_type: 'Late Arrival Disrupting Schedule',
    severity: 'Medium',
    status: 'resolved',
    date: '2026-11-04T09:15:00Z',
    description: 'Arrived 45 minutes late, triggering Category Q overs deduction penalty.'
  }
];

// Active suspensions for #266
let activeSuspensions = [
  {
    id: 'susp-101',
    user_id: 'usr-905',
    user_name: 'Suresh Raina (Club Player)',
    reason: 'Equipment Tampering & Ball Alteration',
    duration: '14 Days',
    imposed_by: 'Platform Administrator',
    start_date: '2026-11-01T00:00:00Z',
    end_date: '2026-11-15T23:59:59Z',
    status: 'Active'
  }
];

// System audit logs for #267
let auditLogs = [
  {
    id: 'log-8001',
    timestamp: '2026-11-06T09:45:12Z',
    actor: 'Munna Aziz',
    role: 'Super-Admin',
    action: 'USER_LOGIN',
    target: 'Platform Core',
    ip_address: '103.212.145.42',
    severity: 'INFO',
    details: 'Authenticated via email credentials with remember token'
  },
  {
    id: 'log-8002',
    timestamp: '2026-11-06T08:30:00Z',
    actor: 'Rahul Dravid',
    role: 'Scorer',
    action: 'SCORE_CORRECTION',
    target: 'Match #102: Royals vs Titans',
    ip_address: '103.212.145.88',
    severity: 'WARNING',
    details: 'Amended over 14.3 from Leg-Bye to Batsman Boundary 4'
  },
  {
    id: 'log-8003',
    timestamp: '2026-11-05T20:10:44Z',
    actor: 'System Automation',
    role: 'System',
    action: 'DATABASE_BACKUP_COMPLETED',
    target: 'PostgreSQL Snapshot Storage',
    ip_address: '127.0.0.1',
    severity: 'INFO',
    details: 'Automated nightly snapshot created: snap-20261105-01.sql (14.2 MB)'
  },
  {
    id: 'log-8004',
    timestamp: '2026-11-05T18:02:19Z',
    actor: 'Munna Aziz',
    role: 'Super-Admin',
    action: 'PENALTY_RULE_ASSIGNED',
    target: 'Tournament #TRN-2026-01',
    ip_address: '103.212.145.42',
    severity: 'INFO',
    details: 'Category Q rule set to Method 1 (Overs Deduction: 1 over per 4 mins)'
  },
  {
    id: 'log-8005',
    timestamp: '2026-11-05T15:22:01Z',
    actor: 'Security Monitor',
    role: 'Security',
    action: 'SUSPICIOUS_LOGIN_BLOCKED',
    target: 'Account: usr-1001',
    ip_address: '185.220.101.5',
    severity: 'CRITICAL',
    details: '5 failed password attempts from foreign ASN blocked by rate limiter'
  }
];

// Database backups archive for #268
let databaseBackups = [
  {
    id: 'bkp-20261106-01',
    timestamp: '2026-11-06T04:00:00Z',
    type: 'Full Platform Snapshot',
    size: '14.8 MB',
    checksum: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    status: 'Verified & Secure',
    records_count: 12450
  },
  {
    id: 'bkp-20261105-01',
    timestamp: '2026-11-05T04:00:00Z',
    type: 'Full Platform Snapshot',
    size: '14.2 MB',
    checksum: 'sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
    status: 'Verified & Secure',
    records_count: 12100
  },
  {
    id: 'bkp-20261104-01',
    timestamp: '2026-11-04T04:00:00Z',
    type: 'Scores & Match Center Data',
    size: '4.6 MB',
    checksum: 'sha256:6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b',
    status: 'Verified & Secure',
    records_count: 4800
  }
];

// Security settings for #269
let securitySettings = {
  two_factor_auth_required: false,
  session_timeout_minutes: 60,
  max_failed_attempts: 5,
  password_expiry_days: 90,
  allow_mobile_login: true,
  privacy_data_export_enabled: true
};

// System notifications management for #270
let notificationChannels = {
  sms_enabled: true,
  email_enabled: true,
  push_enabled: true,
  in_app_banner: true
};

let notificationHistory = [
  {
    id: 'notif-101',
    channel: 'In-App + Email',
    target: 'All Registered Captains',
    title: 'Weekend Fixture Rescheduling Alert',
    message: 'Rain forecast for Saturday matches at Central Ground. Revised schedule posted.',
    sent_at: '2026-11-05T12:00:00Z',
    delivery_count: 24,
    status: 'Delivered'
  },
  {
    id: 'notif-102',
    channel: 'SMS',
    target: 'Official Scorers',
    title: 'Category Q Late Arrival Rule Notice',
    message: 'Reminder to record official toss time 15 minutes before scheduled match start.',
    sent_at: '2026-11-04T18:30:00Z',
    delivery_count: 12,
    status: 'Delivered'
  }
];

// Super-admin platform metrics for #257
let platformMaintenanceMode = false;
let globalBroadcastBanner = null;

export const mockClient = {
  // Existing Core Queries
  async getStats() {
    await delay();
    return { data: { ...mockStats }, error: null };
  },

  async getTournaments() {
    await delay();
    return { data: [...mockTournaments], error: null };
  },

  async getMatches(filterStatus = null) {
    await delay();
    if (!filterStatus || filterStatus === 'all') {
      return { data: [...mockMatches], error: null };
    }
    const filtered = mockMatches.filter((m) => m.status === filterStatus);
    return { data: filtered, error: null };
  },

  async getLiveMatches() {
    await delay();
    const live = mockMatches.filter((m) => m.status === 'live');
    return { data: live, error: null };
  },

  async getTeams() {
    await delay();
    return { data: [...mockTeams], error: null };
  },

  async getCategoryQPolicy() {
    await delay();
    return { data: { ...mockCategoryQPenaltyPolicy }, error: null };
  },

  // ==========================================
  // Feature #254: User Registration
  // ==========================================
  async registerUser(userData) {
    await delay(200);
    const normalizedEmail = userData.email?.trim().toLowerCase();
    const normalizedPhone = normalizeMobile(userData.mobile_number);

    // Check duplicate email
    const emailExists = mockUsers.some((u) => u.email.toLowerCase() === normalizedEmail);
    if (emailExists) {
      return {
        data: null,
        error: 'An account with this email address already exists. Please sign in or use another email.'
      };
    }

    // Check duplicate mobile number
    const mobileExists = mockUsers.some((u) => normalizeMobile(u.mobile_number) === normalizedPhone);
    if (mobileExists) {
      return {
        data: null,
        error: 'An account with this mobile number already exists. Please sign in or use another mobile number.'
      };
    }

    const newUser = {
      id: `usr-${Date.now()}`,
      full_name: userData.full_name?.trim(),
      email: normalizedEmail,
      mobile_number: userData.mobile_number?.trim(),
      password: userData.password,
      role: 'Registered Member',
      is_verified: false,
      is_suspended: false,
      created_at: new Date().toISOString()
    };

    mockUsers.push(newUser);
    return { data: newUser, error: null };
  },

  // ==========================================
  // Feature #255: User Login and Logout
  // ==========================================
  async loginUser({ identifier, password, rememberMe = false }) {
    await delay(180);
    if (!identifier || !password) {
      return { data: null, error: 'Please enter both identifier and password.' };
    }

    const cleanId = identifier.trim();
    const cleanPhone = normalizeMobile(cleanId);
    const cleanEmail = cleanId.toLowerCase();

    const user = mockUsers.find((u) => {
      const matchEmail = u.email.toLowerCase() === cleanEmail;
      const matchPhone = normalizeMobile(u.mobile_number) === cleanPhone && cleanPhone.length === 10;
      return matchEmail || matchPhone;
    });

    if (!user) {
      return {
        data: null,
        error: 'No account found with this email or mobile number. Please check your credentials or register.'
      };
    }

    if (user.is_suspended) {
      return {
        data: null,
        error: 'This account has been suspended by an administrator. Please contact league support.'
      };
    }

    if (user.password !== password) {
      return {
        data: null,
        error: 'Incorrect password. Please try again or use password recovery.'
      };
    }

    currentSessionUser = {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      mobile_number: user.mobile_number,
      role: user.role,
      token: `mock-jwt-token-${Date.now()}`,
      remember_me: rememberMe,
      logged_in_at: new Date().toISOString()
    };

    return { data: currentSessionUser, error: null };
  },

  async getCurrentUser() {
    await delay(30);
    return { data: currentSessionUser, error: null };
  },

  async logoutUser() {
    await delay(60);
    currentSessionUser = null;
    return { data: { success: true }, error: null };
  },

  // ==========================================
  // Feature #256: Password Recovery
  // ==========================================
  async requestPasswordRecovery({ identifier }) {
    await delay(200);
    if (!identifier) {
      return { data: null, error: 'Please provide an email address or 10-digit mobile number.' };
    }
    const cleanId = identifier.trim().toLowerCase();
    const cleanPhone = normalizeMobile(cleanId);

    const user = mockUsers.find((u) => 
      u.email.toLowerCase() === cleanId || 
      (normalizeMobile(u.mobile_number) === cleanPhone && cleanPhone.length === 10)
    );

    if (!user) {
      return {
        data: null,
        error: 'No registered user matches the provided email or mobile number.'
      };
    }

    const testOtp = '748291';
    const recoveryToken = `recov-tok-${Date.now()}`;

    return {
      data: {
        success: true,
        user_id: user.id,
        identifier: cleanId,
        test_otp: testOtp,
        recovery_token: recoveryToken,
        masked_contact: user.email.includes('@') 
          ? user.email.replace(/(.{2})(.*)(?=@)/, (_, a, b) => a + '*'.repeat(b.length)) 
          : 'XXXX-XX' + cleanPhone.slice(-4),
        message: `Recovery code generated. Use code ${testOtp} to verify and reset your password.`
      },
      error: null
    };
  },

  async verifyPasswordRecoveryOTP({ identifier, otp }) {
    await delay(150);
    if (otp !== '748291') {
      return { data: null, error: 'Invalid verification code. Please check the code and try again.' };
    }
    return { data: { verified: true }, error: null };
  },

  async completePasswordReset({ identifier, newPassword }) {
    await delay(200);
    const cleanId = identifier.trim().toLowerCase();
    const cleanPhone = normalizeMobile(cleanId);

    const userIndex = mockUsers.findIndex((u) => 
      u.email.toLowerCase() === cleanId || 
      (normalizeMobile(u.mobile_number) === cleanPhone && cleanPhone.length === 10)
    );

    if (userIndex === -1) {
      return { data: null, error: 'User account not found.' };
    }

    mockUsers[userIndex].password = newPassword;
    return {
      data: {
        success: true,
        message: 'Password successfully updated! You can now log in with your new credentials.'
      },
      error: null
    };
  },

  // ==========================================
  // Feature #257: Super-Admin Dashboard
  // ==========================================
  async getSuperAdminMetrics() {
    await delay(100);
    return {
      data: {
        total_users: mockUsers.length + 184,
        active_tournaments: 6,
        registered_teams: 32,
        active_matches: 3,
        system_uptime: '99.98%',
        server_status: 'Healthy (Asia-South Mumbai Node)',
        memory_usage: '1,280 MB / 3,072 MB (41%)',
        maintenance_mode: platformMaintenanceMode,
        broadcast_banner: globalBroadcastBanner,
        role_breakdown: {
          super_admins: 2,
          admins: 6,
          organisers: 18,
          team_owners: 32,
          captains: 44,
          scorers: 28,
          umpires: 22,
          players: mockUsers.length + 32
        }
      },
      error: null
    };
  },

  async togglePlatformMaintenance(enabled) {
    await delay(100);
    platformMaintenanceMode = !!enabled;
    return { data: { maintenance_mode: platformMaintenanceMode }, error: null };
  },

  async setGlobalBroadcast({ message, level = 'info' }) {
    await delay(100);
    if (!message) {
      globalBroadcastBanner = null;
    } else {
      globalBroadcastBanner = { message, level, timestamp: new Date().toISOString() };
    }
    return { data: { broadcast: globalBroadcastBanner }, error: null };
  },

  // ==========================================
  // Feature #258: Admin Dashboard
  // ==========================================
  async getAdminQueue() {
    await delay(100);
    return {
      data: {
        pending_tournaments: [
          { id: 'trn-req-01', name: 'Pune Super League T20', applicant: 'Pune District Cricket Club', grounds: 'DY Patil Stadium', dates: 'Dec 10 - Dec 20, 2026', teams: 16 },
          { id: 'trn-req-02', name: 'Monsoon Corporate Trophy', applicant: 'Deccan Corporate League', grounds: 'Gymkhana Grounds', dates: 'Jan 5 - Jan 15, 2027', teams: 8 }
        ],
        pending_team_sanctions: [
          { id: 'tm-req-01', team_name: 'Deccan Daredevils', owner: 'Mahesh Joshi', roster_count: 15, fee_status: 'Paid' },
          { id: 'tm-req-02', team_name: 'Shivaji Strikers', owner: 'Sunil Patil', roster_count: 14, fee_status: 'Pending Verification' }
        ],
        active_disputes: [
          { id: 'disp-01', match: 'Match #102: Royals vs Titans', raised_by: 'Titans Captain', reason: 'Disputed run-out decision in 19th over', status: 'Hearing Scheduled' }
        ]
      },
      error: null
    };
  },

  async resolveAdminQueueItem({ id, type, resolution, notes }) {
    await delay(150);
    return {
      data: { success: true, item_id: id, resolution, notes, resolved_at: new Date().toISOString() },
      error: null
    };
  },

  // ==========================================
  // Features #259–#264: Role Permissions Management
  // ==========================================
  async getRolePermissions(role) {
    await delay(80);
    const validRole = rolePermissionsState[role] ? role : 'organiser';
    return {
      data: {
        role: validRole,
        permissions: [...rolePermissionsState[validRole]]
      },
      error: null
    };
  },

  async toggleRolePermission({ role, key, enabled }) {
    await delay(100);
    if (!rolePermissionsState[role]) {
      return { data: null, error: `Invalid role: ${role}` };
    }
    const perm = rolePermissionsState[role].find((p) => p.key === key);
    if (!perm) {
      return { data: null, error: `Permission key ${key} not found for role ${role}` };
    }
    perm.enabled = !!enabled;
    return { data: { success: true, role, key, enabled: perm.enabled }, error: null };
  },

  async resetRolePermissionsToDefaults(role) {
    await delay(80);
    if (!initialRolePermissions[role]) {
      return { data: null, error: `Invalid role: ${role}` };
    }
    rolePermissionsState[role] = JSON.parse(JSON.stringify(initialRolePermissions[role]));
    return { data: { success: true, role, permissions: rolePermissionsState[role] }, error: null };
  },

  // ==========================================
  // Feature #265: User Verification
  // ==========================================
  async getVerificationQueue() {
    await delay(100);
    return { data: [...verificationQueue], error: null };
  },

  async processUserVerification({ id, status, rejectionReason = '' }) {
    await delay(120);
    const item = verificationQueue.find((v) => v.id === id);
    if (!item) {
      return { data: null, error: 'Verification request not found.' };
    }
    item.status = status;
    item.rejection_reason = rejectionReason;
    item.processed_at = new Date().toISOString();

    // If verified, update matching user in mockUsers
    if (status === 'verified') {
      const u = mockUsers.find((user) => user.id === item.user_id);
      if (u) u.is_verified = true;
    }

    return { data: { ...item }, error: null };
  },

  // ==========================================
  // Feature #266: User Reporting and Suspension
  // ==========================================
  async getUserReports() {
    await delay(100);
    return { data: [...userReports], error: null };
  },

  async getActiveSuspensions() {
    await delay(80);
    return { data: [...activeSuspensions], error: null };
  },

  async suspendUserAccount({ userId, userName, reason, duration }) {
    await delay(150);
    const newSusp = {
      id: `susp-${Date.now()}`,
      user_id: userId,
      user_name: userName || 'User ' + userId,
      reason,
      duration,
      imposed_by: currentSessionUser?.full_name || 'System Administrator',
      start_date: new Date().toISOString(),
      end_date: new Date(Date.now() + 14 * 86400000).toISOString(),
      status: 'Active'
    };
    activeSuspensions.push(newSusp);

    const user = mockUsers.find((u) => u.id === userId);
    if (user) user.is_suspended = true;

    return { data: newSusp, error: null };
  },

  async liftSuspension(suspensionId) {
    await delay(120);
    const susp = activeSuspensions.find((s) => s.id === suspensionId);
    if (susp) {
      susp.status = 'Lifted';
      const user = mockUsers.find((u) => u.id === susp.user_id);
      if (user) user.is_suspended = false;
    }
    return { data: { success: true }, error: null };
  },

  // ==========================================
  // Feature #267: Activity and Audit Logs
  // ==========================================
  async getAuditLogs(filters = {}) {
    await delay(100);
    let filtered = [...auditLogs];
    if (filters.severity && filters.severity !== 'all') {
      filtered = filtered.filter((l) => l.severity.toLowerCase() === filters.severity.toLowerCase());
    }
    if (filters.query) {
      const q = filters.query.toLowerCase();
      filtered = filtered.filter((l) => 
        l.action.toLowerCase().includes(q) || 
        l.actor.toLowerCase().includes(q) || 
        l.details.toLowerCase().includes(q)
      );
    }
    return { data: filtered, error: null };
  },

  async recordAuditEvent({ action, actor, target, severity = 'INFO', details = '' }) {
    const newLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor: actor || currentSessionUser?.full_name || 'Anonymous',
      role: currentSessionUser?.role || 'Guest',
      action,
      target,
      ip_address: '103.212.145.42',
      severity,
      details
    };
    auditLogs.unshift(newLog);
    return { data: newLog, error: null };
  },

  // ==========================================
  // Feature #268: Database Backup
  // ==========================================
  async getDatabaseBackups() {
    await delay(100);
    return { data: [...databaseBackups], error: null };
  },

  async triggerDatabaseBackup({ type = 'Full Platform Snapshot' }) {
    await delay(350);
    const newBackup = {
      id: `bkp-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type,
      size: type.includes('Full') ? '15.1 MB' : '5.2 MB',
      checksum: `sha256:${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`,
      status: 'Verified & Secure',
      records_count: 12540
    };
    databaseBackups.unshift(newBackup);
    return { data: newBackup, error: null };
  },

  async simulateBackupRestore(backupId) {
    await delay(400);
    const bkp = databaseBackups.find((b) => b.id === backupId);
    if (!bkp) {
      return { data: null, error: 'Backup archive not found.' };
    }
    return {
      data: {
        success: true,
        restored_id: bkp.id,
        restored_at: new Date().toISOString(),
        message: `Snapshot ${bkp.id} verified and integrity confirmed (0 errors).`
      },
      error: null
    };
  },

  // ==========================================
  // Feature #269: Security and Privacy Management
  // ==========================================
  async getSecuritySettings() {
    await delay(80);
    return { data: { ...securitySettings }, error: null };
  },

  async updateSecuritySettings(newSettings) {
    await delay(120);
    securitySettings = { ...securitySettings, ...newSettings };
    return { data: { ...securitySettings }, error: null };
  },

  async exportUserDataGDPR(userId) {
    await delay(250);
    const user = mockUsers.find((u) => u.id === userId) || mockUsers[0];
    const exportBundle = {
      export_version: '1.0',
      exported_at: new Date().toISOString(),
      account_summary: {
        id: user.id,
        name: user.full_name,
        email: user.email,
        mobile: user.mobile_number,
        role: user.role,
        verified: user.is_verified
      },
      privacy_notice: 'Export generated under Digital Personal Data Protection (DPDP) compliance guidelines.'
    };
    return { data: exportBundle, error: null };
  },

  // ==========================================
  // Feature #270: Notifications Management
  // ==========================================
  async getNotificationSettings() {
    await delay(80);
    return {
      data: {
        channels: { ...notificationChannels },
        history: [...notificationHistory]
      },
      error: null
    };
  },

  async updateNotificationChannels(channels) {
    await delay(100);
    notificationChannels = { ...notificationChannels, ...channels };
    return { data: { ...notificationChannels }, error: null };
  },

  async dispatchCustomNotification({ channel, targetGroup, title, message }) {
    await delay(200);
    const newNotice = {
      id: `notif-${Date.now()}`,
      channel,
      target: targetGroup,
      title,
      message,
      sent_at: new Date().toISOString(),
      delivery_count: targetGroup.includes('All') ? 142 : 18,
      status: 'Delivered'
    };
    notificationHistory.unshift(newNotice);
    return { data: newNotice, error: null };
  },

  // ==========================================
  // Category N Phase 1 Full Manifest (#254–#270)
  // ==========================================
  async getCategoryNSlots() {
    await delay(50);
    const slots = [
      { id: 254, title: 'User registration', category: 'N', status: 'Implemented & Verified', pillar: 'Authentication', description: 'Self-service registration with email, mobile, password validation, and terms agreement.' },
      { id: 255, title: 'User login and logout', category: 'N', status: 'Implemented & Verified', pillar: 'Authentication', description: 'Dual identifier login (Email or Indian Mobile), remember-me session, and secure sign-out.' },
      { id: 256, title: 'Password recovery', category: 'N', status: 'Implemented & Verified', pillar: 'Authentication', description: 'Self-service password reset workflow with OTP verification and new password creation.' },
      { id: 257, title: 'Super-admin dashboard', category: 'N', status: 'Implemented & Verified', pillar: 'Administrative Dashboards', description: 'Platform health monitoring, maintenance mode toggle, tenant stats, and broadcast banners.' },
      { id: 258, title: 'Admin dashboard', category: 'N', status: 'Implemented & Verified', pillar: 'Administrative Dashboards', description: 'Regional operations queue: tournament approvals, team sanctions, and match dispute resolution.' },
      { id: 259, title: 'Organiser permissions', category: 'N', status: 'Implemented & Verified', pillar: 'Role Permissions', description: 'RBAC controls for tournament creation, venue allocation, fixture rescheduling, and Cat Q penalty assignment.' },
      { id: 260, title: 'Team owner permissions', category: 'N', status: 'Implemented & Verified', pillar: 'Role Permissions', description: 'RBAC controls for team squad rosters, player transfers, tournament entries, and branding.' },
      { id: 261, title: 'Captain permissions', category: 'N', status: 'Implemented & Verified', pillar: 'Role Permissions', description: 'RBAC controls for Playing XI submission, toss nomination, batting/bowling orders, and score review appeals.' },
      { id: 262, title: 'Scorer permissions', category: 'N', status: 'Implemented & Verified', pillar: 'Role Permissions', description: 'RBAC controls for ball-by-ball recording, extras, wagon wheels, DLS/VJD rain target calculation.' },
      { id: 263, title: 'Umpire permissions', category: 'N', status: 'Implemented & Verified', pillar: 'Role Permissions', description: 'RBAC controls for official match sign-off, pitch reports, code of conduct violations, and penalty runs.' },
      { id: 264, title: 'Player permissions', category: 'N', status: 'Implemented & Verified', pillar: 'Role Permissions', description: 'RBAC controls for personal stats access, fixture availability RSVP, transfer requests, and stats export.' },
      { id: 265, title: 'User verification', category: 'N', status: 'Implemented & Verified', pillar: 'User Governance', description: 'Official credential review and badge verification for players, umpires, and scorers.' },
      { id: 266, title: 'User reporting and suspension', category: 'N', status: 'Implemented & Verified', pillar: 'User Governance', description: 'Incident reports desk, disciplinary reviews, temporary bans, and indefinite suspensions.' },
      { id: 267, title: 'Activity and audit logs', category: 'N', status: 'Implemented & Verified', pillar: 'Security & Operations', description: 'Immutable, searchable system audit trail capturing logins, score amendments, and admin actions.' },
      { id: 268, title: 'Database backup', category: 'N', status: 'Implemented & Verified', pillar: 'Security & Operations', description: 'On-demand and automated database backup snapshots, checksum verification, and restore simulation.' },
      { id: 269, title: 'Security and privacy management', category: 'N', status: 'Implemented & Verified', pillar: 'Security & Operations', description: 'Two-factor authentication policies, session timeouts, active session termination, and DPDP/GDPR export.' },
      { id: 270, title: 'Notifications management', category: 'N', status: 'Implemented & Verified', pillar: 'Security & Operations', description: 'Multi-channel announcement composer (SMS, Email, Push, In-App), recipient grouping, and delivery logs.' }
    ];
    return { data: slots, error: null };
  }
};
