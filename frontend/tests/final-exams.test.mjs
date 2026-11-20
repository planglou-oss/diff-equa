import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
async function load(path) {
  const source=await readFile(new URL(path,import.meta.url),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
}
const {groupFinalPapers,finalMonthFromDate}=await load('../src/features/study/finalExams.ts');
const {emptyStudy,parseStudy,finishPractice}=await load('../src/features/study/model.ts');
const data=JSON.parse(await readFile(new URL('../public/study/data.json',import.meta.url),'utf8'));

test('each year and month contains every Final archive question exactly once, including questions without choices',()=>{
  const papers=groupFinalPapers(data.questions);
  const finals=data.questions.filter(q=>q.examType==='Final');
  assert.deepEqual(papers.flatMap(p=>p.questions.map(q=>q.id)).sort(),finals.map(q=>q.id).sort());
  assert.ok(papers.flatMap(p=>p.questions).some(q=>!data.choices[q.id]?.available));
  for(let i=1;i<papers.length;i++) assert.ok(papers[i-1].year>papers[i].year || papers[i-1].year===papers[i].year && papers[i-1].month>papers[i].month);
  for(const paper of papers) {
    assert.ok(paper.questions.every(q=>q.year===paper.year && q.examType==='Final' && finalMonthFromDate(q.dateLabel)===paper.month));
    assert.equal(paper.topics.reduce((n,t)=>n+t.count,0),paper.questions.length);
    assert.equal(paper.questions.length,new Set(paper.questions.map(q=>q.id)).size);
  }
  const paper2025=papers.filter(p=>p.year===2025);
  assert.deepEqual(paper2025.map(p=>p.month),[11,5]);
  assert.deepEqual(paper2025.map(p=>p.questions.length),[6,6]);
});

test('grouping is stable across input order and duplicate ids without mutating the archive',()=>{
  const input=[...data.questions];const before=input.map(q=>q.id);
  const expected=groupFinalPapers(input);
  assert.deepEqual(groupFinalPapers([...input].reverse().concat(input[0])),expected);
  assert.deepEqual(input.map(q=>q.id),before);
  assert.deepEqual(groupFinalPapers([]),[]);
});

test('final exam year, full question set and done markers survive reload and history',()=>{
  const paper=groupFinalPapers(data.questions).find(p=>p.year===2025);
  const state=emptyStudy();
  state.practice={id:'final-test',finalYear:paper.year,finalMonth:paper.month,questions:paper.questions,answers:{[paper.questions[0].id]:'done'},index:3,startedAt:100000,durationSeconds:10800,finishedAt:null};
  assert.deepEqual(parseStudy(JSON.stringify(state)).practice,state.practice);
  const finished=finishPractice(state,200000);
  assert.deepEqual(parseStudy(JSON.stringify(finished)).history,finished.history);
  state.practice.finalYear=2024;
  assert.equal(parseStudy(JSON.stringify(state)).practice,null);
});

test('completed Final month badges persist after attempts fall out of the ten-entry history',()=>{
  const papers=groupFinalPapers(data.questions).slice(0,12);
  let state=emptyStudy();
  for(const [i,paper] of papers.entries()) {
    state.practice={id:'badge-'+i,finalYear:paper.year,finalMonth:paper.month,questions:paper.questions,answers:{},index:0,startedAt:100000,durationSeconds:10800,finishedAt:null};
    assert.equal(state.completedFinalPapers.includes(paper.key),false);
    state=finishPractice(state,200000);
  }
  assert.equal(state.history.length,10);
  assert.equal(state.completedFinalPapers.length,12);
  assert.deepEqual(parseStudy(JSON.stringify(state)).completedFinalPapers,state.completedFinalPapers);
  assert.ok(state.completedFinalPapers.includes(papers[0].key));
});

test('old finished Final sessions receive badges, unfinished sessions do not',()=>{
  const paper=groupFinalPapers(data.questions)[0];
  const state=emptyStudy();
  state.practice={id:'old-final',finalYear:paper.year,finalMonth:paper.month,questions:paper.questions,answers:{},index:0,startedAt:100000,durationSeconds:10800,finishedAt:null};
  assert.deepEqual(parseStudy(JSON.stringify(state)).completedFinalYears,[]);
  state.practice.finishedAt=200000;
  delete state.completedFinalYears;
  assert.deepEqual(parseStudy(JSON.stringify(state)).completedFinalYears,[paper.year]);
});

test('completion marks only the submitted month and never its sibling month',()=>{
  const papers=groupFinalPapers(data.questions).filter(p=>p.year===2025);
  let state=emptyStudy();
  state.practice={id:'november',finalYear:2025,finalMonth:11,questions:papers.find(p=>p.month===11).questions,answers:{},index:0,startedAt:100000,durationSeconds:10800,finishedAt:null};
  assert.deepEqual(parseStudy(JSON.stringify(state)).completedFinalPapers,[]);
  state=finishPractice(state,200000);
  assert.deepEqual(state.completedFinalPapers,['2025:11']);
  assert.deepEqual(parseStudy(JSON.stringify(state)).completedFinalPapers,['2025:11']);
  assert.equal(state.completedFinalPapers.includes('2025:5'),false);
});

test('missing month stays separate instead of being silently assigned January',()=>{
  assert.equal(finalMonthFromDate('1997'),0);
  assert.equal(finalMonthFromDate('May 5, 2026'),5);
  assert.equal(finalMonthFromDate('November 24, 2025'),11);
  const question=data.questions.find(q=>q.examType==='Final' && q.year===2026);
  const papers=groupFinalPapers([question,{...question,id:'ee201-t06-q999',dateLabel:'2026'}]);
  assert.deepEqual(papers.map(p=>p.month),[5,0]);
});
