import { useEffect, useState } from 'react';
import { api } from './api.js';
import { useAuth } from './AuthContext.jsx';
import { Card, Table, Button, Badge, Notice } from './ui.jsx';

/**
 * User administration — part of the SHELL, not a module.
 *
 * The permission checkboxes are not hardcoded here: they come from
 * /api/core/users/permissions, which each module populated by declaring
 * `permissions: [...]` in its backend/index.js. Ship a new module and its
 * permissions appear on this screen without touching the core.
 */

const BLANK = { email: '', name: '', password: '', roles: '', permissions: [] };

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [editing, setEditing] = useState(null);   // user object being edited
  const [creating, setCreating] = useState(null); // BLANK-shaped draft
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = () => Promise.all([
    api.get('/api/core/users'),
    api.get('/api/core/users/permissions'),
  ]).then(([u, p]) => { setUsers(u.users); setGroups(p.groups); })
    .catch((e) => setError(e.message));

  useEffect(() => { load(); }, []);

  const draft = editing || creating;
  const setDraft = editing ? setEditing : setCreating;

  const toggle = (key) => {
    const held = draft.permissions || [];
    setDraft({ ...draft, permissions: held.includes(key) ? held.filter((p) => p !== key) : [...held, key] });
  };

  const save = async () => {
    setError(null); setNotice(null);
    try {
      if (creating) {
        const body = {
          email: creating.email.trim(),
          name: creating.name.trim(),
          password: creating.password,
          roles: creating.roles.split(',').map((r) => r.trim()).filter(Boolean),
          permissions: creating.permissions,
        };
        await api.post('/api/core/users', body);
        setNotice(`Created ${body.email}`);
        setCreating(null);
      } else {
        await api.patch(`/api/core/users/${editing._id}`, {
          name: editing.name,
          roles: typeof editing.roles === 'string'
            ? editing.roles.split(',').map((r) => r.trim()).filter(Boolean)
            : editing.roles,
          permissions: editing.permissions,
        });
        setNotice(`Updated ${editing.email}`);
        setEditing(null);
      }
      await load();
    } catch (e) {
      setError(e.data?.ungrantable ? `${e.message}: ${e.data.ungrantable.join(', ')}` : e.message);
    }
  };

  const remove = async (u) => {
    setError(null);
    try {
      await api.del(`/api/core/users/${u._id}`);
      setNotice(`Deleted ${u.email}`);
      await load();
    } catch (e) { setError(e.message); }
  };

  return (
    <>
      <Card
        title="Users"
        actions={<Button onClick={() => { setEditing(null); setCreating({ ...BLANK }); }}>New user</Button>}
      >
        {error && <Notice tone="error">{error}</Notice>}
        {notice && <Notice tone="ok">{notice}</Notice>}
        <Table
          columns={[
            { key: 'name', label: 'Name', render: (r) => (
              <>{r.name || '—'} {String(r._id) === String(me.sub) && <Badge tone="ok">you</Badge>}</>
            ) },
            { key: 'email', label: 'Email', render: (r) => <code>{r.email}</code> },
            { key: 'roles', label: 'Roles', render: (r) => (r.roles || []).map((x) => <Badge key={x}>{x}</Badge>) },
            { key: 'permissions', label: 'Permissions', render: (r) => (
              (r.permissions || []).includes('*')
                ? <Badge tone="warn">* all permissions</Badge>
                : (r.permissions || []).map((p) => <Badge key={p} tone="muted">{p}</Badge>)
            ) },
            { key: 'actions', label: '', render: (r) => (
              <div className="row">
                <Button variant="ghost" onClick={() => { setCreating(null); setEditing({ ...r, roles: (r.roles || []).join(', ') }); }}>Edit</Button>
                {String(r._id) !== String(me.sub) && (
                  <Button variant="ghost" onClick={() => remove(r)}>Delete</Button>
                )}
              </div>
            ) },
          ]}
          rows={users}
        />
      </Card>

      {draft && (
        <Card
          title={creating ? 'New user' : `Edit ${draft.email}`}
          actions={<Button variant="ghost" onClick={() => { setEditing(null); setCreating(null); }}>Cancel</Button>}
        >
          <div className="row">
            {creating && (
              <>
                <input placeholder="email" value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
                <input placeholder="password" type="password" value={draft.password}
                  onChange={(e) => setDraft({ ...draft, password: e.target.value })} />
              </>
            )}
            <input placeholder="name" value={draft.name || ''}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <input placeholder="roles (comma separated)" style={{ minWidth: 240 }} value={draft.roles || ''}
              onChange={(e) => setDraft({ ...draft, roles: e.target.value })} />
          </div>

          <label className="row">
            <input type="checkbox" checked={(draft.permissions || []).includes('*')}
              onChange={() => toggle('*')} />
            <b>*</b> <span className="muted">superadmin — every permission, including modules added later</span>
          </label>

          {groups.map((g) => (
            <div key={g.module}>
              <div className="muted small" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 8 }}>
                {g.module}
              </div>
              {g.permissions.map((p) => (
                <label key={p.key} className="row" style={{ opacity: (draft.permissions || []).includes('*') ? 0.45 : 1 }}>
                  <input
                    type="checkbox"
                    disabled={(draft.permissions || []).includes('*')}
                    checked={(draft.permissions || []).includes(p.key)}
                    onChange={() => toggle(p.key)}
                  />
                  <code>{p.key}</code> <span className="muted small">{p.label}</span>
                </label>
              ))}
            </div>
          ))}

          <div className="row">
            <Button onClick={save}>{creating ? 'Create user' : 'Save changes'}</Button>
          </div>

          <p className="muted small">
            Permissions are carried in the JWT, so a change takes effect the next time that user
            signs in (or when their 1-hour token expires).
          </p>
        </Card>
      )}
    </>
  );
}
