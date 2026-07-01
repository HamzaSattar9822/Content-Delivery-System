'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { NotificationRecord, NotificationRule, Paginated } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { Badge, Banner, Button, Card, CardHeader, EmptyState, Field, Input, PageHeader, Select, Spinner, Table } from '@/components/ui';
import { formatDate } from '@/lib/format';

export default function NotificationsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('notification:manage');

  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newThreshold, setNewThreshold] = useState('');
  const [newRecipient, setNewRecipient] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [n, r] = await Promise.all([
        api.get<Paginated<NotificationRecord>>('/notifications', { pageSize: 50 }),
        api.get<NotificationRule[]>('/notifications/rules'),
      ]);
      setNotifications(n.data);
      setRules(r);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addRule = async () => {
    const threshold = Number(newThreshold);
    if (!threshold) return;
    await api.post('/notifications/rules', {
      type: 'VIEW_THRESHOLD',
      threshold,
      recipient: newRecipient || undefined,
    });
    setNewThreshold('');
    setNewRecipient('');
    void load();
  };

  const toggleRule = async (rule: NotificationRule) => {
    await api.patch(`/notifications/rules/${rule.id}`, { enabled: !rule.enabled });
    void load();
  };

  const deleteRule = async (id: string) => {
    await api.delete(`/notifications/rules/${id}`);
    void load();
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Notifications" description="Automated alerts for thresholds and security events." />
      {error && <Banner tone="error">{error}</Banner>}

      {canManage && (
        <Card className="mb-6">
          <CardHeader title="View Threshold Alerts" subtitle="Trigger an email when a link reaches a view count." />
          <div className="p-4">
            <div className="flex flex-wrap items-end gap-3 mb-4">
              <Field label="Threshold (views)">
                <Input type="number" min={1} value={newThreshold} onChange={(e) => setNewThreshold(e.target.value)} placeholder="100" />
              </Field>
              <Field label="Recipient (optional)">
                <Input type="email" value={newRecipient} onChange={(e) => setNewRecipient(e.target.value)} placeholder="alerts@example.com" />
              </Field>
              <Button onClick={addRule} disabled={!newThreshold}>
                Add rule
              </Button>
            </div>

            {rules.length === 0 ? (
              <EmptyState message="No alert rules configured." />
            ) : (
              <Table headers={['Type', 'Threshold', 'Scope', 'Recipient', 'Enabled', '']}>
                {rules.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2 text-ink">{r.type}</td>
                    <td className="px-4 py-2 text-muted">{r.threshold ?? '-'}</td>
                    <td className="px-4 py-2 text-muted">{r.link?.label ?? 'Global'}</td>
                    <td className="px-4 py-2 text-muted">{r.recipient ?? 'Default'}</td>
                    <td className="px-4 py-2">
                      <Badge tone={r.enabled ? 'default' : 'muted'}>{r.enabled ? 'On' : 'Off'}</Badge>
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <button onClick={() => toggleRule(r)} className="text-sm text-ink hover:underline mr-3">
                        {r.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button onClick={() => deleteRule(r.id)} className="text-sm text-ink hover:underline">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Notification History" />
        <div className="p-0">
          {notifications.length === 0 ? (
            <div className="p-4">
              <EmptyState message="No notifications sent yet." />
            </div>
          ) : (
            <Table headers={['Type', 'Title', 'Recipient', 'Status', 'When']}>
              {notifications.map((n) => (
                <tr key={n.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2 text-muted">{n.type}</td>
                  <td className="px-4 py-2 text-ink max-w-[260px] truncate">{n.title}</td>
                  <td className="px-4 py-2 text-muted">{n.recipient}</td>
                  <td className="px-4 py-2">
                    <Badge tone={n.status === 'SENT' ? 'default' : 'muted'}>{n.status}</Badge>
                  </td>
                  <td className="px-4 py-2 text-muted whitespace-nowrap">{formatDate(n.createdAt)}</td>
                </tr>
              ))}
            </Table>
          )}
        </div>
      </Card>
    </div>
  );
}
