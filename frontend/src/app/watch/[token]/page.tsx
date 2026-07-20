'use client';

import dynamic from 'next/dynamic';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
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

function statusCopy(status: string, fileType?: string): { title: string; message: string } {
  const kind =
    fileType === 'VIDEO'
      ? 'video'
      : fileType === 'PDF'
        ? 'PDF'
        : fileType === 'AUDIO'
          ? 'audio'
          : fileType === 'IMAGE'
            ? 'image'
            : 'content';

  if (status === 'REVOKED') {
    return {
      title: `${kind === 'PDF' ? 'PDF' : kind.charAt(0).toUpperCase() + kind.slice(1)} revoked`,
      message: `This ${kind} has been revoked and is no longer available.`,
    };
  }
  if (status === 'EXPIRED') {
    return {
      title: 'Link expired',
      message: 'This link has expired and is no longer available.',
    };
  }
  if (status === 'DISABLED') {
    return {
      title: 'Link disabled',
      message: `This ${kind} is currently disabled.`,
    };
  }
  return {
    title: 'Access unavailable',
    message: 'This link is not available.',
  };
}

export default function WatchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-canvas">
          <Spinner />
        </div>
      }
    >
      <WatchPageContent />
    </Suspense>
  );
}

function WatchPageContent() {
  const params = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const token = params.token;
  const isEmbed = searchParams.get('embed') === '1';

  const [resolved, setResolved] = useState<ResolveResponse | null>(null);
  const [access, setAccess] = useState<AccessResponse | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    api
      .get<ResolveResponse>(`/public/links/${token}`)
      .then(setResolved)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'This link could not be loaded.');
        setErrorCode(err instanceof ApiError ? err.code : null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const requestAccess = useCallback(async () => {
    setRequesting(true);
    setError(null);
    setErrorCode(null);
    try {
      const data = await api.post<AccessResponse>(`/public/links/${token}/access`, {
        password: password || undefined,
      });
      setAccess(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Access denied.');
      setErrorCode(err instanceof ApiError ? err.code : null);
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
      <div className={`min-h-screen flex items-center justify-center ${isEmbed ? 'bg-black' : 'bg-canvas'}`}>
        <Spinner />
      </div>
    );
  }

  const deniedFromResolve = resolved && resolved.status !== 'ACTIVE';
  const statusUi = deniedFromResolve
    ? statusCopy(resolved.status, resolved.content.fileType)
    : errorCode === 'LINK_REVOKED'
      ? statusCopy('REVOKED', resolved?.content.fileType)
      : errorCode === 'LINK_EXPIRED'
        ? statusCopy('EXPIRED', resolved?.content.fileType)
        : errorCode === 'LINK_DISABLED'
          ? statusCopy('DISABLED', resolved?.content.fileType)
          : null;

  return (
    <div
      className={`min-h-screen flex flex-col ${isEmbed ? 'bg-black' : 'bg-canvas'}`}
      onContextMenu={(e) => e.preventDefault()}
    >
      {!isEmbed && (
        <header className="border-b border-line bg-surface/90 backdrop-blur px-4 py-3 flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-accent text-accent-fg text-[10px] font-bold">
            CDS
          </span>
          <span className="text-sm font-semibold text-ink">Content Delivery System</span>
        </header>
      )}

      <main className={`flex-1 w-full ${isEmbed ? 'p-0' : 'max-w-4xl mx-auto p-4 md:p-8'}`}>
        {(deniedFromResolve || (statusUi && !access && !resolved?.requiresPassword)) && (
          <StatusCard
            embed={isEmbed}
            title={statusUi?.title ?? 'Access Unavailable'}
            message={statusUi?.message ?? error ?? 'This link is not available.'}
          />
        )}

        {resolved && resolved.status === 'ACTIVE' && resolved.requiresPassword && !access && (
          <Card className={`p-6 max-w-md ${isEmbed ? 'mx-auto mt-4' : 'mx-auto'}`}>
            <h1 className="text-base font-semibold text-ink mb-1">{resolved.content.title}</h1>
            <p className="text-sm text-muted mb-4">This content is password protected.</p>
            {error && !statusUi && <Banner tone="error">{error}</Banner>}
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

        {resolved &&
          resolved.status === 'ACTIVE' &&
          !resolved.requiresPassword &&
          !access &&
          error &&
          !statusUi && (
            <StatusCard embed={isEmbed} title="Access Denied" message={error} />
          )}

        {!resolved && error && (
          <StatusCard embed={isEmbed} title="Access Unavailable" message={error} />
        )}

        {access && (
          <div className={isEmbed ? 'h-full' : undefined}>
            {!isEmbed && (
              <>
                <h1 className="text-lg font-semibold text-ink mb-1">{access.content.title}</h1>
                {access.content.description && (
                  <p className="text-sm text-muted mb-4">{access.content.description}</p>
                )}
              </>
            )}

            <ContentViewer token={token} access={access} embed={isEmbed} />

            {!isEmbed && (
              <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted">
                {access.remainingViews != null && <span>Remaining views: {access.remainingViews}</span>}
                {access.expiresAt && <span>Expires: {new Date(access.expiresAt).toLocaleString()}</span>}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function StatusCard({ embed, title, message }: { embed: boolean; title: string; message: string }) {
  return (
    <Card className={`p-8 text-center ${embed ? 'm-4' : ''}`}>
      <h1 className="text-lg font-semibold text-ink mb-2">{title}</h1>
      <p className="text-sm text-muted">{message}</p>
    </Card>
  );
}

function ContentViewer({
  token,
  access,
  embed = false,
}: {
  token: string;
  access: AccessResponse;
  embed?: boolean;
}) {
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
      <img
        src={src}
        alt={access.content.title}
        className={embed ? 'w-full h-full object-contain' : 'w-full border border-line rounded'}
      />
    );
  }

  if (fileType === 'PDF' || mimeType === 'application/pdf') {
    const pdfSrc = src.includes('#') ? src : `${src}#toolbar=1&navpanes=0`;
    return (
      <object
        data={pdfSrc}
        type="application/pdf"
        title={access.content.title}
        className={embed ? 'w-full h-screen border-0 bg-surface' : 'w-full border border-line rounded-xl h-[80vh] bg-surface'}
      >
        <iframe
          src={pdfSrc}
          title={access.content.title}
          className={embed ? 'w-full h-screen border-0' : 'w-full border-0 h-[80vh]'}
        />
      </object>
    );
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
