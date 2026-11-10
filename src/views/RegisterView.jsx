import React, { useState } from 'react';
import {
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Info
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { dataService, authBackend } from '../services/dataService';

export function RegisterView(props) {
  const { onNavigate = () => {} } = props || {};
  // Form input states
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    mobileNumber: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false
  })

  // Password visibility toggles
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Validation and status states
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState(null)
  const [registeredUser, setRegisteredUser] = useState(null)
  const [showLoginNotice, setShowLoginNotice] = useState(false)

  // Input change handler
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    const fieldValue = type === 'checkbox' ? checked : value

    setFormData((prev) => ({
      ...prev,
      [name]: fieldValue
    }))

    // Clear field-specific error as user types if already touched
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  // Blur handler for validating on field exit
  const handleBlur = (e) => {
    const { name } = e.target
    setTouched((prev) => ({ ...prev, [name]: true }))
    validateField(name, formData[name])
  }

  // Field validator helper
  const isIndianMobile = (val) => {
    if (!val) return false
    const cleaned = val.replace(/[\s\-\(\)]/g, '')
    return /^(?:(?:\+|00)91|0)?[6789]\d{9}$/.test(cleaned)
  }

  const validateField = (fieldName, value) => {
    let error = null

    switch (fieldName) {
      case 'fullName':
        if (!value || !value.trim()) {
          error = 'Full name is required.'
        } else if (value.trim().length < 2) {
          error = 'Full name must be at least 2 characters.'
        }
        break

      case 'email':
        if (!value || !value.trim()) {
          error = 'Email address is required.'
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
          error = 'Please enter a valid email address (e.g. name@domain.com).'
        }
        break

      case 'mobileNumber':
        if (!value || !value.trim()) {
          error = 'Mobile number is required.'
        } else if (!isIndianMobile(value)) {
          error = 'Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9 (e.g. 9876543210 or +91 98765 43210).'
        }
        break

      case 'password':
        if (!value) {
          error = 'Password is required.'
        } else if (value.length < 8) {
          error = 'Password must be at least 8 characters long.'
        }
        break

      case 'confirmPassword':
        if (!value) {
          error = 'Please confirm your password.'
        } else if (value !== formData.password) {
          error = 'Passwords do not match.'
        }
        break

      case 'agreeTerms':
        if (!value) {
          error = 'You must accept the terms and conditions to register.'
        }
        break

      default:
        break
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

  // Form-wide validator
  const validateForm = () => {
    const newErrors = {}

    if (!formData.fullName || !formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required.'
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = 'Full name must be at least 2 characters.'
    }

    if (!formData.email || !formData.email.trim()) {
      newErrors.email = 'Email address is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address (e.g. name@domain.com).'
    }

    if (!formData.mobileNumber || !formData.mobileNumber.trim()) {
      newErrors.mobileNumber = 'Mobile number is required.'
    } else if (!isIndianMobile(formData.mobileNumber)) {
      newErrors.mobileNumber = 'Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9 (e.g. 9876543210 or +91 98765 43210).'
    }

    if (!formData.password) {
      newErrors.password = 'Password is required.'
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long.'
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password.'
    } else if (formData.confirmPassword !== formData.password) {
      newErrors.confirmPassword = 'Passwords do not match.'
    }

    if (!formData.agreeTerms) {
      newErrors.agreeTerms = 'You must accept the terms and conditions to register.'
    }

    setErrors(newErrors)
    setTouched({
      fullName: true,
      email: true,
      mobileNumber: true,
      password: true,
      confirmPassword: true,
      agreeTerms: true
    })

    return Object.keys(newErrors).length === 0
  }

  // Submit handler
  const handleSubmit = async (e) => {
    e.preventDefault()
    setApiError(null)

    if (!validateForm()) {
      return
    }

    try {
      setIsSubmitting(true)
      const userPayload = {
        full_name: formData.fullName,
        email: formData.email,
        mobile_number: formData.mobileNumber,
        password: formData.password
      }

      // Delegate through data access layer facade
      const result = await dataService.registerUser(userPayload)
      setRegisteredUser(result)
    } catch (err) {
      setApiError(err.message || 'Registration failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Reset form to register another user
  const handleReset = () => {
    setFormData({
      fullName: '',
      email: '',
      mobileNumber: '',
      password: '',
      confirmPassword: '',
      agreeTerms: false
    })
    setErrors({})
    setTouched({})
    setRegisteredUser(null)
    setApiError(null)
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
            Feature #254 — User Registration
          </span>
        </div>
        <h1 style={{ fontSize: '1.5rem', color: '#FFFFFF', marginBottom: '0.25rem' }}>
          Create an Account
        </h1>
        <p style={{ color: '#CBD5E1', fontSize: '0.85rem' }}>
          Register as a player, scorer, team manager, or local cricket enthusiast.
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
              <strong>Real account:</strong> Your account is saved in the Local Cricket database. We will email you a link to confirm your email address.
            </>
          ) : (
            <>
              <strong>Frontend-Only Mock State:</strong> No real database or Supabase instance is connected. Submissions are processed through the replaceable mock data service layer.
            </>
          )}
        </span>
      </div>

      {/* SUCCESS STATE */}
      {registeredUser ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-primary-light)',
                color: 'var(--color-primary-dark)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <CheckCircle2 size={32} />
            </div>

            <div>
              <h2 style={{ fontSize: '1.35rem', marginBottom: '0.35rem' }}>Registration Successful!</h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', maxWidth: '440px' }}>
                {registeredUser.needs_email_confirmation
                  ? `Your account has been created. We have sent a confirmation link to ${registeredUser.email}. Open it, then sign in.`
                  : authBackend === 'supabase'
                    ? 'Your account has been created. You can now sign in.'
                    : 'Your user registration profile has been validated and recorded by the mock service layer.'}
              </p>
            </div>

            {/* Profile summary card */}
            <div
              style={{
                width: '100%',
                backgroundColor: 'var(--color-border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                textAlign: 'left',
                fontSize: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Assigned User ID:</span>
                <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{registeredUser.id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Full Name:</span>
                <span style={{ fontWeight: 600 }}>{registeredUser.full_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Email Address:</span>
                <span style={{ fontWeight: 600 }}>{registeredUser.email}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Mobile Number:</span>
                <span style={{ fontWeight: 600 }}>{registeredUser.mobile_number}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Recorded At:</span>
                <span style={{ color: 'var(--color-text-muted)' }}>{new Date(registeredUser.created_at).toLocaleString()}</span>
              </div>
            </div>

            {/* Next Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center', width: '100%', marginTop: '0.5rem' }}>
              <Button variant="primary" onClick={() => onNavigate && onNavigate('login')}>
                Sign In to Account (Feature #255)
              </Button>
              <Button variant="outline" onClick={handleReset}>
                Register Another User
              </Button>
              <Button variant="secondary" onClick={() => onNavigate && onNavigate('category-n')}>
                Category N Hub (#254–270)
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        /* REGISTRATION FORM */
        <Card>
          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            {/* Global API / Mock Error Banner */}
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

            {/* 1. Full Name */}
            <div className="form-group">
              <label htmlFor="fullName" className="form-label">
                Full Name <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <div className="input-wrapper">
                <User size={18} className="input-icon" />
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  placeholder="e.g. Sachin Tendulkar"
                  value={formData.fullName}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`form-input ${touched.fullName && errors.fullName ? 'has-error' : ''}`}
                  disabled={isSubmitting}
                  autoComplete="name"
                />
              </div>
              {touched.fullName && errors.fullName && (
                <span className="form-error-msg">
                  <AlertCircle size={13} />
                  {errors.fullName}
                </span>
              )}
            </div>

            {/* 2. Email Address */}
            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Email Address <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <div className="input-wrapper">
                <Mail size={18} className="input-icon" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="e.g. player@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`form-input ${touched.email && errors.email ? 'has-error' : ''}`}
                  disabled={isSubmitting}
                  autoComplete="email"
                />
              </div>
              {touched.email && errors.email && (
                <span className="form-error-msg">
                  <AlertCircle size={13} />
                  {errors.email}
                </span>
              )}
            </div>

            {/* 3. Mobile Number */}
            <div className="form-group">
              <label htmlFor="mobileNumber" className="form-label">
                Mobile Number <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <div className="input-wrapper">
                <Phone size={18} className="input-icon" />
                <input
                  id="mobileNumber"
                  name="mobileNumber"
                  type="tel"
                  placeholder="e.g. +91 98765 43210"
                  value={formData.mobileNumber}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`form-input ${touched.mobileNumber && errors.mobileNumber ? 'has-error' : ''}`}
                  disabled={isSubmitting}
                  autoComplete="tel"
                />
              </div>
              {touched.mobileNumber && errors.mobileNumber && (
                <span className="form-error-msg">
                  <AlertCircle size={13} />
                  {errors.mobileNumber}
                </span>
              )}
            </div>

            {/* 4. Password */}
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
                  placeholder="Min. 8 characters"
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`form-input ${touched.password && errors.password ? 'has-error' : ''}`}
                  disabled={isSubmitting}
                  autoComplete="new-password"
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

            {/* 5. Confirm Password */}
            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">
                Confirm Password <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <div className="input-wrapper">
                <Lock size={18} className="input-icon" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Re-enter password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`form-input ${touched.confirmPassword && errors.confirmPassword ? 'has-error' : ''}`}
                  disabled={isSubmitting}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="password-toggle-btn"
                  aria-label={showConfirmPassword ? 'Hide confirmed password' : 'Show confirmed password'}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {touched.confirmPassword && errors.confirmPassword && (
                <span className="form-error-msg">
                  <AlertCircle size={13} />
                  {errors.confirmPassword}
                </span>
              )}
            </div>

            {/* 6. Terms and Conditions Acceptance */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.25rem' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input
                  id="agreeTerms"
                  name="agreeTerms"
                  type="checkbox"
                  checked={formData.agreeTerms}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  style={{ marginTop: '0.2rem', accentColor: 'var(--color-primary)', width: '16px', height: '16px' }}
                />
                <span style={{ color: 'var(--color-text-main)', lineHeight: 1.4 }}>
                  I agree to the <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Terms of Service</span> and <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Cricket League Code of Conduct</span>.
                </span>
              </label>
              {touched.agreeTerms && errors.agreeTerms && (
                <span className="form-error-msg">
                  <AlertCircle size={13} />
                  {errors.agreeTerms}
                </span>
              )}
            </div>

            {/* 7. Submit Button */}
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem', fontSize: '0.95rem' }}
            >
              {isSubmitting ? (
                <>
                  <span className="button-spinner" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Complete Registration</span>
                  <ArrowRight size={16} />
                </>
              )}
            </Button>

            {/* 8. Link to Login Page (Feature #255) */}
            <div style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              Already registered?{' '}
              <button
                type="button"
                onClick={() => onNavigate && onNavigate('login')}
                style={{
                  color: 'var(--color-primary)',
                  fontWeight: 600,
                  textDecoration: 'underline',
                  padding: 0
                }}
              >
                Sign In here (Feature #255)
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Component Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
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
      ` }} />
    </div>
  )
}

