import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import {
  ShieldCheck,
  Lock,
  Smartphone,
  Clock,
  Download,
  CheckCircle,
  Eye,
  Key
} from 'lucide-react';

export function SecurityPrivacyView() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [exportData, setExportData] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await dataService.fetchSecuritySettings();
      setSettings(data);
    } catch (err) {
      console.error('Failed to load security settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e?.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      await dataService.updateSecuritySettings(settings);
      setFeedback('Security & privacy policy updated successfully.');
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error('Failed to update security settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleExportUserData = async () => {
    try {
      const res = await dataService.exportUserDataGDPR('usr-1001');
      setExportData(res);
      setFeedback('Personal data archive compiled per DPDP guidelines.');
      setTimeout(() => setFeedback(null), 3500);
    } catch (err) {
      console.error('Failed to export user data:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        Loading security and privacy configuration...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Banner */}
      <div style={{
        padding: '1.25rem 1.5rem',
        backgroundColor: 'var(--card-bg, #ffffff)',
        border: '1px solid var(--border-color, #e2e8f0)',
        borderRadius: '0.75rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Badge variant="primary">FEATURE #269</Badge>
            <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Governance & Data Protection
            </span>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main, #0f172a)', margin: '0 0 0.25rem 0' }}>
            Security and Privacy Management
          </h2>
          <p style={{ fontSize: '0.825rem', color: '#64748b', margin: 0 }}>
            Configure authentication hardening, multi-factor enforcement, session timeouts, and DPDP data rights.
          </p>
        </div>
      </div>

      {feedback && (
        <div style={{
          padding: '0.75rem 1rem',
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '0.5rem',
          color: '#166534',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <CheckCircle size={16} />
          {feedback}
        </div>
      )}

      {/* Security Form Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Security Hardening Policies */}
        <Card title="Security & Authentication Policies">
          <form onSubmit={handleSaveSettings}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* 2FA Toggle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>Enforce Two-Factor Authentication (2FA)</strong>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Require OTP challenge for Admin and Scorer logins
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings?.two_factor_auth_required || false}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, two_factor_auth_required: e.target.checked }))
                  }
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </div>

              {/* Session Timeout */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                  Session Inactivity Timeout (Minutes)
                </label>
                <select
                  value={settings?.session_timeout_minutes || 60}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, session_timeout_minutes: parseInt(e.target.value, 10) }))
                  }
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    fontSize: '0.85rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.375rem'
                  }}
                >
                  <option value={15}>15 Minutes (Strict)</option>
                  <option value={30}>30 Minutes</option>
                  <option value={60}>60 Minutes (Standard)</option>
                  <option value={120}>120 Minutes</option>
                </select>
              </div>

              {/* Max Failed Attempts */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.3rem' }}>
                  Max Failed Password Attempts Before Lockout
                </label>
                <select
                  value={settings?.max_failed_attempts || 5}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, max_failed_attempts: parseInt(e.target.value, 10) }))
                  }
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    fontSize: '0.85rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.375rem'
                  }}
                >
                  <option value={3}>3 Attempts (High Security)</option>
                  <option value={5}>5 Attempts (Balanced)</option>
                  <option value={10}>10 Attempts</option>
                </select>
              </div>

              <Button
                type="submit"
                variant="primary"
                disabled={saving}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {saving ? 'Saving...' : 'Save Security Settings'}
              </Button>
            </div>
          </form>
        </Card>

        {/* Data Privacy & DPDP Rights */}
        <Card title="Data Privacy & Personal Data Rights (DPDP)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem', color: '#475569' }}>
            <p style={{ margin: 0 }}>
              Under the Digital Personal Data Protection guidelines, users retain the right to download their complete digital cricket dossier and request data erasure.
            </p>

            <div style={{
              padding: '0.85rem',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '0.5rem'
            }}>
              <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>
                Download Personal Account Dossier
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.75rem' }}>
                Compiles account metadata, phone verification records, and activity timestamps into structured JSON.
              </div>
              <Button
                variant="secondary"
                onClick={handleExportUserData}
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
              >
                <Download size={14} />
                Generate DPDP Archive
              </Button>
            </div>

            {exportData && (
              <pre style={{
                padding: '0.75rem',
                backgroundColor: '#0f172a',
                color: '#38bdf8',
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                overflowX: 'auto',
                margin: 0
              }}>
                {JSON.stringify(exportData, null, 2)}
              </pre>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

