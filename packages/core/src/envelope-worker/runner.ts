import type {StateDatabase} from '@leeos/database';
import type {EnvelopeProviderManager} from '../provider-manager';
import {createEnvelopeWorkerStore,LeaseLost,type EnvelopeEmailDelivery} from './store';
import {workerId} from './index';
// This lifecycle belongs to a standalone worker. Never pass an HTTP request's
// abort signal here; shutdown is controlled by the worker process itself.
export async function runEnvelopeWorkerOnce(db:StateDatabase,options:{workerId:string;enabled:()=>boolean;provider:EnvelopeProviderManager|{forProvider:(id:string)=>EnvelopeProviderManager};signal?:AbortSignal;leaseMs?:number;backoffMs?:number;artifactStorageEnabled?:()=>boolean;emailDelivery?:EnvelopeEmailDelivery;emailIdempotencyWindowMs?:number;envelopeId?:string}){
 workerId.parse(options.workerId);
 if(!options.enabled()||options.signal?.aborted)return {status:'disabled',envelopeId:null};
 const store=createEnvelopeWorkerStore(db,options);await store.reap();const claim=await store.claim(options.workerId,options.envelopeId);
 if(!claim)return {status:'idle',envelopeId:null};
 const abort=new AbortController(),shutdown=()=>abort.abort();options.signal?.addEventListener('abort',shutdown,{once:true});
 let stopped=false,renewal=Promise.resolve();
 const timer=setInterval(()=>{renewal=renewal.then(async()=>{if(stopped)return;try{if(!options.enabled())throw Error('Worker disabled');await store.heartbeat(claim);}catch{abort.abort();}});},Math.max(250,Math.floor(store.leaseMs/3)));
 try{
  while(!abort.signal.aborted&&options.enabled()){
   const result=await store.step(claim,options.provider,abort.signal);if(result!=='continue')break;
  }
  // Release only still-owned work. A recorded call will be reconciled by the
  // next cycle, never regenerated. Lost leases cannot be resurrected here.
  try{await store.release(claim,'WORKER_YIELDED');}catch{/* Terminal/waiting/lost ownership already has a durable state. */}
 }catch(error){
  if(!(error instanceof LeaseLost)){
   try{await store.release(claim,'WORKER_ERROR_RECHECK_REQUIRED');}catch{/* An expired/invalid claim is left for the reaper. */}
   throw error;
  }
 }finally{stopped=true;clearInterval(timer);options.signal?.removeEventListener('abort',shutdown);await renewal;}
 return {status:(await store.get(claim.envelopeId)).state,envelopeId:claim.envelopeId};
}
