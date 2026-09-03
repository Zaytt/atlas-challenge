import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { seed } from './seed.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ddlPath = join(__dirname, '../../drizzle/0000_init.sql');

export const sqlite = new Database(':memory:');
sqlite.pragma('foreign_keys = ON');
sqlite.exec(readFileSync(ddlPath, 'utf8'));
seed(sqlite);

export const db = drizzle(sqlite, { schema });
export { schema };
