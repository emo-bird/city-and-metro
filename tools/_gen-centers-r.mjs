// 收紧中心点半径：ct.r * 4 是高斯尺度（格），r=7 时影响半径 28 格≈7 km，各镇会糊成一片、城区率过高。
// 2000 年各镇建成区核心多在 1–3 km（4–12 格），把 r 压到 3–6。
import { readFile, writeFile } from 'node:fs/promises';
const p = 'js/data_dg.js';
let s = await readFile(p, 'utf8');
let n = 0;
s = s.replace(/\{ x: (-?\d+), y: (-?\d+), pop: (\d+), jobs: (\d+), r: (\d+) \}/g, (m, x, y, pop, jobs, r) => {
  n++;
  const nr = Math.max(3, Math.min(6, Math.round(Number(r) * 0.55)));
  return `{ x: ${x}, y: ${y}, pop: ${pop}, jobs: ${jobs}, r: ${nr} }`;
});
await writeFile(p, s);
console.log('已收紧 ' + n + ' 个中心点半径');