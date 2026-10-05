import { useEffect, useState } from 'react';
import { useVisit } from '../VisitContext';
import { useAsyncAction } from '../useAsyncAction';
import { SignoffApi } from '../../../api/endpoints';
import type { SignoffSummary } from '../../../api/types';

export default function SignoffPage() {
  const { visit, reload } = useVisit();
  const [summary, setSummary] = useState<SignoffSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [designation, setDesignation] = useState('');
  const [signatureBlobRef, setSignatureBlobRef] = useState('');

  const refresh = () => {
    SignoffApi.summary(visit.id)
      .then(setSummary)
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Could not load the sign-off summary.'));
  };
  useEffect(refresh, [visit.id]);

  const sign = useAsyncAction(async () => {
    if (!designation.trim()) throw new Error('Your professional designation is required.');
    if (!signatureBlobRef.trim()) throw new Error('A signature is required.');
    await SignoffApi.sign(visit.id, { designation, signatureBlobRef });
    await reload();
  });

  if (visit.status !== 'PENDING_SIGNOFF') {
    return <p>This visit has already been signed.</p>;
  }

  return (
    <div>
      <h1>Clinician sign-off</h1>
      <p style={{ color: 'var(--ink-soft)' }}>
        This checks documentation completeness only — it never judges whether the clinical content itself was
        correct. Once signed, the record is permanent; only an amendment, not an edit, can change it afterward.
      </p>

      {loadError && <p role="alert" className="field-error">{loadError}</p>}

      {summary && (
        <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
          <h2>Documentation completeness</h2>
          {summary.canSign ? (
            <p className="badge badge-done">Ready to sign</p>
          ) : (
            <>
              <p className="badge badge-attention" style={{ marginBottom: 'var(--space-3)' }}>
                {summary.blocks.length} issue{summary.blocks.length === 1 ? '' : 's'} to resolve
              </p>
              <ul>
                {summary.blocks.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {summary?.canSign && (
        <div className="card">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div>
              <label htmlFor="designation">Professional designation</label>
              <input id="designation" placeholder="e.g. RN" value={designation} onChange={(e) => setDesignation(e.target.value)} />
            </div>
            <div>
              <label htmlFor="signature">Signature</label>
              <input
                id="signature"
                placeholder="Typed name (signature capture to be wired to a real pad/image upload)"
                value={signatureBlobRef}
                onChange={(e) => setSignatureBlobRef(e.target.value)}
              />
            </div>
          </div>
          {sign.error && <p role="alert" className="field-error">{sign.error}</p>}
          <button type="button" className="btn-primary" onClick={() => void sign.run()} disabled={sign.busy}>
            {sign.busy ? 'Signing…' : 'Sign and finalize record'}
          </button>
        </div>
      )}
    </div>
  );
}
