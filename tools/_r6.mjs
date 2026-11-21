import fs from 'node:fs';
let s = fs.readFileSync('tools/_wildnames.mjs', 'utf8');
const start = s.indexOf('const reg = [');
const end = s.indexOf('\n', start);
if (start < 0) { console.log('not found'); process.exit(1); }
s = s.slice(0, start) + "const reg = [...src.matchAll(/id: '(wild\\d+)', name: '([^']+)', poly: (\\[[\\s\\S]*?), open: /g)];" + s.slice(end);
fs.writeFileSync('tools/_wildnames.mjs', s);
console.log('patched ok');