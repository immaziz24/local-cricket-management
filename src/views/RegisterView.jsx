import React from 'react';
import { EmailAuth } from './auth/EmailAuth';

export function RegisterView({ onNavigate }) {
  return <EmailAuth register onNavigate={onNavigate} />;
}
