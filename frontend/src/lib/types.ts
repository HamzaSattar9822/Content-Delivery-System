export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string; details?: unknown };
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  pagination: Pagination;
}

export type RoleName = 'SUPER_ADMIN' | 'CONTENT_MANAGER' | 'READ_ONLY';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: RoleName;
  permissions: string[];
  status: string;
}

export type FileType = 'VIDEO' | 'PDF' | 'DOCX' | 'PPTX' | 'IMAGE' | 'AUDIO' | 'ZIP' | 'OTHER';
export type ContentStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type LinkStatus = 'ACTIVE' | 'DISABLED' | 'REVOKED' | 'EXPIRED';

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  _count?: { content: number };
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
}

export interface Content {
  id: string;
  title: string;
  description: string | null;
  fileType: FileType;
  mimeType: string | null;
  googleDriveFileId: string;
  fileSize: string;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
  category?: Category | null;
  tags?: { tag: Tag }[];
  createdBy?: { id: string; name: string | null; email: string } | null;
  _count?: { links: number; viewLogs: number };
}

export interface AccessLink {
  id: string;
  label: string | null;
  status: LinkStatus;
  neverExpire: boolean;
  expiresAt: string | null;
  maxViews: number | null;
  maxSessions: number | null;
  maxDevices: number | null;
  maxConcurrent: number | null;
  viewCount: number;
  remainingViews: number | null;
  hasPassword: boolean;
  ipAllowlist: string[];
  domainAllowlist: string[];
  createdAt: string;
  content?: { id: string; title: string; fileType: FileType };
  createdBy?: { id: string; name: string | null; email: string } | null;
  _count?: { viewLogs: number; sessions: number; devices: number };
}

export interface CreatedLinkResponse {
  id: string;
  token: string;
  watchUrl: string;
  embedUrl: string;
  embedCode: string;
  link: AccessLink;
}

export interface DashboardMetrics {
  totalContent: number;
  totalVideos: number;
  activeLinks: number;
  expiredLinks: number;
  totalViews: number;
  viewsToday: number;
  mostViewedContent: { id: string; title: string; fileType: FileType; views: number }[];
  recentActivity: {
    id: string;
    content: string;
    link: string | null;
    deviceType: string;
    browser: string | null;
    country: string | null;
    ipAddress: string | null;
    createdAt: string;
  }[];
}

export interface DetailedAnalytics {
  totalViews: number;
  uniqueViewers: number;
  repeatViewers: number;
  sessions: number;
  averageWatchSeconds: number;
  totalWatchSeconds: number;
  completionRate: number;
  deviceTypes: { key: string; count: number }[];
  browsers: { key: string; count: number }[];
  countries: { key: string; count: number }[];
}

export interface UserRecord {
  id: string;
  email: string;
  name: string | null;
  status: 'ACTIVE' | 'SUSPENDED';
  lastLoginAt: string | null;
  createdAt: string;
  role: { id: string; name: RoleName };
}

export interface NotificationRecord {
  id: string;
  type: string;
  channel: string;
  status: string;
  title: string;
  message: string;
  recipient: string;
  threshold: number | null;
  createdAt: string;
  sentAt: string | null;
  link?: { id: string; label: string | null } | null;
}

export interface NotificationRule {
  id: string;
  type: string;
  threshold: number | null;
  recipient: string | null;
  enabled: boolean;
  link?: { id: string; label: string | null } | null;
}

export interface AuditLogRecord {
  id: string;
  action: string;
  actorEmail: string | null;
  entityType: string | null;
  entityId: string | null;
  ipAddress: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
  user?: { id: string; name: string | null; email: string } | null;
}

export interface SettingRecord {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  updatedAt: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  isFolder: boolean;
  thumbnailLink?: string;
  videoDurationMs?: number;
}
