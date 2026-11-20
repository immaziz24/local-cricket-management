/** #377 Custom tournament domain mapping: address rules (the database checks the same rules again). */
const HOST_RE = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
export const VERIFY_PREFIX = '_cricnotch-verify.';
export const PLATFORM_HOSTS = ['plateria.in', 'localhost', 'cricnotch.com'];

/** "HTTPS://Cup.MyClub.com/path?x=1" -> "cup.myclub.com" */
export function cleanDomain(raw) {
  return String(raw || '').trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/[/?#:].*$/, '').replace(/\.+$/, '');
}
export function isReservedDomain(d) {
  return PLATFORM_HOSTS.includes(d) || /\.(plateria\.in|supabase\.co|supabase\.in|cricnotch\.com)$/.test(d);
}
/** { ok, domain, reason } for the add form. */
export function checkDomain(raw) {
  const domain = cleanDomain(raw);
  if (!domain) return { ok: false, domain, reason: 'Type your web address, for example cup.myclub.com.' };
  if (!HOST_RE.test(domain) || domain.length > 253) return { ok: false, domain, reason: 'That does not look like a web address. Use something like cup.myclub.com.' };
  if (isReservedDomain(domain)) return { ok: false, domain, reason: 'That address belongs to the platform and cannot be used.' };
  return { ok: true, domain, reason: null };
}
/** True when this page is opened on the platform's own address (so no domain lookup is needed). */
export function isPlatformHost(host, extra = []) {
  const h = cleanDomain(host);
  if (!h || h === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || !h.includes('.')) return true;
  return [...PLATFORM_HOSTS, ...extra.map(cleanDomain).filter(Boolean)].some((p) => h === p || h.endsWith(`.${p}`));
}
/** The two DNS steps shown to the organiser. */
export function dnsSteps(domain, token) {
  return {
    txtName: `${VERIFY_PREFIX}${domain}`,
    txtValue: token,
    isSubdomain: domain.split('.').length > 2
  };
}
export const STATUS_TEXT = {
  pending: 'Waiting for the DNS record',
  verified: 'Connected',
  failed: 'Could not be connected'
};
