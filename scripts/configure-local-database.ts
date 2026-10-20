import { randomBytes } from 'node:crypto';
import { access, writeFile, unlink } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const targets = [new URL('.env', root), new URL('apps/hub/.env.local', root)];
for (const target of targets) {
 const exists = await access(target).then(() => true, () => false);
 if (exists) throw new Error('A local environment file already exists. Update it manually; nothing was overwritten.');
}
const password = randomBytes(32).toString('hex');
const connection = `postgresql://leeos:${password}@127.0.0.1:5432/leeos`;
await writeFile(targets[0], `POSTGRES_USER=leeos\nPOSTGRES_DB=leeos\nPOSTGRES_PASSWORD=${password}\nDATABASE_URL=${connection}\n`, { flag: 'wx', mode: 0o600 });
try { await writeFile(targets[1], `DATABASE_URL=${connection}\nNEXT_TELEMETRY_DISABLED=1\n`, { flag: 'wx', mode: 0o600 }); }
catch (error) { await unlink(targets[0]); throw error; }
console.log('Created ignored local environment files with a random local database password. No credentials printed.');
