import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretRequest } from '../packages/core/src/request-intake';
import { getSystemStatus } from '../packages/core/src';
test('compound implementation goals cannot silently become an ordinary text draft',()=>{
 for(const text of ['Draft a report and deploy it','Draft a report, deploy it','Draft a report. Deploy it','Draft a report & deploy it','Write a script and build it','Write code and test it','Draft a report and fix the workflow','Draft a report and monitor it','Draft a report and learn from failures']){
  const p=interpretRequest(text);assert.ok(p.questions.length,text);assert.equal(p.executionEnabled,false);assert.ok(p.questions.some(q=>q.includes('multiple outcomes')),text);
 }
});
test('clarification asks for business outcomes and inputs instead of owner-selected executors',()=>{
 for(const text of ['I want invoices automated','Build an automation for my reports','Write Python code']){
  const p=interpretRequest(text),questions=p.questions.join(' ');assert.ok(p.questions.length);assert.match(questions,/result|outcome/);assert.match(questions,/inputs|constraints/);assert.ok(!questions.includes('executor explicitly'));assert.ok(!questions.includes('start a text step'));
 }
 assert.equal(getSystemStatus().goalImplementation,'bounded-text-only');
});
test('text about implementation remains valid without claiming the implementation will run',()=>{
 for(const text of ['Draft a deployment guide','Write a test plan','Draft a build guide','Draft a monitoring checklist']){
  const p=interpretRequest(text);assert.equal(p.questions.length,0,text);assert.deepEqual(p.steps.map(s=>s.kind),['model','review']);assert.ok(p.warnings.some(w=>w.includes('not connected')));
 }
});
