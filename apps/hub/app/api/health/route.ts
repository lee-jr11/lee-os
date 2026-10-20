import { getSystemStatus } from '@leeos/core';
export const dynamic = 'force-dynamic';
export function GET() { return Response.json(getSystemStatus(), { headers: { 'Cache-Control': 'no-store' } }); }
