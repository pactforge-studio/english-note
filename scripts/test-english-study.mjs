import assert from 'node:assert/strict';
import fs from 'node:fs';
import {day,empty,answer,balance,validate,merge,dailyWords} from '../core.js';
const c=JSON.parse(fs.readFileSync(new URL('../curriculum.json',import.meta.url)));
const words=c.words,ids=new Set(words.map(w=>w.id));
assert.equal(c.schemaVersion,2);assert.equal(ids.size,words.length);assert.equal(words.length,90);
const lessons=fs.readdirSync(new URL('../lessons/',import.meta.url)).filter(f=>f.endsWith('.json')).sort().map(f=>JSON.parse(fs.readFileSync(new URL('../lessons/'+f,import.meta.url))));
assert.equal(lessons.length,10);
const originals=lessons.flatMap(l=>{assert.equal(l.words.length,3);return l.words;});
assert.equal(originals.length,30);
const escaped=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const occurrences=(text,word)=>(text.match(new RegExp('\\b'+escaped(word)+'\\b','gi'))||[]).length;
for(const [i,w] of words.entries()){
 const {seq,level,tags,...original}=w;
 assert.equal(seq,i+1);assert.ok(['L1','L2','L3','L4'].includes(level));
 assert.ok(Array.isArray(tags)&&tags.length>=1&&tags.length<=3&&tags.every(t=>typeof t==='string'&&t.trim()));
 if(i<originals.length){assert.deepEqual(original,originals[i]);assert.equal(level,'L1');}
 assert.equal(w.id,w.word.toLowerCase());
 assert.equal(w.meaningDistractors.length,3);assert.equal(w.clozeDistractors.length,3);
 assert.equal(new Set([w.meaning,...w.meaningDistractors]).size,4);
 assert.equal(new Set([w.word,...w.clozeDistractors]).size,4);
 assert.equal(occurrences(w.example,w.word),1,`${w.id}: exact headword once`);
 for(const d of w.clozeDistractors)assert.equal(occurrences(w.example,d),0,`${w.id}: distractor in example`);
 assert.ok(w.translation&&w.etymology);
 assert.ok(Array.isArray(w.sources));
 for(const source of w.sources){const u=new URL(source);assert.equal(u.protocol,'https:');assert.ok(['merriam-webster.com','www.merriam-webster.com'].includes(u.hostname));}
 if(!w.sources.length)assert.ok(w.etymology.startsWith('語源は未確認です'));
 if(i>=originals.length){
  assert.equal(level,'L1');assert.match(w.id,/^[a-z]+$/);
  const length=w.example.trim().split(/\s+/).length;assert.ok(length>=8&&length<=18,`${w.id}: sentence length`);
  for(const d of w.meaningDistractors)assert.ok(!d.includes(w.meaning),`${w.id}: meaning overlap`);
 }
}
// A previously learned 30-word v2 record is unchanged with the expanded curriculum.
const prior=empty();for(const w of words.slice(0,30))answer(prior,w,true,'2026-10-01');
const restored=validate(JSON.parse(JSON.stringify(prior)),ids);assert.deepEqual(restored,prior);
assert.deepEqual(dailyWords(restored,words,'2026-10-02').map(w=>w.seq),[31,32,33]);
assert.equal(words.filter(w=>w.level==='L1').length,90);assert.equal(Object.keys(restored.progress).length,30);
assert.equal(day(new Date('2026-09-14T14:59:59Z')),'2026-09-14');assert.equal(day(new Date('2026-09-14T15:00:00Z')),'2026-09-15');
let s=empty();const w=words[0];assert.equal(answer(s,w,false,'2026-09-14').earned,false);assert.equal(answer(s,w,true,'2026-09-14').earned,true);assert.equal(answer(s,w,true,'2026-09-14').earned,false);assert.equal(balance(s),1);
s=validate(JSON.parse(JSON.stringify(s)),ids);assert.equal(balance(s),1);assert.equal(answer(s,w,true,'2026-09-15').earned,true);assert.equal(s.progress[w.id].due,'2026-09-18');assert.equal(answer(s,w,true,'2026-09-16').earned,false);assert.equal(s.progress[w.id].due,'2026-09-18');assert.equal(balance(merge(s,s)),2);
assert.throws(()=>validate({...s,schemaVersion:999},ids));assert.throws(()=>validate({...s,awards:{'2026-09-14:invented':true}},ids));
console.log('English study: original 30 parity, 90 unique words, tags/seq/levels, exact cloze, safe sources, learned-30 continuation, choices, JST boundary, retry, daily cap, spaced review, persistence and backup passed.');
