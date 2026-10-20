import { setupStatus } from '../../../lib/setup-status';
export const runtime='nodejs';
export const dynamic='force-dynamic';
// Public diagnostics expose configuration states only, never credential values.
export function GET(request:Request){return Response.json(setupStatus(process.env,request.headers.get('host')??'',new URL(request.url).protocol),{headers:{'Cache-Control':'no-store'}});}
