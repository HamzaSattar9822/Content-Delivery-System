'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { AccessLink, Paginated } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { Badge, Banner, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Table } from '@/components/ui';
import { formatDate } from '@/lib/format';

export default function LinkManagementPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('link:manage');

  const [links, setLinks] = useState<AccessLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<AccessLink | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Paginated<AccessLink>>('/links', { search, status, pageSize: 50 });
      setLinks(data.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load links');
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: string, action: string) => {
    await api.post(`/links/${id}/${action}`);
    void load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this link permanently?')) return;
    await api.delete(`/links/${id}`);
    void load();
  };

  return (
    <div>
      <PageHeader title="Link Management" description="Control, monitor and revoke delivery links." />
      {error && <Banner tone="error">{error}</Banner>}

      <Card className="p-3 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input placeholder="Search by label or content" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="DISABLED">Disabled</option>
            <option value="REVOKED">Revoked</option>
            <option value="EXPIRED">Expired</option>
          </Select>
        </div>
      </Card>

      {loading ? (
        <Spinner />
      ) : links.length === 0 ? (
        <EmptyState message="No delivery links yet." />
      ) : (
        <Table headers={['Label', 'Content', 'Created', 'Expires', 'Views', 'Remaining', 'Status', '']}>
          {links.map((l) => (
            <tr key={l.id} className="border-b border-line last:border-0 align-top">
              <td className="px-4 py-2 text-ink max-w-[160px] truncate">
                {l.label ?? l.id.slice(0, 8)}
                {l.hasPassword && <span className="ml-2 text-xs text-muted">(password)</span>}
              </td>
              <td className="px-4 py-2 text-muted max-w-[160px] truncate">{l.content?.title ?? '-'}</td>
              <td className="px-4 py-2 text-muted whitespace-nowrap">{formatDate(l.createdAt)}</td>
              <td className="px-4 py-2 text-muted whitespace-nowrap">
                {l.neverExpire ? 'Never' : formatDate(l.expiresAt)}
              </td>
              <td className="px-4 py-2 text-muted">{l.viewCount}</td>
              <td className="px-4 py-2 text-muted">{l.maxViews == null ? 'Unlimited' : l.remainingViews}</td>
              <td className="px-4 py-2">
                <Badge tone={l.status === 'ACTIVE' ? 'default' : 'muted'}>{l.status}</Badge>
              </td>
              <td className="px-4 py-2 text-right whitespace-nowrap">
                {canManage ? (
                  <div className="flex flex-wrap gap-2 justify-end">
                    {l.status === 'ACTIVE' ? (
                      <button onClick={() => act(l.id, 'disable')} className="text-sm text-ink hover:underline">
                        Disable
                      </button>
                    ) : l.status === 'DISABLED' ? (
                      <button onClick={() => act(l.id, 'enable')} className="text-sm text-ink hover:underline">
                        Enable
                      </button>
                    ) : null}
                    <button onClick={() => setEditing(l)} className="text-sm text-ink hover:underline">
                      Edit
                    </button>
                    {l.status !== 'REVOKED' && (
                      <button onClick={() => act(l.id, 'revoke')} className="text-sm text-ink hover:underline">
                        Revoke
                      </button>
                    )}
                    <button onClick={() => remove(l.id)} className="text-sm text-ink hover:underline">
                      Delete
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-muted">View only</span>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}

      {editing && (
        <EditLinkModal
          link={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function EditLinkModal({ link, onClose, onSaved }: { link: AccessLink; onClose: () => void; onSaved: () => void }) {
  const [expiresAt, setExpiresAt] = useState('');
  const [maxViews, setMaxViews] = useState(link.maxViews?.toString() ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const extend = async () => {
    if (!expiresAt) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/links/${link.id}/extend`, { expiresAt: new Date(expiresAt).toISOString() });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to extend');
    } finally {
      setSaving(false);
    }
  };

  const increase = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.post(`/links/${link.id}/increase-views`, {
        maxViews: maxViews === '' ? null : Number(maxViews),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Edit link: ${link.label ?? link.id.slice(0, 8)}`}>
      {error && <Banner tone="error">{error}</Banner>}
      <div className="space-y-5">
        <div>
          <Field label="Extend expiration to">
            <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </Field>
          <div className="mt-2">
            <Button onClick={extend} disabled={saving || !expiresAt}>
              Extend expiration
            </Button>
          </div>
        </div>
        <div className="border-t border-line pt-4">
          <Field label="Maximum views" hint="Leave blank for unlimited.">
            <Input type="number" min={1} value={maxViews} onChange={(e) => setMaxViews(e.target.value)} placeholder="Unlimited" />
          </Field>
          <div className="mt-2">
            <Button onClick={increase} disabled={saving}>
              Update view limit
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
