import test from 'node:test';
import assert from 'node:assert/strict';
import { checkDatabase, type SqlSession } from '../packages/database/src/index';
import { GET } from '../apps/hub/app/api/ready/route';
test('readiness fails closed without exposing connection failures', async () => {
 const unavailable: SqlSession = { query: async () => { throw new Error('secret-password-in-driver-error'); }, exec: async () => {} };
 assert.deepEqual(await checkDatabase(unavailable),{ status: 'unavailable' });
});
test('unconfigured readiness is 503 and does not leak environment values', async () => {
 const previous = process.env.DATABASE_URL;
 delete process.env.DATABASE_URL;
 try {
  const response = await GET(); assert.equal(response.status,503);
  assert.equal(response.headers.get('Cache-Control'),'no-store');
  assert.deepEqual(await response.json(),{ database: { status: 'not-configured' } });
 } finally { if (previous !== undefined) process.env.DATABASE_URL = previous; }
});
