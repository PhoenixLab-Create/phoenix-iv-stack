import type { VisitStatus } from '../../api/types';

/**
 * The 14-step workflow, in order, matching the status each step's screen
 * acts on. Verified directly against every VisitsService.transition() call
 * in the backend (one grep across src/**​/*.service.ts), not assumed from
 * the PRD prose:
 *
 *   REGISTERED --(intake submitted)--> SAFETY_SCREENING    [IntakeController]
 *   (intake screen is shown while status === 'INTAKE', entered right after
 *    VisitsService.start(); there's no separate "start intake" transition —
 *    a fresh visit begins at REGISTERED and intake.submit() is what first
 *    advances it, straight to SAFETY_SCREENING)
 *   SAFETY_SCREENING --(screening complete)--> CLINICIAN_ASSESSMENT
 *   CLINICIAN_ASSESSMENT --(decision: Proceed)--> ORDER_AUTHORIZATION
 *   ORDER_AUTHORIZATION --(order authorized)--> PROTOCOL_SELECTED
 *   PROTOCOL_SELECTED --(protocol selected)--> CONSENT
 *   CONSENT --(consent signed)--> IV_PREPARATION
 *   IV_PREPARATION --(preparation recorded)--> IV_INSERTION
 *   IV_INSERTION --(insertion recorded)--> INFUSION_MONITORING
 *   INFUSION_MONITORING --(not tolerating)--> ADVERSE_EVENT   [auto-routed]
 *   INFUSION_MONITORING --(monitoring complete)--> TREATMENT_COMPLETION
 *   ADVERSE_EVENT --(resolution)--> INFUSION_MONITORING | TREATMENT_COMPLETION
 *   TREATMENT_COMPLETION --(treatment completed)--> PENDING_SIGNOFF
 *   PENDING_SIGNOFF --(signed)--> SIGNED
 */
export interface StepDef {
  status: VisitStatus;
  slug: string;
  label: string;
  /** True for the one step the PRD auto-routes to — not part of the normal numbered sequence. */
  branch?: boolean;
}

export const WORKFLOW_STEPS: StepDef[] = [
  { status: 'REGISTERED', slug: 'intake', label: 'Patient intake' },
  { status: 'INTAKE', slug: 'intake', label: 'Patient intake' },
  { status: 'SAFETY_SCREENING', slug: 'screening', label: 'Safety screening' },
  { status: 'CLINICIAN_ASSESSMENT', slug: 'assessment', label: 'Clinician assessment' },
  { status: 'ORDER_AUTHORIZATION', slug: 'order', label: 'Order authorization' },
  { status: 'PROTOCOL_SELECTED', slug: 'protocol', label: 'Protocol selection' },
  { status: 'CONSENT', slug: 'consent', label: 'Informed consent' },
  { status: 'IV_PREPARATION', slug: 'prep', label: 'IV preparation' },
  { status: 'IV_INSERTION', slug: 'insertion', label: 'IV insertion' },
  { status: 'INFUSION_MONITORING', slug: 'monitoring', label: 'Infusion monitoring' },
  { status: 'ADVERSE_EVENT', slug: 'adverse-event', label: 'Adverse event', branch: true },
  { status: 'TREATMENT_COMPLETION', slug: 'completion', label: 'Treatment completion' },
  { status: 'PENDING_SIGNOFF', slug: 'signoff', label: 'Clinician sign-off' },
  { status: 'SIGNED', slug: 'record', label: 'Final clinical record' },
];

/** The numbered rail shown in the sidebar — collapses REGISTERED/INTAKE into one entry and drops the branch-only adverse-event state. */
export const RAIL_STEPS: StepDef[] = [
  { status: 'INTAKE', slug: 'intake', label: 'Patient intake' },
  { status: 'SAFETY_SCREENING', slug: 'screening', label: 'Safety screening' },
  { status: 'CLINICIAN_ASSESSMENT', slug: 'assessment', label: 'Clinician assessment' },
  { status: 'ORDER_AUTHORIZATION', slug: 'order', label: 'Order authorization' },
  { status: 'PROTOCOL_SELECTED', slug: 'protocol', label: 'Protocol selection' },
  { status: 'CONSENT', slug: 'consent', label: 'Informed consent' },
  { status: 'IV_PREPARATION', slug: 'prep', label: 'IV preparation' },
  { status: 'IV_INSERTION', slug: 'insertion', label: 'IV insertion' },
  { status: 'INFUSION_MONITORING', slug: 'monitoring', label: 'Infusion monitoring' },
  { status: 'TREATMENT_COMPLETION', slug: 'completion', label: 'Treatment completion' },
  { status: 'PENDING_SIGNOFF', slug: 'signoff', label: 'Clinician sign-off' },
  { status: 'SIGNED', slug: 'record', label: 'Final clinical record' },
];

const RAIL_ORDER = RAIL_STEPS.map((s) => s.status);

/** Terminal/non-progressing statuses — never shown as "in progress" on the rail. */
const TERMINAL: VisitStatus[] = ['SIGNED', 'NOT_PROCEEDING', 'CANCELLED'];

export type RailState = 'done' | 'current' | 'upcoming';

export function railStateFor(stepStatus: VisitStatus, visitStatus: VisitStatus): RailState {
  if (visitStatus === 'ADVERSE_EVENT') {
    // While resolving an adverse event, monitoring is the step that's
    // "current" from the rail's point of view — the branch has its own
    // banner, handled separately by the layout.
    return railStateFor(stepStatus, 'INFUSION_MONITORING');
  }
  const currentIdx = RAIL_ORDER.indexOf(visitStatus);
  const stepIdx = RAIL_ORDER.indexOf(stepStatus);
  if (currentIdx === -1 || stepIdx === -1) return 'upcoming';
  if (stepIdx < currentIdx) return 'done';
  if (stepIdx === currentIdx) return 'current';
  return 'upcoming';
}

export function isTerminalStatus(status: VisitStatus): boolean {
  return TERMINAL.includes(status);
}

export function slugForStatus(status: VisitStatus): string {
  if (status === 'ADVERSE_EVENT') return 'adverse-event';
  const step = WORKFLOW_STEPS.find((s) => s.status === status);
  return step?.slug ?? 'intake';
}
