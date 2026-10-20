import test from 'node:test';
import { createEmbeddedDatabase } from '../scripts/lib/embedded-database';
import { migrate } from '../packages/database/src/migrations';
import { exerciseAcceptance } from './helpers/acceptance-contract';
test('V1 local acceptance on embedded PostgreSQL',{timeout:120000},async t=>{const db=await createEmbeddedDatabase();try{await migrate(db);await exerciseAcceptance(db,t);}finally{await db.close();}});
