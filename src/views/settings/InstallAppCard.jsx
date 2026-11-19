import React, { useEffect, useState } from 'react';
import { installState, installHelp, isStandalone, isIosSafari, hasInstallPrompt, onInstallChange, promptInstall } from './installApp.js';

/** #394 Settings card: install Cricnotch on the home screen. */
export function InstallAppCard() {
  const [, bump] = useState(0);
  const [msg, setMsg] = useState('');
  useEffect(() => onInstallChange(() => bump((n) => n + 1)), []);
  const st = installState({ standalone: isStandalone(), hasPrompt: hasInstallPrompt(), ios: isIosSafari() });
  const go = async () => { const r = await promptInstall(); setMsg(r === 'accepted' ? 'Installing…' : r === 'dismissed' ? 'No problem – you can install later from here.' : ''); };
  return (
    <section className="info-box" aria-labelledby="install-heading">
      <h2 id="install-heading">Install the app</h2>
      <p>{installHelp[st]}</p>
      {st === 'ready' && <button type="button" onClick={go}>Install Cricnotch</button>}
      {msg && <p role="status">{msg}</p>}
    </section>
  );
}
