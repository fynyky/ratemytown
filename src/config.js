import 'dotenv/config';

// Single source of truth for environment configuration. Every service module
// reads from here so defaults live in one place.
export const config = {
  port: Number(process.env.PORT) || 3000,

  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://node:node@localhost:5432/ratemytown',

  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  sessionSecret: process.env.SESSION_SECRET || 'dev-only-session-secret-change-me',

  nricSalt: process.env.NRIC_HASH_SALT || 'dev-only-salt-change-me',

  // S3-compatible blobstore (MinIO in local dev).
  s3: {
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
    accessKey: process.env.S3_ACCESS_KEY || 'ratemytown',
    secretKey: process.env.S3_SECRET_KEY || 'ratemytown-dev-secret',
    bucket: process.env.S3_BUCKET || 'ratemytown-uploads',
  },
};
