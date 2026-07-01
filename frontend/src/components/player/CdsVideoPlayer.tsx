'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import 'plyr/dist/plyr.css';
import './plyr-overrides.css';
import { api } from '@/lib/api';
import { Button } from '@/components/ui';
import type PlyrType from 'plyr';

export type PlayerEvent = 'play' | 'pause' | 'stop' | 'progress' | 'ended' | 'replay';

export interface CdsVideoPlayerProps {
  token: string;
  sessionKey: string;
  streamUrl: string;
  title: string;
  durationSeconds?: number | null;
  resumeAtSeconds?: number | null;
  poster?: string | null;
  /** When true, render an audio layout instead of 16:9 video. */
  audio?: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function watchPercentage(current: number, duration: number): number {
  if (!duration || duration <= 0) return 0;
  return Math.min(100, Math.round((current / duration) * 100));
}

export function CdsVideoPlayer({
  token,
  sessionKey,
  streamUrl,
  title,
  durationSeconds,
  resumeAtSeconds,
  poster,
  audio = false,
}: CdsVideoPlayerProps) {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const playerRef = useRef<PlyrType | null>(null);
  const [pendingResume, setPendingResume] = useState<number | null>(
    resumeAtSeconds && resumeAtSeconds > 0 ? resumeAtSeconds : null,
  );
  const [showResumePrompt, setShowResumePrompt] = useState(
    Boolean(resumeAtSeconds && resumeAtSeconds > 0),
  );
  const [mediaState, setMediaState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [useNativeControls, setUseNativeControls] = useState(false);

  const sendHeartbeat = useCallback(
    (payload: {
      watchSeconds?: number;
      watchPercentage?: number;
      completed?: boolean;
      event?: PlayerEvent;
    }) => {
      void api.post(`/public/links/${token}/heartbeat`, { sessionKey, ...payload }).catch(() => undefined);
    },
    [token, sessionKey],
  );

  const reportProgress = useCallback(
    (event?: PlayerEvent) => {
      const el = mediaRef.current;
      if (!el) return;
      const current = Math.floor(el.currentTime);
      const duration = el.duration && Number.isFinite(el.duration) ? el.duration : durationSeconds ?? 0;
      sendHeartbeat({
        watchSeconds: current,
        watchPercentage: watchPercentage(current, duration),
        completed: el.ended,
        event,
      });
    },
    [durationSeconds, sendHeartbeat],
  );

  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;

    let cancelled = false;
    let progressTimer: number | undefined;
    let unbind: (() => void) | undefined;

    const bindPlayerEvents = (player: PlyrType) => {
      const onPlay = () => reportProgress('play');
      const onPause = () => reportProgress('pause');
      const onEnded = () => reportProgress('ended');
      const onSeeked = () => {
        if (el.currentTime < 2) reportProgress('replay');
      };

      player.on('play', onPlay);
      player.on('pause', onPause);
      player.on('ended', onEnded);
      player.on('seeked', onSeeked);

      progressTimer = window.setInterval(() => {
        if (player.playing) reportProgress('progress');
      }, 10000);

      return () => {
        player.off('play', onPlay);
        player.off('pause', onPause);
        player.off('ended', onEnded);
        player.off('seeked', onSeeked);
      };
    };

    const initPlayer = async () => {
      if (cancelled || !mediaRef.current) return;

      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // Plyr may already be torn down after a strict-mode remount.
        }
        playerRef.current = null;
      }

      try {
        const { default: Plyr } = await import('plyr');

        if (cancelled || !mediaRef.current) return;

        const player = new Plyr(mediaRef.current, {
          controls: [
            'play-large',
            'play',
            'progress',
            'current-time',
            'duration',
            'mute',
            'volume',
            'settings',
            'pip',
            'fullscreen',
          ],
          settings: ['speed'],
          speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
          hideControls: true,
          clickToPlay: true,
          keyboard: { focused: true, global: false },
          tooltips: { controls: true, seek: true },
          i18n: {
            speed: 'Speed',
            normal: 'Normal',
          },
        });

        playerRef.current = player;
        unbind = bindPlayerEvents(player);
      } catch {
        setUseNativeControls(true);
      }
    };

    void initPlayer();

    return () => {
      cancelled = true;
      if (progressTimer) window.clearInterval(progressTimer);
      unbind?.();
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore destroy errors on unmount
        }
        playerRef.current = null;
      }
    };
  }, [audio, reportProgress, streamUrl]);

  useEffect(() => {
    const onLeave = () => reportProgress('stop');
    window.addEventListener('beforeunload', onLeave);
    window.addEventListener('pagehide', onLeave);
    return () => {
      window.removeEventListener('beforeunload', onLeave);
      window.removeEventListener('pagehide', onLeave);
    };
  }, [reportProgress]);

  const handleMediaError = () => {
    setMediaState('error');
    setMediaError(
      'The video could not be loaded. Check that Google Drive access is configured and the file is shared with the service account.',
    );
  };

  const applyResume = () => {
    const el = mediaRef.current;
    const at = pendingResume;
    if (el && at != null) {
      el.currentTime = at;
      void playerRef.current?.play();
    }
    setShowResumePrompt(false);
  };

  const startFromBeginning = () => {
    const el = mediaRef.current;
    if (el) el.currentTime = 0;
    setShowResumePrompt(false);
    setPendingResume(null);
  };

  const shellClass = audio ? 'cds-player-shell' : 'cds-player-shell cds-player-shell--video';

  if (mediaState === 'error') {
    return (
      <div className="cds-player-error">
        <p>{mediaError ?? 'Unable to play this video.'}</p>
      </div>
    );
  }

  return (
    <div className={shellClass} onContextMenu={(e) => e.preventDefault()}>
      {showResumePrompt && pendingResume != null && (
        <div className="cds-resume-banner">
          <span>Resume from {formatTime(pendingResume)}?</span>
          <Button type="button" onClick={applyResume}>
            Resume
          </Button>
          <Button type="button" variant="secondary" onClick={startFromBeginning}>
            Start over
          </Button>
        </div>
      )}

      {mediaState === 'loading' && !audio && (
        <div className="cds-player-loading" aria-hidden="true">
          Loading video…
        </div>
      )}

      {audio ? (
        <audio
          ref={mediaRef as React.RefObject<HTMLAudioElement>}
          src={streamUrl}
          playsInline
          preload="metadata"
          controls={useNativeControls}
          onLoadedData={() => setMediaState('ready')}
          onError={handleMediaError}
        />
      ) : (
        <video
          ref={mediaRef as React.RefObject<HTMLVideoElement>}
          className="w-full h-full"
          src={streamUrl}
          playsInline
          preload="metadata"
          poster={poster ?? undefined}
          aria-label={title}
          controls={useNativeControls}
          controlsList="nodownload"
          onLoadedData={() => setMediaState('ready')}
          onError={handleMediaError}
        />
      )}
    </div>
  );
}
