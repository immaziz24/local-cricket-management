// Batch 17 #324: turn the server's correction preview into plain lines.
export function previewLinesFromServer(p) {
  if (!p || !Array.isArray(p.lines)) return [];
  return p.lines.map((l) => `${l.label}: ${l.from || 'none'} → ${l.to || 'none'}. ${l.effect}.`);
}
export function previewNote(p) {
  return p && p.note ? p.note : '';
}
