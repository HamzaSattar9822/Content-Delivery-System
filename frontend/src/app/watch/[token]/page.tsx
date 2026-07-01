'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Banner, Button, Card, Field, Input, Spinner } from '@/components/ui';

const CdsVideoPlayer = dynamic(
  () => import('@/components/player/CdsVideoPlayer').then((mod) => mod.CdsVideoPlayer),
  {
    ssr: false,
    loading: () => (
      <div className="w-full aspect-video min-h-[240px] bg-black flex items-center justify-center text-sm text-white rounded border border-line">
        Loading player…
      </div>
    ),
  },
);

interface ResolveResponse {
  label: string | null;
  status: 'ACTIVE' | 'DISABLED' | 'REVOKED' | 'EXPIRED';
  requiresPassword: boolean;
  neverExpire: boolean;
  expiresAt: string | null;
  content: { title: string; fileType: string };
}

interface AccessResponse {
  content: {
    id: string;
    title: string;
    description: string | null;
    fileType: string;
    mimeType: string | null;
    durationSeconds: number | null;
    thumbnailUrl: string | null;
  };
  sessionKey: string;
  streamUrl: string;
  remainingViews: number | null;
  expiresAt: string | null;
  resumeAtSeconds: number | null;
}

const STATUS_MESSAGES: Record<string, string> = {
  EXPIRED: 'This link has expired and is no longer available.',
  REVOKED: 'This link has been revoked.',
  DISABLED: 'This link is currently disabled.',
};

export default function WatchPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [resolved, setResolved] = useState<ResolveResponse | null>(null);
  const [access, setAccess] = useState<AccessResponse | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    api
      .get<ResolveResponse>(`/public/links/${token}`)
      .then(setResolved)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'This link could not be loaded.'))
      .finally(() => setLoading(false));
  }, [token]);

  const requestAccess = useCallback(async () => {
    setRequesting(true);
    setError(null);
    try {
      const data = await api.post<AccessResponse>(`/public/links/${token}/access`, {
        password: password || undefined,
      });
      setAccess(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Access denied.');
    } finally {
      setRequesting(false);
    }
  }, [token, password]);

  useEffect(() => {
    if (resolved && resolved.status === 'ACTIVE' && !resolved.requiresPassword && !access) {
      void requestAccess();
    }
  }, [resolved, access, requestAccess]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col" onContextMenu={(e) => e.preventDefault()}>
      <header className="border-b border-line px-4 py-3">
        <span className="text-sm font-semibold text-ink">Content Delivery System</span>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto p-4 md:p-8">
        {resolved && resolved.status !== 'ACTIVE' && (
          <Card className="p-8 text-center">
            <h1 className="text-lg font-semibold text-ink mb-2">Access Unavailable</h1>
            <p className="text-sm text-muted">{STATUS_MESSAGES[resolved.status] ?? 'This link is not available.'}</p>
          </Card>
        )}

        {resolved && resolved.status === 'ACTIVE' && resolved.requiresPassword && !access && (
          <Card className="p-6 max-w-md mx-auto">
            <h1 className="text-base font-semibold text-ink mb-1">{resolved.content.title}</h1>
            <p className="text-sm text-muted mb-4">This content is password protected.</p>
            {error && <Banner tone="error">{error}</Banner>}
            <Field label="Password">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && requestAccess()}
              />
            </Field>
            <div className="mt-3">
              <Button onClick={requestAccess} disabled={requesting} className="w-full">
                {requesting ? 'Checking...' : 'Unlock'}
              </Button>
            </div>
          </Card>
        )}

        {resolved && resolved.status === 'ACTIVE' && !resolved.requiresPassword && !access && error && (
          <Card className="p-8 text-center">
            <h1 className="text-lg font-semibold text-ink mb-2">Access Denied</h1>
            <p className="text-sm text-muted">{error}</p>
          </Card>
        )}

        {access && (
          <div>
            <h1 className="text-lg font-semibold text-ink mb-1">{access.content.title}</h1>
            {access.content.description && <p className="text-sm text-muted mb-4">{access.content.description}</p>}

            <ContentViewer token={token} access={access} />

            <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted">
              {access.remainingViews != null && <span>Remaining views: {access.remainingViews}</span>}
              {access.expiresAt && <span>Expires: {new Date(access.expiresAt).toLocaleString()}</span>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ContentViewer({ token, access }: { token: string; access: AccessResponse }) {
  const { fileType, mimeType } = access.content;
  const src = access.streamUrl;

  if (fileType === 'VIDEO') {
    return (
      <CdsVideoPlayer
        key={src}
        token={token}
        sessionKey={access.sessionKey}
        streamUrl={src}
        title={access.content.title}
        durationSeconds={access.content.durationSeconds}
        resumeAtSeconds={access.resumeAtSeconds}
        poster={access.content.thumbnailUrl}
      />
    );
  }

  if (fileType === 'AUDIO') {
    return (
      <CdsVideoPlayer
        key={src}
        token={token}
        sessionKey={access.sessionKey}
        streamUrl={src}
        title={access.content.title}
        durationSeconds={access.content.durationSeconds}
        resumeAtSeconds={access.resumeAtSeconds}
        audio
      />
    );
  }

  if (fileType === 'IMAGE') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={access.content.title} className="w-full border border-line rounded" />
    );
  }

  if (fileType === 'PDF' || mimeType === 'application/pdf') {
    return <iframe src={src} title={access.content.title} className="w-full border border-line rounded h-[80vh]" />;
  }

  return (
    <Card className="p-6 text-center">
      <p className="text-sm text-muted mb-3">This content type cannot be previewed in the browser.</p>
      <a href={src} target="_blank" rel="noopener noreferrer">
        <Button>Open content</Button>
      </a>
    </Card>
  );
}
