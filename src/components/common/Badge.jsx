import React from 'react';

export function Badge(props) {
  const {
    children,
    variant = 'neutral',
    className = '',
    style,
    ...rest
  } = props || {};

  const variantClass = {
    live: 'badge-live',
    upcoming: 'badge-upcoming',
    completed: 'badge-completed',
    primary: 'badge-primary',
    neutral: 'badge-neutral',
    success: 'badge-primary',
    warning: 'badge-upcoming',
    danger: 'badge-live',
    default: 'badge-neutral'
  }[variant] || 'badge-neutral';

  return (
    <span
      className={`badge ${variantClass} ${className}`.trim()}
      style={style}
      {...rest}
    >
      {variant === 'live' && <span className="badge-live-pulse" />}
      {children}
    </span>
  );
}
