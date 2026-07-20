import { AuditAction } from '@prisma/client';

type AuditLike = {
  action: AuditAction | string;
  entityType?: string | null;
  entityId?: string | null;
  actorEmail?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: unknown;
  user?: { email?: string | null; name?: string | null } | null;
};

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Signed in',
  LOGOUT: 'Signed out',
  USER_CREATE: 'Created user',
  USER_UPDATE: 'Updated user',
  USER_DELETE: 'Deleted user',
  CONTENT_CREATE: 'Added content',
  CONTENT_UPDATE: 'Updated content',
  CONTENT_DELETE: 'Deleted content',
  CONTENT_ARCHIVE: 'Archived content',
  CONTENT_RESTORE: 'Restored content',
  LINK_CREATE: 'Created delivery link',
  LINK_UPDATE: 'Updated delivery link',
  LINK_REVOKE: 'Revoked delivery link',
  LINK_DELETE: 'Deleted delivery link',
  LINK_ACCESS: 'Opened delivery link',
  ACCESS_DENIED: 'Access denied',
  SECURITY_EVENT: 'Security event',
  SETTINGS_UPDATE: 'Updated settings',
  DRIVE_SYNC: 'Synced from Google Drive',
};

const ENTITY_LABELS: Record<string, string> = {
  user: 'User',
  content: 'Content',
  access_link: 'Delivery link',
  delivery_link: 'Delivery link',
  setting: 'Setting',
};

function asRecord(metadata: unknown): Record<string, unknown> {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

function text(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

/** Build admin-friendly fields for an audit log row. */
export function presentAuditLog<T extends AuditLike>(log: T) {
  const meta = asRecord(log.metadata);
  const actionLabel = ACTION_LABELS[String(log.action)] ?? String(log.action).replace(/_/g, ' ');
  const entityLabel = log.entityType
    ? ENTITY_LABELS[log.entityType] ?? log.entityType.replace(/_/g, ' ')
    : null;
  const actor = log.user?.email ?? log.actorEmail ?? 'System';
  const title =
    text(meta.contentTitle) ??
    text(meta.title) ??
    text(meta.label) ??
    text(meta.email) ??
    text(meta.key) ??
    null;

  const entityDisplay = [entityLabel, title].filter(Boolean).join(': ') || entityLabel || '—';

  return {
    ...log,
    actionLabel,
    actorDisplay: actor,
    entityDisplay,
    summary: buildSummary(String(log.action), meta, title, log),
  };
}

function buildSummary(
  action: string,
  meta: Record<string, unknown>,
  title: string | null,
  log: AuditLike,
): string {
  const parts: string[] = [];
  const label = text(meta.label);
  const contentTitle = text(meta.contentTitle) ?? text(meta.title);
  const email = text(meta.email);
  const fileType = text(meta.fileType);
  const reason = text(meta.reason);
  const status = text(meta.status);
  const previousStatus = text(meta.previousStatus);
  const role = text(meta.role);
  const change = text(meta.change);
  const maxViews = meta.maxViews;
  const extendedTo = text(meta.extendedTo);
  const viewCount = meta.viewCount;
  const changes = Array.isArray(meta.changes) ? meta.changes.map(String) : [];

  switch (action) {
    case 'LOGIN':
      return 'User signed in successfully.';
    case 'LOGOUT':
      return 'User signed out.';
    case 'USER_CREATE':
      return `Created user account${email ? ` for ${email}` : ''}${role ? ` with role ${role}` : ''}.`;
    case 'USER_UPDATE':
      return `Updated user${email ? ` ${email}` : ''}${role ? ` (role: ${role})` : ''}${
        text(meta.status) ? ` (status: ${text(meta.status)})` : ''
      }${changes.length ? `. Changed: ${changes.join(', ')}` : '.'}`;
    case 'USER_DELETE':
      return `Deleted user${email ? ` ${email}` : ''}.`;
    case 'CONTENT_CREATE':
      return `Added ${fileType ? fileType.toLowerCase() + ' ' : ''}content${contentTitle ? ` "${contentTitle}"` : ''} to the library.`;
    case 'CONTENT_UPDATE':
      return `Updated content${contentTitle ? ` "${contentTitle}"` : ''}${
        changes.length ? `. Changed: ${changes.join(', ')}` : '.'
      }`;
    case 'CONTENT_ARCHIVE':
      return `Archived content${contentTitle ? ` "${contentTitle}"` : ''}.`;
    case 'CONTENT_RESTORE':
      return `Restored content${contentTitle ? ` "${contentTitle}"` : ''} to active.`;
    case 'CONTENT_DELETE':
      return `Permanently deleted content${contentTitle ? ` "${contentTitle}"` : ''}.`;
    case 'LINK_CREATE':
      return `Created delivery link${label ? ` "${label}"` : ''}${
        contentTitle ? ` for "${contentTitle}"` : ''
      }${fileType ? ` (${fileType})` : ''}.`;
    case 'LINK_UPDATE':
      if (change === 'extended_expiration' && extendedTo) {
        return `Extended expiration for link${label ? ` "${label}"` : ''} to ${new Date(extendedTo).toLocaleString()}.`;
      }
      if (change === 'view_limit') {
        return `Updated view limit for link${label ? ` "${label}"` : ''} to ${
          maxViews == null ? 'unlimited' : String(maxViews)
        }.`;
      }
      if (status) {
        return `Changed link${label ? ` "${label}"` : ''} status${
          previousStatus ? ` from ${previousStatus}` : ''
        } to ${status}.`;
      }
      return `Updated delivery link${label ? ` "${label}"` : ''}${
        contentTitle ? ` for "${contentTitle}"` : ''
      }.`;
    case 'LINK_REVOKE':
      return `Revoked delivery link${label ? ` "${label}"` : ''}${
        contentTitle ? ` for "${contentTitle}"` : ''
      }. Viewers can no longer open it.`;
    case 'LINK_DELETE':
      return `Deleted delivery link${label ? ` "${label}"` : ''}${
        contentTitle ? ` for "${contentTitle}"` : ''
      }.`;
    case 'LINK_ACCESS':
      return `Viewer opened${fileType ? ` ${fileType.toLowerCase()}` : ' content'}${
        contentTitle ? ` "${contentTitle}"` : ''
      }${label ? ` via link "${label}"` : ''}${
        typeof viewCount === 'number' ? ` (view #${viewCount})` : ''
      }.`;
    case 'ACCESS_DENIED':
      return reason
        ? `Access denied: ${reason}`
        : `Access was denied for link${label ? ` "${label}"` : ''}${
            contentTitle ? ` (${contentTitle})` : ''
          }.`;
    case 'SECURITY_EVENT':
      return reason ?? text(meta.message) ?? 'A security-related event was recorded.';
    case 'SETTINGS_UPDATE':
      return `Updated setting${text(meta.key) ? ` "${text(meta.key)}"` : ''}.`;
    case 'DRIVE_SYNC':
      return `Synced content from Google Drive${contentTitle ? `: "${contentTitle}"` : ''}.`;
    default:
      break;
  }

  if (title) parts.push(title);
  if (reason) parts.push(reason);
  if (status) parts.push(`Status: ${status}`);
  if (log.ipAddress) parts.push(`IP: ${log.ipAddress}`);
  if (parts.length) return parts.join(' · ');
  return 'No additional details were recorded for this action.';
}
