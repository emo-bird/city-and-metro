import { readFile, writeFile } from 'node:fs/promises';
const p = 'js/data_dg.js';
let s = await readFile(p, 'utf8');
let n = 0;
for (const id of ['gz_out', 'sz_out', 'hz_out', 'zs_out']) {
  const re = new RegExp("(\\{ id: '" + id + "',[^\\n]*?)open: 1990");
  if (!re.test(s)) throw new Error('未找到 ' + id);
  s = s.replace(re, '$1open: null');
  n++;
}
const re2 = /defaultRegion: \{[^}]*open: 1990/;
if (!re2.test(s)) throw new Error('未找到 defaultRegion');
s = s.replace(re2, (m) => m.replace('open: 1990', 'open: null'));
n++;
await writeFile(p, s);
console.log('市外片区改为 open: null，共', n, '处');