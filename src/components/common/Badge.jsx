import React from 'react';

export function Badge({ children, variant = 'neutral', className = '' }) {
  const variantClass = {
    live: 'badge-live',
    upcoming: 'badge-upcoming',
    completed: 'badge-completed',
    primary: 'badge-primary',
    neutral: 'badge-neutral'
  }[variant] || 'badge-neutral'

  return (
    <span className={`badge ${variantClass} ${className}`}>
      {variant === 'live' && <span className="badge-live-pulse" />}
      {children}
    </span>
  )
}

