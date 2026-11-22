import { readFile, writeFile } from 'node:fs/promises';
const p = 'js/data_dg.js';
let s = await readFile(p, 'utf8');
const before = s;
s = s.replace('{ id: "dg_深惠城际", kind: \'rail\', name: "深惠城际", speed: 160, head: [[2026, 20], [2036, 15]], y0: [2026, 12]',
              '{ id: "dg_深惠城际", kind: \'rail\', name: "深惠城际", speed: 160, head: [[2029, 20], [2036, 15]], y0: [2029, 12]');
if (s === before) throw new Error('深惠城际行未匹配');
await writeFile(p, s);
console.log('深惠城际 y0 → [2029,12]');