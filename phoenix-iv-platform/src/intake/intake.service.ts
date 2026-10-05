import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { VisitsService } from '../visits/visits.service';

export interface SubmitIntakeInput {
  answers: Record<string, unknown>; // keyed by FormVersion schema question keys
  medications: { name: string; dose?: string; frequency?: string }[];
  allergy: { hasAllergy: boolean; description?: string };
}

@Injectable()
export class IntakeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly visits: VisitsService,
  ) {}

  private async getActiveFormVersion() {
    const version = await this.prisma.formVersion.findFirst({
      where: { kind: 'intake', active: true },
      orderBy: { version: 'desc' },
    });
    if (!version) {
      throw new BadRequestException(
        'No active intake form version configured. [CLINIC TO SUPPLY: intake question set]',
      );
    }
    return version;
  }

  /**
   * Exposes the active intake question set so a client can render the form
   * before submitting — the same pattern ConsentService.getActiveTemplate()
   * already uses for the consent screen. This is structural form metadata
   * (question keys/labels/types the clinic supplied), never a clinical rule
   * or a generated question, so serving it to the client carries the same
   * safety profile as the consent template endpoint.
   */
  async getActiveForm() {
    const version = await this.getActiveFormVersion();
    return { id: version.id, version: version.version, schema: version.schema };
  }

  /**
   * actorKind distinguishes a patient submitting via their own session from
   * a staff member entering on the patient's behalf (e.g. an accessibility
   * accommodation) — both are real, supported paths, but the record always
   * shows which one happened.
   */
  async submit(
    visitId: string,
    input: SubmitIntakeInput,
    actorKind: 'patient' | 'staff_on_behalf',
    actorId: string | null,
  ) {
    const formVersion = await this.getActiveFormVersion();

    // Validate every submitted key exists in the active schema — prevents a
    // stale client from writing answers to retired or future questions.
    const validKeys = new Set((formVersion.schema as any[]).map((q) => q.key));
    for (const key of Object.keys(input.answers)) {
      if (!validKeys.has(key)) {
        throw new BadRequestException(`Unknown intake question key: ${key}`);
      }
    }

    const intake = await this.prisma.intakeForm.upsert({
      where: { visitId },
      create: {
        visitId,
        formVersionId: formVersion.id,
        submittedAt: new Date(),
        submittedByKind: actorKind,
      },
      update: {
        submittedAt: new Date(),
        submittedByKind: actorKind,
      },
    });

    // Replace answers/medications/allergy wholesale on (re)submission — the
    // visit isn't signed yet at this stage, and intake is a save/resume flow
    // per the PRD, not an append-only log like clinical entries are.
    await this.prisma.$transaction([
      this.prisma.intakeAnswer.deleteMany({ where: { intakeId: visitId } }),
      this.prisma.intakeAnswer.createMany({
        data: Object.entries(input.answers).map(([questionKey, answerValue]) => ({
          intakeId: visitId,
          questionKey,
          answerValue: answerValue as any,
        })),
      }),
      this.prisma.intakeMedication.deleteMany({ where: { intakeId: visitId } }),
      this.prisma.intakeMedication.createMany({
        data: input.medications.map((m) => ({ intakeId: visitId, ...m })),
      }),
      this.prisma.intakeAllergy.deleteMany({ where: { intakeId: visitId } }),
      this.prisma.intakeAllergy.create({
        data: { intakeId: visitId, hasAllergy: input.allergy.hasAllergy, description: input.allergy.description },
      }) as any,
    ]);

    await this.audit.write({
      actorId,
      actorRole: actorKind === 'patient' ? 'PATIENT_SESSION' : null,
      action: 'intake.submit',
      entityType: 'IntakeForm',
      entityId: visitId,
      visitId,
    });

    // Intake completion is what moves the visit from INTAKE to
    // SAFETY_SCREENING — screening can't run against a visit still mid-intake.
    await this.visits.transition(visitId, 'SAFETY_SCREENING' as any, actorId ?? 'patient_session', 'intake submitted');

    return intake;
  }

  async get(visitId: string) {
    return this.prisma.intakeForm.findUnique({
      where: { visitId },
      include: { answers: true, medications: true, allergies: true, formVersion: true },
    });
  }
}
