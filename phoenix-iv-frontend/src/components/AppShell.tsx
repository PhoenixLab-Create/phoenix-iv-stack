import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function AppShell() {
  const { logout } = useAuth();

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <header
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'var(--paper-raised)',
          padding: 'var(--space-3) var(--space-5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Link to="/" style={{ textDecoration: 'none', color: 'var(--ink)' }}>
          <strong>Phoenix IV Therapy</strong>{' '}
          <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--fs-sm)' }}>Clinical Documentation</span>
        </Link>
        <button type="button" className="btn-secondary" onClick={() => void logout()}>
          Log out
        </button>
      </header>
      <main id="main" style={{ flex: 1 }}>
        <Outlet />
      </main>
    </div>
  );
}
