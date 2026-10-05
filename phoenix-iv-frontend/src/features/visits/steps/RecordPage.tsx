import { useEffect, useState } from 'react';
import { useVisit } from '../VisitContext';
import { RecordApi } from '../../../api/endpoints';
import type { RecordView } from '../../../api/types';

export default function RecordPage() {
  const { visit } = useVisit();
  const [record, setRecord] = useState<RecordView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    RecordApi.get(visit.id)
      .then(setRecord)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the final record.'));
  }, [visit.id]);

  return (
    <div>
      <h1>Final clinical record</h1>
      <p style={{ color: 'var(--ink-soft)' }}>
        This is the permanent, signed record for this visit, with any approved amendments overlaid. A pending
        amendment is shown as pending, never silently applied.
      </p>

      <div style={{ marginBottom: 'var(--space-5)' }}>
        <a href={RecordApi.pdfUrl(visit.id)} target="_blank" rel="noreferrer" className="btn-primary" style={{ textDecoration: 'none' }}>
          Open as PDF
        </a>
      </div>

      {error && <p role="alert" className="field-error">{error}</p>}
      {!record && !error && <p>Loading…</p>}

      {record && (
        <div className="card">
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', margin: 0 }}>
            {JSON.stringify(record, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
