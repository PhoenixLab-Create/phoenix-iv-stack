import { useEffect, useState } from 'react';
import { useVisit } from '../VisitContext';
import { useAsyncAction } from '../useAsyncAction';
import { ProtocolsApi } from '../../../api/endpoints';
import type { Protocol } from '../../../api/types';

export default function ProtocolPage() {
  const { visit, reload } = useVisit();
  const [protocols, setProtocols] = useState<Protocol[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [customDetails, setCustomDetails] = useState('');

  useEffect(() => {
    ProtocolsApi.list()
      .then(setProtocols)
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Could not load the protocol catalog.'));
  }, []);

  const submit = useAsyncAction(async () => {
    if (!selectedId) throw new Error('Select a protocol first.');
    await ProtocolsApi.select(visit.id, { protocolId: selectedId, customDetails: customDetails || undefined });
    await reload();
  });

  // OrdersService.record() transitions the visit TO 'PROTOCOL_SELECTED' —
  // despite the name, that status means "ready to select a protocol now",
  // i.e. this screen's own current step. ProtocolsService.select() is what
  // moves it on to CONSENT.
  if (visit.status !== 'PROTOCOL_SELECTED') {
    return <p>Protocol selection was already completed for this visit.</p>;
  }

  const selected = protocols?.find((p) => p.id === selectedId);

  return (
    <div>
      <h1>Protocol selection</h1>
      <p style={{ color: 'var(--ink-soft)' }}>
        Only protocols the Medical Director has approved appear here. There is no way to select an unapproved
        or inactive protocol from this screen.
      </p>

      {loadError && <p role="alert" className="field-error">{loadError}</p>}
      {!protocols && !loadError && <p>Loading protocol catalog…</p>}

      {protocols && protocols.length === 0 && (
        <div className="card">
          <p>No approved protocols are configured yet. [CLINIC TO SUPPLY: approved protocol catalog]</p>
        </div>
      )}

      {protocols && protocols.length > 0 && (
        <div className="card">
          <fieldset style={{ border: 'none', padding: 0, margin: '0 0 var(--space-4)' }}>
            <legend style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, marginBottom: 'var(--space-2)' }}>
              Choose a protocol
            </legend>
            {protocols.map((p) => (
              <label key={p.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', fontWeight: 400 }}>
                <input type="radio" name="protocol" checked={selectedId === p.id} onChange={() => setSelectedId(p.id)} style={{ marginTop: '0.2rem' }} />
                <span>
                  <strong>{p.name}</strong>
                  {p.description && <div style={{ color: 'var(--ink-soft)', fontSize: 'var(--fs-sm)' }}>{p.description}</div>}
                </span>
              </label>
            ))}
          </fieldset>

          {selected?.isCustom && (
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label htmlFor="customDetails">Custom infusion details (required for a custom protocol)</label>
              <textarea id="customDetails" value={customDetails} onChange={(e) => setCustomDetails(e.target.value)} />
            </div>
          )}

          {submit.error && <p role="alert" className="field-error">{submit.error}</p>}
          <button type="button" className="btn-primary" onClick={() => void submit.run()} disabled={submit.busy}>
            {submit.busy ? 'Saving…' : 'Select protocol and continue'}
          </button>
        </div>
      )}
    </div>
  );
}
