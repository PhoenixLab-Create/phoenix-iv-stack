import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { VisitsService } from '../visits/visits.service';

export interface RecordCompletionInput {
  totalInfusedMl?: number;
  patientCondition?: string;
  catheterRemoved?: boolean;
  catheterIntact?: boolean;
  siteCondition?: string;
  dressingApplied?: boolean;
  adverseEventOccurred: boolean;
  aftercareProvided: boolean;
}

@Injectable()
export class CompletionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly visits: VisitsService,
  ) {}

  async record(visitId: string, input: RecordCompletionInput, actorId: string) {
    if (!input.aftercareProvided) {
      throw new BadRequestException('Aftercare instructions must be provided and confirmed before completing the visit.');
    }

    // This is a consistency check against the visit's own adverse-event
    // records, not a clinical judgment: if the nurse says an adverse event
    // occurred, there must actually be a documented one (and vice versa) —
    // otherwise sign-off would show a record that contradicts itself.
    const adverseEvents = await this.prisma.adverseEvent.findMany({ where: { visitId } });
    if (input.adverseEventOccurred && adverseEvents.length === 0) {
      throw new BadRequestException(
        'Adverse event marked as occurred, but no adverse event record exists for this visit.',
      );
    }
    if (!input.adverseEventOccurred && adverseEvents.length > 0) {
      throw new BadRequestException(
        'This visit has a documented adverse event, but completion says none occurred. Please reconcile before completing.',
      );
    }

    const completion = await this.prisma.treatmentCompletion.upsert({
      where: { visitId },
      create: { visitId, ...input, recordedBy: actorId },
      update: { ...input, recordedBy: actorId },
    });

    await this.audit.write({
      actorId,
      action: 'completion.record',
      entityType: 'TreatmentCompletion',
      entityId: visitId,
      visitId,
      after: { adverseEventOccurred: input.adverseEventOccurred },
    });

    await this.visits.transition(visitId, 'PENDING_SIGNOFF' as any, actorId, 'treatment completed');
    return completion;
  }

  async get(visitId: string) {
    return this.prisma.treatmentCompletion.findUnique({ where: { visitId } });
  }
}
