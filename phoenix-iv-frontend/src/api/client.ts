/**
 * Thin fetch wrapper around the Phoenix IV backend.
 *
 * Token storage: the access token lives in memory only (a module-level
 * variable), never localStorage/sessionStorage — this is a PHI-adjacent
 * clinical system and an XSS-readable long-lived token is exactly the kind
 * of risk the backend's session-revocation work (Sprint 6) was built to
 * contain. The refresh token is likewise kept in memory; losing it on a
 * hard reload means a re-login, which is the correct tradeoff here.
 *
 * On a 401, this client tries exactly one silent refresh via
 * POST /auth/refresh, then retries the original request once. If that also
 * fails, it clears tokens and notifies subscribers so the app can route to
 * /login — it never loops.
 */

let accessToken: string | null = null;
let refreshToken: string | null = null;

type SessionListener = () => void;
const sessionExpiredListeners = new Set<SessionListener>();

export function setTokens(tokens: { accessToken: string; refreshToken: string }) {
  accessToken = tokens.accessToken;
  refreshToken = tokens.refreshToken;
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
}

export function hasSession() {
  return accessToken !== null;
}

export function onSessionExpired(listener: SessionListener) {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

function notifySessionExpired() {
  clearTokens();
  for (const l of sessionExpiredListeners) l();
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function messageFromBody(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const m = (body as { message: unknown }).message;
    if (typeof m === 'string') return m;
    if (Array.isArray(m)) return m.join(' ');
  }
  return fallback;
}

async function doRefresh(): Promise<boolean> {
  if (!refreshToken) return false;
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return false;
  const body = (await parseBody(res)) as { status: string; accessToken?: string };
  if (body.status === 'OK' && body.accessToken) {
    accessToken = body.accessToken;
    return true;
  }
  return false;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Skip the Authorization header — only auth/login and patient-session calls need this. */
  anonymous?: boolean;
}

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const run = async (): Promise<Response> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (!opts.anonymous && accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    return fetch(`/api${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  };

  let res = await run();

  if (res.status === 401 && !opts.anonymous && refreshToken) {
    const refreshed = await doRefresh();
    if (refreshed) {
      res = await run();
    } else {
      notifySessionExpired();
    }
  } else if (res.status === 401 && !opts.anonymous) {
    notifySessionExpired();
  }

  if (!res.ok) {
    const body = await parseBody(res);
    throw new ApiError(res.status, messageFromBody(body, `Request failed (${res.status})`), body);
  }

  if (res.status === 204) return undefined as T;
  return (await parseBody(res)) as T;
}

/**
 * For the patient-session-authenticated endpoints (intake/consent submitted
 * by a patient). PatientSessionGuard reads this exactly like staff auth —
 * a standard `Authorization: Bearer <token>` header — it just validates the
 * token as a single-visit session rather than a user JWT.
 */
export async function patientSessionFetch<T>(
  path: string,
  sessionToken: string,
  opts: RequestOptions = {},
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const body = await parseBody(res);
    throw new ApiError(res.status, messageFromBody(body, `Request failed (${res.status})`), body);
  }
  return (await parseBody(res)) as T;
}
