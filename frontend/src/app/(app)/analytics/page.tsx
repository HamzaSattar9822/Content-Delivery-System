'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError, downloadReport } from '@/lib/api';
import { AccessLink, DetailedAnalytics, Paginated } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import {
  Banner,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  PageHeader,
  Select,
  Spinner,
  Stat,
} from '@/components/ui';
import { formatDuration } from '@/lib/format';

const REPORTS = [
  { type: 'content-usage', label: 'Content Usage' },
  { type: 'link-usage', label: 'Link Usage' },
  { type: 'viewer-activity', label: 'Viewer Activity' },
  { type: 'security-events', label: 'Security Events' },
  { type: 'expired-links', label: 'Expired Links' },
];

type TimeRange = '7d' | '30d' | '90d' | 'all' | 'custom';

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function rangeToDates(range: TimeRange, customFrom: string, customTo: string): { from?: string; to?: string } {
  if (range === 'all') return {};
  if (range === 'custom') {
    return {
      from: customFrom ? startOfDay(new Date(customFrom)).toISOString() : undefined,
      to: customTo ? endOfDay(new Date(customTo)).toISOString() : undefined,
    };
  }
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const from = startOfDay(new Date());
  from.setDate(from.getDate() - (days - 1));
  return { from: from.toISOString(), to: endOfDay(new Date()).toISOString() };
}

function linkLabel(link: AccessLink): string {
  const title = link.content?.title ? ` · ${link.content.title}` : '';
  const label = link.label?.trim() || 'Untitled link';
  return `${label}${title} (${link.status})`;
}

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
  const [links, setLinks] = useState<AccessLink[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  const [linkId, setLinkId] = useState('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const dateQuery = useMemo(
    () => rangeToDates(timeRange, customFrom, customTo),
    [timeRange, customFrom, customTo],
  );

  useEffect(() => {
    api
      .get<Paginated<AccessLink>>('/links', { status: 'all', pageSize: 100 })
      .then((res) => setLinks(res.data))
      .catch(() => setLinks([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query: Record<string, string | number | undefined> = {
        ...dateQuery,
        linkId: linkId !== 'all' ? linkId : undefined,
      };
      const result = await api.get<DetailedAnalytics>('/analytics/detailed', query);
      setData(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load analytics');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [dateQuery, linkId]);

  useEffect(() => {
    void load();
  }, [load]);

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

  return (
    <div>
      <PageHeader title="Analytics" description="Viewing behaviour, audience and engagement." />

      <Card className="p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Link">
            <Select value={linkId} onChange={(e) => setLinkId(e.target.value)}>
              <option value="all">All links</option>
              {links.map((l) => (
                <option key={l.id} value={l.id}>
                  {linkLabel(l)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Time range">
            <Select value={timeRange} onChange={(e) => setTimeRange(e.target.value as TimeRange)}>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="all">All time</option>
              <option value="custom">Custom range</option>
            </Select>
          </Field>

          {timeRange === 'custom' && (
            <>
              <Field label="From">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full border border-line rounded-lg px-3 py-2 text-sm text-ink bg-elevated focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none"
                />
              </Field>
              <Field label="To">
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-full border border-line rounded-lg px-3 py-2 text-sm text-ink bg-elevated focus:border-accent focus:ring-1 focus:ring-accent/30 outline-none"
                />
              </Field>
            </>
          )}
        </div>
      </Card>

      {error && <Banner tone="error">{error}</Banner>}

      {loading ? (
        <Spinner />
      ) : !data ? (
        <EmptyState message="No analytics data for this filter." />
      ) : (
        <>
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
        </>
      )}

      {hasPermission('report:export') && (
        <Card>
          <CardHeader title="Export Reports" subtitle="Download CSV, Excel or PDF." />
          <div className="p-4 space-y-2">
            {REPORTS.map((r) => (
              <div
                key={r.type}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-line last:border-0 py-2"
              >
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
