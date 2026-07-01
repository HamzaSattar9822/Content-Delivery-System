import { Readable } from 'stream';
import { google, drive_v3 } from 'googleapis';
import { GaxiosResponse } from 'gaxios';
import { env } from '../config/env';
import { AppError, BadRequestError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';

const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

export interface DriveFileMeta {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  isFolder: boolean;
  modifiedTime?: string;
  thumbnailLink?: string;
  videoDurationMs?: number;
}

export interface DriveStreamResponse {
  stream: Readable;
  status: number;
  headers: Record<string, string | undefined>;
}

export class DriveService {
  private client: drive_v3.Drive | null = null;

  private getClient(): drive_v3.Drive {
    if (this.client) return this.client;

    if (!env.driveConfigured) {
      throw new AppError(
        'Google Drive is not configured. Set a service account or OAuth refresh token.',
        503,
        'DRIVE_NOT_CONFIGURED',
      );
    }

    if (env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64) {
      const credentials = JSON.parse(
        Buffer.from(env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64, 'base64').toString('utf8'),
      );
      const auth = new google.auth.GoogleAuth({ credentials, scopes: DRIVE_SCOPES });
      this.client = google.drive({ version: 'v3', auth });
    } else {
      const oauth2 = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
      oauth2.setCredentials({ refresh_token: env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN });
      this.client = google.drive({ version: 'v3', auth: oauth2 });
    }
    return this.client;
  }

  get isConfigured(): boolean {
    return env.driveConfigured;
  }

  /** Browse a folder (defaults to the configured root or Drive root). */
  async listChildren(folderId?: string): Promise<DriveFileMeta[]> {
    const drive = this.getClient();
    const parent = folderId || env.GOOGLE_DRIVE_ROOT_FOLDER_ID || 'root';
    try {
      const res = await drive.files.list({
        q: `'${parent}' in parents and trashed = false`,
        fields:
          'files(id, name, mimeType, size, modifiedTime, thumbnailLink, videoMediaMetadata(durationMillis))',
        pageSize: 200,
        orderBy: 'folder,name',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      return (res.data.files ?? []).map(this.toMeta);
    } catch (err) {
      logger.error({ err }, 'Drive listChildren failed');
      throw new BadRequestError('Failed to list Google Drive folder contents');
    }
  }

  async getFile(fileId: string): Promise<DriveFileMeta> {
    const drive = this.getClient();
    try {
      const res = await drive.files.get({
        fileId,
        fields: 'id, name, mimeType, size, modifiedTime, thumbnailLink, videoMediaMetadata(durationMillis)',
        supportsAllDrives: true,
      });
      return this.toMeta(res.data);
    } catch (err) {
      logger.error({ err, fileId }, 'Drive getFile failed');
      throw new NotFoundError('Google Drive file not found');
    }
  }

  /**
   * Open a (optionally ranged) read stream for a Drive file. The Range header
   * is forwarded to Google so partial-content streaming works end-to-end.
   */
  async streamFile(fileId: string, range?: string): Promise<DriveStreamResponse> {
    const drive = this.getClient();
    const headers: Record<string, string> = {};
    if (range) headers.Range = range;

    const res = (await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream', headers },
    )) as GaxiosResponse<Readable>;

    return {
      stream: res.data,
      status: res.status,
      headers: {
        'content-type': res.headers['content-type'] as string | undefined,
        'content-length': res.headers['content-length'] as string | undefined,
        'content-range': res.headers['content-range'] as string | undefined,
        'accept-ranges': (res.headers['accept-ranges'] as string | undefined) ?? 'bytes',
      },
    };
  }

  private toMeta(file: drive_v3.Schema$File): DriveFileMeta {
    const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
    return {
      id: file.id ?? '',
      name: file.name ?? 'Untitled',
      mimeType: file.mimeType ?? 'application/octet-stream',
      size: file.size ? Number(file.size) : 0,
      isFolder,
      modifiedTime: file.modifiedTime ?? undefined,
      thumbnailLink: file.thumbnailLink ?? undefined,
      videoDurationMs: file.videoMediaMetadata?.durationMillis
        ? Number(file.videoMediaMetadata.durationMillis)
        : undefined,
    };
  }
}

/** Map a Drive/MIME type to our generic FileType enum. */
export function mimeToFileType(mimeType: string): string {
  if (mimeType.startsWith('video/')) return 'VIDEO';
  if (mimeType.startsWith('audio/')) return 'AUDIO';
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType.includes('wordprocessingml') || mimeType === 'application/msword') return 'DOCX';
  if (mimeType.includes('presentationml') || mimeType === 'application/vnd.ms-powerpoint') return 'PPTX';
  if (mimeType === 'application/zip' || mimeType === 'application/x-zip-compressed') return 'ZIP';
  return 'OTHER';
}
