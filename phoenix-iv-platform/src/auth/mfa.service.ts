import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';
import { ConfigService } from '@nestjs/config';

/**
 * TOTP-based MFA (Google Authenticator / Authy compatible). This is a real,
 * working implementation using otplib — not a stub. What's NOT wired up yet:
 * SMS/email fallback delivery and the "remember this device for 30 days"
 * convenience flow, both deferred to a later sprint per the plan.
 *
 * mfaSecretEncrypted on User is expected to be encrypted at the field level
 * before it reaches this service in production (KMS-backed), per the
 * architecture review's field-level encryption requirement. That encryption
 * wrapper is an infra concern (see infra/) and intentionally not reimplemented
 * here — do not store the raw secret in this service's input/output boundary
 * without it in production.
 */
@Injectable()
export class MfaService {
  private readonly issuer: string;

  constructor(private readonly config: ConfigService) {
    this.issuer = this.config.get<string>('MFA_ISSUER') ?? 'Phoenix Medical Aesthetics';
  }

  generateSecret(): string {
    return authenticator.generateSecret();
  }

  getOtpAuthUrl(email: string, secret: string): string {
    return authenticator.keyuri(email, this.issuer, secret);
  }

  verify(token: string, secret: string): boolean {
    return authenticator.check(token, secret);
  }
}
