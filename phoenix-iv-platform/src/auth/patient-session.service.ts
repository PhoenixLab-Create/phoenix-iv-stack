import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../config/prisma.service';
import { AuditService } from '../common/audit/audit.service';

/**
 * Patients never get accounts (architecture decision, confirmed). Instead, a
 * staff member starts a visit and this service mints a short-lived,
 * single-visit session token the patient uses on a clinic tablet or via a
 * one-time link. The token is only ever good for that one visitId — there is
 * no "patient login" anywhere in this system.
 */
@Injectable()
export class PatientSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async issueForVisit(visitId: string, issuedByStaffId: string): Promise<{ token: string; expiresAt: Date }> {
    const idleSeconds = Number(this.config.get('PATIENT_IDLE_TIMEOUT_SECONDS') ?? 300);
    const expiresAt = new Date(Date.now() + idleSeconds * 1000);

    const session = await this.prisma.session.create({
      data: {
        kind: 'PATIENT',
        visitId,
        expiresAt,
      },
    });

    const token = await this.jwt.signAsync(
      { sid: session.id, visitId, scope: 'patient_session' },
      { expiresIn: `${idleSeconds}s` },
    );

    await this.audit.write({
      actorId: issuedByStaffId,
      action: 'patient_session.issue',
      entityType: 'Session',
      entityId: session.id,
      visitId,
    });

    return { token, expiresAt };
  }

  /** Extends the idle timeout on activity, up to the original issuance policy — not indefinitely. */
  async touch(sessionId: string): Promise<void> {
    const idleSeconds = Number(this.config.get('PATIENT_IDLE_TIMEOUT_SECONDS') ?? 300);
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { expiresAt: new Date(Date.now() + idleSeconds * 1000) },
    });
  }

  async validate(token: string): Promise<{ sessionId: string; visitId: string }> {
    let payload: { sid: string; visitId: string; scope: string };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Patient session expired or invalid. Please ask staff to restart your visit.');
    }
    if (payload.scope !== 'patient_session') {
      throw new UnauthorizedException('Invalid session token');
    }
    const session = await this.prisma.session.findUnique({ where: { id: payload.sid } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Patient session expired or invalid. Please ask staff to restart your visit.');
    }
    return { sessionId: session.id, visitId: payload.visitId };
  }

  async revoke(sessionId: string, reason: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
    await this.audit.write({
      action: 'patient_session.revoke',
      entityType: 'Session',
      entityId: sessionId,
      reason,
    });
  }
}
