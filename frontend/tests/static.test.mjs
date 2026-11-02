import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import ts from 'typescript';
const source=await readFile(new URL('../src/lib/staticClient.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {dispatchStatic,saveLocalReport,readLocalReports,REPORTS_KEY}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const data=JSON.parse(await readFile(new URL('../public/study/data.json',import.meta.url),'utf8'));
const request=(path,input)=>dispatchStatic(data,path,input===undefined?{}:{method:'POST',body:JSON.stringify(input)},()=>0.3);

test('all questions survive sorting before pagination, including stable ties',()=>{
 for(const order of ['default','year_asc','year_desc']){
  const all=Array.from({length:5},(_,i)=>request(`/questions?sort=${order}&pageSize=100&page=${i+1}`).items).flat();
  assert.equal(all.length,427);assert.equal(new Set(all.map(q=>q.id)).size,427);
  for(let i=1;i<all.length;i++){
   const a=all[i-1],b=all[i];
   if(order==='year_asc')assert.ok(a.year<=b.year);
   if(order==='year_desc')assert.ok(a.year>=b.year);
   if(order==='default'||a.year===b.year)assert.ok(a.topicId<b.topicId||(a.topicId===b.topicId&&a.displayNumber<=b.displayNumber));
  }
 }
});
test('combined topic/year/type/search/favorite filters and empty IDs',()=>{
 const q=data.questions.find(q=>q.topicId===7&&q.year===2026);
 const result=request(`/questions?topicId=7&year=2026&examType=${q.examType}&q=${encodeURIComponent('ลาปลาซ')}&ids=${q.id}`);
 assert.deepEqual(result.items.map(q=>q.id),[q.id]);
 assert.equal(request('/questions?ids=').total,0);
 assert.equal(request('/questions?ids='+q.id+'&excludeIds='+q.id).total,0);
 assert.equal(request('/questions?choiceOnly=1').total,10);
 assert.throws(()=>request('/questions?pageSize=101'));
 assert.throws(()=>request('/questions?sort=bad'));
});
test('random practice never repeats or includes excluded/non-choice questions',()=>{
 const ids=Object.keys(data.choices);
 const result=request('/practice/sets',{mode:'choice',topicId:0,count:50,excludeIds:[ids[0]]});
 assert.equal(result.available,9);assert.equal(result.items.length,9);
 assert.equal(new Set(result.items.map(q=>q.id)).size,9);
 assert.ok(result.items.every(q=>q.id!==ids[0]&&data.choices[q.id].available));
 assert.equal(request('/practice/sets',{mode:'choice',count:5,includeIds:[]}).items.length,0);
 assert.equal(request('/practice/sets',{mode:'choice',topicId:7,count:5}).items.length,1);
 assert.throws(()=>request('/practice/sets',{count:0}));
 assert.throws(()=>request('/practice/sets',null));
});
test('all 40 choices grade against the exported source answer key',()=>{
 for(const [id,key] of Object.entries(data.choices)){
  const results=key.options.map(o=>request('/choices/check',{items:[{questionId:id,answer:`mcq:${key.version}:${o.id}`}]}));
  assert.equal(results.filter(r=>r.correct===1).length,1);
  assert.equal(results.filter(r=>r.wrong===1).length,3);
  for(const r of results){assert.ok(r.items[0].explanation);assert.match(r.items[0].sourceUrl,/^\/study\/media\//);}
 }
});
test('unanswered, legacy, stale and unavailable selections preserve scoring semantics',()=>{
 const [id,key]=Object.entries(data.choices)[0];
 const result=request('/choices/check',{items:[{questionId:id,answer:''},{questionId:'missing',answer:'old'}]});
 assert.equal(result.unanswered,1);assert.equal(result.ungraded,1);assert.equal(result.wrong,0);
 assert.equal(request('/choices/check',{items:[{questionId:id,answer:'free text'}]}).items[0].status,'legacy');
 assert.equal(request('/choices/check',{items:[{questionId:id,answer:'mcq:old:option'}]}).items[0].status,'stale');
 assert.throws(()=>request('/choices/check',{items:[{questionId:id,answer:`mcq:${key.version}:forged`}]}));
 assert.throws(()=>request('/choices/check',{items:[{questionId:id,answer:''},{questionId:id,answer:''}]}));
});
test('all authored explanation bodies and statuses match reviewed source files',async()=>{
 for(const file of ['laplace_explanations.json','z_transform_explanations.json','bvp_explanations.json']){
  const items=JSON.parse(await readFile(new URL('../../backend/internal/studycontent/'+file,import.meta.url),'utf8'));
  for(const item of items){
   const solution=request(`/questions/${item.questionId}/solutions`).aiExplanation;
   assert.equal(solution.bodyHtml,item.bodyHtml);assert.equal(solution.reviewStatus,item.reviewStatus);
   assert.equal(createHash('sha256').update(solution.bodyHtml).digest('hex'),item.reviewedBodySHA256);
  }
 }
 assert.equal(request('/catalog').aiAvailable,false);
 assert.throws(()=>request('/conversations',{}));
 assert.throws(()=>request('/questions/not-found'));
});
test('local issue notes persist and export without a server and surface storage failure',()=>{
 const values=new Map();const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 saveLocalReport(storage,'ee201-t09-q022','question','เงื่อนไขขอบเขตขัดกัน');
 assert.equal(readLocalReports(storage)[0].questionId,'ee201-t09-q022');
 for(let i=0;i<105;i++)saveLocalReport(storage,'q','guide','note '+i);
 assert.equal(readLocalReports(storage).length,100);
 const before=values.get(REPORTS_KEY);
 assert.throws(()=>saveLocalReport({...storage,setItem:()=>{throw new Error('quota')}},'q','guide','a note'));
 assert.equal(values.get(REPORTS_KEY),before);
});
