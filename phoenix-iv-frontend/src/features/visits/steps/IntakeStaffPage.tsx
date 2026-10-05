import { useEffect, useState } from 'react';
import { useVisit } from '../VisitContext';
import { useAsyncAction } from '../useAsyncAction';
import { IntakeApi, VisitsApi } from '../../../api/endpoints';
import type { IntakeFormVersion, MedicationInput } from '../../../api/types';

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: IntakeFormVersion['schema'][number];
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (question.type === 'boolean') {
    return (
      <fieldset style={{ border: 'none', padding: 0, margin: '0 0 var(--space-4)' }}>
        <legend style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
          {question.label}
        </legend>
        <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontWeight: 400 }}>
            <input
              type="radio"
              name={question.key}
              checked={value === true}
              onChange={() => onChange(true)}
            />{' '}
            Yes
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontWeight: 400 }}>
            <input
              type="radio"
              name={question.key}
              checked={value === false}
              onChange={() => onChange(false)}
            />{' '}
            No
          </label>
        </div>
      </fieldset>
    );
  }
  if (question.type === 'number') {
    return (
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <label htmlFor={question.key}>{question.label}</label>
        <input
          id={question.key}
          type="number"
          value={typeof value === 'number' ? value : ''}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        />
      </div>
    );
  }
  if (question.type === 'select') {
    return (
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <label htmlFor={question.key}>{question.label}</label>
        <select id={question.key} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)}>
          <option value="" disabled>
            Select…
          </option>
          {(question.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <label htmlFor={question.key}>{question.label}</label>
      <input id={question.key} type="text" value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export default function IntakeStaffPage() {
  const { visit, reload } = useVisit();
  const [form, setForm] = useState<IntakeFormVersion | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [medications, setMedications] = useState<MedicationInput[]>([]);
  const [hasAllergy, setHasAllergy] = useState<boolean | null>(null);
  const [allergyDescription, setAllergyDescription] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<{ token: string; expiresAt: string } | null>(null);

  useEffect(() => {
    IntakeApi.getFormAsStaff(visit.id)
      .then(setForm)
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Could not load the intake form.'));
  }, [visit.id]);

  const submit = useAsyncAction(async () => {
    if (hasAllergy === null) {
      throw new Error('Please answer whether the patient has any allergies.');
    }
    await IntakeApi.submitAsStaff(visit.id, {
      answers,
      medications: medications.filter((m) => m.name.trim().length > 0),
      allergy: { hasAllergy, description: allergyDescription || undefined },
    });
    await reload();
  });

  const issueSession = useAsyncAction(async () => {
    const result = await VisitsApi.issuePatientSession(visit.id);
    setSessionInfo(result);
  });

  if (visit.status !== 'REGISTERED' && visit.status !== 'INTAKE') {
    return <p>Intake was already completed for this visit.</p>;
  }

  return (
    <div>
      <h1>Patient intake</h1>
      <p style={{ color: 'var(--ink-soft)' }}>
        Normally the patient completes this themselves on their own session — hand them a tablet or send the
        link below. Use this staff form only as an accessibility accommodation; the record always shows which
        path was used.
      </p>

      <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
        <h2>Patient self-serve link</h2>
        {sessionInfo ? (
          <>
            <p>Give the patient this link on their device. It expires at {new Date(sessionInfo.expiresAt).toLocaleTimeString()}.</p>
            <p className="mono" style={{ wordBreak: 'break-all', background: 'var(--paper)', padding: 'var(--space-3)', borderRadius: 'var(--radius-sm)' }}>
              {`${window.location.origin}/patient/${visit.id}/intake?token=${sessionInfo.token}`}
            </p>
          </>
        ) : (
          <button type="button" className="btn-secondary" onClick={() => void issueSession.run()} disabled={issueSession.busy}>
            {issueSession.busy ? 'Generating…' : 'Generate patient link'}
          </button>
        )}
        {issueSession.error && <p role="alert" className="field-error">{issueSession.error}</p>}
      </div>

      <div className="card">
        <h2>Staff-entry form (accessibility fallback)</h2>
        {loadError && <p role="alert" className="field-error">{loadError}</p>}
        {!form && !loadError && <p>Loading form…</p>}
        {form && (
          <>
            {form.schema.map((q) => (
              <QuestionField
                key={q.key}
                question={q}
                value={answers[q.key]}
                onChange={(v) => setAnswers((a) => ({ ...a, [q.key]: v }))}
              />
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

            <fieldset style={{ border: 'none', padding: 0, margin: '0 0 var(--space-4)' }}>
              <legend style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
                Does the patient have any medication, food or other allergies?
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
                  placeholder="Describe the allergy"
                  value={allergyDescription}
                  onChange={(e) => setAllergyDescription(e.target.value)}
                />
              )}
            </fieldset>

            {submit.error && <p role="alert" className="field-error">{submit.error}</p>}
            <button type="button" className="btn-primary" onClick={() => void submit.run()} disabled={submit.busy}>
              {submit.busy ? 'Submitting…' : 'Submit intake and continue'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
