'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { Content, CreatedLinkResponse, Paginated } from '@/lib/types';
import { Banner, Button, Card, CardHeader, Field, Input, PageHeader, Select, Spinner } from '@/components/ui';

export default function CreateLinkPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <CreateLinkForm />
    </Suspense>
  );
}

function CreateLinkForm() {
  const params = useSearchParams();
  const presetContentId = params.get('contentId') ?? '';

  const [content, setContent] = useState<Content[]>([]);
  const [contentId, setContentId] = useState(presetContentId);
  const [label, setLabel] = useState('');
  const [neverExpire, setNeverExpire] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [maxViews, setMaxViews] = useState('');
  const [maxSessions, setMaxSessions] = useState('');
  const [maxDevices, setMaxDevices] = useState('');
  const [maxConcurrent, setMaxConcurrent] = useState('');
  const [password, setPassword] = useState('');
  const [ipAllowlist, setIpAllowlist] = useState('');
  const [domainAllowlist, setDomainAllowlist] = useState('');

  const [created, setCreated] = useState<CreatedLinkResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  useEffect(() => {
    api
      .get<Paginated<Content>>('/content', { status: 'ACTIVE', pageSize: 100 })
      .then((d) => setContent(d.data))
      .catch(() => undefined);
  }, []);

  const numberOrNull = (v: string): number | null | undefined => {
    if (v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  const submit = async () => {
    setError(null);
    if (!contentId) {
      setError('Select content for this link.');
      return;
    }
    if (!neverExpire && !expiresAt) {
      setError('Set an expiration date or choose "Never expire".');
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.post<CreatedLinkResponse>('/links', {
        contentId,
        label: label || undefined,
        neverExpire,
        expiresAt: neverExpire ? null : new Date(expiresAt).toISOString(),
        maxViews: numberOrNull(maxViews),
        maxSessions: numberOrNull(maxSessions),
        maxDevices: numberOrNull(maxDevices),
        maxConcurrent: numberOrNull(maxConcurrent),
        password: password || undefined,
        ipAllowlist: ipAllowlist ? ipAllowlist.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        domainAllowlist: domainAllowlist ? domainAllowlist.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      });
      setCreated(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create link');
    } finally {
      setSubmitting(false);
    }
  };

  const copy = async () => {
    if (!created) return;
    await navigator.clipboard.writeText(created.watchUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const copyEmbed = async () => {
    if (!created) return;
    await navigator.clipboard.writeText(created.embedCode);
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 1500);
  };

  if (created) {
    return (
      <div>
        <PageHeader
          title="Delivery Link Created"
          description="Copy the watch URL and embed code now. The token is shown only once."
        />
        <Card className="p-4 max-w-2xl">
          <Banner>
            This is the only time the full link and embed code are displayed. Store them securely.
          </Banner>
          <Field label="Secure watch URL" hint="Open directly in a browser.">
            <Input readOnly value={created.watchUrl} onFocus={(e) => e.currentTarget.select()} />
          </Field>
          <Field
            label="Embed code"
            hint="Paste this iframe HTML into a course page or website. Set domain allowlist to restrict playback to specific hostnames."
          >
            <textarea
              readOnly
              value={created.embedCode}
              onFocus={(e) => e.currentTarget.select()}
              rows={5}
              className="w-full rounded border border-line bg-white px-3 py-2 text-sm font-mono text-ink"
            />
          </Field>
          <div className="flex flex-wrap gap-2 mt-3">
            <Button onClick={copy}>{copied ? 'Copied' : 'Copy link'}</Button>
            <Button onClick={copyEmbed}>{copiedEmbed ? 'Copied' : 'Copy embed code'}</Button>
            <Link href="/links">
              <Button variant="secondary">Go to Link Management</Button>
            </Link>
            <Button
              variant="secondary"
              onClick={() => {
                setCreated(null);
                setLabel('');
                setPassword('');
              }}
            >
              Create another
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Create Delivery Link" description="Generate a secure, controlled link to share content." />
      {error && <Banner tone="error">{error}</Banner>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
        <Card>
          <CardHeader title="Content" />
          <div className="p-4 space-y-4">
            <Field label="Content">
              <Select value={contentId} onChange={(e) => setContentId(e.target.value)}>
                <option value="">Select content...</option>
                {content.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({c.fileType})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Label" hint="Internal name to identify this link.">
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Client A - Q3 onboarding" />
            </Field>
          </div>

          <CardHeader title="Expiration" />
          <div className="p-4 space-y-3">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={neverExpire} onChange={(e) => setNeverExpire(e.target.checked)} />
              Never expire
            </label>
            {!neverExpire && (
              <Field label="Expiration date & time">
                <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              </Field>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Access Controls" subtitle="Leave blank for unlimited." />
          <div className="p-4 grid grid-cols-2 gap-3">
            <Field label="Maximum views">
              <Input type="number" min={1} value={maxViews} onChange={(e) => setMaxViews(e.target.value)} placeholder="Unlimited" />
            </Field>
            <Field label="Maximum sessions">
              <Input type="number" min={1} value={maxSessions} onChange={(e) => setMaxSessions(e.target.value)} placeholder="Unlimited" />
            </Field>
            <Field label="Maximum devices">
              <Input type="number" min={1} value={maxDevices} onChange={(e) => setMaxDevices(e.target.value)} placeholder="Unlimited" />
            </Field>
            <Field label="Max concurrent users">
              <Input type="number" min={1} value={maxConcurrent} onChange={(e) => setMaxConcurrent(e.target.value)} placeholder="Unlimited" />
            </Field>
          </div>

          <CardHeader title="Optional Protections" />
          <div className="p-4 space-y-3">
            <Field label="Password" hint="Viewers must enter this to access.">
              <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="No password" />
            </Field>
            <Field label="IP allowlist" hint="Comma separated. Blank allows any IP.">
              <Input value={ipAllowlist} onChange={(e) => setIpAllowlist(e.target.value)} placeholder="203.0.113.4, 198.51.100.0" />
            </Field>
            <Field label="Domain allowlist" hint="For iframe embedding. Comma-separated hostnames.">
              <Input value={domainAllowlist} onChange={(e) => setDomainAllowlist(e.target.value)} placeholder="lms.example.com" />
            </Field>
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <Button onClick={submit} disabled={submitting}>
          {submitting ? 'Generating...' : 'Generate Secure Link'}
        </Button>
      </div>
    </div>
  );
}
