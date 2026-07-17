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
  region: config.s3.region,
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

// Create the bucket on first boot if it doesn't exist. On managed stores
// (Tigris) the bucket is usually pre-provisioned, so an already-exists response
// is treated as success; only unexpected errors propagate.
export async function ensureBucket() {
  try {
    const exists = await minio.bucketExists(BUCKET);
    if (!exists) await minio.makeBucket(BUCKET);
  } catch (err) {
    if (!/exist|owned/i.test(err.message || '')) throw err;
  }
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

// Remove every object under a prefix. Used by the seeder so re-seeding doesn't
// strand orphaned photo objects from the previous run in the bucket.
export function clearPrefix(prefix) {
  return new Promise((resolve, reject) => {
    const keys = [];
    const stream = minio.listObjectsV2(BUCKET, prefix, true);
    stream.on('data', (obj) => keys.push(obj.name));
    stream.on('error', reject);
    stream.on('end', () => {
      if (!keys.length) return resolve(0);
      minio.removeObjects(BUCKET, keys).then(() => resolve(keys.length), reject);
    });
  });
}

export async function statObject(key) {
  return minio.statObject(BUCKET, key);
}

export async function getObjectStream(key) {
  return minio.getObject(BUCKET, key);
}
