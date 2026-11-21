import fs from 'node:fs';
const d = fs.readFileSync('js/data_dg.js', 'utf8');
const i = d.indexOf("id: 'dg-e1'");
console.log(JSON.stringify(d.slice(i - 160, i + 820)));
const j = d.indexOf("id: 'dg-e4'");
console.log('---- e4');
console.log(JSON.stringify(d.slice(j - 60, j + 700)));