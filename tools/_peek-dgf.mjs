import fs from 'node:fs';
const s = fs.readFileSync('js/data_dg.js', 'utf8');
const i = s.indexOf("id: 'dgf1'");
console.log('idx', i);
if (i >= 0) console.log(JSON.stringify(s.slice(i - 150, i + 220)));
const j = s.indexOf('凤岗站');
console.log('凤岗站', j, j >= 0 ? JSON.stringify(s.slice(j - 120, j + 120)) : '');