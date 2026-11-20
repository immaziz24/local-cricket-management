// Batch 17 #351 #352: readable lines for the server's powerplay / middle / death-overs figures.
export function phaseRunRate(p) {
  if (!p || !p.legal_balls) return null;
  return Math.round((p.runs * 6 / p.legal_balls) * 100) / 100;
}
export function phaseOversText(p) {
  if (!p) return '';
  return p.to_over < p.from_over ? 'none' : p.from_over === p.to_over ? `over ${p.from_over}` : `overs ${p.from_over}-${p.to_over}`;
}
export function phaseLine(p) {
  if (!p || !p.legal_balls) return 'Not reached';
  const rr = phaseRunRate(p);
  return `${p.runs}/${p.wickets} · RR ${rr.toFixed(2)} · ${p.dots} dots · ${p.boundaries} boundaries`;
}
/** Which phase of an innings scored fastest (null when nothing was bowled). */
export function bestPhase(phases = []) {
  const live = phases.filter((p) => p.legal_balls > 0);
  if (!live.length) return null;
  return live.reduce((a, b) => (phaseRunRate(b) > phaseRunRate(a) ? b : a));
}
