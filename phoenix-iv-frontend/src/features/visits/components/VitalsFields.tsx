import type { VitalsInput } from '../../../api/types';

interface Props {
  value: VitalsInput;
  onChange: (v: VitalsInput) => void;
}

const FIELDS: Array<{ key: keyof VitalsInput; label: string; unit: string; step?: string }> = [
  { key: 'bpSystolic', label: 'BP systolic', unit: 'mmHg' },
  { key: 'bpDiastolic', label: 'BP diastolic', unit: 'mmHg' },
  { key: 'heartRate', label: 'Heart rate', unit: 'bpm' },
  { key: 'respRate', label: 'Resp. rate', unit: '/min' },
  { key: 'temperature', label: 'Temperature', unit: '°C', step: '0.1' },
  { key: 'spo2', label: 'SpO₂', unit: '%' },
];

export default function VitalsFields({ value, onChange }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
      {FIELDS.map((f) => (
        <div key={f.key}>
          <label htmlFor={`vitals-${f.key}`}>
            {f.label} <span style={{ color: 'var(--ink-soft)' }}>({f.unit})</span>
          </label>
          <input
            id={`vitals-${f.key}`}
            type="number"
            step={f.step ?? '1'}
            value={value[f.key] ?? ''}
            onChange={(e) =>
              onChange({ ...value, [f.key]: e.target.value === '' ? undefined : Number(e.target.value) })
            }
          />
        </div>
      ))}
    </div>
  );
}
