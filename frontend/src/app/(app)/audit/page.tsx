'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { AuditLogRecord, Paginated } from '@/lib/types';
import { Badge, Banner, Card, EmptyState, Input, PageHeader, Select, Spinner, Table } from '@/components/ui';
import { formatDate } from '@/lib/format';

const ACTIONS = [
  'LOGIN',
  'LOGOUT',
  'USER_CREATE',
  'USER_UPDATE',
  'USER_DELETE',
  'CONTENT_CREATE',
  'CONTENT_UPDATE',
  'CONTENT_DELETE',
  'CONTENT_ARCHIVE',
  'CONTENT_RESTORE',
  'LINK_CREATE',
  'LINK_UPDATE',
  'LINK_REVOKE',
  'LINK_DELETE',
  'LINK_ACCESS',
  'ACCESS_DENIED',
  'SECURITY_EVENT',
  'SETTINGS_UPDATE',
  'DRIVE_SYNC',
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
      <PageHeader title="Audit Logs" description="A searchable trail of every significant action." />
      {error && <Banner tone="error">{error}</Banner>}

      <Card className="p-3 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input
            placeholder="Search actor, entity..."
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
              <option key={a} value={a}>
                {a}
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
          <Table headers={['When', 'Action', 'Actor', 'Entity', 'IP', 'Details']}>
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-line last:border-0 align-top">
                <td className="px-4 py-2 text-muted whitespace-nowrap">{formatDate(l.createdAt)}</td>
                <td className="px-4 py-2">
                  <Badge tone={l.action.includes('DENIED') || l.action.includes('SECURITY') ? 'default' : 'muted'}>
                    {l.action}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-muted">{l.user?.email ?? l.actorEmail ?? 'System'}</td>
                <td className="px-4 py-2 text-muted">{l.entityType ? `${l.entityType}` : '-'}</td>
                <td className="px-4 py-2 text-muted">{l.ipAddress ?? '-'}</td>
                <td className="px-4 py-2 text-muted max-w-[260px] truncate">
                  {l.metadata ? JSON.stringify(l.metadata) : '-'}
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
