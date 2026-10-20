export type SetupReport={databaseConfigured:boolean;ownerAccess:'not-configured'|'incomplete'|'invalid'|'configured';originMatches:boolean|null;coordinationEnabled:boolean;jobExecutionEnabled:boolean;localProviderEnabled:boolean;localOnlyAcknowledged:boolean};
export function setupStatus(env:Record<string,string|undefined>,host:string,protocol:string):SetupReport{
 const token=env.LEEOS_API_TOKEN,origin=env.LEEOS_API_ORIGIN;let validOrigin=false,originMatches:boolean|null=null;
 if(origin){try{const u=new URL(origin);validOrigin=['http:','https:'].includes(u.protocol)&&['127.0.0.1','localhost','[::1]'].includes(u.hostname)&&!u.username&&!u.password&&u.pathname==='/'&&!u.search&&!u.hash;if(validOrigin)originMatches=u.host===host&&u.protocol===protocol;}catch{/* Report only a bounded status. */}}
 const ownerAccess=!token&&!origin?'not-configured':!token||!origin?'incomplete':!/^[a-f0-9]{64}$/.test(token)||!validOrigin?'invalid':'configured';
 return {databaseConfigured:Boolean(env.DATABASE_URL),ownerAccess,originMatches,coordinationEnabled:env.LEEOS_COORDINATION_ENABLED==='1',jobExecutionEnabled:env.LEEOS_JOB_EXECUTION_ENABLED==='1',localProviderEnabled:env.LEEOS_LOCAL_PROVIDER_ENABLED==='1',localOnlyAcknowledged:env.LEEOS_LOCAL_PROVIDER_LOCAL_ONLY==='1'};
}
