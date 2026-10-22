import {setTimeout as delay} from 'node:timers/promises';
import {envelopeId} from '../../packages/core/src/execution-envelope';

const retryScheduledReason='GEMINI_HTTP_503_RETRY_SCHEDULED';
const maximumRetryResumptions=50;

export type EnvelopeWorkerInvocation={mode:'once'|'watch';envelopeId?:string};
export type EnvelopeWorkerResult={status:string;envelopeId:string|null};
export type EnvelopeWorkerSnapshot={
 envelopeId:string;
 state:string;
 reason:unknown;
 availableAt:string;
 authorizationBlocked:string|null;
};

export function parseEnvelopeWorkerInvocation(args:string[]):EnvelopeWorkerInvocation{
 const [mode,...rest]=args;
 if(mode!=='once'&&mode!=='watch')throw new Error('Invalid worker mode.');
 if(rest.length===0)return {mode};
 if(mode!=='once'||rest.length!==2||rest[0]!=='--envelope-id')throw new Error('Invalid worker arguments.');
 const parsed=envelopeId.safeParse(rest[1]);
 if(!parsed.success)throw new Error('Invalid envelope ID.');
 return {mode,envelopeId:parsed.data};
}

export async function runEnvelopeWorkerUntilSettled(options:{
 envelopeId?:string;
 enabled:()=>boolean;
 signal:AbortSignal;
 runOnce:(envelopeId?:string)=>Promise<EnvelopeWorkerResult>;
 getWork:(envelopeId:string)=>Promise<EnvelopeWorkerSnapshot>;
 now?:()=>number;
 sleep?:(milliseconds:number,signal:AbortSignal)=>Promise<unknown>;
}):Promise<EnvelopeWorkerResult>{
 const now=options.now??Date.now;
 const sleep=options.sleep??((milliseconds,signal)=>delay(milliseconds,undefined,{signal}));
 let result=await options.runOnce(options.envelopeId);
 const target=options.envelopeId??result.envelopeId;
 let resumptions=0;

 while(target&&options.enabled()&&!options.signal.aborted){
  const work=await options.getWork(target);
  if(work.envelopeId!==target)throw new Error('Worker state envelope identity changed.');
  if(work.state!=='queued'||work.reason!==retryScheduledReason||work.authorizationBlocked)break;
  if(resumptions>=maximumRetryResumptions)break;
  const dueAt=Date.parse(work.availableAt);
  if(!Number.isFinite(dueAt))throw new Error('Worker retry schedule is invalid.');
  const waitMs=Math.max(0,dueAt-now());
  if(waitMs>0){
   try{await sleep(waitMs,options.signal);}
   catch(error){if(options.signal.aborted)break;throw error;}
  }
  if(!options.enabled()||options.signal.aborted)break;
  resumptions+=1;
  result=await options.runOnce(target);
 }
 return result;
}
