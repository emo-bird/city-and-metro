import fs from 'node:fs';
const p = 'docs/新地图接入指南.md';
let s = fs.readFileSync(p, 'utf8');
const add = fs.readFileSync('tools/_doc-hooks.md', 'utf8');
if (s.includes('接入时常用到的引擎钩子')) console.log('已存在');
else { fs.writeFileSync(p, s.replace(/\s*$/, '\n\n') + add + '\n'); console.log('已追加'); }
fs.unlinkSync('tools/_doc-hooks.md');