import React, { useState } from 'react';
import { Card } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { dataService } from '../../services/dataService.js';
import {
  KeyRound,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Sparkles
} from 'lucide-react';

export function PasswordRecoveryView({ onNavigate }) {
  // Step 1: Request code | Step 2: Verify OTP | Step 3: Set new password | Step 4: Done
  const [step, setStep] = useState(1);
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successInfo, setSuccessInfo] = useState(null);

  // Validate Indian mobile or email
  const isEmail = (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  const isIndianMobile = (val) => {
    const digits = val.replace(/\D/g, '');
    const local = digits.length > 10 ? digits.slice(-10) : digits;
    return /^[6789]\d{9}$/.test(local);
  };

  // Step 1: Request OTP
  const handleRequestCode = async (e) => {
    e?.preventDefault();
    setError(null);

    const clean = identifier.trim();
    if (!clean) {
      setError('Please enter your registered email address or 10-digit mobile number.');
      return;
    }

    if (!isEmail(clean) && !isIndianMobile(clean)) {
      setError('Please enter a valid email address or a 10-digit Indian mobile number (starting with 6, 7, 8, or 9).');
      return;
    }

    setLoading(true);
    try {
      const res = await dataService.requestPasswordRecovery(clean);
      setSuccessInfo(res);
      setStep(2);
    } catch (err) {
      setError(err.message || 'Failed to request recovery code.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    setError(null);

    if (!otp.trim()) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      await dataService.verifyPasswordRecoveryOTP(identifier, otp.trim());
      setStep(3);
    } catch (err) {
      setError(err.message || 'Invalid verification code.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Reset Password
  const handleResetPassword = async (e) => {
    e?.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please ensure both fields are identical.');
      return;
    }

    setLoading(true);
    try {
      await dataService.completePasswordReset(identifier, newPassword);
      setStep(4);
    } catch (err) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '540px', margin: '0 auto', padding: '1.5rem 1rem' }}>
      {/* Header Info */}
      <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.35rem 0.85rem',
          backgroundColor: '#eff6ff',
          color: '#1d4ed8',
          borderRadius: '9999px',
          fontSize: '0.75rem',
          fontWeight: 700,
          marginBottom: '0.75rem'
        }}>
          <KeyRound size={14} />
          FEATURE #256 • PHASE 1 (CATEGORY N)
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main, #0f172a)', margin: '0 0 0.5rem 0' }}>
          Password Recovery
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted, #64748b)', margin: 0 }}>
          Recover access to your Local Cricket account using your verified email or mobile number.
        </p>
      </div>

      {/* Wizard Progress Indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.5rem',
        padding: '0.75rem 1rem',
        backgroundColor: 'var(--card-bg, #ffffff)',
        borderRadius: '0.75rem',
        border: '1px solid var(--border-color, #e2e8f0)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        {[
          { num: 1, label: 'Identity' },
          { num: 2, label: 'OTP Code' },
          { num: 3, label: 'New Password' },
          { num: 4, label: 'Complete' }
        ].map((s) => (
          <div key={s.num} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 700,
              backgroundColor: step >= s.num ? 'var(--primary-color, #047857)' : '#f1f5f9',
              color: step >= s.num ? '#ffffff' : '#64748b',
              transition: 'all 0.2s ease'
            }}>
              {step > s.num ? '✓' : s.num}
            </div>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: step === s.num ? 700 : 500,
              color: step === s.num ? 'var(--text-main, #0f172a)' : '#94a3b8'
            }}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      <Card>
        {/* Error Notification */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.6rem',
            padding: '0.85rem 1rem',
            marginBottom: '1.25rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '0.5rem',
            color: '#b91c1c',
            fontSize: '0.85rem'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{error}</div>
          </div>
        )}

        {/* STEP 1: Request Code */}
        {step === 1 && (
          <form onSubmit={handleRequestCode}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main, #0f172a)', marginBottom: '0.4rem' }}>
                Email Address or Indian Mobile Number
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. admin@localcricket.com or 9876543210"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '0.7rem 0.9rem',
                    border: '1px solid var(--border-color, #cbd5e1)',
                    borderRadius: '0.5rem',
                    fontSize: '0.9rem',
                    color: 'var(--text-main, #0f172a)',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.4rem' }}>
                We will send an encrypted one-time recovery code to this contact.
              </div>
            </div>

            {/* Test Helper Chips */}
            <div style={{
              padding: '0.75rem',
              backgroundColor: '#f8fafc',
              borderRadius: '0.5rem',
              border: '1px solid #e2e8f0',
              marginBottom: '1.25rem'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>
                Quick Test Accounts (Click to Fill):
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setIdentifier('admin@localcricket.com')}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.5rem',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    color: '#0f172a'
                  }}
                >
                  admin@localcricket.com
                </button>
                <button
                  type="button"
                  onClick={() => setIdentifier('9876543210')}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.5rem',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    color: '#0f172a'
                  }}
                >
                  9876543210 (Mobile)
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
            >
              {loading ? 'Sending Code...' : 'Send Recovery Code'}
              <ArrowRight size={16} />
            </Button>
          </form>
        )}

        {/* STEP 2: Verify Code */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp}>
            <div style={{
              padding: '0.85rem',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '0.5rem',
              marginBottom: '1.25rem',
              fontSize: '0.825rem',
              color: '#166534'
            }}>
              <strong>Simulated OTP Sent!</strong> For testing, use the mock code{' '}
              <strong style={{ textDecoration: 'underline', color: '#14532d' }}>748291</strong>.
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main, #0f172a)', marginBottom: '0.4rem' }}>
                Enter 6-Digit Verification Code
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="748291"
                maxLength={6}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '1.25rem',
                  textAlign: 'center',
                  letterSpacing: '0.35rem',
                  fontWeight: 700,
                  border: '1px solid var(--border-color, #cbd5e1)',
                  borderRadius: '0.5rem',
                  boxSizing: 'border-box'
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setOtp('748291')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary-color, #047857)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  ⚡ Auto-fill Test Code (748291)
                </button>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  Change Contact
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
            >
              {loading ? 'Verifying...' : 'Verify Code & Proceed'}
            </Button>
          </form>
        )}

        {/* STEP 3: Set New Password */}
        {step === 3 && (
          <form onSubmit={handleResetPassword}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main, #0f172a)', marginBottom: '0.4rem' }}>
                New Password (minimum 8 characters)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new strong password"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '0.7rem 2.5rem 0.7rem 0.9rem',
                    border: '1px solid var(--border-color, #cbd5e1)',
                    borderRadius: '0.5rem',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748b',
                    padding: 0
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main, #0f172a)', marginBottom: '0.4rem' }}>
                Confirm New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '0.7rem 2.5rem 0.7rem 0.9rem',
                    border: '1px solid var(--border-color, #cbd5e1)',
                    borderRadius: '0.5rem',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748b',
                    padding: 0
                  }}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
            >
              {loading ? 'Updating Password...' : 'Save & Update Password'}
            </Button>
          </form>
        )}

        {/* STEP 4: Complete */}
        {step === 4 && (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: '#dcfce7',
              color: '#15803d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem auto'
            }}>
              <CheckCircle2 size={32} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main, #0f172a)', margin: '0 0 0.5rem 0' }}>
              Password Reset Successful!
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0 0 1.5rem 0' }}>
              Your account password has been updated in the mock security store. You can now log in using your new credentials.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <Button
                variant="primary"
                onClick={() => onNavigate && onNavigate('login')}
              >
                Proceed to Sign In
              </Button>
              <Button
                variant="secondary"
                onClick={() => onNavigate && onNavigate('category-n')}
              >
                Category N Hub
              </Button>
            </div>
          </div>
        )}

        {/* Footer Navigation Back to Login / Register */}
        {step < 4 && (
          <div style={{
            marginTop: '1.5rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border-color, #f1f5f9)',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.825rem'
          }}>
            <button
              type="button"
              onClick={() => onNavigate && onNavigate('login')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary-color, #047857)',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0
              }}
            >
              ← Back to Sign In (#255)
            </button>
            <button
              type="button"
              onClick={() => onNavigate && onNavigate('register')}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: 0
              }}
            >
              Need an Account? Register (#254)
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}

