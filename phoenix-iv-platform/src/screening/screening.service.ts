import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { VisitsService } from '../visits/visits.service';
import { evaluateRule, IntakeDataView, RuleExpression } from './rule-evaluator';

/**
 * This service NEVER decides eligibility. Its only output is a list of
 * "⚠ CLINICAL REVIEW REQUIRED" flags — each one traces back to a specific,
 * clinic-authored, Medical-Director-approved ScreeningRule row. There is no
 * code path here that produces a "cleared" or "eligible" status; the closest
 * thing to a green light is simply "no active rule matched," which is
 * reported as an absence of flags, not an affirmative clearance.
 */
@Injectable()
export class ScreeningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly visits: VisitsService,
  ) {}

  private async buildIntakeDataView(visitId: string): Promise<IntakeDataView> {
    const intake = await this.prisma.intakeForm.findUnique({
      where: { visitId },
      include: { answers: true },
    });
    if (!intake) {
      throw new BadRequestException('Cannot run safety screening before intake is submitted');
    }
    const view: IntakeDataView = { conditions: {} };
    for (const ans of intake.answers) {
      const val = ans.answerValue as unknown;
      if (ans.questionKey.startsWith('conditions.')) {
        const condName = ans.questionKey.slice('conditions.'.length);
        view.conditions[condName] = !!val;
      } else {
        (view as Record<string, unknown>)[ans.questionKey] = val;
      }
    }
    return view;
  }

  /**
   * Evaluates every active, approved rule against this visit's intake and
   * persists any new matches as ScreeningFlag rows (idempotent — re-running
   * does not duplicate a flag already raised for the same rule version).
   */
  async runScreening(visitId: string, actorId: string) {
    const data = await this.buildIntakeDataView(visitId);
    const rules = await this.prisma.screeningRule.findMany({
      where: { active: true, approvedAt: { not: null } }, // unapproved rules never fire, even if marked active by mistake
    });

    const raised: { ruleId: string; message: string }[] = [];
    for (const rule of rules) {
      let matched: boolean;
      try {
        matched = evaluateRule(rule.expression as unknown as RuleExpression, data);
      } catch (err) {
        // A malformed rule must not silently fail open OR crash the whole
        // screening step for every patient — surface it loudly instead.
        await this.audit.write({
          actorId,
          action: 'screening.rule_evaluation_error',
          entityType: 'ScreeningRule',
          entityId: rule.id,
          visitId,
          reason: (err as Error).message,
        });
        continue;
      }
      if (!matched) continue;

      const existing = await this.prisma.screeningFlag.findFirst({
        where: { visitId, ruleId: rule.id, ruleVersion: rule.version },
      });
      if (existing) continue;

      await this.prisma.screeningFlag.create({
        data: { visitId, ruleId: rule.id, ruleVersion: rule.version },
      });
      raised.push({ ruleId: rule.id, message: rule.message });
    }

    await this.audit.write({
      actorId,
      action: 'screening.run',
      entityType: 'Visit',
      entityId: visitId,
      visitId,
      after: { flagsRaised: raised.length },
    });

    return this.listFlags(visitId);
  }

  async listFlags(visitId: string) {
    return this.prisma.screeningFlag.findMany({
      where: { visitId },
      include: { rule: true },
      orderBy: { raisedAt: 'asc' },
    });
  }

  /** Every flag requires an explicit clinician response — there is no bulk "acknowledge all". */
  async acknowledge(flagId: string, clinicianResponse: string, actorId: string) {
    const flag = await this.prisma.screeningFlag.findUnique({ where: { id: flagId } });
    if (!flag) throw new NotFoundException('Screening flag not found');
    if (flag.acknowledgedAt) {
      throw new ForbiddenException('This flag has already been acknowledged and cannot be re-acknowledged silently — use an amendment if the response was wrong.');
    }
    if (!clinicianResponse?.trim()) {
      throw new BadRequestException('A clinician response is required to acknowledge a screening flag');
    }

    const updated = await this.prisma.screeningFlag.update({
      where: { id: flagId },
      data: { acknowledgedBy: actorId, acknowledgedAt: new Date(), clinicianResponse },
    });

    await this.audit.write({
      actorId,
      action: 'screening_flag.acknowledge',
      entityType: 'ScreeningFlag',
      entityId: flagId,
      visitId: flag.visitId,
      after: { clinicianResponse },
    });

    return updated;
  }

  /** Used by the sign-off completeness check — never used to gate an "eligible" decision, only to block sign-off on silence. */
  async allFlagsAcknowledged(visitId: string): Promise<boolean> {
    const flags = await this.listFlags(visitId);
    return flags.every((f) => !!f.acknowledgedAt);
  }

  /**
   * Explicit staff action to leave the screening step. Requires every raised
   * flag to be acknowledged first — there is no path that reaches clinician
   * assessment with a silent, unacknowledged flag still open.
   */
  async completeScreening(visitId: string, actorId: string) {
    const allAcked = await this.allFlagsAcknowledged(visitId);
    if (!allAcked) {
      throw new ForbiddenException('All screening flags must be acknowledged before continuing.');
    }
    return this.visits.transition(visitId, 'CLINICIAN_ASSESSMENT' as any, actorId, 'screening complete');
  }
}
