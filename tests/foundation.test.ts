import test from 'node:test';
import assert from 'node:assert/strict';
import { assertZeroCost, getSystemStatus } from '../packages/core/src/index';
import { GET } from '../apps/hub/app/api/health/route';
test('unknown and nonzero costs fail closed', () => {
 assert.doesNotThrow(() => assertZeroCost({ amountUsd: 0, verified: true }));
 for (const amountUsd of [1, -1, NaN, Infinity]) assert.throws(() => assertZeroCost({ amountUsd, verified: true }));
 assert.throws(() => assertZeroCost({ amountUsd: 0, verified: false }));
});
test('liveness reports disabled execution and directs persistence checks to readiness', async () => {
 const response = GET();
 assert.equal(response.status, 200);
 assert.equal(response.headers.get('Cache-Control'), 'no-store');
 assert.deepEqual(await response.json(), getSystemStatus());
 assert.equal(getSystemStatus().executionEnabled, false);
 assert.equal(getSystemStatus().persistence, 'check-readiness');
});
