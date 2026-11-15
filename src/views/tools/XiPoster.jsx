import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/common/Button.jsx';
import { downloadBlob } from '../media/mediaUtils.js';

const roles = { batter: 'Batter', bowler: 'Bowler', all_rounder: 'All-rounder', wicket_keeper: 'Wicket-keeper' };

const designs = [
  ['Night Match', '#082b25', '#102032', '#70efa9', '#1b4941'],
  ['Royal Blue', '#101f54', '#233c80', '#91d7ff', '#304f91'],
  ['Sunset', '#4b171a', '#732b26', '#ffd29b', '#83392f'],
  ['Gold Trophy', '#252018', '#493917', '#ffdf72', '#5c4821'],
  ['Purple League', '#25103f', '#482273', '#ecc0ff', '#583582'],
  ['Ice Breaker', '#102b43', '#174c60', '#a8f4ff', '#216071'],
  ['Rose Cup', '#411530', '#642642', '#ffbfda', '#793553'],
  ['Floodlights', '#181920', '#303644', '#d6edff', '#414a5b'],
  ['Ocean Eleven', '#053337', '#134556', '#75f5e3', '#225b64'],
  ['Forest Club', '#1a3016', '#34491d', '#d9f989', '#485e2c'],
  ['Indigo Finals', '#211749', '#39316a', '#c9cdff', '#4b4381'],
  ['Copper Pitch', '#342019', '#603b29', '#ffd5ad', '#754831'],
  ['Teal Pavilion', '#092927', '#12413c', '#8af3d7', '#245b51'],
  ['Plum Stadium', '#33152e', '#592547', '#ffc6ea', '#71395e'],
  ['Slate Cup', '#202b3d', '#364963', '#bcd8ff', '#495d79'],
  ['Amber Arena', '#382610', '#624414', '#ffe3a5', '#745622'],
  ['Lime League', '#243019', '#3d4e24', '#e1fc99', '#536438'],
  ['Crimson Derby', '#3c0e18', '#591522', '#ffafb3', '#722838'],
];

const fixtureDesigns = [
  ...designs,
  ['Stadium Neon', '#141431', '#33306b', '#bfff62', '#292953'],
  ['Daylight Cricket', '#0c4249', '#267c74', '#fff2ad', '#124c4e'],
  ['Boundary Line', '#192c1c', '#2e5032', '#b7f6aa', '#29452a'],
  ['Electric Scoreboard', '#0b2141', '#164684', '#66f4ff', '#102f55'],
  ['Monsoon Trophy', '#243043', '#354a63', '#ffedcb', '#293b52'],
  ['Silver Crease', '#21242f', '#454057', '#e6ddff', '#343244'],
];

function drawFixture(canvas, tournament, match, number, style) {
  const [, start, end, accent, panel] = fixtureDesigns[style];
  canvas.width = 1600;
  canvas.height = 900;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 1600, 900);
  const gold = ctx.createLinearGradient(0, 0, 1600, 900);
  gold.addColorStop(0, '#9b6325');
  gold.addColorStop(0.5, '#ffe2a0');
  gold.addColorStop(1, '#b8782b');
  gradient.addColorStop(0, start);
  gradient.addColorStop(0.57, end);
  gradient.addColorStop(1, '#080e19');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1600, 900);
  for (const x of [42, 1558]) {
    const glow = ctx.createRadialGradient(x, 685, 0, x, 685, 390);
    glow.addColorStop(0, accent + '55');
    glow.addColorStop(1, accent + '00');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 1600, 900);
  }
  ctx.fillStyle = '#29452a';
  ctx.beginPath();
  ctx.ellipse(800, 916, 940, 102, 0, 0, Math.PI * 2);
  ctx.fill();

  function card(x, y, width, height, radius, fill) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.strokeStyle = gold;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  card(45, 45, 1510, 810, 34);
  for (const [x, y, direction] of [[0, 0, 1], [1600, 900, -1]]) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + direction * 258, y);
    ctx.lineTo(x, y + direction * 120);
    ctx.closePath();
    ctx.fillStyle = gold;
    ctx.fill();
  }

  const matchup = ctx.createLinearGradient(104, 0, 1496, 0);
  matchup.addColorStop(0, panel);
  matchup.addColorStop(0.5, '#0a1120');
  matchup.addColorStop(1, end);
  card(104, 367, 1392, 192, [22, 34, 64][style % 3], matchup);
  card(739, 405, 122, 116, 26, '#101725');
  card(380, 603, 840, 80, 40, '#0b1423');

  ctx.fillStyle = '#b83236';
  ctx.beginPath();
  ctx.arc(800, 108, 24, 0, 2 * Math.PI);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(785, 90);
  ctx.quadraticCurveTo(786, 113, 815, 126);
  ctx.strokeStyle = '#ffe2a0';
  ctx.stroke();

  ctx.textAlign = 'center';
  const line = (value, y, font, color, maxWidth = 1300, x = 800) => {
    ctx.font = font + ' system-ui';
    ctx.fillStyle = color;
    ctx.fillText(value, x, y, maxWidth);
  };
  line('CRICNOTCH', 182, 'italic 900 48px', '#fff');
  line(tournament.name.toLocaleUpperCase(), 275, 'italic 900 80px', gold);
  card(675, 292, 250, 53, 22, gold);
  line('MATCH ' + number, 329, '900 28px', '#14141a', 206);
  line((match.team_a?.name || 'TBD').toLocaleUpperCase(), 488, '900 62px', '#fff', 535, 426);
  line('VS', 480, 'italic 900 48px', gold, 90);
  line((match.team_b?.name || 'TBD').toLocaleUpperCase(), 488, '900 62px', '#fff', 535, 1174);
  const date = match.scheduled_at ? new Date(match.scheduled_at).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata',
  }) + ' IST' : 'Date and time to be announced';
  line(date, 655, 'bold 36px', '#fff', 770);
  line(match.venue || tournament.venue || 'Venue to be announced', 758, 'bold 38px', '#ffe2a0', 1220);
}

const zipCrc = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  return value;
});

// PNG already uses compression. Store the PNG bytes directly in the ZIP.
async function fixtureZip(entries) {
  const local = [];
  const central = [];
  let offset = 0;
  let directorySize = 0;
  for await (const { name, png } of entries) {
    const bytes = new Uint8Array(await png.arrayBuffer());
    const filename = new TextEncoder().encode(name);
    let crc = 0xffffffff;
    for (const byte of bytes) crc = (crc >>> 8) ^ zipCrc[(crc ^ byte) & 255];
    crc = (crc ^ 0xffffffff) >>> 0;
    const header = new DataView(new ArrayBuffer(30));
    header.setUint32(0, 0x04034b50, true);
    header.setUint16(4, 20, true);
    header.setUint16(12, 33, true);
    header.setUint32(14, crc, true);
    header.setUint32(18, bytes.length, true);
    header.setUint32(22, bytes.length, true);
    header.setUint16(26, filename.length, true);
    const record = new DataView(new ArrayBuffer(46));
    record.setUint32(0, 0x02014b50, true);
    record.setUint16(4, 20, true);
    new Uint8Array(record.buffer).set(new Uint8Array(header.buffer, 4, 26), 6);
    record.setUint32(42, offset, true);
    local.push(header.buffer, filename, bytes);
    central.push(record.buffer, filename);
    offset += header.byteLength + filename.length + bytes.length;
    directorySize += record.byteLength + filename.length;
  }
  const footer = new DataView(new ArrayBuffer(22));
  footer.setUint32(0, 0x06054b50, true);
  footer.setUint16(8, central.length / 2, true);
  footer.setUint16(10, central.length / 2, true);
  footer.setUint32(12, directorySize, true);
  footer.setUint32(16, offset, true);
  return new Blob([...local, ...central, footer.buffer], { type: 'application/zip' });
}

function canvasPng(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => {
    if (blob) resolve(blob);
    else reject(new Error('Could not create the match image.'));
  }, 'image/png'));
}

export function FixturePosters({ tournament, matches }) {
  const preview = useRef(null);
  const [matchId, setMatchId] = useState('');
  const [style, setStyle] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const index = Math.max(0, matches.findIndex(match => match.id === matchId));
  const selected = matches[index];

  useEffect(() => {
    drawFixture(preview.current, tournament, selected, selected.match_no ?? index + 1, style);
  }, [tournament, selected, index, style]);

  async function download(all) {
    setBusy(true);
    setStatus('');
    setError('');
    try {
      const canvas = document.createElement('canvas');
      const styleName = fixtureDesigns[style][0].toLowerCase().replaceAll(' ', '-');
      if (all) {
        async function* images() {
          for (const [position, match] of matches.entries()) {
            drawFixture(canvas, tournament, match, match.match_no ?? position + 1, style);
            const number = String(position + 1).padStart(String(matches.length).length, '0');
            yield { name: 'match-' + number + '-' + styleName + '.png', png: await canvasPng(canvas) };
          }
        }
        downloadBlob(await fixtureZip(images()), 'cricnotch-fixtures-' + styleName + '.zip');
      } else {
        drawFixture(canvas, tournament, selected, selected.match_no ?? index + 1, style);
        const nativeDownloads = window.CricnotchDownloads;
        if (nativeDownloads?.saveLineup) {
          nativeDownloads.saveLineup(canvas.toDataURL('image/png'));
          return;
        }
        downloadBlob(await canvasPng(canvas), 'cricnotch-match-' + (index + 1) + '-' + styleName + '.png');
      }
      setStatus('Download started. Check your browser downloads.');
    } catch {
      setError('Could not prepare the download. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: '0.8rem', marginTop: '0.9rem', maxWidth: '44rem', minWidth: 0 }}>
      <label>
        Graphic style ({fixtureDesigns.length} designs){' '}
        <select value={style} disabled={busy} onChange={event => setStyle(Number(event.target.value))}>
          {fixtureDesigns.map(([name], value) => <option key={name} value={value}>{name}</option>)}
        </select>
      </label>
      <label>
        Match{' '}
        <select value={selected.id} disabled={busy} onChange={event => setMatchId(event.target.value)} style={{ maxWidth: '100%' }}>
          {matches.map((match, position) => (
            <option key={match.id} value={match.id}>
              {match.match_no ?? position + 1}. {match.team_a?.name || 'TBD'} vs {match.team_b?.name || 'TBD'}
            </option>
          ))}
        </select>
      </label>
      <canvas ref={preview} aria-label="Selected match graphic" style={{ display: 'block', width: '100%', height: 'auto', borderRadius: '0.8rem' }} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
        <Button variant="secondary" disabled={busy} onClick={() => download(false)}>Download selected match (PNG)</Button>
        <Button variant="primary" disabled={busy} onClick={() => download(true)}>Download all {matches.length} matches (ZIP)</Button>
      </div>
      {busy && <p role="status">Preparing download…</p>}
      {!busy && status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

export function XiPoster({ lineup, title, subtitle, fileLabel = 'playing-xi' }) {
  const canvas = useRef(null);
  const [error, setError] = useState('');
  const [style, setStyle] = useState(0);
  const [status, setStatus] = useState('');
  const [, start, end, accent, row] = designs[style];
  const { xi, bench, team, notes } = lineup;
  const logicalHeight = 250 + 61 * (xi.length + bench.length) + (bench.length ? 55 : 0);
  const scale = Math.min(1, 4096 / logicalHeight);

  useEffect(() => {
    const ctx = canvas.current.getContext('2d');
    const width = 960;
    const height = logicalHeight;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const background = ctx.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, start);
    background.addColorStop(1, end);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#326758';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(width - 75, 105, 235, 100, -0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.font = 'bold 25px system-ui';
    ctx.fillText('CRICNOTCH', 54, 59);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 60px system-ui';
    ctx.fillText(title || (xi.length === 11 ? 'Suggested Playing XI' : 'Suggested lineup'), 52, 132, 850);
    ctx.fillStyle = '#ade5d3';
    ctx.font = '28px system-ui';
    ctx.fillText([team, subtitle || 'Batting order'].filter(Boolean).join('  ┬╖  '), 55, 180, 850);

    const drawPlayer = (player, index, y, label) => {
      ctx.fillStyle = row;
      ctx.globalAlpha = index % 2 ? 0.72 : 1;
      if (style % 3 === 1) {
        ctx.beginPath();
        ctx.roundRect(52, y, 856, 55, 26);
        ctx.fill();
      } else {
        ctx.fillRect(52, y, 856, 55);
      }
      ctx.globalAlpha = 1;
      if (style % 3 === 2) {
        ctx.fillStyle = accent;
        ctx.fillRect(52, y, 5, 55);
      }
      ctx.fillStyle = accent;
      ctx.font = 'bold 23px system-ui';
      ctx.fillText(label, 70, y + 36);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 29px system-ui';
      ctx.fillText(player.name, 140, y + 37, 525);
      ctx.fillStyle = '#b9e4d5';
      ctx.font = '23px system-ui';
      ctx.fillText(player.detail || roles[player.role] || '', 710, y + 36, 180);
    };
    xi.forEach((player, index) => drawPlayer(player, index, 210 + index * 61, String(index + 1).padStart(2, '0')));
    if (bench.length) {
      const benchY = 226 + xi.length * 61;
      ctx.fillStyle = accent;
      ctx.font = 'bold 25px system-ui';
      ctx.fillText('BENCH', 54, benchY + 24);
      bench.forEach((player, index) => drawPlayer(player, index, benchY + 43 + index * 61, 'ΓÇö'));
    }
  }, [xi, bench, team, style, start, end, accent, row, title, subtitle, logicalHeight, scale]);

  const save = () => {
    setError('');
    setStatus('');
    if (window.CricnotchDownloads?.saveLineup) {
      window.CricnotchDownloads.saveLineup(canvas.current.toDataURL('image/png'));
      return;
    }
    canvas.current.toBlob(blob => {
      if (blob) {
        const name = designs[style][0].toLowerCase().replaceAll(' ', '-');
        downloadBlob(blob, 'cricnotch-' + fileLabel + '-' + name + '.png');
        setStatus('Download started. Check your browser downloads.');
      }
      else setError('Could not create the PNG. Please try again.');
    }, 'image/png');
  };

  return (
    <div style={{ marginTop: '0.9rem' }}>
      <label style={{ display: 'block', marginBottom: '0.7rem' }}>
        Graphic style{' '}
        <select value={style} onChange={event => { setStyle(Number(event.target.value)); setStatus(''); }}>
          {designs.map(([name], index) => <option key={name} value={index}>{name}</option>)}
        </select>
      </label>
      <canvas ref={canvas} width={Math.ceil(960 * scale)} height={Math.ceil(logicalHeight * scale)}
        style={{ display: 'block', width: '100%', height: 'auto', borderRadius: '0.8rem', marginBottom: '0.7rem' }}
        aria-label={title || "Suggested lineup graphic"}>
        {xi.map(player => player.name).join(', ')}
      </canvas>
      <Button variant="secondary" onClick={save}>Download</Button>
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
      {notes.map(note => <p key={note} style={{ color: '#92400e' }}>{note}</p>)}
    </div>
  );
}
