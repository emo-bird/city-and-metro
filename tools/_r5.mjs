import fs from 'node:fs';
const s = fs.readFileSync('js/data_dg.js', 'utf8');
const i = s.indexOf("id: 'wild1'");
console.log(s.slice(i - 200, i + 420));