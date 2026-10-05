import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { RecordService } from '../record/record.service';

// Whitelist of tables an amendment may target — prevents amending something
// like the audit log or a user account through this path. Extend deliberately,
// not by accident. Each entry also says HOW to read the current row back, so
// create() can verify the caller's claimed oldValue instead of trusting it —
// see readCurrentValue() below.
type TableReader = { singleKeyedByVisit: boolean; prismaModel: string };
const AMENDABLE_TABLES: Record<string, TableReader> = {
  assessments: { singleKeyedByVisit: true, prismaModel: 'assessment' },
  orders: { singleKeyedByVisit: true, prismaModel: 'order' },
  consents: { singleKeyedByVisit: true, prismaModel: 'consent' },
  iv_insertions: { singleKeyedByVisit: true, prismaModel: 'iVInsertion' },
  treatment_completions: { singleKeyedByVisit: true, prismaModel: 'treatmentCompletion' },
  // These two are multi-row-per-visit tables, keyed by their own id, not visitId.
  adverse_events: { singleKeyedByVisit: false, prismaModel: 'adverseEvent' },
  infusion_monitoring_entries: { singleKeyedByVisit: false, prismaModel: 'infusionMonitoringEntry' },
};

export interface CreateAmendmentInput {
  targetTable: string;
  targetId: string;
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
  signatureBlobRef: string;
}

export interface ApproveAmendmentInput {
  decision: 'approved' | 'rejected';
  note?: string;
}

@Injectable()
export class AmendmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly record: RecordService,
  ) {}

  async create(visitId: string, input: CreateAmendmentInput, actorId: string) {
    const visit = await this.prisma.visit.findUnique({ where: { id: visitId } });
    if (!visit) throw new NotFoundException('Visit not found');
    if (!visit.signedAt) {
      throw new BadRequestException(
        'This visit is not signed yet — edit the field directly instead of creating an amendment.',
      );
    }
    if (!AMENDABLE_TABLES[input.targetTable]) {
      throw new BadRequestException(`'${input.targetTable}' is not an amendable table.`);
    }
    if (!input.reason?.trim()) {
      throw new BadRequestException('A reason is required for an amendment.');
    }
    if (!input.signatureBlobRef) {
      throw new BadRequestException('An amendment must be signed by the amending clinician.');
    }

    // Closed in Sprint 6: verify the caller's claimed oldValue against what
    // is actually stored (or, if this field was already amended before,
    // against the most recent *approved* amendment's newValue — corrections
    // chain rather than always comparing against the original row). A
    // mismatch is rejected outright rather than silently accepted, so a
    // stale client or an incorrect claim about the original value can't
    // sneak a wrong "before" state into the permanent record.
    const effectiveCurrent = await this.getEffectiveCurrentValue(
      input.targetTable,
      input.targetId,
      input.field,
      visitId,
    );
    if (effectiveCurrent !== null && effectiveCurrent !== input.oldValue) {
      throw new BadRequestException(
        `The claimed original value ('${input.oldValue}') does not match the actual current value ` +
          `('${effectiveCurrent}') of ${input.targetTable}.${input.field}. Refresh and try again.`,
      );
    }

    const lastSnapshot = await this.prisma.recordSnapshot.findFirst({
      where: { visitId },
      orderBy: { versionNo: 'desc' },
    });
    const nextVersion = (lastSnapshot?.versionNo ?? 0) + 1;

    const amendment = await this.prisma.amendment.create({
      data: {
        visitId,
        targetTable: input.targetTable,
        targetId: input.targetId,
        field: input.field,
        oldValue: input.oldValue,
        newValue: input.newValue,
        reason: input.reason,
        amendedBy: actorId,
        signatureBlobRef: input.signatureBlobRef,
        resultingSnapshotVersion: nextVersion,
      },
    });

    await this.audit.write({
      actorId,
      action: 'amendment.create',
      entityType: 'Amendment',
      entityId: amendment.id,
      visitId,
      before: { [input.field]: input.oldValue },
      after: { [input.field]: input.newValue },
      reason: input.reason,
    });

    // The amendment is recorded immediately, but it is NOT applied to the
    // rendered view until approved — see AmendmentsService.approve and
    // RecordService.getCurrentView.
    return amendment;
  }

  async approve(amendmentId: string, input: ApproveAmendmentInput, approverId: string) {
    const amendment = await this.prisma.amendment.findUnique({ where: { id: amendmentId } });
    if (!amendment) throw new NotFoundException('Amendment not found');

    const existingApprovals = await this.prisma.amendmentApproval.findMany({ where: { amendmentId } });
    if (existingApprovals.some((a) => a.decision === 'approved')) {
      throw new ForbiddenException('This amendment has already been approved.');
    }

    const approval = await this.prisma.amendmentApproval.create({
      data: { amendmentId, approverId, decision: input.decision, note: input.note },
    });

    await this.audit.write({
      actorId: approverId,
      action: `amendment.${input.decision}`,
      entityType: 'AmendmentApproval',
      entityId: approval.id,
      visitId: amendment.visitId,
      reason: input.note,
    });

    if (input.decision === 'approved') {
      // A newly-approved amendment changes the current view, so snapshot it —
      // this is what resultingSnapshotVersion on the amendment points to.
      const view = await this.record.getCurrentView(amendment.visitId);
      const canonicalString = this.record.canonicalize(view.record);
      const hash = this.record.hash(canonicalString);
      await this.prisma.recordSnapshot.create({
        data: {
          visitId: amendment.visitId,
          versionNo: amendment.resultingSnapshotVersion,
          canonicalJson: JSON.parse(canonicalString),
          hash,
          createdBy: approverId,
        },
      });
    }

    return approval;
  }

  async list(visitId: string) {
    return this.prisma.amendment.findMany({
      where: { visitId },
      include: { approvals: true },
      orderBy: { amendedAt: 'asc' },
    });
  }

  /**
   * Returns the value create() should treat as "current" for comparison
   * against the caller's claimed oldValue: the newValue of the most recent
   * *approved* prior amendment to this exact field if one exists, otherwise
   * whatever is actually stored in the target row. Returns null only if the
   * target table isn't in the whitelist or the target row can't be found —
   * both of those are already separately rejected elsewhere in create(), so
   * null here is "nothing to compare against", not "comparison skipped".
   */
  private async getEffectiveCurrentValue(
    targetTable: string,
    targetId: string,
    field: string,
    visitId: string,
  ): Promise<string | null> {
    const priorApproved = await this.prisma.amendment.findFirst({
      where: { visitId, targetTable, targetId, field, approvals: { some: { decision: 'approved' } } },
      orderBy: { amendedAt: 'desc' },
    });
    if (priorApproved) return priorApproved.newValue;

    return this.readStoredValue(targetTable, targetId, field);
  }

  private async readStoredValue(targetTable: string, targetId: string, field: string): Promise<string | null> {
    const reader = AMENDABLE_TABLES[targetTable];
    if (!reader) return null;

    const model = (this.prisma as any)[reader.prismaModel];
    const row = reader.singleKeyedByVisit
      ? await model.findUnique({ where: { visitId: targetId } })
      : await model.findUnique({ where: { id: targetId } });
    if (!row) return null;

    const value = row[field];
    if (value === undefined) {
      throw new BadRequestException(`'${field}' is not a field on ${targetTable}.`);
    }
    return this.stringifyValue(value);
  }

  /** Matches how values round-trip through the Nest/class-validator layer on the way in, so a stored Date compares correctly against an ISO string the client sent. */
  private stringifyValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }
}
