import { useEffect, useState } from 'react';
import { api } from './api.js';
import { useAuth } from './AuthContext.jsx';
import { Card, Table, Button, Badge, Notice, Modal, Confirm, Field, CheckRow, GroupLabel } from './ui.jsx';

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
  const [draft, setDraft] = useState(null);     // { …user, _new?: true }
  const [confirming, setConfirming] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => Promise.all([
    api.get('/api/core/users'),
    api.get('/api/core/users/permissions'),
  ]).then(([u, p]) => { setUsers(u.users); setGroups(p.groups); })
    .catch((e) => setError(e.message));

  useEffect(() => { load(); }, []);

  const isNew = !!draft?._new;
  const held = draft?.permissions || [];
  const isSuper = held.includes('*');
  const totalPermissions = groups.reduce((n, g) => n + g.permissions.length, 0);

  const toggle = (key) => setDraft({
    ...draft,
    permissions: held.includes(key) ? held.filter((p) => p !== key) : [...held, key],
  });

  const openEdit = (u) => { setError(null); setDraft({ ...u, roles: (u.roles || []).join(', ') }); };
  const openNew = () => { setError(null); setDraft({ ...BLANK, _new: true }); };

  const save = async () => {
    setError(null); setNotice(null); setSaving(true);
    try {
      const roles = String(draft.roles || '').split(',').map((r) => r.trim()).filter(Boolean);
      if (isNew) {
        await api.post('/api/core/users', {
          email: draft.email.trim(),
          name: draft.name.trim(),
          password: draft.password,
          roles,
          permissions: draft.permissions,
        });
        setNotice(`Created ${draft.email}`);
      } else {
        await api.patch(`/api/core/users/${draft._id}`, { name: draft.name, roles, permissions: draft.permissions });
        setNotice(`Updated ${draft.email}`);
      }
      setDraft(null);
      await load();
    } catch (e) {
      setError(e.data?.ungrantable ? `${e.message}: ${e.data.ungrantable.join(', ')}` : e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await api.del(`/api/core/users/${confirming._id}`);
      setNotice(`Deleted ${confirming.email}`);
      setConfirming(null);
      await load();
    } catch (e) { setError(e.message); setConfirming(null); }
  };

  return (
    <>
      <Card title="Users" actions={<Button onClick={openNew}>New user</Button>}>
        {error && !draft && <Notice tone="error">{error}</Notice>}
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
                ? <Badge tone="warn">★ all permissions</Badge>
                : (r.permissions || []).map((p) => <Badge key={p} tone="muted">{p}</Badge>)
            ) },
            { key: 'actions', label: '', render: (r) => (
              <div className="row">
                <Button variant="ghost" onClick={() => openEdit(r)}>Edit</Button>
                {String(r._id) !== String(me.sub) && (
                  <Button variant="ghost" onClick={() => setConfirming(r)}>Delete</Button>
                )}
              </div>
            ) },
          ]}
          rows={users}
        />
        <p className="muted small">
          Permission groups come from the modules themselves — each declares what it enforces in its
          own repository. {totalPermissions} permission{totalPermissions === 1 ? '' : 's'} across {groups.length} group{groups.length === 1 ? '' : 's'}.
        </p>
      </Card>

      <Modal
        open={!!draft}
        size="full"
        title={isNew ? 'New user' : `Edit ${draft?.email || ''}`}
        subtitle={isSuper
          ? 'Superadmin — holds every permission, including ones added by future modules'
          : `${held.length} of ${totalPermissions} permissions granted`}
        onClose={() => setDraft(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : isNew ? 'Create user' : 'Save changes'}
            </Button>
          </>
        }
      >
        {error && <Notice tone="error">{error}</Notice>}

        <div className="form-grid">
          {isNew && (
            <>
              <Field label="Email">
                <input placeholder="person@example.com" value={draft?.email || ''}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
              </Field>
              <Field label="Password">
                <input type="password" placeholder="initial password" value={draft?.password || ''}
                  onChange={(e) => setDraft({ ...draft, password: e.target.value })} />
              </Field>
            </>
          )}
          <Field label="Name">
            <input placeholder="Full name" value={draft?.name || ''}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <Field label="Roles" hint="Comma separated. Labels only — access is decided by permissions.">
            <input placeholder="sales_agent, finance_admin" value={draft?.roles || ''}
              onChange={(e) => setDraft({ ...draft, roles: e.target.value })} />
          </Field>
        </div>

        <div className="check-grid">
          <CheckRow
            checked={isSuper}
            onChange={() => toggle('*')}
            code="*"
            label="Superadmin — every permission, including modules added later"
          />
        </div>

        {groups.map((g) => (
          <div key={g.module}>
            <GroupLabel count={g.permissions.filter((p) => held.includes(p.key)).length}>{g.module}</GroupLabel>
            <div className="check-grid">
              {g.permissions.map((p) => (
                <CheckRow
                  key={p.key}
                  checked={isSuper || held.includes(p.key)}
                  disabled={isSuper}
                  onChange={() => toggle(p.key)}
                  code={p.key}
                  label={p.label}
                />
              ))}
            </div>
          </div>
        ))}

        <p className="muted small">
          Permissions are carried in the JWT, so a change takes effect the next time that user signs
          in (or when their 1-hour token expires).
        </p>
      </Modal>

      <Confirm
        open={!!confirming}
        title="Delete user"
        tone="danger"
        confirmLabel="Delete"
        message={`Permanently delete ${confirming?.email}? Anything they created keeps their user id as a reference.`}
        onConfirm={remove}
        onClose={() => setConfirming(null)}
      />
    </>
  );
}
