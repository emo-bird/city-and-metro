import fs from 'node:fs';
const f = 'js/data_dg.js';
let s = fs.readFileSync(f, 'utf8');
// 地标尺度的差异体现在潜在客流上：按场地面积给非铁路设施的 pax 曲线加一个 0.55~2.2 的系数
const lm = {};
for (const m of s.matchAll(/\{ id: '(dgl\d+)', name: '[^']+', x: -?[\d.]+, y: -?[\d.]+, w: (\d+), d: (\d+), year: \d+, kind: '(\w+)' \}/g)) {
  lm[m[1]] = { w: +m[2], d: +m[3], kind: m[4] };
}
const SKIP = new Set(['rail', 'station2', 'bridge', 'arch', 'airport', 'terminal']);
let n = 0;
s = s.replace(/(\{ id: 'dg\w+', n: '[^']+', t: '(\w+)', lm: '(\w+)', pax: )(\[\[[\s\S]*?\]\])( \},)/g, (m0, head, t, id, curve, tail) => {
  const L = lm[id];
  if (!L || SKIP.has(L.kind)) return m0;
  if (t === 'rail' || t === 'air' || t === 'port') return m0;
  let arr;
  try { arr = JSON.parse(curve); } catch { return m0; }
  const area = L.w * L.d;
  const k = Math.max(0.55, Math.min(2.2, Math.sqrt(area / (300 * 240))));
  const out = arr.map(([y, v]) => [y, +(v * k).toFixed(3)]);
  n++;
  return head + JSON.stringify(out).replace(/"/g, '').replace(/,/g, ', ') + tail;
});
fs.writeFileSync(f, s);
console.log('按场地面积调整客流 ' + n + ' 条');