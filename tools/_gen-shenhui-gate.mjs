import { readFile, writeFile } from 'node:fs/promises';
const p = 'js/data_dg.js';
let s = await readFile(p, 'utf8');
const before = s;
// 雁田接驳口跟随深惠城际延期
s = s.replace(/(dg_gate_sz', n: '雁田接驳口',[\s\S]{0,220}?)y: \[2026, 12\]/, '$1y: [2029, 12]');
if (s === before) throw new Error('雁田接驳口未匹配');
await writeFile(p, s);
console.log('雁田接驳口 y → [2029,12]');