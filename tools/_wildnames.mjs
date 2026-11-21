// 为每个 wild 片区找出重叠的 OSM 命名地物与最近地名
import fs from 'node:fs';
import vm from 'node:vm';
const ctx = { window: {} };
ctx.window.CM = { GEOS: {}, Map: Map };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/geo_dg.js', 'utf8'), ctx);
const G = ctx.window.CM.GEOS.dg;
const dec = (s) => {
  const out = []; let x = 0, y = 0, i = 0;
  while (i < s.length) {
    const read = () => {
      let v = 0, sh = 0, c;
      do { c = s.charCodeAt(i++) - 63; v |= (c & 31) << sh; sh += 5; } while (c & 32);
      return v & 1 ? ~(v >> 1) : v >> 1;
    };
    x += read(); y += read();
    out.push([x / 64, y / 64]);
  }
  return out;
};
const polyOf = (row) => {
  const out = [];
  for (let k = 1; k < row.length; k++) { const t = String(row[k]); out.push({ role: t[0], p: dec(t.slice(1)) }); }
  return out;
};
const inRing = (x, y, p) => {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const xi = p[i][0], yi = p[i][1], xj = p[j][0], yj = p[j][1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const named = [];
for (const [key, rows] of [['parks', G.parks], ['reserves', G.reserves], ['woods', G.woods]]) {
  for (const r of rows || []) {
    const nm = G.names[r[0]]; if (!nm) continue;
    const parts = polyOf(r).filter((q) => q.role === 'o');
    if (!parts.length) continue;
    const xs = parts[0].p.map((q) => q[0]), ys = parts[0].p.map((q) => q[1]);
    named.push({ key, nm, p: parts[0].p, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] });
  }
}
const src = fs.readFileSync('js/data_dg.js', 'utf8');
const reg = [...src.matchAll(/id: '(wild\d+)', name: '([^']+)', poly: (\[[\s\S]*?), scenic:/g)];
for (const m of reg) {
  const poly = JSON.parse(m[3]);
  const ring = Array.isArray(poly[0][0]) ? poly[0] : poly;
  const cx = ring.reduce((a, q) => a + q[0], 0) / ring.length, cy = ring.reduce((a, q) => a + q[1], 0) / ring.length;
  // 面积
  let area = 0; for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; area += a[0] * b[1] - b[0] * a[1]; } area = Math.abs(area / 2);
  const hit = named.filter((q) => inRing(cx, cy, q.p) || q.p.some((pt) => inRing(pt[0], pt[1], ring)));
  const places = (G.places || []).map((p) => ({ n: p[0], d: Math.hypot(p[1] - cx, p[2] - cy) })).sort((a, b) => a.d - b.d).slice(0, 4);
  console.log(m[1], m[2], 'area', area.toFixed(0), 'centroid', cx.toFixed(1), cy.toFixed(1));
  console.log('   named:', hit.map((q) => q.key + ':' + q.nm).join(' | ') || '-');
  console.log('   places:', places.map((p) => p.n + '(' + p.d.toFixed(1) + ')').join(' '));
}