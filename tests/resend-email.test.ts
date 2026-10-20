import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomBytes} from 'node:crypto';
import {createResendEmailAdapter,verifyResendWebhook} from '../packages/providers/src/resend-email';
import {routeCapability} from '../packages/core/src/task-router/capabilities';

const now=new Date('2026-10-19T12:00:00.000Z'),secret=`whsec_${randomBytes(32).toString('base64')}`;
function env(attestedAt=now.toISOString()){return {LEEOS_RESEND_EMAIL_ENABLED:'1',RESEND_API_KEY:'resend-test-secret',RESEND_FROM_EMAIL:'Lee <noreply@example.com>',RESEND_WEBHOOK_SECRET:secret,LEEOS_RESEND_FREE_PLAN_CONFIRMED:'1',LEEOS_RESEND_PAYG_DISABLED:'1',LEEOS_RESEND_ZERO_COST_CONFIRMED_AT:attestedAt};}
test('Resend route requires a fresh owner zero-cost attestation and a verified sender domain',async()=>{
 let requests=0;
 const fresh=createResendEmailAdapter({env:env(),now:()=>now,fetch:async()=>{requests++;return Response.json({data:[{name:'example.com',status:'verified'}]});}});
 const route=await fresh.inspect();assert.equal(route.eligible,true);assert.equal(route.confirmationReady,true);assert.equal(route.costStatus,'owner-attested-zero');assert.equal(route.validUntil,'2026-10-19T12:05:00.000Z');
 assert.equal(JSON.stringify(route).includes('resend-test-secret'),false);
 const stale=createResendEmailAdapter({env:env('2026-10-18T10:00:00.000Z'),now:()=>now,fetch:async()=>{throw Error('Stale attestation must block before network.');}});
 assert.equal((await stale.inspect()).reason,'FRESH_ZERO_COST_OWNER_ATTESTATION_REQUIRED');assert.equal(requests,1);
});
test('Resend send preserves exact provider idempotency, uses the LeeOS effect tag and keeps credentials server-side',async()=>{
 const calls:Array<{url:string;init:RequestInit}> = [];
 const workerEnv:Record<string,string|undefined>=env();delete workerEnv.RESEND_WEBHOOK_SECRET;
 const adapter=createResendEmailAdapter({env:workerEnv,now:()=>now,fetch:async(input,init={})=>{
  calls.push({url:String(input),init});
  if(String(input).endsWith('/domains'))return Response.json({data:[{name:'example.com',status:'verified'}]});
  return Response.json({id:'resend-message-1'});
 }});
 const result=await adapter.send({effectId:'eff_12345678-1234-4234-8234-123456789abc',to:'lee@example.com',subject:'Exact subject',text:'Exact body',attachments:[{filename:'report.docx',content:new Uint8Array([1,2,3]),contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}]},'leeos:env_12345678-1234-4234-8234-123456789abc:mail');
 assert.deepEqual(result,{kind:'accepted',emailId:'resend-message-1'});
 const workerInspection=await adapter.inspect();assert.equal(workerInspection.confirmationReady,false);
 assert.equal(routeCapability('approved_delivery',undefined,{emailDelivery:workerInspection}).reason,'RESEND_SIGNED_WEBHOOK_NOT_CONFIGURED');
 const call=calls.find(item=>item.url.endsWith('/emails'))!;assert.equal(new Headers(call.init.headers).get('Idempotency-Key'),'leeos:env_12345678-1234-4234-8234-123456789abc:mail');
 const payload=JSON.parse(String(call.init.body)) as {to:string[];tags:{name:string;value:string}[];attachments:{content:string}[]};
 assert.deepEqual(payload.to,['lee@example.com']);assert.deepEqual(payload.tags,[{name:'leeos_effect',value:'eff_12345678-1234-4234-8234-123456789abc'}]);assert.equal(payload.attachments[0].content,'AQID');
 assert.equal(new Headers(call.init.headers).get('Authorization'),'Bearer resend-test-secret');
 assert.equal(call.url.includes('resend-test-secret'),false);assert.equal(String(call.init.body).includes('resend-test-secret'),false);
});
test('Resend webhook signature verifier requires the untouched payload, fresh timestamp and v1 signature',()=>{
 const payload='{"type":"email.delivered"}',id='msg_123456789',timestamp=String(Math.floor(now.getTime()/1000));
 const key=Buffer.from(secret.slice(6),'base64'),signature=createHmac('sha256',key).update(`${id}.${timestamp}.${payload}`).digest('base64');
 const headers={id,timestamp,signature:`v1,${signature}`};
 assert.equal(verifyResendWebhook({payload,secret,...headers,now}),true);
 assert.equal(verifyResendWebhook({payload:payload+' ',secret,...headers,now}),false);
 assert.equal(verifyResendWebhook({payload,secret,...headers,timestamp:String(Math.floor(now.getTime()/1000)-301),now}),false);
});
