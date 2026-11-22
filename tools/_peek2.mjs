import { readFile } from 'node:fs/promises';
const s = await readFile('js/data_dg.js', 'utf8');
const all = [...s.matchAll(/\[\[(\d{4}), /g)].map(m => +m[1]);
const bad = all.filter(y => y < 1970);
console.log('pax 样式年份总数', all.length, '小于1970的', bad.length, bad.slice(0, 20).join(','));
const m = s.match(/\{ id: 'dgpf1',[\s\S]{0,160}/);
console.log(m && m[0].replace(/\n/g, ' '));
const idx = s.indexOf("[[1888");
console.log('idx', idx, JSON.stringify(s.slice(idx - 60, idx + 40)));