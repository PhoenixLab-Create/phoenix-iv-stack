import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PatientsApi, VisitsApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import type { RegisterPatientInput } from '../../api/types';

const EMPTY: RegisterPatientInput = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  address: '',
  phone: '',
  email: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
};

export default function RegisterPatientPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<RegisterPatientInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof RegisterPatientInput>(key: K, value: RegisterPatientInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const patient = await PatientsApi.register(form);
      const visit = await VisitsApi.start(patient.id);
      navigate(`/visits/${visit.id}/intake`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not register this patient.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>
      <h1>Register a new patient</h1>
      <p style={{ color: 'var(--ink-soft)' }}>
        Patients must be at least 16 years old to register, per clinic policy. This starts a new visit once
        registration succeeds.
      </p>
      <form onSubmit={handleSubmit} className="card" noValidate>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <div>
            <label htmlFor="firstName">First name</label>
            <input id="firstName" required value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
          </div>
          <div>
            <label htmlFor="lastName">Last name</label>
            <input id="lastName" required value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
          </div>
        </div>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label htmlFor="dob">Date of birth</label>
          <input
            id="dob"
            type="date"
            required
            value={form.dateOfBirth}
            onChange={(e) => set('dateOfBirth', e.target.value)}
          />
        </div>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label htmlFor="address">Address</label>
          <input id="address" value={form.address} onChange={(e) => set('address', e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <div>
            <label htmlFor="phone">Phone</label>
            <input id="phone" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
          <div>
            <label htmlFor="ecName">Emergency contact name</label>
            <input
              id="ecName"
              value={form.emergencyContactName}
              onChange={(e) => set('emergencyContactName', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="ecPhone">Emergency contact phone</label>
            <input
              id="ecPhone"
              type="tel"
              value={form.emergencyContactPhone}
              onChange={(e) => set('emergencyContactPhone', e.target.value)}
            />
          </div>
        </div>
        {error && (
          <p role="alert" className="field-error" style={{ marginBottom: 'var(--space-4)' }}>
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Registering…' : 'Register and start visit'}
        </button>
      </form>
    </div>
  );
}
