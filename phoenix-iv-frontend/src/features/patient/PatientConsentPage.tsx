import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ConsentApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import type { ConsentTemplate } from '../../api/types';

export default function PatientConsentPage() {
  const { visitId } = useParams<{ visitId: string }>();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [template, setTemplate] = useState<ConsentTemplate | null>(null);
  const [patientName, setPatientName] = useState('');
  const [typedSignature, setTypedSignature] = useState('');
  const [questionsAnswered, setQuestionsAnswered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    if (!visitId || !token) return;
    ConsentApi.getTemplateAsPatient(visitId, token)
      .then(setTemplate)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load the consent form.'));
  }, [visitId, token]);

  async function handleSubmit() {
    if (!visitId) return;
    if (!patientName.trim()) {
      setError('Please type your full legal name.');
      return;
    }
    if (!typedSignature.trim()) {
      setError('Please type your name again to sign.');
      return;
    }
    if (!questionsAnswered) {
      setError('Please confirm that your questions were answered before signing.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await ConsentApi.signAsPatient(visitId, token, {
        patientName,
        signatureBlobRef: `typed:${typedSignature}`,
        questionsAnsweredConfirmed: questionsAnswered,
      });
      setSigned(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not submit your consent.');
    } finally {
      setBusy(false);
    }
  }

  if (!visitId || !token) {
    return <p style={{ padding: 'var(--space-6)' }}>This link is missing information. Please ask staff for a new one.</p>;
  }

  if (signed) {
    return (
      <div style={{ maxWidth: 480, margin: '3rem auto', padding: '0 var(--space-4)' }}>
        <h1>Thank you</h1>
        <p>Your consent has been recorded. Please let clinic staff know you're done.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: '2rem auto', padding: '0 var(--space-4)' }}>
      <h1>Consent for IV therapy</h1>
      {error && <p role="alert" className="field-error">{error}</p>}
      {!template && !error && <p>Loading…</p>}

      {template && (
        <div className="card">
          <div
            style={{
              whiteSpace: 'pre-wrap',
              maxHeight: '16rem',
              overflowY: 'auto',
              padding: 'var(--space-3)',
              background: 'var(--paper)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: 'var(--space-5)',
            }}
          >
            {template.body}
          </div>

          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label htmlFor="patientName">Your full legal name</label>
            <input id="patientName" value={patientName} onChange={(e) => setPatientName(e.target.value)} />
          </div>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', fontWeight: 400 }}>
            <input type="checkbox" checked={questionsAnswered} onChange={(e) => setQuestionsAnswered(e.target.checked)} style={{ marginTop: '0.2rem' }} />
            I have had the chance to ask questions, and they have been answered to my satisfaction.
          </label>

          <div style={{ marginBottom: 'var(--space-5)' }}>
            <label htmlFor="signature">Type your name to sign</label>
            <input id="signature" value={typedSignature} onChange={(e) => setTypedSignature(e.target.value)} />
          </div>

          <button type="button" className="btn-primary" onClick={() => void handleSubmit()} disabled={busy} style={{ width: '100%' }}>
            {busy ? 'Submitting…' : 'Sign consent'}
          </button>
        </div>
      )}
    </div>
  );
}
