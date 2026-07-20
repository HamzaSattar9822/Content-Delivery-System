'use client';

import { useEffect, useState } from 'react';
import { api, ApiError, downloadReport } from '@/lib/api';
import { DetailedAnalytics } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { Banner, Button, Card, CardHeader, EmptyState, PageHeader, Spinner, Stat } from '@/components/ui';
import { formatDuration } from '@/lib/format';

const REPORTS = [
  { type: 'content-usage', label: 'Content Usage' },
  { type: 'link-usage', label: 'Link Usage' },
  { type: 'viewer-activity', label: 'Viewer Activity' },
  { type: 'security-events', label: 'Security Events' },
  { type: 'expired-links', label: 'Expired Links' },
];

function Breakdown({ title, items }: { title: string; items: { key: string; count: number }[] }) {
  const total = items.reduce((sum, i) => sum + i.count, 0) || 1;
  return (
    <Card>
      <CardHeader title={title} />
      <div className="p-4">
        {items.length === 0 ? (
          <EmptyState message="No data." />
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

export default function AnalyticsPage() {
  const { hasPermission } = useAuth();
  const [data, setData] = useState<DetailedAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DetailedAnalytics>('/analytics/detailed')
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load analytics'));
  }, []);

  const handleExport = async (type: string, format: string) => {
    setExporting(`${type}-${format}`);
    try {
      await downloadReport(type, format);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  if (error) return <Banner tone="error">{error}</Banner>;
  if (!data) return <Spinner />;

  return (
    <div>
      <PageHeader title="Analytics" description="Viewing behaviour, audience and engagement." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Total Views" value={data.totalViews} />
        <Stat label="Unique Viewers" value={data.uniqueViewers} />
        <Stat label="Repeat Viewers" value={data.repeatViewers} />
        <Stat label="Sessions" value={data.sessions} />
        <Stat label="Avg Watch Time" value={formatDuration(data.averageWatchSeconds)} />
        <Stat label="Total Watch Time" value={formatDuration(data.totalWatchSeconds)} />
        <Stat label="Completion Rate" value={`${data.completionRate}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <Breakdown title="Content Formats" items={data.fileTypes ?? []} />
        <Breakdown title="Device Types" items={data.deviceTypes} />
        <Breakdown title="Browsers" items={data.browsers} />
        <Breakdown title="Countries" items={data.countries} />
      </div>

      {hasPermission('report:export') && (
        <Card>
          <CardHeader title="Export Reports" subtitle="Download CSV, Excel or PDF." />
          <div className="p-4 space-y-2">
            {REPORTS.map((r) => (
              <div key={r.type} className="flex flex-wrap items-center justify-between gap-2 border-b border-line last:border-0 py-2">
                <span className="text-sm text-ink">{r.label}</span>
                <div className="flex gap-2">
                  {['csv', 'xlsx', 'pdf'].map((fmt) => (
                    <Button
                      key={fmt}
                      variant="secondary"
                      onClick={() => handleExport(r.type, fmt)}
                      disabled={exporting === `${r.type}-${fmt}`}
                    >
                      {fmt.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
