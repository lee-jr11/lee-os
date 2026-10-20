import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workflow = readFileSync(resolve('.github/workflows/remote-envelope-worker.yml'), 'utf8');

test('remote worker requires an explicit opt-in in addition to its database credential', () => {
 assert.match(workflow, /LEEOS_REMOTE_WORKER_ENABLED:\s*\$\{\{\s*vars\.LEEOS_REMOTE_WORKER_ENABLED\s*\}\}/);
 assert.match(workflow, /\[\[ -n "\$DATABASE_URL" && "\$LEEOS_REMOTE_WORKER_ENABLED" == "1" \]\]/);
});

test('remote polling leaves an autosuspend window between scheduled runs', () => {
 assert.match(workflow, /cron:\s*'\*\/15 \* \* \* \*'/);
});

test('remote Gemini requires an explicit opt-in in addition to both credentials', () => {
 assert.match(workflow, /LEEOS_GEMINI_PROVIDER_ENABLED:\s*\$\{\{\s*vars\.LEEOS_GEMINI_PROVIDER_ENABLED\s*\}\}/);
 assert.match(workflow, /\[\[ "\$LEEOS_GEMINI_PROVIDER_ENABLED" == "1" && -n "\$GEMINI_API_KEY" && -n "\$GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON" \]\]/);
});
