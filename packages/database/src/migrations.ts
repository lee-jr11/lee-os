import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { StateDatabase } from './types';
export interface Migration { name: string; sql: string }
export const migrationDirectory = fileURLToPath(new URL('../migrations/', import.meta.url));
export async function readMigrations(directory = migrationDirectory): Promise<Migration[]> {
 const names = (await readdir(directory)).filter(name => /^\d{3}_[a-z0-9_]+\.sql$/.test(name)).sort();
 if (!names.length) throw new Error('No migrations found.');
 return Promise.all(names.map(async name => ({ name, sql: (await readFile(`${directory}/${name}`, 'utf8')).replace(/\r\n/g, '\n') })));
}
// All migrations and their ledger entries commit together. Never edit an applied file.
export async function migrate(db: StateDatabase, migrations?: Migration[]): Promise<string[]> {
 const files = migrations ?? await readMigrations();
 if (new Set(files.map(file => file.name)).size !== files.length) throw new Error('Duplicate migration name.');
 return db.transaction(async tx => {
  // Serializes concurrent migration processes on PostgreSQL; PGlite has one connection.
  await tx.query('SELECT pg_advisory_xact_lock(710026, 2)');
  await tx.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
  const applied = await tx.query<{ name: string; checksum: string }>('SELECT name, checksum FROM schema_migrations ORDER BY name');
  for (let i = 0; i < applied.rows.length; i++) {
   const file = files[i]; const saved = applied.rows[i];
   if (!file || file.name !== saved.name || createHash('sha256').update(file.sql).digest('hex') !== saved.checksum) throw new Error('Applied migration history differs from source.');
  }
  const added: string[] = [];
  for (const file of files.slice(applied.rows.length)) {
   await tx.exec(file.sql);
   await tx.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [file.name, createHash('sha256').update(file.sql).digest('hex')]);
   added.push(file.name);
  }
  return added;
 });
}
