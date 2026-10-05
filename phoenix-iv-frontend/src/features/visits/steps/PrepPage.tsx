import { useEffect, useState } from 'react';
import { useVisit } from '../VisitContext';
import { useAsyncAction } from '../useAsyncAction';
import { PrepApi } from '../../../api/endpoints';
import type { PrepItemInput, Product } from '../../../api/types';

function emptyItem(): PrepItemInput {
  return { productId: '', doseValue: 0, doseUnit: 'mg', lotId: '', isAdditional: false };
}

function lotIsExpired(product: Product | undefined, lotId: string): boolean {
  const lot = product?.lots.find((l) => l.id === lotId);
  return !!lot && new Date(lot.expiryDate) < new Date();
}

export default function PrepPage() {
  const { visit, reload } = useVisit();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [baseProductId, setBaseProductId] = useState('');
  const [baseVolumeMl, setBaseVolumeMl] = useState<number | ''>('');
  const [items, setItems] = useState<PrepItemInput[]>([emptyItem()]);

  useEffect(() => {
    PrepApi.listProducts()
      .then(setProducts)
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Could not load the product catalog.'));
  }, []);

  const baseSolutions = products?.filter((p) => p.kind === 'BASE_SOLUTION') ?? [];
  const ingredients = products?.filter((p) => p.kind === 'INGREDIENT') ?? [];

  const submit = useAsyncAction(async () => {
    if (!baseProductId) throw new Error('Select a base solution.');
    if (!baseVolumeMl) throw new Error('Enter the base volume.');
    const validItems = items.filter((i) => i.productId && i.lotId);
    if (validItems.length === 0) throw new Error('At least one ingredient is required.');
    await PrepApi.record(visit.id, { baseProductId, baseVolumeMl: Number(baseVolumeMl), items: validItems });
    await reload();
  });

  function updateItem(index: number, patch: Partial<PrepItemInput>) {
    setItems((its) => its.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  if (visit.status !== 'IV_PREPARATION') {
    return <p>IV preparation was already completed for this visit.</p>;
  }

  return (
    <div>
      <h1>IV preparation</h1>
      <p style={{ color: 'var(--ink-soft)' }}>
        Record exactly what was prepared, from clinic-stocked products and their lots. An expired lot blocks
        saving unless you give an explicit override reason — it is never silently allowed or silently blocked.
      </p>

      {loadError && <p role="alert" className="field-error">{loadError}</p>}

      {products && (
        <div className="card">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div>
              <label htmlFor="baseProduct">Base solution</label>
              <select id="baseProduct" value={baseProductId} onChange={(e) => setBaseProductId(e.target.value)}>
                <option value="">Select…</option>
                {baseSolutions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="baseVolume">Base volume (mL)</label>
              <input
                id="baseVolume"
                type="number"
                value={baseVolumeMl}
                onChange={(e) => setBaseVolumeMl(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
          </div>

          <h3>Ingredients</h3>
          {items.map((item, i) => {
            const product = ingredients.find((p) => p.id === item.productId);
            const expired = lotIsExpired(product, item.lotId);
            return (
              <div key={i} className="card" style={{ marginBottom: 'var(--space-3)', borderColor: expired ? 'var(--red)' : 'var(--border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 'var(--space-2)', alignItems: 'end' }}>
                  <div>
                    <label htmlFor={`item-product-${i}`}>Ingredient</label>
                    <select
                      id={`item-product-${i}`}
                      value={item.productId}
                      onChange={(e) => updateItem(i, { productId: e.target.value, lotId: '' })}
                    >
                      <option value="">Select…</option>
                      {ingredients.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`item-lot-${i}`}>Lot</label>
                    <select id={`item-lot-${i}`} value={item.lotId} onChange={(e) => updateItem(i, { lotId: e.target.value })} disabled={!product}>
                      <option value="">Select…</option>
                      {product?.lots.map((lot) => (
                        <option key={lot.id} value={lot.id}>
                          {lot.lotNumber} (exp. {new Date(lot.expiryDate).toLocaleDateString()})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`item-dose-${i}`}>Dose</label>
                    <input
                      id={`item-dose-${i}`}
                      type="number"
                      value={item.doseValue}
                      onChange={(e) => updateItem(i, { doseValue: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label htmlFor={`item-unit-${i}`}>Unit</label>
                    <input id={`item-unit-${i}`} value={item.doseUnit} onChange={(e) => updateItem(i, { doseUnit: e.target.value })} />
                  </div>
                  <button type="button" className="btn-secondary" onClick={() => setItems((its) => its.filter((_, j) => j !== i))}>
                    Remove
                  </button>
                </div>
                {expired && (
                  <div style={{ marginTop: 'var(--space-3)' }}>
                    <p role="alert" className="field-error">
                      This lot is expired. Saving requires an explicit override reason.
                    </p>
                    <label htmlFor={`item-override-${i}`}>Expired-lot override reason</label>
                    <input
                      id={`item-override-${i}`}
                      value={item.expiredLotOverrideReason ?? ''}
                      onChange={(e) => updateItem(i, { expiredLotOverrideReason: e.target.value })}
                    />
                  </div>
                )}
              </div>
            );
          })}
          <button type="button" className="btn-secondary" onClick={() => setItems((its) => [...its, emptyItem()])} style={{ marginBottom: 'var(--space-5)' }}>
            Add ingredient
          </button>

          {submit.error && <p role="alert" className="field-error">{submit.error}</p>}
          <button type="button" className="btn-primary" onClick={() => void submit.run()} disabled={submit.busy}>
            {submit.busy ? 'Saving…' : 'Save preparation and continue'}
          </button>
        </div>
      )}
    </div>
  );
}
