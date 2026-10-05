import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { PrismaService } from '../config/prisma.service';
import { MfaService } from './mfa.service';
import { AuditService } from '../common/audit/audit.service';

interface LoginResult {
  status: 'MFA_REQUIRED' | 'MFA_ENROLLMENT_REQUIRED' | 'OK';
  mfaChallengeToken?: string;
  enrollmentToken?: string;
  otpAuthUrl?: string; // only returned alongside MFA_ENROLLMENT_REQUIRED, so the client can render a QR code
  accessToken?: string;
  refreshToken?: string;
}

/**
 * MFA is mandatory for all staff (architecture review §5.3), enforced with no
 * exceptions: there is exactly one way to reach issueTokens() —
 *  (a) an mfaEnrolled user completes verifyMfaAndIssueTokens() with a valid
 *      TOTP code against their existing secret, or
 *  (b) a not-yet-enrolled user completes confirmMfaEnrollment() with a valid
 *      TOTP code proving they've actually set up their authenticator app.
 * login() itself never returns a token — a correct password alone is never
 * sufficient to get a session, closing the previous gap where an unenrolled
 * user could log in without MFA. Patients never authenticate through this
 * service at all; they use single-visit sessions issued by the visit flow,
 * not accounts.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mfa: MfaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async validatePassword(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== 'active') {
      await this.audit.write({
        action: 'auth.login.failed',
        entityType: 'User',
        reason: 'unknown_email_or_inactive',
      });
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) {
      await this.audit.write({
        actorId: user.id,
        action: 'auth.login.failed',
        entityType: 'User',
        entityId: user.id,
        reason: 'bad_password',
      });
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.validatePassword(email, password);

    if (user.mfaEnrolled) {
      // Short-lived challenge token, not a real session token. The caller
      // must POST /auth/mfa/verify with this + a TOTP code to get a real
      // access token.
      const mfaChallengeToken = await this.jwt.signAsync(
        { sub: user.id, scope: 'mfa_challenge' },
        { expiresIn: '5m' },
      );
      return { status: 'MFA_REQUIRED', mfaChallengeToken };
    }

    // Not yet enrolled: password alone does NOT issue a session. The caller
    // must complete confirmMfaEnrollment() with a valid TOTP code first.
    if (!user.mfaSecretEncrypted) {
      // Defensive — every user should get a secret at creation time
      // (UsersService.create). If one is somehow missing, fail closed rather
      // than silently letting the user through without MFA.
      await this.audit.write({
        actorId: user.id,
        action: 'auth.login.blocked_no_mfa_secret',
        entityType: 'User',
        entityId: user.id,
      });
      throw new UnauthorizedException('MFA is not configured for this account. Contact your system administrator.');
    }

    const enrollmentToken = await this.jwt.signAsync(
      { sub: user.id, scope: 'mfa_enrollment' },
      { expiresIn: '10m' },
    );
    await this.audit.write({
      actorId: user.id,
      action: 'auth.mfa.enrollment_required',
      entityType: 'User',
      entityId: user.id,
    });
    return {
      status: 'MFA_ENROLLMENT_REQUIRED',
      enrollmentToken,
      // NOTE: in production, decrypt mfaSecretEncrypted via the KMS-backed
      // field decryption wrapper before deriving this URL. Not reimplemented here.
      otpAuthUrl: this.mfa.getOtpAuthUrl(user.email, user.mfaSecretEncrypted),
    };
  }

  /**
   * Completes first-time MFA setup: the user has scanned the QR code from
   * otpAuthUrl into an authenticator app and now proves it works by supplying
   * a current TOTP code. Only on success does mfaEnrolled flip to true and a
   * real session get issued — there is no enrollment path that skips this
   * verification step.
   */
  async confirmMfaEnrollment(enrollmentToken: string, totpCode: string): Promise<LoginResult> {
    let payload: { sub: string; scope: string };
    try {
      payload = await this.jwt.verifyAsync(enrollmentToken);
    } catch {
      throw new UnauthorizedException('Expired or invalid enrollment token');
    }
    if (payload.scope !== 'mfa_enrollment') {
      throw new UnauthorizedException('Invalid enrollment token');
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user?.mfaSecretEncrypted) {
      throw new UnauthorizedException('MFA is not configured for this account');
    }
    if (user.mfaEnrolled) {
      // Enrollment token from a stale session for an already-enrolled user —
      // route them through the normal challenge flow instead.
      throw new UnauthorizedException('MFA is already enrolled for this account. Please log in again.');
    }

    const valid = this.mfa.verify(totpCode, user.mfaSecretEncrypted);
    if (!valid) {
      await this.audit.write({
        actorId: user.id,
        action: 'auth.mfa.enrollment_failed',
        entityType: 'User',
        entityId: user.id,
      });
      throw new UnauthorizedException('Invalid MFA code');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { mfaEnrolled: true },
    });
    await this.audit.write({
      actorId: user.id,
      action: 'auth.mfa.enrolled',
      entityType: 'User',
      entityId: user.id,
    });
    await this.audit.write({
      actorId: user.id,
      action: 'auth.login.success',
      entityType: 'User',
      entityId: user.id,
      reason: 'first_login_via_mfa_enrollment',
    });
    return this.issueTokens(user.id);
  }

  async verifyMfaAndIssueTokens(mfaChallengeToken: string, totpCode: string): Promise<LoginResult> {
    let payload: { sub: string; scope: string };
    try {
      payload = await this.jwt.verifyAsync(mfaChallengeToken);
    } catch {
      throw new UnauthorizedException('Expired or invalid MFA challenge');
    }
    if (payload.scope !== 'mfa_challenge') {
      throw new UnauthorizedException('Invalid challenge token');
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user?.mfaSecretEncrypted) {
      throw new UnauthorizedException('MFA not configured for this user');
    }
    // NOTE: in production, decrypt mfaSecretEncrypted via the KMS-backed field
    // decryption wrapper before passing to mfa.verify(). Not reimplemented here.
    const valid = this.mfa.verify(totpCode, user.mfaSecretEncrypted);
    if (!valid) {
      await this.audit.write({
        actorId: user.id,
        action: 'auth.mfa.failed',
        entityType: 'User',
        entityId: user.id,
      });
      throw new UnauthorizedException('Invalid MFA code');
    }
    await this.audit.write({
      actorId: user.id,
      action: 'auth.login.success',
      entityType: 'User',
      entityId: user.id,
    });
    return this.issueTokens(user.id);
  }

  /**
   * Closes the Sprint-1 TODO flagged in main.ts: staff idle-timeout is now
   * backed by a real, revocable Session row (kind=STAFF), not just the JWT's
   * own expiry. A JWT alone can't be revoked before it expires — if a staff
   * member logs out, is suspended, or a device is reported lost, the access
   * token would otherwise keep working for up to JWT_ACCESS_TTL regardless.
   * Every authenticated request now checks this row (JwtStrategy.validate),
   * so logout() and admin-initiated revocation actually take effect
   * immediately rather than "eventually, when the token expires".
   */
  private async issueTokens(userId: string): Promise<LoginResult> {
    const roles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    const roleNames = roles.map((r) => r.role.name);
    const permissions = roles.flatMap((r) => r.role.permissions.map((rp) => rp.permission.key));

    const idleSeconds = Number(this.config.get('STAFF_IDLE_TIMEOUT_SECONDS') ?? 900);
    const session = await this.prisma.session.create({
      data: {
        kind: 'STAFF',
        userId,
        expiresAt: new Date(Date.now() + idleSeconds * 1000),
      },
    });

    const accessToken = await this.jwt.signAsync(
      { sub: userId, sid: session.id, roles: roleNames, permissions },
      { expiresIn: process.env.JWT_ACCESS_TTL ?? '15m' },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, sid: session.id, scope: 'refresh' },
      { secret: process.env.JWT_REFRESH_SECRET, expiresIn: process.env.JWT_REFRESH_TTL ?? '12h' },
    );
    return { status: 'OK', accessToken, refreshToken };
  }

  /** Issues a fresh access token for an unexpired, unrevoked session — does not extend the session's own idle window beyond what activity-touching (JwtStrategy) already does. */
  async refresh(refreshToken: string): Promise<LoginResult> {
    let payload: { sub: string; sid: string; scope: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, { secret: process.env.JWT_REFRESH_SECRET });
    } catch {
      throw new UnauthorizedException('Refresh token expired or invalid. Please log in again.');
    }
    if (payload.scope !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const session = await this.prisma.session.findUnique({ where: { id: payload.sid } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired or revoked. Please log in again.');
    }

    const roles = await this.prisma.userRole.findMany({
      where: { userId: payload.sub },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    const accessToken = await this.jwt.signAsync(
      {
        sub: payload.sub,
        sid: session.id,
        roles: roles.map((r) => r.role.name),
        permissions: roles.flatMap((r) => r.role.permissions.map((rp) => rp.permission.key)),
      },
      { expiresIn: process.env.JWT_ACCESS_TTL ?? '15m' },
    );
    return { status: 'OK', accessToken };
  }

  /** Immediate revocation — the whole reason the session is a DB row and not just a JWT. */
  async logout(sessionId: string, actorId: string): Promise<void> {
    await this.prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
    await this.audit.write({
      actorId,
      action: 'auth.logout',
      entityType: 'Session',
      entityId: sessionId,
    });
  }

  async hashPassword(plain: string): Promise<string> {
    // argon2id is the current OWASP recommendation over bcrypt for new systems.
    return argon2.hash(plain, { type: argon2.argon2id });
  }
}
