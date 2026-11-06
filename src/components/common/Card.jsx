import React from 'react';

export function Card(props) {
  const {
    children,
    title,
    subtitle,
    action,
    className = '',
    style,
    ...rest
  } = props || {};

  const hasHeader = Boolean(title || action);

  return (
    <div className={`card ${className}`.trim()} style={style} {...rest}>
      {hasHeader && (
        <div className="card-header">
          <div>
            {title && <h3 className="card-title">{title}</h3>}
            {subtitle && <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
