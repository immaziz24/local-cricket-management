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
