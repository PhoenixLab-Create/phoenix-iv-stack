import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../config/prisma.service';

export interface AuditWriteInput {
  actorId?: string | null;
  actorRole?: string | null;
  action: string; // e.g. "visit.status.change", "record.view", "screening_flag.acknowledge"
  entityType: string; // e.g. "Visit", "Patient", "Consent"
  entityId?: string | null;
  patientId?: string | null;
  visitId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  ip?: string | null;
  deviceId?: string | null;
  requestId?: string | null;
}

/**
 * Audit writes are:
 *  - insert-only (the DB role used by the app has no UPDATE/DELETE grant on audit_log —
 *    see infra/sql/immutability.sql; this service never attempts either)
 *  - hash-chained: each entry's hash covers its own content plus the previous entry's hash,
 *    so a gap or edit in the chain is detectable
 *  - required for every clinical read and write — callers should go through
 *    AuditInterceptor rather than calling this service directly wherever possible,
 *    so that no code path can "forget" to audit.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async write(input: AuditWriteInput): Promise<void> {
    // Fetch the most recent hash to chain against. In a high-concurrency
    // production system this read+insert should happen inside a serializable
    // transaction or use a Postgres advisory lock to avoid a race between two
    // concurrent writers picking the same prevHash — flagged here rather than
    // silently ignored.
    const last = await this.prisma.auditEntry.findFirst({
      orderBy: { occurredAt: 'desc' },
      select: { hash: true },
    });
    const prevHash = last?.hash ?? null;

    const occurredAt = new Date();
    const payloadForHash = JSON.stringify({
      occurredAt: occurredAt.toISOString(),
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      patientId: input.patientId ?? null,
      visitId: input.visitId ?? null,
      before: input.before ?? null,
      after: input.after ?? null,
      prevHash,
    });
    const hash = createHash('sha256').update(payloadForHash).digest('hex');

    try {
      await this.prisma.auditEntry.create({
        data: {
          occurredAt,
          actorId: input.actorId ?? null,
          actorRole: input.actorRole ?? null,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId ?? null,
          patientId: input.patientId ?? null,
          visitId: input.visitId ?? null,
          before: input.before as any,
          after: input.after as any,
          reason: input.reason ?? null,
          ip: input.ip ?? null,
          deviceId: input.deviceId ?? null,
          requestId: input.requestId ?? null,
          prevHash,
          hash,
        },
      });
    } catch (err) {
      // An audit write failing is itself a serious event. In production this
      // should page the on-call / privacy officer, not just log — a clinical
      // action whose audit entry silently fails to write is a compliance gap.
      this.logger.error('AUDIT WRITE FAILED — escalate immediately', err as Error);
      throw err;
    }
  }

  /** Verifies the hash chain over a range — used by the Privacy Officer's audit review tooling. */
  async verifyChainIntegrity(fromId?: string): Promise<{ valid: boolean; brokenAtId?: string }> {
    const entries = await this.prisma.auditEntry.findMany({
      orderBy: { occurredAt: 'asc' },
      ...(fromId ? { cursor: { id: fromId } } : {}),
    });
    let prevHash: string | null = null;
    for (const e of entries) {
      if (e.prevHash !== prevHash) {
        return { valid: false, brokenAtId: e.id };
      }
      prevHash = e.hash;
    }
    return { valid: true };
  }
}
