import {loadEnvFile} from 'node:process';
import {randomUUID} from 'node:crypto';
import {setTimeout} from 'node:timers/promises';
import {createPostgresDatabase,checkDatabase} from '../packages/database/src';
import {createLocalProviderManager} from '../packages/core/src/provider-manager/service';
import {createGeminiProviderManager} from '../packages/core/src/provider-manager/gemini';
import {runEnvelopeWorkerOnce} from '../packages/core/src/envelope-worker/runner';
try{loadEnvFile('.env');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
// Delivery receipt verification belongs to the API process; do not retain its signing secret in workers.
delete process.env.RESEND_WEBHOOK_SECRET;
const shutdown=new AbortController();process.once('SIGINT',()=>shutdown.abort());process.once('SIGTERM',()=>shutdown.abort());
const enabled=()=>process.env.LEEOS_ENVELOPE_WORKER_ENABLED==='1';
const mode=process.argv[2],url=process.env.DATABASE_URL;
if(!['once','watch'].includes(mode)||process.argv.length!==3||!enabled()||!url||url.includes('REPLACE_WITH')){
 console.error('Use npm run worker:envelopes -- once|watch with DATABASE_URL and LEEOS_ENVELOPE_WORKER_ENABLED=1. No credentials logged.');process.exitCode=1;
}else{
 const db=createPostgresDatabase(url),id='worker_'+randomUUID().replaceAll('-','');
 const localProvider=createLocalProviderManager({enabled:()=>enabled()&&process.env.LEEOS_LOCAL_PROVIDER_ENABLED==='1'&&process.env.LEEOS_LOCAL_PROVIDER_LOCAL_ONLY==='1'});
 const geminiProvider=createGeminiProviderManager({enabled:()=>enabled()&&process.env.LEEOS_GEMINI_PROVIDER_ENABLED==='1'&&Boolean(process.env.GEMINI_API_KEY&&process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON)});
 const provider={forProvider(providerId:string){if(providerId==='llamacpp-local')return localProvider;if(providerId==='gemini')return geminiProvider;throw Error('Unsupported pinned provider.');}};
 try{
  if((await checkDatabase(db)).status!=='ready')throw Error('Migrations required');
  console.log('Independent envelope worker started. Human reviews stay explicit; uncertain calls are never retried.');
  do{
   try{const result=await runEnvelopeWorkerOnce(db,{workerId:id,enabled,provider,signal:shutdown.signal,artifactStorageEnabled:()=>process.env.LEEOS_ARTIFACT_STORAGE_ENABLED==='1'});if(mode==='once'||result.envelopeId)console.log(JSON.stringify(result));}
   catch{if(!shutdown.signal.aborted)console.error('Worker cycle failed. Accepted work remains stored; inspect work and provider recovery state. No credentials or inputs logged.');if(mode==='once')process.exitCode=1;}
   if(mode==='once'||shutdown.signal.aborted)break;
   await setTimeout(1000,undefined,{signal:shutdown.signal}).catch(()=>undefined);
  }while(enabled()&&!shutdown.signal.aborted);
 }catch{console.error('Worker could not start. Check database availability, current migrations and opt-in flags. No credentials logged.');process.exitCode=1;}
 finally{await db.close();}
}
