import fs from 'node:fs';
let d = fs.readFileSync('js/data_dg.js', 'utf8');
const re = /demand: (\{[^}]*?)\s*,\s*\n\s*corridors: (\[[^\]]*\])\}/g;
let n = 0;
d = d.replace(re, (m, a, b) => { n++; return 'demand: ' + a.trim() + ',\n        corridors: ' + b + ' }'; });
fs.writeFileSync('js/data_dg.js', d);
console.log('fixed', n);