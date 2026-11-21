import fs from 'node:fs';
const f = 'js/data_dg.js';
let s = fs.readFileSync(f, 'utf8');
// dg-poi 那一批（dgp 前缀）地标：同样按场地面积给客流一个系数，避免所有医院/学校都是 2723 人次
const lm = {};
for (const m of s.matchAll(/\{ id: '(dgp\d+)', name: '([^']+)', x: -?[\d.]+, y: -?[\d.]+, w: (\d+), d: (\d+), year: \d+, kind: '(\w+)' \}/g)) {
  lm[m[1]] = { w: +m[3], d: +m[4], kind: m[5] };
}
const SKIP = new Set(['rail', 'station2', 'bridge', 'arch', 'airport', 'terminal']);
let n = 0;
s = s.replace(/(\{ id: '(dg\w+)', n: '[^']+', t: '(\w+)', lm: '(dgp\d+)', pax: )(\[\[[\s\S]*?\]\])( \},)/g, (m0, head, fid, t, id, curve, tail) => {
  const L = lm[id];
  if (!L || SKIP.has(L.kind)) return m0;
  if (t === 'rail' || t === 'air' || t === 'port') return m0;
  let arr;
  try { arr = JSON.parse(curve); } catch { return m0; }
  const k = Math.max(0.6, Math.min(2.2, Math.sqrt((L.w * L.d) / (300 * 240))));
  const out = arr.map(([y, v]) => [y, +(v * k).toFixed(3)]);
  n++;
  return head + JSON.stringify(out).replace(/"/g, '').replace(/,/g, ', ') + tail;
});
fs.writeFileSync(f, s);
console.log('调整 dgp 设施客流 ' + n + ' 条');