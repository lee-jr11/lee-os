import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import * as React from 'react';
import Home from '../apps/hub/app/page';

test('Home distinguishes installed code from live service readiness without probing services',()=>{
 // The standalone TSX harness uses classic JSX for Next's preserved-JSX sources.
 const runtime=globalThis as typeof globalThis & {React?:typeof React};
 const priorReact=runtime.React;runtime.React=React;
 const saved={DATABASE_URL:process.env.DATABASE_URL,LEEOS_API_TOKEN:process.env.LEEOS_API_TOKEN,LEEOS_API_ORIGIN:process.env.LEEOS_API_ORIGIN};
 try{
  for(const key of Object.keys(saved))delete process.env[key];
  const html=renderToStaticMarkup(Home());
  assert.match(html,/Local foundation/);
  assert.match(html,/Check local setup for live readiness/);
  assert.doesNotMatch(html,/Foundation ready|Hub and core are connected/);
  assert.match(html,/Check configuration|Local setup and everyday operation/);
  assert.match(html,/planned/);
 }finally{
  for(const [key,value] of Object.entries(saved)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
  if(priorReact===undefined)Reflect.deleteProperty(runtime,'React');else runtime.React=priorReact;
 }
});
