import { createPostgresDatabase, checkDatabase } from '@leeos/database';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
 const url = process.env.DATABASE_URL;
 if (!url) return Response.json({ database: { status: 'not-configured' } }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
 try {
  const db = createPostgresDatabase(url);
  try {
   const database = await checkDatabase(db);
   return Response.json({ database }, { status: database.status === 'ready' ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
  } finally { await db.close(); }
 } catch { return Response.json({ database: { status: 'unavailable' } }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
}
