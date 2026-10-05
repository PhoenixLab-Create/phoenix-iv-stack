import { useEffect, useState } from 'react';
import { useVisit } from '../VisitContext';
import { useAsyncAction } from '../useAsyncAction';
import { ScreeningApi } from '../../../api/endpoints';
import type { ScreeningFlag } from '../../../api/types';

function FlagRow({ flag, visitId, onAcknowledged }: { flag: ScreeningFlag; visitId: string; onAcknowledged: () => void }) {
  const [response, setResponse] = useState(flag.clinicianResponse ?? '');
  const ack = useAsyncAction(async () => {
    if (!response.trim()) throw new Error('A clinician response is required to acknowledge this flag.');
    await ScreeningApi.acknowledge(visitId, flag.id, response);
    onAcknowledged();
  });

  return (
    <div className="card" style={{ marginBottom: 'var(--space-3)', borderColor: flag.acknowledgedAt ? 'var(--sage)' : 'var(--gold)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
        <p style={{ fontWeight: 500, margin: 0 }}>{flag.rule.message}</p>
        <span className={`badge ${flag.acknowledgedAt ? 'badge-done' : 'badge-attention'}`}>
          {flag.acknowledgedAt ? 'Acknowledged' : 'Needs response'}
        </span>
      </div>
      {flag.acknowledgedAt ? (
        <p style={{ color: 'var(--ink-soft)', marginTop: 'var(--space-2)' }}>
          <strong>Clinician response:</strong> {flag.clinicianResponse}
        </p>
      ) : (
        <div style={{ marginTop: 'var(--space-3)' }}>
          <label htmlFor={`response-${flag.id}`}>Clinician response</label>
          <textarea id={`response-${flag.id}`} value={response} onChange={(e) => setResponse(e.target.value)} />
          {ack.error && <p role="alert" className="field-error">{ack.error}</p>}
          <button type="button" className="btn-primary" onClick={() => void ack.run()} disabled={ack.busy}>
            {ack.busy ? 'Saving…' : 'Acknowledge'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function ScreeningPage() {
  const { visit, reload } = useVisit();
  const [flags, setFlags] = useState<ScreeningFlag[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshFlags = () => {
    ScreeningApi.listFlags(visit.id)
      .then(setFlags)
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Could not load screening flags.'));
  };

  useEffect(refreshFlags, [visit.id]);

  const runScreening = useAsyncAction(async () => {
    await ScreeningApi.run(visit.id);
    refreshFlags();
  });

  const complete = useAsyncAction(async () => {
    await ScreeningApi.complete(visit.id);
    await reload();
  });

  if (visit.status !== 'SAFETY_SCREENING') {
    return <p>Safety screening was already completed for this visit.</p>;
  }

  const allAcknowledged = flags !== null && flags.length > 0 && flags.every((f) => f.acknowledgedAt);

  return (
    <div>
      <h1>Safety screening</h1>
      <p style={{ color: 'var(--ink-soft)' }}>
        This runs the clinic's approved screening rules against the patient's intake answers. It only raises
        flags for a clinician to respond to — it never decides eligibility on its own.
      </p>

      {loadError && <p role="alert" className="field-error">{loadError}</p>}

      {flags !== null && flags.length === 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
          <p>No screening has been run yet for this visit.</p>
          {runScreening.error && <p role="alert" className="field-error">{runScreening.error}</p>}
          <button type="button" className="btn-primary" onClick={() => void runScreening.run()} disabled={runScreening.busy}>
            {runScreening.busy ? 'Running…' : 'Run screening'}
          </button>
        </div>
      )}

      {flags !== null && flags.length > 0 && (
        <>
          {flags.map((f) => (
            <FlagRow key={f.id} flag={f} visitId={visit.id} onAcknowledged={refreshFlags} />
          ))}
          <div style={{ marginTop: 'var(--space-4)' }}>
            {complete.error && <p role="alert" className="field-error">{complete.error}</p>}
            <button type="button" className="btn-primary" onClick={() => void complete.run()} disabled={!allAcknowledged || complete.busy}>
              {complete.busy ? 'Completing…' : 'Complete screening and continue'}
            </button>
            {!allAcknowledged && (
              <p style={{ color: 'var(--ink-soft)', fontSize: 'var(--fs-sm)', marginTop: 'var(--space-2)' }}>
                Every flag needs a clinician response before you can continue.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
