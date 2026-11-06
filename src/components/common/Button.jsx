import React from 'react';

export function Button(props) {
  const {
    children,
    variant = 'primary',
    size = 'md',
    icon: Icon,
    onClick,
    className = '',
    disabled = false,
    type = 'button',
    style,
    ...rest
  } = props || {};

  const variantClass = {
    primary: 'btn-primary',
    outline: 'btn-outline',
    ghost: 'btn-ghost',
    secondary: 'btn-outline'
  }[variant] || 'btn-primary';

  const sizeClass = size === 'sm' ? 'btn-sm' : '';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`btn ${variantClass} ${sizeClass} ${className}`.trim()}
      style={style}
      {...rest}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  );
}
