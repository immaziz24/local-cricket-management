import React, { useState } from 'react';
import { Button } from '../../components/common/Button.jsx';
import { validateDecline } from './officialsExtra.js';

/** #361 Accept or decline an invitation. Accepting records a written confirmation; declining can give a reason. */
export function AssignmentResponse({ onRespond }) {
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const problem = validateDecline(reason);
  if (declining) {
    return (
      <span style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)"
          style={{ padding: '0.3rem 0.45rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.8rem', minWidth: 150 }} />
        <Button size="sm" variant="secondary" disabled={!!problem} onClick={() => onRespond(false, reason.trim())}>Confirm decline</Button>
        <Button size="sm" variant="secondary" onClick={() => setDeclining(false)}>Back</Button>
      </span>
    );
  }
  return (
    <>
      <Button size="sm" variant="primary" onClick={() => onRespond(true)}>Accept</Button>
      <Button size="sm" variant="secondary" onClick={() => setDeclining(true)}>Decline</Button>
    </>
  );
}
export default AssignmentResponse;
