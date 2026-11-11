import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { dataService } from '../../services/dataService.js';
import { Megaphone, EyeOff } from 'lucide-react';
import { CTA_LABEL, fmtDate } from './brandShared.jsx';

/** Admins: campaigns running across the website (#195), with a button to hide one that breaks the rules. */
export function CampaignModeration({ onNavigate }) {
  const [list, setList] = useState(null);
  const [msg, setMsg] = useState(null);
  const load = () => dataService.activeCampaigns({ limit: 12 }).then(setList).catch((e) => setMsg(e.message));
  useEffect(() => { load(); }, []);
  return (
    <Card title={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Megaphone size={17} /> Running campaigns</span>} subtitle="Organisers' promotions shown on the home page. Hide any that are misleading or against the community guidelines.">
      {list === null ? <span style={{ fontSize: '0.84rem', color: '#64748b' }}>{msg || 'Loading…'}</span> : list.length === 0 ? <span style={{ fontSize: '0.86rem', color: '#94a3b8' }}>No campaigns running.</span> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {list.map((c) => (
            <div key={c.id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.5rem 0.7rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', fontSize: '0.85rem' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 800 }}>{c.title}</div>
                <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                  <button type="button" onClick={() => onNavigate && onNavigate('tournament-details', c.tournament.id)} style={{ background: 'none', border: 'none', padding: 0, color: '#2563eb', cursor: 'pointer', fontSize: '0.76rem' }}>{c.tournament.name}</button> · {CTA_LABEL[c.cta]}{c.city ? ` · ${c.city}` : ''} · until {fmtDate(c.ends_at)}
                </div>
                {c.message && <div style={{ fontSize: '0.8rem', color: '#475569' }}>{c.message}</div>}
              </div>
              <button type="button" className="btn-mini" style={{ color: '#b91c1c' }} onClick={async () => { if (!window.confirm('Hide this campaign from the website?')) return; try { await dataService.hideCampaign(c.id, true); load(); } catch (e) { setMsg(e.message); } }}><EyeOff size={13} /> Hide</button>
            </div>
          ))}
        </div>
      )}
      {msg && list !== null && <div style={{ color: '#b91c1c', fontSize: '0.82rem', marginTop: '0.4rem' }}>{msg}</div>}
    </Card>
  );
}

export default CampaignModeration;
