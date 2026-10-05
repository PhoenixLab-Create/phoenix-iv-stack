import { useState } from 'react';
import { useVisit } from '../VisitContext';
import { useAsyncAction } from '../useAsyncAction';
import { AssessmentApi } from '../../../api/endpoints';
import type { RecordAssessmentInput } from '../../../api/types';
import VitalsFields from '../components/VitalsFields';

const EMPTY: RecordAssessmentInput = {
  reasonForVisit: '',
  notes: '',
  decision: 'Proceed',
  vitals: {},
};

export default function AssessmentPage() {
  const { visit, reload } = useVisit();
  const [form, setForm] = useState<RecordAssessmentInput>(EMPTY);

  const submit = useAsyncAction(async () => {
    if (!form.reasonForVisit.trim()) throw new Error('Reason for visit is required.');
    await AssessmentApi.record(visit.id, form);
    await reload();
  });

  if (visit.status !== 'CLINICIAN_ASSESSMENT') {
    return <p>Clinician assessment was already completed for this visit.</p>;
  }

  return (
    <div>
      <h1>Clinician assessment</h1>
      <p style={{ color: 'var(--ink-soft)' }}>
        This records the clinician's own decision about whether to proceed. Nothing here is computed or
        suggested by the system.
      </p>
      <div className="card">
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label htmlFor="reason">Reason for visit</label>
          <input
            id="reason"
            required
            value={form.reasonForVisit}
            onChange={(e) => setForm((f) => ({ ...f, reasonForVisit: e.target.value }))}
          />
        </div>

        <h3>Baseline vitals</h3>
        <VitalsFields value={form.vitals} onChange={(vitals) => setForm((f) => ({ ...f, vitals }))} />

        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label htmlFor="notes">Notes</label>
          <textarea id="notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>

        <fieldset style={{ border: 'none', padding: 0, margin: '0 0 var(--space-5)' }}>
          <legend style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>Decision</legend>
          <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontWeight: 400 }}>
              <input
                type="radio"
                name="decision"
                checked={form.decision === 'Proceed'}
                onChange={() => setForm((f) => ({ ...f, decision: 'Proceed' }))}
              />{' '}
              Proceed
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontWeight: 400 }}>
              <input
                type="radio"
                name="decision"
                checked={form.decision === 'Do not proceed'}
                onChange={() => setForm((f) => ({ ...f, decision: 'Do not proceed' }))}
              />{' '}
              Do not proceed
            </label>
          </div>
        </fieldset>

        {submit.error && <p role="alert" className="field-error">{submit.error}</p>}
        <button type="button" className="btn-primary" onClick={() => void submit.run()} disabled={submit.busy}>
          {submit.busy ? 'Saving…' : 'Save assessment and continue'}
        </button>
      </div>
    </div>
  );
}
