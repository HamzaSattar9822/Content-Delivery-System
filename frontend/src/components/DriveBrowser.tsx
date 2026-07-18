'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { DriveFile } from '@/lib/types';
import { Banner, Button, Spinner } from '@/components/ui';
import { formatBytes } from '@/lib/format';

export interface DriveBrowserProps {
  selectedId?: string;
  /** Map of Drive file id → already-registered library content id (optional). */
  registeredByDriveId?: Map<string, string>;
  onSelect: (file: DriveFile) => void;
  /** Extra action for a non-folder file (e.g. Create link). */
  renderFileActions?: (file: DriveFile, registeredContentId?: string) => React.ReactNode;
  className?: string;
  maxHeightClassName?: string;
}

/**
 * Shared Google Drive folder browser. Used by Content Library and Create Link.
 */
export function DriveBrowser({
  selectedId,
  registeredByDriveId,
  onSelect,
  renderFileActions,
  className,
  maxHeightClassName = 'max-h-80',
}: DriveBrowserProps) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [folderStack, setFolderStack] = useState<{ id: string; name: string }[]>([]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const browse = useCallback(async (folderId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<{ files: DriveFile[] }>('/drive/files', { folderId });
      setFiles(data.files);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to browse Drive');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api
      .get<{ configured: boolean }>('/drive/status')
      .then((d) => {
        setConfigured(d.configured);
        if (d.configured) void browse();
      })
      .catch(() => setConfigured(false));
  }, [browse]);

  const openFolder = (file: DriveFile) => {
    setFolderStack((s) => [...s, { id: file.id, name: file.name }]);
    void browse(file.id);
  };

  const goToRoot = () => {
    setFolderStack([]);
    void browse();
  };

  const goBack = () => {
    const next = folderStack.slice(0, -1);
    setFolderStack(next);
    void browse(next[next.length - 1]?.id);
  };

  if (configured === null) {
    return (
      <div className={className}>
        <Spinner />
      </div>
    );
  }

  if (configured === false) {
    return (
      <div className={className}>
        <Banner>
          Google Drive is not configured on the server. Set Drive credentials to browse folders here.
        </Banner>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-xs text-muted truncate min-w-0">
          <button type="button" className="hover:underline text-ink" onClick={goToRoot}>
            Drive
          </button>
          {folderStack.map((folder, index) => (
            <span key={folder.id}>
              {' / '}
              <button
                type="button"
                className="hover:underline text-ink"
                onClick={() => {
                  const next = folderStack.slice(0, index + 1);
                  setFolderStack(next);
                  void browse(folder.id);
                }}
              >
                {folder.name}
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {folderStack.length > 0 && (
            <Button type="button" variant="ghost" className="!py-1 !px-2 text-xs" onClick={goBack}>
              Back
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            className="!py-1 !px-2 text-xs"
            onClick={() => void browse(folderStack[folderStack.length - 1]?.id)}
          >
            Refresh
          </Button>
        </div>
      </div>

      <div className={`border border-line rounded overflow-y-auto ${maxHeightClassName}`}>
        {error && <div className="p-3 text-sm text-ink">{error}</div>}
        {loading ? (
          <div className="p-4 text-sm text-muted">Loading Drive…</div>
        ) : files.length === 0 ? (
          <div className="p-4 text-sm text-muted">This folder is empty.</div>
        ) : (
          <ul className="divide-y divide-line">
            {files.map((file) => {
              const registeredId = registeredByDriveId?.get(file.id);
              const selected = selectedId === file.id;
              return (
                <li
                  key={file.id}
                  className={`flex items-center gap-3 px-3 py-2 text-sm ${selected ? 'bg-subtle' : ''}`}
                >
                  {file.thumbnailLink && !file.isFolder ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={file.thumbnailLink}
                      alt=""
                      className="w-10 h-10 object-cover rounded border border-line shrink-0 bg-subtle"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded border border-line shrink-0 bg-subtle flex items-center justify-center text-[10px] text-muted">
                      {file.isFolder ? 'DIR' : mimeLabel(file.mimeType)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      className="text-left text-ink hover:underline truncate block w-full"
                      onClick={() => (file.isFolder ? openFolder(file) : onSelect(file))}
                    >
                      {file.name}
                    </button>
                    <p className="text-xs text-muted truncate">
                      {file.isFolder
                        ? 'Folder'
                        : `${file.mimeType || 'file'}${file.size ? ` · ${formatBytes(file.size)}` : ''}`}
                      {registeredId ? ' · In library' : ''}
                      {selected ? ' · Selected' : ''}
                    </p>
                  </div>
                  {!file.isFolder && renderFileActions?.(file, registeredId)}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function mimeLabel(mimeType: string): string {
  if (mimeType.startsWith('video/')) return 'VID';
  if (mimeType.startsWith('image/')) return 'IMG';
  if (mimeType.startsWith('audio/')) return 'AUD';
  if (mimeType.includes('pdf')) return 'PDF';
  return 'FILE';
}
