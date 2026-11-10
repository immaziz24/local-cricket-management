import React, { useState } from 'react';
import { Card } from '../components/common/Card.jsx';
import { Badge } from '../components/common/Badge.jsx';
import { Button } from '../components/common/Button.jsx';
import { LoadingSpinner } from '../components/common/LoadingSpinner.jsx';
import { dataService } from '../services/dataService.js';
import {
  Trophy,
  Calendar,
  MapPin,
  Users,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Sparkles,
  ShieldAlert,
  Layers,
  FileText,
  DollarSign,
  Palette,
  Eye,
  RotateCcw
} from 'lucide-react';

const COLOR_PALETTES = [
  { label: 'Emerald Green', value: '#059669' },
  { label: 'Royal Navy', value: '#1E3A8A' },
  { label: 'Amber Gold', value: '#D97706' },
  { label: 'Royal Purple', value: '#7C3AED' },
  { label: 'Ruby Crimson', value: '#DC2626' },
  { label: 'Teal Ocean', value: '#0D9488' }
];

const FORMAT_OPTIONS = [
  { value: 'T20', label: 'T20 (20 Overs Standard)', desc: 'Standard limited overs match format' },
  { value: 'T20 (Floodlights)', label: 'T20 Floodlights (Night)', desc: 'White ball under ground floodlights' },
  { value: '35 Overs', label: '35 Overs (Intermediate)', desc: 'Traditional club league length' },
  { value: '50 Overs', label: '50 Overs (One Day)', desc: 'Full-length limited overs tournament' },
  { value: 'Test / Multi-Day', label: 'Test / Multi-Day (2 Innings)', desc: 'Two innings per side red/pink ball' }
];

const BALL_TYPES = [
  'Leather Ball (White)',
  'Leather Ball (Red)',
  'Leather Ball (Pink)',
  'Heavy Tennis Ball (Green)',
  'Light Tennis / Tape Ball'
];

const PENALTY_POLICIES = [
  { value: 'overs_deduction', label: 'Overs Deduction', desc: 'Late team loses overs (e.g. 1 over per 10 minutes late)' },
  { value: 'fielding_restriction', label: 'Fielding Restriction', desc: 'Late team fields with restrictions (e.g. only 2 fielders outside the 30-yard circle)' },
  { value: 'penalty_runs', label: 'Penalty Runs', desc: 'Opponent gets penalty runs (e.g. 5 runs per 10 minutes late)' }
];

const INITIAL_FORM = {
  name: '',
  code: '',
  format: 'T20',
  ball_type: 'Leather Ball (White)',
  status: 'registration',
  start_date: '',
  end_date: '',
  venue: '',
  teams_count: 16,
  matches_total: 31,
  organizer_name: '',
  entry_fee: '₹5,000',
  prize_pool: '₹50,000 + Trophy',
  banner_color: '#059669',
  penalty_policy: 'overs_deduction',
  rules_summary: ''
};

export function CreateTournamentView(props) {
  const { onNavigate = () => {} } = props || {};
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [createdTournament, setCreatedTournament] = useState(null);

  const validateField = (field, value) => {
    switch (field) {
      case 'name':
        if (!value || value.trim().length < 3) return 'Tournament name must be at least 3 characters.';
        return null;
      case 'code':
        if (!value || value.trim().length < 2) return 'Tournament code must be at least 2 characters (e.g. PCCC-26).';
        if (!/^[A-Z0-9-]+$/i.test(value.trim())) return 'Code can only contain letters, numbers, and hyphens.';
        return null;
      case 'venue':
        if (!value || value.trim().length < 3) return 'Venue / Ground name must be at least 3 characters.';
        return null;
      case 'start_date':
        if (!value) return 'Start date is required.';
        return null;
      case 'end_date':
        if (!value) return 'End date is required.';
        if (formData.start_date && new Date(value) < new Date(formData.start_date)) {
          return 'End date cannot be earlier than start date.';
        }
        return null;
      case 'teams_count': {
        const n = parseInt(value, 10);
        if (isNaN(n) || n < 2 || n > 64) return 'Teams count must be between 2 and 64.';
        return null;
      }
      default:
        return null;
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let formattedVal = value;

    if (name === 'code') {
      formattedVal = value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    }

    setFormData((prev) => {
      const updated = { ...prev, [name]: formattedVal };
      // Auto estimate matches when teams_count changes if not manually set
      if (name === 'teams_count') {
        const count = parseInt(formattedVal, 10);
        if (!isNaN(count) && count > 1) {
          updated.matches_total = count <= 8 ? (count - 1) : Math.round(count * 1.8);
        }
      }
      return updated;
    });

    // Clear inline error
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
    setSubmitError(null);
  };

  const handleValidateForm = () => {
    const newErrors = {};
    const fieldsToValidate = ['name', 'code', 'venue', 'start_date', 'end_date', 'teams_count'];

    fieldsToValidate.forEach((f) => {
      const err = validateField(f, formData[f]);
      if (err) newErrors[f] = err;
    });

    if (formData.start_date && formData.end_date) {
      if (new Date(formData.end_date) < new Date(formData.start_date)) {
        newErrors.end_date = 'End date cannot be earlier than start date.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);

    if (!handleValidateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      const newTrn = await dataService.createTournament(formData);
      setCreatedTournament(newTrn);
    } catch (err) {
      setSubmitError(err.message || 'Failed to create tournament. Please check your inputs.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData(INITIAL_FORM);
    setErrors({});
    setSubmitError(null);
    setCreatedTournament(null);
  };

  // Render Success State if tournament is created
  if (createdTournament) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{
          padding: '2rem',
          backgroundColor: '#ECFDF5',
          border: '2px solid #10B981',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          textAlign: 'center'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            backgroundColor: '#10B981',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem auto',
            color: '#FFFFFF'
          }}>
            <CheckCircle2 size={36} />
          </div>

          <Badge variant="primary" style={{ marginBottom: '0.5rem' }}>FEATURE #31 SUCCESS</Badge>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#065F46', marginBottom: '0.5rem' }}>
            Tournament Successfully Created!
          </h2>
          <p style={{ color: '#047857', fontSize: '0.95rem', maxWidth: '560px', margin: '0 auto 1.5rem auto' }}>
            <strong>{createdTournament.name}</strong> ({createdTournament.code}) has been registered in the tournament database and is now live in the tournament registries.
          </p>

          {/* Quick Summary Pill Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.75rem',
            backgroundColor: '#FFFFFF',
            padding: '1.25rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid #D1FAE5',
            textAlign: 'left',
            marginBottom: '1.75rem'
          }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>TOURNAMENT ID</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0F172A' }}>{createdTournament.id}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>FORMAT & BALL</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0F172A' }}>{createdTournament.format}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>VENUE</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0F172A' }}>{createdTournament.venue}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>DATES</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0F172A' }}>
                {createdTournament.start_date} to {createdTournament.end_date}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>TEAMS COUNT</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0F172A' }}>
                {createdTournament.teams_count} Teams ({createdTournament.matches_total} Matches)
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>STATUS</div>
              <Badge variant="primary">{createdTournament.status}</Badge>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Button
              variant="primary"
              icon={Trophy}
              onClick={() => onNavigate && onNavigate('tournament-details', createdTournament.id)}
              style={{ backgroundColor: '#059669' }}
            >
              View Tournament Details (#32)
            </Button>
            <Button
              variant="outline"
              onClick={() => onNavigate && onNavigate('tournaments')}
            >
              All Tournaments
            </Button>
            <Button
              variant="outline"
              icon={RotateCcw}
              onClick={handleReset}
            >
              Create Another Tournament
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div style={{
        padding: '1.25rem 1.5rem',
        backgroundColor: '#FFFFFF',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <Badge variant="primary">PHASE 2 • FEATURE #31</Badge>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
              Tournament Administration
            </span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text-main)', margin: 0 }}>
            Create a Tournament
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
            Configure tournament identity, cricket format, ground allocations, team capacity, and local playing rules.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          icon={ArrowLeft}
          onClick={() => onNavigate && onNavigate('tournaments')}
        >
          Back to Tournaments
        </Button>
      </div>

      {/* Global Error Banner */}
      {submitError && (
        <div style={{
          padding: '1rem 1.25rem',
          backgroundColor: '#FEF2F2',
          border: '1px solid #FCA5A5',
          borderRadius: 'var(--radius-md)',
          color: '#991B1B',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '0.875rem'
        }}>
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <span>{submitError}</span>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          
          {/* Column 1: Core Identity & Format */}
          <Card title="1. Tournament Profile & Format" subtitle="General identity and playing configuration">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', marginTop: '0.5rem' }}>
              
              {/* Tournament Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '0.35rem' }}>
                  Tournament Name <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Pune City Championship 2026"
                  className="input-field"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: errors.name ? '2px solid #DC2626' : '1px solid var(--color-border)',
                    fontSize: '0.9rem'
                  }}
                />
                {errors.name ? (
                  <p style={{ color: '#DC2626', fontSize: '0.75rem', marginTop: '0.3rem' }}>{errors.name}</p>
                ) : (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginTop: '0.3rem' }}>
                    Official tournament title visible across fixtures, standings, and certificates.
                  </p>
                )}
              </div>

              {/* Tournament Code */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '0.35rem' }}>
                  Tournament Code (Short Identifier) <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="text"
                  name="code"
                  value={formData.code}
                  onChange={handleChange}
                  placeholder="e.g. PCC-26"
                  maxLength={12}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: errors.code ? '2px solid #DC2626' : '1px solid var(--color-border)',
                    fontSize: '0.9rem',
                    fontFamily: 'monospace',
                    fontWeight: 700
                  }}
                />
                {errors.code ? (
                  <p style={{ color: '#DC2626', fontSize: '0.75rem', marginTop: '0.3rem' }}>{errors.code}</p>
                ) : (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginTop: '0.3rem' }}>
                    Unique code used for match IDs (e.g. PCC-26-M01) and scoreboard tickers.
                  </p>
                )}
              </div>

              {/* Format Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '0.35rem' }}>
                  Cricket Format <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <select
                  name="format"
                  value={formData.format}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    fontSize: '0.9rem',
                    backgroundColor: '#FFFFFF'
                  }}
                >
                  {FORMAT_OPTIONS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginTop: '0.3rem' }}>
                  Determines maximum overs per innings and bowler quota rules.
                </p>
              </div>

              {/* Ball Type */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '0.35rem' }}>
                  Official Match Ball Type
                </label>
                <select
                  name="ball_type"
                  value={formData.ball_type}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    fontSize: '0.9rem',
                    backgroundColor: '#FFFFFF'
                  }}
                >
                  {BALL_TYPES.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              {/* Initial Status */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '0.35rem' }}>
                  Initial Tournament Status
                </label>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {[
                    { val: 'registration', label: 'Registration Open' },
                    { val: 'upcoming', label: 'Upcoming / Scheduled' },
                    { val: 'ongoing', label: 'Active / In Progress' }
                  ].map((st) => (
                    <label
                      key={st.val}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        padding: '0.4rem 0.75rem',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: formData.status === st.val ? 'var(--color-border-subtle)' : 'transparent',
                        border: '1px solid var(--color-border)'
                      }}
                    >
                      <input
                        type="radio"
                        name="status"
                        value={st.val}
                        checked={formData.status === st.val}
                        onChange={handleChange}
                      />
                      <span>{st.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Organizing Committee / Authority */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '0.35rem' }}>
                  Organising Body / Club Name
                </label>
                <input
                  type="text"
                  name="organizer_name"
                  value={formData.organizer_name}
                  onChange={handleChange}
                  placeholder="e.g. Deccan Cricket Association"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    fontSize: '0.9rem'
                  }}
                />
              </div>

            </div>
          </Card>

          {/* Column 2: Ground, Dates, Rules & Category Q */}
          <Card title="2. Schedule, Venue & Rules" subtitle="Playing venue, dates, team quota and Category Q penalty">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', marginTop: '0.5rem' }}>

              {/* Start Date & End Date Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '0.35rem' }}>
                    Start Date <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <input
                    type="date"
                    name="start_date"
                    value={formData.start_date}
                    onChange={handleChange}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.75rem',
                      borderRadius: 'var(--radius-md)',
                      border: errors.start_date ? '2px solid #DC2626' : '1px solid var(--color-border)',
                      fontSize: '0.85rem'
                    }}
                  />
                  {errors.start_date && (
                    <p style={{ color: '#DC2626', fontSize: '0.72rem', marginTop: '0.25rem' }}>{errors.start_date}</p>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '0.35rem' }}>
                    End Date <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <input
                    type="date"
                    name="end_date"
                    value={formData.end_date}
                    onChange={handleChange}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.75rem',
                      borderRadius: 'var(--radius-md)',
                      border: errors.end_date ? '2px solid #DC2626' : '1px solid var(--color-border)',
                      fontSize: '0.85rem'
                    }}
                  />
                  {errors.end_date && (
                    <p style={{ color: '#DC2626', fontSize: '0.72rem', marginTop: '0.25rem' }}>{errors.end_date}</p>
                  )}
                </div>
              </div>

              {/* Primary Venue */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '0.35rem' }}>
                  Primary Venue / Ground Allocations <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="text"
                  name="venue"
                  value={formData.venue}
                  onChange={handleChange}
                  placeholder="e.g. Central City Oval, Pitch A & B"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: errors.venue ? '2px solid #DC2626' : '1px solid var(--color-border)',
                    fontSize: '0.9rem'
                  }}
                />
                {errors.venue ? (
                  <p style={{ color: '#DC2626', fontSize: '0.75rem', marginTop: '0.3rem' }}>{errors.venue}</p>
                ) : (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginTop: '0.3rem' }}>
                    Grounds and pitch locations allocated for tournament fixtures.
                  </p>
                )}
              </div>

              {/* Teams Count & Matches Total */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '0.35rem' }}>
                    Expected Teams <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <input
                    type="number"
                    name="teams_count"
                    min={2}
                    max={64}
                    value={formData.teams_count}
                    onChange={handleChange}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-md)',
                      border: errors.teams_count ? '2px solid #DC2626' : '1px solid var(--color-border)',
                      fontSize: '0.9rem'
                    }}
                  />
                  {errors.teams_count && (
                    <p style={{ color: '#DC2626', fontSize: '0.72rem', marginTop: '0.25rem' }}>{errors.teams_count}</p>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '0.35rem' }}>
                    Total Estimated Matches
                  </label>
                  <input
                    type="number"
                    name="matches_total"
                    min={1}
                    value={formData.matches_total}
                    onChange={handleChange}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>
              </div>

              {/* Category Q Late Arrival Penalty Policy */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                  <ShieldAlert size={15} color="var(--color-primary)" />
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                    Category Q Penalty Method (Late Arrival)
                  </label>
                </div>
                <select
                  name="penalty_policy"
                  value={formData.penalty_policy}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    fontSize: '0.88rem',
                    backgroundColor: '#FFFFFF'
                  }}
                >
                  {PENALTY_POLICIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label} — {p.desc}
                    </option>
                  ))}
                </select>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.73rem', marginTop: '0.3rem' }}>
                  Per Master Blueprint Category Q: Organiser selects exactly one active penalty method for the tournament.
                </p>
              </div>

              {/* Theme Banner Color Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '0.4rem' }}>
                  Tournament Card Theme Color
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {COLOR_PALETTES.map((c) => (
                    <button
                      type="button"
                      key={c.value}
                      onClick={() => setFormData((prev) => ({ ...prev, banner_color: c.value }))}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.35rem 0.65rem',
                        borderRadius: 'var(--radius-full)',
                        border: formData.banner_color === c.value ? '2px solid #0F172A' : '1px solid var(--color-border)',
                        backgroundColor: '#FFFFFF',
                        cursor: 'pointer',
                        fontSize: '0.78rem'
                      }}
                    >
                      <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: c.value }} />
                      <span>{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Financials: Entry Fee & Prize Pool */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '0.35rem' }}>
                    Entry Fee per Team
                  </label>
                  <input
                    type="text"
                    name="entry_fee"
                    value={formData.entry_fee}
                    onChange={handleChange}
                    placeholder="e.g. ₹5,000"
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '0.35rem' }}>
                    Prize Pool
                  </label>
                  <input
                    type="text"
                    name="prize_pool"
                    value={formData.prize_pool}
                    onChange={handleChange}
                    placeholder="e.g. ₹50,000"
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
              </div>

              {/* Rules Summary */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: '0.35rem' }}>
                  Local Rules & Playing Conditions
                </label>
                <textarea
                  name="rules_summary"
                  value={formData.rules_summary}
                  onChange={handleChange}
                  rows={2}
                  placeholder="e.g. Maximum 4 overs per bowler. Powerplay in overs 1-6. Official umpires decision final."
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    fontSize: '0.85rem',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>

            </div>
          </Card>

        </div>

        {/* Live Preview Card */}
        <div style={{
          padding: '1.25rem 1.5rem',
          backgroundColor: '#F8FAFC',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Eye size={16} color="var(--color-primary)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
              Live Registry Card Preview
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              (Preview of how this tournament will appear in the Tournaments view)
            </span>
          </div>

          <div style={{ maxWidth: '420px' }}>
            <Card style={{ borderTop: '4px solid ' + (formData.banner_color || '#059669') }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.6rem' }}>
                <Badge variant={formData.status === 'ongoing' ? 'primary' : 'upcoming'}>
                  {formData.status}
                </Badge>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                  {formData.code || 'CODE-XX'}
                </span>
              </div>

              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-main)', margin: '0 0 0.2rem 0' }}>
                  {formData.name || 'Tournament Title Here'}
                </h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-primary-dark)', fontWeight: 600 }}>
                  {formData.format} • {formData.ball_type}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: '0.65rem 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Calendar size={13} />
                  <span>{formData.start_date || 'YYYY-MM-DD'} to {formData.end_date || 'YYYY-MM-DD'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <MapPin size={13} />
                  <span>{formData.venue || 'Venue Ground'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Users size={13} />
                  <span>{formData.teams_count} Participating Teams</span>
                </div>
              </div>

              <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                <span>Fee: {formData.entry_fee}</span>
                <span style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>Prize: {formData.prize_pool}</span>
              </div>
            </Card>
          </div>
        </div>

        {/* Submit and Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            type="button"
            variant="outline"
            icon={RotateCcw}
            onClick={handleReset}
            disabled={submitting}
          >
            Reset Form
          </Button>

          <Button
            type="submit"
            variant="primary"
            icon={Trophy}
            disabled={submitting}
            style={{ minWidth: '220px' }}
          >
            {submitting ? 'Creating Tournament...' : 'Create Tournament (#31)'}
          </Button>
        </div>
      </form>
    </div>
  );
}

