import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../config/prisma.service';

/**
 * Builds the "Final Clinical Record" (PRD §16, items 1–14) from the
 * underlying tables. This is read-only aggregation — it never writes
 * anything. Two consumers:
 *   - SignoffService: hashes the canonical form at the moment of signing.
 *   - RecordController: renders the current view (original + amendment
 *     overlay) on screen and as PDF.
 *
 * "Current view" means: start from the original signed values, then for
 * every Amendment targeting a given (table, targetId, field), show the
 * amendment's newValue instead, with a visible marker — the original
 * value is never deleted or hidden, only superseded in the rendered view.
 */
@Injectable()
export class RecordService {
  constructor(private readonly prisma: PrismaService) {}

  async getCanonical(visitId: string) {
    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        patient: { include: { contacts: true } },
        intake: { include: { answers: true, medications: true, allergies: true } },
        screeningFlags: { include: { rule: true } },
        assessment: true,
        order: true,
        protocolSelection: { include: { protocol: true } },
        consent: true,
        preparation: { include: { items: { include: { product: true, lot: true } }, baseProduct: true } },
        ivInsertion: true,
        monitoringEntries: true,
        adverseEvents: true,
        completion: true,
        signoff: true,
        vitalSets: true,
      },
    });
    if (!visit) throw new NotFoundException('Visit not found');
    return visit;
  }

  /** Deterministic string form used for hashing — stable key order matters, so this is hand-built rather than relying on JSON.stringify's own key order. */
  canonicalize(record: unknown): string {
    const sortKeys = (value: any): any => {
      if (Array.isArray(value)) return value.map(sortKeys);
      if (value && typeof value === 'object' && !(value instanceof Date)) {
        return Object.keys(value)
          .sort()
          .reduce((acc: any, key) => {
            acc[key] = sortKeys(value[key]);
            return acc;
          }, {});
      }
      return value;
    };
    return JSON.stringify(sortKeys(record));
  }

  hash(canonicalString: string): string {
    return createHash('sha256').update(canonicalString).digest('hex');
  }

  /** Overlays approved amendments onto the canonical record for display. Unapproved amendments are shown separately as "pending", never silently applied. */
  async getCurrentView(visitId: string) {
    const canonical = await this.getCanonical(visitId);
    const amendments = await this.prisma.amendment.findMany({
      where: { visitId },
      include: { approvals: true },
      orderBy: { amendedAt: 'asc' },
    });

    const view = JSON.parse(JSON.stringify(canonical)); // plain deep clone for overlay
    const appliedMarkers: { targetTable: string; targetId: string; field: string; amendmentId: string }[] = [];
    const pending: typeof amendments = [];

    for (const amendment of amendments) {
      const isApproved = amendment.approvals.some((a) => a.decision === 'approved');
      if (!isApproved) {
        pending.push(amendment);
        continue;
      }
      // Best-effort overlay for the sections we know how to locate by id.
      // Anything not matched here still exists in full in `amendments` and
      // is surfaced in the amendment appendix regardless.
      this.applyOverlay(view, amendment);
      appliedMarkers.push({
        targetTable: amendment.targetTable,
        targetId: amendment.targetId,
        field: amendment.field,
        amendmentId: amendment.id,
      });
    }

    return { record: view, appliedAmendments: appliedMarkers, pendingAmendments: pending };
  }

  private applyOverlay(view: any, amendment: { targetTable: string; targetId: string; field: string; newValue: string }) {
    const sectionMap: Record<string, any> = {
      assessments: view.assessment,
      orders: view.order,
      consents: view.consent,
      treatment_completions: view.completion,
      iv_insertions: view.ivInsertion,
    };
    const single = sectionMap[amendment.targetTable];
    if (single && (single.visitId === amendment.targetId || !single.visitId)) {
      single[amendment.field] = amendment.newValue;
      single[`${amendment.field}__amended`] = true;
      return;
    }
    const listMap: Record<string, any[] | undefined> = {
      adverse_events: view.adverseEvents,
      infusion_monitoring_entries: view.monitoringEntries,
    };
    const list = listMap[amendment.targetTable];
    const row = list?.find((r: any) => r.id === amendment.targetId);
    if (row) {
      row[amendment.field] = amendment.newValue;
      row[`${amendment.field}__amended`] = true;
    }
    // If neither matched, the amendment still exists in full in the
    // `amendments` table and appendix — it just isn't inlined into that
    // specific section's display, which is a display-completeness gap to
    // extend as more target tables are whitelisted, not a data-loss risk.
  }
}
