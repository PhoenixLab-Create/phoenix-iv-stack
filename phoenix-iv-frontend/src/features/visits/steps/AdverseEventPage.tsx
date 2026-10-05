import { useEffect, useState } from 'react';
import { useVisit } from '../VisitContext';
import { useAsyncAction } from '../useAsyncAction';
import { AdverseEventApi } from '../../../api/endpoints';
import type { AdverseEvent, RecordAdverseEventInput } from '../../../api/types';
import VitalsFields from '../components/VitalsFields';

function nowLocalIso(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

const EMPTY: RecordAdverseEventInput = {
  onsetTime: nowLocalIso(),
  signsSymptoms: '',
  infusionAction: 'stopped',
  vitals: {},
  interventions: '',
  medicationGiven: '',
  prescriberContacted: '',
  emsContacted: false,
  patientResponse: '',
  outcome: '',
  hospitalTransfer: false,
  resolution: 'resume_monitoring',
};

export default function AdverseEventPage() {
  const { visit, reload } = useVisit();
  const [past, setPast] = useState<AdverseEvent[]>([]);
  const [form, setForm] = useState<RecordAdverseEventInput>(EMPTY);

  useEffect(() => {
    AdverseEventApi.list(visit.id).then(setPast).catch(() => undefined);
  }, [visit.id]);

  const submit = useAsyncAction(async () => {
    if (!form.signsSymptoms.trim()) throw new Error('Signs and symptoms are required.');
    if (!form.outcome.trim()) throw new Error('Outcome is required.');
    await AdverseEventApi.record(visit.id, {
      ...form,
      onsetTime: new Date(form.onsetTime).toISOString(),
    });
    await reload();
  });

  if (visit.status !== 'ADVERSE_EVENT') {
    return <p>No adverse event is currently open for this visit.</p>;
  }

  return (
    <div>
      <h1>Adverse event</h1>
      <p style={{ color: 'var(--ink-soft)' }}>
        Document exactly what happened and what the clinician did. There is no emergency-protocol logic or
        suggested intervention here — this records the clinician's own response.
      </p>

      {past.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
          <h2>Previously recorded this visit</h2>
          {past.map((ae) => (
            <div key={ae.id} style={{ marginBottom: 'var(--space-3)', paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--border)' }}>
              <strong>{new Date(ae.onsetTime).toLocaleString()}</strong>
              <p style={{ margin: 'var(--space-1) 0' }}>{ae.signsSymptoms}</p>
              <p style={{ margin: 0, color: 'var(--ink-soft)' }}>Outcome: {ae.outcome || 'pending'}</p>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <div>
            <label htmlFor="onsetTime">Onset time</label>
            <input
              id="onsetTime"
              type="datetime-local"
              value={form.onsetTime}
              onChange={(e) => setForm((f) => ({ ...f, onsetTime: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="infusionAction">Infusion action taken</label>
            <select
              id="infusionAction"
              value={form.infusionAction}
              onChange={(e) => setForm((f) => ({ ...f, infusionAction: e.target.value as RecordAdverseEventInput['infusionAction'] }))}
            >
              <option value="stopped">Stopped</option>
              <option value="modified">Modified</option>
              <option value="continued">Continued</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label htmlFor="signsSymptoms">Signs &amp; symptoms</label>
          <textarea id="signsSymptoms" required value={form.signsSymptoms} onChange={(e) => setForm((f) => ({ ...f, signsSymptoms: e.target.value }))} />
        </div>

        <h3>Vitals at time of event</h3>
        <VitalsFields value={form.vitals ?? {}} onChange={(vitals) => setForm((f) => ({ ...f, vitals }))} />

        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label htmlFor="interventions">Interventions</label>
          <textarea id="interventions" value={form.interventions} onChange={(e) => setForm((f) => ({ ...f, interventions: e.target.value }))} />
        </div>

        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label htmlFor="medicationGiven">Medication given</label>
          <input id="medicationGiven" value={form.medicationGiven} onChange={(e) => setForm((f) => ({ ...f, medicationGiven: e.target.value }))} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <div>
            <label htmlFor="prescriberContacted">Prescriber contacted</label>
            <input id="prescriberContacted" value={form.prescriberContacted} onChange={(e) => setForm((f) => ({ ...f, prescriberContacted: e.target.value }))} />
          </div>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-5)' }}>
              <input type="checkbox" checked={form.emsContacted} onChange={(e) => setForm((f) => ({ ...f, emsContacted: e.target.checked }))} />
              EMS contacted
            </label>
          </div>
        </div>

        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label htmlFor="patientResponse">Patient response</label>
          <textarea id="patientResponse" value={form.patientResponse} onChange={(e) => setForm((f) => ({ ...f, patientResponse: e.target.value }))} />
        </div>

        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label htmlFor="outcome">Outcome</label>
          <textarea id="outcome" required value={form.outcome} onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))} />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          <input type="checkbox" checked={form.hospitalTransfer} onChange={(e) => setForm((f) => ({ ...f, hospitalTransfer: e.target.checked }))} />
          Transferred to hospital
        </label>

        <fieldset style={{ border: 'none', padding: 0, margin: '0 0 var(--space-5)' }}>
          <legend style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>What happens next</legend>
          <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontWeight: 400 }}>
              <input
                type="radio"
                name="resolution"
                checked={form.resolution === 'resume_monitoring'}
                onChange={() => setForm((f) => ({ ...f, resolution: 'resume_monitoring' }))}
              />{' '}
              Resume monitoring
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontWeight: 400 }}>
              <input
                type="radio"
                name="resolution"
                checked={form.resolution === 'move_to_completion'}
                onChange={() => setForm((f) => ({ ...f, resolution: 'move_to_completion' }))}
              />{' '}
              Move to treatment completion
            </label>
          </div>
        </fieldset>

        {submit.error && <p role="alert" className="field-error">{submit.error}</p>}
        <button type="button" className="btn-primary" onClick={() => void submit.run()} disabled={submit.busy}>
          {submit.busy ? 'Saving…' : 'Save adverse event and continue'}
        </button>
      </div>
    </div>
  );
}
