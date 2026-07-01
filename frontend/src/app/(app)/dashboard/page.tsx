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
      <PageHeader title="Dashboard" description="Overview of content, links and viewing activity." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Total Content" value={metrics.totalContent} />
        <Stat label="Total Videos" value={metrics.totalVideos} />
        <Stat label="Active Links" value={metrics.activeLinks} />
        <Stat label="Expired Links" value={metrics.expiredLinks} />
        <Stat label="Total Views" value={metrics.totalViews} />
        <Stat label="Views Today" value={metrics.viewsToday} />
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
                  <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="truncate text-ink">{c.title}</span>
                    <span className="text-muted ml-3">{c.views} views</span>
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
              <Table headers={['Content', 'Device', 'Location', 'When']}>
                {metrics.recentActivity.map((a) => (
                  <tr key={a.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2 text-ink truncate max-w-[160px]">{a.content}</td>
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
