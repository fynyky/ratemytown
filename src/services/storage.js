import { Client } from 'minio';
import crypto from 'node:crypto';
import { config } from '../config.js';

const endpoint = new URL(config.s3.endpoint);

// MinIO is S3-compatible; in production this same client talks to AWS S3,
// GCS, R2, etc. by changing endpoint + credentials.
export const minio = new Client({
  endPoint: endpoint.hostname,
  port: Number(endpoint.port) || (endpoint.protocol === 'https:' ? 443 : 80),
  useSSL: endpoint.protocol === 'https:',
  accessKey: config.s3.accessKey,
  secretKey: config.s3.secretKey,
});

const BUCKET = config.s3.bucket;

const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export function isAllowedImage(mime) {
  return Object.prototype.hasOwnProperty.call(EXT_BY_MIME, mime);
}

// Create the bucket on first boot if it doesn't exist.
export async function ensureBucket() {
  const exists = await minio.bucketExists(BUCKET).catch(() => false);
  if (!exists) await minio.makeBucket(BUCKET);
}

// Store a buffer under a random key; returns the object key.
export async function putImage(buffer, mime) {
  const ext = EXT_BY_MIME[mime] || 'bin';
  const key = `reviews/${crypto.randomUUID()}.${ext}`;
  await minio.putObject(BUCKET, key, buffer, buffer.length, {
    'Content-Type': mime,
  });
  return key;
}

export async function statObject(key) {
  return minio.statObject(BUCKET, key);
}

export async function getObjectStream(key) {
  return minio.getObject(BUCKET, key);
}
