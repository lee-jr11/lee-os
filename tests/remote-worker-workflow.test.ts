import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {parseEnvelopeWorkerInvocation,runEnvelopeWorkerUntilSettled} from '../scripts/lib/envelope-worker-loop';

const workflow = readFileSync(resolve('.github/workflows/remote-envelope-worker.yml'), 'utf8');
const envelope='env_12345678-1234-4234-8234-123456789abc';
const retryState=(overrides:Record<string,unknown>={})=>({
 envelopeId:envelope,state:'queued',reason:'GEMINI_HTTP_503_RETRY_SCHEDULED',availableAt:'2026-10-22T00:00:05.000Z',authorizationBlocked:null,...overrides
});

test('remote worker requires an explicit opt-in in addition to its database credential', () => {
 assert.match(workflow, /LEEOS_REMOTE_WORKER_ENABLED:\s*\$\{\{\s*vars\.LEEOS_REMOTE_WORKER_ENABLED\s*\}\}/);
 assert.match(workflow, /\[\[ -n "\$DATABASE_URL" && "\$LEEOS_REMOTE_WORKER_ENABLED" == "1" \]\]/);
});

test('remote polling leaves an autosuspend window between scheduled runs', () => {
 assert.match(workflow, /cron:\s*'\*\/15 \* \* \* \*'/);
});

test('manual dispatch requires and passes one exact envelope ID', () => {
 assert.match(workflow, /envelope_id:\s*\n\s+description: Exact accepted envelope ID to process\s*\n\s+required: true\s*\n\s+type: string/);
 const workerStep=workflow.split('      - name: Claim and process at most one accepted envelope')[1];
 assert.ok(workerStep);
 assert.match(workerStep, /LEEOS_WORKER_ENVELOPE_ID:\s*\$\{\{\s*inputs\.envelope_id\s*\}\}/);
 assert.match(workerStep, /npm run worker:envelopes -- once --envelope-id "\$LEEOS_WORKER_ENVELOPE_ID"/);
});

test('manual concurrency is isolated by envelope and never cancels an active worker', () => {
 assert.match(workflow, /group:\s*\$\{\{\s*github\.event_name == 'workflow_dispatch' && format\('leeos-envelope-\{0\}', inputs\.envelope_id\) \|\| 'leeos-remote-envelope-worker-scheduled'\s*\}\}/);
 assert.match(workflow, /cancel-in-progress:\s*false/);
});

test('remote Gemini requires an explicit opt-in in addition to both credentials', () => {
 assert.match(workflow, /LEEOS_GEMINI_PROVIDER_ENABLED:\s*\$\{\{\s*vars\.LEEOS_GEMINI_PROVIDER_ENABLED\s*\}\}/);
 assert.match(workflow, /\[\[ "\$LEEOS_GEMINI_PROVIDER_ENABLED" == "1" && -n "\$GEMINI_API_KEY" && -n "\$GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON" \]\]/);
});

test('manual worker arguments require exactly one valid envelope ID',()=>{
 assert.deepEqual(parseEnvelopeWorkerInvocation(['once','--envelope-id',envelope]),{mode:'once',envelopeId:envelope});
 assert.deepEqual(parseEnvelopeWorkerInvocation(['once']),{mode:'once'});
 assert.deepEqual(parseEnvelopeWorkerInvocation(['watch']),{mode:'watch'});
 assert.throws(()=>parseEnvelopeWorkerInvocation(['once','--envelope-id','another-envelope']));
 assert.throws(()=>parseEnvelopeWorkerInvocation(['once','--envelope-id',envelope,'--other']));
 assert.throws(()=>parseEnvelopeWorkerInvocation(['watch','--envelope-id',envelope]));
});

test('worker process waits for its authorized 503 retry and resumes only the same envelope',async()=>{
 let now=Date.parse('2026-10-22T00:00:00.000Z');
 let work=retryState();
 const calls:(string|undefined)[]=[],delays:number[]=[];
 const result=await runEnvelopeWorkerUntilSettled({
  envelopeId:envelope,enabled:()=>true,signal:new AbortController().signal,now:()=>now,
  runOnce:async target=>{calls.push(target);if(calls.length===2)work={...work,state:'waiting-human',reason:'EXPLICIT_OWNER_REVIEW_REQUIRED'};return {status:calls.length===1?'queued':'waiting-human',envelopeId:envelope};},
  getWork:async id=>{assert.equal(id,envelope);return work;},
  sleep:async milliseconds=>{delays.push(milliseconds);now+=milliseconds;}
 });
 assert.deepEqual(calls,[envelope,envelope]);
 assert.deepEqual(delays,[5000]);
 assert.deepEqual(result,{status:'waiting-human',envelopeId:envelope});
});

test('worker does not resume uncertain, non-503, or authorization-blocked work',async()=>{
 for(const work of [
  retryState({state:'recovery-required',reason:'CALL_RESULT_UNCERTAIN'}),
  retryState({state:'queued',reason:'PROVEN_PREFLIGHT_BACKPRESSURE'}),
  retryState({authorizationBlocked:'GRANT_EXPIRED'})
 ]){
  let calls=0;
  const result=await runEnvelopeWorkerUntilSettled({
   envelopeId:envelope,enabled:()=>true,signal:new AbortController().signal,
   runOnce:async()=>{calls+=1;return {status:'queued',envelopeId:envelope};},
   getWork:async()=>work,
   sleep:async()=>{assert.fail('The worker must not wait or retry for this state.');}
  });
  assert.equal(calls,1);
  assert.equal(result.status,'queued');
 }
});

test('scheduled worker retry stays with the envelope it actually claimed',async()=>{
 let calls=0;
 const targets:(string|undefined)[]=[];
 const result=await runEnvelopeWorkerUntilSettled({
  enabled:()=>true,signal:new AbortController().signal,
  runOnce:async target=>{targets.push(target);calls+=1;return {status:calls===1?'queued':'waiting-human',envelopeId:envelope};},
  getWork:async()=>calls===1?retryState():retryState({state:'waiting-human',reason:'EXPLICIT_OWNER_REVIEW_REQUIRED'}),
  now:()=>Date.parse('2026-10-22T00:00:05.000Z'),sleep:async()=>undefined
 });
 assert.deepEqual(targets,[undefined,envelope]);
 assert.deepEqual(result,{status:'waiting-human',envelopeId:envelope});
});
