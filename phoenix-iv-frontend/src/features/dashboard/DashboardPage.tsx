import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import type { DashboardSummary, DashboardVisitSummary } from '../../api/types';
import { slugForStatus } from '../visits/steps';

function statusLabel(status: string) {
  return status
    .toLowerCase()
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

function VisitRow({ visit }: { visit: DashboardVisitSummary }) {
  const slug = slugForStatus(visit.status);
  return (
    <li
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 'var(--space-3) 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div>
        <div style={{ fontWeight: 500 }}>{visit.patientName}</div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-soft)' }}>
          Started {new Date(visit.startedAt).toLocaleString()}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <span className={`badge ${visit.status === 'SIGNED' ? 'badge-done' : ''}`}>{statusLabel(visit.status)}</span>
        <Link to={`/visits/${visit.visitId}/${slug}`} className="btn-secondary" style={{ textDecoration: 'none' }}>
          Open
        </Link>
      </div>
    </li>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    DashboardApi.get()
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load the dashboard.'));
  }, []);

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--space-5)' }}>
        <h1>Visits</h1>
        <Link to="/patients/new" className="btn-primary" style={{ textDecoration: 'none' }}>
          Register a new patient
        </Link>
      </div>

      {error && <p className="field-error">{error}</p>}

      {!data && !error && <p>Loading…</p>}

      {data && (
        <>
          <section className="card" style={{ marginBottom: 'var(--space-5)' }}>
            <h2>In progress ({data.incompleteVisits.length})</h2>
            {data.incompleteVisits.length === 0 ? (
              <p style={{ color: 'var(--ink-soft)' }}>No visits in progress right now.</p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {data.incompleteVisits.map((v) => (
                  <VisitRow key={v.visitId} visit={v} />
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h2>Completed ({data.completedVisits.length})</h2>
            {data.completedVisits.length === 0 ? (
              <p style={{ color: 'var(--ink-soft)' }}>No signed visits yet.</p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {data.completedVisits.map((v) => (
                  <VisitRow key={v.visitId} visit={v} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
