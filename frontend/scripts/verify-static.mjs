import {readFile,readdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root = new URL('../public/study/',import.meta.url);
const bytes = await readFile(new URL('data.json',root));
const data = JSON.parse(bytes);
const manifest = JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
function check(ok,message){if(!ok)throw new Error(message);}
const repo = new URL('../../', import.meta.url);
const inputs = ['exam201_solutions.html', 'backend/go.mod', 'backend/go.sum'];
async function collectSources(directory) {
  for (const entry of await readdir(new URL(directory + '/', repo), { withFileTypes: true })) {
    const path = directory + '/' + entry.name;
    if (entry.isDirectory()) await collectSources(path);
    else if (/\.(go|json)$/.test(entry.name) && !entry.name.endsWith('_test.go')) inputs.push(path);
  }
}
await collectSources('backend/cmd/export-static');
await collectSources('backend/internal');
const stale = 'Run go run ./cmd/export-static from backend/ and commit the regenerated snapshot.';
const recorded = manifest.sourceHashes ?? {};
check(Object.keys(recorded).length === inputs.length, 'Static snapshot source list changed. ' + stale);
for (const path of inputs) {
  const source = await readFile(new URL(path, repo), 'utf8');
  const digest = createHash('sha256').update(source.replace(/\r\n/g, '\n')).digest('hex');
  check(recorded[path] === digest, 'Static snapshot is out of date for ' + path + '. ' + stale);
}
check(createHash('sha256').update(bytes).digest('hex')===manifest.sha256,'Static snapshot hash mismatch. Run the Go export-static command again.');
check(data.schemaVersion===1 && data.questions.length===427 && manifest.questions===427,'Expected all 427 questions');
check(data.catalog.aiAvailable===false,'Chat must be disabled in public data');
check(new Set(data.questions.map(q=>q.id)).size===427,'Duplicate question ID');
const media=new Set();
for(const q of data.questions){
 const guide=data.guides.items.find(g=>g.topicId===q.topicId);
 check(JSON.stringify(q.tags)===JSON.stringify(guide?.tags??[]),`Wrong topic tags ${q.id}`);
 check(data.solutions[q.id]?.original && data.contexts[q.id] && typeof data.search[q.id]==='string',`Incomplete question ${q.id}`);
 for(const image of [q.questionImage,data.solutions[q.id].original]){
  check(/^\/study\/media\/[a-f0-9]{64}\.png$/.test(image.url),`Invalid public image path ${q.id}`);
  media.add(image.url.split('/').at(-1));
 }
}
for(const name of media){
 const png=await readFile(new URL('media/'+name,root));
 check(createHash('sha256').update(png).digest('hex')+'.png'===name,`Image hash mismatch ${name}`);
 check(png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),`Invalid PNG ${name}`);
}
check(media.size===manifest.media,'Media manifest mismatch');
for(const [id,key] of Object.entries(data.choices)){
 check(key.available && key.options.length===4 && new Set(key.options.map(o=>o.id)).size===4,`Invalid options ${id}`);
 const grades=key.options.map(o=>data.grading[id]?.[o.id]);
 check(grades.every(g=>g?.questionId===id) && grades.filter(g=>g.status==='correct').length===1,`Invalid grading ${id}`);
}
check(Object.keys(data.choices).length===manifest.choiceQuestions,'Choice count mismatch');
for(const [topic,total] of [[7,71],[8,27],[9,25]])check(data.questions.filter(q=>q.topicId===topic&&data.solutions[q.id].aiExplanation).length===total,`Missing authored explanations in topic ${topic}`);
await stat(new URL('mascot.png',root));
console.log(`Static content verified: ${data.questions.length} questions, ${media.size} images, ${Object.keys(data.choices).length} choice keys.`);
