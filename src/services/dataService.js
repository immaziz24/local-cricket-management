import { mockClient } from './mock/mockClient.js';
import { supabaseClient, isSupabaseConfigured, supabase } from './supabase/supabaseClient.js';

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

// Features already moved to the real backend use authProvider.
// Phase 1 #254–#256 (registration, login/logout, password recovery) run on Supabase
// whenever VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set in .env.
const authProvider = isSupabaseConfigured ? supabaseClient : mockClient;

/** 'supabase' when real accounts are active, otherwise 'mock'. Screens use this to hide test hints. */
export const authBackend = isSupabaseConfigured ? 'supabase' : 'mock';

// Phase 1 #257 (Super-admin dashboard), #258 (Admin dashboard), #259–#264 (roles) and #265 (verification) and #266 (reports, suspensions) and tournaments also run on Supabase when configured.
const adminProvider = isSupabaseConfigured ? supabaseClient : mockClient;

// ------------------------------------------------------------------
// Auth change notifications (header, sidebar, etc. stay in sync)
// ------------------------------------------------------------------
const authListeners = new Set();
const notifyAuthChange = async () => {
  const res = await authProvider.getCurrentUser();
  const user = res.error ? null : res.data;
  authListeners.forEach((fn) => fn(user));
};

if (isSupabaseConfigured && supabase) {
  // Also catches token refresh, expiry and sign-in/out in other browser tabs.
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
      setTimeout(notifyAuthChange, 0);
    }
  });
}

function requireDatabase() {
  if (!isSupabaseConfigured) {
    throw new Error('This feature needs the database. Add your Supabase settings to .env.');
  }
}

/** Subscribe to login/logout. Returns an unsubscribe function. */
export function onAuthChange(callback) {
  authListeners.add(callback);
  return () => authListeners.delete(callback);
}

export const dataService = {
  // Stats
  async fetchDashboardStats() {
    const res = await activeProvider.getStats();
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  // Tournaments (Feature #31 & Feature #32)
  async fetchTournaments() {
    const res = await adminProvider.getTournaments();
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  // Feature #32: Tournament Details & Profile View
  async fetchTournamentById(tournamentId) {
    const res = await adminProvider.getTournamentById(tournamentId);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async fetchTournamentMatches(tournamentId) {
    const res = await adminProvider.getTournamentMatches(tournamentId);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async createTournament(tournamentData) {
    const res = await adminProvider.createTournament(tournamentData);
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
    const res = await authProvider.registerUser(userData);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  // ==========================================
  // Feature #255: User Login and Logout
  // ==========================================
  async loginUser(credentials) {
    const res = await authProvider.loginUser(credentials);
    if (res.error) throw new Error(res.error);
    notifyAuthChange();
    return res.data;
  },

  async getCurrentUser() {
    const res = await authProvider.getCurrentUser();
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async logoutUser() {
    const res = await authProvider.logoutUser();
    if (res.error) throw new Error(res.error);
    notifyAuthChange();
    return res.data;
  },

  // ==========================================
  // Feature #256: Password Recovery
  // ==========================================
  async requestPasswordRecovery(identifier) {
    const res = await authProvider.requestPasswordRecovery({ identifier });
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async verifyPasswordRecoveryOTP(identifier, otp) {
    const res = await authProvider.verifyPasswordRecoveryOTP({ identifier, otp });
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async completePasswordReset(identifier, newPassword) {
    const res = await authProvider.completePasswordReset({ identifier, newPassword });
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  // ==========================================
  // Feature #257: Super-Admin Dashboard
  // ==========================================
  async fetchSuperAdminMetrics() {
    const res = await adminProvider.getSuperAdminMetrics();
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async togglePlatformMaintenance(enabled) {
    const res = await adminProvider.togglePlatformMaintenance(enabled);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async setGlobalBroadcast(broadcast) {
    const res = await adminProvider.setGlobalBroadcast(broadcast);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  // ==========================================
  // Features #267–#270 (real database only)
  // ==========================================
  async fetchAuditLogs(search, limit) {
    requireDatabase();
    const res = await supabaseClient.listAuditLogs({ search, limit });
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async exportPlatformSnapshot() {
    requireDatabase();
    const res = await supabaseClient.exportPlatformSnapshot();
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async exportMyData() {
    requireDatabase();
    const res = await supabaseClient.exportMyData();
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async fetchPrivacySettings() {
    requireDatabase();
    const res = await supabaseClient.getPrivacySettings();
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async savePrivacySettings(settings) {
    requireDatabase();
    const res = await supabaseClient.updatePrivacySettings(settings);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async signOutEverywhere() {
    requireDatabase();
    const res = await supabaseClient.signOutEverywhere();
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async fetchMyNotifications() {
    requireDatabase();
    const res = await supabaseClient.getMyNotifications();
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async markNotificationsRead(ids) {
    requireDatabase();
    const res = await supabaseClient.markNotificationsRead(ids);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async fetchNotificationPreferences() {
    requireDatabase();
    const res = await supabaseClient.getNotificationPreferences();
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async saveNotificationPreferences(prefs) {
    requireDatabase();
    const res = await supabaseClient.updateNotificationPreferences(prefs);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async sendAnnouncement(title, body) {
    requireDatabase();
    const res = await supabaseClient.sendAnnouncement({ title, body });
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  // ==========================================
  // Phase 2 – Category C: players and teams (real database only)
  // ==========================================
  async fetchMyPlayer() {
    requireDatabase();
    const res = await supabaseClient.getMyPlayer();
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async saveMyPlayer(details) {
    requireDatabase();
    const res = await supabaseClient.updateMyPlayer(details);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async fetchMyTeams() {
    requireDatabase();
    const res = await supabaseClient.getMyTeams();
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async fetchTeam(teamId) {
    requireDatabase();
    const res = await supabaseClient.getTeam(teamId);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async createTeam(team) {
    requireDatabase();
    const res = await supabaseClient.createTeam(team);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async updateTeam(team) {
    requireDatabase();
    const res = await supabaseClient.updateTeam(team);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async findPlayerByMobile(mobile) {
    requireDatabase();
    const res = await supabaseClient.findPlayerByMobile(mobile);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async addPlayerToTeam(teamId, playerId) {
    requireDatabase();
    const res = await supabaseClient.addPlayerToTeam({ teamId, playerId });
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async addNewPlayerToTeam(details) {
    requireDatabase();
    const res = await supabaseClient.addNewPlayerToTeam(details);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async updateTeamPlayer(details) {
    requireDatabase();
    const res = await supabaseClient.updateTeamPlayer(details);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async removePlayerFromTeam(teamId, playerId) {
    requireDatabase();
    const res = await supabaseClient.removePlayerFromTeam({ teamId, playerId });
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async setTeamLeadership(leadership) {
    requireDatabase();
    const res = await supabaseClient.setTeamLeadership(leadership);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async setPlayerPhoto(playerId, file) {
    requireDatabase();
    const res = await supabaseClient.setPlayerPhoto({ playerId, file });
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async setTeamLogo(teamId, file) {
    requireDatabase();
    const res = await supabaseClient.setTeamLogo({ teamId, file });
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async saveMyBirthDate(date) {
    requireDatabase();
    const res = await supabaseClient.updateMyBirthDate(date);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async fetchPlayerProfile(playerId) {
    requireDatabase();
    const res = await supabaseClient.getPlayerProfile(playerId);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async fetchTeamHistory(teamId) {
    requireDatabase();
    const res = await supabaseClient.getTeamHistory(teamId);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async updateTournament(tournamentId, changes) {
    requireDatabase();
    const res = await supabaseClient.updateTournament({ tournamentId, changes });
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async fetchTournamentRegistrations(tournamentId) {
    requireDatabase();
    const res = await supabaseClient.getTournamentRegistrations(tournamentId);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async registerTeamForTournament(tournamentId, teamId) {
    requireDatabase();
    const res = await supabaseClient.registerTeamForTournament({ tournamentId, teamId });
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async decideTeamRegistration(tournamentId, teamId, approve, note) {
    requireDatabase();
    const res = await supabaseClient.decideTeamRegistration({ tournamentId, teamId, approve, note });
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async withdrawTeamFromTournament(tournamentId, teamId) {
    requireDatabase();
    const res = await supabaseClient.withdrawTeamFromTournament({ tournamentId, teamId });
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async fetchTournamentStructure(tournamentId) {
    requireDatabase();
    const res = await supabaseClient.getTournamentStructure(tournamentId);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async createTournamentGroups(tournamentId, count) {
    requireDatabase();
    const res = await supabaseClient.createTournamentGroups({ tournamentId, count });
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async setTeamGroup(tournamentId, teamId, groupId) {
    requireDatabase();
    const res = await supabaseClient.setTeamGroup({ tournamentId, teamId, groupId });
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async setTournamentStructure(tournamentId, structure) {
    requireDatabase();
    const res = await supabaseClient.setTournamentStructure({ tournamentId, structure });
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async saveGeneratedFixtures(tournamentId, fixtures, replace) {
    requireDatabase();
    const res = await supabaseClient.saveGeneratedFixtures({ tournamentId, fixtures, replace });
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async createMatch(details) {
    requireDatabase();
    const res = await supabaseClient.createMatch(details);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async rescheduleMatch(details) {
    requireDatabase();
    const res = await supabaseClient.rescheduleMatch(details);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  // #33 tournament logo and banner (organiser only)
  async setTournamentImage(tournamentId, kind, file) {
    requireDatabase();
    const res = await supabaseClient.setTournamentImage({ tournamentId, kind, file });
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async removeTournamentImage(tournamentId, kind) {
    requireDatabase();
    const res = await supabaseClient.updateTournamentImage({ tournamentId, kind, value: '' });
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async setTournamentColor(tournamentId, color) {
    requireDatabase();
    const res = await supabaseClient.updateTournamentImage({ tournamentId, kind: 'color', value: color });
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  // #1–#6 matches: create, list, match centre, toss and start
  async listMatches(filter = 'all', limit = 50) {
    requireDatabase();
    const res = await supabaseClient.listMatches(filter, limit);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async countLiveMatches() {
    requireDatabase();
    const res = await supabaseClient.countLiveMatches();
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async fetchMatchCentre(matchId) {
    requireDatabase();
    const res = await supabaseClient.getMatchCentre(matchId);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async createFriendlyMatch(details) {
    requireDatabase();
    const res = await supabaseClient.createFriendlyMatch(details);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async startMatch(matchId, tossWinnerId, decision) {
    requireDatabase();
    const res = await supabaseClient.startMatch(matchId, tossWinnerId, decision);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  // Organiser adds / creates / removes tournament teams directly
  async organiserAddTeam(tournamentId, teamId) {
    requireDatabase();
    const res = await supabaseClient.organiserAddTeam(tournamentId, teamId);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async organiserCreateTeam(tournamentId, team) {
    requireDatabase();
    const res = await supabaseClient.organiserCreateTeam(tournamentId, team);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async organiserRemoveTeam(tournamentId, teamId) {
    requireDatabase();
    const res = await supabaseClient.organiserRemoveTeam(tournamentId, teamId);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  // #72 Playing XI, #73 substitutes, #74 replacements, #75 transfers
  async fetchMatchLineups(matchId) {
    requireDatabase();
    const res = await supabaseClient.getMatchLineups(matchId);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async setMatchLineup(matchId, teamId, lineup) {
    requireDatabase();
    const res = await supabaseClient.setMatchLineup(matchId, teamId, lineup);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async replaceMatchPlayer(details) {
    requireDatabase();
    const res = await supabaseClient.replaceMatchPlayer(details);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async requestPlayerTransfer(details) {
    requireDatabase();
    const res = await supabaseClient.requestPlayerTransfer(details);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async decidePlayerTransfer(transferId, accept, reason) {
    requireDatabase();
    const res = await supabaseClient.decidePlayerTransfer(transferId, accept, reason);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async cancelPlayerTransfer(transferId) {
    requireDatabase();
    const res = await supabaseClient.cancelPlayerTransfer(transferId);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async fetchTeamTransfers(teamId) {
    requireDatabase();
    const res = await supabaseClient.getTeamTransfers(teamId);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async searchTeams(query) {
    requireDatabase();
    const res = await supabaseClient.searchTeams(query);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  // #53 #54 #55 points table with NRR and qualification
  async fetchPointsTable(tournamentId) {
    requireDatabase();
    const res = await supabaseClient.getPointsTable(tournamentId);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  // Manual result entry (until ball-by-ball scoring in Phase 3)
  async recordMatchResult(matchId, result) {
    requireDatabase();
    const res = await supabaseClient.recordMatchResult(matchId, result);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async clearMatchResult(matchId) {
    requireDatabase();
    const res = await supabaseClient.clearMatchResult(matchId);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async setTournamentRules(tournamentId, rules) {
    requireDatabase();
    const res = await supabaseClient.setTournamentRules(tournamentId, rules);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  // #58 finish the tournament and declare the winner
  async completeTournament(tournamentId, winnerId, runnerUpId) {
    requireDatabase();
    const res = await supabaseClient.completeTournament(tournamentId, winnerId, runnerUpId);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async deleteMatch(matchId) {
    requireDatabase();
    const res = await supabaseClient.deleteMatch(matchId);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  /** Maintenance flag + active announcement, shown to every visitor (#257). */
  async fetchPlatformSettings() {
    if (isSupabaseConfigured) {
      const res = await supabaseClient.getPlatformSettings();
      if (res.error) throw new Error(res.error);
      return res.data;
    }
    const res = await mockClient.getSuperAdminMetrics();
    return {
      maintenance_mode: !!res.data?.maintenance_mode,
      broadcast_banner: res.data?.broadcast_banner || null
    };
  },

  // ==========================================
  // Feature #258: Admin Dashboard
  // ==========================================
  async fetchAdminDashboard() {
    const res = await adminProvider.getAdminDashboard();
    if (res.error) throw new Error(res.error);
    return res.data;
  },

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
    const res = await adminProvider.getRolePermissions(role);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async toggleRolePermission(role, key, enabled) {
    const res = await adminProvider.toggleRolePermission({ role, key, enabled });
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async resetRolePermissions(role) {
    const res = await adminProvider.resetRolePermissionsToDefaults(role);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async fetchMembersWithRoles() {
    const res = await adminProvider.listMembersWithRoles();
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async assignRole(userId, role) {
    const res = await adminProvider.assignRole({ userId, role });
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async revokeRole(userId, role) {
    const res = await adminProvider.revokeRole({ userId, role });
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  // ==========================================
  // Feature #265: User Verification
  // ==========================================
  async fetchVerificationQueue(status = null) {
    const res = await adminProvider.getVerificationQueue(status);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async fetchMyVerifications() {
    const res = await adminProvider.getMyVerifications();
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async requestVerification(type, note) {
    const res = await adminProvider.requestVerification({ type, note });
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  /** payload: { id, approve: boolean, note } */
  async processUserVerification(verificationPayload) {
    const res = await adminProvider.processUserVerification(verificationPayload);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  // ==========================================
  // Feature #266: User Reporting and Suspension
  // ==========================================
  async fetchUserReports(status = null) {
    const res = await adminProvider.getUserReports(status);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async searchMembers(query) {
    const res = await adminProvider.searchMembers(query);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async reportUser(userId, reason, description) {
    const res = await adminProvider.reportUser({ userId, reason, description });
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async resolveUserReport(id, dismiss, note) {
    const res = await adminProvider.resolveUserReport({ id, dismiss, note });
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async fetchActiveSuspensions() {
    const res = await adminProvider.getActiveSuspensions();
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  /** payload: { userId, reason, days } — days null = until further notice */
  async suspendUserAccount(suspensionPayload) {
    const res = await adminProvider.suspendUserAccount(suspensionPayload);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  async liftSuspension(suspensionId, note) {
    const res = await adminProvider.liftSuspension(suspensionId, note);
    if (res.error) throw new Error(res.error);
    return res.data;
  },

  // ==========================================
  // Feature #267: Activity and Audit Logs
  // ==========================================
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
