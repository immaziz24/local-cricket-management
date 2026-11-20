// Batch 17: helpers for #364 multi-pitch venue scheduling.

export function pitchChoices(opts) {
  if (!opts || !opts.ground_id) return [];
  return (opts.pitches || []).map((p) => ({
    pitch_no: p.pitch_no,
    selected: !!p.selected,
    free: !!p.free,
    label: p.selected ? `Pitch ${p.pitch_no} (this match)` : p.free ? `Pitch ${p.pitch_no} – free` : `Pitch ${p.pitch_no} – busy at this time`,
  }));
}

export function pitchSummary(opts) {
  if (!opts || !opts.ground_id) return 'Choose a ground first.';
  const n = opts.pitch_count || 1;
  if (n <= 1) return 'This ground has one pitch.';
  const free = (opts.pitches || []).filter((p) => p.free && !p.selected).length;
  const mine = opts.pitch_no ? `This match is on pitch ${opts.pitch_no}. ` : 'No pitch chosen yet. ';
  return `${mine}${n} pitches here, ${free} other${free === 1 ? '' : 's'} free at this time.`;
}

export function firstFreePitch(opts) {
  const p = (opts?.pitches || []).find((x) => x.free && !x.selected);
  return p ? p.pitch_no : null;
}
