/**
 * Server-side configuration, read once and validated eagerly so a missing
 * secret fails at boot rather than on the first request that happens to need it.
 */
function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

function numeric(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';

export const env = {
  nodeEnv: optional('NODE_ENV', 'development') as 'development' | 'production' | 'test',
  get isProduction() {
    return this.nodeEnv === 'production';
  },

  databaseUrl: isBuildPhase
    ? optional('DATABASE_URL', 'postgresql://localhost:5432/placeholder')
    : required('DATABASE_URL'),
  databaseUrlUnpooled: optional('DATABASE_URL_UNPOOLED') || optional('DATABASE_URL'),

  authSecret: isBuildPhase
    ? optional('AUTH_SECRET', 'build-phase-placeholder-secret-value-0123456789')
    : required('AUTH_SECRET'),
  sessionTtlHours: numeric('SESSION_TTL_HOURS', 12),

  siteUrl: optional('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000').replace(/\/$/, ''),

  storage: {
    driver: optional('STORAGE_DRIVER', 'local') as 'local' | 's3',
    endpoint: optional('S3_ENDPOINT'),
    region: optional('S3_REGION', 'auto'),
    bucket: optional('S3_BUCKET'),
    accessKeyId: optional('S3_ACCESS_KEY_ID'),
    secretAccessKey: optional('S3_SECRET_ACCESS_KEY'),
    publicBaseUrl: optional('S3_PUBLIC_BASE_URL'),
  },

  seed: {
    adminEmail: optional('ADMIN_EMAIL', 'admin@mersam.com'),
    adminPassword: optional('ADMIN_PASSWORD', 'ChangeMe!2026'),
    adminName: optional('ADMIN_NAME', 'MerSam Administrator'),
  },
} as const;

export function assertProductionSecrets(): void {
  if (!env.isProduction) return;
  if (env.authSecret.length < 32) {
    throw new Error('AUTH_SECRET must be at least 32 characters in production');
  }
  if (env.seed.adminPassword === 'ChangeMe!2026') {
    throw new Error('ADMIN_PASSWORD must be changed before running in production');
  }
}
