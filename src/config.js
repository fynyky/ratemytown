import 'dotenv/config';

// Single source of truth for environment configuration. Every service module
// reads from here so defaults live in one place.
export const config = {
  port: Number(process.env.PORT) || 3000,

  // Set NODE_ENV=production on the host (Fly does this via fly.toml). Turns on
  // secure cookies + proxy trust so sessions work behind the platform's TLS edge.
  isProduction: process.env.NODE_ENV === 'production',

  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://node:node@localhost:5432/ratemytown',

  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  sessionSecret: process.env.SESSION_SECRET || 'dev-only-session-secret-change-me',

  nricSalt: process.env.NRIC_HASH_SALT || 'dev-only-salt-change-me',

  // S3-compatible blobstore (MinIO in local dev). In production this talks to
  // Fly's Tigris store, which injects the standard AWS_*/BUCKET_NAME env vars —
  // accepted here as fallbacks so no manual secret mapping is needed.
  s3: {
    endpoint:
      process.env.S3_ENDPOINT ||
      process.env.AWS_ENDPOINT_URL_S3 ||
      'http://localhost:9000',
    accessKey:
      process.env.S3_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID || 'ratemytown',
    secretKey:
      process.env.S3_SECRET_KEY ||
      process.env.AWS_SECRET_ACCESS_KEY ||
      'ratemytown-dev-secret',
    bucket: process.env.S3_BUCKET || process.env.BUCKET_NAME || 'ratemytown-uploads',
    region: process.env.S3_REGION || process.env.AWS_REGION || 'us-east-1',
  },
};
