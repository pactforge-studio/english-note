import {KEY,day,empty,validate,balance,answer,eligible,merge} from './core.js';
const app=document.querySelector('#app');const alertBox=document.querySelector('#alert');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let curriculum,words,ids,state=empty(),session=null,lastDay=day();
const notice=t=>{alertBox.textContent=t;alertBox.hidden=!t;};
const read=()=>{const raw=localStorage.getItem(KEY);return raw?validate(JSON.parse(raw),ids):empty();};
async function mutate(fn){
 if(!navigator.locks)throw Error('保存には最新版のChromeなどの対応ブラウザで開いてください。');
 return navigator.locks.request(KEY,async()=>{const next=read();const result=fn(next);localStorage.setItem(KEY,JSON.stringify(next));state=next;notice('');return result;});
}
function released(){return curriculum.lessons.filter(l=>l.date<=day()).flatMap(l=>l.words);}
function todays(){return curriculum.lessons.find(l=>l.date===day())?.words||[];}
function due(){return released().filter(w=>state.progress[w.id]&&state.progress[w.id].due<=day());}
function button(text,id,secondary=false){return `<button class="${secondary?'secondary':'primary'}" id="${id}">${text}</button>`;}
function bind(id,fn){const e=document.getElementById(id);if(e)e.onclick=fn;}
function go(hash){if(location.hash===hash)render();else location.hash=hash;}
function earnedToday(){return Object.keys(state.awards).filter(k=>k.startsWith(day()+':')).length;}
function detail(w){return `<div class="eyebrow">${esc(w.pos)}</div><div class="word-title" lang="en">${esc(w.word)}</div><p class="meaning">${esc(w.meaning)}</p><p class="example" lang="en">${esc(w.example)}</p><p class="translation">${esc(w.translation)}</p><p>${esc(w.note)}</p><details><summary>語源・出典を見る</summary><p>${esc(w.etymology)}</p>${w.sources.map(u=>`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">Merriam-Websterで確認 ↗</a>`).join('')}</details>`;}
function start(list,mode){if(!list.length)return;session={list:list.map(w=>w.id),index:0,mode,phase:mode==='learn'?'learn':'quiz',results:[],answered:false};go('#session');}
function home(){
 const today=todays(),p=balance(state),n=due().length;
 app.innerHTML=`<div class="eyebrow">${day().replaceAll('-',' / ')} ・ DAILY NOTE</div><h1>今日も、3語から。</h1><p class="muted">覚える、確かめる。少しずつ積み重ねよう。</p><section class="card daily"><div class="row"><h2>今日の3単語</h2><span class="pill">基礎〜600点</span></div>${today.length?`<ul class="word-list">${today.map((w,i)=>`<li><span><small>0${i+1}　</small><strong lang="en">${esc(w.word)}</strong></span><small>${state.awards[day()+':'+w.id]?'✓ 1pt獲得済み':esc(w.pos)}</small></li>`).join('')}</ul>${button('3単語を学ぶ →','learn')}${button('確認問題から始める','test',true)}`:`<p>今日の教材はまだ登録されていません。</p><a href="#words">過去の教材で学習する →</a>`}<p class="form-note">毎日22:15のタスクと共通の教材です。日付は日本時間です。</p></section><section class="card"><div class="row"><div><h2>思い出す練習</h2><span class="muted">復習予定 ${n}語</span></div><button id="review" class="small-button">復習へ →</button></div></section><section class="card points"><div class="row"><div><div class="eyebrow" style="color:#bbd0e8">学習ポイント</div><div class="point-number">${p} <small>pt</small></div><small>今日 ＋${earnedToday()}pt</small></div><div class="ring" style="--fill:${Math.min(100,p)}%"><span>${Math.min(100,p)} / 100</span></div></div><p class="muted">${p>=100?'100ptに到達しました。':`100ptまで あと${100-p}pt。`}本編アイテムとの交換は準備中です。</p></section>`;
 bind('learn',()=>start(today,'learn'));bind('test',()=>start(today,'quiz'));bind('review',()=>go('#review'));
}
function review(){const list=due();app.innerHTML=`<div class="eyebrow">REVIEW</div><h1>思い出す練習</h1><p class="muted">復習の時期が来た単語から、確かめよう。</p><section class="card">${list.length?`<h2>今日は ${list.length}語</h2><p>${list.map(w=>esc(w.word)).join(' ・ ')}</p>${button('復習を始める →','begin-review')}`:'<div class="empty"><span class="pill">すべて確認済み</span><strong>今の復習予定はありません</strong><p class="muted">学んだ単語は、日を空けてここに並びます。</p><a href="#home">今日の3語へ →</a></div>'}</section><p class="form-note">翌日・3日後・7日後・14日後・30日後を目安に出題。間違えた単語は翌日にもう一度確認します。</p>`;bind('begin-review',()=>start(list,'quiz'));}
function dictionary(){
 app.innerHTML=`<div class="eyebrow">WORD BOOK</div><h1>単語帳</h1><label class="field">単語・意味で検索<input id="search" type="search" placeholder="例：confirm、確認" autocomplete="off"></label><label class="field">表示する単語<select id="filter"><option value="all">公開済みのすべて</option><option value="weak">苦手な単語</option><option value="unseen">未学習の単語</option></select></label><div id="word-results"></div><p class="form-note">教材収録：${curriculum.startDate}〜${curriculum.endDate}（${words.length}語）。未来の日付の教材は当日から表示します。過去タスクの配信本文は未取得のため、収録していません。</p>`;
 function list(){const q=document.querySelector('#search').value.toLowerCase().trim(),f=document.querySelector('#filter').value;const ws=released().filter(w=>(w.word+' '+w.meaning).toLowerCase().includes(q)&&(f==='all'||(f==='weak'&&(state.progress[w.id]?.errors||0)>0)||(f==='unseen'&&!state.progress[w.id])));document.querySelector('#word-results').innerHTML=`<p class="count">${ws.length}語</p>${ws.map(w=>`<article class="word-entry"><div class="row"><strong lang="en">${esc(w.word)}</strong><span class="pill">${state.progress[w.id]?'学習済み':'未学習'}</span></div><p>${esc(w.meaning)}</p><button class="link-button" data-word="${w.id}">意味・例文を確認 →</button></article>`).join('')||'<p>該当する単語はありません。</p>'}`;document.querySelectorAll('[data-word]').forEach(b=>b.onclick=()=>start([words.find(w=>w.id===b.dataset.word)],'learn'));}
 document.querySelector('#search').oninput=list;document.querySelector('#filter').onchange=list;list();
}
function record(){
 const p=balance(state);app.innerHTML=`<div class="eyebrow">YOUR PROGRESS</div><h1>学習の記録</h1><div class="stats"><div><strong>${Object.keys(state.progress).length}</strong><small>学習した単語</small></div><div><strong>${p}</strong><small>累計獲得pt</small></div><div><strong>${earnedToday()}</strong><small>今日のpt</small></div></div><section class="card"><h2>本編へのごほうび</h2><p class="point-number">${p} <small>pt</small></p><p>100ptでアイテムと交換する予定です。交換機能はまだ準備中です。今はポイントが貯まります。</p><a href="https://pactforge-studio.github.io/monster-rpg-ver8/">モンスターバトルを開く ↗</a></section><section class="card"><h2>ポイントのルール</h2><p>新しい単語と復習予定の単語は、正解で1pt。同じ単語は日本時間で1日1ptまでです。間違えても、再挑戦で正解すれば獲得できます。</p><p class="form-note">復習予定より前の練習は追加ptの対象外です。</p></section><section class="card"><h2>学習記録のバックアップ</h2><p>記録はこのブラウザに保存されます。データ削除や機種変更の前に書き出してください。</p>${button('バックアップを書き出す','export',true)}<label class="field">バックアップを読み込む<input class="file-input" type="file" id="import" accept="application/json,.json"></label><p class="form-note">現在の記録に統合します。同じ獲得履歴は重複加算しません。本編のセーブは含みません。</p></section>`;
 bind('export',()=>{try{const raw=localStorage.getItem(KEY)||JSON.stringify(empty());const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='english-note-'+day()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){notice('書き出せませんでした：'+e.message);}});
 document.querySelector('#import').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2000000)throw Error('ファイルが大きすぎます。');const imported=validate(JSON.parse(await file.text()),ids);await mutate(s=>Object.assign(s,merge(s,imported)));render();notice('バックアップを統合しました。');}catch(e){notice('読み込めませんでした：'+e.message);}};
}
function shuffle(a){return [...a].sort(()=>Math.random()-.5);}
function sessionView(){
 if(!session){go('#home');return;}
 const s=session,w=words.find(w=>w.id===s.list[s.index]);
 if(!w){const n=s.results.filter(r=>r.correct).length,g=s.results.filter(r=>r.earned).length;app.innerHTML=`<div class="eyebrow">SESSION COMPLETE</div><h1>おつかれさまでした。</h1><section class="card"><h2>今回の学習</h2><div class="stats"><div><strong>${s.list.length}</strong><small>取り組んだ語数</small></div><div><strong>${n}</strong><small>正解した語数</small></div><div><strong>＋${g}</strong><small>獲得pt</small></div></div><p>学習記録を保存しました。</p>${button('今日のページへ','done')}</section>`;bind('done',()=>{session=null;go('#home');});return;}
 app.innerHTML=`<div class="row"><a href="#home">‹ 今日へ</a><span class="count">${s.index+1} / ${s.list.length}</span></div><div class="progress"><span style="width:${s.index/s.list.length*100}%"></span></div><section class="card" id="exercise"></section>`;
 const box=document.querySelector('#exercise');
 if(s.phase==='learn'){box.innerHTML=`<span class="pill">単語を学ぶ</span>${detail(w)}${button('確認問題へ →','to-quiz')}`;bind('to-quiz',()=>{s.phase='quiz';sessionView();});return;}
 s.answered=false;
 const isCloze=Boolean(state.progress[w.id]?.correct);
 const correct=isCloze?w.word:w.meaning;
 const opts=shuffle([correct,...(isCloze?w.clozeDistractors:w.meaningDistractors)]);
 const prompt=isCloze?w.example.replace(new RegExp('\\b'+w.word+'\\b','i'),'______'):w.word;
 box.innerHTML=`<span class="pill">${isCloze?'例文の穴埋め':'意味を選ぶ'}</span><h2 style="margin-top:18px">${isCloze?'空欄に入る単語は？':'この単語の意味は？'}</h2><p class="${isCloze?'example':'word-title'}" lang="en">${esc(prompt)}</p>${isCloze?`<p class="translation">${esc(w.translation)}</p>`:''}<div class="choices">${opts.map((o,i)=>`<button class="choice" data-option="${i}"><b>${'ABCD'[i]}</b><span>${esc(o)}</span></button>`).join('')}</div><div id="feedback" aria-live="polite"></div>`;
 document.querySelectorAll('[data-option]').forEach(b=>b.onclick=async()=>{
  if(s.answered)return;s.answered=true;document.querySelectorAll('[data-option]').forEach(x=>x.disabled=true);
  const ok=opts[Number(b.dataset.option)]===correct;
  try{
   const result=await mutate(st=>answer(st,w,ok,day()));
   document.querySelectorAll('[data-option]').forEach(x=>{if(opts[Number(x.dataset.option)]===correct)x.classList.add('correct');});if(!ok)b.classList.add('wrong');
   const fb=document.querySelector('#feedback');fb.innerHTML=`<div class="feedback ${ok?'':'wrong'}"><strong>${ok?'正解です':'正解を確認しよう'}</strong><p>${ok?(result.earned?'＋1pt を保存しました。':'今回は練習です。追加ポイントはありません。'):esc(correct)}</p><p>${esc(w.note)}</p></div>${ok?button('次へ →','next'):button('もう一度答える','retry')}${!ok?button('今回は次へ進む','skip',true):''}`;
   const advance=()=>{s.results.push(result);s.index++;s.phase=s.mode==='learn'?'learn':'quiz';sessionView();window.scrollTo(0,0);};
   bind('next',advance);bind('skip',advance);bind('retry',sessionView);
  }catch(e){s.answered=false;document.querySelectorAll('[data-option]').forEach(x=>x.disabled=false);notice('保存できませんでした。記録は上書きしていません。'+e.message);}
 });
}
function render(){
 try{state=read();}catch(e){notice('学習記録を読み込めませんでした。元のデータは残しています。「記録」から書き出して保管してください。');}
 const route=location.hash.slice(1)||'home';document.querySelectorAll('nav a').forEach(a=>{const active=a.hash==='#'+route;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 ({home,review,words:dictionary,record,session:sessionView}[route]||home)();
}
async function boot(){try{const r=await fetch('./curriculum.json',{cache:'no-store'});if(!r.ok)throw Error('教材を取得できません');curriculum=await r.json();words=curriculum.lessons.flatMap(l=>l.words);ids=new Set(words.map(w=>w.id));render();}catch(e){app.innerHTML='<section class="card"><h1>教材を読み込めませんでした</h1><p>通信を確認して、もう一度お試しください。</p><button class="primary" id="reload">再読み込み</button></section>';bind('reload',()=>location.reload());}}
window.addEventListener('hashchange',()=>{if(curriculum){render();window.scrollTo(0,0);}});
window.addEventListener('storage',e=>{if(e.key===KEY&&curriculum&&location.hash!=='#session')render();});
window.addEventListener('focus',()=>{if(day()!==lastDay){lastDay=day();if(location.hash!=='#session'&&curriculum)render();}});
setInterval(()=>{if(day()!==lastDay){lastDay=day();if(curriculum&&location.hash!=='#session')render();}},30000);
boot();
