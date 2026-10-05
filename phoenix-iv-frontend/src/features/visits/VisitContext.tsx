import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { VisitsApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import type { Visit } from '../../api/types';

interface VisitContextValue {
  visit: Visit;
  reload: () => Promise<void>;
}

const VisitContext = createContext<VisitContextValue | null>(null);

export function VisitProvider({ children }: { children: ReactNode }) {
  const { visitId } = useParams<{ visitId: string }>();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!visitId) return;
    try {
      const v = await VisitsApi.get(visitId);
      setVisit(v);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load this visit.');
    }
  }, [visitId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (error) {
    return (
      <div style={{ padding: 'var(--space-6)' }}>
        <p role="alert" className="field-error">
          {error}
        </p>
      </div>
    );
  }

  if (!visit) {
    return (
      <div style={{ padding: 'var(--space-6)' }}>
        <p>Loading visit…</p>
      </div>
    );
  }

  return <VisitContext.Provider value={{ visit, reload }}>{children}</VisitContext.Provider>;
}

export function useVisit() {
  const ctx = useContext(VisitContext);
  if (!ctx) throw new Error('useVisit must be used inside a VisitProvider');
  return ctx;
}
