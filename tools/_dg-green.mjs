// 分析 dg 的林地（woods）与公园（parks）分布，给出可作"自然区域"的候选多边形
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const src = await readFile('js/geo_dg.js', 'utf8');
const CM = { GEOS: {} };
vm.runInNewContext(src, { window: { CM }, CM, console });
const G = CM.GEOS.dg;
const dec = (s) => {
  const out = []; let x = 0, y = 0, i = 0;
  while (i < s.length) {
    const rd = () => { let v = 0, sh = 0, ch; do { ch = s.charCodeAt(i++) - 63; v |= (ch & 31) << sh; sh += 5; } while (ch & 32); return (v & 1) ? ~(v >> 1) : v >> 1; };
    x += rd(); y += rd(); out.push([x / 64, y / 64]);
  }
  return out;
};
const area = (p) => { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]); return Math.abs(a / 2); };
function group(rows) {
  const named = new Map();
  for (const r of rows) {
    const nm = G.names[r[0]] || '(无名)';
    const parts = r.slice(1).filter((v) => typeof v === 'string' && v[0] === 'o').map((v) => dec(v.slice(1)));
    const a = parts.reduce((s, p) => s + area(p), 0);
    const all = parts.flat();
    const bb = [Math.min(...all.map((p) => p[0])), Math.min(...all.map((p) => p[1])), Math.max(...all.map((p) => p[0])), Math.max(...all.map((p) => p[1]))];
    const o = named.get(nm) || { n: nm, a: 0, k: 0, bb: [1e9, 1e9, -1e9, -1e9] };
    o.a += a; o.k++;
    o.bb = [Math.min(o.bb[0], bb[0]), Math.min(o.bb[1], bb[1]), Math.max(o.bb[2], bb[2]), Math.max(o.bb[3], bb[3])];
    named.set(nm, o);
  }
  return [...named.values()].sort((x, y) => y.a - x.a);
}
const W = (v) => v.map((o) => o.n + ' ' + o.a.toFixed(0) + '格² ×' + o.k + ' bb(' + o.bb.map((q) => q.toFixed(0)).join(',') + ')');
console.log('=== woods 总计', G.woods.length, '行');
console.log(W(group(G.woods)).slice(0, 22).join('\n'));
console.log('=== parks 总计', G.parks.length, '行');
console.log(W(group(G.parks)).slice(0, 22).join('\n'));
console.log('=== reserves', G.reserves.length);
console.log(W(group(G.reserves)).join('\n'));
const totalWood = group(G.woods).reduce((s, o) => s + o.a, 0);
console.log('林地总面积', totalWood.toFixed(0), '格² =', (totalWood / (320 * 240) * 100).toFixed(1) + '% 图幅');