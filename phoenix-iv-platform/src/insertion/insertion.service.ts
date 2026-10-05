import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { VisitsService } from '../visits/visits.service';

export interface RecordInsertionInput {
  eventTime?: string; // ISO — allows a late entry to record the real clinical time separately from recordedAt
  site: string;
  side: string;
  gauge: string;
  attempts: number;
  successful: boolean;
  siteCondition?: string;
  note?: string;
}

@Injectable()
export class InsertionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly visits: VisitsService,
  ) {}

  async record(visitId: string, input: RecordInsertionInput, actorId: string) {
    const insertion = await this.prisma.iVInsertion.upsert({
      where: { visitId },
      create: {
        visitId,
        eventTime: input.eventTime ? new Date(input.eventTime) : new Date(),
        site: input.site,
        side: input.side,
        gauge: input.gauge,
        attempts: input.attempts,
        successful: input.successful,
        insertedBy: actorId,
        siteCondition: input.siteCondition,
        note: input.note,
      },
      update: {
        eventTime: input.eventTime ? new Date(input.eventTime) : undefined,
        site: input.site,
        side: input.side,
        gauge: input.gauge,
        attempts: input.attempts,
        successful: input.successful,
        insertedBy: actorId,
        siteCondition: input.siteCondition,
        note: input.note,
      },
    });

    await this.audit.write({
      actorId,
      action: 'insertion.record',
      entityType: 'IVInsertion',
      entityId: visitId,
      visitId,
      after: { successful: input.successful, attempts: input.attempts },
    });

    // Documentation proceeds to monitoring regardless of successful=false —
    // an unsuccessful insertion attempt is still part of the record; what
    // happens clinically next (re-attempt, abandon) is the clinician's call,
    // reflected in their notes, not decided by this software.
    await this.visits.transition(visitId, 'INFUSION_MONITORING' as any, actorId, 'insertion recorded');
    return insertion;
  }

  async get(visitId: string) {
    return this.prisma.iVInsertion.findUnique({ where: { visitId } });
  }
}
