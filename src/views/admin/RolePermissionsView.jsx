import React, { useState, useEffect } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import {
  Shield,
  Check,
  X,
  RotateCcw,
  Sliders,
  HelpCircle,
  Trophy,
  Users,
  Flag,
  FileSpreadsheet,
  Award,
  UserCheck
} from 'lucide-react';

export function RolePermissionsView() {
  const [activeRole, setActiveRole] = useState('organiser');
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState(null);

  // Role metadata mapping for #259–#264
  const roleSpecs = {
    organiser: {
      id: 259,
      title: 'Organiser permissions',
      icon: Trophy,
      badgeColor: 'warning',
      description: 'Permissions for league organisers to create tournaments, book grounds, and assign late arrival penalty policies.'
    },
    team_owner: {
      id: 260,
      title: 'Team owner permissions',
      icon: Users,
      badgeColor: 'primary',
      description: 'Permissions for club owners to manage squads, player transfers, and tournament entries.'
    },
    captain: {
      id: 261,
      title: 'Captain permissions',
      icon: Flag,
      badgeColor: 'success',
      description: 'Permissions for team captains to submit Playing XI, attend the toss, and dispute scorecards.'
    },
    scorer: {
      id: 262,
      title: 'Scorer permissions',
      icon: FileSpreadsheet,
      badgeColor: 'info',
      description: 'Permissions for certified scorers to record ball-by-ball actions, wagon wheels, and DLS calculations.'
    },
    umpire: {
      id: 263,
      title: 'Umpire permissions',
      icon: Award,
      badgeColor: 'danger',
      description: 'Permissions for match umpires to sign off results, log conduct infractions, and award penalty runs.'
    },
    player: {
      id: 264,
      title: 'Player permissions',
      icon: UserCheck,
      badgeColor: 'default',
      description: 'Permissions for registered cricket players to view stats, RSVP for fixtures, and request transfers.'
    }
  };

  useEffect(() => {
    loadPermissions(activeRole);
  }, [activeRole]);

  const loadPermissions = async (role) => {
    setLoading(true);
    try {
      const data = await dataService.fetchRolePermissions(role);
      setPermissions(data.permissions || []);
    } catch (err) {
      console.error('Failed to load permissions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key, currentVal) => {
    const newVal = !currentVal;
    try {
      await dataService.toggleRolePermission(activeRole, key, newVal);
      setPermissions((prev) =>
        prev.map((p) => (p.key === key ? { ...p, enabled: newVal } : p))
      );
      setSaveStatus(`Permission "${key}" updated for role ${activeRole.toUpperCase()}.`);
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error('Failed to toggle permission:', err);
    }
  };

  const handleResetDefaults = async () => {
    try {
      const res = await dataService.resetRolePermissions(activeRole);
      setPermissions(res.permissions || []);
      setSaveStatus(`Default permission scheme restored for ${activeRole.toUpperCase()}.`);
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error('Failed to reset defaults:', err);
    }
  };

  const currentRoleMeta = roleSpecs[activeRole];
  const CurrentIcon = currentRoleMeta.icon;

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
            <Badge variant="success">FEATURES #259–#264</Badge>
            <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Role-Based Access Control (RBAC) Matrix
            </span>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main, #0f172a)', margin: '0 0 0.25rem 0' }}>
            Role Permissions Management
          </h2>
          <p style={{ fontSize: '0.825rem', color: '#64748b', margin: 0 }}>
            Fine-grained access rights and privilege boundaries across all 6 core cricket personas.
          </p>
        </div>

        <Button
          variant="secondary"
          onClick={handleResetDefaults}
          style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
        >
          <RotateCcw size={14} />
          Reset Scheme to Defaults
        </Button>
      </div>

      {/* Role Selector Tabs (Features #259 to #264) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '0.5rem'
      }}>
        {Object.entries(roleSpecs).map(([rKey, meta]) => {
          const Icon = meta.icon;
          const isSelected = activeRole === rKey;
          return (
            <button
              key={rKey}
              onClick={() => setActiveRole(rKey)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.75rem 0.85rem',
                backgroundColor: isSelected ? '#0f172a' : '#ffffff',
                color: isSelected ? '#ffffff' : '#334155',
                border: `1px solid ${isSelected ? '#0f172a' : '#e2e8f0'}`,
                borderRadius: '0.5rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={18} style={{ color: isSelected ? '#38bdf8' : '#64748b', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.7rem', opacity: 0.8, textTransform: 'uppercase' }}>
                  #{meta.id}
                </div>
                <div style={{ fontSize: '0.825rem', fontWeight: 700 }}>
                  {meta.title.replace(' permissions', '')}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Save Notification */}
      {saveStatus && (
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
          <Check size={16} />
          {saveStatus}
        </div>
      )}

      {/* Active Role Permissions Card */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '0.5rem',
            backgroundColor: '#eff6ff',
            color: '#1d4ed8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <CurrentIcon size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                Feature #{currentRoleMeta.id}: {currentRoleMeta.title}
              </h3>
              <Badge variant="primary">Active Schema</Badge>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
              {currentRoleMeta.description}
            </p>
          </div>
        </div>

        {/* Permissions Table / Toggle List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {permissions.map((p) => (
            <div key={p.key} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.85rem 1rem',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '0.5rem',
              gap: '1rem',
              flexWrap: 'wrap'
            }}>
              <div style={{ flex: 1, minWidth: '220px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{p.label}</strong>
                  <span style={{
                    fontSize: '0.7rem',
                    padding: '0.15rem 0.4rem',
                    backgroundColor: '#e2e8f0',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    color: '#475569'
                  }}>
                    {p.key}
                  </span>
                </div>
                <div style={{ fontSize: '0.775rem', color: '#64748b', marginTop: '0.2rem' }}>
                  {p.desc}
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                type="button"
                onClick={() => handleToggle(p.key, p.enabled)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.4rem 0.8rem',
                  borderRadius: '9999px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  backgroundColor: p.enabled ? '#dcfce7' : '#fee2e2',
                  color: p.enabled ? '#15803d' : '#b91c1c',
                  transition: 'all 0.15s ease'
                }}
              >
                {p.enabled ? <Check size={14} /> : <X size={14} />}
                {p.enabled ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

