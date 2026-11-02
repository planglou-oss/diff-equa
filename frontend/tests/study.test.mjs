import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const source=await readFile(new URL('../src/features/study/model.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {defaultRecord,emptyStudy,parseStudy,remainingSeconds,finishPractice,studyIDs,safeListURL}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const question={id:'ee201-t01-q001',topicId:1,topic:'ODE',displayNumber:1,examType:'Midterm',examTypeRaw:'Midterm',dateLabel:'1998',year:1998,sourceLabel:'WKG',questionImage:{url:'/media/'+'a'.repeat(64)+'.png',width:400,height:100},hasOriginalSolution:true,hasAIExplanation:true};
function session(){return {id:'test-session',questions:[question],answers:{[question.id]:'y=2'},index:0,startedAt:100000,durationSeconds:60,finishedAt:null}}

test('progress, private notes, favorite and unfinished answers survive serialization',()=>{const s=emptyStudy();s.records[question.id]={...defaultRecord(),favorite:true,status:'reviewing',note:'ตรวจเครื่องหมาย',answer:'y=2',checks:['1:0'],updatedAt:123};s.practice=session();s.lastList={url:'/questions?topicId=1&studyStatus=reviewing',y:620};const restored=parseStudy(JSON.stringify(s));assert.deepEqual(restored,s);assert.equal(remainingSeconds(restored.practice,125000),35)});
test('timer expires by timestamp even after the page has been closed',()=>{const s=emptyStudy();s.practice=session();assert.equal(remainingSeconds(s.practice,159001),1);assert.equal(remainingSeconds(s.practice,170000),0);const result=finishPractice(s,170000);assert.equal(result.practice.finishedAt,160000);assert.equal(result.history.length,1);assert.equal(result.practice.answers[question.id],'y=2');assert.equal(finishPractice(result,180000),result)});
test('manual finish stores elapsed time and keeps at most ten unique attempts',()=>{let s=emptyStudy();for(let i=0;i<12;i++){s.practice={...session(),id:'session-'+i};s=finishPractice(s,120000)}assert.equal(s.practice.finishedAt,120000);assert.equal(s.history.length,10);assert.equal(s.history[0].id,'session-11');assert.equal(s.history[9].id,'session-2')});
test('unseen includes untouched questions and favorite filters intersect with status',()=>{const records={'ee201-t01-q001':{...defaultRecord(),status:'understood',favorite:true},'ee201-t01-q002':{...defaultRecord(),status:'reviewing',favorite:true},'ee201-t01-q003':{...defaultRecord(),favorite:true}};assert.deepEqual(studyIDs(records,'unseen',false),{excludeIds:['ee201-t01-q001','ee201-t01-q002']});assert.deepEqual(studyIDs(records,'unseen',true),{ids:['ee201-t01-q003']});assert.deepEqual(studyIDs(records,'reviewing',true),{ids:['ee201-t01-q002']});assert.deepEqual(studyIDs({},'understood',false),{ids:[]})});
test('corrupt local data is ignored and external resume URLs are rejected',()=>{assert.deepEqual(parseStudy('bad JSON'),emptyStudy());assert.equal(safeListURL('//external.example'),'/questions');assert.equal(safeListURL('/questions/../private'),'/questions');const s=emptyStudy();s.practice={...session(),questions:[{...question,questionImage:{...question.questionImage,url:'https://external.example/image.png'}}]};assert.equal(parseStudy(JSON.stringify(s)).practice,null);const dirty=parseStudy(JSON.stringify({version:1,records:{bad:{status:'understood'},[question.id]:{status:'fake',note:'x'.repeat(5000)}},lastList:{url:'https://external.example',y:-3}}));assert.equal(dirty.records[question.id].status,'unseen');assert.equal(dirty.records[question.id].note.length,4000);assert.deepEqual(dirty.lastList,{url:'/questions',y:0})});

test('static practice questions survive reload while external image URLs stay rejected',()=>{
 const s=emptyStudy();
 s.practice={...session(),questions:[{...question,questionImage:{...question.questionImage,url:'/study'+question.questionImage.url}}]};
 assert.deepEqual(parseStudy(JSON.stringify(s)).practice,s.practice);
 s.history=[{...s.practice,finishedAt:120000}];
 assert.equal(parseStudy(JSON.stringify(s)).history.length,1);
 for(const url of ['/study/media/not-a-hash.png','/study/../media/'+ 'a'.repeat(64)+'.png','https://external.example/media/'+ 'a'.repeat(64)+'.png']){
  const bad={...s,practice:{...s.practice,questions:[{...question,questionImage:{...question.questionImage,url}}]}};
  assert.equal(parseStudy(JSON.stringify(bad)).practice,null);
 }
});
