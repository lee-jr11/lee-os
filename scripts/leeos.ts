import { loadEnvFile } from 'node:process';
import { readFile, stat } from 'node:fs/promises';
import { localOrigin } from '../packages/core/src/api/auth';
import { maxBodyBytes } from '../packages/core/src/api/body';
try { loadEnvFile('.env'); } catch(error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
try {
 const [method,path,flag,file,...extra]=process.argv.slice(2);
 if (!['GET','POST','PATCH'].includes(method) || !path?.startsWith('/') || path.startsWith('//') || extra.length || (flag !== undefined && (flag !== '--json-file' || !file)) || (method === 'GET' && flag)) throw new Error('Use leeos GET /projects or leeos POST /projects --json-file path/to/request.json.');
 const token=process.env.LEEOS_API_TOKEN;
 if (!token || !/^[0-9a-f]{64}$/.test(token)) throw new Error('Run npm run api:configure before using the owner API.');
 const origin=localOrigin(process.env.LEEOS_API_ORIGIN ?? 'http://127.0.0.1:3000');
 const url=new URL(`/api/v1${path}`,origin);
 if (url.origin !== origin || url.hash) throw new Error('Only local API paths are supported.');
 let body: string | undefined;
 if (file) { if ((await stat(file)).size > maxBodyBytes) throw new Error('Request files are limited to 64 KiB.'); body=await readFile(file,'utf8'); JSON.parse(body); }
 const response=await fetch(url,{method,redirect:'error',signal:AbortSignal.timeout(45000),headers:{Authorization:`Bearer ${token}`,...(body !== undefined ? {'Content-Type':'application/json'} : {})},body});
 console.log(JSON.stringify(await response.json(),null,2));
 if (!response.ok) process.exitCode=1;
} catch { console.error('LeeOS request failed. Check the local origin, owner credentials, request file, and whether the Hub is running. No credentials logged.'); process.exitCode=1; }
