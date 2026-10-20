import { timingSafeEqual } from 'node:crypto';
import { ApiError } from './errors';
export function localOrigin(value: string): string {
 try {
  const url = new URL(value);
  if (!['http:','https:'].includes(url.protocol) || !['127.0.0.1','localhost','[::1]'].includes(url.hostname) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error();
  return url.origin;
 } catch { throw new ApiError(503,'API_DISABLED','Configure a loopback API origin first.'); }
}
export function authorize(request: Request, token: string | undefined, origin: string): void {
 if (!token || !/^[0-9a-f]{64}$/.test(token)) throw new ApiError(503,'API_DISABLED','Configure the local owner API token first.');
 const expected = new URL(localOrigin(origin));
 const actual = new URL(request.url);
 // NextRequest normalizes loopback URL hostnames to localhost. Keep exact Host/Origin checks.
 const localTransport = ['127.0.0.1','localhost','[::1]'].includes(actual.hostname) && actual.protocol === expected.protocol && actual.port === expected.port;
 if (!localTransport || request.headers.get('host') !== expected.host || (request.headers.has('origin') && request.headers.get('origin') !== expected.origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
  throw new ApiError(403,'ORIGIN_REJECTED','This API accepts requests only for its configured local origin.');
 }
 const candidate = /^Bearer ([0-9a-f]{64})$/i.exec(request.headers.get('authorization') ?? '')?.[1];
 if (!candidate || !timingSafeEqual(Buffer.from(candidate),Buffer.from(token))) throw new ApiError(401,'UNAUTHORIZED','An owner bearer token is required.');
}
