import { createLocalProviderManager } from '@leeos/core/provider-manager';
import {createGeminiProviderManager} from '@leeos/core/provider-manager';
import { handleCoreRequest, ApiError } from '@leeos/core/api';
import { createPostgresDatabase, checkDatabase, type StateDatabase } from '@leeos/database';
// One bounded connection pool per server module; never export it to client code.
const localProvider=createLocalProviderManager({enabled:()=>process.env.LEEOS_LOCAL_PROVIDER_ENABLED==='1'&&process.env.LEEOS_LOCAL_PROVIDER_LOCAL_ONLY==='1'});
const geminiProvider=createGeminiProviderManager({enabled:()=>process.env.LEEOS_GEMINI_PROVIDER_ENABLED==='1'&&Boolean(process.env.GEMINI_API_KEY&&process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON)});
let database: { url: string; db: StateDatabase } | undefined;
export async function coreApi(request: Request) {
 return handleCoreRequest(request,{
  token:process.env.LEEOS_API_TOKEN,
  localProvider,
  geminiProvider,
  artifactStorageEnabled:()=>process.env.LEEOS_ARTIFACT_STORAGE_ENABLED==='1',
  coordinationEnabled:()=>process.env.LEEOS_COORDINATION_ENABLED==='1',
  jobExecutionEnabled:()=>process.env.LEEOS_JOB_EXECUTION_ENABLED==='1',
  origin:process.env.LEEOS_API_ORIGIN ?? 'http://127.0.0.1:3000',
  async database() {
   const url=process.env.DATABASE_URL;
   if (!url) throw new ApiError(503,'STORAGE_NOT_CONFIGURED','Configure the LeeOS PostgreSQL database first.');
   if (database && database.url !== url) { await database.db.close(); database=undefined; }
   database ??= { url,db:createPostgresDatabase(url) };
   const ready=await checkDatabase(database.db);
   if (ready.status !== 'ready') throw new ApiError(503,'STORAGE_NOT_READY','The database must be available and migrated.');
   return database.db;
  }
 });
}
