import { createClient } from 'redis';
import { config } from '../config.js';

// Shared Redis client, used for both the session store and the query cache.
export const redis = createClient({ url: config.redisUrl });
redis.on('error', (err) => console.error('Redis error:', err.message));

export async function connectRedis() {
  if (!redis.isOpen) await redis.connect();
  return redis;
}

// --- small JSON cache helpers ----------------------------------------------
export async function cacheGet(key) {
  try {
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // cache is best-effort; never block a request on it
  }
}

export async function cacheSet(key, value, ttlSeconds) {
  try {
    await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch {
    /* ignore */
  }
}

// Drop every cached leaderboard variant (called when reviews change).
export async function invalidateLeaderboard() {
  try {
    const keys = await redis.keys('lb:*');
    if (keys.length) await redis.del(keys);
  } catch {
    /* ignore */
  }
}
