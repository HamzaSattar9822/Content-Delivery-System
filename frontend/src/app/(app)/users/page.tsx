'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Paginated, RoleName, UserRecord } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { Badge, Banner, Button, Card, EmptyState, Field, Input, Modal, PageHeader, PasswordInput, Select, Spinner, Table } from '@/components/ui';
import { formatDate } from '@/lib/format';

const ROLES: RoleName[] = ['SUPER_ADMIN', 'CONTENT_MANAGER', 'READ_ONLY'];

export default function UsersPage() {
  const { hasPermission, user: current } = useAuth();
  const canManage = hasPermission('user:manage');
  const isSuperAdmin = current?.role === 'SUPER_ADMIN';

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [setPasswordUser, setSetPasswordUser] = useState<UserRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Paginated<UserRecord>>('/users', { pageSize: 100 });
      setUsers(data.data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateRole = async (id: string, roleName: string) => {
    setError(null);
    try {
      await api.patch(`/users/${id}`, { roleName });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update role');
    }
  };

  const toggleStatus = async (u: UserRecord) => {
    setError(null);
    try {
      await api.patch(`/users/${u.id}`, { status: u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update status');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this user? This cannot be undone.')) return;
    setError(null);
    setDeletingId(id);
    try {
      await api.delete(`/users/${id}`);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      await load();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to delete user';
      await load();
      setError(message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Users"
        description="Manage team members and their roles."
        action={canManage && <Button onClick={() => setShowCreate(true)}>Add User</Button>}
      />
      {error && <Banner tone="error">{error}</Banner>}

      {loading ? (
        <Spinner />
      ) : users.length === 0 ? (
        <EmptyState message="No users yet." />
      ) : (
        <Table headers={['Email', 'Name', 'Role', 'Status', 'Last Login', '']}>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-line last:border-0">
              <td className="px-4 py-2 text-ink">{u.email}</td>
              <td className="px-4 py-2 text-muted">{u.name ?? '-'}</td>
              <td className="px-4 py-2">
                {canManage && u.id !== current?.id ? (
                  <Select value={u.role.name} onChange={(e) => updateRole(u.id, e.target.value)} className="w-44">
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Badge>{u.role.name}</Badge>
                )}
              </td>
              <td className="px-4 py-2">
                <Badge tone={u.status === 'ACTIVE' ? 'default' : 'muted'}>{u.status}</Badge>
              </td>
              <td className="px-4 py-2 text-muted whitespace-nowrap">{formatDate(u.lastLoginAt)}</td>
              <td className="px-4 py-2 text-right whitespace-nowrap">
                {canManage && u.id !== current?.id && (
                  <>
                    {isSuperAdmin && (
                      <button onClick={() => setSetPasswordUser(u)} className="text-sm text-ink hover:underline mr-3">
                        Set Password
                      </button>
                    )}
                    <button onClick={() => toggleStatus(u)} className="text-sm text-ink hover:underline mr-3">
                      {u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                    </button>
                    <button
                      onClick={() => void remove(u.id)}
                      disabled={deletingId === u.id}
                      className="text-sm text-ink hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deletingId === u.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            void load();
          }}
        />
      )}

      {setPasswordUser && (
        <SetPasswordModal
          user={setPasswordUser}
          onClose={() => setSetPasswordUser(null)}
          onSaved={() => {
            setSetPasswordUser(null);
          }}
        />
      )}
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [roleName, setRoleName] = useState<RoleName>('READ_ONLY');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError(null);
    setSaving(true);
    try {
      await api.post('/users', { email, name: name || undefined, roleName });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Add User">
      {error && <Banner tone="error">{error}</Banner>}
      <div className="space-y-3">
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
        </Field>
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
        </Field>
        <Field label="Role">
          <Select value={roleName} onChange={(e) => setRoleName(e.target.value as RoleName)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </Field>
        <p className="text-xs text-muted">
          The user will sign in using email/password.
          A SUPER_ADMIN will assign their password after creating the user.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !email}>
            {saving ? 'Saving...' : 'Create User'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function SetPasswordModal({
  user,
  onClose,
  onSaved,
}: {
  user: UserRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSaving(true);
    try {
      await api.post(`/users/${user.id}/password`, { password });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to set password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Set Password: ${user.email}`}>
      {error && <Banner tone="error">{error}</Banner>}
      <div className="space-y-3">
        <Field label="New password">
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
        </Field>
        <Field label="Confirm password">
          <PasswordInput
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat password"
            autoComplete="new-password"
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !password || !confirmPassword}>
            {saving ? 'Saving...' : 'Set Password'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
