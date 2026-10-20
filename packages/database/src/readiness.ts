import type { SqlSession } from './types';
export const expectedMigrations = ['001_state.sql','002_plans.sql','003_preparations.sql','004_agent_assignments.sql','005_local_provider.sql','006_job_execution.sql','007_coordination.sql','008_request_intake.sql','009_requirements.sql','010_execution_envelopes.sql','011_envelope_workers.sql','012_remote_gemini.sql','013_artifact_storage.sql','014_docx_operations.sql','015_email_effect_receipts.sql','016_calendar_scheduling.sql','017_lifecycle_memory.sql'];
export const latestMigration = expectedMigrations.at(-1)!;
export async function checkDatabase(db: SqlSession): Promise<{ status: 'ready' | 'migration-required' | 'unavailable' }> {
 try {
  await db.query('SELECT 1');
  const result = await db.query<{ name: string }>('SELECT name FROM schema_migrations ORDER BY name');
  return { status: result.rows.length === expectedMigrations.length && result.rows.every((row,i)=>row.name===expectedMigrations[i]) ? 'ready' : 'migration-required' };
 } catch (error) {
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === '42P01') return { status: 'migration-required' };
  return { status: 'unavailable' };
 }
}
