import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {
 KEY,BACKUP_KEY,day,empty,validate,answer,balance,eligible,merge,
 dailyWords,dailyPhrases,dailyGrammar,dailyReading,readingResult,itemText,
 readRecord,saveRecord,
} from '../core.js';

const curriculum=JSON.parse(fs.readFileSync(new URL('../curriculum.json',import.meta.url)));
const {words,phrases,grammar,reading}=curriculum;
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const clone=value=>JSON.parse(JSON.stringify(value));
const seqs=items=>items.map(item=>item.seq);
const fields=(value,expected,label)=>assert.deepEqual(Object.keys(value).sort(),[...expected].sort(),`${label}: only the specified fields`);
const text=(value,label)=>{
 assert.equal(typeof value,'string',`${label}: text is required`);
 assert.ok(value.trim(),`${label}: text cannot be empty`);
 assert.equal(value,value.trim(),`${label}: no outer whitespace`);
};
const japanese=/[\u3040-\u30ff\u3400-\u9fff]/u;
const english=(value,label)=>{
 text(value,label);
 assert.match(value,/[A-Za-z]/,`${label}: English text is required`);
 assert.ok(!japanese.test(value),`${label}: English text cannot contain Japanese`);
};
// Count whitespace-delimited body words; insertion-position markers are not words.
const wordCount=body=>body.replace(/\[[1-4]\]/g,' ').trim().split(/\s+/).filter(Boolean).length;
const kinds=['メール','お知らせ','広告','記事','チャット','フォーム'];
const types=['目的','詳細','推測','語彙','文挿入'];
const markers=['[1]','[2]','[3]','[4]'];
const occurrences=(value,token)=>value.split(token).length-1;

assert.equal(KEY,'mb_english_v1','The existing storage key must not change.');
assert.equal(BACKUP_KEY,'mb_english_v1_schema1_backup');
assert.equal(curriculum.schemaVersion,2,'Reading must not introduce a new curriculum schema.');
fields(curriculum,['schemaVersion','words','phrases','grammar','reading'],'curriculum');
assert.equal(words.length,150);
assert.equal(phrases.length,120);
assert.equal(grammar.length,100);
assert.deepEqual(seqs(words),Array.from({length:150},(_,index)=>index+1),'Words must remain in consecutive seq order, including the frozen first 90.');
assert.equal(hash(words.slice(0,90)),'61be552701b8e4fde351612ef2f27f543a0042fef576a57ad51631a14515f99c','All 90 existing words must remain byte-equivalent as JSON.');
assert.equal(hash(words),'53cb5b374ab8912530ec79748164fc091747f66795151d4bd475be579e32978b','All 150 existing words must remain byte-equivalent as JSON.');
assert.deepEqual(seqs(phrases),Array.from({length:120},(_,index)=>index+1),'All 120 phrases must remain in consecutive seq order.');
assert.equal(hash(phrases.slice(0,60)),'a0a3a3f9b690ce6f4c07c75cbd73308cabceff6fce3d4e327898300dce48c0e8','All 60 existing phrases must remain byte-equivalent as JSON.');
assert.deepEqual(seqs(grammar),Array.from({length:100},(_,index)=>index+1),'All 100 grammar questions must remain in consecutive seq order.');
assert.equal(hash(phrases),'51351a168346ae09d9faf90addee446aad191e0609566b99eec0d0038cfd9bbf','All 120 existing phrases must remain byte-equivalent as JSON.');
assert.equal(hash(grammar.slice(0,50)),'7960bc3dcfd02e69c26f07c22e63e8c3026565569433116ae97fd2fab29eebdd','All 50 existing grammar entries must remain byte-equivalent as JSON.');
assert.ok(Array.isArray(reading),'curriculum.reading must be an array.');
assert.equal(reading.length,10,'E06 contains exactly ten reading sets.');
assert.equal(hash(reading),'7ddcdc4df90573df77a9976273b17c29a113ff879eb9de27d77defa830887e78','All ten existing reading sets must remain byte-equivalent as JSON.');
const items=[...words,...phrases,...grammar,...reading];
const ids=new Set(items.map(item=>item.id));
assert.equal(ids.size,380,'All word, phrase, grammar and reading-set IDs must be globally unique.');
const questionIds=new Set();
const documentKinds=new Set();
const counts=Object.fromEntries(types.map(type=>[type,0]));
let singleSets=0,multipleSets=0,totalQuestions=0;
for(const [index,set] of reading.entries()){
 const label=set.id??`reading[${index}]`;
 fields(set,['id','seq','level','docType','documents','questions'],label);
 assert.match(set.id,/^r_l[1-4]_[0-9]{3}$/,`${label}: stable reading-set ID format`);
 assert.equal(set.id,`r_l1_${String(index+1).padStart(3,'0')}`);
 assert.ok(!set.id.includes(':'),`${label}: IDs must not conflict with award separators`);
 assert.equal(set.seq,index+1,`${label}: seq must be the consecutive number 1–10`);
 assert.equal(set.level,'L1');
 assert.ok([...kinds,'複数文書'].includes(set.docType),`${label}: approved document type`);
 assert.ok(Array.isArray(set.documents),`${label}: documents must be an array`);
 assert.ok(set.documents.length>=1&&set.documents.length<=3,`${label}: one to three documents`);
 if(set.documents.length===1){
  singleSets++;
  assert.notEqual(set.docType,'複数文書',`${label}: a single document is not a multiple-document set`);
  assert.equal(set.docType,set.documents[0].kind,`${label}: single-document type matches its document`);
 }else{
  multipleSets++;
  assert.equal(set.documents.length,2,`${label}: E06 multiple-document sets contain exactly two documents`);
  assert.equal(set.docType,'複数文書');
 }
 for(const [documentIndex,document] of set.documents.entries()){
  const documentLabel=`${label} document ${documentIndex+1}`;
  fields(document,['kind','title','body','translation'],documentLabel);
  assert.ok(kinds.includes(document.kind),`${documentLabel}: approved kind, not 複数文書`);
  documentKinds.add(document.kind);
  english(document.title,`${documentLabel} title`);
  english(document.body,`${documentLabel} body`);
  text(document.translation,`${documentLabel} translation`);
  assert.match(document.translation,japanese,`${documentLabel}: Japanese translation is required`);
 }
 const wordsInSet=set.documents.reduce((sum,document)=>sum+wordCount(document.body),0);
 const [minimum,maximum]=set.documents.length===1?[60,150]:[120,220];
 assert.ok(wordsInSet>=minimum&&wordsInSet<=maximum,`${label}: ${wordsInSet} body words, expected ${minimum}–${maximum}`);
 assert.ok(Array.isArray(set.questions),`${label}: questions must be an array`);
 assert.ok(set.questions.length>=2&&set.questions.length<=5,`${label}: two to five questions`);
 totalQuestions+=set.questions.length;
 for(const [questionIndex,question] of set.questions.entries()){
  const questionLabel=question.id??`${label} question ${questionIndex+1}`;
  fields(question,['id','type','question','choices','answer','evidence','explanation'],questionLabel);
  assert.equal(question.id,`${set.id}_q${questionIndex+1}`,`${questionLabel}: sequential question ID within the set`);
  assert.ok(!questionIds.has(question.id),`${questionLabel}: globally unique question ID`);
  assert.ok(!ids.has(question.id),`${questionLabel}: question IDs must never be accepted record IDs`);
  questionIds.add(question.id);
  assert.ok(types.includes(question.type),`${questionLabel}: approved question type`);
  counts[question.type]++;
  english(question.question,`${questionLabel} question`);
  assert.ok(Array.isArray(question.choices),`${questionLabel}: choices must be an array`);
  assert.equal(question.choices.length,4,`${questionLabel}: exactly four choices`);
  for(const choice of question.choices){
   text(choice,`${questionLabel} choice`);
   if(question.type!=='文挿入')english(choice,`${questionLabel} choice`);
  }
  assert.equal(new Set(question.choices.map(choice=>choice.toLowerCase())).size,4,`${questionLabel}: four distinct choices`);
  text(question.answer,`${questionLabel} answer`);
  assert.equal(question.choices.filter(choice=>choice===question.answer).length,1,`${questionLabel}: answer matches exactly one complete choice`);
  text(question.evidence,`${questionLabel} evidence`);
  assert.ok(set.documents.some(document=>document.body.includes(question.evidence)),`${questionLabel}: evidence is copied verbatim from a document body in this set`);
  text(question.explanation,`${questionLabel} explanation`);
  assert.match(question.explanation,japanese,`${questionLabel}: Japanese explanation is required`);
  if(question.type==='文挿入'){
   assert.deepEqual([...question.choices].sort(),markers,`${questionLabel}: the four insertion positions are the choices`);
   const markedDocuments=set.documents.filter(document=>markers.some(marker=>document.body.includes(marker)));
   assert.equal(markedDocuments.length,1,`${questionLabel}: all insertion positions belong to one document`);
   for(const marker of markers){
    assert.equal(set.documents.reduce((sum,document)=>sum+occurrences(document.body,marker),0),1,`${questionLabel}: ${marker} occurs once in the bodies`);
    assert.equal(occurrences(markedDocuments[0].translation,marker),1,`${questionLabel}: ${marker} also occurs once in the matching translation`);
   }
  }
 }
 assert.equal(itemText(set),`読解 ${set.id}`,`${label}: review display text must not be undefined or labeled grammar`);
}
assert.equal(singleSets,8,'Exactly eight single-document sets are required.');
assert.equal(multipleSets,2,'Exactly two two-document sets are required.');
assert.deepEqual([...documentKinds].sort(),[...kinds].sort(),'All six individual document kinds must appear.');
assert.ok(totalQuestions>=30&&totalQuestions<=40,`Expected 30–40 questions; found ${totalQuestions}.`);
assert.equal(questionIds.size,totalQuestions);
for(const [type,minimum] of [['目的',4],['詳細',12],['推測',4],['語彙',3]])assert.ok(counts[type]>=minimum,`${type}: at least ${minimum} questions`);
assert.ok(counts['文挿入']<=2,'At most two insertion questions are allowed.');
assert.equal(itemText(words[0]),words[0].word);
assert.equal(itemText(phrases[0]),phrases[0].phrase);
assert.equal(itemText(grammar[0]),`文法 ${grammar[0].id}`);
// Originality, uniquely supported answers, each distractor's explanation, natural
// translations, and two-document dependence also require full editorial review.

const recordFields=['schemaVersion','progress','awards','exchanges','settings'];
const progressFields=['stage','due','last','errors','correct','first'];
const assertSetOnlyRecord=(record,label)=>{
 fields(record,recordFields,label);
 assert.equal(record.schemaVersion,2,`${label}: no new record schema`);
 fields(record.settings,['dailyNew'],`${label} settings`);
 assert.deepEqual(record.exchanges,[],`${label}: exchanges remain unchanged`);
 for(const [id,progress] of Object.entries(record.progress)){
  assert.ok(ids.has(id),`${label}: only curriculum item/set IDs in progress`);
  assert.ok(!questionIds.has(id),`${label}: no question-level progress`);
  fields(progress,progressFields,`${label} ${id}`);
 }
 for(const key of Object.keys(record.awards)){
  const [date,id,...rest]=key.split(':');
  assert.match(date,/^\d{4}-\d{2}-\d{2}$/);
  assert.equal(rest.length,0);
  assert.ok(ids.has(id),`${label}: only curriculum item/set IDs in awards`);
  assert.ok(!questionIds.has(id),`${label}: no question-level awards`);
 }
};

// All-correct is strict: empty, false and truthy non-boolean values never pass.
for(const values of [[true],[true,true],[true,true,true,true,true]]){
 const before=clone(values);
 assert.equal(readingResult(values),true);
 assert.deepEqual(values,before,'The result helper must not mutate answers.');
}
for(const values of [[],[false],[true,false],[false,true],[true,true,false],[true,1],[true,'true'],[true,null],[true,undefined],new Array(2),[true,,true],null,undefined,true,'true',{}, {length:1,0:true}]){
 assert.equal(readingResult(values),false,'Only a nonempty array containing strictly true answers is a successful set.');
}

const yesterday='2026-10-01',today='2026-10-02',tomorrow='2026-10-03';
const prior=empty();
for(const item of [...words.slice(0,30),...phrases.slice(0,3),...grammar.slice(0,5)])answer(prior,item,true,yesterday);
const priorSnapshot=clone(prior);
const restored=validate(clone(prior),ids);
assert.deepEqual(restored,priorSnapshot,'Adding reading must preserve the entire existing 30-word/3-phrase/5-grammar v2 record.');
assert.deepEqual(prior,priorSnapshot,'Validation must not mutate its input.');
assert.equal(balance(restored),38);
assert.deepEqual(seqs(dailyWords(restored,words,today)),[31,32,33]);
assert.deepEqual(seqs(dailyPhrases(restored,phrases,today)),[4,5,6]);
assert.deepEqual(seqs(dailyGrammar(restored,grammar,today)),[6,7,8,9,10]);
assert.deepEqual(seqs(dailyReading(restored,reading,today)),[1]);
const reversed=[...reading].reverse();
assert.deepEqual(dailyReading(restored,reversed,today),[reading[0]],'Daily reading is ordered by seq, not input order.');
assert.deepEqual(reversed,[...reading].reverse(),'The daily queue must not sort its input in place.');
assert.deepEqual(restored,priorSnapshot,'Reading daily queues must not mutate the saved record.');

// One answered set, even unsuccessful, reserves today's only reading slot.
const current=clone(restored),set=reading[0];
const mixedResults=set.questions.map((_,index)=>index!==0);
assert.equal(answer(current,set,readingResult(mixedResults),today).earned,false);
assert.deepEqual(Object.keys(current.progress).filter(id=>id.startsWith('r_')),[set.id]);
assert.deepEqual(seqs(dailyReading(current,reading,today)),[1]);
assert.equal(balance(current),38);
assert.equal(current.progress[set.id].correct,false);
assertSetOnlyRecord(current,'unsuccessful reading set');
const allCorrect=set.questions.map(()=>true);
assert.equal(answer(current,set,readingResult(allCorrect),today).earned,true,'A same-day retry after an error can earn the set PT.');
assert.equal(current.awards[`${today}:${set.id}`],true);
assert.equal(balance(current),39,'A complete set earns one PT, not one PT per question.');
assert.equal(current.progress[set.id].errors,1);
assert.deepEqual(seqs(dailyReading(current,reading,today)),[1],'The completed set continues to reserve the daily slot.');
assert.deepEqual(seqs(dailyReading(current,reading,tomorrow)),[2],'The next day starts the next unseen set.');
const sameDaySnapshot=clone(current);
for(const correct of [true,false,true]){
 assert.equal(answer(current,set,correct,today).earned,false);
 assert.deepEqual(current,sameDaySnapshot,'Repeating a successful set on the same day changes neither records nor PT.');
}
for(const count of [3,5,10,20]){
 current.settings.dailyNew=count;
 assert.deepEqual(seqs(dailyWords(current,words,today)),Array.from({length:count},(_,index)=>index+31));
 assert.deepEqual(seqs(dailyPhrases(current,phrases,today)),[4,5,6]);
 assert.deepEqual(seqs(dailyGrammar(current,grammar,today)),[6,7,8,9,10]);
 assert.deepEqual(seqs(dailyReading(current,reading,today)),[1]);
 assert.deepEqual(seqs(dailyReading(current,reading,tomorrow)),[2]);
 const newDay=clone(restored);newDay.settings.dailyNew=count;
 assert.deepEqual(seqs(dailyReading(newDay,reading,today)),[1],'Word settings cannot enlarge even an unstarted reading queue.');
}
for(const [id,progress] of Object.entries(priorSnapshot.progress))assert.deepEqual(current.progress[id],progress,'Reading cannot alter old word/phrase/grammar progress.');
for(const [key,award] of Object.entries(priorSnapshot.awards))assert.equal(current.awards[key],award,'Reading cannot alter existing awards.');
assert.deepEqual(validate(clone(current),ids),current,'Reading sets survive JSON export/import and validation.');
assert.deepEqual(merge(current,current),current,'Self-merge is idempotent.');
assertSetOnlyRecord(current,'successful reading set');

// Reading uses exactly the shared word SRS, including due-date and early-practice rules.
const review=empty(),wordReview=empty();
const compareAnswer=(correct,date)=>{
 assert.deepEqual(answer(review,set,correct,date),answer(wordReview,words[0],correct,date));
 assert.deepEqual(review.progress[set.id],wordReview.progress[words[0].id],'Reading and word SRS fields stay identical after the same answers.');
 assert.equal(balance(review),balance(wordReview));
};
assert.equal(eligible(review,set,yesterday),true);
compareAnswer(true,yesterday);
assert.deepEqual(review.progress[set.id],{stage:0,due:today,last:yesterday,errors:0,correct:true,first:yesterday});
assert.equal(eligible(review,set,today),true);
compareAnswer(true,today);
assert.deepEqual(review.progress[set.id],{stage:1,due:'2026-10-05',last:today,errors:0,correct:true,first:yesterday});
assert.equal(balance(review),2);
assert.equal(eligible(review,set,tomorrow),false);
const scheduledSnapshot=clone(review);
for(const correct of [true,false]){
 compareAnswer(correct,tomorrow);
 assert.deepEqual(review,scheduledSnapshot,'Early reading practice, correct or incorrect, must not move records or awards.');
}
compareAnswer(false,'2026-10-05');
assert.equal(review.progress[set.id].stage,0);
assert.equal(review.progress[set.id].due,'2026-10-06');
assert.equal(review.progress[set.id].errors,1);
compareAnswer(true,'2026-10-05');
compareAnswer(true,'2026-10-05');
assert.equal(balance(review),3);
assert.equal(review.progress[set.id].first,yesterday);
for(const [date,stage,due] of [
 ['2026-10-06',1,'2026-10-09'],
 ['2026-10-09',2,'2026-10-16'],
 ['2026-10-16',3,'2026-10-30'],
 ['2026-10-30',4,'2026-11-29'],
 ['2026-11-29',4,'2026-12-29'],
]){
 compareAnswer(true,date);
 assert.equal(review.progress[set.id].stage,stage,'Reading stages progress to, and stay capped at, four.');
 assert.equal(review.progress[set.id].due,due,'The existing 1/3/7/14/30-day intervals remain unchanged.');
 assert.equal(review.progress[set.id].errors,1);
 assert.equal(review.progress[set.id].first,yesterday);
}
assertSetOnlyRecord(review,'reviewed reading set');

// The award date remains Japan time, not the browser's local/UTC calendar date.
const jstBefore=day(new Date('2026-10-01T14:59:59Z'));
const jstAfter=day(new Date('2026-10-01T15:00:00Z'));
assert.equal(jstBefore,yesterday);assert.equal(jstAfter,today);
const midnight=empty();
assert.equal(answer(midnight,set,true,jstBefore).earned,true);
assert.equal(answer(midnight,set,true,jstBefore).earned,false);
assert.equal(answer(midnight,set,true,jstAfter).earned,true);
assert.equal(balance(midnight),2);

// Merge preserves each type, the latest reading review, and the earliest first day.
const incoming=empty();
answer(incoming,set,true,yesterday);
answer(incoming,set,true,tomorrow);
answer(incoming,reading[1],true,tomorrow);
const currentBefore=clone(current),incomingBefore=clone(incoming);
const combined=merge(current,incoming);
assert.deepEqual(current,currentBefore,'Merge cannot mutate its destination input.');
assert.deepEqual(incoming,incomingBefore,'Merge cannot mutate its imported input.');
assert.equal(combined.settings.dailyNew,20,'Import preserves the destination word setting.');
assert.equal(combined.progress[set.id].last,tomorrow);
assert.equal(combined.progress[set.id].first,yesterday);
assert.equal(combined.progress[reading[1].id].first,tomorrow);
assert.equal(balance(combined),42);
assert.deepEqual(validate(clone(combined),ids),combined);
assert.deepEqual(merge(combined,incoming),combined,'Reimporting the same backup must not duplicate PT.');
for(const id of Object.keys(priorSnapshot.progress))assert.deepEqual(combined.progress[id],priorSnapshot.progress[id]);
assertSetOnlyRecord(combined,'merged reading backup');

const createStorage=()=>({data:new Map(),writes:[],getItem(key){return this.data.get(key)??null;},setItem(key,value){this.writes.push(key);this.data.set(key,value);}});
const storage=createStorage();
assert.deepEqual(readRecord(storage,ids),empty());
assert.deepEqual(saveRecord(storage,combined,ids),combined);
assert.deepEqual(readRecord(storage,ids),combined);
assert.deepEqual(JSON.parse(storage.getItem(KEY)),combined);
assert.equal(storage.getItem(BACKUP_KEY),null,'Saving v2 reading records must not invent a v1 backup.');
assert.deepEqual(saveRecord(storage,readRecord(storage,ids),ids),combined);
assertSetOnlyRecord(readRecord(storage,ids),'stored reading backup');

// Reject unknown reading IDs and EVERY question ID, in progress and awards.
const rejectedIds=['r_l1_999',...questionIds];
for(const id of rejectedIds){
 assert.ok(!ids.has(id));
 const invalidProgress={...combined,progress:{...combined.progress,[id]:clone(combined.progress[set.id])}};
 const invalidAward={...combined,awards:{...combined.awards,[`${today}:${id}`]:true}};
 const storedBefore=storage.getItem(KEY),writesBefore=storage.writes.length;
 for(const invalid of [invalidProgress,invalidAward]){
  assert.throws(()=>validate(invalid,ids),`${id}: invalid record ID must be rejected`);
  assert.throws(()=>saveRecord(storage,invalid,ids),`${id}: invalid save must be rejected`);
  assert.equal(storage.getItem(KEY),storedBefore,'A rejected import cannot overwrite valid saved data.');
  assert.equal(storage.writes.length,writesBefore,'Invalid data must be rejected before any storage write.');
  const malformed={getItem:key=>key===KEY?JSON.stringify(invalid):null};
  assert.throws(()=>readRecord(malformed,ids),`${id}: persisted invalid IDs must also fail validation`);
 }
}

// Use the original schema-v1 fixture, not a newly manufactured reading-era record.
const fixtureRaw=fs.readFileSync(new URL('./fixtures/v1-record.json',import.meta.url),'utf8');
const v1=JSON.parse(fixtureRaw),v1Snapshot=clone(v1),migrated=validate(v1,ids);
assert.deepEqual(v1,v1Snapshot,'Migration must not mutate the original fixture.');
assert.equal(migrated.schemaVersion,2);
assert.deepEqual(migrated.settings,{dailyNew:3});
assert.deepEqual(Object.keys(migrated.progress),Object.keys(v1.progress));
assert.deepEqual(migrated.awards,v1.awards);
assert.equal(balance(migrated),balance(v1));
for(const [id,progress] of Object.entries(v1.progress)){
 const {first,...oldFields}=migrated.progress[id];
 assert.deepEqual(oldFields,progress);
 assert.equal(first,progress.last);
}
for(const date of ['2026-10-10','2026-10-15','2026-10-25']){
 assert.deepEqual(Object.keys(migrated.progress).filter(id=>migrated.progress[id].due<=date),Object.keys(v1.progress).filter(id=>v1.progress[id].due<=date));
}
assert.deepEqual(dailyReading(migrated,reading,today),[set]);
assertSetOnlyRecord(migrated,'migrated original v1 fixture');
// Surrounding whitespace deliberately proves that the source bytes are not reserialized.
const rawV1='  '+fixtureRaw+'\n';
const legacyStorage=createStorage();legacyStorage.data.set(KEY,rawV1);
const migratedWithReading=readRecord(legacyStorage,ids);
assert.equal(legacyStorage.getItem(KEY),rawV1,'Reading a v1 record is non-destructive.');
assert.equal(legacyStorage.getItem(BACKUP_KEY),null);
assert.deepEqual(legacyStorage.writes,[]);
answer(migratedWithReading,set,true,today);
saveRecord(legacyStorage,migratedWithReading,ids);
assert.equal(legacyStorage.getItem(BACKUP_KEY),rawV1,'The original v1 bytes are backed up before the first v2 reading write.');
assert.deepEqual(legacyStorage.writes,[BACKUP_KEY,KEY],'The raw v1 backup must be written before replacing the original.');
assert.deepEqual(readRecord(legacyStorage,ids),migratedWithReading);
saveRecord(legacyStorage,readRecord(legacyStorage,ids),ids);
assert.equal(legacyStorage.getItem(BACKUP_KEY),rawV1,'Subsequent reading saves cannot overwrite the original v1 backup.');
assert.deepEqual(legacyStorage.writes,[BACKUP_KEY,KEY,KEY]);
assertSetOnlyRecord(readRecord(legacyStorage,ids),'v1 migration plus reading');

// An already present backup, even empty, is never replaced during another migration.
const existingBackup=createStorage();existingBackup.data.set(KEY,rawV1);existingBackup.data.set(BACKUP_KEY,'');
saveRecord(existingBackup,migratedWithReading,ids);
assert.equal(existingBackup.getItem(BACKUP_KEY),'');
assert.deepEqual(existingBackup.writes,[KEY]);
// A backup failure must leave the original v1 record fully intact, with no v2 write.
const failingBackup=createStorage();failingBackup.data.set(KEY,rawV1);
const failBeforeV2={getItem:key=>failingBackup.getItem(key),setItem:(key,value)=>{
 if(key===BACKUP_KEY)throw Error('simulated backup quota failure');
 failingBackup.setItem(key,value);
}};
assert.throws(()=>saveRecord(failBeforeV2,migratedWithReading,ids),/simulated backup quota failure/);
assert.equal(failingBackup.getItem(KEY),rawV1);
assert.equal(failingBackup.getItem(BACKUP_KEY),null);
assert.deepEqual(failingBackup.writes,[]);
// Corrupt stored input must not be replaced by a seemingly valid new reading record.
const corrupt=createStorage();corrupt.data.set(KEY,'{broken');
assert.throws(()=>readRecord(corrupt,ids));
assert.throws(()=>saveRecord(corrupt,combined,ids));
assert.equal(corrupt.getItem(KEY),'{broken');
assert.deepEqual(corrupt.writes,[]);

// E07 adds words without rewriting an E06 v2 record or advancing other queues.
// E06 had only the original 60 phrases; later additions are not historical IDs.
const legacyIds=new Set([...words.slice(0,90),...phrases.slice(0,60),...grammar.slice(0,50),...reading].map(item=>item.id));
assert.equal(legacyIds.size,210,'The pre-E07 curriculum has exactly 210 record IDs.');
const learnedBeforeExpansion=[...words.slice(0,90),...phrases.slice(0,3),...grammar.slice(0,5),reading[0]];
const legacyRecord=empty();
for(const item of learnedBeforeExpansion)answer(legacyRecord,item,true,yesterday);
const legacySnapshot=clone(legacyRecord),legacyRaw=JSON.stringify(legacyRecord);
assert.equal(legacyRecord.schemaVersion,2);
assert.equal(Object.keys(legacyRecord.progress).length,99,'The fixture contains 90 words, 3 phrases, 5 grammar questions and 1 reading set.');
assert.equal(balance(legacyRecord),99);
assert.deepEqual(validate(clone(legacyRecord),legacyIds),legacySnapshot,'The synthetic record is already valid under the old E06 IDs.');
const expandedRecord=validate(clone(legacyRecord),ids);
assert.deepEqual(expandedRecord,legacySnapshot,'Adding 60 word IDs must preserve every v2 record field and award.');
assert.deepEqual(legacyRecord,legacySnapshot,'Expanded-ID validation must not mutate the old record.');
assert.deepEqual(validate(clone(expandedRecord),ids),legacySnapshot,'The entire mixed record survives JSON export/import.');
assert.deepEqual(merge(expandedRecord,expandedRecord),legacySnapshot,'Reimporting the old mixed record cannot duplicate progress or PT.');
assertSetOnlyRecord(expandedRecord,'learned-90 mixed v2 record');
const legacyV2Storage=createStorage();legacyV2Storage.data.set(KEY,legacyRaw);
assert.deepEqual(readRecord(legacyV2Storage,ids),legacySnapshot,'Existing E06 storage is readable with the expanded IDs.');
assert.equal(legacyV2Storage.getItem(KEY),legacyRaw,'Reading the old v2 record must not rewrite it.');
assert.deepEqual(legacyV2Storage.writes,[]);
assert.deepEqual(saveRecord(legacyV2Storage,readRecord(legacyV2Storage,ids),ids),legacySnapshot);
assert.equal(legacyV2Storage.getItem(KEY),legacyRaw,'The unchanged v2 record roundtrips byte-for-byte.');
assert.equal(legacyV2Storage.getItem(BACKUP_KEY),null,'An existing v2 record needs no schema-v1 backup.');
assert.deepEqual(legacyV2Storage.writes,[KEY]);
assert.deepEqual(readRecord(legacyV2Storage,ids),legacySnapshot);
for(const count of [3,20]){
 const continued=clone(expandedRecord);continued.settings.dailyNew=count;
 const continuedSnapshot=clone(continued);
 const expected=Array.from({length:count},(_,index)=>index+91);
 assert.deepEqual(seqs(dailyWords(continued,words,today)),expected,`A learned-90 record with dailyNew=${count} starts at word 91.`);
 assert.deepEqual(seqs(dailyWords(continued,[...words].reverse(),today)),expected,'The new words follow seq, not input order.');
 assert.deepEqual(seqs(dailyPhrases(continued,phrases,today)),[4,5,6],'Adding words must not advance the phrase queue.');
 assert.deepEqual(seqs(dailyGrammar(continued,grammar,today)),[6,7,8,9,10],'Adding words must not advance the grammar queue.');
 assert.deepEqual(seqs(dailyReading(continued,reading,today)),[2],'Adding words must not advance the reading queue.');
 assert.deepEqual(continued,continuedSnapshot,'Examining every expanded queue must leave the record unchanged.');
 for(const item of dailyWords(continued,words,today))assert.equal(answer(continued,item,true,today).earned,true);
 assert.deepEqual(seqs(dailyWords(continued,words,today)),expected,'The newly learned words continue to reserve the same daily slots.');
 assert.deepEqual(seqs(dailyPhrases(continued,phrases,today)),[4,5,6]);
 assert.deepEqual(seqs(dailyGrammar(continued,grammar,today)),[6,7,8,9,10]);
 assert.deepEqual(seqs(dailyReading(continued,reading,today)),[2]);
 for(const [id,progress] of Object.entries(legacySnapshot.progress))assert.deepEqual(continued.progress[id],progress,'Learning added words must preserve every old item record.');
 for(const [key,award] of Object.entries(legacySnapshot.awards))assert.equal(continued.awards[key],award,'Learning added words must preserve every old award.');
 assert.equal(Object.keys(continued.progress).length,99+count);
 assert.equal(balance(continued),99+count);
 assert.deepEqual(validate(clone(continued),ids),continued,'Records containing the new word IDs also survive validation.');
}
assert.deepEqual(expandedRecord,legacySnapshot,'All continuation checks leave the original restored record untouched.');

// E08 adds phrases without rewriting an E07 v2 record or changing other queues.
const beforeE08Ids=new Set([...words,...phrases.slice(0,60),...grammar.slice(0,50),...reading].map(item=>item.id));
assert.equal(beforeE08Ids.size,270,'The pre-E08 curriculum has exactly 270 record IDs.');
const learnedBeforeE08=[...words,...phrases.slice(0,60),...grammar.slice(0,5),reading[0]];
const beforeE08=empty();
for(const item of learnedBeforeE08)answer(beforeE08,item,true,yesterday);
const beforeE08Snapshot=clone(beforeE08),beforeE08Raw=JSON.stringify(beforeE08);
assert.equal(beforeE08.schemaVersion,2);
assert.equal(Object.keys(beforeE08.progress).length,216,'The fixture contains 150 words, 60 phrases, 5 grammar questions and 1 reading set.');
assert.equal(balance(beforeE08),216);
assert.deepEqual(validate(clone(beforeE08),beforeE08Ids),beforeE08Snapshot,'The mixed record is already valid under the E07 IDs.');
assert.deepEqual(dailyWords(beforeE08,words,today),[],'All 150 words were already learned before E08.');
assert.deepEqual(dailyPhrases(beforeE08,phrases.slice(0,60),today),[],'All 60 previously available phrases were already learned before E08.');
const afterE08=validate(clone(beforeE08),ids);
assert.deepEqual(afterE08,beforeE08Snapshot,'Adding 60 phrase IDs must preserve every existing v2 record field and award.');
assert.deepEqual(beforeE08,beforeE08Snapshot,'Expanded-ID validation must not mutate the old record.');
assert.deepEqual(validate(clone(afterE08),ids),beforeE08Snapshot,'The 216-record fixture survives JSON export/import and validation.');
assert.deepEqual(merge(afterE08,afterE08),beforeE08Snapshot,'Reimporting the E07 record cannot duplicate progress or PT.');
assert.deepEqual(merge(empty(),afterE08),beforeE08Snapshot,'The E07 backup imports into a new v2 record without losing any item.');
assertSetOnlyRecord(afterE08,'learned-150-word/60-phrase mixed v2 record');
const beforeE08Storage=createStorage();beforeE08Storage.data.set(KEY,beforeE08Raw);
assert.deepEqual(readRecord(beforeE08Storage,ids),beforeE08Snapshot,'Existing E07 storage is readable with all 380 E09 IDs.');
assert.equal(beforeE08Storage.getItem(KEY),beforeE08Raw,'Reading the old v2 record must not rewrite it.');
assert.deepEqual(beforeE08Storage.writes,[]);
assert.deepEqual(saveRecord(beforeE08Storage,readRecord(beforeE08Storage,ids),ids),beforeE08Snapshot);
assert.equal(beforeE08Storage.getItem(KEY),beforeE08Raw,'The unchanged E07 v2 record roundtrips byte-for-byte.');
assert.equal(beforeE08Storage.getItem(BACKUP_KEY),null,'Adding phrases must not create a schema-v1 backup for an existing v2 record.');
assert.deepEqual(beforeE08Storage.writes,[KEY]);
assert.deepEqual(readRecord(beforeE08Storage,ids),beforeE08Snapshot);
for(const count of [3,5,10,20]){
 const continued=clone(afterE08);continued.settings.dailyNew=count;
 const continuedSnapshot=clone(continued),expected=[61,62,63];
 assert.deepEqual(dailyWords(continued,words,today),[],`A learned-150 record has no new words even with dailyNew=${count}.`);
 assert.deepEqual(seqs(dailyPhrases(continued,phrases,today)),expected,'The next day starts at the first added phrase, seq 61.');
 const reversedPhrases=[...phrases].reverse();
 assert.deepEqual(seqs(dailyPhrases(continued,reversedPhrases,today)),expected,'The new phrases follow seq, not input order.');
 assert.deepEqual(reversedPhrases,[...phrases].reverse(),'The phrase queue cannot sort its source in place.');
 assert.deepEqual(seqs(dailyGrammar(continued,grammar,today)),[6,7,8,9,10],'Adding phrases must not advance the grammar queue.');
 assert.deepEqual(seqs(dailyReading(continued,reading,today)),[2],'Adding phrases must not advance the reading queue.');
 assert.deepEqual(continued,continuedSnapshot,'Examining every E08 queue must leave the record unchanged.');
 const newPhrases=dailyPhrases(continued,phrases,today);
 assert.equal(answer(continued,newPhrases[0],false,today).earned,false);
 assert.equal(balance(continued),216,'An incorrect new phrase answer cannot change existing PT.');
 assert.deepEqual(seqs(dailyPhrases(continued,phrases,today)),expected,'An incorrect answer still reserves the first new phrase slot.');
 for(const item of newPhrases)assert.equal(answer(continued,item,true,today).earned,true);
 assert.deepEqual(seqs(dailyPhrases(continued,phrases,today)),expected,'The three newly learned phrases reserve the same daily slots.');
 assert.deepEqual(seqs(dailyPhrases(continued,phrases,tomorrow)),[64,65,66],'The following day starts with the next three added phrases.');
 assert.deepEqual(dailyWords(continued,words,today),[]);
 assert.deepEqual(dailyWords(continued,words,tomorrow),[]);
 for(const date of [today,tomorrow]){
  assert.deepEqual(seqs(dailyGrammar(continued,grammar,date)),[6,7,8,9,10]);
  assert.deepEqual(seqs(dailyReading(continued,reading,date)),[2]);
 }
 for(const [id,progress] of Object.entries(beforeE08Snapshot.progress))assert.deepEqual(continued.progress[id],progress,'Learning added phrases must preserve all 216 old item records.');
 for(const [key,award] of Object.entries(beforeE08Snapshot.awards))assert.equal(continued.awards[key],award,'Learning added phrases must preserve every old award.');
 assert.deepEqual(Object.keys(continued.progress).filter(id=>!beforeE08Ids.has(id)),newPhrases.map(item=>item.id),'Only phrases 61–63 gain new progress.');
 assert.deepEqual(Object.keys(continued.awards).filter(key=>!Object.hasOwn(beforeE08Snapshot.awards,key)),newPhrases.map(item=>`${today}:${item.id}`),'Only the three new phrase awards are added.');
 assert.equal(Object.keys(continued.progress).length,219);
 assert.equal(balance(continued),219,'Exactly three new PT are added to the existing 216 PT.');
 const learnedSnapshot=clone(continued);
 for(const item of newPhrases)for(const correct of [true,false])assert.equal(answer(continued,item,correct,today).earned,false);
 assert.deepEqual(continued,learnedSnapshot,'Repeated new phrase practice cannot alter saved progress or duplicate PT.');
 assert.deepEqual(validate(clone(continued),ids),learnedSnapshot,'Records containing new phrase IDs survive JSON and validation.');
 assert.throws(()=>validate(clone(continued),beforeE08Ids),'The fixture really contains new IDs that did not exist in E07.');
 assert.deepEqual(merge(continued,continuedSnapshot),learnedSnapshot,'Importing the old backup cannot erase new phrase progress or duplicate old PT.');
 assert.deepEqual(merge(continuedSnapshot,continued),learnedSnapshot,'Importing the new phrase backup preserves old records and the destination setting.');
 assert.deepEqual(merge(continued,continued),learnedSnapshot,'Reimporting the new phrase backup cannot duplicate PT.');
 assert.deepEqual(continued,learnedSnapshot,'Merge must not mutate the new phrase record.');
 assert.deepEqual(continuedSnapshot,{...beforeE08Snapshot,settings:{dailyNew:count}},'Merge must not mutate the old phrase record.');
 const continuedStorage=createStorage();continuedStorage.data.set(KEY,beforeE08Raw);
 assert.deepEqual(saveRecord(continuedStorage,continued,ids),learnedSnapshot,'New phrase progress can be saved over an E07 v2 record.');
 assert.deepEqual(readRecord(continuedStorage,ids),learnedSnapshot,'New phrase progress and all old records survive storage reload.');
 assert.deepEqual(JSON.parse(continuedStorage.getItem(KEY)),learnedSnapshot);
 assert.equal(continuedStorage.getItem(BACKUP_KEY),null);
 assert.deepEqual(continuedStorage.writes,[KEY]);
 assertSetOnlyRecord(continued,'E08 learned-three-new-phrase v2 record');
}
assert.deepEqual(afterE08,beforeE08Snapshot,'All E08 continuation checks leave the restored 216-record fixture untouched.');

// E09 extends grammar while preserving every learned E08 item and award.
const beforeE09Ids=new Set([...words,...phrases,...grammar.slice(0,50),...reading].map(item=>item.id));
assert.equal(beforeE09Ids.size,330,'The pre-E09 curriculum has exactly 330 record IDs.');
const beforeE09=empty();
for(const item of [...words,...phrases,...grammar.slice(0,50),reading[0]])answer(beforeE09,item,true,yesterday);
const beforeE09Snapshot=clone(beforeE09),beforeE09Raw=JSON.stringify(beforeE09);
assert.equal(beforeE09.schemaVersion,2);
assert.equal(Object.keys(beforeE09.progress).length,321);
assert.equal(balance(beforeE09),321);
assert.deepEqual(validate(clone(beforeE09),beforeE09Ids),beforeE09Snapshot);
assert.deepEqual(dailyGrammar(beforeE09,grammar.slice(0,50),today),[]);
const afterE09=validate(clone(beforeE09),ids);
assert.deepEqual(afterE09,beforeE09Snapshot,'Adding grammar IDs must preserve the entire learned E08 record.');
assert.deepEqual(beforeE09,beforeE09Snapshot,'Expanded-ID validation is non-mutating.');
assert.deepEqual(validate(clone(afterE09),ids),beforeE09Snapshot,'The 321-record fixture survives JSON export/import.');
assert.deepEqual(merge(afterE09,afterE09),beforeE09Snapshot);
assert.deepEqual(merge(empty(),afterE09),beforeE09Snapshot,'Importing the old backup preserves all learned items and awards.');
const beforeE09Storage=createStorage();beforeE09Storage.data.set(KEY,beforeE09Raw);
assert.deepEqual(readRecord(beforeE09Storage,ids),beforeE09Snapshot);
assert.equal(beforeE09Storage.getItem(KEY),beforeE09Raw);
assert.deepEqual(beforeE09Storage.writes,[],'Reading an old v2 record does not rewrite storage.');
assert.deepEqual(saveRecord(beforeE09Storage,readRecord(beforeE09Storage,ids),ids),beforeE09Snapshot);
assert.equal(beforeE09Storage.getItem(KEY),beforeE09Raw,'Unchanged E08 storage roundtrips byte-for-byte.');
assert.deepEqual(readRecord(beforeE09Storage,ids),beforeE09Snapshot);
assert.equal(beforeE09Storage.getItem(BACKUP_KEY),null);
assert.deepEqual(beforeE09Storage.writes,[KEY]);
for(const count of [3,5,10,20]){
 const continued=clone(afterE09);continued.settings.dailyNew=count;
 const continuedSnapshot=clone(continued),expected=[51,52,53,54,55];
 assert.deepEqual(dailyWords(continued,words,today),[]);
 assert.deepEqual(dailyPhrases(continued,phrases,today),[]);
 assert.deepEqual(seqs(dailyReading(continued,reading,today)),[2]);
 assert.deepEqual(seqs(dailyGrammar(continued,grammar,today)),expected,'The next day starts with grammar 51–55.');
 const reversed=[...grammar].reverse();
 assert.deepEqual(seqs(dailyGrammar(continued,reversed,today)),expected,'New grammar follows seq rather than input order.');
 assert.deepEqual(reversed,[...grammar].reverse(),'Daily grammar cannot mutate its source order.');
 assert.deepEqual(continued,continuedSnapshot,'Inspecting the expanded queues cannot mutate the record.');
 const newGrammar=dailyGrammar(continued,grammar,today);
 assert.equal(answer(continued,newGrammar[0],false,today).earned,false);
 assert.equal(balance(continued),321,'A wrong new grammar answer cannot alter existing PT.');
 assert.deepEqual(seqs(dailyGrammar(continued,grammar,today)),expected,'The wrong answer still reserves a daily grammar slot.');
 for(const item of newGrammar)assert.equal(answer(continued,item,true,today).earned,true);
 assert.deepEqual(seqs(dailyGrammar(continued,grammar,today)),expected);
 assert.deepEqual(seqs(dailyGrammar(continued,grammar,tomorrow)),[56,57,58,59,60],'The following day starts at grammar 56.');
 for(const date of [today,tomorrow]){
  assert.deepEqual(dailyWords(continued,words,date),[]);
  assert.deepEqual(dailyPhrases(continued,phrases,date),[]);
  assert.deepEqual(seqs(dailyReading(continued,reading,date)),[2]);
 }
 for(const [id,progress] of Object.entries(beforeE09Snapshot.progress))assert.deepEqual(continued.progress[id],progress,'All 321 old item records remain untouched.');
 for(const [key,award] of Object.entries(beforeE09Snapshot.awards))assert.equal(continued.awards[key],award,'All old awards remain untouched.');
 assert.deepEqual(Object.keys(continued.progress).filter(id=>!beforeE09Ids.has(id)),newGrammar.map(g=>g.id));
 assert.deepEqual(Object.keys(continued.awards).filter(key=>!Object.hasOwn(beforeE09Snapshot.awards,key)),newGrammar.map(g=>`${today}:${g.id}`));
 assert.equal(Object.keys(continued.progress).length,326);
 assert.equal(balance(continued),326,'Exactly five new PT are added to the existing 321 PT.');
 const learnedSnapshot=clone(continued);
 for(const item of newGrammar)for(const correct of [true,false])assert.equal(answer(continued,item,correct,today).earned,false);
 assert.deepEqual(continued,learnedSnapshot,'Repeated new grammar practice changes neither records nor PT.');
 assert.deepEqual(validate(clone(continued),ids),learnedSnapshot);
 assert.throws(()=>validate(clone(continued),beforeE09Ids),'The fixture genuinely contains previously unavailable IDs.');
 assert.deepEqual(merge(continued,continuedSnapshot),learnedSnapshot,'An old backup cannot erase new grammar progress.');
 assert.deepEqual(merge(continuedSnapshot,continued),learnedSnapshot);
 assert.deepEqual(merge(continued,continued),learnedSnapshot);
 assert.deepEqual(continued,learnedSnapshot);
 assert.deepEqual(continuedSnapshot,{...beforeE09Snapshot,settings:{dailyNew:count}});
 const continuedStorage=createStorage();continuedStorage.data.set(KEY,beforeE09Raw);
 assert.deepEqual(saveRecord(continuedStorage,continued,ids),learnedSnapshot);
 assert.deepEqual(readRecord(continuedStorage,ids),learnedSnapshot,'New grammar and all old records survive save/reload.');
 assert.deepEqual(JSON.parse(continuedStorage.getItem(KEY)),learnedSnapshot);
 assert.equal(continuedStorage.getItem(BACKUP_KEY),null);
 assert.deepEqual(continuedStorage.writes,[KEY]);
 assertSetOnlyRecord(continued,'E09 learned-five-new-grammar v2 record');
}
assert.deepEqual(afterE09,beforeE09Snapshot,'Continuation checks leave the restored E08 fixture unchanged.');

// Execute the application's actual category-button binding with a minimal DOM stub.
// This exercises its source filter rather than duplicating that predicate in the test.
const appSource=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const categoryBinding=appSource.split('\n').filter(line=>line.includes("document.querySelectorAll('[data-grammar-category]')"));
assert.equal(categoryBinding.length,1,'Locate exactly one application grammar-category binding.');
const categoryNames=['品詞','時制','態','関係詞','前置詞と接続詞','代名詞','比較','語彙'];
const categoryState=empty(),expectedWeak=new Map(categoryNames.map(category=>[category,[]]));
for(const category of categoryNames){
 const old=grammar.slice(0,50).find(g=>g.category===category);
 const fresh=grammar.slice(50).filter(g=>g.category===category);
 assert.ok(old&&fresh.length>=2);
 // Both an old and an added wrong answer must appear. A correct added item and
 // unlearned items must not appear. Correcting a prior mistake retains its errors.
 for(const g of [old,fresh[0]]){answer(categoryState,g,false,yesterday);expectedWeak.get(category).push(g.id);}
 answer(categoryState,fresh[0],true,yesterday);
 answer(categoryState,fresh[1],true,yesterday);
}
const categorySnapshot=clone(categoryState);
const buttons=categoryNames.map((_,i)=>({dataset:{grammarCategory:String(i)}}));
let selected=null,selectedMode=null;
const bindCategoryButtons=new Function('document','grammar','state','GRAMMAR_CATEGORIES','start',categoryBinding[0]);
bindCategoryButtons({querySelectorAll:selector=>{
 assert.equal(selector,'[data-grammar-category]');return buttons;
}},grammar,categoryState,categoryNames,(list,mode)=>{selected=list;selectedMode=mode;});
for(const [index,category] of categoryNames.entries()){
 buttons[index].onclick();
 assert.equal(selectedMode,'quiz');
 assert.deepEqual(selected.map(g=>g.id),expectedWeak.get(category),`${category}: only wrong old and new questions are selected`);
}
assert.deepEqual(categoryState,categorySnapshot,'Category selection must not mutate learning records or PT.');
const noErrors=empty();
bindCategoryButtons({querySelectorAll:()=>buttons},grammar,noErrors,categoryNames,(list)=>{selected=list;});
for(const button of buttons){button.onclick();assert.deepEqual(selected,[],'Unlearned questions are not weak questions.');}

const exhausted=empty();
for(const item of reading)answer(exhausted,item,true,yesterday);
assert.deepEqual(dailyReading(exhausted,reading,today),[],'An exhausted reading curriculum yields no invented sets.');
assert.deepEqual(dailyReading(empty(),[],today),[],'An empty reading source yields no invented sets.');
assert.deepEqual(dailyWords(exhausted,words,today),words.slice(0,3));
assert.deepEqual(dailyPhrases(exhausted,phrases,today),phrases.slice(0,3));
assert.deepEqual(dailyGrammar(exhausted,grammar,today),grammar.slice(0,5));
assertSetOnlyRecord(exhausted,'fully learned reading curriculum');
console.log(`Reading: 10 sets/8 single + 2 double documents/${totalQuestions} questions (${JSON.stringify(counts)}), 270 legacy entries frozen, 380 record IDs, strict set result, daily1 independence, v2 continuation, learned-90, learned-150/60 and E09 learned-150/120/50/1 continuation with actual category-button filtering, set-only SRS/JST awards/merge/JSON/storage, all question-ID rejection and original v1 raw-backup safety passed.`);
