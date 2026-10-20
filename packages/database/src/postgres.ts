import { Pool, type PoolClient } from 'pg';
import type { StateDatabase, SqlSession, Row } from './types';
function session(client: Pool | PoolClient): SqlSession {
 return {
  async query<T extends Row>(sql: string, params: unknown[] = []) { const result = await client.query<T>(sql, params); return { rows: result.rows }; },
  async exec(sql: string) { await client.query(sql); }
 };
}
export function createPostgresDatabase(connectionString: string, schema?: string): StateDatabase {
 if (!connectionString) throw new Error('DATABASE_URL is required.');
 if (schema && !/^[a-z][a-z0-9_]*$/.test(schema)) throw new Error('Invalid database namespace.');
 const pool = new Pool({ connectionString, ...(schema ? { options: `-c search_path=${schema}` } : {}), max: 4, connectionTimeoutMillis: 3000, idleTimeoutMillis: 10000, statement_timeout: 10000, query_timeout: 12000 });
 pool.on('error', () => console.error('LeeOS database connection became unavailable.'));
 return { ...session(pool),
  async transaction<T>(work: (tx: SqlSession) => Promise<T>) {
   const client = await pool.connect();
   try { await client.query('BEGIN'); const result = await work(session(client)); await client.query('COMMIT'); return result; }
   catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; }
   finally { client.release(); }
  },
  async close() { await pool.end(); }
 };
}
