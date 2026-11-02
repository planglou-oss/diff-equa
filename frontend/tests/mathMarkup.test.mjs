import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/lib/mathMarkup.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {protectMathMarkup}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('LaTeX comparisons survive HTML parsing without changing surrounding markup',()=>{
 const result=protectMathMarkup('<p>โจทย์ $0<x<1$ และ $$a&=b>c$$</p>');
 assert.equal(result,'<p>โจทย์ $0&lt;x&lt;1$ และ $$a&amp;=b&gt;c$$</p>');
 assert.equal(protectMathMarkup(result),result);
 assert.equal(protectMathMarkup('<b>note</b>'),'\x3cb>note</b>');
});
