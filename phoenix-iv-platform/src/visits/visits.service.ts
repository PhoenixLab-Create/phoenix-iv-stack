import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { VisitStatus } from '@prisma/client';
import { PrismaService } from '../config/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { assertValidTransition } from './visit-state-machine';

@Injectable()
export class VisitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async start(patientId: string, startedBy: string) {
    const visit = await this.prisma.visit.create({
      data: {
        patientId,
        status: VisitStatus.REGISTERED,
      },
    });
    await this.prisma.visitStatusHistory.create({
      data: { visitId: visit.id, toStatus: VisitStatus.REGISTERED, changedBy: startedBy },
    });
    await this.audit.write({
      actorId: startedBy,
      action: 'visit.start',
      entityType: 'Visit',
      entityId: visit.id,
      patientId,
      visitId: visit.id,
    });
    return visit;
  }

  /**
   * The one function every step-completion endpoint in later sprints should
   * call before writing its own clinical fields. It:
   *  1. Loads the visit and refuses if it's already signed (immutable).
   *  2. Validates the requested transition against the state machine.
   *  3. Writes the new status + a status-history row + an audit entry,
   *     inside a single transaction so a partial write can't leave the visit
   *     in an inconsistent state.
   */
  async transition(visitId: string, to: VisitStatus, actorId: string, reason?: string) {
    if (to === VisitStatus.SIGNED) {
      // Signing is NEVER a generic status transition — it must go through
      // SignoffService.sign(), which runs the completeness check and sets
      // signedAt atomically with the status change via signVisit() below.
      // Allowing it here would let a visit reach status=SIGNED with
      // signedAt still null, which the immutability trigger (keyed off
      // signedAt, not status) would not catch — a real inconsistency, not
      // just a style issue.
      throw new ForbiddenException(
        'Cannot set a visit to SIGNED via a generic transition. Use the sign-off endpoint instead.',
      );
    }
    const visit = await this.prisma.visit.findUnique({ where: { id: visitId } });
    if (!visit) throw new NotFoundException('Visit not found');
    if (visit.signedAt) {
      throw new ForbiddenException(
        'This visit is signed and locked. Use the amendment workflow instead of a status change.',
      );
    }
    assertValidTransition(visit.status, to);

    const updated = await this.prisma.$transaction(async (tx) => {
      const v = await tx.visit.update({
        where: { id: visitId },
        data: { status: to },
      });
      await tx.visitStatusHistory.create({
        data: { visitId, fromStatus: visit.status, toStatus: to, changedBy: actorId, reason },
      });
      return v;
    });

    await this.audit.write({
      actorId,
      action: 'visit.status.change',
      entityType: 'Visit',
      entityId: visitId,
      patientId: visit.patientId,
      visitId,
      before: { status: visit.status },
      after: { status: to },
      reason,
    });

    return updated;
  }

  async findOne(visitId: string) {
    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
      include: { statusHistory: { orderBy: { changedAt: 'asc' } } },
    });
    if (!visit) throw new NotFoundException('Visit not found');
    return visit;
  }

  /**
   * The ONLY place signedAt is ever set. Called exclusively by
   * SignoffService after its completeness check passes — never by a
   * generic transition() call, so there is no path that marks a visit
   * signed without going through the completeness gate first.
   */
  async signVisit(visitId: string, actorId: string) {
    const visit = await this.prisma.visit.findUnique({ where: { id: visitId } });
    if (!visit) throw new NotFoundException('Visit not found');
    if (visit.signedAt) {
      throw new ForbiddenException('This visit is already signed.');
    }
    assertValidTransition(visit.status, VisitStatus.SIGNED);

    const updated = await this.prisma.$transaction(async (tx) => {
      const v = await tx.visit.update({
        where: { id: visitId },
        data: { status: VisitStatus.SIGNED, signedAt: new Date() },
      });
      await tx.visitStatusHistory.create({
        data: { visitId, fromStatus: visit.status, toStatus: VisitStatus.SIGNED, changedBy: actorId },
      });
      return v;
    });

    await this.audit.write({
      actorId,
      action: 'visit.sign',
      entityType: 'Visit',
      entityId: visitId,
      patientId: visit.patientId,
      visitId,
      before: { status: visit.status, signedAt: null },
      after: { status: 'SIGNED', signedAt: updated.signedAt },
    });

    return updated;
  }
}
