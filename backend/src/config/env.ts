import { z } from 'zod';

/**
 * Centralised, validated environment configuration.
 * The process fails fast at boot if required variables are missing.
 */
const booleanString = z
  .string()
  .transform((v) => v === 'true' || v === '1')
  .pipe(z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  APP_URL: z.string().url().default('http://localhost:4000'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_ACCESS_SECRET: z.string().min(8, 'JWT_ACCESS_SECRET must be set'),
  JWT_REFRESH_SECRET: z.string().min(8, 'JWT_REFRESH_SECRET must be set'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  LINK_SIGNING_SECRET: z.string().min(8, 'LINK_SIGNING_SECRET must be set'),

  COOKIE_DOMAIN: z.string().optional().default(''),
  COOKIE_SECURE: booleanString.default('false'),

  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().optional().default(''),

  GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64: z.string().optional().default(''),
  GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN: z.string().optional().default(''),
  GOOGLE_DRIVE_ROOT_FOLDER_ID: z.string().optional().default(''),

  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().optional().default(587),
  SMTP_SECURE: booleanString.default('false'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASSWORD: z.string().optional().default(''),
  SMTP_FROM: z.string().optional().default('Content Delivery System <no-reply@example.com>'),
  ALERT_DEFAULT_RECIPIENT: z.string().optional().default(''),

  CORS_ORIGINS: z.string().optional().default(''),
  BOOTSTRAP_SUPER_ADMIN_EMAIL: z.string().optional().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:');
  // eslint-disable-next-line no-console
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error('Environment validation failed. See logs above.');
}

const raw = parsed.data;

function normalizeUrl(url: string): string {
  return url.replace(/\/$/, '');
}

const appUrl = normalizeUrl(raw.APP_URL);
const frontendUrl = normalizeUrl(raw.FRONTEND_URL);
const googleOauthRedirectUri =
  raw.GOOGLE_OAUTH_REDIRECT_URI.trim().length > 0
    ? normalizeUrl(raw.GOOGLE_OAUTH_REDIRECT_URI)
    : `${appUrl}/api/v1/auth/google/callback`;

const corsOrigins = [
  ...raw.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  frontendUrl,
].filter((origin, index, all) => all.indexOf(origin) === index);

if (raw.NODE_ENV === 'production') {
  const productionIssues: string[] = [];
  if (appUrl.includes('localhost') || appUrl.includes('127.0.0.1')) {
    productionIssues.push('APP_URL must be your public backend URL (not localhost)');
  }
  if (frontendUrl.includes('localhost') || frontendUrl.includes('127.0.0.1')) {
    productionIssues.push('FRONTEND_URL must be your public frontend URL (not localhost)');
  }
  if (!raw.COOKIE_SECURE) {
    productionIssues.push('COOKIE_SECURE must be true in production (HTTPS required)');
  }
  if (productionIssues.length > 0) {
    throw new Error(`Production environment misconfiguration:\n- ${productionIssues.join('\n- ')}`);
  }
}

export const env = {
  ...raw,
  APP_URL: appUrl,
  FRONTEND_URL: frontendUrl,
  GOOGLE_OAUTH_REDIRECT_URI: googleOauthRedirectUri,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  corsOrigins,
  driveConfigured: Boolean(
    raw.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64 || raw.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN,
  ),
  smtpConfigured: Boolean(raw.SMTP_HOST && raw.SMTP_USER),
  googleOauthConfigured: Boolean(raw.GOOGLE_CLIENT_ID && raw.GOOGLE_CLIENT_SECRET),
};

export type AppEnv = typeof env;
