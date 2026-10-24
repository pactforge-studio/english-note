import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {KEY,empty,validate,answer,balance,merge,dailyWords,dailyPhrases,clozeText,escapePattern,readRecord,saveRecord} from '../core.js';
const c=JSON.parse(fs.readFileSync(new URL('../curriculum.json',import.meta.url))),{words,phrases}=c;
assert.equal(c.schemaVersion,2);assert.equal(words.length,90);assert.equal(phrases.length,60);
// Freeze all 90 E03 word fields, not only the original 30 lesson entries.
assert.equal(createHash('sha256').update(JSON.stringify(words)).digest('hex'),'61be552701b8e4fde351612ef2f27f543a0042fef576a57ad51631a14515f99c');
const ids=new Set([...words,...phrases].map(w=>w.id));assert.equal(ids.size,150);
const match=(s,p)=>(s.match(new RegExp('\\b'+escapePattern(p)+'\\b','gi'))||[]).length;
for(const [i,p] of phrases.entries()){
 assert.deepEqual(Object.keys(p).sort(),['id','phrase','meaning','example','translation','note','meaningDistractors','clozeDistractors','seq','level','tags'].sort());
 assert.match(p.id,/^ph_[a-z]+(_[a-z]+)*$/);assert.equal(p.id,'ph_'+p.phrase.toLowerCase().replaceAll(' ','_'));
 assert.equal(p.seq,i+1);assert.equal(p.level,'L1');assert.ok(p.phrase.split(' ').length>=2);
 assert.ok(p.tags.length>=1&&p.tags.length<=3&&p.tags.every(t=>typeof t==='string'&&t.trim()));
 assert.equal(match(p.example,p.phrase),1,p.id);const length=p.example.split(/\s+/).length;assert.ok(length>=8&&length<=20,p.id);
 assert.equal(p.meaningDistractors.length,3);assert.equal(p.clozeDistractors.length,3);
 assert.equal(new Set([p.meaning,...p.meaningDistractors]).size,4);assert.equal(new Set([p.phrase,...p.clozeDistractors]).size,4);
 p.meaningDistractors.forEach(d=>assert.ok(!d.includes(p.meaning),p.id));
 p.clozeDistractors.forEach(d=>{assert.equal(match(p.example,d),0,p.id);assert.equal(d.split(' ').length,p.phrase.split(' ').length,p.id)});
 assert.ok(p.translation&&p.note);assert.equal(match(clozeText(p),p.phrase),0);assert.ok(clozeText(p).includes('______'));
}
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
console.log('Phrases: 60 original entries, all 90 words unchanged, exact/escaped cloze, separate daily3, v2 continuation, phrase awards/merge/backup/unknown-ID rejection passed.');
