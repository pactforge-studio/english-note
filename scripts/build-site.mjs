import {cpSync,mkdirSync,rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=join(root,'site');
rmSync(out,{recursive:true,force:true});
mkdirSync(out,{recursive:true});
for(const name of ['index.html','app.js','core.js','style.css','curriculum.json','lessons']) cpSync(join(root,name),join(out,name),{recursive:true});
console.log('Built site/ from the explicit runtime file list.');
