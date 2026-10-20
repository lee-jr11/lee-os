import test from 'node:test';
import assert from 'node:assert/strict';
import { setupStatus } from '../apps/hub/lib/setup-status';
import { GET } from '../apps/hub/app/api/setup/route';
test('setup status distinguishes missing, incomplete, invalid and configured local owner settings',()=>{
 const host='127.0.0.1:3102',protocol='http:';const token='a'.repeat(64),base={LEEOS_API_TOKEN:token,LEEOS_API_ORIGIN:'http://127.0.0.1:3102'};
 assert.equal(setupStatus({},host,protocol).ownerAccess,'not-configured');assert.equal(setupStatus({LEEOS_API_TOKEN:token},host,protocol).ownerAccess,'incomplete');
 for(const origin of ['https://example.com','http://user:password@localhost','http://localhost/path','http://localhost/?secret=value','not-a-url'])assert.equal(setupStatus({...base,LEEOS_API_ORIGIN:origin},host,protocol).ownerAccess,'invalid');
 assert.equal(setupStatus({...base,LEEOS_API_TOKEN:'bad'},host,protocol).ownerAccess,'invalid');
 assert.equal(setupStatus(base,host,protocol).ownerAccess,'configured');assert.equal(setupStatus(base,host,protocol).originMatches,true);assert.equal(setupStatus(base,'localhost:3102',protocol).originMatches,false);assert.equal(setupStatus(base,host,'https:').originMatches,false);
});
test('setup diagnostics expose states only and do not turn configuration into readiness or permission',()=>{
 const env={DATABASE_URL:'postgresql://private:secret@localhost/private',LEEOS_API_TOKEN:'a'.repeat(64),LEEOS_API_ORIGIN:'http://127.0.0.1:3102',LEEOS_COORDINATION_ENABLED:'1',LEEOS_JOB_EXECUTION_ENABLED:'true',LEEOS_LOCAL_PROVIDER_ENABLED:'1',LEEOS_LOCAL_PROVIDER_LOCAL_ONLY:'0',UNRELATED_SECRET:'private-value'};
 const result=setupStatus(env,'127.0.0.1:3102','http:');assert.equal(result.databaseConfigured,true);assert.equal(result.jobExecutionEnabled,false);assert.equal(result.coordinationEnabled,true);assert.equal(result.localProviderEnabled,true);assert.equal(result.localOnlyAcknowledged,false);
 assert.deepEqual(Object.keys(result).sort(),['databaseConfigured','ownerAccess','originMatches','coordinationEnabled','jobExecutionEnabled','localProviderEnabled','localOnlyAcknowledged'].sort());
 for(const secret of [env.DATABASE_URL,env.LEEOS_API_TOKEN,env.LEEOS_API_ORIGIN,env.UNRELATED_SECRET])assert.ok(!JSON.stringify(result).includes(secret));
});
test('public setup route is no-store and does not echo host or credential values',async()=>{
 const response=GET(new Request('http://localhost:3102/api/setup',{headers:{host:'untrusted-private-host'}}));assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');const body=await response.text();assert.ok(!body.includes('untrusted-private-host'));assert.ok(!body.includes('DATABASE_URL'));assert.ok(!body.includes('LEEOS_API_TOKEN'));
});
