import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { VisitsService } from '../visits/visits.service';
import { RecordService } from '../record/record.service';

export interface SignInput {
  designation: string;
  signatureBlobRef: string;
}

@Injectable()
export class SignoffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly visits: VisitsService,
    private readonly record: RecordService,
  ) {}

  /**
   * Pure documentation-completeness check — exactly what the PRD's §15
   * "Documentation incomplete: ..." summary calls for. This never evaluates
   * anything clinical (it doesn't ask "was this the right dose"), only
   * "is every required field present and every flag accounted for".
   */
  async getCompletenessBlocks(visitId: string): Promise<string[]> {
    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        screeningFlags: true,
        assessment: true,
        order: true,
        protocolSelection: true,
        consent: true,
        preparation: { include: { items: true } },
        ivInsertion: true,
        monitoringEntries: true,
        adverseEvents: true,
        completion: true,
      },
    });
    if (!visit) return ['Visit not found'];

    const blocks: string[] = [];

    const unacked = visit.screeningFlags.filter((f) => !f.acknowledgedAt);
    if (unacked.length > 0) blocks.push(`${unacked.length} unacknowledged screening flag(s)`);

    if (!visit.assessment?.decision) blocks.push('Clinician assessment decision missing');

    // Everything past assessment only applies if the clinician proceeded —
    // "Do not proceed" visits are complete once the assessment is recorded.
    if (visit.assessment?.decision === 'Proceed') {
      if (!visit.order) blocks.push('Order authorization missing');
      if (!visit.protocolSelection) blocks.push('Protocol selection missing');
      if (!visit.consent?.signedAt) blocks.push('Consent not signed');

      if (!visit.preparation) {
        blocks.push('IV preparation not recorded');
      } else if (visit.preparation.items.length === 0) {
        blocks.push('IV preparation has no ingredients recorded');
      }

      if (!visit.ivInsertion) blocks.push('IV insertion not recorded');

      if (visit.ivInsertion?.successful && visit.monitoringEntries.length === 0) {
        blocks.push('No infusion monitoring entries recorded');
      }

      if (!visit.completion) {
        blocks.push('Treatment completion not recorded');
      } else {
        if (!visit.completion.aftercareProvided) blocks.push('Aftercare not confirmed as provided');
        const hasUnresolvedAdverseEvent =
          visit.completion.adverseEventOccurred &&
          visit.adverseEvents.length > 0 &&
          visit.adverseEvents.some((ae) => !ae.outcome?.trim());
        if (hasUnresolvedAdverseEvent) blocks.push('Adverse event recorded without an outcome');
      }
    }

    return blocks;
  }

  async getSummary(visitId: string) {
    const blocks = await this.getCompletenessBlocks(visitId);
    return { canSign: blocks.length === 0, blocks };
  }

  async sign(visitId: string, input: SignInput, actorId: string) {
    const blocks = await this.getCompletenessBlocks(visitId);
    if (blocks.length > 0) {
      throw new BadRequestException({
        message: 'Documentation incomplete — cannot sign.',
        blocks,
      });
    }

    // Hash the pre-signature canonical record FIRST, then mark the visit
    // signed, so the hash reflects exactly what was true at the moment of
    // signing — not a state that includes the Signoff row itself.
    const canonical = await this.record.getCanonical(visitId);
    const canonicalString = this.record.canonicalize(canonical);
    const hash = this.record.hash(canonicalString);

    await this.visits.signVisit(visitId, actorId);

    const signoff = await this.prisma.signoff.create({
      data: {
        visitId,
        signerId: actorId,
        designation: input.designation,
        signatureBlobRef: input.signatureBlobRef,
        recordHash: hash,
      },
    });

    await this.prisma.recordSnapshot.create({
      data: {
        visitId,
        versionNo: 1,
        canonicalJson: JSON.parse(canonicalString),
        hash,
        createdBy: actorId,
      },
    });

    await this.audit.write({
      actorId,
      action: 'visit.signoff',
      entityType: 'Signoff',
      entityId: visitId,
      visitId,
      after: { hash },
    });

    return signoff;
  }
}
