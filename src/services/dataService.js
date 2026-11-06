import { mockClient } from './mock/mockClient.js';

/**
 * Data Access Layer (DAL) Facade
 * 
 * Provides an abstract, framework-agnostic data service interface.
 * CURRENT PROVIDER: Mock Client (Local state & fixtures)
 * FUTURE PROVIDER: Supabase Client (PostgreSQL)
 * 
 * To switch providers in the future:
 * 1. Implement 'supabaseClient.js' matching the same async signatures.
 * 2. Set activeProvider = supabaseClient.
 * 
 * UI components and hooks consuming 'dataService' will require ZERO changes.
 */

const activeProvider = mockClient;

export const dataService = {
  // Stats
  async fetchDashboardStats() {
    const res = await activeProvider.getStats();
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  // Tournaments
  async fetchTournaments() {
    const res = await activeProvider.getTournaments();
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  // Matches
  async fetchMatches(status = 'all') {
    const res = await activeProvider.getMatches(status);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async fetchLiveMatches() {
    const res = await activeProvider.getLiveMatches();
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  // Teams
  async fetchTeams() {
    const res = await activeProvider.getTeams();
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  // Category Q Penalty Policy
  async fetchCategoryQPolicy() {
    const res = await activeProvider.getCategoryQPolicy();
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  // ==========================================
  // Feature #254: User Registration
  // ==========================================
  async registerUser(userData) {
    const res = await activeProvider.registerUser(userData);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  // ==========================================
  // Feature #255: User Login and Logout
  // ==========================================
  async loginUser(credentials) {
    const res = await activeProvider.loginUser(credentials);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async getCurrentUser() {
    const res = await activeProvider.getCurrentUser();
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async logoutUser() {
    const res = await activeProvider.logoutUser();
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  // ==========================================
  // Feature #256: Password Recovery
  // ==========================================
  async requestPasswordRecovery(identifier) {
    const res = await activeProvider.requestPasswordRecovery({ identifier });
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async verifyPasswordRecoveryOTP(identifier, otp) {
    const res = await activeProvider.verifyPasswordRecoveryOTP({ identifier, otp });
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async completePasswordReset(identifier, newPassword) {
    const res = await activeProvider.completePasswordReset({ identifier, newPassword });
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  // ==========================================
  // Feature #257: Super-Admin Dashboard
  // ==========================================
  async fetchSuperAdminMetrics() {
    const res = await activeProvider.getSuperAdminMetrics();
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async togglePlatformMaintenance(enabled) {
    const res = await activeProvider.togglePlatformMaintenance(enabled);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async setGlobalBroadcast(broadcast) {
    const res = await activeProvider.setGlobalBroadcast(broadcast);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  // ==========================================
  // Feature #258: Admin Dashboard
  // ==========================================
  async fetchAdminQueue() {
    const res = await activeProvider.getAdminQueue();
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async resolveAdminQueueItem(resolutionPayload) {
    const res = await activeProvider.resolveAdminQueueItem(resolutionPayload);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  // ==========================================
  // Features #259–#264: Role Permissions
  // ==========================================
  async fetchRolePermissions(role) {
    const res = await activeProvider.getRolePermissions(role);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async toggleRolePermission(role, key, enabled) {
    const res = await activeProvider.toggleRolePermission({ role, key, enabled });
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async resetRolePermissions(role) {
    const res = await activeProvider.resetRolePermissionsToDefaults(role);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  // ==========================================
  // Feature #265: User Verification
  // ==========================================
  async fetchVerificationQueue() {
    const res = await activeProvider.getVerificationQueue();
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async processUserVerification(verificationPayload) {
    const res = await activeProvider.processUserVerification(verificationPayload);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  // ==========================================
  // Feature #266: User Reporting and Suspension
  // ==========================================
  async fetchUserReports() {
    const res = await activeProvider.getUserReports();
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async fetchActiveSuspensions() {
    const res = await activeProvider.getActiveSuspensions();
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async suspendUserAccount(suspensionPayload) {
    const res = await activeProvider.suspendUserAccount(suspensionPayload);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async liftSuspension(suspensionId) {
    const res = await activeProvider.liftSuspension(suspensionId);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  // ==========================================
  // Feature #267: Activity and Audit Logs
  // ==========================================
  async fetchAuditLogs(filters = {}) {
    const res = await activeProvider.getAuditLogs(filters);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async recordAuditEvent(eventPayload) {
    const res = await activeProvider.recordAuditEvent(eventPayload);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  // ==========================================
  // Feature #268: Database Backup
  // ==========================================
  async fetchDatabaseBackups() {
    const res = await activeProvider.getDatabaseBackups();
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async triggerDatabaseBackup(backupPayload) {
    const res = await activeProvider.triggerDatabaseBackup(backupPayload);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async simulateBackupRestore(backupId) {
    const res = await activeProvider.simulateBackupRestore(backupId);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  // ==========================================
  // Feature #269: Security and Privacy Management
  // ==========================================
  async fetchSecuritySettings() {
    const res = await activeProvider.getSecuritySettings();
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async updateSecuritySettings(newSettings) {
    const res = await activeProvider.updateSecuritySettings(newSettings);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async exportUserDataGDPR(userId) {
    const res = await activeProvider.exportUserDataGDPR(userId);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  // ==========================================
  // Feature #270: Notifications Management
  // ==========================================
  async fetchNotificationSettings() {
    const res = await activeProvider.getNotificationSettings();
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async updateNotificationChannels(channels) {
    const res = await activeProvider.updateNotificationChannels(channels);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async dispatchCustomNotification(notificationPayload) {
    const res = await activeProvider.dispatchCustomNotification(notificationPayload);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  // ==========================================
  // Category N Full 17-Slot Manifest (#254–#270)
  // ==========================================
  async fetchCategoryNSlots() {
    const res = await activeProvider.getCategoryNSlots();
    if (res.error) throw new Error(res.error);
    return res.data;
  }
};
