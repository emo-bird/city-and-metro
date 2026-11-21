// 按倍数压缩 DATA.centers 的半径（默认 0.65，最小 1.0 格）
import { readFile, writeFile } from 'node:fs/promises';
const p = 'js/data_dg.js';
const k = +(process.argv[2] || 0.65), min = +(process.argv[3] || 1.0);
let s = await readFile(p, 'utf8');
const i = s.indexOf('centers: [');
if (i < 0) throw new Error('未找到 centers');
const j = s.indexOf('],', i);
const body = s.slice(i, j + 2);
let n = 0;
const block = body.replace(/\{ x: ([\d.]+), y: ([\d.]+), pop: (\d+), jobs: (\d+), r: ([\d.]+) \}/g, (all, x, y, pop, jobs, r) => {
  const nr = Math.max(min, Math.round(+r * k * 100) / 100);
  n++;
  return '{ x: ' + x + ', y: ' + y + ', pop: ' + pop + ', jobs: ' + jobs + ', r: ' + nr + ' }';
});
await writeFile(p, s.slice(0, i) + block + s.slice(j + 2));
const arr = [...block.matchAll(/r: ([\d.]+)/g)].map((m) => +m[1]);
console.log('centers', n, '个 ×' + k, '半径范围', Math.min(...arr), '~', Math.max(...arr));