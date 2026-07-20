'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { AuditLogRecord, Paginated } from '@/lib/types';
import { Badge, Banner, Card, EmptyState, Input, PageHeader, Select, Spinner, Table } from '@/components/ui';
import { formatDate } from '@/lib/format';

const ACTIONS: { value: string; label: string }[] = [
  { value: 'LOGIN', label: 'Signed in' },
  { value: 'LOGOUT', label: 'Signed out' },
  { value: 'USER_CREATE', label: 'Created user' },
  { value: 'USER_UPDATE', label: 'Updated user' },
  { value: 'USER_DELETE', label: 'Deleted user' },
  { value: 'CONTENT_CREATE', label: 'Added content' },
  { value: 'CONTENT_UPDATE', label: 'Updated content' },
  { value: 'CONTENT_DELETE', label: 'Deleted content' },
  { value: 'CONTENT_ARCHIVE', label: 'Archived content' },
  { value: 'CONTENT_RESTORE', label: 'Restored content' },
  { value: 'LINK_CREATE', label: 'Created delivery link' },
  { value: 'LINK_UPDATE', label: 'Updated delivery link' },
  { value: 'LINK_REVOKE', label: 'Revoked delivery link' },
  { value: 'LINK_DELETE', label: 'Deleted delivery link' },
  { value: 'LINK_ACCESS', label: 'Opened delivery link' },
  { value: 'ACCESS_DENIED', label: 'Access denied' },
  { value: 'SECURITY_EVENT', label: 'Security event' },
  { value: 'SETTINGS_UPDATE', label: 'Updated settings' },
  { value: 'DRIVE_SYNC', label: 'Synced from Google Drive' },
];

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Paginated<AuditLogRecord>>('/audit-logs', {
        search,
        action,
        page,
        pageSize: 50,
      });
      setLogs(data.data);
      setPagination({ page: data.pagination.page, totalPages: data.pagination.totalPages });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [search, action, page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description="A clear history of sign-ins, content changes, link activity, and security events."
      />
      {error && <Banner tone="error">{error}</Banner>}

      <Card className="p-3 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input
            placeholder="Search actor, content, or link..."
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
          <Select
            value={action}
            onChange={(e) => {
              setPage(1);
              setAction(e.target.value);
            }}
          >
            <option value="">All actions</option>
            {ACTIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {loading ? (
        <Spinner />
      ) : logs.length === 0 ? (
        <EmptyState message="No audit entries found." />
      ) : (
        <>
          <Table headers={['When', 'What happened', 'Who', 'What was affected', 'IP address', 'Details']}>
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-line last:border-0 align-top">
                <td className="px-4 py-2 text-muted whitespace-nowrap">{formatDate(l.createdAt)}</td>
                <td className="px-4 py-2">
                  <Badge
                    tone={
                      l.action.includes('DENIED') || l.action.includes('SECURITY') || l.action.includes('REVOKE')
                        ? 'default'
                        : 'muted'
                    }
                  >
                    {l.actionLabel ?? l.action}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-muted">{l.actorDisplay ?? l.user?.email ?? l.actorEmail ?? 'System'}</td>
                <td className="px-4 py-2 text-muted max-w-[200px]">
                  {l.entityDisplay ?? (l.entityType ? l.entityType : '—')}
                </td>
                <td className="px-4 py-2 text-muted whitespace-nowrap">{l.ipAddress ?? '—'}</td>
                <td className="px-4 py-2 text-muted max-w-[320px] whitespace-normal">
                  {l.summary ?? 'No additional details were recorded for this action.'}
                </td>
              </tr>
            ))}
          </Table>
          <div className="flex items-center justify-between mt-4 text-sm">
            <button
              disabled={pagination.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="text-ink hover:underline disabled:text-muted disabled:no-underline"
            >
              Previous
            </button>
            <span className="text-muted">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="text-ink hover:underline disabled:text-muted disabled:no-underline"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
