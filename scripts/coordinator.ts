import { loadEnvFile } from 'node:process';
import { setTimeout } from 'node:timers/promises';
import { localOrigin } from '../packages/core/src/api/auth';
try{loadEnvFile('.env');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
const shutdown=new AbortController();
process.once('SIGINT',()=>shutdown.abort());process.once('SIGTERM',()=>shutdown.abort());
try{
 const mode=process.argv[2];if(!['once','watch'].includes(mode)||process.argv.length!==3)throw Error();
 const token=process.env.LEEOS_API_TOKEN;if(!token||!/^[a-f0-9]{64}$/.test(token))throw Error();
 const origin=localOrigin(process.env.LEEOS_API_ORIGIN??'http://127.0.0.1:3000');
 let failures=0;
 console.log(mode==='watch'?'Local coordination polling every 5 seconds. Queued runs still require owner review. Ctrl+C stops polling.':'Checking due schedules and undelivered events once.');
 do{
  try{
   const response=await fetch(origin+'/api/v1/coordinator/tick',{method:'POST',redirect:'error',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify({limit:10}),signal:AbortSignal.any([shutdown.signal,AbortSignal.timeout(15000)])});
   if(!response.ok)throw Error();
   const value=await response.json();failures=0;
   if(mode==='once'||value.data.schedules.length||value.data.events.length)console.log(JSON.stringify(value.data,null,2));
  }catch{
   if(shutdown.signal.aborted)break;
   console.error('Coordination poll failed. Check local API credentials, coordinator opt-in and database readiness. No credentials logged.');
   if(mode==='once'||++failures>=3){process.exitCode=1;break;}
  }
  if(mode==='once')break;
  await setTimeout(5000,undefined,{signal:shutdown.signal});
 }while(!shutdown.signal.aborted);
}catch{
 if(!shutdown.signal.aborted){console.error('Use coordinator once|watch after configuring the local owner API. No credentials logged.');process.exitCode=1;}
}
