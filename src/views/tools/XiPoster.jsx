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

export function XiPoster({ lineup, title, subtitle, fileLabel = 'playing-xi' }) {
  const canvas = useRef(null);
  const [error, setError] = useState('');
  const [style, setStyle] = useState(0);
  const [status, setStatus] = useState('');
  const isFixturePoster = fileLabel === 'fixtures';
  const availableDesigns = isFixturePoster ? fixtureDesigns : designs;
  const [designName, start, end, accent, row] = availableDesigns[style];
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
    if (isFixturePoster && style % 3 === 1) {
      ctx.rect(width - 272, 29, 110, 154);
      ctx.moveTo(width - 274, 54);
      ctx.lineTo(width - 144, 54);
      ctx.moveTo(width - 274, 158);
      ctx.lineTo(width - 144, 158);
    } else if (isFixturePoster && style % 3 === 2) {
      ctx.arc(width - 126, 89, 97, 0, Math.PI * 2);
      ctx.moveTo(width - 172, 14);
      ctx.lineTo(width - 83, 164);
      ctx.moveTo(width - 156, 8);
      ctx.lineTo(width - 67, 158);
    } else {
      ctx.ellipse(width - 75, 105, 235, 100, -0.5, 0, Math.PI * 2);
    }
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.font = 'bold 25px system-ui';
    ctx.fillText('CRICNOTCH', 54, 59);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 60px system-ui';
    ctx.fillText(title || (xi.length === 11 ? 'Suggested Playing XI' : 'Suggested lineup'), 52, 132, 850);
    ctx.fillStyle = '#ade5d3';
    ctx.font = '28px system-ui';
    ctx.fillText([team, subtitle || 'Batting order'].filter(Boolean).join('  ·  '), 55, 180, 850);

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
      ctx.fillText(player.name, 140, y + 37, isFixturePoster ? 485 : 525);
      ctx.fillStyle = '#b9e4d5';
      ctx.font = '23px system-ui';
      ctx.fillText(player.detail || roles[player.role] || '', isFixturePoster ? 647 : 710, y + 36, isFixturePoster ? 238 : 180);
    };
    xi.forEach((player, index) => drawPlayer(player, index, 210 + index * 61, String(index + 1).padStart(2, '0')));
    if (bench.length) {
      const benchY = 226 + xi.length * 61;
      ctx.fillStyle = accent;
      ctx.font = 'bold 25px system-ui';
      ctx.fillText('BENCH', 54, benchY + 24);
      bench.forEach((player, index) => drawPlayer(player, index, benchY + 43 + index * 61, '—'));
    }
  }, [xi, bench, team, style, start, end, accent, row, title, subtitle, logicalHeight, scale, isFixturePoster]);

  const save = () => {
    setError('');
    setStatus('');
    if (window.CricnotchDownloads?.saveLineup) {
      window.CricnotchDownloads.saveLineup(canvas.current.toDataURL('image/png'));
      return;
    }
    canvas.current.toBlob(blob => {
      if (blob) {
        const name = designName.toLowerCase().replaceAll(' ', '-');
        downloadBlob(blob, 'cricnotch-' + fileLabel + '-' + name + '.png');
        setStatus('Download started. Check your browser downloads.');
      }
      else setError('Could not create the PNG. Please try again.');
    }, 'image/png');
  };

  return (
    <div style={{ marginTop: '0.9rem' }}>
      <label style={{ display: 'block', marginBottom: '0.7rem' }}>
        Graphic style{isFixturePoster ? ` (${availableDesigns.length} designs)` : ''}{' '}
        <select value={style} onChange={event => { setStyle(Number(event.target.value)); setStatus(''); }}>
          {availableDesigns.map(([name], index) => <option key={name} value={index}>{name}</option>)}
        </select>
      </label>
      <canvas ref={canvas} width={Math.ceil(960 * scale)} height={Math.ceil(logicalHeight * scale)}
        style={{ display: 'block', width: '100%', height: 'auto', borderRadius: '0.8rem', marginBottom: '0.7rem' }}
        aria-label={title || "Suggested lineup graphic"}>
        {xi.map(player => player.name).join(', ')}
      </canvas>
      <Button variant="secondary" onClick={save}>{isFixturePoster ? 'Download fixtures as PNG' : 'Download'}</Button>
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
      {notes.map(note => <p key={note} style={{ color: '#92400e' }}>{note}</p>)}
    </div>
  );
}
