import React from 'react';
import { EmailAuth } from './auth/EmailAuth';

export function LoginView({ onNavigate }) {
  return <EmailAuth onNavigate={onNavigate} />;
}
