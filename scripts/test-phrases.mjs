import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {KEY,empty,validate,answer,balance,merge,dailyWords,dailyPhrases,clozeText,escapePattern,readRecord,saveRecord} from '../core.js';
const c=JSON.parse(fs.readFileSync(new URL('../curriculum.json',import.meta.url))),{words,phrases}=c;
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const phraseFields=['id','phrase','meaning','example','translation','note','meaningDistractors','clozeDistractors','seq','level','tags'].sort();
const tags=['物流','施設','オフィス','店舗','旅行','人事','経理','広告','会議'];
const japanese=/[\u3040-\u30ff\u3400-\u9fff]/u;
const text=(value,label)=>{
 assert.equal(typeof value,'string',`${label}: text is required`);
 assert.ok(value.trim(),`${label}: text cannot be empty`);
 assert.equal(value,value.trim(),`${label}: no outer whitespace`);
};
assert.equal(c.schemaVersion,2);assert.equal(words.length,150);assert.equal(phrases.length,120);
// Freeze both E03's first 90 words and E07's complete 150-word curriculum.
assert.deepEqual(words.map(w=>w.seq),Array.from({length:150},(_,i)=>i+1),'Words must remain in consecutive seq order, including the frozen first 90.');
assert.equal(hash(words.slice(0,90)),'61be552701b8e4fde351612ef2f27f543a0042fef576a57ad51631a14515f99c');
assert.equal(hash(words),'53cb5b374ab8912530ec79748164fc091747f66795151d4bd475be579e32978b','All 150 existing words must remain byte-equivalent as JSON.');
assert.equal(hash(phrases.slice(0,60)),'a0a3a3f9b690ce6f4c07c75cbd73308cabceff6fce3d4e327898300dce48c0e8','All 60 existing phrases must remain byte-equivalent as JSON.');
assert.deepEqual(phrases.map(p=>p.seq),Array.from({length:120},(_,i)=>i+1),'All 120 phrases must remain in consecutive seq order.');
const ids=new Set([...words,...phrases].map(w=>w.id));assert.equal(ids.size,270);
const match=(s,p)=>(s.match(new RegExp('\\b'+escapePattern(p)+'\\b','gi'))||[]).length;
for(const [i,p] of phrases.entries()){
 const label=p.id??`phrases[${i}]`;
 assert.deepEqual(Object.keys(p).sort(),phraseFields,`${label}: exactly eleven phrase fields`);
 for(const key of ['id','phrase','meaning','example','translation','note'])text(p[key],`${label} ${key}`);
 assert.match(p.id,/^ph_[a-z]+(_[a-z]+)*$/,`${label}: stable phrase ID format`);
 assert.match(p.phrase,/^[A-Za-z]+(?: [A-Za-z]+)+$/,`${label}: at least two English words with single spaces`);
 assert.equal(p.id,'ph_'+p.phrase.toLowerCase().replaceAll(' ','_'));
 assert.equal(p.seq,i+1,`${label}: consecutive seq 1–120`);assert.equal(p.level,'L1',`${label}: foundation level`);
 assert.ok(p.phrase.split(' ').length>=2);
 assert.ok(Array.isArray(p.tags),`${label}: tags must be an array`);
 assert.ok(p.tags.length>=1&&p.tags.length<=3,`${label}: one to three tags`);
 assert.equal(new Set(p.tags).size,p.tags.length,`${label}: tags must be distinct`);
 assert.ok(p.tags.every(t=>tags.includes(t)),`${label}: only existing Japanese scene tags`);
 assert.match(p.meaning,japanese,`${label}: Japanese meaning is required`);
 assert.match(p.translation,japanese,`${label}: Japanese translation is required`);
 assert.match(p.note,japanese,`${label}: Japanese usage note is required`);
 assert.ok(!japanese.test(p.example),`${label}: the English example cannot contain Japanese`);
 assert.equal(match(p.example,p.phrase),1,`${label}: phrase occurs exactly once`);
 const length=p.example.split(/\s+/).length;assert.ok(length>=8&&length<=20,`${label}: example has 8–20 words`);
 for(const key of ['meaningDistractors','clozeDistractors']){
  assert.ok(Array.isArray(p[key]),`${label}: ${key} must be an array`);
  assert.equal(p[key].length,3,`${label}: exactly three ${key}`);
  p[key].forEach(d=>text(d,`${label} ${key}`));
 }
 assert.equal(new Set([p.meaning,...p.meaningDistractors]).size,4,`${label}: distinct meaning choices`);
 assert.equal(new Set([p.phrase,...p.clozeDistractors].map(d=>d.toLowerCase())).size,4,`${label}: case-insensitively distinct cloze choices`);
 p.meaningDistractors.forEach(d=>{
  assert.match(d,japanese,`${label}: meaning distractors must be Japanese`);
  assert.ok(!d.includes(p.meaning),`${label}: a distractor cannot contain the correct meaning`);
 });
 p.clozeDistractors.forEach(d=>{
  assert.match(d,/^[A-Za-z]+(?:['’\-][A-Za-z]+)*(?: [A-Za-z]+(?:['’\-][A-Za-z]+)*)+$/,`${label}: cloze distractors must be English phrases with single spaces`);
  assert.equal(match(p.example,d),0,`${label}: cloze distractor cannot occur in the example`);
  assert.equal(d.split(' ').length,p.phrase.split(' ').length,`${label}: cloze distractor has the same word count`);
 });
 const cloze=clozeText(p);
 assert.equal(cloze,p.example.replace(new RegExp('\\b'+escapePattern(p.phrase)+'\\b','i'),'______'),`${label}: only the matching phrase is replaced`);
 assert.equal(match(cloze,p.phrase),0);assert.equal(cloze.split('______').length-1,1,`${label}: exactly one blank`);
}
for(const tag of ['会議','広告','人事','経理']){
 assert.ok(phrases.slice(60).filter(p=>p.tags.includes(tag)).length>=6,`${tag}: at least six newly added phrases`);
}
// Naturalness, originality, distinct expressions and a single defensible answer
// still require editorial review of every new phrase and distractor.
for(const w of words)assert.equal(clozeText(w),w.example.replace(new RegExp('\\b'+w.word+'\\b','i'),'______'));
assert.equal(clozeText({phrase:'a.b',example:'Read a.b before using axb.'}),'Read ______ before using axb.');
const date='2026-10-02',s=empty();words.slice(0,30).forEach(w=>answer(s,w,true,'2026-10-01'));
const restored=validate(JSON.parse(JSON.stringify(s)),ids);assert.deepEqual(restored,s);
assert.deepEqual(dailyWords(s,words,date).map(w=>w.seq),[31,32,33]);assert.deepEqual(dailyPhrases(s,phrases,date).map(p=>p.seq),[1,2,3]);
const p=phrases[0];assert.equal(answer(s,p,false,date).earned,false);assert.equal(answer(s,p,true,date).earned,true);assert.equal(answer(s,p,true,date).earned,false);
assert.equal(s.awards[date+':'+p.id],true);assert.ok(s.progress[p.id]);
assert.deepEqual(validate(JSON.parse(JSON.stringify(s)),ids),s);assert.deepEqual(merge(s,s),s);assert.equal(balance(s),31);
phrases.slice(1,3).forEach(p=>answer(s,p,true,date));assert.deepEqual(dailyPhrases(s,phrases,date).map(p=>p.seq),[1,2,3]);
assert.deepEqual(dailyPhrases(s,phrases,'2026-10-03').map(p=>p.seq),[4,5,6]);
assert.deepEqual(dailyWords(s,words,date).map(w=>w.seq),[31,32,33]);
s.settings.dailyNew=20;assert.equal(dailyPhrases(s,phrases,date).length,3);
const onlyPhrases=empty();answer(onlyPhrases,phrases[3],true,date);const combined=merge(s,onlyPhrases);assert.ok(combined.progress[phrases[3].id]);assert.equal(balance(combined),34);assert.deepEqual(validate(JSON.parse(JSON.stringify(combined)),ids),combined);
const storage={data:new Map(),getItem(k){return this.data.get(k)??null},setItem(k,v){this.data.set(k,v)}};
saveRecord(storage,combined,ids);assert.deepEqual(readRecord(storage,ids),combined);assert.equal(JSON.parse(storage.getItem(KEY)).schemaVersion,2);assert.deepEqual(Object.keys(combined.settings),['dailyNew']);
// Phrase review follows the unchanged shared stage/award rules.
const review=empty();answer(review,p,true,'2026-10-01');assert.equal(review.progress[p.id].due,'2026-10-02');
assert.equal(answer(review,p,true,'2026-10-02').earned,true);assert.equal(review.progress[p.id].due,'2026-10-05');
assert.equal(answer(review,p,true,'2026-10-03').earned,false);assert.equal(review.progress[p.id].due,'2026-10-05');
const done=empty();phrases.forEach(p=>answer(done,p,true,'2026-10-01'));assert.deepEqual(dailyPhrases(done,phrases,'2026-10-02'),[]);
assert.throws(()=>validate({...s,progress:{...s.progress,ph_invented:s.progress[p.id]}},ids));
assert.throws(()=>validate({...s,awards:{...s.awards,[date+':ph_invented']:true}},ids));
console.log('Phrases: 120 valid L1 entries, original 60 phrases and all 150 words frozen, exact/escaped cloze, separate daily3, v2 continuation, phrase awards/merge/backup/unknown-ID rejection passed.');
