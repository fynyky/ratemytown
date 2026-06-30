// Applies schema.sql to the database. Drops and recreates all tables.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from './pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const sql = await readFile(join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('✓ Schema applied');
  await pool.end();
}

main().catch((err) => {
  console.error('Schema init failed:', err.message);
  process.exit(1);
});
