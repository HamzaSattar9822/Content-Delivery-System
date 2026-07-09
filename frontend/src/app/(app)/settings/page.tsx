'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { SettingRecord } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { Banner, Button, Card, CardHeader, EmptyState, Input, PageHeader, Spinner } from '@/components/ui';
import { formatDate } from '@/lib/format';

export default function SettingsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('settings:manage');

  const [settings, setSettings] = useState<SettingRecord[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<SettingRecord[]>('/settings');
      setSettings(data);
      setDrafts(Object.fromEntries(data.map((s) => [s.key, JSON.stringify(s.value)])));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (key: string) => {
    setError(null);
    setSaved(null);
    let value: unknown;
    try {
      value = JSON.parse(drafts[key]);
    } catch {
      value = drafts[key];
    }
    try {
      await api.put(`/settings/${encodeURIComponent(key)}`, { value });
      setSaved(key);
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save setting');
    }
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Settings" description="System configuration. Values are stored as JSON." />
      {error && <Banner tone="error">{error}</Banner>}

      <Card>
        <CardHeader title="System Settings" />
        <div className="p-4 space-y-4">
          {settings.length === 0 ? (
            <EmptyState message="No settings defined." />
          ) : (
            settings.map((s) => (
              <div key={s.key} className="border-b border-line last:border-0 pb-4 last:pb-0">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink">{s.key}</p>
                    {s.description && <p className="text-xs text-muted">{s.description}</p>}
                  </div>
                  <span className="text-xs text-muted">Updated {formatDate(s.updatedAt)}</span>
                </div>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={drafts[s.key] ?? ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [s.key]: e.target.value }))}
                    disabled={!canManage}
                  />
                  {canManage && (
                    <Button onClick={() => save(s.key)} className="shrink-0">
                      {saved === s.key ? 'Saved' : 'Save'}
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {!canManage && (
        <p className="text-xs text-muted mt-4">You have read-only access to settings.</p>
      )}
    </div>
  );
}
