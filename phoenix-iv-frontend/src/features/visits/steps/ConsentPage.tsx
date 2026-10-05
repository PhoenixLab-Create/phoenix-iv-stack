import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useVisit } from '../VisitContext';
import { useAsyncAction } from '../useAsyncAction';
import { ConsentApi, VisitsApi } from '../../../api/endpoints';
import { ApiError } from '../../../api/client';
import type { Consent } from '../../../api/types';

export default function ConsentPage() {
  const { visit, reload } = useVisit();
  const [consent, setConsent] = useState<Consent | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<{ token: string; expiresAt: string } | null>(null);

  const loadConsent = () => {
    ConsentApi.get(visit.id)
      .then((c) => {
        setConsent(c);
        setNotFound(false);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
      });
  };

  useEffect(loadConsent, [visit.id]);

  const issueSession = useAsyncAction(async () => {
    const result = await VisitsApi.issuePatientSession(visit.id);
    setSessionInfo(result);
  });

  const witness = useAsyncAction(async () => {
    await ConsentApi.witness(visit.id);
    loadConsent();
    await reload();
  });

  // Signing advances the visit to IV_PREPARATION immediately
  // (ConsentService.sign()) — witnessing happens after, and isn't part of
  // the sign-off completeness check at all, so it must stay reachable even
  // once the visit has moved past the CONSENT status. Only the "generate a
  // link to sign" affordance is specific to being on this step right now.
  const canStillSign = visit.status === 'CONSENT';
  if (!canStillSign && !consent) {
    return <p>Consent was already completed for this visit.</p>;
  }

  return (
    <div>
      <h1>Informed consent</h1>
      <p style={{ color: 'var(--ink-soft)' }}>
        Only the patient can sign their own consent — there is no staff-on-behalf signing path. Hand them the
        link below on their device, then witness it here once they've signed. Witnessing isn't required to
        move on to IV preparation, but it's still worth doing as soon as you can.
      </p>

      {!consent && notFound && canStillSign && (
        <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
          <h2>1. Send the consent link to the patient</h2>
          {sessionInfo ? (
            <>
              <p>Expires at {new Date(sessionInfo.expiresAt).toLocaleTimeString()}.</p>
              <p className="mono" style={{ wordBreak: 'break-all', background: 'var(--paper)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)' }}>
                {`${window.location.origin}/patient/${visit.id}/consent?token=${sessionInfo.token}`}
              </p>
              <button type="button" className="btn-secondary" onClick={loadConsent} style={{ marginTop: 'var(--space-3)' }}>
                Check if they've signed
              </button>
            </>
          ) : (
            <button type="button" className="btn-primary" onClick={() => void issueSession.run()} disabled={issueSession.busy}>
              {issueSession.busy ? 'Generating…' : 'Generate patient link'}
            </button>
          )}
          {issueSession.error && <p role="alert" className="field-error">{issueSession.error}</p>}
        </div>
      )}

      {consent && (
        <div className="card">
          <h2>2. Witness</h2>
          <p>
            <strong>{consent.patientName}</strong> signed at {new Date(consent.signedAt!).toLocaleString()}.
          </p>
          <p>Questions answered: {consent.questionsAnsweredConfirmed ? 'Yes' : 'No'}</p>
          <details style={{ marginBottom: 'var(--space-4)' }}>
            <summary>View the signed consent text</summary>
            <div style={{ whiteSpace: 'pre-wrap', marginTop: 'var(--space-3)' }}>{consent.renderedTextSnapshot}</div>
          </details>

          {consent.witnessUserId ? (
            <p className="badge badge-done">Witnessed</p>
          ) : (
            <>
              {witness.error && <p role="alert" className="field-error">{witness.error}</p>}
              <button type="button" className="btn-primary" onClick={() => void witness.run()} disabled={witness.busy}>
                {witness.busy ? 'Saving…' : 'I witnessed this signature'}
              </button>
            </>
          )}

          {!canStillSign && (
            <p style={{ marginTop: 'var(--space-4)' }}>
              <Link to={`/visits/${visit.id}/prep`}>Continue to IV preparation →</Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
