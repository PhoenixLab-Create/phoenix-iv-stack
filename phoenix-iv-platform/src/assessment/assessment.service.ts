import { BadRequestException, Injectable } from '@nestjs/common';
import { VisitStatus } from '@prisma/client';
import { PrismaService } from '../config/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { VisitsService } from '../visits/visits.service';
import { ScreeningService } from '../screening/screening.service';

export interface RecordAssessmentInput {
  reasonForVisit: string;
  notes?: string;
  decision: 'Proceed' | 'Do not proceed';
  vitals: {
    bpSystolic?: number;
    bpDiastolic?: number;
    heartRate?: number;
    respRate?: number;
    temperature?: number;
    spo2?: number;
  };
}

@Injectable()
export class AssessmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly visits: VisitsService,
    private readonly screening: ScreeningService,
  ) {}

  async record(visitId: string, input: RecordAssessmentInput, actorId: string) {
    // The decision itself is the clinician's alone — this service records it,
    // it does not compute or suggest it. The only thing enforced here is a
    // documentation-completeness rule: every screening flag must already be
    // acknowledged before an assessment decision can be recorded, so a flag
    // can't be silently skipped past.
    const allAcked = await this.screening.allFlagsAcknowledged(visitId);
    if (!allAcked) {
      throw new BadRequestException(
        'All safety screening flags must be acknowledged before recording the clinician assessment.',
      );
    }

    await this.prisma.vitalSet.create({
      data: {
        visitId,
        phase: 'BASELINE',
        recordedBy: actorId,
        bpSystolic: input.vitals.bpSystolic,
        bpDiastolic: input.vitals.bpDiastolic,
        heartRate: input.vitals.heartRate,
        respRate: input.vitals.respRate,
        temperature: input.vitals.temperature,
        spo2: input.vitals.spo2,
      },
    });

    const assessment = await this.prisma.assessment.upsert({
      where: { visitId },
      create: {
        visitId,
        reasonForVisit: input.reasonForVisit,
        notes: input.notes,
        decision: input.decision,
        decidedBy: actorId,
        decidedAt: new Date(),
      },
      update: {
        reasonForVisit: input.reasonForVisit,
        notes: input.notes,
        decision: input.decision,
        decidedBy: actorId,
        decidedAt: new Date(),
      },
    });

    await this.audit.write({
      actorId,
      action: 'assessment.record',
      entityType: 'Assessment',
      entityId: visitId,
      visitId,
      after: { decision: input.decision, reasonForVisit: input.reasonForVisit },
    });

    // The decision drives the branch — this is the one place in the whole
    // system where a clinician's decision changes the visit's path. The
    // software is not making the decision, only acting on it.
    const nextStatus: VisitStatus =
      input.decision === 'Proceed' ? ('ORDER_AUTHORIZATION' as VisitStatus) : ('NOT_PROCEEDING' as VisitStatus);
    await this.visits.transition(visitId, nextStatus, actorId, `assessment decision: ${input.decision}`);

    return assessment;
  }
}
