import { ApiError, validationError } from './errors';
export const maxBodyBytes = 65536;
export async function readBinary(request:Request,maxBytes:number,timeoutMs=30000):Promise<Uint8Array>{
 const encoding=request.headers.get('content-encoding')??'';
 if(!['','identity'].includes(encoding.toLowerCase()))throw new ApiError(415,'CONTENT_ENCODING_UNSUPPORTED','Send unencoded artifact bytes.');
 const declared=request.headers.get('content-length');
 if(declared&&!/^\d+$/.test(declared))return validationError();
 if(declared&&Number(declared)>maxBytes)throw new ApiError(413,'ARTIFACT_TOO_LARGE','The artifact exceeds the configured per-file limit.');
 if(!request.body)return validationError();
 const reader=request.body.getReader(),chunks:Uint8Array[]=[];let size=0;const deadline=Date.now()+timeoutMs;
 try{
  while(true){
   let timer:ReturnType<typeof setTimeout>|undefined;
   const read=await Promise.race([reader.read(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new ApiError(408,'BODY_TIMEOUT','The artifact body took too long.')),Math.max(0,deadline-Date.now()));})]).finally(()=>clearTimeout(timer));
   if(read.done)break;size+=read.value.byteLength;
   if(size>maxBytes)throw new ApiError(413,'ARTIFACT_TOO_LARGE','The artifact exceeds the configured per-file limit.');
   chunks.push(read.value);
  }
 }finally{void reader.cancel().catch(()=>undefined);reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 return bytes;
}
export async function readJson(request: Request, timeoutMs = 5000): Promise<unknown> {
 const contentType = request.headers.get('content-type') ?? '';
 if (!/^application\/json(?:;\s*charset="?utf-8"?)?$/i.test(contentType) || !['identity',''].includes(request.headers.get('content-encoding') ?? '')) throw new ApiError(415,'JSON_REQUIRED','Send UTF-8 application/json without content encoding.');
 const declared = request.headers.get('content-length');
 if (declared && !/^\d+$/.test(declared)) return validationError();
 if (declared && Number(declared) > maxBodyBytes) throw new ApiError(413,'BODY_TOO_LARGE','JSON bodies are limited to 64 KiB.');
 if (!request.body) return validationError();
 const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
 const deadline = Date.now() + timeoutMs;
 try {
  while (true) {
   let timer: ReturnType<typeof setTimeout> | undefined;
   const read = await Promise.race([
    reader.read(),
    new Promise<never>((_,reject) => { timer = setTimeout(() => reject(new ApiError(408,'BODY_TIMEOUT','The request body took too long.')),Math.max(0,deadline-Date.now())); })
   ]).finally(() => clearTimeout(timer));
   if (read.done) break;
   size += read.value.byteLength;
   if (size > maxBodyBytes) throw new ApiError(413,'BODY_TOO_LARGE','JSON bodies are limited to 64 KiB.');
   chunks.push(read.value);
  }
 } finally { void reader.cancel().catch(() => undefined); reader.releaseLock(); }
 const bytes = new Uint8Array(size); let offset = 0;
 for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.length; }
 let value: unknown;
 try { value = JSON.parse(new TextDecoder('utf-8',{ fatal: true }).decode(bytes)); } catch { return validationError(); }
 // Bound validation work before recursive JSON schemas inspect arbitrary definitions.
 const pending: { value: unknown; depth: number }[] = [{ value, depth: 0 }]; let nodes = 0;
 while (pending.length) {
  const next = pending.pop()!;
  if (++nodes > 5000 || next.depth > 16) return validationError();
  if (next.value !== null && typeof next.value === 'object') for (const child of Object.values(next.value)) pending.push({ value: child, depth: next.depth+1 });
 }
 return value;
}
