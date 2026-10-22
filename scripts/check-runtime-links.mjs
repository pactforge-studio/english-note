import {existsSync,readdirSync,readFileSync,statSync} from 'node:fs';
import {resolve,relative,dirname,extname,join,sep} from 'node:path';
const root=resolve(process.argv[2]||'site');
const errors=[];
let checked=0;
function target(from,raw){
  if(!raw||raw.startsWith('#')||/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(raw))return;
  // The only dynamic href in the unchanged app is esc(u), an external source URL.
  if(raw==='${esc(u)}')return;
  if(raw.includes('${')){errors.push(`${from}: unresolved runtime URL ${raw}`);return;}
  let path;
  try{path=decodeURIComponent(raw.split(/[?#]/)[0]);}catch{errors.push(`${from}: malformed URL ${raw}`);return;}
  const dest=resolve(dirname(from),path);
  if(path.startsWith('/')||relative(root,dest).startsWith('..'+sep)||relative(root,dest)==='..'){
    errors.push(`${from}: URL escapes project site: ${raw}`);return;
  }
  checked++;
  if(!existsSync(dest)||(!statSync(dest).isFile()&&!existsSync(join(dest,'index.html'))))errors.push(`${from}: missing ${raw}`);
}
function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){
  const p=join(dir,e.name);if(e.isDirectory()){walk(p);continue;}
  if(!['.html','.js','.css'].includes(extname(p)))continue;
  const s=readFileSync(p,'utf8');
  for(const m of s.matchAll(/\b(?:href|src)\s*=\s*(["'])(.*?)\1/g))target(p,m[2]);
  for(const m of s.matchAll(/\b(?:fetch|import)\s*\(\s*(["'])(.*?)\1/g))target(p,m[2]);
  for(const m of s.matchAll(/^\s*import\s+(?:[^;\n]*?\sfrom\s*)?(["'])(.*?)\1/gm))target(p,m[2]);
  for(const m of s.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g))target(p,m[1]);
}}
if(!existsSync(root)){console.error(`Missing site directory: ${root}`);process.exit(1);}
for(const file of ['index.html','app.js','core.js','style.css','curriculum.json'])if(!existsSync(join(root,file)))errors.push(`Required runtime file missing: ${file}`);
walk(root);
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
console.log(`Runtime links passed: ${checked} local references checked.`);
