// #394 Installable progressive web app: remember the browser's install offer so Settings can show an Install button.
let deferred = null;
const listeners = new Set();
const tell = () => listeners.forEach((f) => { try { f(); } catch { /* listener failed */ } });

export function isStandalone(win = (typeof window !== 'undefined' ? window : null)) {
  if (!win) return false;
  return !!((win.matchMedia && win.matchMedia('(display-mode: standalone)').matches) || (win.navigator && win.navigator.standalone));
}

export function isIosSafari(ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '')) {
  return /iphone|ipad|ipod/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
}

/** What the Install card should show right now. */
export function installState({ standalone, hasPrompt, ios }) {
  if (standalone) return 'installed';
  if (hasPrompt) return 'ready';
  if (ios) return 'ios';
  return 'browser';
}

export const installHelp = {
  installed: 'Cricnotch is installed on this device.',
  ready: 'Add Cricnotch to your home screen. It opens like an app and keeps working with weak internet.',
  ios: 'On iPhone or iPad: tap the Share button in Safari, then "Add to Home Screen".',
  browser: 'Your browser has not offered to install yet. Open the browser menu and choose "Install app" or "Add to Home screen". Visit a few pages first if the option is missing.'
};

export function listenForInstall(win = (typeof window !== 'undefined' ? window : null)) {
  if (!win || win.__lcmInstallListening) return;
  win.__lcmInstallListening = true;
  win.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; tell(); });
  win.addEventListener('appinstalled', () => { deferred = null; tell(); });
}

export const hasInstallPrompt = () => !!deferred;
export function onInstallChange(f) { listeners.add(f); return () => listeners.delete(f); }

export async function promptInstall() {
  if (!deferred) return 'unavailable';
  const e = deferred; deferred = null; tell();
  e.prompt();
  const r = await e.userChoice.catch(() => ({ outcome: 'dismissed' }));
  return r.outcome === 'accepted' ? 'accepted' : 'dismissed';
}
