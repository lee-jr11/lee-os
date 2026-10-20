export class OwnerApiError extends Error {
 constructor(public status:number,public code:string){
  const messages:Record<string,string>={ENVELOPE_BLOCKED:'Preview and review a fully specified, supported execution envelope before accepting it.',COORDINATION_DISABLED:'Coordination polling is disabled in the server settings.',API_DISABLED:'Local owner access is not configured at this address yet.',UNAUTHORIZED:'The owner key was not accepted. Reconnect with the correct key.',ORIGIN_REJECTED:'Open the Hub at its configured local address.',STATE_CONFLICT:'Something changed. Refresh and review the current state before trying again.',JOB_EXECUTION_DISABLED:'Local job execution is disabled in the server settings.',LOCAL_PROVIDER_DISABLED:'The local model connection is disabled.',LOCAL_PROVIDER_BUSY:'The local model slot is occupied or needs recovery.',STORAGE_NOT_READY:'The database needs its current migrations.',STORAGE_NOT_CONFIGURED:'The local database is not configured.',STORAGE_UNAVAILABLE:'The database is unavailable.',INVALID_REQUEST:'Check the request fields and supported limits.',CONNECTION_LOST:'Connection interrupted. The server may have saved the action. Reconnect and inspect saved work before repeating it.',RESPONSE_UNREADABLE:'The reply could not be read. Inspect saved work before repeating the action.',NOT_FOUND:'No saved record was found.'};
  super(messages[code]??'The action could not be completed. Refresh to inspect its saved state before retrying.');
 }
}
// The key exists only in this connection instance. Never persist it or attach it to URLs.
export class OwnerClient {
 #token:string;#origin:string;#closed=false;#pending=new Set<AbortController>();
 constructor(origin:string,token:string,private transport:typeof fetch=fetch){
  const url=new URL(origin);
  if(!['http:','https:'].includes(url.protocol)||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.username||url.password||url.pathname!=='/'||url.search||url.hash||!/^[a-f0-9]{64}$/.test(token))throw new OwnerApiError(400,'INVALID_REQUEST');
  this.#origin=url.origin;this.#token=token;this.transport=transport.bind(globalThis);
 }
 close(){this.#closed=true;this.#token='';for(const c of this.#pending)c.abort();this.#pending.clear();}
 async call<T>(method:'GET'|'POST'|'PATCH',path:string,body?:unknown):Promise<T>{
  if(this.#closed)throw new OwnerApiError(401,'UNAUTHORIZED');
  if(!path.startsWith('/')||path.startsWith('//')||/[\\#]/.test(path)||path.split('?')[0].split('/').includes('..'))throw new OwnerApiError(400,'INVALID_REQUEST');
  const url=new URL('/api/v1'+path,this.#origin);if(url.origin!==this.#origin||!url.pathname.startsWith('/api/v1/'))throw new OwnerApiError(400,'INVALID_REQUEST');
  const controller=new AbortController();this.#pending.add(controller);const timeout=setTimeout(()=>controller.abort(),45000);
  try{
   const response=await this.transport(url.toString(),{method,headers:{Authorization:`Bearer ${this.#token}`,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal});
   let envelope;try{envelope=await response.json();}catch{throw new OwnerApiError(response.status,'RESPONSE_UNREADABLE');}
   if(!response.ok)throw new OwnerApiError(response.status,typeof envelope.error?.code==='string'?envelope.error.code:'REQUEST_FAILED');
   if(this.#closed)throw new OwnerApiError(401,'UNAUTHORIZED');
   return envelope.data as T;
  }catch(error){if(this.#closed)throw new OwnerApiError(401,'UNAUTHORIZED');if(error instanceof OwnerApiError)throw error;throw new OwnerApiError(0,'CONNECTION_LOST');}finally{clearTimeout(timeout);this.#pending.delete(controller);}
 }
}
