/** #384 and #387 helpers. */

export function twoPersonText(on) {
  return on
    ? 'On: the person who asks for a score correction or a local rule change cannot approve it themselves. Another organiser or the match owner must.'
    : 'Off: the match owner or an organiser can approve their own score corrections and rule changes.';
}

/** An organiser who is the only one cannot approve anything when the switch is on. */
export function twoPersonWarning(on, organiserCount) {
  return on && organiserCount < 2 ? 'You are the only organiser, so your own requests will wait until another organiser or an admin decides them. Add a second organiser first.' : null;
}

export const ALERT_ICON = { password_changed: 'Password', email_changed: 'Email', phone_changed: 'Phone', mobile_changed: 'Mobile', account_status: 'Account', admin_role: 'Role' };

export function alertLabel(kind) { return ALERT_ICON[kind] || 'Security'; }
