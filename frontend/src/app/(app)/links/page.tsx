'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { AccessLink, NotificationRule, Paginated } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Table,
} from '@/components/ui';
import { formatDate } from '@/lib/format';

export default function LinkManagementPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('link:manage');
  const canNotify = hasPermission('notification:manage');

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
      <PageHeader
        title="Link Management"
        description="Control delivery links, expiration, and view-threshold alerts per link."
      />
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
        <Table headers={['Label', 'Content', 'Type', 'Created', 'Expires', 'Views', 'Remaining', 'Status', '']}>
          {links.map((l) => (
            <tr key={l.id} className="border-b border-line last:border-0 align-top">
              <td className="px-4 py-2 text-ink max-w-[140px] truncate">
                {l.label ?? l.id.slice(0, 8)}
                {l.hasPassword && <span className="ml-2 text-xs text-muted">(password)</span>}
              </td>
              <td className="px-4 py-2 text-muted max-w-[140px] truncate">{l.content?.title ?? '-'}</td>
              <td className="px-4 py-2 text-muted">{l.content?.fileType ?? '-'}</td>
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
          canNotify={canNotify}
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

function EditLinkModal({
  link,
  canNotify,
  onClose,
  onSaved,
}: {
  link: AccessLink;
  canNotify: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [expiresAt, setExpiresAt] = useState('');
  const [maxViews, setMaxViews] = useState(link.maxViews?.toString() ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [threshold, setThreshold] = useState('');
  const [recipient, setRecipient] = useState('');
  const [rulesLoading, setRulesLoading] = useState(false);

  const loadRules = useCallback(async () => {
    if (!canNotify) return;
    setRulesLoading(true);
    try {
      const all = await api.get<NotificationRule[]>('/notifications/rules', { linkId: link.id });
      setRules(all.filter((r) => r.link?.id === link.id));
    } catch {
      setRules([]);
    } finally {
      setRulesLoading(false);
    }
  }, [canNotify, link.id]);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

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

  const addRule = async () => {
    const value = Number(threshold);
    if (!value) return;
    setSaving(true);
    setError(null);
    try {
      await api.post('/notifications/rules', {
        type: 'VIEW_THRESHOLD',
        threshold: value,
        recipient: recipient || undefined,
        linkId: link.id,
      });
      setThreshold('');
      setRecipient('');
      await loadRules();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add alert rule');
    } finally {
      setSaving(false);
    }
  };

  const toggleRule = async (rule: NotificationRule) => {
    await api.patch(`/notifications/rules/${rule.id}`, { enabled: !rule.enabled });
    await loadRules();
  };

  const deleteRule = async (id: string) => {
    await api.delete(`/notifications/rules/${id}`);
    await loadRules();
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
            <Input
              type="number"
              min={1}
              value={maxViews}
              onChange={(e) => setMaxViews(e.target.value)}
              placeholder="Unlimited"
            />
          </Field>
          <div className="mt-2">
            <Button onClick={increase} disabled={saving}>
              Update view limit
            </Button>
          </div>
        </div>

        {canNotify && (
          <div className="border-t border-line pt-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-ink">View threshold alerts</h3>
              <p className="text-xs text-muted mt-0.5">
                Email when this link reaches a view count. Global rules still apply.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Threshold (views)">
                <Input
                  type="number"
                  min={1}
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  placeholder="100"
                />
              </Field>
              <Field label="Recipient (optional)">
                <Input
                  type="email"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="alerts@example.com"
                />
              </Field>
              <Button onClick={addRule} disabled={saving || !threshold}>
                Add alert
              </Button>
            </div>
            {rulesLoading ? (
              <Spinner />
            ) : rules.length === 0 ? (
              <p className="text-xs text-muted">No per-link alerts yet.</p>
            ) : (
              <ul className="divide-y divide-line border border-line rounded">
                {rules.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="text-ink">
                      {r.threshold} views · {r.recipient ?? 'Default recipient'} · {r.enabled ? 'On' : 'Off'}
                    </span>
                    <span className="shrink-0">
                      <button onClick={() => toggleRule(r)} className="text-ink hover:underline mr-3">
                        {r.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button onClick={() => deleteRule(r.id)} className="text-ink hover:underline">
                        Delete
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
