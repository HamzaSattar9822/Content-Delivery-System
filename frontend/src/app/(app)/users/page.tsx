'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Paginated, RoleName, UserRecord } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { Badge, Banner, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Table } from '@/components/ui';
import { formatDate } from '@/lib/format';

const ROLES: RoleName[] = ['SUPER_ADMIN', 'CONTENT_MANAGER', 'READ_ONLY'];

export default function UsersPage() {
  const { hasPermission, user: current } = useAuth();
  const canManage = hasPermission('user:manage');

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Paginated<UserRecord>>('/users', { pageSize: 100 });
      setUsers(data.data);
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
    await api.patch(`/users/${id}`, { roleName });
    void load();
  };

  const toggleStatus = async (u: UserRecord) => {
    await api.patch(`/users/${u.id}`, { status: u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' });
    void load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this user?')) return;
    await api.delete(`/users/${id}`);
    void load();
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
                    <button onClick={() => toggleStatus(u)} className="text-sm text-ink hover:underline mr-3">
                      {u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                    </button>
                    <button onClick={() => remove(u.id)} className="text-sm text-ink hover:underline">
                      Delete
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
        <p className="text-xs text-muted">The user signs in with Google using this email address.</p>
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
