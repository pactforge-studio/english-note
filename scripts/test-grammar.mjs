import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {
 KEY,BACKUP_KEY,empty,validate,answer,balance,eligible,merge,
 dailyWords,dailyPhrases,dailyGrammar,itemText,readRecord,saveRecord,
} from '../core.js';

const curriculum=JSON.parse(fs.readFileSync(new URL('../curriculum.json',import.meta.url)));
const {words,phrases,grammar}=curriculum;
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const seqs=items=>items.map(item=>item.seq);
const clone=value=>JSON.parse(JSON.stringify(value));
const categories=['品詞','時制','態','関係詞','前置詞と接続詞','代名詞','比較','語彙'];
const fields=['id','seq','level','category','sentence','choices','answer','explanation','translation'].sort();
assert.equal(curriculum.schemaVersion,2,'Grammar must not change the saved/curriculum schema.');
assert.equal(words.length,150);
assert.equal(phrases.length,120);
assert.deepEqual(seqs(words),Array.from({length:150},(_,index)=>index+1),'Words must remain in consecutive seq order, including the frozen first 90.');
assert.equal(hash(words.slice(0,90)),'61be552701b8e4fde351612ef2f27f543a0042fef576a57ad51631a14515f99c','All 90 existing word entries must remain byte-equivalent as JSON.');
assert.deepEqual(seqs(phrases),Array.from({length:120},(_,index)=>index+1),'All 120 phrases must remain in consecutive seq order.');
assert.equal(hash(phrases.slice(0,60)),'a0a3a3f9b690ce6f4c07c75cbd73308cabceff6fce3d4e327898300dce48c0e8','All 60 existing phrase entries must remain byte-equivalent as JSON.');
assert.ok(Array.isArray(grammar),'curriculum.grammar must be an array.');
assert.equal(grammar.length,50);
const ids=new Set([...words,...phrases,...grammar].map(item=>item.id));
assert.equal(ids.size,320,'Word, phrase and grammar IDs must be globally unique.');

const counts=Object.fromEntries(categories.map(category=>[category,0]));
const escaped=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const mentions=(text,choice)=>new RegExp('(?<![A-Za-z])'+escaped(choice)+'(?![A-Za-z])','i').test(text);
for(const [index,g] of grammar.entries()){
 const label=g.id??`grammar[${index}]`;
 assert.deepEqual(Object.keys(g).sort(),fields,`${label}: exactly nine grammar fields`);
 assert.equal(g.id,`g_l1_${String(index+1).padStart(3,'0')}`);
 assert.equal(g.seq,index+1,`${label}: sequential order`);
 assert.equal(g.level,'L1',`${label}: foundation level`);
 assert.ok(categories.includes(g.category),`${label}: approved category`);
 counts[g.category]++;
 for(const key of ['sentence','answer','explanation','translation']){
  assert.equal(typeof g[key],'string',`${label}: ${key} must be text`);
  assert.ok(g[key].trim(),`${label}: ${key} cannot be empty`);
 }
 assert.equal((g.sentence.match(/(?<!-)-------(?!-)/g)||[]).length,1,`${label}: exactly one seven-hyphen blank`);
 assert.ok(!g.sentence.replace('-------','').includes('--'),`${label}: no additional or overlong blank`);
 const wordCount=g.sentence.trim().split(/\s+/).length;
 assert.ok(wordCount>=8&&wordCount<=22,`${label}: sentence has ${wordCount} tokens, expected 8–22`);
 assert.ok(Array.isArray(g.choices),`${label}: choices must be an array`);
 assert.equal(g.choices.length,4,`${label}: four choices`);
 g.choices.forEach(choice=>{
  assert.equal(typeof choice,'string',`${label}: choice must be text`);
  assert.ok(choice.trim(),`${label}: nonempty choice`);
  assert.equal(choice,choice.trim(),`${label}: choices have no outer whitespace`);
 });
 assert.equal(new Set(g.choices.map(choice=>choice.toLowerCase())).size,4,`${label}: four distinct choices`);
 assert.equal(g.choices.filter(choice=>choice===g.answer).length,1,`${label}: answer occurs exactly once among choices`);
 // Check that the explanation discusses the actual options, not just a generic rule.
 for(const choice of g.choices)assert.ok(mentions(g.explanation,choice),`${label}: explanation must mention choice "${choice}"`);
 assert.equal(itemText(g),`文法 ${g.id}`,`${label}: safe display text without word/phrase fields`);
}
for(const category of categories.slice(0,7))assert.ok(counts[category]>=5,`${category}: at least five grammar questions`);
assert.ok(counts['語彙']>=1&&counts['語彙']<=5,'Vocabulary must be present but capped at five questions.');
assert.equal(itemText(words[0]),words[0].word,'Word display text must not regress.');
assert.equal(itemText(phrases[0]),phrases[0].phrase,'Phrase display text must not regress.');

// An existing v2 record with 30 learned words and 3 learned phrases is untouched.
const yesterday='2026-10-01',today='2026-10-02',tomorrow='2026-10-03';
const prior=empty();
for(const item of [...words.slice(0,30),...phrases.slice(0,3)])answer(prior,item,true,yesterday);
const priorSnapshot=clone(prior);
const restored=validate(clone(prior),ids);
assert.deepEqual(restored,priorSnapshot,'Adding grammar must preserve the entire old v2 record.');
assert.deepEqual(prior,priorSnapshot,'Validation must not mutate its input.');
assert.equal(balance(restored),33);
assert.deepEqual(seqs(dailyWords(restored,words,today)),[31,32,33]);
assert.deepEqual(seqs(dailyPhrases(restored,phrases,today)),[4,5,6]);
assert.deepEqual(seqs(dailyGrammar(restored,grammar,today)),[1,2,3,4,5]);
assert.deepEqual(dailyGrammar(restored,[...grammar].reverse(),today),grammar.slice(0,5),'Daily grammar is ordered by seq, not input order.');
assert.deepEqual(restored,priorSnapshot,'Reading any daily queue must not change the record.');

// Even a wrong answer reserves one of the five slots; retries do not advance it.
const partial=clone(restored);
assert.equal(answer(partial,grammar[0],false,today).earned,false);
assert.deepEqual(seqs(dailyGrammar(partial,grammar,today)),[1,2,3,4,5]);
assert.equal(answer(partial,grammar[0],true,today).earned,true);
assert.equal(answer(partial,grammar[0],true,today).earned,false);
assert.deepEqual(seqs(dailyGrammar(partial,grammar,today)),[1,2,3,4,5]);
assert.equal(balance(partial),34);

const current=clone(restored);
for(const g of grammar.slice(0,5))assert.equal(answer(current,g,true,today).earned,true);
assert.deepEqual(seqs(dailyGrammar(current,grammar,today)),[1,2,3,4,5],'Five answered questions stay reserved for today.');
assert.deepEqual(seqs(dailyGrammar(current,grammar,tomorrow)),[6,7,8,9,10]);
assert.equal(balance(current),38);
for(const [id,progress] of Object.entries(priorSnapshot.progress))assert.deepEqual(current.progress[id],progress,'Grammar must not alter existing word/phrase progress.');
for(const [key,award] of Object.entries(priorSnapshot.awards))assert.equal(current.awards[key],award,'Grammar must not alter existing awards.');
for(const n of [3,5,10,20]){
 current.settings.dailyNew=n;
 assert.equal(dailyWords(current,words,today).length,n);
 assert.deepEqual(seqs(dailyPhrases(current,phrases,today)),[4,5,6]);
 assert.deepEqual(seqs(dailyGrammar(current,grammar,today)),[1,2,3,4,5]);
 assert.deepEqual(seqs(dailyGrammar(current,grammar,tomorrow)),[6,7,8,9,10]);
}
assert.deepEqual(seqs(dailyWords(current,words,today)),Array.from({length:20},(_,i)=>i+31),'Word N=20 must stay independent of grammar.');
assert.deepEqual(Object.keys(current.settings),['dailyNew'],'Grammar requires no new persisted setting.');
const sameDaySnapshot=clone(current);
for(const g of grammar.slice(0,5))assert.equal(answer(current,g,true,today).earned,false);
assert.deepEqual(current,sameDaySnapshot,'Repeating completed grammar the same day must change neither records nor PT.');
assert.deepEqual(validate(clone(current),ids),current,'Grammar records survive JSON roundtrip and validation.');
assert.deepEqual(merge(current,current),current,'Merging a grammar record with itself is idempotent.');

// Shared spaced repetition and reward behavior applies to grammar too.
const g=grammar[0],review=empty();
assert.equal(eligible(review,g,yesterday),true);
assert.equal(answer(review,g,true,yesterday).earned,true);
assert.deepEqual(review.progress[g.id],{stage:0,due:today,last:yesterday,errors:0,correct:true,first:yesterday});
assert.equal(eligible(review,g,today),true);
assert.equal(answer(review,g,true,today).earned,true);
assert.deepEqual(review.progress[g.id],{stage:1,due:'2026-10-05',last:today,errors:0,correct:true,first:yesterday});
assert.equal(balance(review),2);
assert.equal(eligible(review,g,tomorrow),false);
const scheduledSnapshot=clone(review);
for(const correct of [true,false]){
 assert.equal(answer(review,g,correct,tomorrow).earned,false);
 assert.deepEqual(review,scheduledSnapshot,'Early practice, right or wrong, must leave all records and awards unchanged.');
}
assert.equal(answer(review,g,false,'2026-10-05').earned,false);
assert.equal(review.progress[g.id].stage,0);
assert.equal(review.progress[g.id].due,'2026-10-06');
assert.equal(review.progress[g.id].errors,1);
assert.equal(answer(review,g,true,'2026-10-05').earned,true,'A same-day retry after an error may earn the one daily PT.');
assert.equal(answer(review,g,true,'2026-10-05').earned,false);
assert.equal(balance(review),3);
assert.equal(review.progress[g.id].first,yesterday);

// Merging preserves independent categories, the newest review and earliest first.
const incoming=empty();
answer(incoming,g,true,yesterday);
answer(incoming,g,true,tomorrow);
answer(incoming,grammar[5],true,tomorrow);
const currentBefore=clone(current),incomingBefore=clone(incoming);
const combined=merge(current,incoming);
assert.deepEqual(current,currentBefore,'Merge must not mutate the destination record.');
assert.deepEqual(incoming,incomingBefore,'Merge must not mutate the imported record.');
assert.equal(combined.settings.dailyNew,20);
assert.equal(combined.progress[g.id].last,tomorrow);
assert.equal(combined.progress[g.id].first,yesterday);
assert.equal(combined.progress[grammar[5].id].first,tomorrow);
assert.equal(balance(combined),41);
assert.deepEqual(validate(clone(combined),ids),combined);
assert.deepEqual(merge(combined,incoming),combined,'Reimporting the same grammar backup must not duplicate PT.');
for(const id of Object.keys(priorSnapshot.progress))assert.deepEqual(combined.progress[id],priorSnapshot.progress[id]);

const storage={data:new Map(),getItem(key){return this.data.get(key)??null;},setItem(key,value){this.data.set(key,value);}};
assert.deepEqual(readRecord(storage,ids),empty());
assert.deepEqual(saveRecord(storage,combined,ids),combined);
assert.deepEqual(readRecord(storage,ids),combined);
assert.equal(JSON.parse(storage.getItem(KEY)).schemaVersion,2);
assert.equal(storage.getItem(BACKUP_KEY),null,'A v2 grammar record must not spuriously create a v1 backup.');
assert.deepEqual(saveRecord(storage,readRecord(storage,ids),ids),combined);
assert.deepEqual(readRecord(storage,ids),combined);

// Unknown grammar IDs are rejected both as progress and as award keys.
const invalidProgress={...combined,progress:{...combined.progress,g_l1_999:combined.progress[g.id]}};
const invalidAward={...combined,awards:{...combined.awards,[today+':g_l1_999']:true}};
const storedBefore=storage.getItem(KEY);
for(const invalid of [invalidProgress,invalidAward]){
 assert.throws(()=>validate(invalid,ids));
 assert.throws(()=>saveRecord(storage,invalid,ids));
 assert.equal(storage.getItem(KEY),storedBefore,'A rejected import cannot overwrite the valid record.');
 const malformed={getItem:key=>key===KEY?JSON.stringify(invalid):null};
 assert.throws(()=>readRecord(malformed,ids));
}

// Existing schema-v1 fixtures still migrate through the expanded union of IDs.
const v1=JSON.parse(fs.readFileSync(new URL('./fixtures/v1-record.json',import.meta.url)));
const v1Snapshot=clone(v1),migrated=validate(v1,ids);
assert.deepEqual(v1,v1Snapshot);
assert.equal(migrated.schemaVersion,2);
assert.deepEqual(migrated.awards,v1.awards);
assert.equal(balance(migrated),balance(v1));
for(const [id,progress] of Object.entries(v1.progress)){
 const {first,...oldFields}=migrated.progress[id];
 assert.deepEqual(oldFields,progress);
 assert.equal(first,progress.last);
}
const rawV1='  '+JSON.stringify(v1,null,2)+'\n';
storage.data.clear();storage.data.set(KEY,rawV1);
const v1AndGrammar=readRecord(storage,ids);
answer(v1AndGrammar,grammar[0],true,today);
saveRecord(storage,v1AndGrammar,ids);
assert.equal(storage.getItem(BACKUP_KEY),rawV1,'The v1 original is backed up byte-for-byte before grammar writes.');
assert.deepEqual(readRecord(storage,ids),v1AndGrammar);
saveRecord(storage,v1AndGrammar,ids);
assert.equal(storage.getItem(BACKUP_KEY),rawV1,'The existing v1 backup must not be overwritten.');

const exhausted=empty();
for(const item of grammar)answer(exhausted,item,true,yesterday);
assert.deepEqual(dailyGrammar(exhausted,grammar,today),[],'An exhausted grammar curriculum yields no invented items.');
assert.deepEqual(dailyWords(exhausted,words,today),words.slice(0,3));
assert.deepEqual(dailyPhrases(exhausted,phrases,today),phrases.slice(0,3));
console.log('Grammar: 50 valid entries/8 categories, original 90 words and 60 phrases frozen, 120 sequential phrases, 320 IDs, daily5 independence/reservation, v2 continuation, review/awards, merge/JSON/storage, v1 migration/backup and unknown-ID rejection passed.');
