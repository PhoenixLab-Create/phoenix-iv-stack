import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';

/**
 * These tests exist specifically to prove the fix: there must be no code
 * path in AuthService where a correct password alone results in an
 * access/refresh token being returned.
 */
describe('AuthService — MFA gap is closed', () => {
  let service: AuthService;
  let prisma: any;
  let jwt: any;
  let mfa: any;
  let audit: any;
  let config: any;

  const baseUser = {
    id: 'user-1',
    email: 'nurse.test@example.test',
    status: 'active',
    mfaEnrolled: false,
    mfaSecretEncrypted: 'SECRETBASE32',
  };

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      userRole: { findMany: jest.fn().mockResolvedValue([]) },
      session: {
        create: jest.fn().mockResolvedValue({ id: 'session-1' }),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    jwt = {
      signAsync: jest.fn().mockResolvedValue('signed.jwt.token'),
      verifyAsync: jest.fn(),
    };
    mfa = {
      verify: jest.fn(),
      getOtpAuthUrl: jest.fn().mockReturnValue('otpauth://totp/test'),
    };
    audit = { write: jest.fn().mockResolvedValue(undefined) };
    config = { get: jest.fn().mockReturnValue(undefined) };
    service = new AuthService(prisma, jwt, mfa, audit, config);

    jest.spyOn(argon2, 'verify').mockResolvedValue(true as any);
  });

  it('never returns an accessToken for an unenrolled user, even with the correct password', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...baseUser, mfaEnrolled: false });

    const result = await service.login(baseUser.email, 'correct-password');

    expect(result.status).toBe('MFA_ENROLLMENT_REQUIRED');
    expect(result.accessToken).toBeUndefined();
    expect(result.refreshToken).toBeUndefined();
    expect(result.enrollmentToken).toBeDefined();
  });

  it('never returns an accessToken for an enrolled user without a verified TOTP challenge', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...baseUser, mfaEnrolled: true });

    const result = await service.login(baseUser.email, 'correct-password');

    expect(result.status).toBe('MFA_REQUIRED');
    expect(result.accessToken).toBeUndefined();
    expect(result.mfaChallengeToken).toBeDefined();
  });

  it('fails closed if an account somehow has no MFA secret at all, rather than letting it through', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...baseUser, mfaEnrolled: false, mfaSecretEncrypted: null });

    await expect(service.login(baseUser.email, 'correct-password')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('confirmMfaEnrollment only issues tokens after a valid TOTP code, and flips mfaEnrolled', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: baseUser.id, scope: 'mfa_enrollment' });
    prisma.user.findUnique.mockResolvedValue({ ...baseUser, mfaEnrolled: false });
    mfa.verify.mockReturnValue(true);

    const result = await service.confirmMfaEnrollment('enrollment-token', '123456');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: baseUser.id },
      data: { mfaEnrolled: true },
    });
    expect(result.status).toBe('OK');
    expect(result.accessToken).toBeDefined();
  });

  it('confirmMfaEnrollment rejects an invalid TOTP code and issues no tokens', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: baseUser.id, scope: 'mfa_enrollment' });
    prisma.user.findUnique.mockResolvedValue({ ...baseUser, mfaEnrolled: false });
    mfa.verify.mockReturnValue(false);

    await expect(service.confirmMfaEnrollment('enrollment-token', '000000')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('confirmMfaEnrollment rejects a token from the wrong scope (e.g. a login MFA challenge token)', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: baseUser.id, scope: 'mfa_challenge' });

    await expect(service.confirmMfaEnrollment('some-token', '123456')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('AuthService — session-backed revocation (Sprint 6)', () => {
  let service: AuthService;
  let prisma: any;
  let jwt: any;
  let audit: any;
  let config: any;

  beforeEach(() => {
    prisma = {
      session: { create: jest.fn().mockResolvedValue({ id: 'session-1' }), findUnique: jest.fn(), update: jest.fn() },
      userRole: { findMany: jest.fn().mockResolvedValue([]) },
    };
    jwt = { signAsync: jest.fn().mockResolvedValue('signed.jwt.token'), verifyAsync: jest.fn() };
    audit = { write: jest.fn().mockResolvedValue(undefined) };
    config = { get: jest.fn().mockReturnValue(undefined) };
    service = new AuthService(prisma, jwt, {} as any, audit, config);
  });

  it('logout revokes the session row and audits it', async () => {
    await service.logout('session-1', 'user-1');
    expect(prisma.session.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { revokedAt: expect.any(Date) },
    });
    expect(audit.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.logout' }));
  });

  it('refresh rejects a token for a revoked session, even if the JWT itself is still validly signed', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', sid: 'session-1', scope: 'refresh' });
    prisma.session.findUnique.mockResolvedValue({ id: 'session-1', revokedAt: new Date(), expiresAt: new Date(Date.now() + 100000) });

    await expect(service.refresh('some-refresh-token')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refresh rejects a token for an expired session', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', sid: 'session-1', scope: 'refresh' });
    prisma.session.findUnique.mockResolvedValue({ id: 'session-1', revokedAt: null, expiresAt: new Date(Date.now() - 1000) });

    await expect(service.refresh('some-refresh-token')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refresh issues a new access token for a valid, unrevoked session', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', sid: 'session-1', scope: 'refresh' });
    prisma.session.findUnique.mockResolvedValue({ id: 'session-1', revokedAt: null, expiresAt: new Date(Date.now() + 100000) });

    const result = await service.refresh('some-refresh-token');
    expect(result.status).toBe('OK');
    expect(result.accessToken).toBeDefined();
  });
});
