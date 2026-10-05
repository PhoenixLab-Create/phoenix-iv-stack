import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import MfaEnrollPage from './MfaEnrollPage';
import MfaVerifyPage from './MfaVerifyPage';

export default function LoginPage() {
  const { phase, error, busy, login, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (phase.kind === 'authenticated') return <Navigate to="/" replace />;
  if (phase.kind === 'mfa_required') return <MfaVerifyPage />;
  if (phase.kind === 'mfa_enrollment_required') return <MfaEnrollPage />;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    clearError();
    void login(email, password);
  }

  return (
    <div style={{ maxWidth: 420, margin: '3rem auto', padding: '0 var(--space-4)' }}>
      <h1>Log in</h1>
      <p style={{ color: 'var(--ink-soft)' }}>
        Staff sign-in. Multi-factor authentication is required on every account — there is no way to reach a
        clinical record with a password alone.
      </p>
      <form onSubmit={handleSubmit} className="card" noValidate>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label htmlFor="email">Work email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="field-error" style={{ marginBottom: 'var(--space-4)' }}>
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary" disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Signing in…' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
