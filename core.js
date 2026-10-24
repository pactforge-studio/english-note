export const KEY='mb_english_v1';
export const BACKUP_KEY=KEY+'_schema1_backup';
export const DAILY_COUNTS=[3,5,10,20];
export const LEVELS={L1:'基礎〜600',L2:'600〜730',L3:'730〜860',L4:'860〜'};
export const day=(d=new Date())=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
export const addDays=(date,n)=>new Date(Date.parse(date+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export const empty=()=>({schemaVersion:2,progress:{},awards:{},exchanges:[],settings:{dailyNew:3}});
const validDay=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
export function validate(s,ids){
 if(!s||![1,2].includes(s.schemaVersion)||!s.progress||!s.awards||Array.isArray(s.progress)||Array.isArray(s.awards)||!Array.isArray(s.exchanges)||s.exchanges.length)throw Error('対応する学習バックアップではありません。');
 const out=empty();
 if(s.schemaVersion===2){
  if(!s.settings||!DAILY_COUNTS.includes(s.settings.dailyNew))throw Error("1日の語数が正しくありません。");
  out.settings.dailyNew=s.settings.dailyNew;
 }
 for(const [id,p]of Object.entries(s.progress)){
  if(!ids.has(id)||!p||!Number.isInteger(p.stage)||p.stage<0||p.stage>4||!validDay(p.due)||!validDay(p.last)||!Number.isInteger(p.errors)||p.errors<0||typeof p.correct!=='boolean')throw Error('学習記録の形式が正しくありません。');
  const first=s.schemaVersion===1?p.last:p.first;
  if(!validDay(first)||first>p.last)throw Error("初回学習日の形式が正しくありません。");
  out.progress[id]={stage:p.stage,due:p.due,last:p.last,errors:p.errors,correct:p.correct,first};
 }
 for(const [id,v] of Object.entries(s.awards)){
  const [date,word,...rest]=id.split(':');
  if(rest.length||!validDay(date)||!ids.has(word)||v!==true)throw Error('ポイント記録の形式が正しくありません。');
  out.awards[id]=true;
 }
 return out;
}
export const balance=s=>Object.keys(s.awards).length;
export function eligible(s,w,date){const p=s.progress[w.id];return !p||p.due<=date;}
export function answer(s,w,correct,date){
 const prior=s.progress[w.id]; const firstToday=!prior||prior.last!==date;
 const allowed=eligible(s,w,date)||Boolean(prior&&!prior.correct&&prior.last===date);
 const key=date+':'+w.id;
 const earned=correct&&allowed&&!s.awards[key];
 if(earned)s.awards[key]=true;
 // Practice before the due date does not push the next scheduled review away.
 if(allowed){
  let stage=prior?.stage||0;
  if(!correct)stage=0;else if(firstToday&&prior?.correct)stage=Math.min(4,stage+1);
  s.progress[w.id]={stage,due:addDays(date,[1,3,7,14,30][stage]),last:date,errors:(prior?.errors||0)+(correct?0:1),correct,first:prior?.first||date};
 }
 return {earned:Boolean(earned),correct};
}
export function merge(a,b){
 const out=structuredClone(a);Object.assign(out.awards,b.awards);
 for(const [id,p]of Object.entries(b.progress)){
  const old=out.progress[id];
  out.progress[id]=structuredClone(!old||p.last>old.last?p:old);
  if(old)out.progress[id].first=old.first<p.first?old.first:p.first;
 }
 return out;
}

// The day's already learned words reserve slots, even when a smaller N is selected.
export function dailyWords(s,words,date){
 const ordered=[...words].sort((a,b)=>a.seq-b.seq);
 const learned=ordered.filter(w=>s.progress[w.id]?.first===date);
 const unseen=ordered.filter(w=>!s.progress[w.id]);
 return [...learned,...unseen.slice(0,Math.max(0,s.settings.dailyNew-learned.length))];
}
export function readRecord(storage,ids){
 const raw=storage.getItem(KEY);
 return raw?validate(JSON.parse(raw),ids):empty();
}
// Caller must hold navigator.locks(KEY). Backup failure prevents the v2 write.
export function saveRecord(storage,next,ids){
 const validated=validate(next,ids);
 const raw=storage.getItem(KEY);
 if(raw){
  const previous=JSON.parse(raw); validate(previous,ids);
  if(previous.schemaVersion===1&&storage.getItem(BACKUP_KEY)===null)storage.setItem(BACKUP_KEY,raw);
 }
 storage.setItem(KEY,JSON.stringify(validated));
 return validated;
}

// Phrase slots are independent of the selectable word count; no new saved settings.
export function dailyPhrases(s,phrases,date){
 const ordered=[...phrases].sort((a,b)=>a.seq-b.seq);
 const learned=ordered.filter(p=>s.progress[p.id]?.first===date);
 return [...learned,...ordered.filter(p=>!s.progress[p.id]).slice(0,Math.max(0,3-learned.length))];
}
export const itemText=item=>item.phrase??item.word??`${item.documents?'読解':'文法'} ${item.id}`;
export const escapePattern=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export const clozeText=item=>item.example.replace(new RegExp('\\b'+escapePattern(itemText(item))+'\\b','i'),'______');

// Grammar has its own fixed five slots, without changing the saved schema.
export function dailyGrammar(s,grammar,date){
 const ordered=[...grammar].sort((a,b)=>a.seq-b.seq);
 const learned=ordered.filter(g=>s.progress[g.id]?.first===date);
 return [...learned,...ordered.filter(g=>!s.progress[g.id]).slice(0,Math.max(0,5-learned.length))];
}
export const GRAMMAR_CATEGORIES=['品詞','時制','態','関係詞','前置詞と接続詞','代名詞','比較','語彙'];

// Reading reserves one set per day, independently of other material counts.
export function dailyReading(s,reading,date){
 const ordered=[...reading].sort((a,b)=>a.seq-b.seq);
 const learned=ordered.filter(r=>s.progress[r.id]?.first===date);
 return [...learned,...ordered.filter(r=>!s.progress[r.id]).slice(0,Math.max(0,1-learned.length))];
}
export const readingResult=answers=>Array.isArray(answers)&&answers.length>0&&Array.from(answers).every(ok=>ok===true);
