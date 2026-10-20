import { fileURLToPath } from 'node:url';
import { configureLocalApi } from './lib/api-config';
const args=process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--origin')) throw new Error('Use api:configure, optionally with --origin http://127.0.0.1:3000.');
try {
 await configureLocalApi(fileURLToPath(new URL('../',import.meta.url)),args[1] ?? 'http://127.0.0.1:3000');
 console.log('Configured matching private owner API credentials in the ignored root and Hub environment files. No token printed. Restart the Hub before use.');
} catch { console.error('API setup failed. Check for existing API values, a stale .leeos/api-config.lock, or invalid local origin. Existing credentials are not replaced.'); process.exitCode=1; }
