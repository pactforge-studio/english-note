import assert from 'node:assert/strict';
import fs from 'node:fs';
import {day,empty,answer,balance,validate,merge} from '../core.js';
const c=JSON.parse(fs.readFileSync(new URL('../curriculum.json',import.meta.url)));
const words=c.lessons.flatMap(l=>l.words),ids=new Set(words.map(w=>w.id));
assert.equal(ids.size,words.length);
for(const l of c.lessons){
 assert.equal(l.words.length,3);assert.deepEqual(l,JSON.parse(fs.readFileSync(new URL(`../lessons/${l.date}.json`,import.meta.url))));
 for(const w of l.words){assert.equal(new Set([w.meaning,...w.meaningDistractors]).size,4);assert.equal(new Set([w.word,...w.clozeDistractors]).size,4);assert.match(w.example,new RegExp('\\b'+w.word+'\\b','i'));assert.ok(w.translation&&w.etymology);}
}
assert.equal(day(new Date('2026-09-14T14:59:59Z')),'2026-09-14');assert.equal(day(new Date('2026-09-14T15:00:00Z')),'2026-09-15');
let s=empty();const w=words[0];assert.equal(answer(s,w,false,'2026-09-14').earned,false);assert.equal(answer(s,w,true,'2026-09-14').earned,true);assert.equal(answer(s,w,true,'2026-09-14').earned,false);assert.equal(balance(s),1);
s=validate(JSON.parse(JSON.stringify(s)),ids);assert.equal(balance(s),1);assert.equal(answer(s,w,true,'2026-09-15').earned,true);assert.equal(s.progress[w.id].due,'2026-09-18');assert.equal(answer(s,w,true,'2026-09-16').earned,false);assert.equal(s.progress[w.id].due,'2026-09-18');assert.equal(balance(merge(s,s)),2);
assert.throws(()=>validate({...s,schemaVersion:999},ids));assert.throws(()=>validate({...s,awards:{'2026-09-14:invented':true}},ids));
console.log('English study: curriculum parity, 30 unique words, choices, JST boundary, retry, daily cap, spaced review, persistence and backup passed.');
