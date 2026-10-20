import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { parseEnv } from 'node:util';
import { configureLocalApi } from '../scripts/lib/api-config';
test('API setup preserves database configuration, matches private tokens, refuses overwrite, and rolls back partial setup',async()=>{
 const parent=resolve('.leeos/tests');await mkdir(parent,{recursive:true});const root=await mkdtemp(join(parent,'api-config-'));
 try{
  await mkdir(join(root,'apps','hub'),{recursive:true});
  const original='DATABASE_URL=postgresql://fixture-only@127.0.0.1:5432/example'+String.fromCharCode(10);
  await writeFile(join(root,'.env'),original);await writeFile(join(root,'apps','hub','.env.local'),original);
  await configureLocalApi(root,'http://127.0.0.1:3000');
  const text=await readFile(join(root,'.env'),'utf8');const settings=parseEnv(text);const hub=parseEnv(await readFile(join(root,'apps','hub','.env.local'),'utf8'));
  assert.equal(settings.DATABASE_URL,parseEnv(original).DATABASE_URL);assert.ok(settings.LEEOS_API_TOKEN);assert.match(settings.LEEOS_API_TOKEN,/^[0-9a-f]{64}$/);assert.equal(hub.LEEOS_API_TOKEN,settings.LEEOS_API_TOKEN);
  await assert.rejects(configureLocalApi(root,'http://127.0.0.1:3000'),/already exists/);assert.equal(await readFile(join(root,'.env'),'utf8'),text);
  const partial=join(root,'partial');await mkdir(partial);await writeFile(join(partial,'.env'),original);
  await assert.rejects(configureLocalApi(partial,'http://127.0.0.1:3000'));assert.equal(await readFile(join(partial,'.env'),'utf8'),original);
 }finally{if(!root.startsWith(parent+sep))throw new Error('Unsafe test cleanup');await rm(root,{recursive:true,force:true});}
});
