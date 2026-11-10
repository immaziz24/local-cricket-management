import { createClient } from '@supabase/supabase-js';

/**
 * Supabase provider (real backend)
 *
 * Implements the same async signatures as mock/mockClient.js and returns
 * { data, error } objects, so dataService.js can switch providers per feature.
 *
 * Implemented so far (Phase 1):
 *   #254 User registration
 *   #255 User login and logout
 *   #256 Password recovery (emailed verification code)
 *   #257 Super-admin dashboard (metrics, maintenance mode, platform broadcast)
 *   #258 Admin dashboard (members, verification and report queues)
 *   #259–#264 Role permissions and role assignment
 *   #265 User verification (badge requests and admin review)
 *   #266 User reporting and suspension
 *   #267–#270 Audit logs, backup export, privacy, notifications
 *   Phase 2 Category C: players and teams (add by mobile, unregistered players, captain/vice/icon)
 *   Phase 2 Category B: tournaments (create, details, team registration and approval)
 *
 * Configuration comes from .env (never commit real secrets):
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_PUBLISHABLE_KEY   (publishable/anon key only — never the service-role key)
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeMobile = (phone) => {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
};

const maskEmail = (email) =>
  email.replace(/^(.{2})(.*)(?=@)/, (_, a, b) => a + '*'.repeat(b.length));

const MOBILE_LOGIN_NOT_READY =
  'Sign-in with a mobile number is not available yet. Please use the email address you registered with.';

// Highest role first; labels match the ones used by the existing screens.
const ROLE_LABELS = [
  ['super_admin', 'Super-Admin'],
  ['admin', 'Admin'],
  ['organiser', 'Organiser'],
  ['team_owner', 'Team Owner'],
  ['captain', 'Captain'],
  ['scorer', 'Scorer'],
  ['umpire', 'Umpire'],
  ['player', 'Player']
];

/** Turn Supabase error messages into plain, friendly text. */
function friendlyError(error, context = '') {
  const msg = (error?.message || String(error || '')).toLowerCase();

  if (msg.includes('invalid login credentials')) {
    return 'Incorrect email or password. Please try again or use password recovery.';
  }
  if (msg.includes('email not confirmed')) {
    return 'Please confirm your email address first. Open the confirmation email we sent you, then sign in.';
  }
  if (msg.includes('user already registered') || msg.includes('already been registered')) {
    return 'An account with this email address already exists. Please sign in or use another email.';
  }
  if (msg.includes('database error saving new user')) {
    // Most likely cause: the unique mobile-number index in public.profiles.
    return 'An account with this mobile number already exists. Please sign in or use another mobile number.';
  }
  if (msg.includes('rate limit') || msg.includes('too many')) {
    return 'Too many attempts or emails in a short time. Please wait a few minutes and try again.';
  }
  if (msg.includes('token has expired') || msg.includes('otp_expired') || msg.includes('invalid token')) {
    return 'This code is invalid or has expired. Please request a new code.';
  }
  if (msg.includes('password') && (msg.includes('weak') || msg.includes('at least'))) {
    return 'This password is too weak. Use at least 8 characters with a mix of letters and numbers.';
  }
  if (msg.includes('same password') || msg.includes('different from the old')) {
    return 'Your new password must be different from your old password.';
  }
  if (msg.includes('failed to fetch') || msg.includes('network')) {
    return 'Cannot reach the server. Please check your internet connection and try again.';
  }
  return error?.message || `Something went wrong${context ? ` (${context})` : ''}. Please try again.`;
}

/** Build the session-user object the screens expect (same shape as the mock). */
async function buildSessionUser(session, rememberMe = true) {
  const authUser = session.user;

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name, mobile_number, account_status')
      .eq('id', authUser.id)
      .maybeSingle(),
    supabase
      .from('user_role_assignments')
      .select('role')
      .eq('user_id', authUser.id)
      .eq('is_active', true)
  ]);

  const roleKeys = new Set((roles || []).map((r) => r.role));
  const topRole = ROLE_LABELS.find(([key]) => roleKeys.has(key));

  return {
    id: authUser.id,
    full_name:
      profile?.display_name ||
      authUser.user_metadata?.full_name ||
      authUser.email,
    email: authUser.email,
    mobile_number: profile?.mobile_number || authUser.user_metadata?.mobile_number || '',
    role: topRole ? topRole[1] : 'Registered Member',
    account_status: profile?.account_status || 'active',
    token: session.access_token,
    remember_me: rememberMe,
    logged_in_at: new Date().toISOString()
  };
}

// ------------------------------------------------------------------
// Provider
// ------------------------------------------------------------------

export const supabaseClient = {
  // ==========================================
  // Feature #254: User Registration
  // ==========================================
  async registerUser(userData) {
    const email = userData.email?.trim().toLowerCase();
    const fullName = userData.full_name?.trim();
    const mobile = normalizeMobile(userData.mobile_number);

    const { data, error } = await supabase.auth.signUp({
      email,
      password: userData.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName, display_name: fullName, mobile_number: mobile }
      }
    });

    if (error) return { data: null, error: friendlyError(error, 'registration') };

    // When email confirmation is on, Supabase hides duplicate emails by returning
    // a user with no identities instead of an error.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return {
        data: null,
        error: 'An account with this email address already exists. Please sign in or use another email.'
      };
    }

    // Sign-up must not leave the new user signed in before they confirm their email.
    const needsEmailConfirmation = !data.session;

    return {
      data: {
        id: data.user?.id,
        full_name: fullName,
        email,
        mobile_number: mobile,
        role: 'Registered Member',
        is_verified: !needsEmailConfirmation,
        is_suspended: false,
        needs_email_confirmation: needsEmailConfirmation,
        created_at: data.user?.created_at || new Date().toISOString()
      },
      error: null
    };
  },

  // ==========================================
  // Feature #255: User Login and Logout
  // ==========================================
  async loginUser({ identifier, password, rememberMe = false }) {
    if (!identifier || !password) {
      return { data: null, error: 'Please enter both your email and password.' };
    }

    const email = identifier.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return { data: null, error: MOBILE_LOGIN_NOT_READY };
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { data: null, error: friendlyError(error, 'login') };

    // Lift an expired suspension automatically (#266), then load the profile.
    await supabase.rpc('refresh_my_account_status');
    const user = await buildSessionUser(data.session, rememberMe);

    if (user.account_status === 'suspended' || user.account_status === 'disabled') {
      await supabase.auth.signOut();
      return {
        data: null,
        error: 'This account has been suspended by an administrator. Please contact league support.'
      };
    }

    return { data: user, error: null };
  },

  async getCurrentUser() {
    const { data, error } = await supabase.auth.getSession();
    if (error) return { data: null, error: friendlyError(error) };
    if (!data.session) return { data: null, error: null };
    return { data: await buildSessionUser(data.session), error: null };
  },

  async logoutUser() {
    const { error } = await supabase.auth.signOut();
    if (error) return { data: null, error: friendlyError(error, 'logout') };
    return { data: { success: true }, error: null };
  },

  // ==========================================
  // Feature #256: Password Recovery
  // Step 1: email a code  -> Step 2: verify code -> Step 3: set new password
  // Requires the "Reset Password" email template to include {{ .Token }}.
  // ==========================================
  async requestPasswordRecovery({ identifier }) {
    const email = identifier?.trim().toLowerCase();
    if (!email) {
      return { data: null, error: 'Please enter the email address you registered with.' };
    }
    if (!EMAIL_RE.test(email)) {
      return {
        data: null,
        error: 'Password recovery by mobile number is not available yet. Please enter your registered email address.'
      };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });
    if (error) return { data: null, error: friendlyError(error, 'password recovery') };

    // For privacy, the same message is shown whether or not the email is registered.
    return {
      data: {
        success: true,
        identifier: email,
        masked_contact: maskEmail(email),
        message: `If an account exists for ${maskEmail(email)}, we have emailed a verification code. It may take a minute to arrive.`
      },
      error: null
    };
  },

  async verifyPasswordRecoveryOTP({ identifier, otp }) {
    const email = identifier?.trim().toLowerCase();
    const token = String(otp || '').replace(/\s/g, '');
    if (!/^\d{6,10}$/.test(token)) {
      return { data: null, error: 'Please enter the numeric code from the email.' };
    }

    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'recovery' });
    if (error) return { data: null, error: friendlyError(error, 'code verification') };
    return { data: { verified: true }, error: null };
  },

  async completePasswordReset({ newPassword }) {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      return { data: null, error: 'Your recovery session has expired. Please request a new code.' };
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { data: null, error: friendlyError(error, 'password update') };

    // Sign out so the user signs in again with the new password.
    await supabase.auth.signOut();
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
  // All checks happen in the database: each function verifies the Super-Admin role.
  // ==========================================
  async getSuperAdminMetrics() {
    const { data, error } = await supabase.rpc('get_super_admin_metrics');
    if (error) return { data: null, error: friendlyError(error, 'super-admin dashboard') };
    return { data, error: null };
  },

  async togglePlatformMaintenance(enabled) {
    const { data, error } = await supabase.rpc('set_maintenance_mode', { p_enabled: !!enabled });
    if (error) return { data: null, error: friendlyError(error, 'maintenance mode') };
    return { data, error: null };
  },

  async setGlobalBroadcast(broadcast) {
    const { data, error } = await supabase.rpc('set_platform_broadcast', {
      p_message: broadcast?.message || null,
      p_level: broadcast?.level || 'info'
    });
    if (error) return { data: null, error: friendlyError(error, 'announcement') };
    return { data, error: null };
  },

  // ==========================================
  // Feature #258: Admin Dashboard (Admin or Super-Admin)
  // ==========================================
  async getAdminDashboard() {
    const { data, error } = await supabase.rpc('get_admin_dashboard');
    if (error) return { data: null, error: friendlyError(error, 'admin dashboard') };
    return { data, error: null };
  },

  // ==========================================
  // Features #259–#264: Role permissions and role assignment
  // ==========================================
  async getRolePermissions(role) {
    const { data, error } = await supabase
      .from('role_permissions')
      .select('permission_key, label, description, enabled, default_enabled')
      .eq('role', role)
      .order('sort_order');
    if (error) return { data: null, error: friendlyError(error, 'role permissions') };
    return {
      data: {
        role,
        permissions: (data || []).map((p) => ({
          key: p.permission_key,
          label: p.label,
          desc: p.description,
          enabled: p.enabled,
          default_enabled: p.default_enabled
        }))
      },
      error: null
    };
  },

  async toggleRolePermission({ role, key, enabled }) {
    const { data, error } = await supabase.rpc('set_role_permission', { p_role: role, p_key: key, p_enabled: !!enabled });
    if (error) return { data: null, error: friendlyError(error, 'role permission') };
    return { data, error: null };
  },

  async resetRolePermissionsToDefaults(role) {
    const { error } = await supabase.rpc('reset_role_permissions', { p_role: role });
    if (error) return { data: null, error: friendlyError(error, 'role permissions reset') };
    return this.getRolePermissions(role);
  },

  async listMembersWithRoles() {
    const { data, error } = await supabase.rpc('list_members_with_roles');
    if (error) return { data: null, error: friendlyError(error, 'members list') };
    return { data: data || [], error: null };
  },

  async assignRole({ userId, role }) {
    const { data, error } = await supabase.rpc('assign_role', { p_user_id: userId, p_role: role });
    if (error) return { data: null, error: friendlyError(error, 'assign role') };
    return { data, error: null };
  },

  async revokeRole({ userId, role }) {
    const { data, error } = await supabase.rpc('revoke_role', { p_user_id: userId, p_role: role });
    if (error) return { data: null, error: friendlyError(error, 'remove role') };
    return { data, error: null };
  },

  // ==========================================
  // Feature #265: User Verification
  // ==========================================
  async getMyVerifications() {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (!uid) return { data: [], error: null };
    const { data, error } = await supabase
      .from('user_verifications')
      .select('id, verification_type, status, submitted_at, reviewed_at')
      .eq('user_id', uid)
      .in('verification_type', ['identity', 'umpire', 'scorer'])
      .order('submitted_at', { ascending: false });
    if (error) return { data: null, error: friendlyError(error, 'your verification requests') };
    return { data: data || [], error: null };
  },

  async requestVerification({ type, note }) {
    const { data, error } = await supabase.rpc('request_verification', { p_type: type, p_note: note || null });
    if (error) return { data: null, error: friendlyError(error, 'verification request') };
    return { data, error: null };
  },

  async getVerificationQueue(status = null) {
    const { data, error } = await supabase.rpc('list_verification_requests', { p_status: status });
    if (error) return { data: null, error: friendlyError(error, 'verification queue') };
    return { data: data || [], error: null };
  },

  async processUserVerification({ id, approve, note }) {
    const { data, error } = await supabase.rpc('review_verification', { p_id: id, p_approve: !!approve, p_note: note || null });
    if (error) return { data: null, error: friendlyError(error, 'verification review') };
    return { data, error: null };
  },

  // ==========================================
  // Feature #266: User Reporting and Suspension
  // ==========================================
  async searchMembers(query) {
    const { data, error } = await supabase.rpc('search_members', { p_query: query });
    if (error) return { data: null, error: friendlyError(error, 'member search') };
    return { data: data || [], error: null };
  },

  async reportUser({ userId, reason, description }) {
    const { data, error } = await supabase.rpc('report_user', { p_reported_user_id: userId, p_reason: reason, p_description: description || null });
    if (error) return { data: null, error: friendlyError(error, 'report') };
    return { data, error: null };
  },

  async getUserReports(status = null) {
    const { data, error } = await supabase.rpc('list_user_reports', { p_status: status });
    if (error) return { data: null, error: friendlyError(error, 'reports') };
    return { data: data || [], error: null };
  },

  async resolveUserReport({ id, dismiss, note }) {
    const { data, error } = await supabase.rpc('resolve_user_report', { p_id: id, p_dismiss: !!dismiss, p_note: note || null });
    if (error) return { data: null, error: friendlyError(error, 'report review') };
    return { data, error: null };
  },

  async getActiveSuspensions() {
    const { data, error } = await supabase.rpc('list_active_suspensions');
    if (error) return { data: null, error: friendlyError(error, 'suspensions') };
    return { data: data || [], error: null };
  },

  async suspendUserAccount({ userId, reason, days }) {
    const { data, error } = await supabase.rpc('suspend_user', { p_user_id: userId, p_reason: reason, p_days: days || null });
    if (error) return { data: null, error: friendlyError(error, 'suspension') };
    return { data, error: null };
  },

  async liftSuspension(suspensionId, note) {
    const { data, error } = await supabase.rpc('lift_suspension', { p_suspension_id: suspensionId, p_note: note || null });
    if (error) return { data: null, error: friendlyError(error, 'lift suspension') };
    return { data, error: null };
  },

  // ==========================================
  // Features #267–#270: Security & operations
  // ==========================================
  async listAuditLogs({ search, limit } = {}) {
    const { data, error } = await supabase.rpc('list_audit_logs', { p_search: search || null, p_limit: limit || 200 });
    if (error) return { data: null, error: friendlyError(error, 'audit log') };
    return { data: data || [], error: null };
  },

  async exportPlatformSnapshot() {
    const { data, error } = await supabase.rpc('export_platform_snapshot');
    if (error) return { data: null, error: friendlyError(error, 'platform export') };
    return { data, error: null };
  },

  async exportMyData() {
    const { data, error } = await supabase.rpc('export_my_data');
    if (error) return { data: null, error: friendlyError(error, 'data export') };
    return { data, error: null };
  },

  async getPrivacySettings() {
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user?.id;
    if (!uid) return { data: null, error: 'Please sign in first.' };
    const { data, error } = await supabase.from('user_privacy_settings').select('*').eq('user_id', uid).maybeSingle();
    if (error) return { data: null, error: friendlyError(error, 'privacy settings') };
    return { data: data || { user_id: uid, profile_visibility: 'members', show_phone: false, show_email: false, allow_messages: true, analytics_opt_in: false }, error: null };
  },

  async updatePrivacySettings(settings) {
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user?.id;
    if (!uid) return { data: null, error: 'Please sign in first.' };
    const row = {
      user_id: uid,
      profile_visibility: settings.profile_visibility,
      show_phone: !!settings.show_phone,
      show_email: !!settings.show_email,
      allow_messages: !!settings.allow_messages,
      analytics_opt_in: !!settings.analytics_opt_in
    };
    const { error } = await supabase.from('user_privacy_settings').upsert(row, { onConflict: 'user_id' });
    if (error) return { data: null, error: friendlyError(error, 'privacy settings') };
    return { data: row, error: null };
  },

  async signOutEverywhere() {
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    if (error) return { data: null, error: friendlyError(error, 'sign out') };
    return { data: { success: true }, error: null };
  },

  async getMyNotifications() {
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user?.id;
    if (!uid) return { data: [], error: null };
    const { data, error } = await supabase
      .from('notifications')
      .select('id, notification_type, title, body, created_at, read_at')
      .eq('recipient_user_id', uid)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return { data: null, error: friendlyError(error, 'notifications') };
    return { data: data || [], error: null };
  },

  async markNotificationsRead(ids) {
    if (!ids || ids.length === 0) return { data: { updated: 0 }, error: null };
    const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids);
    if (error) return { data: null, error: friendlyError(error, 'notifications') };
    return { data: { updated: ids.length }, error: null };
  },

  async getNotificationPreferences() {
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user?.id;
    if (!uid) return { data: null, error: 'Please sign in first.' };
    const { data, error } = await supabase.from('notification_preferences').select('*').eq('user_id', uid).maybeSingle();
    if (error) return { data: null, error: friendlyError(error, 'notification settings') };
    return { data: data || { user_id: uid, in_app_enabled: true, email_enabled: true, push_enabled: true, sms_enabled: false }, error: null };
  },

  async updateNotificationPreferences(prefs) {
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user?.id;
    if (!uid) return { data: null, error: 'Please sign in first.' };
    const row = { user_id: uid, in_app_enabled: !!prefs.in_app_enabled, email_enabled: !!prefs.email_enabled, push_enabled: !!prefs.push_enabled, sms_enabled: !!prefs.sms_enabled };
    const { error } = await supabase.from('notification_preferences').upsert(row, { onConflict: 'user_id' });
    if (error) return { data: null, error: friendlyError(error, 'notification settings') };
    return { data: row, error: null };
  },

  async sendAnnouncement({ title, body }) {
    const { data, error } = await supabase.rpc('send_announcement', { p_title: title, p_body: body || null });
    if (error) return { data: null, error: friendlyError(error, 'announcement') };
    return { data, error: null };
  },

  // ==========================================
  // Phase 2 – Category C: players and teams
  // ==========================================
  async getMyPlayer() {
    const { data, error } = await supabase.rpc('get_my_player');
    if (error) return { data: null, error: friendlyError(error, 'player profile') };
    return { data, error: null };
  },

  async updateMyPlayer({ player_role, batting_style, bowling_style }) {
    const { data, error } = await supabase.rpc('update_my_player', {
      p_player_role: player_role || '', p_batting_style: batting_style || '', p_bowling_style: bowling_style || ''
    });
    if (error) return { data: null, error: friendlyError(error, 'player profile') };
    return { data, error: null };
  },

  async getMyTeams() {
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user?.id;
    if (!uid) return { data: [], error: null };
    const me = await supabase.rpc('get_my_player');
    const playerId = me.data?.id;
    const [owned, member] = await Promise.all([
      supabase.from('teams').select('id, name, short_name, city, logo_url, owner_id, created_at').eq('owner_id', uid),
      playerId
        ? supabase.from('team_members').select('team_id, teams(id, name, short_name, city, logo_url, owner_id, created_at)').eq('player_id', playerId)
        : Promise.resolve({ data: [] })
    ]);
    if (owned.error) return { data: null, error: friendlyError(owned.error, 'teams') };
    const map = new Map();
    (owned.data || []).forEach((t) => map.set(t.id, { ...t, i_own: true }));
    (member.data || []).forEach((m) => { if (m.teams && !map.has(m.teams.id)) map.set(m.teams.id, { ...m.teams, i_own: false }); });
    const teams = Array.from(map.values());
    if (teams.length) {
      const { data: counts } = await supabase.from('team_members').select('team_id').in('team_id', teams.map((t) => t.id));
      teams.forEach((t) => { t.squad_size = (counts || []).filter((c) => c.team_id === t.id).length; });
    }
    teams.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return { data: teams, error: null };
  },

  async getTeam(teamId) {
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user?.id;
    const [teamRes, squadRes] = await Promise.all([
      supabase.from('teams').select('id, name, short_name, city, logo_url, owner_id, created_at').eq('id', teamId).maybeSingle(),
      supabase.from('team_members')
        .select('player_id, is_captain, is_vice_captain, is_icon, jersey_number, joined_at, players(id, player_code, display_name, photo_url, player_role, batting_style, bowling_style, profile_id)')
        .eq('team_id', teamId)
    ]);
    if (teamRes.error) return { data: null, error: friendlyError(teamRes.error, 'team') };
    if (!teamRes.data) return { data: null, error: 'Team not found.' };
    if (squadRes.error) return { data: null, error: friendlyError(squadRes.error, 'team squad') };
    const iOwn = !!uid && teamRes.data.owner_id === uid;
    const squad = (squadRes.data || []).map((m) => ({
      ...m.players,
      is_registered: !!m.players?.profile_id,
      // Own photo, or (team owner) photos of unregistered players. The database re-checks this.
      can_edit_photo: !!uid && (m.players?.profile_id === uid || (!m.players?.profile_id && iOwn)),
      can_edit_details: iOwn && !m.players?.profile_id,
      is_captain: m.is_captain,
      is_vice_captain: m.is_vice_captain,
      is_icon: m.is_icon,
      jersey_number: m.jersey_number,
      joined_at: m.joined_at
    })).sort((a, b) => (b.is_captain - a.is_captain) || (b.is_vice_captain - a.is_vice_captain) || a.display_name.localeCompare(b.display_name));
    return { data: { ...teamRes.data, i_own: iOwn, squad }, error: null };
  },

  async createTeam({ name, short_name, city }) {
    const { data, error } = await supabase.rpc('create_team', { p_name: name, p_short_name: short_name || null, p_city: city || null });
    if (error) return { data: null, error: friendlyError(error, 'create team') };
    return { data, error: null };
  },

  async updateTeam({ teamId, name, short_name, city }) {
    const { data, error } = await supabase.rpc('update_team', { p_team_id: teamId, p_name: name, p_short_name: short_name || '', p_city: city || '' });
    if (error) return { data: null, error: friendlyError(error, 'update team') };
    return { data, error: null };
  },

  async findPlayerByMobile(mobile) {
    const { data, error } = await supabase.rpc('find_player_by_mobile', { p_mobile: mobile });
    if (error) return { data: null, error: friendlyError(error, 'player search') };
    return { data, error: null };
  },

  async addPlayerToTeam({ teamId, playerId }) {
    const { data, error } = await supabase.rpc('add_player_to_team', { p_team_id: teamId, p_player_id: playerId });
    if (error) return { data: null, error: friendlyError(error, 'add player') };
    return { data, error: null };
  },

  async addNewPlayerToTeam({ teamId, name, mobile, player_role, batting_style, bowling_style }) {
    const { data, error } = await supabase.rpc('add_new_player_to_team', {
      p_team_id: teamId, p_name: name, p_mobile: mobile || null,
      p_player_role: player_role || null, p_batting_style: batting_style || null, p_bowling_style: bowling_style || null
    });
    if (error) return { data: null, error: friendlyError(error, 'add player') };
    return { data, error: null };
  },

  async updateTeamPlayer({ teamId, playerId, name, player_role, batting_style, bowling_style }) {
    const { data, error } = await supabase.rpc('update_team_player', {
      p_team_id: teamId, p_player_id: playerId, p_name: name,
      p_player_role: player_role || null, p_batting_style: batting_style || null, p_bowling_style: bowling_style || null
    });
    if (error) return { data: null, error: friendlyError(error, 'edit player') };
    return { data, error: null };
  },

  async removePlayerFromTeam({ teamId, playerId }) {
    const { data, error } = await supabase.rpc('remove_player_from_team', { p_team_id: teamId, p_player_id: playerId });
    if (error) return { data: null, error: friendlyError(error, 'remove player') };
    return { data, error: null };
  },

  async setTeamLeadership({ teamId, captainId, viceCaptainId, iconId }) {
    const { data, error } = await supabase.rpc('set_team_leadership', {
      p_team_id: teamId, p_captain: captainId || null, p_vice_captain: viceCaptainId || null, p_icon: iconId || null
    });
    if (error) return { data: null, error: friendlyError(error, 'team leadership') };
    return { data, error: null };
  },

  // #61 / #69 image upload to the public 'media' bucket (max 2 MB, JPG/PNG/WEBP)
  async uploadImage(folder, ownerId, file) {
    if (!file) return { data: null, error: 'Choose an image first.' };
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return { data: null, error: 'Please choose a JPG, PNG or WEBP image.' };
    if (file.size > 2 * 1024 * 1024) return { data: null, error: 'The image must be smaller than 2 MB.' };
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${folder}/${ownerId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('media').upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' });
    if (error) return { data: null, error: friendlyError(error, 'image upload') };
    const { data } = supabase.storage.from('media').getPublicUrl(path);
    return { data: { url: data.publicUrl }, error: null };
  },

  async setPlayerPhoto({ playerId, file }) {
    const up = await this.uploadImage('players', playerId, file);
    if (up.error) return up;
    const { error } = await supabase.rpc('set_player_photo', { p_player_id: playerId, p_url: up.data.url });
    if (error) return { data: null, error: friendlyError(error, 'player photo') };
    return { data: { photo_url: up.data.url }, error: null };
  },

  async setTeamLogo({ teamId, file }) {
    const up = await this.uploadImage('teams', teamId, file);
    if (up.error) return up;
    const { error } = await supabase.rpc('set_team_logo', { p_team_id: teamId, p_url: up.data.url });
    if (error) return { data: null, error: friendlyError(error, 'team logo') };
    return { data: { logo_url: up.data.url }, error: null };
  },

  // #33 tournament logo / banner / colour
  async setTournamentImage({ tournamentId, kind, file }) {
    const up = await this.uploadImage('tournaments', tournamentId, file);
    if (up.error) return up;
    const { data, error } = await supabase.rpc('set_tournament_image', { p_tournament_id: tournamentId, p_kind: kind, p_url: up.data.url });
    if (error) return { data: null, error: friendlyError(error, 'tournament image') };
    return { data, error: null };
  },

  async updateTournamentImage({ tournamentId, kind, value }) {
    const { data, error } = await supabase.rpc('set_tournament_image', { p_tournament_id: tournamentId, p_kind: kind, p_url: value || '' });
    if (error) return { data: null, error: friendlyError(error, 'tournament image') };
    return { data, error: null };
  },

  async updateMyBirthDate(date) {
    const { data, error } = await supabase.rpc('update_my_birth_date', { p_date: date || null });
    if (error) return { data: null, error: friendlyError(error, 'date of birth') };
    return { data, error: null };
  },

  async getPlayerProfile(playerId) {
    const { data, error } = await supabase.rpc('get_player_profile', { p_player_id: playerId });
    if (error) return { data: null, error: friendlyError(error, 'player profile') };
    return { data, error: null };
  },

  async getTeamHistory(teamId) {
    const { data, error } = await supabase.rpc('get_team_history', { p_team_id: teamId });
    if (error) return { data: null, error: friendlyError(error, 'team history') };
    return { data: data || [], error: null };
  },

  // ==========================================
  // Phase 2 – Category B: tournaments
  // ==========================================
  async getTournaments() {
    const { data, error } = await supabase.from('tournaments').select('*').order('start_date', { ascending: false }).limit(200);
    if (error) return { data: null, error: friendlyError(error, 'tournaments') };
    return { data: data || [], error: null };
  },

  async getTournamentById(tournamentId) {
    if (!/^[0-9a-f-]{36}$/i.test(String(tournamentId || ''))) return { data: null, error: 'Tournament not found.' };
    const { data, error } = await supabase.from('tournaments').select('*').eq('id', tournamentId).maybeSingle();
    if (error) return { data: null, error: friendlyError(error, 'tournament') };
    if (!data) return { data: null, error: 'Tournament not found.' };
    return { data, error: null };
  },

  async getTournamentMatches(tournamentId) {
    if (!/^[0-9a-f-]{36}$/i.test(String(tournamentId || ''))) return { data: [], error: null };
    const { data, error } = await supabase
      .from('matches')
      .select('*, team_a:teams!matches_team_a_id_fkey(id, name, short_name, logo_url), team_b:teams!matches_team_b_id_fkey(id, name, short_name, logo_url), group:tournament_groups(id, name)')
      .eq('tournament_id', tournamentId)
      .order('scheduled_at', { ascending: true, nullsFirst: false })
      .order('match_no', { ascending: true });
    if (error) return { data: null, error: friendlyError(error, 'fixtures') };
    return { data: data || [], error: null };
  },

  async getTournamentStructure(tournamentId) {
    const [groups, teams] = await Promise.all([
      supabase.from('tournament_groups').select('id, name, sort_order').eq('tournament_id', tournamentId).order('sort_order'),
      supabase.from('tournament_teams').select('team_id, group_id, teams(id, name, short_name, logo_url)').eq('tournament_id', tournamentId).eq('status', 'approved')
    ]);
    if (groups.error || teams.error) return { data: null, error: friendlyError(groups.error || teams.error, 'tournament structure') };
    return {
      data: {
        groups: groups.data || [],
        teams: (teams.data || []).map((t) => ({ ...t.teams, group_id: t.group_id })).sort((a, b) => a.name.localeCompare(b.name))
      },
      error: null
    };
  },

  async createTournamentGroups({ tournamentId, count }) {
    const { data, error } = await supabase.rpc('create_tournament_groups', { p_tournament_id: tournamentId, p_group_count: count });
    if (error) return { data: null, error: friendlyError(error, 'groups') };
    return { data, error: null };
  },

  async setTeamGroup({ tournamentId, teamId, groupId }) {
    const { data, error } = await supabase.rpc('set_team_group', { p_tournament_id: tournamentId, p_team_id: teamId, p_group_id: groupId || null });
    if (error) return { data: null, error: friendlyError(error, 'group') };
    return { data, error: null };
  },

  async setTournamentStructure({ tournamentId, structure }) {
    const { data, error } = await supabase.rpc('set_tournament_structure', { p_tournament_id: tournamentId, p_structure: structure });
    if (error) return { data: null, error: friendlyError(error, 'format') };
    return { data, error: null };
  },

  async saveGeneratedFixtures({ tournamentId, fixtures, replace }) {
    const { data, error } = await supabase.rpc('save_generated_fixtures', { p_tournament_id: tournamentId, p_fixtures: fixtures, p_replace: replace !== false });
    if (error) return { data: null, error: friendlyError(error, 'fixtures') };
    return { data, error: null };
  },

  async createMatch({ tournamentId, teamA, teamB, scheduledAt, venue, stage, groupId }) {
    const { data, error } = await supabase.rpc('create_match', {
      p_tournament_id: tournamentId, p_team_a: teamA || null, p_team_b: teamB || null, p_scheduled_at: scheduledAt || null,
      p_venue: venue || null, p_stage: stage || 'league', p_group_id: groupId || null
    });
    if (error) return { data: null, error: friendlyError(error, 'add match') };
    return { data, error: null };
  },

  async rescheduleMatch({ matchId, scheduledAt, venue, reason }) {
    const { data, error } = await supabase.rpc('reschedule_match', { p_match_id: matchId, p_scheduled_at: scheduledAt, p_venue: venue || null, p_reason: reason || null });
    if (error) return { data: null, error: friendlyError(error, 'reschedule') };
    return { data, error: null };
  },

  async deleteMatch(matchId) {
    const { data, error } = await supabase.rpc('delete_match', { p_match_id: matchId });
    if (error) return { data: null, error: friendlyError(error, 'delete match') };
    return { data, error: null };
  },

  async getPointsTable(tournamentId) {
    const { data, error } = await supabase.rpc('get_points_table', { p_tournament_id: tournamentId });
    if (error) return { data: null, error: friendlyError(error, 'points table') };
    return { data: data || [], error: null };
  },

  async recordMatchResult(matchId, result) {
    const { data, error } = await supabase.rpc('record_match_result', { p_match_id: matchId, p: result });
    if (error) return { data: null, error: friendlyError(error, 'match result') };
    return { data, error: null };
  },

  async clearMatchResult(matchId) {
    const { data, error } = await supabase.rpc('clear_match_result', { p_match_id: matchId });
    if (error) return { data: null, error: friendlyError(error, 'match result') };
    return { data, error: null };
  },

  async setTournamentRules(tournamentId, rules) {
    const { data, error } = await supabase.rpc('set_tournament_rules', { p_tournament_id: tournamentId, p: rules });
    if (error) return { data: null, error: friendlyError(error, 'tournament rules') };
    return { data, error: null };
  },

  async completeTournament(tournamentId, winnerId, runnerUpId) {
    const { data, error } = await supabase.rpc('complete_tournament', { p_tournament_id: tournamentId, p_winner: winnerId || null, p_runner_up: runnerUpId || null });
    if (error) return { data: null, error: friendlyError(error, 'finish tournament') };
    return { data, error: null };
  },

  // #7–#19 ball-by-ball scoring
  // #24 #25 pause / resume, #30 history, #29 realtime
  async pauseMatch(matchId, reason) {
    const { data, error } = await supabase.rpc('pause_match', { p_match_id: matchId, p_reason: reason || null });
    if (error) return { data: null, error: friendlyError(error, 'pause') };
    return { data, error: null };
  },

  async resumeMatch(matchId) {
    const { data, error } = await supabase.rpc('resume_match', { p_match_id: matchId });
    if (error) return { data: null, error: friendlyError(error, 'resume') };
    return { data, error: null };
  },

  async getMatchHistory(matchId) {
    const { data, error } = await supabase.rpc('get_match_history', { p_match_id: matchId });
    if (error) return { data: null, error: friendlyError(error, 'history') };
    return { data, error: null };
  },

  /** Calls onChange whenever a ball, innings or the match row changes. Returns an unsubscribe function. */
  subscribeToMatch(matchId, onChange) {
    let timer = null;
    const fire = () => { clearTimeout(timer); timer = setTimeout(onChange, 300); };
    const channel = supabase.channel(`match-${matchId}-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'balls', filter: `match_id=eq.${matchId}` }, fire)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'innings', filter: `match_id=eq.${matchId}` }, fire)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, fire)
      .subscribe();
    return () => { clearTimeout(timer); supabase.removeChannel(channel); };
  },

  async getPlayerStats(playerId) {
    const { data, error } = await supabase.rpc('get_player_stats', { p_player_id: playerId });
    if (error) return { data: null, error: friendlyError(error, 'statistics') };
    return { data, error: null };
  },

  async getLeaderboards(tournamentId, limit = 10) {
    const { data, error } = await supabase.rpc('get_leaderboards', { p_tournament_id: tournamentId || null, p_limit: limit });
    if (error) return { data: null, error: friendlyError(error, 'leaderboards') };
    return { data, error: null };
  },

  async getTeamStats(teamId, vsTeamId) {
    const { data, error } = await supabase.rpc('get_team_stats', { p_team_id: teamId, p_vs_team_id: vsTeamId || null });
    if (error) return { data: null, error: friendlyError(error, 'team statistics') };
    return { data, error: null };
  },

  async getMatchAnalysis(matchId) {
    const { data, error } = await supabase.rpc('get_match_analysis', { p_match_id: matchId });
    if (error) return { data: null, error: friendlyError(error, 'match analysis') };
    return { data, error: null };
  },

  async setPlayerOfMatch(matchId, playerId) {
    const { data, error } = await supabase.rpc('set_player_of_match', { p_match_id: matchId, p_player_id: playerId || null });
    if (error) return { data: null, error: friendlyError(error, 'Player of the Match') };
    return { data, error: null };
  },

  async searchPlayers(query) {
    const { data, error } = await supabase.rpc('search_players', { p_query: query });
    if (error) return { data: null, error: friendlyError(error, 'player search') };
    return { data, error: null };
  },

  async getPlayingConditions(tournamentId, matchId) {
    const { data, error } = await supabase.rpc('get_playing_conditions', { p_tournament_id: tournamentId || null, p_match_id: matchId || null });
    if (error) return { data: null, error: friendlyError(error, 'playing conditions') };
    return { data, error: null };
  },

  async savePlayingConditions(tournamentId, matchId, rules, note) {
    const { data, error } = await supabase.rpc('save_playing_conditions', { p_tournament_id: tournamentId || null, p_match_id: matchId || null, p_rules: rules || {}, p_note: note || null });
    if (error) return { data: null, error: friendlyError(error, 'playing conditions') };
    return { data, error: null };
  },

  async getScoringRules(matchId) {
    const { data, error } = await supabase.rpc('get_scoring_rules', { p_match_id: matchId });
    if (error) return { data: null, error: friendlyError(error, 'rules') };
    return { data, error: null };
  },

  async startSuperOver(matchId, wickets) {
    const { data, error } = await supabase.rpc('start_super_over', { p_match_id: matchId, p_wickets: wickets || 2 });
    if (error) return { data: null, error: friendlyError(error, 'Super Over') };
    return { data, error: null };
  },

  async awardPenaltyRuns(matchId, to, runs, reason) {
    const { data, error } = await supabase.rpc('award_penalty_runs', { p_match_id: matchId, p_to: to, p_runs: Number(runs), p_reason: reason });
    if (error) return { data: null, error: friendlyError(error, 'penalty runs') };
    return { data, error: null };
  },

  async enforceFollowOn(matchId) {
    const { data, error } = await supabase.rpc('enforce_follow_on', { p_match_id: matchId });
    if (error) return { data: null, error: friendlyError(error, 'follow-on') };
    return { data, error: null };
  },

  async listMatchReports(matchId) {
    const { data, error } = await supabase.rpc('list_match_reports', { p_match_id: matchId });
    if (error) return { data: null, error: friendlyError(error, 'match reports') };
    return { data, error: null };
  },

  async addMatchReport(matchId, report) {
    const { data, error } = await supabase.rpc('add_match_report', { p_match_id: matchId, p: report });
    if (error) return { data: null, error: friendlyError(error, 'match report') };
    return { data, error: null };
  },

  async closeMatchReport(reportId, note) {
    const { data, error } = await supabase.rpc('close_match_report', { p_report_id: reportId, p_note: note || null });
    if (error) return { data: null, error: friendlyError(error, 'match report') };
    return { data, error: null };
  },

  async saveOfficialProfile(profile) {
    const { data, error } = await supabase.rpc('save_official_profile', { p: profile });
    if (error) return { data: null, error: friendlyError(error, 'officials') };
    return { data, error: null };
  },

  async setOfficialUnavailable(day, unavailable, note) {
    const { data, error } = await supabase.rpc('set_official_unavailable', { p_day: day, p_unavailable: !!unavailable, p_note: note || null });
    if (error) return { data: null, error: friendlyError(error, 'officials') };
    return { data, error: null };
  },

  async getOfficialProfile(userId) {
    const { data, error } = await supabase.rpc('get_official_profile', { p_user_id: userId });
    if (error) return { data: null, error: friendlyError(error, 'officials') };
    return { data, error: null };
  },

  async searchOfficials(filters) {
    const { data, error } = await supabase.rpc('search_officials', { p: filters || {} });
    if (error) return { data: null, error: friendlyError(error, 'officials') };
    return { data, error: null };
  },

  async inviteOfficial(matchId, userId, role, fee) {
    const { data, error } = await supabase.rpc('invite_official', { p_match_id: matchId, p_user_id: userId, p_role: role, p_fee: fee === '' || fee == null ? null : Number(fee) });
    if (error) return { data: null, error: friendlyError(error, 'officials') };
    return { data, error: null };
  },

  async respondOfficialInvite(assignmentId, accept) {
    const { data, error } = await supabase.rpc('respond_official_invite', { p_assignment_id: assignmentId, p_accept: !!accept });
    if (error) return { data: null, error: friendlyError(error, 'officials') };
    return { data, error: null };
  },

  async cancelOfficial(assignmentId) {
    const { data, error } = await supabase.rpc('cancel_official', { p_assignment_id: assignmentId });
    if (error) return { data: null, error: friendlyError(error, 'officials') };
    return { data, error: null };
  },

  async setOfficialPayment(assignmentId, fee, paid, note) {
    const { data, error } = await supabase.rpc('set_official_payment', { p_assignment_id: assignmentId, p_fee: fee === '' || fee == null ? null : Number(fee), p_paid: !!paid, p_note: note || null });
    if (error) return { data: null, error: friendlyError(error, 'officials') };
    return { data, error: null };
  },

  async listMatchOfficials(matchId) {
    const { data, error } = await supabase.rpc('list_match_officials', { p_match_id: matchId });
    if (error) return { data: null, error: friendlyError(error, 'officials') };
    return { data, error: null };
  },

  async myOfficialSchedule() {
    const { data, error } = await supabase.rpc('my_official_schedule', {});
    if (error) return { data: null, error: friendlyError(error, 'officials') };
    return { data, error: null };
  },

  async rateOfficial(assignmentId, rating, comment) {
    const { data, error } = await supabase.rpc('rate_official', { p_assignment_id: assignmentId, p_rating: Number(rating), p_comment: comment || null });
    if (error) return { data: null, error: friendlyError(error, 'officials') };
    return { data, error: null };
  },

  async raiseDispute(matchId, dispute) {
    const { data, error } = await supabase.rpc('raise_dispute', { p_match_id: matchId, p: dispute });
    if (error) return { data: null, error: friendlyError(error, 'officials') };
    return { data, error: null };
  },

  async updateDispute(disputeId, status, resolution) {
    const { data, error } = await supabase.rpc('update_dispute', { p_dispute_id: disputeId, p_status: status, p_resolution: resolution || null });
    if (error) return { data: null, error: friendlyError(error, 'officials') };
    return { data, error: null };
  },

  async listMatchDisputes(matchId) {
    const { data, error } = await supabase.rpc('list_match_disputes', { p_match_id: matchId });
    if (error) return { data: null, error: friendlyError(error, 'officials') };
    return { data, error: null };
  },

  async getCommentary(matchId) {
    const { data, error } = await supabase.rpc('get_commentary', { p_match_id: matchId });
    if (error) return { data: null, error: friendlyError(error, 'commentary') };
    return { data, error: null };
  },

  async getLiveState(matchId) {
    const { data, error } = await supabase.rpc('get_live_state', { p_match_id: matchId });
    if (error) return { data: null, error: friendlyError(error, 'live score') };
    return { data, error: null };
  },

  async setInningsPlayers(matchId, { striker, nonStriker, bowler }) {
    const { data, error } = await supabase.rpc('set_innings_players', { p_match_id: matchId, p_striker: striker || null, p_non_striker: nonStriker || null, p_bowler: bowler || null });
    if (error) return { data: null, error: friendlyError(error, 'players') };
    return { data, error: null };
  },

  async recordBall(matchId, ball) {
    const { data, error } = await supabase.rpc('record_ball', { p_match_id: matchId, p: ball });
    if (error) return { data: null, error: friendlyError(error, 'ball') };
    return { data, error: null };
  },

  async undoLastBall(matchId) {
    const { data, error } = await supabase.rpc('undo_last_ball', { p_match_id: matchId });
    if (error) return { data: null, error: friendlyError(error, 'undo') };
    return { data, error: null };
  },

  async endInnings(matchId, reason) {
    const { data, error } = await supabase.rpc('end_innings', { p_match_id: matchId, p_reason: reason || 'closed' });
    if (error) return { data: null, error: friendlyError(error, 'end innings') };
    return { data, error: null };
  },

  async abandonMatch(matchId, reason) {
    const { data, error } = await supabase.rpc('abandon_match', { p_match_id: matchId, p_reason: reason });
    if (error) return { data: null, error: friendlyError(error, 'abandon match') };
    return { data, error: null };
  },

  // #1–#6 matches: create, list, match centre, toss and start
  async listMatches(filter = 'all', limit = 50) {
    const { data, error } = await supabase.rpc('list_matches', { p_filter: filter, p_limit: limit });
    if (error) return { data: null, error: friendlyError(error, 'matches') };
    return { data, error: null };
  },

  async countLiveMatches() {
    const { data, error } = await supabase.rpc('count_live_matches', {});
    if (error) return { data: null, error: friendlyError(error, 'live matches') };
    return { data, error: null };
  },

  async getMatchCentre(matchId) {
    const { data, error } = await supabase.rpc('get_match_centre', { p_match_id: matchId });
    if (error) return { data: null, error: friendlyError(error, 'match') };
    return { data, error: null };
  },

  async createFriendlyMatch(details) {
    const { data, error } = await supabase.rpc('create_friendly_match', { p: details });
    if (error) return { data: null, error: friendlyError(error, 'create match') };
    return { data, error: null };
  },

  async startMatch(matchId, tossWinnerId, decision) {
    const { data, error } = await supabase.rpc('start_match', { p_match_id: matchId, p_toss_winner: tossWinnerId, p_decision: decision });
    if (error) return { data: null, error: friendlyError(error, 'start match') };
    return { data, error: null };
  },

  // Organiser adds / creates / removes tournament teams directly
  async organiserAddTeam(tournamentId, teamId) {
    const { data, error } = await supabase.rpc('organiser_add_team', { p_tournament_id: tournamentId, p_team_id: teamId });
    if (error) return { data: null, error: friendlyError(error, 'add team') };
    return { data, error: null };
  },

  async organiserCreateTeam(tournamentId, { name, short_name, city }) {
    const { data, error } = await supabase.rpc('organiser_create_team', { p_tournament_id: tournamentId, p_name: name, p_short_name: short_name || null, p_city: city || null });
    if (error) return { data: null, error: friendlyError(error, 'create team') };
    return { data, error: null };
  },

  async organiserRemoveTeam(tournamentId, teamId) {
    const { data, error } = await supabase.rpc('organiser_remove_team', { p_tournament_id: tournamentId, p_team_id: teamId });
    if (error) return { data: null, error: friendlyError(error, 'remove team') };
    return { data, error: null };
  },

  // #72 Playing XI, #73 substitutes, #74 replacements, #75 transfers
  async getMatchLineups(matchId) {
    const { data, error } = await supabase.rpc('get_match_lineups', { p_match_id: matchId });
    if (error) return { data: null, error: friendlyError(error, 'lineups') };
    return { data, error: null };
  },

  async setMatchLineup(matchId, teamId, lineup) {
    const { data, error } = await supabase.rpc('set_match_lineup', { p_match_id: matchId, p_team_id: teamId, p: lineup });
    if (error) return { data: null, error: friendlyError(error, 'lineup') };
    return { data, error: null };
  },

  async replaceMatchPlayer({ matchId, teamId, outId, inId, reason }) {
    const { data, error } = await supabase.rpc('replace_match_player', { p_match_id: matchId, p_team_id: teamId, p_out: outId, p_in: inId, p_reason: reason || null });
    if (error) return { data: null, error: friendlyError(error, 'replacement') };
    return { data, error: null };
  },

  async requestPlayerTransfer({ playerId, fromTeamId, toTeamId, note }) {
    const { data, error } = await supabase.rpc('request_player_transfer', { p_player_id: playerId, p_from_team: fromTeamId, p_to_team: toTeamId, p_note: note || null });
    if (error) return { data: null, error: friendlyError(error, 'transfer') };
    return { data, error: null };
  },

  async decidePlayerTransfer(transferId, accept, reason) {
    const { data, error } = await supabase.rpc('decide_player_transfer', { p_transfer_id: transferId, p_accept: !!accept, p_reason: reason || null });
    if (error) return { data: null, error: friendlyError(error, 'transfer') };
    return { data, error: null };
  },

  async cancelPlayerTransfer(transferId) {
    const { data, error } = await supabase.rpc('cancel_player_transfer', { p_transfer_id: transferId });
    if (error) return { data: null, error: friendlyError(error, 'transfer') };
    return { data, error: null };
  },

  async getTeamTransfers(teamId) {
    const { data, error } = await supabase.rpc('get_team_transfers', { p_team_id: teamId });
    if (error) return { data: null, error: friendlyError(error, 'transfers') };
    return { data, error: null };
  },

  async searchTeams(query) {
    const { data, error } = await supabase.rpc('search_teams', { p_query: query });
    if (error) return { data: null, error: friendlyError(error, 'team search') };
    return { data, error: null };
  },

  async createTournament(tournamentData) {
    const { data, error } = await supabase.rpc('create_tournament', { p: tournamentData });
    if (error) return { data: null, error: friendlyError(error, 'create tournament') };
    return { data, error: null };
  },

  async updateTournament({ tournamentId, changes }) {
    const { data, error } = await supabase.rpc('update_tournament', { p_id: tournamentId, p: changes });
    if (error) return { data: null, error: friendlyError(error, 'update tournament') };
    return { data, error: null };
  },

  async getTournamentRegistrations(tournamentId) {
    const { data, error } = await supabase.rpc('get_tournament_registrations', { p_tournament_id: tournamentId });
    if (error) return { data: null, error: friendlyError(error, 'registrations') };
    return { data, error: null };
  },

  async registerTeamForTournament({ tournamentId, teamId }) {
    const { data, error } = await supabase.rpc('register_team_for_tournament', { p_tournament_id: tournamentId, p_team_id: teamId });
    if (error) return { data: null, error: friendlyError(error, 'team registration') };
    return { data, error: null };
  },

  async decideTeamRegistration({ tournamentId, teamId, approve, note }) {
    const { data, error } = await supabase.rpc('decide_team_registration', { p_tournament_id: tournamentId, p_team_id: teamId, p_approve: !!approve, p_note: note || null });
    if (error) return { data: null, error: friendlyError(error, 'team approval') };
    return { data, error: null };
  },

  async withdrawTeamFromTournament({ tournamentId, teamId }) {
    const { data, error } = await supabase.rpc('withdraw_team_from_tournament', { p_tournament_id: tournamentId, p_team_id: teamId });
    if (error) return { data: null, error: friendlyError(error, 'withdraw team') };
    return { data, error: null };
  },

  /** Public platform settings: maintenance flag and the active announcement (readable by everyone). */
  async getPlatformSettings() {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('maintenance_mode, broadcast_message, broadcast_level, broadcast_updated_at')
      .maybeSingle();
    if (error) return { data: null, error: friendlyError(error, 'platform settings') };
    return {
      data: {
        maintenance_mode: !!data?.maintenance_mode,
        broadcast_banner: data?.broadcast_message
          ? { message: data.broadcast_message, level: data.broadcast_level, timestamp: data.broadcast_updated_at }
          : null
      },
      error: null
    };
  }
};
