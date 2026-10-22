export const KEY='mb_english_v1';
export const day=(d=new Date())=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
export const addDays=(date,n)=>new Date(Date.parse(date+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export const empty=()=>({schemaVersion:1,progress:{},awards:{},exchanges:[]});
const validDay=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
export function validate(s,ids){
 if(!s||s.schemaVersion!==1||!s.progress||!s.awards||Array.isArray(s.progress)||Array.isArray(s.awards)||!Array.isArray(s.exchanges)||s.exchanges.length)throw Error('対応する学習バックアップではありません。');
 const out=empty();
 for(const [id,p]of Object.entries(s.progress)){
  if(!ids.has(id)||!p||!Number.isInteger(p.stage)||p.stage<0||p.stage>4||!validDay(p.due)||!validDay(p.last)||!Number.isInteger(p.errors)||p.errors<0||typeof p.correct!=='boolean')throw Error('学習記録の形式が正しくありません。');
  out.progress[id]={stage:p.stage,due:p.due,last:p.last,errors:p.errors,correct:p.correct};
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
  s.progress[w.id]={stage,due:addDays(date,[1,3,7,14,30][stage]),last:date,errors:(prior?.errors||0)+(correct?0:1),correct};
 }
 return {earned:Boolean(earned),correct};
}
export function merge(a,b){
 const out=structuredClone(a);Object.assign(out.awards,b.awards);
 for(const [id,p]of Object.entries(b.progress))if(!out.progress[id]||p.last>out.progress[id].last)out.progress[id]=p;
 return out;
}
