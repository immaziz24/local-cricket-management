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

  async saveGround(groundId, ground) {
    const { data, error } = await supabase.rpc('save_ground', { p_ground_id: groundId || null, p: ground });
    if (error) return { data: null, error: friendlyError(error, 'ground') };
    return { data, error: null };
  },

  async listGrounds(filters) {
    const { data, error } = await supabase.rpc('list_grounds', { p: filters || {} });
    if (error) return { data: null, error: friendlyError(error, 'ground') };
    return { data, error: null };
  },

  async getGround(groundId) {
    const { data, error } = await supabase.rpc('get_ground', { p_ground_id: groundId });
    if (error) return { data: null, error: friendlyError(error, 'ground') };
    return { data, error: null };
  },

  async removeGroundPhoto(photoId, makeCover) {
    const { data, error } = await supabase.rpc('remove_ground_photo', { p_photo_id: photoId, p_make_cover: !!makeCover });
    if (error) return { data: null, error: friendlyError(error, 'ground') };
    return { data, error: null };
  },

  async requestGroundBooking(groundId, booking) {
    const { data, error } = await supabase.rpc('request_ground_booking', { p_ground_id: groundId, p: booking });
    if (error) return { data: null, error: friendlyError(error, 'ground') };
    return { data, error: null };
  },

  async decideGroundBooking(bookingId, action, note) {
    const { data, error } = await supabase.rpc('decide_ground_booking', { p_booking_id: bookingId, p_action: action, p_note: note || null });
    if (error) return { data: null, error: friendlyError(error, 'ground') };
    return { data, error: null };
  },

  async getGroundCalendar(groundId, from, to) {
    const { data, error } = await supabase.rpc('get_ground_calendar', { p_ground_id: groundId, p_from: from, p_to: to });
    if (error) return { data: null, error: friendlyError(error, 'ground') };
    return { data, error: null };
  },

  async myGroundBookings() {
    const { data, error } = await supabase.rpc('my_ground_bookings', {});
    if (error) return { data: null, error: friendlyError(error, 'ground') };
    return { data, error: null };
  },

  async addPitchLog(groundId, log) {
    const { data, error } = await supabase.rpc('add_pitch_log', { p_ground_id: groundId, p: log });
    if (error) return { data: null, error: friendlyError(error, 'ground') };
    return { data, error: null };
  },

  async addGroundInspection(groundId, report) {
    const { data, error } = await supabase.rpc('add_ground_inspection', { p_ground_id: groundId, p: report });
    if (error) return { data: null, error: friendlyError(error, 'ground') };
    return { data, error: null };
  },

  async setMatchGround(matchId, groundId) {
    const { data, error } = await supabase.rpc('set_match_ground', { p_match_id: matchId, p_ground_id: groundId || null });
    if (error) return { data: null, error: friendlyError(error, 'ground') };
    return { data, error: null };
  },

  // #149 ground photo: upload to grounds/<id>/ then register it
  async addGroundPhoto({ groundId, file, caption, makeCover }) {
    const up = await this.uploadImage('grounds', groundId, file);
    if (up.error) return up;
    const { data, error } = await supabase.rpc('add_ground_photo', { p_ground_id: groundId, p_url: up.data.url, p_caption: caption || null, p_make_cover: !!makeCover });
    if (error) return { data: null, error: friendlyError(error, 'ground photo') };
    return { data, error: null };
  },

  async checkInTeam(matchId, teamId, arrivedAt, players, note) {
    const { data, error } = await supabase.rpc('check_in_team', { p_match_id: matchId, p_team_id: teamId, p_arrived_at: arrivedAt || null, p_players: players === '' || players == null ? null : Number(players), p_note: note || null });
    if (error) return { data: null, error: friendlyError(error, 'punctuality') };
    return { data, error: null };
  },

  async setAttendance(matchId, playerId, status) {
    const { data, error } = await supabase.rpc('set_attendance', { p_match_id: matchId, p_player_id: playerId, p_status: status || null });
    if (error) return { data: null, error: friendlyError(error, 'punctuality') };
    return { data, error: null };
  },

  async getMatchReadiness(matchId) {
    const { data, error } = await supabase.rpc('get_match_readiness', { p_match_id: matchId });
    if (error) return { data: null, error: friendlyError(error, 'punctuality') };
    return { data, error: null };
  },

  async proposeLatePenalty(matchId, lateTeamId, minutes) {
    const { data, error } = await supabase.rpc('propose_late_penalty', { p_match_id: matchId, p_late_team_id: lateTeamId, p_minutes: minutes === '' || minutes == null ? null : Number(minutes) });
    if (error) return { data: null, error: friendlyError(error, 'punctuality') };
    return { data, error: null };
  },

  async decideLatePenalty(penaltyId, action, note) {
    const { data, error } = await supabase.rpc('decide_late_penalty', { p_penalty_id: penaltyId, p_action: action, p_note: note || null });
    if (error) return { data: null, error: friendlyError(error, 'punctuality') };
    return { data, error: null };
  },

  async appealLatePenalty(penaltyId, reason) {
    const { data, error } = await supabase.rpc('appeal_late_penalty', { p_penalty_id: penaltyId, p_reason: reason });
    if (error) return { data: null, error: friendlyError(error, 'punctuality') };
    return { data, error: null };
  },

  async setLateFine(penaltyId, amount, paid) {
    const { data, error } = await supabase.rpc('set_late_fine', { p_penalty_id: penaltyId, p_amount: amount === '' || amount == null ? null : Number(amount), p_paid: !!paid });
    if (error) return { data: null, error: friendlyError(error, 'punctuality') };
    return { data, error: null };
  },

  async addPlayerFine(teamId, playerId, amount, reason, matchId) {
    const { data, error } = await supabase.rpc('add_player_fine', { p_team_id: teamId, p_player_id: playerId, p_amount: Number(amount), p_reason: reason, p_match_id: matchId || null });
    if (error) return { data: null, error: friendlyError(error, 'punctuality') };
    return { data, error: null };
  },

  async setPlayerFinePaid(fineId, paid) {
    const { data, error } = await supabase.rpc('set_player_fine_paid', { p_fine_id: fineId, p_paid: !!paid });
    if (error) return { data: null, error: friendlyError(error, 'punctuality') };
    return { data, error: null };
  },

  async getTeamPunctuality(teamId) {
    const { data, error } = await supabase.rpc('get_team_punctuality', { p_team_id: teamId });
    if (error) return { data: null, error: friendlyError(error, 'punctuality') };
    return { data, error: null };
  },

  async saveListing(listingId, listing) {
    const { data, error } = await supabase.rpc('save_listing', { p_listing_id: listingId || null, p: listing });
    if (error) return { data: null, error: friendlyError(error, 'community') };
    return { data, error: null };
  },

  async deleteListing(listingId) {
    const { data, error } = await supabase.rpc('delete_listing', { p_listing_id: listingId });
    if (error) return { data: null, error: friendlyError(error, 'community') };
    return { data, error: null };
  },

  async getListing(listingId) {
    const { data, error } = await supabase.rpc('get_listing', { p_listing_id: listingId });
    if (error) return { data: null, error: friendlyError(error, 'community') };
    return { data, error: null };
  },

  async listListings(filters) {
    const { data, error } = await supabase.rpc('list_listings', { p: filters || {} });
    if (error) return { data: null, error: friendlyError(error, 'community') };
    return { data, error: null };
  },

  async listOrganisers(query) {
    const { data, error } = await supabase.rpc('list_organisers', { p_query: query || null });
    if (error) return { data: null, error: friendlyError(error, 'community') };
    return { data, error: null };
  },

  async saveItem(itemId, item) {
    const { data, error } = await supabase.rpc('save_item', { p_item_id: itemId || null, p: item });
    if (error) return { data: null, error: friendlyError(error, 'community') };
    return { data, error: null };
  },

  async deleteItem(itemId) {
    const { data, error } = await supabase.rpc('delete_item', { p_item_id: itemId });
    if (error) return { data: null, error: friendlyError(error, 'community') };
    return { data, error: null };
  },

  async getItem(itemId) {
    const { data, error } = await supabase.rpc('get_item', { p_item_id: itemId });
    if (error) return { data: null, error: friendlyError(error, 'community') };
    return { data, error: null };
  },

  async listItems(filters) {
    const { data, error } = await supabase.rpc('list_items', { p: filters || {} });
    if (error) return { data: null, error: friendlyError(error, 'community') };
    return { data, error: null };
  },

  async savePost(postId, post) {
    const { data, error } = await supabase.rpc('save_post', { p_post_id: postId || null, p: post });
    if (error) return { data: null, error: friendlyError(error, 'community') };
    return { data, error: null };
  },

  async deletePost(postId) {
    const { data, error } = await supabase.rpc('delete_post', { p_post_id: postId });
    if (error) return { data: null, error: friendlyError(error, 'community') };
    return { data, error: null };
  },

  async listPosts(filters) {
    const { data, error } = await supabase.rpc('list_posts', { p: filters || {} });
    if (error) return { data: null, error: friendlyError(error, 'community') };
    return { data, error: null };
  },

  async sendEnquiry(targetType, targetId, message, contact) {
    const { data, error } = await supabase.rpc('send_enquiry', { p_target_type: targetType, p_target_id: targetId, p_message: message, p_contact: contact || null });
    if (error) return { data: null, error: friendlyError(error, 'community') };
    return { data, error: null };
  },

  async replyEnquiry(enquiryId, reply, close) {
    const { data, error } = await supabase.rpc('reply_enquiry', { p_enquiry_id: enquiryId, p_reply: reply || null, p_close: !!close });
    if (error) return { data: null, error: friendlyError(error, 'community') };
    return { data, error: null };
  },

  async myEnquiries() {
    const { data, error } = await supabase.rpc('my_enquiries', {});
    if (error) return { data: null, error: friendlyError(error, 'community') };
    return { data, error: null };
  },

  async communitySearch(filters) {
    const { data, error } = await supabase.rpc('community_search', { p: filters });
    if (error) return { data: null, error: friendlyError(error, 'community') };
    return { data, error: null };
  },

  // #160–#165 photos for listings and marketplace items
  async setListingPhoto({ listingId, file }) {
    const up = await this.uploadImage('listings', listingId, file);
    if (up.error) return up;
    const { data, error } = await supabase.rpc('set_listing_photo', { p_listing_id: listingId, p_url: up.data.url });
    if (error) return { data: null, error: friendlyError(error, 'photo') };
    return { data, error: null };
  },

  async setItemPhoto({ itemId, file }) {
    const up = await this.uploadImage('items', itemId, file);
    if (up.error) return up;
    const { data, error } = await supabase.rpc('set_item_photo', { p_item_id: itemId, p_url: up.data.url });
    if (error) return { data: null, error: friendlyError(error, 'photo') };
    return { data, error: null };
  },

  // ---------- Category I: media (#177–#188) ----------
  async addMedia(p) {
    const { data, error } = await supabase.rpc('add_media', { p });
    if (error) return { data: null, error: friendlyError(error, 'media') };
    return { data, error: null };
  },

  async updateMedia(mediaId, p) {
    const { data, error } = await supabase.rpc('update_media', { p_media_id: mediaId, p });
    if (error) return { data: null, error: friendlyError(error, 'media') };
    return { data, error: null };
  },

  async deleteMedia(item) {
    const m = (item.url || '').match(/\/storage\/v1\/object\/public\/(media|videos)\/(.+)$/);
    if (m) await supabase.storage.from(m[1]).remove([decodeURIComponent(m[2])]);
    const { data, error } = await supabase.rpc('delete_media', { p_media_id: item.id });
    if (error) return { data: null, error: friendlyError(error, 'media') };
    return { data, error: null };
  },

  async listMedia(scope, scopeId, kind = null) {
    const { data, error } = await supabase.rpc('list_media', { p_scope: scope, p_scope_id: scopeId, p_kind: kind });
    if (error) return { data: null, error: friendlyError(error, 'media') };
    return { data, error: null };
  },

  async mediaFeed(p = {}) {
    const { data, error } = await supabase.rpc('media_feed', { p });
    if (error) return { data: null, error: friendlyError(error, 'media') };
    return { data, error: null };
  },

  // Creates the media row, uploads the file into its own folder, then records the file address.
  async uploadMedia({ scope, scopeId, kind, title, caption, moment, file }) {
    if (!file) return { data: null, error: 'Choose a file first.' };
    const isPhoto = kind === 'photo';
    if (isPhoto) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return { data: null, error: 'Please choose a JPG, PNG or WEBP photo.' };
      if (file.size > 2 * 1024 * 1024) return { data: null, error: 'The photo must be smaller than 2 MB.' };
    } else {
      if (!['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type)) return { data: null, error: 'Please choose an MP4, WEBM or MOV video.' };
      if (file.size > 20 * 1024 * 1024) return { data: null, error: 'Videos must be smaller than 20 MB. For longer videos upload to YouTube and paste the link.' };
    }
    const made = await this.addMedia({ scope, scope_id: scopeId, kind, source: 'upload', title, caption, moment });
    if (made.error) return made;
    const id = made.data.id;
    const bucket = isPhoto ? 'media' : 'videos';
    const ext = { 'image/png': 'png', 'image/webp': 'webp', 'image/jpeg': 'jpg', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' }[file.type];
    const path = `${isPhoto ? 'gallery' : 'clips'}/${id}/${Date.now()}.${ext}`;
    const up = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, cacheControl: '86400' });
    if (up.error) {
      await supabase.rpc('delete_media', { p_media_id: id });
      return { data: null, error: friendlyError(up.error, 'upload') };
    }
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
    const { data, error } = await supabase.rpc('set_media_file', { p_media_id: id, p_url: pub.publicUrl, p_bytes: file.size });
    if (error) return { data: null, error: friendlyError(error, 'upload') };
    return { data, error: null };
  },

  // ---------- Site: header search and contact page ----------
  async globalSearch(p = {}) {
    const { data, error } = await supabase.rpc('global_search', { p });
    if (error) return { data: null, error: friendlyError(error, 'search') };
    return { data, error: null };
  },

  async sendContactMessage(p) {
    const { data, error } = await supabase.rpc('send_contact_message', { p });
    if (error) return { data: null, error: friendlyError(error, 'message') };
    return { data, error: null };
  },

  async getMyPaymentHistory() {
    const { data, error } = await supabase.rpc('get_my_payment_history');
    return { data, error: error ? friendlyError(error, 'payment history') : null };
  },

  async getRevenueDashboard() {
    const { data, error } = await supabase.rpc('get_revenue_dashboard');
    return { data, error: error ? friendlyError(error, 'revenue') : null };
  },

  async listContactMessages(status = null) {
    const { data, error } = await supabase.rpc('list_contact_messages', { p_status: status });
    if (error) return { data: null, error: friendlyError(error, 'messages') };
    return { data, error: null };
  },

  async setContactMessageStatus(id, status) {
    const { data, error } = await supabase.rpc('set_contact_message_status', { p_id: id, p_status: status });
    if (error) return { data: null, error: friendlyError(error, 'messages') };
    return { data, error: null };
  },

  // ---------- Category J: branding, sponsorship and promotion (#189–#199) ----------
  async saveTournamentSite(tournamentId, p) {
    const { data, error } = await supabase.rpc('save_tournament_site', { p_tournament_id: tournamentId, p });
    if (error) return { data: null, error: friendlyError(error, 'tournament website') };
    return { data, error: null };
  },

  async getTournamentSite(ref) {
    const { data, error } = await supabase.rpc('get_tournament_site', { p_ref: String(ref || '') });
    if (error) return { data: null, error: friendlyError(error, 'tournament website') };
    return { data, error: null };
  },

  async recordView(kind, refId) {
    const { data, error } = await supabase.rpc('record_view', { p_kind: kind, p_ref: refId });
    if (error) return { data: null, error: friendlyError(error, 'view') };
    return { data, error: null };
  },

  async saveSponsor(sponsorId, p) {
    const { data, error } = await supabase.rpc('save_sponsor', { p_sponsor_id: sponsorId || null, p });
    if (error) return { data: null, error: friendlyError(error, 'sponsor') };
    return { data, error: null };
  },

  async getSponsor(sponsorId) {
    const { data, error } = await supabase.rpc('get_sponsor', { p_sponsor_id: sponsorId });
    if (error) return { data: null, error: friendlyError(error, 'sponsor') };
    return { data, error: null };
  },

  async listSponsors(p = {}) {
    const { data, error } = await supabase.rpc('list_sponsors', { p });
    if (error) return { data: null, error: friendlyError(error, 'sponsors') };
    return { data, error: null };
  },

  async inviteSponsor(tournamentId, sponsorId, tier, amount, note) {
    const { data, error } = await supabase.rpc('invite_sponsor', { p_tournament_id: tournamentId, p_sponsor_id: sponsorId, p_tier: tier || 'partner', p_amount: amount === '' || amount == null ? null : Number(amount), p_note: note || null });
    if (error) return { data: null, error: friendlyError(error, 'sponsor') };
    return { data, error: null };
  },

  async applyToSponsor(tournamentId, sponsorId, tier, note) {
    const { data, error } = await supabase.rpc('apply_to_sponsor', { p_tournament_id: tournamentId, p_sponsor_id: sponsorId, p_tier: tier || 'partner', p_note: note || null });
    if (error) return { data: null, error: friendlyError(error, 'sponsor') };
    return { data, error: null };
  },

  async respondSponsorship(sponsorshipId, accept) {
    const { data, error } = await supabase.rpc('respond_sponsorship', { p_sponsorship_id: sponsorshipId, p_accept: !!accept });
    if (error) return { data: null, error: friendlyError(error, 'sponsorship') };
    return { data, error: null };
  },

  async updateSponsorship(sponsorshipId, p) {
    const { data, error } = await supabase.rpc('update_sponsorship', { p_sponsorship_id: sponsorshipId, p });
    if (error) return { data: null, error: friendlyError(error, 'sponsorship') };
    return { data, error: null };
  },

  async removeSponsorship(sponsorshipId) {
    const { data, error } = await supabase.rpc('remove_sponsorship', { p_sponsorship_id: sponsorshipId });
    if (error) return { data: null, error: friendlyError(error, 'sponsorship') };
    return { data, error: null };
  },

  async listTournamentSponsors(tournamentId) {
    const { data, error } = await supabase.rpc('list_tournament_sponsors', { p_tournament_id: tournamentId });
    if (error) return { data: null, error: friendlyError(error, 'sponsors') };
    return { data, error: null };
  },

  async saveAd(adId, p) {
    const { data, error } = await supabase.rpc('save_ad', { p_ad_id: adId || null, p });
    if (error) return { data: null, error: friendlyError(error, 'advert') };
    return { data, error: null };
  },

  async deleteAd(adId) {
    const { data, error } = await supabase.rpc('delete_ad', { p_ad_id: adId });
    if (error) return { data: null, error: friendlyError(error, 'advert') };
    return { data, error: null };
  },

  async listAds(p = {}) {
    const { data, error } = await supabase.rpc('list_ads', { p });
    if (error) return { data: null, error: friendlyError(error, 'adverts') };
    return { data, error: null };
  },

  async getAds(slot, tournamentId = null) {
    const { data, error } = await supabase.rpc('get_ads', { p_slot: slot, p_tournament_id: tournamentId || null });
    if (error) return { data: null, error: friendlyError(error, 'adverts') };
    return { data, error: null };
  },

  async recordAdEvent(adId, kind) {
    const { data, error } = await supabase.rpc('record_ad_event', { p_ad_id: adId, p_kind: kind });
    if (error) return { data: null, error: friendlyError(error, 'advert') };
    return { data, error: null };
  },

  async saveCampaign(campaignId, p) {
    const { data, error } = await supabase.rpc('save_campaign', { p_campaign_id: campaignId || null, p });
    if (error) return { data: null, error: friendlyError(error, 'campaign') };
    return { data, error: null };
  },

  async listCampaigns(tournamentId) {
    const { data, error } = await supabase.rpc('list_campaigns', { p_tournament_id: tournamentId });
    if (error) return { data: null, error: friendlyError(error, 'campaigns') };
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
