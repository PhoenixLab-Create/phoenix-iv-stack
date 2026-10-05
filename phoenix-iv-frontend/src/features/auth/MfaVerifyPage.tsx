import { useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';

export default function MfaVerifyPage() {
  const { error, busy, verifyMfa, clearError } = useAuth();
  const [code, setCode] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    clearError();
    void verifyMfa(code);
  }

  return (
    <div style={{ maxWidth: 420, margin: '3rem auto', padding: '0 var(--space-4)' }}>
      <h1>Enter your authenticator code</h1>
      <p style={{ color: 'var(--ink-soft)' }}>
        Open your authenticator app and enter the current 6-digit code for this account.
      </p>
      <form onSubmit={handleSubmit} className="card" noValidate>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label htmlFor="totp">Authentication code</label>
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
          {busy ? 'Verifying…' : 'Verify and continue'}
        </button>
      </form>
    </div>
  );
}
