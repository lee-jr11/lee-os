// Native PostgreSQL process tests only. This transport is never selected by the
// production worker CLI or by a provider environment variable.
import {createPostgresDatabase} from '../../packages/database/src';
import {createLocalAdapter} from '../../packages/providers/src/local';
import {createLocalProviderManager} from '../../packages/core/src/provider-manager/service';
import {runEnvelopeWorkerOnce} from '../../packages/core/src/envelope-worker/runner';
import {fixtureTransport} from '../helpers/local-provider-contract';
const url=process.env.LEEOS_TEST_DATABASE_URL,schema=process.env.LEEOS_WORKER_TEST_SCHEMA,mode=process.argv[2];
if(!url||!schema||!/^leeos_test_[a-f0-9]{32}$/.test(schema)||!['complete','die-during-call'].includes(mode))throw Error('Invalid isolated worker-process fixture.');
const db=createPostgresDatabase(url,schema),fixture=fixtureTransport();
const transport:typeof fixture.transport=async(path,body,signal)=>{
 if(path==='/completion'){
  await db.query("INSERT INTO worker_test_effects(marker) VALUES('generation-entered')");process.send?.({type:'generation-entered'});
  if(mode==='die-during-call')await new Promise<void>(()=>undefined);
 }
 return fixture.transport(path,body,signal);
};
async function main(){
try{const result=await runEnvelopeWorkerOnce(db,{workerId:'worker_process_'+process.pid,enabled:()=>true,provider:createLocalProviderManager({enabled:()=>true,adapter:createLocalAdapter(transport)}),leaseMs:1500,backoffMs:0});process.send?.({type:'complete',result});}
catch{process.send?.({type:'failure'});process.exitCode=1;}
finally{await db.close();process.disconnect?.();}

}
void main().catch(()=>{process.send?.({type:'failure'});process.exitCode=1;process.disconnect?.();});
