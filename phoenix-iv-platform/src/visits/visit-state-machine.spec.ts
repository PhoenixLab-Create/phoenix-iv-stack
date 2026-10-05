import { VisitStatus } from '@prisma/client';
import { assertValidTransition, InvalidTransitionError, isTerminal } from './visit-state-machine';

describe('visit state machine', () => {
  it('allows the documented happy path in order', () => {
    const path: VisitStatus[] = [
      'REGISTERED', 'INTAKE', 'SAFETY_SCREENING', 'CLINICIAN_ASSESSMENT',
      'ORDER_AUTHORIZATION', 'PROTOCOL_SELECTED', 'CONSENT', 'IV_PREPARATION',
      'IV_INSERTION', 'INFUSION_MONITORING', 'TREATMENT_COMPLETION',
      'PENDING_SIGNOFF', 'SIGNED',
    ] as VisitStatus[];
    for (let i = 0; i < path.length - 1; i++) {
      expect(() => assertValidTransition(path[i], path[i + 1])).not.toThrow();
    }
  });

  it('rejects skipping a step (e.g. straight from intake to consent)', () => {
    expect(() => assertValidTransition('INTAKE' as VisitStatus, 'CONSENT' as VisitStatus)).toThrow(
      InvalidTransitionError,
    );
  });

  it('rejects any transition out of SIGNED (immutable/terminal)', () => {
    expect(() => assertValidTransition('SIGNED' as VisitStatus, 'CLINICIAN_ASSESSMENT' as VisitStatus)).toThrow(
      InvalidTransitionError,
    );
    expect(isTerminal('SIGNED' as VisitStatus)).toBe(true);
  });

  it('allows the adverse-event branch to resume monitoring or move to completion', () => {
    expect(() => assertValidTransition('INFUSION_MONITORING' as VisitStatus, 'ADVERSE_EVENT' as VisitStatus)).not.toThrow();
    expect(() => assertValidTransition('ADVERSE_EVENT' as VisitStatus, 'INFUSION_MONITORING' as VisitStatus)).not.toThrow();
    expect(() => assertValidTransition('ADVERSE_EVENT' as VisitStatus, 'TREATMENT_COMPLETION' as VisitStatus)).not.toThrow();
  });

  it('treats NOT_PROCEEDING as a valid, terminal exit from assessment', () => {
    expect(() => assertValidTransition('CLINICIAN_ASSESSMENT' as VisitStatus, 'NOT_PROCEEDING' as VisitStatus)).not.toThrow();
    expect(isTerminal('NOT_PROCEEDING' as VisitStatus)).toBe(true);
  });
});
