import { stat,readFile } from 'node:fs/promises';
import { loadEnvFile } from 'node:process';
import { interpretRequest,intakeCreate,intakeClarify,requestId } from '../packages/core/src/request-intake';
import { projectId } from '../packages/core/src/api/contracts';
import { localOrigin } from '../packages/core/src/api/auth';
try{
 const args=process.argv.slice(2),mode=args[0];
 if((mode==='preview'&&args.length!==2)||(['submit','clarify'].includes(mode)&&args.length!==4)||!['preview','submit','clarify'].includes(mode))throw Error();
 const file=mode==='preview'?args[1]:mode==='clarify'?args[3]:args[2];if((await stat(file)).size>8192)throw Error();
 const text=new TextDecoder('utf-8',{fatal:true}).decode(await readFile(file));
 if(mode==='preview')console.log(JSON.stringify(interpretRequest(text),null,2));
 else{
  const path=mode==='submit'?`/projects/${projectId.parse(args[1])}/requests`:`/requests/${requestId.parse(args[1])}/clarify`;
  if(mode==='clarify'&&!/^(0|[1-9]\d*)$/.test(args[2]))throw Error();
  const body=mode==='submit'?intakeCreate.parse({text,idempotencyKey:args[3]}):intakeClarify.parse({text,expectedVersion:Number(args[2])});
  try{loadEnvFile('.env');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  const token=process.env.LEEOS_API_TOKEN;if(!token||!/^[a-f0-9]{64}$/.test(token))throw Error();
  const origin=localOrigin(process.env.LEEOS_API_ORIGIN??'http://127.0.0.1:3000');
  const response=await fetch(origin+'/api/v1'+path,{method:'POST',redirect:'error',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  const value=await response.json();if(!response.ok)throw Error();console.log(JSON.stringify(value.data,null,2));
 }
}catch{console.error('Use request preview TEXT_FILE or request submit PROJECT_ID TEXT_FILE REQUEST_KEY or request clarify REQUEST_ID VERSION TEXT_FILE. Use UTF-8 text up to 4000 characters/8192 bytes and configure the local owner API for submit. No credentials logged.');process.exitCode=1;}
