/** #386 Plain-language device name from a browser user-agent string. */
export function deviceLabel(ua) {
  const s = String(ua || '');
  if (!s) return 'Unknown device';
  const os = /Android/i.test(s) ? 'Android' : /iPhone|iPad|iOS/i.test(s) ? 'iPhone / iPad' : /Windows/i.test(s) ? 'Windows' : /Mac OS X|Macintosh/i.test(s) ? 'Mac' : /Linux/i.test(s) ? 'Linux' : 'Unknown system';
  const br = /Edg\//.test(s) ? 'Edge' : /OPR\/|Opera/.test(s) ? 'Opera' : /Firefox\//.test(s) ? 'Firefox' : /Chrome\//.test(s) ? 'Chrome' : /Safari\//.test(s) ? 'Safari' : 'Browser';
  return `${br} on ${os}`;
}
