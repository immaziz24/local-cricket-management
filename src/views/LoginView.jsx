import React, { useState, useEffect } from 'react';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  LogOut,
  AlertCircle,
  CheckCircle2,
  Info,
  ShieldCheck,
  UserPlus,
  KeyRound
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { dataService, authBackend } from '../services/dataService';

export function LoginView(props) {
  const { onNavigate = () => {} } = props || {};
  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
    rememberMe: false
  })

  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState(null)
  const [sessionUser, setSessionUser] = useState(null)
  const [isLoadingSession, setIsLoadingSession] = useState(true)

  // Check for active session on load
  useEffect(() => {
    let mounted = true
    async function loadSession() {
      try {
        const user = await dataService.getCurrentUser()
        if (mounted && user) {
          setSessionUser(user)
        }
      } catch (err) {
        // ignore
      } finally {
        if (mounted) setIsLoadingSession(false)
      }
    }
    loadSession()
    return () => { mounted = false }
  }, [])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    const val = type === 'checkbox' ? checked : value

    setFormData((prev) => ({
      ...prev,
      [name]: val
    }))

    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
    if (apiError) setApiError(null)
  }

  const handleBlur = (e) => {
    const { name } = e.target
    setTouched((prev) => ({ ...prev, [name]: true }))
    validateField(name, formData[name])
  }

  const validateField = (fieldName, value) => {
    let error = null
    if (fieldName === 'identifier') {
      if (!value || !value.trim()) {
        error = 'Email or mobile number is required.'
      }
    } else if (fieldName === 'password') {
      if (!value) {
        error = 'Password is required.'
      }
    }

    if (error) {
      setErrors((prev) => ({ ...prev, [fieldName]: error }))
      return false
    } else {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[fieldName]
        return next
      })
      return true
    }
  }

  const validateForm = () => {
    const newErrors = {}
    if (!formData.identifier || !formData.identifier.trim()) {
      newErrors.identifier = 'Email or mobile number is required.'
    }
    if (!formData.password) {
      newErrors.password = 'Password is required.'
    }

    setErrors(newErrors)
    setTouched({ identifier: true, password: true })
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setApiError(null)

    if (!validateForm()) return

    try {
      setIsSubmitting(true)
      const user = await dataService.loginUser({
        identifier: formData.identifier,
        password: formData.password,
        rememberMe: formData.rememberMe
      })
      setSessionUser(user)
    } catch (err) {
      setApiError(err.message || 'Login failed. Please verify your credentials.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLogout = async () => {
    try {
      await dataService.logoutUser()
      setSessionUser(null)
      setFormData({
        identifier: '',
        password: '',
        rememberMe: false
      })
      setErrors({})
      setTouched({})
    } catch (err) {
      // ignore
    }
  }

  const fillQuickCredential = (email, pass) => {
    setFormData({
      identifier: email,
      password: pass,
      rememberMe: false
    })
    setErrors({})
    setApiError(null)
  }

  if (isLoadingSession) {
    return (
      <div style={{ maxWidth: '580px', margin: '2rem auto', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        Loading authentication state...
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '580px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Category N Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0B132B 0%, #1C2541 100%)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem',
          color: '#FFFFFF',
          boxShadow: 'var(--shadow-md)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
          <Badge variant="primary">Phase 1 • Category N</Badge>
          <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
            Feature #255 — User Login
          </span>
        </div>
        <h1 style={{ fontSize: '1.5rem', color: '#FFFFFF', marginBottom: '0.25rem' }}>
          {sessionUser ? 'Account Dashboard' : 'Sign In to Your Account'}
        </h1>
        <p style={{ color: '#CBD5E1', fontSize: '0.85rem' }}>
          {sessionUser
            ? `Welcome back, ${sessionUser.full_name}. You are securely authenticated.`
            : 'Access match scores, administrative controls, and team registrations.'}
        </p>
      </div>

      {/* Mock notice disclaimer */}
      <div
        style={{
          padding: '0.75rem 1rem',
          backgroundColor: '#EFF6FF',
          border: '1px solid #BFDBFE',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.8rem',
          color: '#1E40AF',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem'
        }}
      >
        <Info size={18} style={{ flexShrink: 0 }} />
        <span>
          {authBackend === 'supabase' ? (
            <>
              <strong>Secure sign-in:</strong> Accounts are stored in the Local Cricket database. Sign in with the email address you registered with.
            </>
          ) : (
            <>
              <strong>Frontend-Only Mock Authentication:</strong> Auth state is managed via the replaceable mock data service layer (`dataService.loginUser`). Add Supabase settings to `.env` to use real accounts.
            </>
          )}
        </span>
      </div>

      {/* AUTHENTICATED STATE */}
      {sessionUser ? (
        <Card>
          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-primary-light)',
                  color: 'var(--color-primary-dark)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '1.35rem'
                }}
              >
                {sessionUser.full_name?.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '1.2rem', margin: 0 }}>{sessionUser.full_name}</h2>
                  <Badge variant="primary">{sessionUser.role}</Badge>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                  {sessionUser.email} • {sessionUser.mobile_number}
                </div>
              </div>
            </div>

            {/* Session Card Info */}
            <div
              style={{
                backgroundColor: 'var(--color-border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                fontSize: '0.82rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>User Identifier:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{sessionUser.id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Session Security Token:</span>
                <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--color-primary-dark)' }}>
                  {authBackend === 'supabase' ? 'Active (Supabase Auth)' : `${sessionUser.token?.slice(0, 26)}...`}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Authenticated At:</span>
                <span>{new Date(sessionUser.logged_in_at).toLocaleTimeString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Persistence Mode:</span>
                <span>{sessionUser.remember_me ? 'Remembered on this device' : 'Active session'}</span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Button variant="outline" onClick={handleLogout} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <LogOut size={16} />
                <span>Sign Out</span>
              </Button>
              <Button variant="primary" onClick={() => onNavigate('dashboard')}>
                Go to Match Center
              </Button>
              <Button variant="secondary" onClick={() => onNavigate('category-n')}>
                Category N Hub (#254–270)
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        /* LOGIN FORM */
        <Card>
          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            {/* Global API / Auth Error Banner */}
            {apiError && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: 'var(--color-danger-light)',
                  border: '1px solid #FCA5A5',
                  borderRadius: 'var(--radius-md)',
                  color: '#991B1B',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{apiError}</span>
              </div>
            )}

            {/* 1. Identifier */}
            <div className="form-group">
              <label htmlFor="identifier" className="form-label">
                Email Address or 10-Digit Mobile <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <div className="input-wrapper">
                <User size={18} className="input-icon" />
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  placeholder={authBackend === 'supabase' ? 'e.g. name@example.com' : 'e.g. admin@localcricket.com or 9876543210'}
                  value={formData.identifier}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`form-input ${touched.identifier && errors.identifier ? 'has-error' : ''}`}
                  disabled={isSubmitting}
                  autoComplete="username"
                />
              </div>
              {touched.identifier && errors.identifier && (
                <span className="form-error-msg">
                  <AlertCircle size={13} />
                  {errors.identifier}
                </span>
              )}
            </div>

            {/* 2. Password */}
            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Password <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <div className="input-wrapper">
                <Lock size={18} className="input-icon" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`form-input ${touched.password && errors.password ? 'has-error' : ''}`}
                  disabled={isSubmitting}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="password-toggle-btn"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {touched.password && errors.password && (
                <span className="form-error-msg">
                  <AlertCircle size={13} />
                  {errors.password}
                </span>
              )}
            </div>

            {/* 3. Remember Me & Forgot Password */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  name="rememberMe"
                  type="checkbox"
                  checked={formData.rememberMe}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  style={{ accentColor: 'var(--color-primary)' }}
                />
                <span>Remember this device</span>
              </label>

              <button
                type="button"
                onClick={() => onNavigate && onNavigate('password-recovery')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-primary)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Forgot password? (#256)
              </button>
            </div>

            {/* 4. Submit Button */}
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              style={{ width: '100%', padding: '0.75rem', marginTop: '0.25rem', fontSize: '0.95rem' }}
            >
              {isSubmitting ? (
                <>
                  <span className="button-spinner" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  <span>Sign In</span>
                </>
              )}
            </Button>

            {/* Quick Credentials Helper for Reviewers (mock mode only) */}
            {authBackend === 'mock' && (
            <div
              style={{
                marginTop: '0.5rem',
                padding: '0.75rem',
                backgroundColor: 'var(--color-border-subtle)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.78rem',
                color: 'var(--color-text-muted)'
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--color-text-main)', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <KeyRound size={13} color="var(--color-primary)" />
                <span>Test Mock Credentials (Click to fill):</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => fillQuickCredential('admin@localcricket.com', 'Password123!')}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--color-border)',
                    padding: '0.25rem 0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  Admin: <strong>admin@localcricket.com</strong>
                </button>
                <button
                  type="button"
                  onClick={() => fillQuickCredential('9876543210', 'Password123!')}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--color-border)',
                    padding: '0.25rem 0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  Mobile: <strong>9876543210</strong>
                </button>
                <button
                  type="button"
                  onClick={() => fillQuickCredential('scorer@localcricket.com', 'Password123!')}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--color-border)',
                    padding: '0.25rem 0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  Scorer: <strong>scorer@localcricket.com</strong>
                </button>
              </div>
            </div>
            )}

            {/* Navigation back to Register (Feature #254) */}
            <div style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => onNavigate && onNavigate('register')}
                style={{
                  color: 'var(--color-primary)',
                  fontWeight: 600,
                  textDecoration: 'underline',
                  padding: 0
                }}
              >
                Register here (Feature #254)
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Component Styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .form-label {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--color-text-main);
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: 0.85rem;
          color: var(--color-text-light);
          pointer-events: none;
        }

        .form-input {
          width: 100%;
          padding: 0.65rem 0.85rem 0.65rem 2.5rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          font-size: 0.875rem;
          font-family: inherit;
          color: var(--color-text-main);
          background-color: #FFFFFF;
          transition: var(--transition);
        }

        .form-input:focus {
          outline: none;
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.15);
        }

        .form-input.has-error {
          border-color: var(--color-danger);
          background-color: #FFF5F5;
        }

        .form-input.has-error:focus {
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
        }

        .password-toggle-btn {
          position: absolute;
          right: 0.75rem;
          color: var(--color-text-muted);
          padding: 0.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-sm);
        }

        .password-toggle-btn:hover {
          color: var(--color-text-main);
        }

        .form-error-msg {
          font-size: 0.75rem;
          color: var(--color-danger);
          display: flex;
          align-items: center;
          gap: 0.3rem;
          font-weight: 500;
          margin-top: 0.15rem;
        }

        .button-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: #FFFFFF;
          border-radius: 50%;
          animation: btnSpin 0.7s linear infinite;
        }

        @keyframes btnSpin {
          to { transform: rotate(360deg); }
        }
      `
      }} />
    </div>
  )
}

