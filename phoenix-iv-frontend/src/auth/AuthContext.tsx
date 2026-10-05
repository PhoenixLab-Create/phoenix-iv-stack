import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AuthApi } from '../api/endpoints';
import { clearTokens, hasSession, onSessionExpired, setTokens } from '../api/client';
import type { LoginResult } from '../api/types';

/**
 * Staff authentication state machine, mirroring AuthService.login()'s
 * three possible outcomes exactly:
 *  - MFA_REQUIRED: password was correct, now needs a TOTP code from an
 *    already-enrolled authenticator app.
 *  - MFA_ENROLLMENT_REQUIRED: password was correct but this account has
 *    never enrolled MFA; the QR/otpAuthUrl must be scanned and a code
 *    entered before any session is issued.
 *  - OK: tokens issued. There is no other way to reach an authenticated
 *    state — this mirrors the backend's "password alone never issues a
 *    token" guarantee, so the UI can't accidentally invent a bypass.
 */
type AuthPhase =
  | { kind: 'anonymous' }
  | { kind: 'mfa_required'; mfaChallengeToken: string }
  | { kind: 'mfa_enrollment_required'; enrollmentToken: string; otpAuthUrl: string }
  | { kind: 'authenticated' };

interface AuthContextValue {
  phase: AuthPhase;
  error: string | null;
  busy: boolean;
  login: (email: string, password: string) => Promise<void>;
  verifyMfa: (totpCode: string) => Promise<void>;
  confirmEnrollment: (totpCode: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function applyLoginResult(result: LoginResult): AuthPhase {
  if (result.status === 'OK') {
    setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
    return { kind: 'authenticated' };
  }
  if (result.status === 'MFA_REQUIRED') {
    return { kind: 'mfa_required', mfaChallengeToken: result.mfaChallengeToken };
  }
  return {
    kind: 'mfa_enrollment_required',
    enrollmentToken: result.enrollmentToken,
    otpAuthUrl: result.otpAuthUrl,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<AuthPhase>(
    hasSession() ? { kind: 'authenticated' } : { kind: 'anonymous' },
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return onSessionExpired(() => {
      setPhase({ kind: 'anonymous' });
      setError('Your session ended. Please log in again.');
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await AuthApi.login(email, password);
      setPhase(applyLoginResult(result));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed.');
    } finally {
      setBusy(false);
    }
  }, []);

  const verifyMfa = useCallback(
    async (totpCode: string) => {
      if (phase.kind !== 'mfa_required') return;
      setBusy(true);
      setError(null);
      try {
        const result = await AuthApi.verifyMfa(phase.mfaChallengeToken, totpCode);
        setPhase(applyLoginResult(result));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Verification failed.');
      } finally {
        setBusy(false);
      }
    },
    [phase],
  );

  const confirmEnrollment = useCallback(
    async (totpCode: string) => {
      if (phase.kind !== 'mfa_enrollment_required') return;
      setBusy(true);
      setError(null);
      try {
        const result = await AuthApi.confirmEnrollment(phase.enrollmentToken, totpCode);
        setPhase(applyLoginResult(result));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Enrollment failed.');
      } finally {
        setBusy(false);
      }
    },
    [phase],
  );

  const logout = useCallback(async () => {
    try {
      await AuthApi.logout();
    } catch {
      // Logout should still clear local state even if the server call
      // fails (e.g. the session was already revoked) — never trap a
      // clinician in a stale-but-can't-leave session.
    }
    clearTokens();
    setPhase({ kind: 'anonymous' });
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(
    () => ({ phase, error, busy, login, verifyMfa, confirmEnrollment, logout, clearError }),
    [phase, error, busy, login, verifyMfa, confirmEnrollment, logout, clearError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider');
  return ctx;
}
