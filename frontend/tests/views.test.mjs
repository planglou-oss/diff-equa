import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/features/study/model.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {emptyStudy,parseStudy}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('reading position within hints and solution steps persists without changing self assessment',()=>{const s=emptyStudy();s.views['ee201-t01-q001']={original:true,explanation:true,help:true,hints:2,step:3};const restored=parseStudy(JSON.stringify(s));assert.deepEqual(restored,s);assert.deepEqual(restored.records,{})});
test('invalid reading progress is bounded when loading local data',()=>{const restored=parseStudy(JSON.stringify({version:1,views:{'ee201-t01-q001':{hints:1000,step:-3},bad:{hints:2}}}));assert.deepEqual(restored.views['ee201-t01-q001'],{original:false,explanation:false,help:false,hints:3,step:1});assert.equal(restored.views.bad,undefined)});
