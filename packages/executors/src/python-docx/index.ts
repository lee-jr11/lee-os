import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {z} from 'zod';

export const docxMaxBytes=10*1024*1024;
export const docxInputMaxBytes=8192;
export const docxFontFamily='Times New Roman';
export const docxBodyFontSizePt=12;
const text=z.string().min(1).max(docxInputMaxBytes).refine(value=>Buffer.byteLength(value,'utf8')<=docxInputMaxBytes);
export const docxDocumentSchema=z.strictObject({title:text,sections:z.array(z.strictObject({heading:text,paragraphs:z.array(text).min(1).max(40)})).min(1).max(30)}).superRefine((value,ctx)=>{
 const size=Buffer.byteLength(value.title,'utf8')+value.sections.reduce((sum,section)=>sum+Buffer.byteLength(section.heading,'utf8')+section.paragraphs.reduce((n,p)=>n+Buffer.byteLength(p,'utf8'),0),0);
 if(size>docxInputMaxBytes)ctx.addIssue({code:'custom',message:'The complete document input exceeds its byte limit.'});
});
export type DocxDocument=z.infer<typeof docxDocumentSchema>;
export interface DocxValidationReport{schemaVersion:1;validator:'leeos-docx-validator-1';format:'docx';readable:true;contentMatches:true;fontFamily:'Times New Roman';bodyFontSizePt:12;paragraphCount:number;sha256:string;bytes:number}
export class PythonDocxError extends Error{
 constructor(readonly code:'PYTHON_DOCX_UNAVAILABLE'|'DOCX_GENERATION_FAILED'|'DOCX_VALIDATION_FAILED'|'DOCX_PROCESS_TIMEOUT'|'DOCX_PROCESS_ABORTED'){
  super('The Python DOCX operation could not be completed.');this.name='PythonDocxError';
 }
}
const scriptDirectory=process.env.LEEOS_PYTHON_DOCX_DIRECTORY?.trim()||resolve(process.cwd(),'packages/executors/src/python-docx');
const generatorPath=resolve(scriptDirectory,'generate.py');
const validatorPath=resolve(scriptDirectory,'validate.py');
function pythonEnvironment():NodeJS.ProcessEnv{
 const env:NodeJS.ProcessEnv={NODE_ENV:process.env.NODE_ENV??'production',PYTHONUTF8:'1',PYTHONIOENCODING:'utf-8'};
 for(const key of ['PATH','SystemRoot','WINDIR','TEMP','TMP','APPDATA','LOCALAPPDATA','USERPROFILE','HOME'])if(process.env[key])env[key]=process.env[key];
 return env;
}
function execute(script:string,input:Uint8Array,outputLimit:number,signal?:AbortSignal):Promise<Buffer>{
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(new PythonDocxError('DOCX_PROCESS_ABORTED'));return;}
  const python=process.env.LEEOS_PYTHON_EXECUTABLE?.trim()||'python';
  const child=spawn(python,['-B',script],{windowsHide:true,stdio:['pipe','pipe','pipe'],env:pythonEnvironment()});
  const chunks:Buffer[]=[];let length=0,settled=false,timedOut=false,oversized=false;
  const timer=setTimeout(()=>{timedOut=true;child.kill();},30000);
  const abort=()=>child.kill();signal?.addEventListener('abort',abort,{once:true});
  child.stdout.on('data',(chunk:Buffer)=>{length+=chunk.length;if(length>outputLimit){oversized=true;child.kill();return;}chunks.push(Buffer.from(chunk));});
  child.stderr.resume();
  child.on('error',()=>finish(new PythonDocxError('PYTHON_DOCX_UNAVAILABLE')));
  child.on('close',code=>{
   if(timedOut)finish(new PythonDocxError('DOCX_PROCESS_TIMEOUT'));
   else if(signal?.aborted)finish(new PythonDocxError('DOCX_PROCESS_ABORTED'));
   else if(oversized)finish(new PythonDocxError('DOCX_GENERATION_FAILED'));
   else if(code===79)finish(new PythonDocxError('PYTHON_DOCX_UNAVAILABLE'));
   else if(code!==0)finish(new PythonDocxError('DOCX_GENERATION_FAILED'));
   else finish(null,Buffer.concat(chunks,length));
  });
  child.stdin.on('error',()=>undefined);
  child.stdin.end(Buffer.from(input));
  function finish(error:PythonDocxError|null,result?:Buffer){if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);if(error)reject(error);else resolve(result!);}
 });
}
export async function generateDocx(documentValue:unknown,signal?:AbortSignal):Promise<Uint8Array>{
 const document=docxDocumentSchema.parse(documentValue),bytes=await execute(generatorPath,Buffer.from(JSON.stringify(document)),docxMaxBytes,signal);
 if(bytes.length===0)throw new PythonDocxError('DOCX_GENERATION_FAILED');return bytes;
}
export async function validateDocx(bytesValue:Uint8Array,documentValue:unknown,signal?:AbortSignal):Promise<DocxValidationReport>{
 const document=docxDocumentSchema.parse(documentValue),bytes=Buffer.from(bytesValue);
 if(!bytes.length||bytes.length>docxMaxBytes)throw new PythonDocxError('DOCX_VALIDATION_FAILED');
 const payload=Buffer.from(JSON.stringify({document,docxBase64:bytes.toString('base64')}));
 let output:Buffer;try{output=await execute(validatorPath,payload,65536,signal);}catch(error){
  if(error instanceof PythonDocxError&&['DOCX_PROCESS_TIMEOUT','DOCX_PROCESS_ABORTED','PYTHON_DOCX_UNAVAILABLE'].includes(error.code))throw error;
  throw new PythonDocxError('DOCX_VALIDATION_FAILED');
 }
 try{
  const report=z.strictObject({schemaVersion:z.literal(1),validator:z.literal('leeos-docx-validator-1'),format:z.literal('docx'),readable:z.literal(true),contentMatches:z.literal(true),fontFamily:z.literal(docxFontFamily),bodyFontSizePt:z.literal(docxBodyFontSizePt),paragraphCount:z.number().int().min(1).max(1000),sha256:z.string().regex(/^[a-f0-9]{64}$/),bytes:z.number().int().min(1).max(docxMaxBytes)}).parse(JSON.parse(output.toString('utf8')));
  if(report.bytes!==bytes.length)throw new Error('Unexpected byte count.');return report;
 }catch{throw new PythonDocxError('DOCX_VALIDATION_FAILED');}
}
