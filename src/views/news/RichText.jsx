import React from 'react';

/* ---------- safe text renderer: headings, lists, bold, italic, links. Never injects HTML. ---------- */
function inline(text, keyBase) {
  const out = []; let rest = text; let k = 0;
  const re = /(\*\*([^*]+)\*\*)|(\*([^*\s][^*]*)\*)|(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/;
  while (rest) {
    const m = rest.match(re);
    if (!m) { out.push(rest); break; }
    if (m.index > 0) out.push(rest.slice(0, m.index));
    if (m[1]) out.push(<strong key={`${keyBase}-${k++}`}>{m[2]}</strong>);
    else if (m[3]) out.push(<em key={`${keyBase}-${k++}`}>{m[4]}</em>);
    else out.push(<a key={`${keyBase}-${k++}`} href={m[7]} target="_blank" rel="noopener noreferrer nofollow" style={{ color: '#2563eb' }}>{m[6]}</a>);
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

export function RichText({ text, style }) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const blocks = []; let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const h = line.match(/^(#{2,3})\s+(.*)$/);
    if (h) { blocks.push({ t: h[1].length === 2 ? 'h2' : 'h3', text: h[2] }); i++; continue; }
    if (/^\s*[-*]\s+/.test(line)) {
      const items = []; while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, '')); i++; }
      blocks.push({ t: 'ul', items }); continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const start = parseInt(line, 10) || 1; const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+[.)]\s+/, '')); i++; }
      blocks.push({ t: 'ol', items, start }); continue;
    }
    const para = []; while (i < lines.length && lines[i].trim() && !/^(#{2,3})\s|^\s*[-*]\s+|^\s*\d+[.)]\s+/.test(lines[i])) { para.push(lines[i]); i++; }
    blocks.push({ t: 'p', lines: para });
  }
  return (
    <div style={{ fontSize: '0.98rem', lineHeight: 1.7, color: '#1e293b', ...style }}>
      {blocks.map((b, n) => {
        if (b.t === 'h2') return <h3 key={n} style={{ fontSize: '1.15rem', fontWeight: 800, margin: '1.2rem 0 0.4rem', color: '#0f172a' }}>{inline(b.text, n)}</h3>;
        if (b.t === 'h3') return <h4 key={n} style={{ fontSize: '1rem', fontWeight: 800, margin: '1rem 0 0.3rem' }}>{inline(b.text, n)}</h4>;
        if (b.t === 'ul') return <ul key={n} style={{ margin: '0.3rem 0 0.7rem', paddingLeft: '1.3rem' }}>{b.items.map((x, j) => <li key={j} style={{ marginBottom: 3 }}>{inline(x, `${n}-${j}`)}</li>)}</ul>;
        if (b.t === 'ol') return <ol key={n} start={b.start} style={{ margin: '0.3rem 0 0.7rem', paddingLeft: '1.4rem' }}>{b.items.map((x, j) => <li key={j} style={{ marginBottom: 3 }}>{inline(x, `${n}-${j}`)}</li>)}</ol>;
        return <p key={n} style={{ margin: '0 0 0.8rem' }}>{b.lines.map((l, j) => <React.Fragment key={j}>{j > 0 && <br />}{inline(l, `${n}-${j}`)}</React.Fragment>)}</p>;
      })}
    </div>
  );
}

