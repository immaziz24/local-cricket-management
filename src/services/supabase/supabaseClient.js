Warning: truncated output (original token count: 25428)
Total output lines: 2209

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
    return 'Please confirm your email address first: type the 6-digit code from our email below, or open the link in it.';
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

  // #254 confirm the email with the 6-digit code from the sign-up email
  async verifySignupCode({ email, code }) {
    const token = String(code || '').replace(/\s/g, '');
    if (!/^\d{6,10}$/.test(token)) return { data: null, error: 'Please enter the code from the email.' };
    const { data, error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token, type: 'email' });
    if (error) return { data: null, error: friendlyError(error, 'code verification') };
    return { data: { verified: true, signed_in: !!data.session }, error: null };
  },

  async resendSignupCode(email) {
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase(), options: { emailRedirectTo: window.location.origin } });
    if (error) return { data: null, error: friendlyError(error, 'email') };
    return { data: { sent: true }, error: null };
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
    const { data, error } = await supabase.rpc('get_my_player_profile');
    if (error) return { data: null, error: friendlyError(error, 'player profile') };
    return { data, error: null };
  },

  async updateMyPlayer({ display_name, location, date_of_birth, player_role, batting_style, bowling_style }) {
    const { data, error } = await supabase.rpc('update_my_player_profile', {
      p_name: display_name, p_location: location || '', p_birth_date: date_of_birth || null,
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
      supabase.from('teams').select('id, name, short_name, city, logo_url, owner_id, created_at').eq('owner_id', uid).is('archived_at', null),
      playerId
        ? supabase.from('team_members').select('team_id, teams!inner(id, name, short_name, city, logo_url, owner_id, created_at)').eq('player_id', playerId).is('teams.archived_at', null)
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
     …11428 tokens truncated…ull, error: friendlyError(error, 'campaigns') };
    return { data, error: null };
  },

  async activeCampaigns(p = {}) {
    const { data, error } = await supabase.rpc('active_campaigns', { p });
    if (error) return { data: null, error: friendlyError(error, 'campaigns') };
    return { data, error: null };
  },

  async recordCampaignEvent(campaignId, kind) {
    const { data, error } = await supabase.rpc('record_campaign_event', { p_campaign_id: campaignId, p_kind: kind });
    if (error) return { data: null, error: friendlyError(error, 'campaign') };
    return { data, error: null };
  },

  async hideCampaign(campaignId, hidden) {
    const { data, error } = await supabase.rpc('hide_campaign', { p_campaign_id: campaignId, p_hidden: !!hidden });
    if (error) return { data: null, error: friendlyError(error, 'campaign') };
    return { data, error: null };
  },

  async issueCertificates(p) {
    const { data, error } = await supabase.rpc('issue_certificates', { p });
    if (error) return { data: null, error: friendlyError(error, 'certificates') };
    return { data, error: null };
  },

  async revokeCertificate(certificateId, reason) {
    const { data, error } = await supabase.rpc('revoke_certificate', { p_certificate_id: certificateId, p_reason: reason });
    if (error) return { data: null, error: friendlyError(error, 'certificate') };
    return { data, error: null };
  },

  async verifyCertificate(code) {
    const { data, error } = await supabase.rpc('verify_certificate', { p_code: code });
    if (error) return { data: null, error: friendlyError(error, 'certificate') };
    return { data, error: null };
  },

  async listCertificates(p) {
    const { data, error } = await supabase.rpc('list_certificates', { p });
    if (error) return { data: null, error: friendlyError(error, 'certificates') };
    return { data, error: null };
  },

  async setAward(tournamentId, p) {
    const { data, error } = await supabase.rpc('set_award', { p_tournament_id: tournamentId, p });
    if (error) return { data: null, error: friendlyError(error, 'award') };
    return { data, error: null };
  },

  async removeAward(awardId) {
    const { data, error } = await supabase.rpc('remove_award', { p_award_id: awardId });
    if (error) return { data: null, error: friendlyError(error, 'award') };
    return { data, error: null };
  },

  async listAwards(tournamentId) {
    const { data, error } = await supabase.rpc('list_awards', { p_tournament_id: tournamentId });
    if (error) return { data: null, error: friendlyError(error, 'awards') };
    return { data, error: null };
  },

  async playerAwards(playerId) {
    const { data, error } = await supabase.rpc('player_awards', { p_player_id: playerId });
    if (error) return { data: null, error: friendlyError(error, 'awards') };
    return { data, error: null };
  },

  async saveMerchItem(itemId, p) {
    const { data, error } = await supabase.rpc('save_merch_item', { p_item_id: itemId || null, p });
    if (error) return { data: null, error: friendlyError(error, 'merchandise') };
    return { data, error: null };
  },

  async deleteMerchItem(itemId) {
    const { data, error } = await supabase.rpc('delete_merch_item', { p_item_id: itemId });
    if (error) return { data: null, error: friendlyError(error, 'merchandise') };
    return { data, error: null };
  },

  async listMerch(tournamentId) {
    const { data, error } = await supabase.rpc('list_merch', { p_tournament_id: tournamentId });
    if (error) return { data: null, error: friendlyError(error, 'merchandise') };
    return { data, error: null };
  },

  async orderMerch(itemId, p) {
    const { data, error } = await supabase.rpc('order_merch', { p_item_id: itemId, p });
    if (error) return { data: null, error: friendlyError(error, 'order') };
    return { data, error: null };
  },

  async updateMerchOrder(orderId, status) {
    const { data, error } = await supabase.rpc('update_merch_order', { p_order_id: orderId, p_status: status });
    if (error) return { data: null, error: friendlyError(error, 'order') };
    return { data, error: null };
  },

  async listMerchOrders(tournamentId) {
    const { data, error } = await supabase.rpc('list_merch_orders', { p_tournament_id: tournamentId });
    if (error) return { data: null, error: friendlyError(error, 'orders') };
    return { data, error: null };
  },

  async myMerchOrders() {
    const { data, error } = await supabase.rpc('my_merch_orders', {});
    if (error) return { data: null, error: friendlyError(error, 'orders') };
    return { data, error: null };
  },

  async sponsorReport(sponsorshipId) {
    const { data, error } = await supabase.rpc('sponsor_report', { p_sponsorship_id: sponsorshipId });
    if (error) return { data: null, error: friendlyError(error, 'report') };
    return { data, error: null };
  },

  async setSponsorLogo({ sponsorId, file }) {
    const up = await this.uploadImage('sponsors', sponsorId, file);
    if (up.error) return up;
    const { data, error } = await supabase.rpc('set_sponsor_logo', { p_sponsor_id: sponsorId, p_url: up.data.url });
    if (error) return { data: null, error: friendlyError(error, 'picture') };
    return { data, error: null };
  },

  async setSponsorshipBanner({ sponsorshipId, file }) {
    const up = await this.uploadImage('sponsorships', sponsorshipId, file);
    if (up.error) return up;
    const { data, error } = await supabase.rpc('set_sponsorship_banner', { p_sponsorship_id: sponsorshipId, p_url: up.data.url });
    if (error) return { data: null, error: friendlyError(error, 'picture') };
    return { data, error: null };
  },

  async setAdImage({ adId, file }) {
    const up = await this.uploadImage('ads', adId, file);
    if (up.error) return up;
    const { data, error } = await supabase.rpc('set_ad_image', { p_ad_id: adId, p_url: up.data.url });
    if (error) return { data: null, error: friendlyError(error, 'picture') };
    return { data, error: null };
  },

  async setMerchPhoto({ itemId, file }) {
    const up = await this.uploadImage('merch', itemId, file);
    if (up.error) return up;
    const { data, error } = await supabase.rpc('set_merch_photo', { p_item_id: itemId, p_url: up.data.url });
    if (error) return { data: null, error: friendlyError(error, 'picture') };
    return { data, error: null };
  },

  async saveArticle(articleId, p) {
    const { data, error } = await supabase.rpc('save_article', { p_article_id: articleId || null, p: p || {} });
    if (error) return { data: null, error: friendlyError(error, 'article') };
    return { data, error: null };
  },

  async getArticle(articleId) {
    const { data, error } = await supabase.rpc('get_article', { p_article_id: articleId });
    if (error) return { data: null, error: friendlyError(error, 'article') };
    return { data, error: null };
  },

  async recordArticleView(articleId) {
    const { data, error } = await supabase.rpc('record_article_view', { p_article_id: articleId });
    if (error) return { data: null, error: friendlyError(error, 'article') };
    return { data, error: null };
  },

  async listArticles(p = {}) {
    const { data, error } = await supabase.rpc('list_articles', { p });
    if (error) return { data: null, error: friendlyError(error, 'articles') };
    return { data, error: null };
  },

  async deleteArticle(articleId) {
    const { data, error } = await supabase.rpc('delete_article', { p_article_id: articleId });
    if (error) return { data: null, error: friendlyError(error, 'article') };
    return { data, error: null };
  },

  async moderateArticle(articleId, p) {
    const { data, error } = await supabase.rpc('moderate_article', { p_article_id: articleId, p: p || {} });
    if (error) return { data: null, error: friendlyError(error, 'article') };
    return { data, error: null };
  },

  async likeArticle(articleId, like) {
    const { data, error } = await supabase.rpc('like_article', { p_article_id: articleId, p_like: !!like });
    if (error) return { data: null, error: friendlyError(error, 'like') };
    return { data, error: null };
  },

  async reportArticle(articleId, reason) {
    const { data, error } = await supabase.rpc('report_article', { p_article_id: articleId, p_reason: reason || '' });
    if (error) return { data: null, error: friendlyError(error, 'report') };
    return { data, error: null };
  },

  async listReportedArticles() {
    const { data, error } = await supabase.rpc('list_reported_articles', {});
    if (error) return { data: null, error: friendlyError(error, 'reports') };
    return { data, error: null };
  },

  async saveQuiz(quizId, p) {
    const { data, error } = await supabase.rpc('save_quiz', { p_quiz_id: quizId || null, p: p || {} });
    if (error) return { data: null, error: friendlyError(error, 'quiz') };
    return { data, error: null };
  },

  async listQuizzes(p = {}) {
    const { data, error } = await supabase.rpc('list_quizzes', { p });
    if (error) return { data: null, error: friendlyError(error, 'quizzes') };
    return { data, error: null };
  },

  async getQuiz(quizId) {
    const { data, error } = await supabase.rpc('get_quiz', { p_quiz_id: quizId });
    if (error) return { data: null, error: friendlyError(error, 'quiz') };
    return { data, error: null };
  },

  async submitQuiz(quizId, answers) {
    const { data, error } = await supabase.rpc('submit_quiz', { p_quiz_id: quizId, p_answers: answers || [] });
    if (error) return { data: null, error: friendlyError(error, 'quiz') };
    return { data, error: null };
  },

  async deleteQuiz(quizId) {
    const { data, error } = await supabase.rpc('delete_quiz', { p_quiz_id: quizId });
    if (error) return { data: null, error: friendlyError(error, 'quiz') };
    return { data, error: null };
  },

  async moderateQuiz(quizId, status) {
    const { data, error } = await supabase.rpc('moderate_quiz', { p_quiz_id: quizId, p_status: status });
    if (error) return { data: null, error: friendlyError(error, 'quiz') };
    return { data, error: null };
  },

  async setArticleCover({ articleId, file }) {
    const up = await this.uploadImage('articles', articleId, file);
    if (up.error) return up;
    const { data, error } = await supabase.rpc('set_article_cover', { p_article_id: articleId, p_url: up.data.url });
    if (error) return { data: null, error: friendlyError(error, 'picture') };
    return { data, error: null };
  },

  async removeArticleCover(articleId) {
    const { data, error } = await supabase.rpc('set_article_cover', { p_article_id: articleId, p_url: null });
    if (error) return { data: null, error: friendlyError(error, 'picture') };
    return { data, error: null };
  },

  async getWagonWheel(matchId, inningsNo, batterId) {
    const { data, error } = await supabase.rpc('get_wagon_wheel', { p_match_id: matchId, p_innings_no: inningsNo ?? null, p_batter_id: batterId || null });
    if (error) return { data: null, error: friendlyError(error, 'wagon wheel') };
    return { data, error: null };
  },

  async saveAuction(auctionId, p) {
    const { data, error } = await supabase.rpc('save_auction', { p_auction_id: auctionId || null, p: p || {} });
    if (error) return { data: null, error: friendlyError(error, 'auction') };
    return { data, error: null };
  },

  async addAuctionPlayers(auctionId, players) {
    const { data, error } = await supabase.rpc('add_auction_players', { p_auction_id: auctionId, p_players: players || [] });
    if (error) return { data: null, error: friendlyError(error, 'auction') };
    return { data, error: null };
  },

  async removeAuctionPlayer(playerId) {
    const { data, error } = await supabase.rpc('remove_auction_player', { p_player_id: playerId });
    if (error) return { data: null, error: friendlyError(error, 'auction') };
    return { data, error: null };
  },

  async setAuctionCurrent(auctionId, playerId) {
    const { data, error } = await supabase.rpc('set_auction_current', { p_auction_id: auctionId, p_player_id: playerId || null });
    if (error) return { data: null, error: friendlyError(error, 'auction') };
    return { data, error: null };
  },

  async sellAuctionPlayer(playerId, teamId, price) {
    const { data, error } = await supabase.rpc('sell_auction_player', { p_player_id: playerId, p_team_id: teamId, p_price: Math.round(Number(price)) });
    if (error) return { data: null, error: friendlyError(error, 'auction') };
    return { data, error: null };
  },

  async markAuctionUnsold(playerId) {
    const { data, error } = await supabase.rpc('mark_auction_unsold', { p_player_id: playerId });
    if (error) return { data: null, error: friendlyError(error, 'auction') };
    return { data, error: null };
  },

  async undoAuctionSale(auctionId, playerId) {
    const { data, error } = await supabase.rpc('undo_auction_sale', { p_auction_id: auctionId, p_player_id: playerId || null });
    if (error) return { data: null, error: friendlyError(error, 'auction') };
    return { data, error: null };
  },

  async finishAuction(auctionId, finished) {
    const { data, error } = await supabase.rpc('finish_auction', { p_auction_id: auctionId, p_finished: finished !== false });
    if (error) return { data: null, error: friendlyError(error, 'auction') };
    return { data, error: null };
  },

  async deleteAuction(auctionId) {
    const { data, error } = await supabase.rpc('delete_auction', { p_auction_id: auctionId });
    if (error) return { data: null, error: friendlyError(error, 'auction') };
    return { data, error: null };
  },

  async getAuction(auctionId) {
    const { data, error } = await supabase.rpc('get_auction', { p_auction_id: auctionId });
    if (error) return { data: null, error: friendlyError(error, 'auction') };
    return { data, error: null };
  },

  async listAuctions(p = {}) {
    const { data, error } = await supabase.rpc('list_auctions', { p });
    if (error) return { data: null, error: friendlyError(error, 'auction') };
    return { data, error: null };
  },

  async adminSearch(query, kind) {
    const { data, error } = await supabase.rpc('admin_search', { p_query: query || '', p_kind: kind || 'all' });
    if (error) return { data: null, error: friendlyError(error, 'admin') };
    return { data, error: null };
  },

  async adminGetUser(userId) {
    const { data, error } = await supabase.rpc('admin_get_user', { p_user_id: userId });
    if (error) return { data: null, error: friendlyError(error, 'admin') };
    return { data, error: null };
  },

  async adminUpdateUser(userId, p) {
    const { data, error } = await supabase.rpc('admin_update_user', { p_user_id: userId, p: p || {} });
    if (error) return { data: null, error: friendlyError(error, 'admin') };
    return { data, error: null };
  },

  async adminDeleteUser(userId, reason) {
    const { data, error } = await supabase.rpc('admin_delete_user', { p_user_id: userId, p_reason: reason || null });
    if (error) return { data: null, error: friendlyError(error, 'admin') };
    return { data, error: null };
  },

  async adminUpdateTeam(teamId, p) {
    const { data, error } = await supabase.rpc('admin_update_team', { p_team_id: teamId, p: p || {} });
    if (error) return { data: null, error: friendlyError(error, 'admin') };
    return { data, error: null };
  },

  async deleteOwnedTeam(id) {
    const { data, error } = await supabase.rpc('delete_owned_team', { p_id: id });
    return { data, error: error ? friendlyError(error, 'team deletion') : null };
  },

  async deleteOwnedTournament(id) {
    const { data, error } = await supabase.rpc('delete_owned_tournament', { p_id: id });
    return { data, error: error ? friendlyError(error, 'tournament deletion') : null };
  },

  async adminDeleteTeam(teamId) {
    const { data, error } = await supabase.rpc('admin_delete_team', { p_team_id: teamId });
    if (error) return { data: null, error: friendlyError(error, 'admin') };
    return { data, error: null };
  },

  async adminUpdateTournament(tournamentId, p) {
    const { data, error } = await supabase.rpc('admin_update_tournament', { p_tournament_id: tournamentId, p: p || {} });
    if (error) return { data: null, error: friendlyError(error, 'admin') };
    return { data, error: null };
  },

  async adminDeleteTournament(tournamentId) {
    const { data, error } = await supabase.rpc('admin_delete_tournament', { p_tournament_id: tournamentId });
    if (error) return { data: null, error: friendlyError(error, 'admin') };
    return { data, error: null };
  },

  async adminUpdateMatch(matchId, p) {
    const { data, error } = await supabase.rpc('admin_update_match', { p_match_id: matchId, p: p || {} });
    if (error) return { data: null, error: friendlyError(error, 'admin') };
    return { data, error: null };
  },

  async adminDeleteMatch(matchId) {
    const { data, error } = await supabase.rpc('admin_delete_match', { p_match_id: matchId });
    if (error) return { data: null, error: friendlyError(error, 'admin') };
    return { data, error: null };
  },

  async adminListBalls(matchId) {
    const { data, error } = await supabase.rpc('admin_list_balls', { p_match_id: matchId });
    if (error) return { data: null, error: friendlyError(error, 'admin') };
    return { data, error: null };
  },

  async adminUpdateBall(ballId, p) {
    const { data, error } = await supabase.rpc('admin_update_ball', { p_ball_id: ballId, p: p || {} });
    if (error) return { data: null, error: friendlyError(error, 'admin') };
    return { data, error: null };
  },

  async adminDeleteBall(ballId) {
    const { data, error } = await supabase.rpc('admin_delete_ball', { p_ball_id: ballId });
    if (error) return { data: null, error: friendlyError(error, 'admin') };
    return { data, error: null };
  },

  async updateAuctionPlayer(playerId, p) {
    const { data, error } = await supabase.rpc('update_auction_player', { p_player_id: playerId, p: p || {} });
    if (error) return { data: null, error: friendlyError(error, 'auction') };
    return { data, error: null };
  },

  async editBall(matchId, seq, p) {
    const { data, error } = await supabase.rpc('edit_ball', { p_match_id: matchId, p_seq: seq, p: p || {} });
    if (error) return { data: null, error: friendlyError(error, 'score correction') };
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

  async manageTournamentAdmins({ tournamentId, action, mobile, userId }) {
    const { data, error } = await supabase.rpc('manage_tournament_admins', {
      p_tournament_id: tournamentId, p_action: action, p_mobile: mobile || null, p_user_id: userId || null,
    });
    return { data, error: error ? friendlyError(error, 'tournament admins') : null };
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
