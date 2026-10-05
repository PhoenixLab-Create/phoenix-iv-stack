import { useState } from 'react';
import { useVisit } from '../VisitContext';
import { useAsyncAction } from '../useAsyncAction';
import { CompletionApi } from '../../../api/endpoints';
import type { RecordCompletionInput } from '../../../api/types';

const EMPTY: RecordCompletionInput = {
  totalInfusedMl: undefined,
  patientCondition: '',
  catheterRemoved: undefined,
  catheterIntact: undefined,
  siteCondition: '',
  dressingApplied: undefined,
  adverseEventOccurred: false,
  aftercareProvided: false,
};

function TriStateCheckbox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | undefined;
  onChange: (v: boolean) => void;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
      <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export default function CompletionPage() {
  const { visit, reload } = useVisit();
  const [form, setForm] = useState<RecordCompletionInput>(EMPTY);

  const submit = useAsyncAction(async () => {
    if (!form.aftercareProvided) {
      throw new Error('Aftercare must be confirmed as provided before completion can be recorded.');
    }
    await CompletionApi.record(visit.id, form);
    await reload();
  });

  if (visit.status !== 'TREATMENT_COMPLETION') {
    return <p>Treatment completion was already recorded for this visit.</p>;
  }

  return (
    <div>
      <h1>Treatment completion</h1>
      <p style={{ color: 'var(--ink-soft)' }}>
        Aftercare confirmation is required before this step can be completed — it's one of the sign-off gates.
      </p>
      <div className="card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <div>
            <label htmlFor="totalInfused">Total infused (mL)</label>
            <input
              id="totalInfused"
              type="number"
              value={form.totalInfusedMl ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, totalInfusedMl: e.target.value === '' ? undefined : Number(e.target.value) }))}
            />
          </div>
          <div>
            <label htmlFor="patientCondition">Patient condition</label>
            <input id="patientCondition" value={form.patientCondition} onChange={(e) => setForm((f) => ({ ...f, patientCondition: e.target.value }))} />
          </div>
        </div>

        <TriStateCheckbox label="Catheter removed" value={form.catheterRemoved} onChange={(v) => setForm((f) => ({ ...f, catheterRemoved: v }))} />
        <TriStateCheckbox label="Catheter intact" value={form.catheterIntact} onChange={(v) => setForm((f) => ({ ...f, catheterIntact: v }))} />
        <TriStateCheckbox label="Dressing applied" value={form.dressingApplied} onChange={(v) => setForm((f) => ({ ...f, dressingApplied: v }))} />

        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label htmlFor="siteCondition">Site condition</label>
          <input id="siteCondition" value={form.siteCondition} onChange={(e) => setForm((f) => ({ ...f, siteCondition: e.target.value }))} />
        </div>

        <TriStateCheckbox
          label="An adverse event occurred during this visit"
          value={form.adverseEventOccurred}
          onChange={(v) => setForm((f) => ({ ...f, adverseEventOccurred: v }))}
        />
        <TriStateCheckbox
          label="Aftercare instructions were provided to the patient"
          value={form.aftercareProvided}
          onChange={(v) => setForm((f) => ({ ...f, aftercareProvided: v }))}
        />

        {submit.error && <p role="alert" className="field-error">{submit.error}</p>}
        <button type="button" className="btn-primary" onClick={() => void submit.run()} disabled={submit.busy}>
          {submit.busy ? 'Saving…' : 'Save completion and continue'}
        </button>
      </div>
    </div>
  );
}
