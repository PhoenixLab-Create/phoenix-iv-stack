import { useState } from 'react';
import { useVisit } from '../VisitContext';
import { useAsyncAction } from '../useAsyncAction';
import { InsertionApi } from '../../../api/endpoints';
import type { RecordInsertionInput } from '../../../api/types';

const EMPTY: RecordInsertionInput = {
  site: '',
  side: 'left',
  gauge: '',
  attempts: 1,
  successful: true,
  siteCondition: '',
  note: '',
};

export default function InsertionPage() {
  const { visit, reload } = useVisit();
  const [form, setForm] = useState<RecordInsertionInput>(EMPTY);

  const submit = useAsyncAction(async () => {
    if (!form.site.trim()) throw new Error('Insertion site is required.');
    if (!form.gauge.trim()) throw new Error('Gauge is required.');
    await InsertionApi.record(visit.id, form);
    await reload();
  });

  if (visit.status !== 'IV_INSERTION') {
    return <p>IV insertion was already completed for this visit.</p>;
  }

  return (
    <div>
      <h1>IV insertion</h1>
      <p style={{ color: 'var(--ink-soft)' }}>
        An unsuccessful attempt is still documented here, not hidden — it's part of the clinical record either
        way.
      </p>
      <div className="card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <div>
            <label htmlFor="site">Site</label>
            <input id="site" required value={form.site} onChange={(e) => setForm((f) => ({ ...f, site: e.target.value }))} />
          </div>
          <div>
            <label htmlFor="side">Side</label>
            <select id="side" value={form.side} onChange={(e) => setForm((f) => ({ ...f, side: e.target.value }))}>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </div>
          <div>
            <label htmlFor="gauge">Gauge</label>
            <input id="gauge" required value={form.gauge} onChange={(e) => setForm((f) => ({ ...f, gauge: e.target.value }))} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <div>
            <label htmlFor="attempts">Number of attempts</label>
            <input
              id="attempts"
              type="number"
              min={1}
              value={form.attempts}
              onChange={(e) => setForm((f) => ({ ...f, attempts: Number(e.target.value) }))}
            />
          </div>
          <fieldset style={{ border: 'none', padding: 0 }}>
            <legend style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>Outcome</legend>
            <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontWeight: 400 }}>
                <input type="radio" name="successful" checked={form.successful} onChange={() => setForm((f) => ({ ...f, successful: true }))} /> Successful
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontWeight: 400 }}>
                <input type="radio" name="successful" checked={!form.successful} onChange={() => setForm((f) => ({ ...f, successful: false }))} /> Unsuccessful
              </label>
            </div>
          </fieldset>
        </div>

        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label htmlFor="siteCondition">Site condition</label>
          <input id="siteCondition" value={form.siteCondition} onChange={(e) => setForm((f) => ({ ...f, siteCondition: e.target.value }))} />
        </div>

        <div style={{ marginBottom: 'var(--space-5)' }}>
          <label htmlFor="note">Note</label>
          <textarea id="note" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
        </div>

        {submit.error && <p role="alert" className="field-error">{submit.error}</p>}
        <button type="button" className="btn-primary" onClick={() => void submit.run()} disabled={submit.busy}>
          {submit.busy ? 'Saving…' : 'Save insertion and continue'}
        </button>
      </div>
    </div>
  );
}
