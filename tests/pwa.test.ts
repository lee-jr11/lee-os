import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import manifest from '../apps/hub/app/manifest';
const source=readFileSync(new URL('../apps/hub/public/sw.js',import.meta.url),'utf8');
function harness(){
 const listeners:Record<string,(event:Record<string,unknown>)=>void>={};const writes:string[]=[],deleted:string[]=[],network:string[]=[];let cached:Response|undefined=new Response('static offline');let fail=false;let status=200;
 const context={Request,Response,URL,self:{location:{origin:'http://localhost:3102'},addEventListener:(name:string,handler:typeof listeners[string])=>{listeners[name]=handler;}},caches:{open:async(name:string)=>({add:async(request:Request)=>{writes.push(name+':'+request.url);},match:async()=>cached}),keys:async()=>['leeos-shell-v1','leeos-shell-v14','unrelated-cache'],delete:async(name:string)=>{deleted.push(name);return true;}},fetch:async(request:Request)=>{network.push(request.url);if(fail)throw new Error('disconnected');return new Response('network',{status});}};
 // Request uses absolute URLs in Node; the browser resolves the fixed relative offline path.
 class BrowserRequest extends Request{constructor(input:string,init?:RequestInit){super(new URL(input,'http://localhost:3102'),init);}}
 vm.runInNewContext(source,{...context,Request:BrowserRequest});
 return {listeners,writes,deleted,network,setFailure:()=>{fail=true;},setHttpError:()=>{status=503;},clearCache:()=>{cached=undefined;}};
}
test('PWA manifest has a stable same-origin identity and required icons',()=>{
 const m=manifest();assert.equal(m.id,'/');assert.equal(m.start_url,'/');assert.equal(m.scope,'/');assert.equal(m.display,'standalone');
 for(const icon of m.icons??[]){const bytes=readFileSync(new URL('../apps/hub/public'+icon.src,import.meta.url));assert.equal(bytes.readUInt32BE(16),Number(icon.sizes?.split('x')[0]));}
});
test('worker caches only static help and deletes only older owned caches',async()=>{
 const h=harness();let pending:Promise<unknown>|undefined;h.listeners.install({waitUntil:(p:Promise<unknown>)=>{pending=p;}});await pending;
 assert.deepEqual(h.writes,['leeos-shell-v14:http://localhost:3102/offline.html']);
 h.listeners.activate({waitUntil:(p:Promise<unknown>)=>{pending=p;}});await pending;assert.deepEqual(h.deleted,['leeos-shell-v1']);
});
test('worker never intercepts API, mutation, assets or cross-origin requests',()=>{
 const h=harness();for(const [url,method,mode] of [['http://localhost:3102/api/v1/system','GET','navigate'],['http://localhost:3102/api','GET','navigate'],['http://localhost:3102/','POST','navigate'],['http://localhost:3102/sw.js','GET','same-origin'],['https://example.com/','GET','navigate']]){
  let intercepted=false;h.listeners.fetch({request:{url,method,mode},respondWith:()=>{intercepted=true;}});assert.equal(intercepted,false);
 }assert.deepEqual(h.writes,[]);assert.deepEqual(h.network,[]);
});
test('navigation uses network first and static fallback only on transport failure',async()=>{
 const h=harness();let reply:Promise<Response>|undefined;const event={request:{url:'http://localhost:3102/',method:'GET',mode:'navigate'},respondWith:(p:Promise<Response>)=>{reply=p;}};
 h.listeners.fetch(event);assert.equal(await (await reply!).text(),'network');assert.deepEqual(h.writes,[]);
 h.setHttpError();h.listeners.fetch(event);assert.equal((await reply!).status,503);
 h.setFailure();h.listeners.fetch(event);assert.equal(await (await reply!).text(),'static offline');
 h.clearCache();h.listeners.fetch(event);assert.equal((await reply!).status,503);assert.deepEqual(h.writes,[]);
});

