import { api } from '@/lib/api';
import { Content, DriveFile } from '@/lib/types';

/**
 * Ensure a Drive file exists in the content library.
 * Backend reuses an existing row for the same googleDriveFileId when present.
 */
export async function ensureContentFromDrive(file: DriveFile): Promise<Content> {
  return api.post<Content>('/content', {
    title: file.name,
    googleDriveFileId: file.id,
    mimeType: file.mimeType || undefined,
    fileSize: file.size || undefined,
    durationSeconds: file.videoDurationMs ? Math.round(file.videoDurationMs / 1000) : undefined,
    thumbnailUrl: file.thumbnailLink || undefined,
    syncFromDrive: true,
  });
}
