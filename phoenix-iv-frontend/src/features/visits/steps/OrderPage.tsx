import { useState } from 'react';
import { useVisit } from '../VisitContext';
import { useAsyncAction } from '../useAsyncAction';
import { OrdersApi } from '../../../api/endpoints';
import type { RecordOrderInput } from '../../../api/types';

const EMPTY: RecordOrderInput = {
  orderType: 'directive',
  directiveRefId: '',
  prescriberName: '',
  prescriberCollegeNo: '',
  orderDetails: '',
};

export default function OrderPage() {
  const { visit, reload } = useVisit();
  const [form, setForm] = useState<RecordOrderInput>(EMPTY);

  const submit = useAsyncAction(async () => {
    await OrdersApi.record(visit.id, form);
    await reload();
  });

  if (visit.status !== 'ORDER_AUTHORIZATION') {
    return <p>Order authorization was already completed for this visit.</p>;
  }

  return (
    <div>
      <h1>Order authorization</h1>
      <p style={{ color: 'var(--ink-soft)' }}>
        Record the authority for this infusion — either a standing clinic directive, or a specific prescriber's
        order for this patient.
      </p>
      <div className="card">
        <fieldset style={{ border: 'none', padding: 0, margin: '0 0 var(--space-4)' }}>
          <legend style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>Order type</legend>
          <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontWeight: 400 }}>
              <input
                type="radio"
                name="orderType"
                checked={form.orderType === 'directive'}
                onChange={() => setForm((f) => ({ ...f, orderType: 'directive' }))}
              />{' '}
              Standing directive
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontWeight: 400 }}>
              <input
                type="radio"
                name="orderType"
                checked={form.orderType === 'patient_specific'}
                onChange={() => setForm((f) => ({ ...f, orderType: 'patient_specific' }))}
              />{' '}
              Patient-specific prescriber order
            </label>
          </div>
        </fieldset>

        {form.orderType === 'directive' ? (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label htmlFor="directiveRef">Directive reference</label>
            <input
              id="directiveRef"
              value={form.directiveRefId}
              onChange={(e) => setForm((f) => ({ ...f, directiveRefId: e.target.value }))}
            />
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
              <div>
                <label htmlFor="prescriberName">Prescriber name</label>
                <input
                  id="prescriberName"
                  value={form.prescriberName}
                  onChange={(e) => setForm((f) => ({ ...f, prescriberName: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="collegeNo">Prescriber college #</label>
                <input
                  id="collegeNo"
                  value={form.prescriberCollegeNo}
                  onChange={(e) => setForm((f) => ({ ...f, prescriberCollegeNo: e.target.value }))}
                />
              </div>
            </div>
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label htmlFor="orderDetails">Order details</label>
              <textarea
                id="orderDetails"
                value={form.orderDetails}
                onChange={(e) => setForm((f) => ({ ...f, orderDetails: e.target.value }))}
              />
            </div>
          </>
        )}

        {submit.error && <p role="alert" className="field-error">{submit.error}</p>}
        <button type="button" className="btn-primary" onClick={() => void submit.run()} disabled={submit.busy}>
          {submit.busy ? 'Saving…' : 'Save order and continue'}
        </button>
      </div>
    </div>
  );
}
