import { handleCoreRequest } from '../../packages/core/src/api/http';
import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createId,type StateDatabase } from '../../packages/database/src';
import { createLocalAdapter,LocalProviderError,type LocalTransport } from '../../packages/providers/src/local';
import { createLocalProviderManager,getLocalCall } from '../../packages/core/src/provider-manager/service';
export function fixtureTransport(){
 let generated=0;let preflightError=false;let malformed=false;let gate:(()=>Promise<void>)|undefined;
 const transport:LocalTransport=async(path,body)=>{
  if(preflightError)throw new LocalProviderError('LOCAL_CONNECTION_ERROR');
  if(path==='/health')return {status:'ok'};
  if(path==='/props')return {model_path:'local-test.gguf',build_info:'fixture-only',total_slots:1,default_generation_settings:{n_ctx:512}};
  if(path==='/slots')return [{id:0,is_processing:false}];
  if(path==='/tokenize')return {tokens:[1,2,3]};
  if(path==='/completion'){
   generated++;await gate?.();if(malformed)return {rawError:'provider-secret-must-not-leak'};
   const b=body as {n_predict:number};return {content:'Fixture text, not model inference.',tokens_predicted:Math.min(4,b.n_predict),tokens_evaluated:3,truncated:false,stop:true};
  }
  throw new Error('Unexpected path');
 };
 return {transport,get generated(){return generated;},set preflightError(v:boolean){preflightError=v;},set malformed(v:boolean){malformed=v;},set gate(v:(()=>Promise<void>)|undefined){gate=v;}};
}
export async function exerciseLocalProvider(db:StateDatabase,t:TestContext){
 const fixture=fixtureTransport(),adapter=createLocalAdapter(fixture.transport),manager=createLocalProviderManager({enabled:()=>true,adapter});
 const request=()=>({prompt:'Private test prompt '+randomUUID(),maxOutputTokens:16,idempotencyKey:'provider-'+randomUUID()});
 await t.test('bounded calls record usage once, omit raw prompts, and replay without model requests',async()=>{
  const input=request(),before=fixture.generated,result=await manager.generate(db,input);
  assert.equal(result.status,'succeeded');assert.equal(result.outputTokens,4);assert.equal(fixture.generated,before+1);
  assert.deepEqual(await manager.generate(db,input),result);assert.equal(fixture.generated,before+1);
  assert.deepEqual(await getLocalCall(db,String(result.id)),result);
  await assert.rejects(manager.generate(db,{...input,prompt:'Changed'}));
  const stored=(await db.query('SELECT * FROM provider_calls WHERE id=$1',[result.id])).rows[0];assert.ok(!JSON.stringify(stored).includes(input.prompt));
  const usage=(await db.query('SELECT * FROM model_usage WHERE id=$1',[stored.usage_id])).rows[0];assert.equal(Number(usage.cost_usd),0);assert.equal(Number(usage.input_tokens),3);
  assert.equal((await db.query('SELECT call_id FROM provider_slots')).rows[0].call_id,null);
 });
 await t.test('durable reservation fences duplicate and concurrent calls across manager instances',async()=>{
  let enter!:()=>void,release!:()=>void;const entered=new Promise<void>(r=>{enter=r;}),held=new Promise<void>(r=>{release=r;});
  fixture.gate=async()=>{enter();await held;};const input=request();const running=manager.generate(db,input);await entered;
  try{
   const other=createLocalProviderManager({enabled:()=>true,adapter});
   await assert.rejects(other.generate(db,input));await assert.rejects(other.generate(db,request()));
   const call=(await db.query('SELECT * FROM provider_calls WHERE request_key=$1',[input.idempotencyKey])).rows[0];
   await assert.rejects(manager.recover(db,{callId:call.id,expectedVersion:0,acknowledgeServerRestart:true}));
  }finally{release();fixture.gate=undefined;}
  assert.equal((await running).status,'succeeded');
 });
 await t.test('preflight failure releases capacity and terminal replay never automatically retries',async()=>{
  fixture.preflightError=true;const input=request(),before=fixture.generated;const failed=await manager.generate(db,input);fixture.preflightError=false;
  assert.equal(failed.status,'failed');assert.equal(failed.recoveryRequired,false);assert.equal(fixture.generated,before);
  assert.deepEqual(await manager.generate(db,input),failed);assert.equal(fixture.generated,before);
  assert.equal((await manager.generate(db,request())).status,'succeeded');
  const tooLarge=createLocalProviderManager({enabled:()=>true,adapter:createLocalAdapter(async(path,body,signal)=>path==='/tokenize'?{tokens:Array(510).fill(1)}:fixture.transport(path,body,signal))});
  const beforeLarge=fixture.generated;assert.equal((await tooLarge.generate(db,request())).status,'failed');assert.equal(fixture.generated,beforeLarge);
 });
 await t.test('uncertain dispatch holds capacity until explicit versioned restart acknowledgement',async()=>{
  fixture.malformed=true;const input=request(),before=fixture.generated;const failed=await manager.generate(db,input);fixture.malformed=false;
  assert.equal(failed.status,'interrupted');assert.equal(failed.recoveryRequired,true);assert.equal(fixture.generated,before+1);
  assert.ok(!JSON.stringify(failed).includes('provider-secret'));
  await assert.rejects(manager.generate(db,request()));
  await assert.rejects(manager.recover(db,{callId:failed.id,expectedVersion:0,acknowledgeServerRestart:true}));
  const recovered=await manager.recover(db,{callId:failed.id,expectedVersion:1,acknowledgeServerRestart:true});
  assert.equal(recovered.version,2);assert.equal(recovered.recoveryRequired,false);
  assert.deepEqual(await manager.generate(db,input),recovered);assert.equal(fixture.generated,before+1);
  assert.equal((await manager.generate(db,request())).status,'succeeded');
 });
 await t.test('missing success history rolls back usage/result and conservatively holds the slot',async()=>{
  await db.exec(`CREATE FUNCTION reject_local_success() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind='provider.call-succeeded' THEN RAISE EXCEPTION 'reject success event'; END IF; RETURN NEW; END $$;
   CREATE TRIGGER reject_local_success BEFORE INSERT ON events FOR EACH ROW EXECUTE FUNCTION reject_local_success();`);
  let result:Awaited<ReturnType<typeof manager.generate>>;
  try{result=await manager.generate(db,request());}finally{await db.exec('DROP TRIGGER reject_local_success ON events; DROP FUNCTION reject_local_success();');}
  assert.equal(result!.status,'interrupted');assert.equal(result!.text,null);
  assert.equal((await db.query('SELECT usage_id FROM provider_calls WHERE id=$1',[result!.id])).rows[0].usage_id,null);
  await manager.recover(db,{callId:result!.id,expectedVersion:1,acknowledgeServerRestart:true});
 });
 await t.test('reservation/history failure makes no model request and leaves no partial call',async()=>{
  const input=request(),before=fixture.generated;
  await db.exec(`CREATE FUNCTION reject_local_start() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind='provider.call-started' THEN RAISE EXCEPTION 'reject start event'; END IF; RETURN NEW; END $$;
   CREATE TRIGGER reject_local_start BEFORE INSERT ON events FOR EACH ROW EXECUTE FUNCTION reject_local_start();`);
  try{await assert.rejects(manager.generate(db,input),/reject start event/);}finally{await db.exec('DROP TRIGGER reject_local_start ON events; DROP FUNCTION reject_local_start();');}
  assert.equal(fixture.generated,before);assert.equal((await db.query('SELECT * FROM provider_calls WHERE request_key=$1',[input.idempotencyKey])).rows.length,0);
  assert.equal((await db.query('SELECT call_id FROM provider_slots')).rows[0].call_id,null);
 });
 await t.test('crash residue stays reserved until owner recovery, without regenerating the old call',async()=>{
  const id=createId('call');await db.transaction(async tx=>{
   await tx.query('INSERT INTO provider_calls(id,request_key,request_hash,provider_id,model_id) VALUES($1,$2,$3,$4,$5)',[id,'crash-'+randomUUID(),'a'.repeat(64),'llamacpp-local','leeos-local']);
   await tx.query("UPDATE provider_slots SET call_id=$1 WHERE id='llamacpp-local'",[id]);
  });
  const before=fixture.generated;await assert.rejects(manager.generate(db,request()));
  const recovered=await createLocalProviderManager({enabled:()=>false,adapter}).recover(db,{callId:id,expectedVersion:0,acknowledgeServerRestart:true});
  assert.equal(recovered.status,'interrupted');assert.equal(fixture.generated,before);
 });
 await t.test('authenticated provider API creates, lists and reads persisted call results',async()=>{
  const token='a'.repeat(64),origin='http://127.0.0.1:3000';
  const call=(method:string,path:string,body?:unknown)=>handleCoreRequest(new Request(origin+'/api/v1'+path,{method,headers:{Host:'127.0.0.1:3000',Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),{token,origin,database:()=>db,localProvider:manager});
  const created=await call('POST','/providers/local/calls',request());assert.equal(created.status,201);const result=(await created.json()).data;assert.equal(result.status,'succeeded');
  assert.deepEqual((await (await call('GET','/providers/local/calls/'+result.id)).json()).data,result);
  const list=(await (await call('GET','/providers/local/calls?limit=1')).json()).data;assert.equal(list.items.length,1);assert.ok(list.nextCursor);
  assert.equal((await call('GET','/providers/local/calls?after=wrong')).status,400);
 });

}
