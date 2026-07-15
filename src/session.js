import session from 'express-session';
import RedisStore from 'connect-redis';
import { redis } from './services/redis.js';
import { config } from './config.js';

// Sessions are stored in Redis so they survive restarts and could be shared
// across multiple app instances. Here the session carries the in-progress
// review across the Singpass verification step.
export function sessionMiddleware() {
  return session({
    store: new RedisStore({ client: redis, prefix: 'sess:' }),
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      // Behind the platform's TLS edge in production the cookie must be marked
      // secure; requires `trust proxy` (set in server.js) so express-session
      // sees the request as https.
      secure: config.isProduction,
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  });
}
