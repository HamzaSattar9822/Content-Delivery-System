import { z } from 'zod';

/**
 * Centralised, validated environment configuration.
 * The process fails fast at boot if required variables are missing.
 */

/** Accept full URLs or bare hostnames (common in Render/Vercel dashboards). */
function coerceEnvUrl(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** Drop empty Render dashboard placeholders so fallbacks and Zod defaults apply. */
function stripEmptyEnv(source: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined && value.trim() !== '') {
      out[key] = value;
    }
  }
  return out;
}

/** Normalize Render/platform env before Zod validation. */
function buildProcessEnv(): NodeJS.ProcessEnv {
  const source = stripEmptyEnv(process.env);

  const appUrl = coerceEnvUrl(source.APP_URL) ?? coerceEnvUrl(source.RENDER_EXTERNAL_URL);

  let frontendUrl = coerceEnvUrl(source.FRONTEND_URL);
  if (!frontendUrl && source.CORS_ORIGINS) {
    const firstOrigin = source.CORS_ORIGINS.split(',')[0]?.trim();
    frontendUrl = coerceEnvUrl(firstOrigin);
  }

  const linkSigningSecret =
    source.LINK_SIGNING_SECRET?.trim() ||
    source.JWT_REFRESH_SECRET?.trim() ||
    source.JWT_ACCESS_SECRET?.trim();

  const merged: NodeJS.ProcessEnv = { ...source };
  if (appUrl) merged.APP_URL = appUrl;
  else delete merged.APP_URL;
  if (frontendUrl) merged.FRONTEND_URL = frontendUrl;
  else delete merged.FRONTEND_URL;
  if (linkSigningSecret) merged.LINK_SIGNING_SECRET = linkSigningSecret;
  else delete merged.LINK_SIGNING_SECRET;

  return merged;
}

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

const parsed = envSchema.safeParse(buildProcessEnv());

if (!parsed.success) {
  const missing = Object.keys(parsed.error.flatten().fieldErrors);
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:');
  // eslint-disable-next-line no-console
  console.error(parsed.error.flatten().fieldErrors);
  // eslint-disable-next-line no-console
  console.error(
    [
      'Render: env vars are set in the dashboard (not from .env in the Docker image).',
      'Required: DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, FRONTEND_URL.',
      'Optional: APP_URL (auto from RENDER_EXTERNAL_URL), LINK_SIGNING_SECRET (falls back to JWT secret).',
      `Missing or invalid: ${missing.join(', ')}`,
    ].join('\n'),
  );
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
    throw new Error(
      `Production environment misconfiguration:\n- ${productionIssues.join('\n- ')}\n` +
        'Set APP_URL / FRONTEND_URL in Render (or rely on RENDER_EXTERNAL_URL + CORS_ORIGINS for APP_URL).',
    );
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

if (raw.NODE_ENV === 'production') {
  // eslint-disable-next-line no-console
  console.info(
    `[cds] env loaded: APP_URL=${appUrl} FRONTEND_URL=${frontendUrl} DATABASE_URL=set JWT=set`,
  );
}

export type AppEnv = typeof env;
