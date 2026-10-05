import { useEffect, useState } from 'react';
import { useVisit } from '../VisitContext';
import { useAsyncAction } from '../useAsyncAction';
import { MonitoringApi } from '../../../api/endpoints';
import type { MonitoringEntry, VitalsInput } from '../../../api/types';
import VitalsFields from '../components/VitalsFields';

function EntryRow({ entry }: { entry: MonitoringEntry }) {
  const v = entry.vitalSet;
  return (
    <div className="card" style={{ marginBottom: 'var(--space-3)', borderColor: entry.tolerating ? 'var(--border)' : 'var(--red)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <strong>{new Date(entry.eventTime).toLocaleTimeString()}</strong>
        <span className={`badge ${entry.tolerating ? 'badge-done' : 'badge-danger'}`}>
          {entry.tolerating ? 'Tolerating' : 'Not tolerating'}
        </span>
      </div>
      {v && (
        <p style={{ color: 'var(--ink-soft)', margin: 'var(--space-2) 0 0' }}>
          BP {v.bpSystolic ?? '—'}/{v.bpDiastolic ?? '—'} · HR {v.heartRate ?? '—'} · RR {v.respRate ?? '—'} · Temp{' '}
          {v.temperature ?? '—'}°C · SpO₂ {v.spo2 ?? '—'}%
        </p>
      )}
      {entry.symptomsObservation && <p style={{ margin: 'var(--space-2) 0 0' }}>{entry.symptomsObservation}</p>}
    </div>
  );
}

export default function MonitoringPage() {
  const { visit, reload } = useVisit();
  const [entries, setEntries] = useState<MonitoringEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [vitals, setVitals] = useState<VitalsInput>({});
  const [symptoms, setSymptoms] = useState('');
  const [tolerating, setTolerating] = useState<boolean | null>(null);

  const refresh = () => {
    MonitoringApi.list(visit.id)
      .then(setEntries)
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Could not load monitoring entries.'));
  };
  useEffect(refresh, [visit.id]);

  const addEntry = useAsyncAction(async () => {
    if (tolerating === null) throw new Error('Record whether the patient is tolerating the infusion.');
    await MonitoringApi.addEntry(visit.id, { vitals, symptomsObservation: symptoms || undefined, tolerating });
    setVitals({});
    setSymptoms('');
    setTolerating(null);
    refresh();
    await reload(); // tolerating=false auto-routes to ADVERSE_EVENT — the visit's status may have just changed
  });

  const complete = useAsyncAction(async () => {
    await MonitoringApi.complete(visit.id);
    await reload();
  });

  if (visit.status === 'ADVERSE_EVENT') {
    return (
      <div>
        <h1>Infusion monitoring</h1>
        <p className="badge badge-danger" style={{ marginBottom: 'var(--space-4)' }}>
          The last entry reported the patient was not tolerating the infusion
        </p>
        <p>
          The visit has moved to the adverse event step. Document what happened and the clinician's response
          there before monitoring can continue.
        </p>
      </div>
    );
  }

  if (visit.status !== 'INFUSION_MONITORING') {
    return <p>Infusion monitoring was already completed for this visit.</p>;
  }

  const lastEntry = entries?.[entries.length - 1];
  const canComplete = !!lastEntry?.tolerating;

  return (
    <div>
      <h1>Infusion monitoring</h1>
      <p style={{ color: 'var(--ink-soft)' }}>
        If a patient is reported as not tolerating the infusion, the visit automatically opens the adverse-event
        step — this only changes which screen comes next, it doesn't judge anything clinical.
      </p>

      {loadError && <p role="alert" className="field-error">{loadError}</p>}
      {entries?.map((e) => <EntryRow key={e.id} entry={e} />)}

      <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
        <h2>Add a monitoring entry</h2>
        <VitalsFields value={vitals} onChange={setVitals} />
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label htmlFor="symptoms">Symptoms / observation</label>
          <textarea id="symptoms" value={symptoms} onChange={(e) => setSymptoms(e.target.value)} />
        </div>
        <fieldset style={{ border: 'none', padding: 0, margin: '0 0 var(--space-4)' }}>
          <legend style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
            Is the patient tolerating the infusion?
          </legend>
          <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontWeight: 400 }}>
              <input type="radio" name="tolerating" checked={tolerating === true} onChange={() => setTolerating(true)} /> Yes
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontWeight: 400 }}>
              <input type="radio" name="tolerating" checked={tolerating === false} onChange={() => setTolerating(false)} /> No
            </label>
          </div>
        </fieldset>
        {addEntry.error && <p role="alert" className="field-error">{addEntry.error}</p>}
        <button type="button" className="btn-primary" onClick={() => void addEntry.run()} disabled={addEntry.busy}>
          {addEntry.busy ? 'Saving…' : 'Add entry'}
        </button>
      </div>

      <div>
        {complete.error && <p role="alert" className="field-error">{complete.error}</p>}
        <button type="button" className="btn-primary" onClick={() => void complete.run()} disabled={!canComplete || complete.busy}>
          {complete.busy ? 'Completing…' : 'Complete monitoring and continue'}
        </button>
        {!canComplete && (
          <p style={{ color: 'var(--ink-soft)', fontSize: 'var(--fs-sm)', marginTop: 'var(--space-2)' }}>
            At least one entry is required, and the most recent one must report the patient tolerating the
            infusion.
          </p>
        )}
      </div>
    </div>
  );
}
