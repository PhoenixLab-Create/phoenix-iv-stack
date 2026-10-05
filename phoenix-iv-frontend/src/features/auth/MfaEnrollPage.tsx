import { useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';

/**
 * No QR-rendering library is bundled here (avoiding an unverified new
 * dependency rather than risk a broken one in a sandbox with no registry
 * access). Most authenticator apps accept the otpauth:// URL pasted
 * directly, or its secret typed manually, so both are offered — a real
 * deployment can add a QR image (e.g. an immediate follow-up) once it can
 * install and verify a QR library against a live build.
 */
export default function MfaEnrollPage() {
  const { phase, error, busy, confirmEnrollment, clearError } = useAuth();
  const [code, setCode] = useState('');

  if (phase.kind !== 'mfa_enrollment_required') return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    clearError();
    void confirmEnrollment(code);
  }

  return (
    <div style={{ maxWidth: 480, margin: '3rem auto', padding: '0 var(--space-4)' }}>
      <h1>Set up multi-factor authentication</h1>
      <p style={{ color: 'var(--ink-soft)' }}>
        This account hasn't enrolled an authenticator app yet. MFA is required for every staff account — there
        is no way to get a session without completing this step.
      </p>
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <h2>1. Add this account to your authenticator app</h2>
        <p>
          Paste this link into an authenticator app that accepts <code>otpauth://</code> setup links (most do),
          or copy the secret from it manually if your app asks for one instead.
        </p>
        <p className="mono" style={{ wordBreak: 'break-all', background: 'var(--paper)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)' }}>
          {phase.otpAuthUrl}
        </p>
      </div>
      <form onSubmit={handleSubmit} className="card" noValidate>
        <h2>2. Confirm it worked</h2>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label htmlFor="totp">Current 6-digit code</label>
          <input
            id="totp"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            minLength={6}
            maxLength={6}
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="field-error" style={{ marginBottom: 'var(--space-4)' }}>
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary" disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Confirming…' : 'Confirm and finish setup'}
        </button>
      </form>
    </div>
  );
}
