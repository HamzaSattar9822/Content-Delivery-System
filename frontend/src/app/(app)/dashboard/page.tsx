'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { DashboardMetrics } from '@/lib/types';
import { Banner, Card, CardHeader, EmptyState, PageHeader, Spinner, Stat, Table } from '@/components/ui';
import { formatDate } from '@/lib/format';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DashboardMetrics>('/analytics/dashboard')
      .then(setMetrics)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load dashboard'));
  }, []);

  if (error) return <Banner tone="error">{error}</Banner>;
  if (!metrics) return <Spinner />;

  return (
    <div>
      <PageHeader title="Dashboard" description="Overview of content, links and viewing activity across all formats." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Total Content" value={metrics.totalContent} />
        <Stat label="Videos" value={metrics.totalVideos} />
        <Stat label="PDFs" value={metrics.totalPdfs ?? 0} />
        <Stat label="Active Links" value={metrics.activeLinks} />
        <Stat label="Expired Links" value={metrics.expiredLinks} />
        <Stat label="Revoked Links" value={metrics.revokedLinks ?? 0} />
        <Stat label="Total Views" value={metrics.totalViews} />
        <Stat label="Views Today" value={metrics.viewsToday} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <BreakdownCard title="Content by format" items={metrics.contentByType ?? []} />
        <BreakdownCard title="Views by format" items={metrics.viewsByFileType ?? []} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Most Viewed Content" />
          <div className="p-4">
            {metrics.mostViewedContent.length === 0 ? (
              <EmptyState message="No views recorded yet." />
            ) : (
              <ul className="divide-y divide-line">
                {metrics.mostViewedContent.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2 text-sm gap-3">
                    <span className="truncate text-ink">{c.title}</span>
                    <span className="text-muted shrink-0">
                      {c.fileType} · {c.views} views
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent Activity" />
          <div className="p-0">
            {metrics.recentActivity.length === 0 ? (
              <div className="p-4">
                <EmptyState message="No recent activity." />
              </div>
            ) : (
              <Table headers={['Content', 'Type', 'Device', 'Location', 'When']}>
                {metrics.recentActivity.map((a) => (
                  <tr key={a.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2 text-ink truncate max-w-[140px]">{a.content}</td>
                    <td className="px-4 py-2 text-muted">{a.fileType ?? '-'}</td>
                    <td className="px-4 py-2 text-muted">{a.deviceType}</td>
                    <td className="px-4 py-2 text-muted">{a.country ?? a.ipAddress ?? '-'}</td>
                    <td className="px-4 py-2 text-muted whitespace-nowrap">{formatDate(a.createdAt)}</td>
                  </tr>
                ))}
              </Table>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function BreakdownCard({ title, items }: { title: string; items: { key: string; count: number }[] }) {
  const total = items.reduce((sum, i) => sum + i.count, 0) || 1;
  return (
    <Card>
      <CardHeader title={title} />
      <div className="p-4">
        {items.length === 0 ? (
          <EmptyState message="No data yet." />
        ) : (
          <ul className="space-y-2">
            {items.map((i) => (
              <li key={i.key} className="text-sm">
                <div className="flex justify-between text-ink">
                  <span>{i.key}</span>
                  <span className="text-muted">{i.count}</span>
                </div>
                <div className="h-1.5 bg-subtle border border-line rounded-full mt-1 overflow-hidden">
                  <div className="h-full bg-accent rounded-full" style={{ width: `${(i.count / total) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
