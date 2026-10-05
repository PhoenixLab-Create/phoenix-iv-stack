import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { VisitsService } from '../visits/visits.service';

export interface RecordAdverseEventInput {
  onsetTime: string;
  signsSymptoms: string;
  infusionAction: 'stopped' | 'modified' | 'continued';
  vitals?: {
    bpSystolic?: number;
    bpDiastolic?: number;
    heartRate?: number;
    respRate?: number;
    temperature?: number;
    spo2?: number;
  };
  interventions?: string;
  medicationGiven?: string;
  prescriberContacted?: string;
  prescriberContactedAt?: string;
  emsContacted: boolean;
  emsContactedAt?: string;
  patientResponse?: string;
  outcome: string;
  hospitalTransfer: boolean;
  /** What happens to the visit once this event is documented — the clinician's call, not software's. */
  resolution: 'resume_monitoring' | 'move_to_completion';
}

/**
 * This service only ever records what happened and what the clinician did —
 * it contains no emergency-protocol logic, no drug suggestions, no decision
 * tree. The clinic's own approved emergency protocol is displayed to the
 * clinician by the front end as static reference content; this service's job
 * starts after that, documenting the outcome.
 */
@Injectable()
export class AdverseEventService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly visits: VisitsService,
  ) {}

  async record(visitId: string, input: RecordAdverseEventInput, actorId: string) {
    if (!input.outcome?.trim()) {
      throw new BadRequestException('An outcome is required to document an adverse event.');
    }

    let vitalSetId: string | undefined;
    if (input.vitals) {
      const vs = await this.prisma.vitalSet.create({
        data: { visitId, phase: 'MONITORING', recordedBy: actorId, ...input.vitals },
      });
      vitalSetId = vs.id;
    }

    const event = await this.prisma.adverseEvent.create({
      data: {
        visitId,
        onsetTime: new Date(input.onsetTime),
        signsSymptoms: input.signsSymptoms,
        infusionAction: input.infusionAction,
        vitalSetId,
        interventions: input.interventions,
        medicationGiven: input.medicationGiven,
        prescriberContacted: input.prescriberContacted,
        prescriberContactedAt: input.prescriberContactedAt ? new Date(input.prescriberContactedAt) : undefined,
        emsContacted: input.emsContacted,
        emsContactedAt: input.emsContactedAt ? new Date(input.emsContactedAt) : undefined,
        patientResponse: input.patientResponse,
        outcome: input.outcome,
        hospitalTransfer: input.hospitalTransfer,
        recordedBy: actorId,
      },
    });

    await this.audit.write({
      actorId,
      action: 'adverse_event.record',
      entityType: 'AdverseEvent',
      entityId: event.id,
      visitId,
      after: { outcome: input.outcome, hospitalTransfer: input.hospitalTransfer, emsContacted: input.emsContacted },
    });

    const nextStatus = input.resolution === 'resume_monitoring' ? 'INFUSION_MONITORING' : 'TREATMENT_COMPLETION';
    await this.visits.transition(visitId, nextStatus as any, actorId, `adverse event resolved: ${input.resolution}`);

    return event;
  }

  async list(visitId: string) {
    return this.prisma.adverseEvent.findMany({ where: { visitId }, orderBy: { recordedAt: 'asc' } });
  }
}
