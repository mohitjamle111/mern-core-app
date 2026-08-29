import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';

import { AuthProvider, useAuth } from './AuthContext.jsx';
import { moduleUis, missingUis } from './modules.jsx';
import Users from './Users.jsx';
import { api } from './api.js';
import { Card, Table, Button, Badge, Notice } from './ui.jsx';

function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('admin');
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    try { await login(email, password); } catch (err) { setError(err.message); }
  };

  return (
    <div className="login-page">
      <form className="login" onSubmit={submit}>
        <h1>Acme ERP</h1>
        <p className="muted">One application. Every module a separate repository.</p>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="password" />
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit">Sign in</Button>
        <div className="hint">
          <div><code>admin@example.com</code> / admin — all modules</div>
          <div><code>alice@example.com</code> / alice — sales</div>
          <div><code>bob@example.com</code> / bob — inventory</div>
          <div><code>carol@example.com</code> / carol — finance</div>
        </div>
      </form>
    </div>
  );
}

function Home() {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  useEffect(() => { api.get('/api/_core/status').then(setStatus).catch(() => {}); }, []);

  return (
    <>
      <Card title={`Welcome, ${user.name}`}>
        <p>
          Roles: {user.roles.map((r) => <Badge key={r}>{r}</Badge>)}{' '}
          Permissions: {user.permissions.map((p) => <Badge key={p} tone="muted">{p}</Badge>)}
        </p>
        <p className="muted">
          The navigation on the left is built at runtime from the module frontends that exist
          on this machine, filtered by your permissions.
        </p>
      </Card>

      <Card title="Modules loaded on this server">
        <Table
          columns={[
            { key: 'name', label: 'Module' },
            { key: 'state', label: 'State', render: (r) => (
              <Badge tone={r.state === 'loaded' ? 'ok' : 'warn'}>{r.state}</Badge>
            ) },
            { key: 'mount', label: 'API mount', render: (r) => r.mount || '—' },
            { key: 'db', label: 'Database', render: (r) => r.db || '—' },
            { key: 'url', label: 'Repository', render: (r) => <code>{r.url}</code> },
          ]}
          rows={status?.modules || []}
        />
        {missingUis.length > 0 && (
          <Notice tone="warn">
            No frontend bundled for: {missingUis.join(', ')} — those submodules are not on this
            machine, so their pages do not exist in this build.
          </Notice>
        )}
      </Card>

      <Card title="Cross-module services">
        <Table
          columns={[
            { key: 'service', label: 'Capability' },
            { key: 'state', label: 'Resolved as', render: (r) => (
              <Badge tone={r.state === 'live' ? 'ok' : r.state === 'mock' ? 'warn' : 'error'}>{r.state}</Badge>
            ) },
          ]}
          rows={status?.services || []}
        />
      </Card>
    </>
  );
}

function Shell() {
  const { user, loading, logout, can } = useAuth();
  const location = useLocation();

  if (loading) return <div className="loading">Loading…</div>;
  if (!user) return <Login />;

  const visible = moduleUis.filter((m) => can(m.requires));

  return (
    <div className="layout">
      <aside>
        <div className="brand">Acme ERP</div>
        <nav>
          <NavLink to="/" end>⌂ Dashboard</NavLink>
          {can('users:read') && <NavLink to="/users">◎ Users</NavLink>}
          {visible.map((m) => (
            <NavLink key={m.name} to={m.path}>{m.icon} {m.title}</NavLink>
          ))}
        </nav>
        {moduleUis.length > visible.length && (
          <p className="muted small">
            {moduleUis.length - visible.length} module(s) hidden — your account lacks the permission.
          </p>
        )}
        <div className="who">
          <div>{user.name}</div>
          <div className="muted small">{user.email}</div>
          <Button variant="ghost" onClick={logout}>Sign out</Button>
        </div>
      </aside>

      <main key={location.pathname}>
        <Routes>
          <Route path="/" element={<Home />} />
          {can('users:read') && <Route path="/users" element={<Users />} />}
          {visible.map((m) => <Route key={m.name} path={`${m.path}/*`} element={<m.Component />} />)}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </AuthProvider>
  );
}
