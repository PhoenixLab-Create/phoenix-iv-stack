import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { IntakeApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import type { IntakeFormVersion, MedicationInput } from '../../api/types';

/**
 * No staff login here — patients never have accounts (architecture
 * decision). The single-visit session token comes from the link staff
 * generated and handed over, read from the query string.
 */
export default function PatientIntakePage() {
  const { visitId } = useParams<{ visitId: string }>();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [form, setForm] = useState<IntakeFormVersion | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [medications, setMedications] = useState<MedicationInput[]>([]);
  const [hasAllergy, setHasAllergy] = useState<boolean | null>(null);
  const [allergyDescription, setAllergyDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visitId || !token) return;
    IntakeApi.getFormAsPatient(visitId, token)
      .then(setForm)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load the intake form.'));
  }, [visitId, token]);

  async function handleSubmit() {
    if (!visitId) return;
    if (hasAllergy === null) {
      setError('Please answer whether you have any allergies.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await IntakeApi.submitAsPatient(visitId, token, {
        answers,
        medications: medications.filter((m) => m.name.trim().length > 0),
        allergy: { hasAllergy, description: allergyDescription || undefined },
      });
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not submit your intake form.');
    } finally {
      setBusy(false);
    }
  }

  if (!visitId || !token) {
    return <p style={{ padding: 'var(--space-6)' }}>This link is missing information. Please ask staff for a new one.</p>;
  }

  if (submitted) {
    return (
      <div style={{ maxWidth: 480, margin: '3rem auto', padding: '0 var(--space-4)' }}>
        <h1>Thank you</h1>
        <p>Your intake form has been submitted. Please let the clinic staff know you're done.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: '2rem auto', padding: '0 var(--space-4)' }}>
      <h1>Medical intake</h1>
      <p style={{ color: 'var(--ink-soft)' }}>
        Please answer the following questions as accurately as you can. A staff member can help if you'd
        rather not fill this in yourself.
      </p>

      {error && <p role="alert" className="field-error">{error}</p>}
      {!form && !error && <p>Loading…</p>}

      {form && (
        <div className="card">
          {form.schema.map((q) => (
            <div key={q.key} style={{ marginBottom: 'var(--space-4)' }}>
              {q.type === 'boolean' ? (
                <fieldset style={{ border: 'none', padding: 0 }}>
                  <legend style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>{q.label}</legend>
                  <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontWeight: 400 }}>
                      <input
                        type="radio"
                        name={q.key}
                        checked={answers[q.key] === true}
                        onChange={() => setAnswers((a) => ({ ...a, [q.key]: true }))}
                      />{' '}
                      Yes
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontWeight: 400 }}>
                      <input
                        type="radio"
                        name={q.key}
                        checked={answers[q.key] === false}
                        onChange={() => setAnswers((a) => ({ ...a, [q.key]: false }))}
                      />{' '}
                      No
                    </label>
                  </div>
                </fieldset>
              ) : (
                <>
                  <label htmlFor={q.key}>{q.label}</label>
                  <input
                    id={q.key}
                    type={q.type === 'number' ? 'number' : 'text'}
                    value={typeof answers[q.key] === 'string' || typeof answers[q.key] === 'number' ? (answers[q.key] as string | number) : ''}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
                  />
                </>
              )}
            </div>
          ))}

          <h3>Current medications</h3>
          {medications.map((m, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
              <input
                aria-label="Medication name"
                placeholder="Name"
                value={m.name}
                onChange={(e) => setMedications((ms) => ms.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              />
              <input
                aria-label="Dose"
                placeholder="Dose"
                value={m.dose ?? ''}
                onChange={(e) => setMedications((ms) => ms.map((x, j) => (j === i ? { ...x, dose: e.target.value } : x)))}
              />
              <input
                aria-label="Frequency"
                placeholder="Frequency"
                value={m.frequency ?? ''}
                onChange={(e) => setMedications((ms) => ms.map((x, j) => (j === i ? { ...x, frequency: e.target.value } : x)))}
              />
              <button type="button" className="btn-secondary" onClick={() => setMedications((ms) => ms.filter((_, j) => j !== i))}>
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn-secondary"
            style={{ marginBottom: 'var(--space-4)' }}
            onClick={() => setMedications((ms) => [...ms, { name: '', dose: '', frequency: '' }])}
          >
            Add medication
          </button>

          <fieldset style={{ border: 'none', padding: 0, margin: '0 0 var(--space-5)' }}>
            <legend style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
              Do you have any medication, food or other allergies?
            </legend>
            <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-2)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontWeight: 400 }}>
                <input type="radio" name="hasAllergy" checked={hasAllergy === true} onChange={() => setHasAllergy(true)} /> Yes
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontWeight: 400 }}>
                <input type="radio" name="hasAllergy" checked={hasAllergy === false} onChange={() => setHasAllergy(false)} /> No
              </label>
            </div>
            {hasAllergy && (
              <input
                aria-label="Allergy description"
                placeholder="Please describe"
                value={allergyDescription}
                onChange={(e) => setAllergyDescription(e.target.value)}
              />
            )}
          </fieldset>

          <button type="button" className="btn-primary" onClick={() => void handleSubmit()} disabled={busy} style={{ width: '100%' }}>
            {busy ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      )}
    </div>
  );
}
