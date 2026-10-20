import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, rename, unlink, mkdir, open } from 'node:fs/promises';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { localOrigin } from '../../packages/core/src/api/auth';
async function replacePrivateFile(path: string,contents: string) {
 const temporary=`${path}.${randomUUID()}.tmp`;
 try {
  const file=await open(temporary,'wx',0o600);
  try { await file.writeFile(contents); await file.sync(); } finally { await file.close(); }
  await rename(temporary,path);
 } finally { await unlink(temporary).catch(() => undefined); }
}
export async function configureLocalApi(root: string, originValue: string) {
 const origin=localOrigin(originValue); const lockPath=join(root,'.leeos','api-config.lock');
 await mkdir(join(root,'.leeos'),{recursive:true});
 const lock=await open(lockPath,'wx');
 try {
  const files=[join(root,'.env'),join(root,'apps','hub','.env.local')];
  const originals=await Promise.all(files.map(async path => { try { return await readFile(path,'utf8'); } catch(error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; return null; } }));
  for (const text of originals) if (text !== null && parseEnv(text).LEEOS_API_TOKEN !== undefined) throw new Error('An owner API token already exists. No credentials were changed.');
  for (const text of originals) if (text !== null && parseEnv(text).LEEOS_API_ORIGIN !== undefined) throw new Error('An API origin already exists. Configure both API values manually without replacing database settings.');
  const token=randomBytes(32).toString('hex');
  const contents=originals.map(text => `${text ?? ''}${text && !text.endsWith('\n') ? '\n' : ''}LEEOS_API_TOKEN=${token}\nLEEOS_API_ORIGIN=${origin}\n`);
  let written=0;
  try {
   for (let i=0;i<files.length;i++) { await replacePrivateFile(files[i],contents[i]); written++; }
  } catch(error) {
   for (let i=0;i<written;i++) { if (originals[i] === null) await unlink(files[i]); else await replacePrivateFile(files[i],originals[i]!); }
   throw error;
  }
 } finally { await lock.close(); await unlink(lockPath); }
}
