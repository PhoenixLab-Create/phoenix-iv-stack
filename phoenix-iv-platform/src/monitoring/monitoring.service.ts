import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { VisitsService } from '../visits/visits.service';

export interface AddMonitoringEntryInput {
  eventTime?: string;
  vitals?: {
    bpSystolic?: number;
    bpDiastolic?: number;
    heartRate?: number;
    respRate?: number;
    temperature?: number;
    spo2?: number;
  };
  symptomsObservation?: string;
  tolerating: boolean;
}

@Injectable()
export class MonitoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly visits: VisitsService,
  ) {}

  async addEntry(visitId: string, input: AddMonitoringEntryInput, actorId: string) {
    let vitalSetId: string | undefined;
    if (input.vitals) {
      const vs = await this.prisma.vitalSet.create({
        data: {
          visitId,
          phase: 'MONITORING',
          recordedBy: actorId,
          ...input.vitals,
        },
      });
      vitalSetId = vs.id;
    }

    const entry = await this.prisma.infusionMonitoringEntry.create({
      data: {
        visitId,
        eventTime: input.eventTime ? new Date(input.eventTime) : new Date(),
        vitalSetId,
        symptomsObservation: input.symptomsObservation,
        tolerating: input.tolerating,
        recordedBy: actorId,
      },
    });

    await this.audit.write({
      actorId,
      action: 'monitoring.entry.record',
      entityType: 'InfusionMonitoringEntry',
      entityId: entry.id,
      visitId,
      after: { tolerating: input.tolerating },
    });

    // The one piece of automatic routing in the whole system that the PRD
    // explicitly asks for: "If NO, automatically open the adverse-event
    // section." This only changes the visit's status (which screen comes
    // next) — it records no clinical judgment and recommends nothing.
    if (!input.tolerating) {
      await this.visits.transition(visitId, 'ADVERSE_EVENT' as any, actorId, 'patient not tolerating infusion');
    }

    return entry;
  }

  async list(visitId: string) {
    // Includes the linked VitalSet so a client can actually display the
    // vitals taken at each entry, rather than just an opaque vitalSetId.
    return this.prisma.infusionMonitoringEntry.findMany({
      where: { visitId },
      include: { vitalSet: true },
      orderBy: { eventTime: 'asc' },
    });
  }

  /** Explicit staff action to leave monitoring for completion — never automatic, and blocked if the most recent entry reported intolerance (that path goes through adverse-event resolution instead). */
  async completeMonitoring(visitId: string, actorId: string) {
    const entries = await this.list(visitId);
    if (entries.length === 0) {
      throw new BadRequestException('At least one monitoring entry is required before completing monitoring.');
    }
    const last = entries[entries.length - 1];
    if (!last.tolerating) {
      throw new BadRequestException(
        'The most recent monitoring entry reported the patient was not tolerating the infusion. Resolve the adverse event before completing monitoring.',
      );
    }
    return this.visits.transition(visitId, 'TREATMENT_COMPLETION' as any, actorId, 'monitoring complete');
  }
}
