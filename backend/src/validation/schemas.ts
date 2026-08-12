import { z } from 'zod';

export const paginationQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
});

// --- Auth ---
export const devLoginSchema = z.object({
  email: z.string().email(),
});

export const signupSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  name: z.string().min(1).max(120).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

// --- Content ---
const fileTypeEnum = z.enum(['VIDEO', 'PDF', 'DOCX', 'PPTX', 'IMAGE', 'AUDIO', 'ZIP', 'OTHER']);
const contentStatusEnum = z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']);

export const createContentSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  categoryId: z.string().uuid().optional(),
  fileType: fileTypeEnum.optional(),
  googleDriveFileId: z.string().min(1),
  mimeType: z.string().optional(),
  fileSize: z.number().int().nonnegative().optional(),
  durationSeconds: z.number().int().nonnegative().optional(),
  thumbnailUrl: z.string().url().optional(),
  tags: z.array(z.string()).optional(),
  status: contentStatusEnum.optional(),
  syncFromDrive: z.boolean().optional(),
});

export const updateContentSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(5000).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  fileType: fileTypeEnum.optional(),
  status: contentStatusEnum.optional(),
  tags: z.array(z.string()).optional(),
});

// --- Categories / tags ---
export const createCategorySchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
});

// --- Links ---
const ipList = z.array(z.string().ip()).optional();
const domainList = z.array(z.string().min(1)).optional();

export const createLinkSchema = z
  .object({
    contentId: z.string().uuid(),
    label: z.string().max(200).optional(),
    neverExpire: z.boolean().optional(),
    expiresAt: z.string().datetime().nullable().optional(),
    maxViews: z.number().int().positive().nullable().optional(),
    maxSessions: z.number().int().positive().nullable().optional(),
    maxDevices: z.number().int().positive().nullable().optional(),
    maxConcurrent: z.number().int().positive().nullable().optional(),
    password: z.string().min(4).max(200).nullable().optional(),
    ipAllowlist: ipList,
    domainAllowlist: domainList,
  })
  .refine((v) => v.neverExpire || v.expiresAt, {
    message: 'Either neverExpire must be true or expiresAt must be provided',
    path: ['expiresAt'],
  });

export const updateLinkSchema = z.object({
  label: z.string().max(200).optional(),
  neverExpire: z.boolean().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  maxViews: z.number().int().positive().nullable().optional(),
  maxSessions: z.number().int().positive().nullable().optional(),
  maxDevices: z.number().int().positive().nullable().optional(),
  maxConcurrent: z.number().int().positive().nullable().optional(),
  password: z.string().min(4).max(200).nullable().optional(),
  ipAllowlist: ipList,
  domainAllowlist: domainList,
});

export const extendExpirationSchema = z.object({
  expiresAt: z.string().datetime(),
});

export const increaseViewLimitSchema = z.object({
  maxViews: z.number().int().positive().nullable(),
});

// --- Users ---
const roleEnum = z.enum(['SUPER_ADMIN', 'CONTENT_MANAGER', 'READ_ONLY']);

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().max(200).optional(),
  roleName: roleEnum,
});

export const updateUserSchema = z.object({
  name: z.string().max(200).optional(),
  roleName: roleEnum.optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
});

export const setUserPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

// --- Notifications ---
const notificationTypeEnum = z.enum([
  'VIEW_THRESHOLD',
  'LINK_EXPIRED',
  'VIEW_LIMIT_EXCEEDED',
  'SECURITY_EVENT',
  'LINK_CREATED',
  'SYSTEM',
]);

export const createNotificationRuleSchema = z.object({
  type: notificationTypeEnum,
  threshold: z.number().int().positive().optional(),
  linkId: z.string().uuid().optional(),
  recipient: z.string().email().optional(),
  enabled: z.boolean().optional(),
});

export const updateNotificationRuleSchema = z.object({
  threshold: z.number().int().positive().optional(),
  recipient: z.string().email().optional(),
  enabled: z.boolean().optional(),
});

// --- Settings ---
export const updateSettingSchema = z.object({
  value: z.any(),
  description: z.string().max(500).optional(),
});

// --- Public access ---
export const accessRequestSchema = z.object({
  password: z.string().optional(),
});

export const heartbeatSchema = z.object({
  sessionKey: z.string().min(1),
  watchSeconds: z.number().int().nonnegative().optional(),
  watchPercentage: z.number().int().min(0).max(100).optional(),
  completed: z.boolean().optional(),
  event: z.enum(['play', 'pause', 'stop', 'progress', 'ended', 'replay']).optional(),
});

export const idParam = z.object({ id: z.string().uuid() });
