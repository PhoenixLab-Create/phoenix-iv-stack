import { NavLink, Outlet } from 'react-router-dom';
import { VisitProvider, useVisit } from './VisitContext';
import { RAIL_STEPS, railStateFor, isTerminalStatus } from './steps';
import './visit-layout.css';

function Rail() {
  const { visit } = useVisit();

  return (
    <nav aria-label="Visit workflow steps">
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {RAIL_STEPS.map((step, i) => {
          const state = railStateFor(step.status, visit.status);
          const reachable = state !== 'upcoming' || isTerminalStatus(visit.status);
          return (
            <li key={step.status} style={{ marginBottom: 'var(--space-1)' }}>
              {reachable ? (
                <NavLink
                  to={`/visits/${visit.id}/${step.slug}`}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-sm)',
                    textDecoration: 'none',
                    color: isActive ? '#fff' : 'var(--ink)',
                    background: isActive ? 'var(--sage-deep)' : 'transparent',
                    fontWeight: isActive ? 600 : 400,
                  })}
                >
                  <StepMarker index={i + 1} state={state} />
                  <span>{step.label}</span>
                </NavLink>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    padding: 'var(--space-2) var(--space-3)',
                    color: 'var(--disabled-text)',
                  }}
                  aria-disabled="true"
                >
                  <StepMarker index={i + 1} state={state} />
                  <span>{step.label}</span>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {visit.status === 'ADVERSE_EVENT' && (
        <div className="badge badge-danger" style={{ marginTop: 'var(--space-3)', width: '100%', justifyContent: 'center' }}>
          Adverse event in progress
        </div>
      )}
      {visit.status === 'NOT_PROCEEDING' && (
        <div className="badge badge-attention" style={{ marginTop: 'var(--space-3)', width: '100%', justifyContent: 'center' }}>
          Not proceeding
        </div>
      )}
      {visit.status === 'CANCELLED' && (
        <div className="badge" style={{ marginTop: 'var(--space-3)', width: '100%', justifyContent: 'center' }}>
          Cancelled
        </div>
      )}
    </nav>
  );
}

function StepMarker({ index, state }: { index: number; state: 'done' | 'current' | 'upcoming' }) {
  const bg = state === 'done' ? 'var(--sage)' : state === 'current' ? 'currentColor' : 'var(--border-strong)';
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '1.5rem',
        height: '1.5rem',
        borderRadius: '50%',
        fontSize: 'var(--fs-xs)',
        flexShrink: 0,
        border: `1.5px solid ${bg}`,
        color: state === 'done' ? 'var(--sage-deep)' : 'inherit',
      }}
    >
      {state === 'done' ? '✓' : index}
    </span>
  );
}

function VisitHeader() {
  const { visit } = useVisit();
  return (
    <div style={{ marginBottom: 'var(--space-5)' }}>
      <div className="mono" style={{ color: 'var(--ink-soft)' }}>
        Visit {visit.id}
      </div>
      <div style={{ color: 'var(--ink-soft)', fontSize: 'var(--fs-sm)' }}>
        Started {new Date(visit.startedAt).toLocaleString()}
        {visit.signedAt && <> · Signed {new Date(visit.signedAt).toLocaleString()}</>}
      </div>
    </div>
  );
}

function VisitLayoutInner() {
  return (
    <div className="visit-layout">
      <aside>
        <Rail />
      </aside>
      <div style={{ minWidth: 0 }}>
        <VisitHeader />
        <Outlet />
      </div>
    </div>
  );
}

export default function VisitLayout() {
  return (
    <VisitProvider>
      <VisitLayoutInner />
    </VisitProvider>
  );
}
