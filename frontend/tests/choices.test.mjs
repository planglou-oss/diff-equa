import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/features/study/choiceModel.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {choiceToken,selectedChoice}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('a saved selection refers to an option ID and key version, not a displayed letter',()=>{
 const set={available:true,version:'version-1',options:[{id:'one',latex:'a'},{id:'two',latex:'b'}]};
 const answer=choiceToken(set.version,'two');
 assert.equal(selectedChoice(set,answer),'two');
 assert.equal(selectedChoice({...set,options:[...set.options].reverse()},answer),'two');
 assert.equal(selectedChoice({...set,version:'version-2'},answer),undefined);
 assert.equal(selectedChoice(set,'handwritten legacy answer'),undefined);
 assert.equal(selectedChoice(set,'mcq:version-1:forged'),undefined);
 assert.equal(selectedChoice({available:false},answer),undefined);
});
