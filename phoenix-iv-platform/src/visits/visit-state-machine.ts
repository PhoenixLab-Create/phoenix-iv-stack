import { VisitStatus } from '@prisma/client';

/**
 * Encodes the workflow from the architecture review, §1.1. This is the single
 * source of truth for "what can follow what" — controllers must call
 * assertValidTransition() before writing a status change, rather than trusting
 * the caller's intent, so the step order in the PRD can't be bypassed by a
 * malformed or malicious request.
 */
const ALLOWED_TRANSITIONS: Record<VisitStatus, VisitStatus[]> = {
  REGISTERED: ['INTAKE', 'CANCELLED'],
  INTAKE: ['SAFETY_SCREENING', 'CANCELLED'],
  SAFETY_SCREENING: ['CLINICIAN_ASSESSMENT', 'CANCELLED'],
  CLINICIAN_ASSESSMENT: ['ORDER_AUTHORIZATION', 'NOT_PROCEEDING', 'CANCELLED'],
  ORDER_AUTHORIZATION: ['PROTOCOL_SELECTED', 'CANCELLED'],
  PROTOCOL_SELECTED: ['CONSENT', 'CANCELLED'],
  CONSENT: ['IV_PREPARATION', 'CANCELLED'],
  IV_PREPARATION: ['IV_INSERTION', 'CANCELLED'],
  IV_INSERTION: ['INFUSION_MONITORING', 'CANCELLED'],
  INFUSION_MONITORING: ['ADVERSE_EVENT', 'TREATMENT_COMPLETION'],
  ADVERSE_EVENT: ['INFUSION_MONITORING', 'TREATMENT_COMPLETION'], // resume monitoring or move to completion
  TREATMENT_COMPLETION: ['PENDING_SIGNOFF'],
  PENDING_SIGNOFF: ['SIGNED', 'CLINICIAN_ASSESSMENT'], // back to assessment only if sign-off reveals a gap, pre-sign
  SIGNED: [], // terminal — see amendments, not further status transitions
  NOT_PROCEEDING: [], // terminal — still part of the record
  CANCELLED: [], // terminal
};

export class InvalidTransitionError extends Error {}

export function assertValidTransition(from: VisitStatus, to: VisitStatus): void {
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new InvalidTransitionError(`Cannot transition visit from ${from} to ${to}`);
  }
}

export function isTerminal(status: VisitStatus): boolean {
  return ALLOWED_TRANSITIONS[status]?.length === 0;
}
