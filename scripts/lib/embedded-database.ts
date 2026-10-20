import { PGlite, type Transaction } from '@electric-sql/pglite';
import { mkdir, readFile, open, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { SqlSession, StateDatabase, Row } from '../../packages/database/src/types';
function wrap(client: PGlite | Transaction): SqlSession {
 return {
  async query<T extends Row>(sql: string, params: unknown[] = []) { const result = await client.query<T>(sql,params); return { rows: result.rows }; },
  async exec(sql: string) { await client.exec(sql); }
 };
}
// Portable development harness, not the application's live database adapter.
// Use memory + clean-close snapshots to avoid Windows NodeFS reopen failures.
export async function createEmbeddedDatabase(dataDirectory?: string): Promise<StateDatabase> {
 const snapshot = dataDirectory ? join(dataDirectory,'database.tar') : undefined;
 let saved: Uint8Array | undefined;
 if (dataDirectory && snapshot) {
  await mkdir(dataDirectory,{ recursive: true });
  try { saved = new Uint8Array(await readFile(snapshot)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
 }
 const pg = new PGlite(saved ? { loadDataDir: new Blob([saved as Uint8Array<ArrayBuffer>]) } : {});
 await pg.waitReady; let closed = false;
 return { ...wrap(pg), transaction: work => pg.transaction(tx => work(wrap(tx))),
  async close() {
   if (closed) return;
   try {
    if (snapshot) {
     const temporary = `${snapshot}.${randomUUID()}.tmp`;
     try {
      const dump = await pg.dumpDataDir('none');
      const file = await open(temporary,'wx',0o600);
      try { await file.writeFile(new Uint8Array(await dump.arrayBuffer())); await file.sync(); }
      finally { await file.close(); }
      await rename(temporary,snapshot);
     } finally { await unlink(temporary).catch(() => undefined); }
    }
   } finally { await pg.close(); closed = true; }
  }
 };
}
