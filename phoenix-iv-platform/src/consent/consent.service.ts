import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { VisitsService } from '../visits/visits.service';

export interface SignConsentInput {
  patientName: string;
  signatureBlobRef: string; // reference to a stored signature image/typed-name blob, not raw biometric data
  questionsAnsweredConfirmed: boolean;
}

@Injectable()
export class ConsentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly visits: VisitsService,
  ) {}

  async getActiveTemplate() {
    const template = await this.prisma.consentTemplate.findFirst({
      where: { effectiveFrom: { lte: new Date() } },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!template) {
      throw new BadRequestException(
        'No approved consent template is configured. [CLINIC TO SUPPLY: final consent text/version]',
      );
    }
    return template;
  }

  /** Simple placeholder substitution only — no logic, no conditional text, so the rendered text can never diverge from the approved body in a way nobody reviewed. */
  private render(body: string, patientName: string): string {
    return body.replace(/\{\{\s*patientName\s*\}\}/g, patientName);
  }

  /**
   * Only the patient, via their own single-visit session, can sign consent —
   * there is no staff-on-behalf path for this action (unlike intake, where
   * one exists for accessibility reasons). Consent is consequential enough
   * that the architecture decision is: the signature on file is always the
   * patient's own, captured through their own session, full stop.
   */
  async sign(visitId: string, input: SignConsentInput, patientSessionId: string) {
    if (!input.questionsAnsweredConfirmed) {
      throw new BadRequestException('Consent cannot be recorded until the patient confirms their questions were answered.');
    }
    if (!input.signatureBlobRef) {
      throw new BadRequestException('A signature is required.');
    }

    const template = await this.getActiveTemplate();
    const renderedTextSnapshot = this.render(template.body, input.patientName);

    const consent = await this.prisma.consent.upsert({
      where: { visitId },
      create: {
        visitId,
        templateVersionId: template.id,
        renderedTextSnapshot,
        patientName: input.patientName,
        signatureBlobRef: input.signatureBlobRef,
        signedAt: new Date(),
        questionsAnsweredConfirmed: true,
      },
      update: {
        templateVersionId: template.id,
        renderedTextSnapshot,
        patientName: input.patientName,
        signatureBlobRef: input.signatureBlobRef,
        signedAt: new Date(),
        questionsAnsweredConfirmed: true,
      },
    });

    await this.audit.write({
      actorId: patientSessionId,
      actorRole: 'PATIENT_SESSION',
      action: 'consent.sign',
      entityType: 'Consent',
      entityId: visitId,
      visitId,
      after: { templateVersionId: template.id },
    });

    await this.visits.transition(visitId, 'IV_PREPARATION' as any, patientSessionId, 'consent signed');
    return consent;
  }

  /** Nurse/witness records their own witnessing separately — distinct from the patient's signature. */
  async witness(visitId: string, witnessUserId: string) {
    const consent = await this.prisma.consent.findUnique({ where: { visitId } });
    if (!consent?.signedAt) {
      throw new BadRequestException('Cannot witness a consent that has not been signed yet.');
    }
    const updated = await this.prisma.consent.update({
      where: { visitId },
      data: { witnessUserId },
    });
    await this.audit.write({
      actorId: witnessUserId,
      action: 'consent.witness',
      entityType: 'Consent',
      entityId: visitId,
      visitId,
    });
    return updated;
  }

  async get(visitId: string) {
    return this.prisma.consent.findUnique({ where: { visitId } });
  }
}
