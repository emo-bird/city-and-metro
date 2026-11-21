import fs from 'node:fs';
let s = fs.readFileSync('tools/_wildnames.mjs', 'utf8');
const start = s.indexOf('const reg = [');
const end = s.indexOf('\n', start);
s = s.slice(0, start) + "const reg = [...src.matchAll(/id: '(wild\\d+)', name: '([^']+)', poly: (\\[[\\s\\S]*?), scenic:/g)];" + s.slice(end);
fs.writeFileSync('tools/_wildnames.mjs', s);
console.log('patched ok');