import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/common/Button.jsx';
import { downloadBlob } from '../media/mediaUtils.js';

const roles = { batter: 'Batter', bowler: 'Bowler', all_rounder: 'All-rounder', wicket_keeper: 'Wicket-keeper' };

export function XiPoster({ lineup }) {
  const canvas = useRef(null);
  const [error, setError] = useState('');
  const { xi, bench, team, notes } = lineup;

  useEffect(() => {
    const ctx = canvas.current.getContext('2d');
    const { width, height } = canvas.current;
    const background = ctx.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, '#082b25');
    background.addColorStop(1, '#102032');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#326758';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(width - 75, 105, 235, 100, -0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#70efa9';
    ctx.font = 'bold 25px system-ui';
    ctx.fillText('CRICNOTCH', 54, 59);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 60px system-ui';
    ctx.fillText(xi.length === 11 ? 'Suggested Playing XI' : 'Suggested lineup', 52, 132, 850);
    ctx.fillStyle = '#ade5d3';
    ctx.font = '28px system-ui';
    ctx.fillText(team ? team + '  ·  Batting order' : 'Batting order', 55, 180, 850);

    const drawPlayer = (player, index, y, label) => {
      ctx.fillStyle = index % 2 ? '#143b37' : '#1b4941';
      ctx.fillRect(52, y, 856, 55);
      ctx.fillStyle = '#70efa9';
      ctx.font = 'bold 23px system-ui';
      ctx.fillText(label, 70, y + 36);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 29px system-ui';
      ctx.fillText(player.name, 140, y + 37, 525);
      ctx.fillStyle = '#b9e4d5';
      ctx.font = '23px system-ui';
      ctx.fillText(roles[player.role] || '', 710, y + 36, 180);
    };
    xi.forEach((player, index) => drawPlayer(player, index, 210 + index * 61, String(index + 1).padStart(2, '0')));
    if (bench.length) {
      const benchY = 226 + xi.length * 61;
      ctx.fillStyle = '#70efa9';
      ctx.font = 'bold 25px system-ui';
      ctx.fillText('BENCH', 54, benchY + 24);
      bench.forEach((player, index) => drawPlayer(player, index, benchY + 43 + index * 61, '—'));
    }
  }, [xi, bench, team]);

  const save = () => {
    setError('');
    if (window.CricnotchDownloads?.saveLineup) {
      window.CricnotchDownloads.saveLineup(canvas.current.toDataURL('image/png'));
      return;
    }
    canvas.current.toBlob(blob => {
      if (blob) downloadBlob(blob, 'cricnotch-playing-xi.png');
      else setError('Could not create the PNG. Please try again.');
    }, 'image/png');
  };

  return (
    <div style={{ marginTop: '0.9rem' }}>
      <canvas ref={canvas} width={960} height={250 + 61 * (xi.length + bench.length) + (bench.length ? 55 : 0)}
        style={{ display: 'block', width: '100%', height: 'auto', borderRadius: '0.8rem', marginBottom: '0.7rem' }}
        aria-label="Suggested lineup graphic">
        {xi.map(player => player.name).join(', ')}
      </canvas>
      <Button variant="secondary" onClick={save}>Download PNG</Button>
      {error && <p role="alert">{error}</p>}
      {notes.map(note => <p key={note} style={{ color: '#92400e' }}>{note}</p>)}
    </div>
  );
}
