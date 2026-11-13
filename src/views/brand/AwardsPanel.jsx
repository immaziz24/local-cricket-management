import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import { Trophy, Award, Download, Printer, Trash2, Sparkles, ShieldCheck, ShieldX } from 'lucide-react';
import { inp, lbl, grid, fmtDate, downloadCertificate, printCertificate, CertificatePreview } from './brandShared.jsx';

/** #197 Digital trophies and awards, #196 digital certificates (with a QR code anyone can scan to verify). */
const AWARDS = [['winner', 'Champions', 'team'], ['runner_up', 'Runners-up', 'team'], ['player_of_tournament', 'Player of the Tournament', 'player'], ['best_batter', 'Best Batter', 'player'],
  ['best_bowler', 'Best Bowler', 'player'], ['best_fielder', 'Best Fielder', 'player'], ['best_wicketkeeper', 'Best Wicket-keeper', 'player'], ['emerging_player', 'Emerging Player', 'player'],
  ['fair_play', 'Fair Play Award', 'team'], ['custom', 'Other award (your own name)', 'player']];
const AWARD_TYPE = Object.fromEntries(AWARDS.map(([k, , t]) => [k, t]));
const TROPHY = { winner: '🏆', runner_up: '🥈', player_of_tournament: '🌟', best_batter: '🏏', best_bowler: '🎯', best_fielder: '🧤', best_wicketkeeper: '🧤', emerging_player: '🚀', fair_play: '🤝', custom: '🏅' };

export function TrophyTile({ a, onOpen }) {
  return (
    <button type="button" onClick={onOpen} style={{ textAlign: 'left', border: '1px solid #fde68a', background: 'linear-gradient(160deg, #fffbeb, #fff)', borderRadius: '0.8rem', padding: '0.7rem 0.8rem', cursor: onOpen ? 'pointer' : 'default', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
      <span style={{ fontSize: '1.9rem' }}>{TROPHY[a.award] || '🏅'}</span>
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#92400e', textTransform: 'uppercase' }}>{a.label}</span>
        <span style={{ fontWeight: 800 }}>{a.player?.name || a.team?.name}</span>
        {a.tournament && <span style={{ fontSize: '0.74rem', color: '#64748b' }}>{a.tournament.name}{a.note ? ` · ${a.note}` : ''}</span>}
      </span>
    </button>
  );
}

function CertificateList({ certs, canRevoke, onChanged }) {
  const [open, setOpen] = useState(null);
  if (!certs.length) return <span style={{ fontSize: '0.84rem', color: '#94a3b8' }}>No certificates yet.</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      {certs.map((c) => (
        <div key={c.id} style={{ border: '1px solid #f1f5f9', borderRadius: '0.5rem', padding: '0.45rem 0.6rem', opacity: c.revoked_at ? 0.55 : 1 }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.84rem' }}>
            <Award size={15} color="#b45309" />
            <span style={{ fontWeight: 700, flex: 1, minWidth: 160 }}>{c.player?.name} – {c.title}{c.revoked_at ? ' (withdrawn)' : ''}</span>
            <code style={{ fontSize: '0.74rem', color: '#64748b' }}>{c.code}</code>
            <button type="button" className="btn-mini" onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? 'Hide' : 'View'}</button>
            <button type="button" className="btn-mini" onClick={() => downloadCertificate(c)}><Download size={13} /></button>
            <button type="button" className="btn-mini" onClick={() => printCertificate(c)}><Printer size={13} /></button>
            {canRevoke && !c.revoked_at && <button type="button" className="btn-mini" title="Withdraw" style={{ color: '#b91c1c' }} onClick={async () => { const r = window.prompt('Why is this certificate being withdrawn?'); if (!r) return; try { await dataService.revokeCertificate(c.id, r); onChanged(); } catch (e) { alert(e.message); } }}><Trash2 size={13} /></button>}
          </div>
          {open === c.id && <div style={{ marginTop: '0.5rem' }}><CertificatePreview cert={c} width={520} /></div>}
        </div>
      ))}
    </div>
  );
}

export function AwardsPanel({ tournament, teams = [] }) {
  const [d, setD] = useState(null);
  const [certs, setCerts] = useState([]);
  const [lb, setLb] = useState(null);
  const [players, setPlayers] = useState([]);
  const [form, setForm] = useState({ award: 'player_of_tournament', player_id: '', team_id: '', label: '', note: '', issue_certificate: true });
  const [bulk, setBulk] = useState({ title: `Certificate of Participation – ${tournament.name}`, team_id: '' });
  const [msg, setMsg] = useState(null);
  const load = () => {
    dataService.listAwards(tournament.id).then(setD).catch((e) => setMsg({ ok: false, text: e.message }));
    dataService.listCertificates({ tournament_id: tournament.id }).then(setCerts).catch(() => {});
  };
  useEffect(() => { load(); }, [tournament.id]);
  const org = d?.is_organiser;
  useEffect(() => {
    if (!org) return;
    dataService.fetchLeaderboards(tournament.id, 3).then(setLb).catch(() => {});
    Promise.all(teams.map((t) => dataService.fetchTeam(t.id).then((x) => (x.squad || []).map((p) => ({ id: p.id, name: p.display_name, team: t.name }))).catch(() => [])))
      .then((all) => setPlayers(all.flat().sort((a, b) => a.name.localeCompare(b.name))));
  }, [org, teams.length]);
  const suggest = useMemo(() => {
    if (!lb) return {};
    const first = (k) => (lb[k] || [])[0];
    return { player_of_tournament: first('mvp'), best_batter: first('most_runs'), best_bowler: first('most_wickets'), best_fielder: first('most_catches') };
  }, [lb]);
  const type = AWARD_TYPE[form.award];
  const give = async () => {
    setMsg(null);
    try {
      const r = await dataService.setAward(tournament.id, { ...form, player_id: type === 'player' ? form.player_id : '', team_id: type === 'team' ? form.team_id : '' });
      setMsg({ ok: true, text: `Award saved${r.certificates_issued ? ` and ${r.certificates_issued} certificate${r.certificates_issued > 1 ? 's' : ''} issued` : ''}.` });
      setForm({ ...form, player_id: '', team_id: '', label: '', note: '' }); load();
    } catch (e) { setMsg({ ok: false, text: e.message }); }
  };
  const issueBulk = async () => {
    setMsg(null);
    try {
      const r = await dataService.issueCertificates({ tournament_id: tournament.id, kind: 'participation', title: bulk.title, ...(bulk.team_id ? { team_id: bulk.team_id } : { all_players: true }) });
      setMsg({ ok: true, text: `${r.issued} certificate${r.issued === 1 ? '' : 's'} issued${r.skipped ? `, ${r.skipped} already had one` : ''}. Players with an account are notified.` }); load();
    } catch (e) { setMsg({ ok: false, text: e.message }); }
  };
  const s = suggest[form.award];
  return (
    <Card title={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Trophy size={17} /> Awards, trophies & certificates</span>}
      subtitle="Awards appear on the tournament page, its website and in each winner's trophy cabinet. Every certificate has a code and QR that anyone can scan to check it is real.">
      {d === null ? <span style={{ fontSize: '0.84rem', color: '#64748b' }}>Loading…</span> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {d.items.length === 0 ? <span style={{ fontSize: '0.86rem', color: '#94a3b8' }}>No awards yet{tournament.status !== 'completed' ? ' – they are usually given after the final.' : '.'}</span> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '0.6rem' }}>
              {d.items.map((a) => (
                <div key={a.id} style={{ position: 'relative' }}>
                  <TrophyTile a={{ ...a, tournament: null }} />
                  {org && <button type="button" title="Remove award" onClick={async () => { if (!window.confirm('Remove this award? Its certificates are withdrawn.')) return; try { await dataService.removeAward(a.id); load(); } catch (e) { setMsg({ ok: false, text: e.message }); } }} style={{ position: 'absolute', top: 6, right: 6, background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer' }}><Trash2 size={14} /></button>}
                </div>
              ))}
            </div>
          )}

          {org && (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.6rem', padding: '0.7rem', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <strong style={{ fontSize: '0.88rem' }}>Give an award</strong>
              <div style={grid}>
                <label style={lbl}>Award<select value={form.award} onChange={(e) => setForm({ ...form, award: e.target.value })} style={inp}>{AWARDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
                {form.award === 'custom' && <label style={lbl}>Award name<input value={form.label} maxLength={80} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. Best Catch" style={inp} /></label>}
                {type === 'player'
                  ? <label style={lbl}>Player<select value={form.player_id} onChange={(e) => setForm({ ...form, player_id: e.target.value })} style={inp}><option value="">Choose…</option>{players.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.team})</option>)}</select></label>
                  : <label style={lbl}>Team<select value={form.team_id} onChange={(e) => setForm({ ...form, team_id: e.target.value })} style={inp}><option value="">Choose…</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
                <label style={lbl}>Note (optional)<input value={form.note} maxLength={200} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. 312 runs in 6 innings" style={inp} /></label>
              </div>
              {s && type === 'player' && (
                <button type="button" onClick={() => setForm({ ...form, player_id: s.player_id, note: form.note || `${s.value} ${form.award === 'best_bowler' ? 'wickets' : form.award === 'best_fielder' ? 'catches' : form.award === 'best_batter' ? 'runs' : 'MVP points'}` })}
                  style={{ alignSelf: 'flex-start', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', borderRadius: 999, padding: '0.25rem 0.7rem', fontSize: '0.78rem', cursor: 'pointer', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                  <Sparkles size={13} /> Suggested from the stats: {s.name} ({s.value})
                </button>
              )}
              <label style={{ fontSize: '0.82rem' }}><input type="checkbox" checked={form.issue_certificate} onChange={(e) => setForm({ ...form, issue_certificate: e.target.checked })} /> Also issue {type === 'team' ? 'certificates to every player in the team' : 'a certificate'}</label>
              <div><Button size="sm" variant="primary" disabled={type === 'player' ? !form.player_id : !form.team_id} onClick={give}>Give award</Button></div>
            </div>
          )}

          {org && (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.6rem', padding: '0.7rem', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <strong style={{ fontSize: '0.88rem' }}>Participation certificates</strong>
              <div style={grid}>
                <label style={lbl}>Title<input value={bulk.title} maxLength={120} onChange={(e) => setBulk({ ...bulk, title: e.target.value })} style={inp} /></label>
                <label style={lbl}>For<select value={bulk.team_id} onChange={(e) => setBulk({ ...bulk, team_id: e.target.value })} style={inp}><option value="">Every player of every team</option>{teams.map((t) => <option key={t.id} value={t.id}>Only {t.name}</option>)}</select></label>
              </div>
              <div><Button size="sm" variant="primary" disabled={bulk.title.trim().length < 3} onClick={issueBulk}>Issue certificates</Button></div>
            </div>
          )}

          {msg && <div style={{ fontSize: '0.82rem', color: msg.ok ? '#065f46' : '#b91c1c' }}>{msg.text}</div>}
          <div>
            <strong style={{ fontSize: '0.88rem' }}>Certificates issued ({certs.filter((c) => !c.revoked_at).length})</strong>
            <div style={{ marginTop: '0.4rem' }}><CertificateList certs={certs} canRevoke={org} onChanged={load} /></div>
          </div>
        </div>
      )}
    </Card>
  );
}

/** Player profile: trophy cabinet and certificates. */
export function PlayerAwardsCard({ playerId, onNavigate }) {
  const [d, setD] = useState(null);
  useEffect(() => { dataService.playerAwards(playerId).then(setD).catch(() => setD({ awards: [], certificates: [] })); }, [playerId]);
  if (!d || (d.awards.length === 0 && d.certificates.length === 0)) return null;
  return (
    <Card title={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Trophy size={17} /> Trophy cabinet</span>} subtitle={`${d.awards.length} award${d.awards.length === 1 ? '' : 's'} · ${d.certificates.length} certificate${d.certificates.length === 1 ? '' : 's'}`}>
      {d.awards.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '0.6rem', marginBottom: '0.8rem' }}>
          {d.awards.map((a) => <TrophyTile key={a.id} a={a} onOpen={() => onNavigate && onNavigate('tournament-details', a.tournament?.id)} />)}
        </div>
      )}
      {d.certificates.length > 0 && <CertificateList certs={d.certificates} canRevoke={false} onChanged={() => {}} />}
    </Card>
  );
}

/** ?verify=CODE – anyone can check a certificate (#196). */
export function CertificateVerifyView({ code, onNavigate }) {
  const [c, setC] = useState(undefined);
  const [q, setQ] = useState(code || '');
  const check = (v) => { setC(undefined); dataService.verifyCertificate(v).then((r) => setC(r || null)).catch(() => setC(null)); };
  useEffect(() => { if (code) check(code); else setC(false); }, [code]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 760 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><ShieldCheck size={22} /> Check a certificate</h2>
        <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>Enter the code printed on the certificate (for example LC-AB12-CD34), or scan its QR code.</p>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input value={q} onChange={(e) => setQ(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && check(q)} placeholder="LC-XXXX-XXXX" style={{ ...inp, maxWidth: 260, fontFamily: 'ui-monospace, monospace' }} />
        <Button variant="primary" onClick={() => check(q)}>Check</Button>
      </div>
      {c === undefined && <span style={{ color: '#64748b' }}>Checking…</span>}
      {c === null && <Card><div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#b91c1c', fontWeight: 700 }}><ShieldX size={20} /> No certificate with this code was issued on Cricnotch.</div></Card>}
      {c && (
        <Card>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 800, color: c.revoked_at ? '#b91c1c' : '#065f46', marginBottom: '0.6rem' }}>
            {c.revoked_at ? <><ShieldX size={20} /> This certificate was withdrawn on {fmtDate(c.revoked_at)}{c.revoked_reason ? ` (${c.revoked_reason})` : ''}.</> : <><ShieldCheck size={20} /> Genuine certificate</>}
          </div>
          <div style={{ fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: 3, marginBottom: '0.8rem' }}>
            <span><strong>{c.player?.name}</strong>{c.player?.player_code ? ` (${c.player.player_code})` : ''}</span>
            <span>{c.title}</span>
            <span style={{ color: '#64748b' }}>{c.tournament ? `${c.tournament.name} · organised by ${c.tournament.organizer_name || '—'}` : c.match?.title} · issued {fmtDate(c.issued_at)}</span>
          </div>
          <CertificatePreview cert={c} width={680} />
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem' }}>
            <button type="button" className="btn-mini" onClick={() => downloadCertificate(c)}><Download size={13} /> Download</button>
            {c.player && <button type="button" className="btn-mini" onClick={() => onNavigate('player-profile', c.player.id)}>Player profile</button>}
          </div>
        </Card>
      )}
    </div>
  );
}

export default AwardsPanel;
