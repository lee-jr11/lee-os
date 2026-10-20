import { loadEnvFile } from 'node:process';
import { randomUUID } from 'node:crypto';
import { localOrigin } from '../packages/core/src/api/auth';
try{loadEnvFile('.env');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
try{
 const mode=process.argv[2];if(!['status','smoke'].includes(mode))throw Error();
 const token=process.env.LEEOS_API_TOKEN;if(!token||!/^[0-9a-f]{64}$/.test(token))throw Error();
 const origin=localOrigin(process.env.LEEOS_API_ORIGIN??'http://127.0.0.1:3000');
 const response=await fetch(origin+'/api/v1/providers/local'+(mode==='smoke'?'/calls':''),{method:mode==='smoke'?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(45000),
  headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:mode==='smoke'?JSON.stringify({prompt:'Once upon a time',maxOutputTokens:32,idempotencyKey:'smoke-'+randomUUID()}):undefined});
 const value=await response.json();console.log(JSON.stringify(value,null,2));
 if(!response.ok||(mode==='smoke'&&value.data?.status!=='succeeded'))process.exitCode=1;
}catch{console.error('Local provider check failed. Check owner API setup, opt-in flags, local server and database. No credentials logged.');process.exitCode=1;}
