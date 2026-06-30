import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://node:node@localhost:5432/ratemytown',
});

export function query(text, params) {
  return pool.query(text, params);
}
