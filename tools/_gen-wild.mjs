// 从 OSM 林地（woods）与既有保护区聚类出"自然区域"片区（scenic:true, open:null）
// 引擎依据：js/city.js:73 片区 scenic → plan/lu = LU.HILL，第 90 行跳过水面/山体，不产生人口与岗位
// 用法：node tools/_gen-wild.mjs [--dry] [--min 150] [--keep 9]
import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const numArg = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? +args[i + 1] : dflt; };
const MIN = numArg('--min', 150);
const KEEP = numArg('--keep', 9);
const W = 320, H = 240;

const src = await readFile('js/geo_dg.js', 'utf8');
const CM = { GEOS: {} };
vm.runInNewContext(src, { window: { CM }, CM, console });
const G = CM.GEOS.dg;
const nm = (i) => G.names[i] || '';

function dec(s) {
  const out = []; let x = 0, y = 0, i = 0;
  const rd = () => { let v = 0, sh = 0, ch; do { ch = s.charCodeAt(i++) - 63; v |= (ch & 31) << sh; sh += 5; } while (ch & 32); return (v & 1) ? ~(v >> 1) : v >> 1; };
  while (i < s.length) { x += rd(); y += rd(); out.push([x / 64, y / 64]); }
  return out;
}
function ringsOf(rows) {
  const out = [];
  for (const r of rows) for (const v of r.slice(1)) if (typeof v === 'string' && v[0] === 'o') out.push(dec(v.slice(1)));
  return out;
}
const inPoly = (px, py, p) => {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const xi = p[i][0], yi = p[i][1], xj = p[j][0], yj = p[j][1];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

const mark = new Uint8Array(W * H);
const paint = (polys, tag) => {
  for (const p of polys) {
    if (p.length < 4) continue;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const q of p) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
    const i0 = Math.max(0, Math.floor(x0)), i1 = Math.min(W - 1, Math.ceil(x1));
    const j0 = Math.max(0, Math.floor(y0)), j1 = Math.min(H - 1, Math.ceil(y1));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (inPoly(i + 0.5, j + 0.5, p)) mark[j * W + i] = tag;
    }
  }
};
paint(ringsOf(G.woods), 1);
paint(ringsOf(G.reserves), 2);
const totalWood = mark.reduce((s, v) => s + (v ? 1 : 0), 0);

// 镇中心附近保留（避免把镇区吃掉）
const dataSrc = await readFile('js/data_dg.js', 'utf8');
const ci = dataSrc.indexOf('centers: ['), cj = dataSrc.indexOf('],', ci);
const centers = [...dataSrc.slice(ci, cj).matchAll(/\{ x: ([\d.]+), y: ([\d.]+), pop: (\d+), jobs: (\d+), r: ([\d.]+) \}/g)]
  .map((m) => ({ x: +m[1], y: +m[2], r: +m[5] }));
const keep = new Uint8Array(W * H);
for (const c of centers) {
  const R = Math.max(c.r * 4 * 1.6, KEEP);
  for (let j = Math.max(0, Math.floor(c.y - R)); j <= Math.min(H - 1, Math.ceil(c.y + R)); j++)
    for (let i = Math.max(0, Math.floor(c.x - R)); i <= Math.min(W - 1, Math.ceil(c.x + R)); i++)
      if (Math.hypot(i + 0.5 - c.x, j + 0.5 - c.y) <= R) keep[j * W + i] = 1;
}

// 连通块
const comp = new Int32Array(W * H).fill(-1);
const comps = [];
for (let s = 0; s < W * H; s++) {
  if (!mark[s] || comp[s] >= 0) continue;
  const id = comps.length, cells = [];
  const q = [s]; comp[s] = id;
  while (q.length) {
    const c = q.pop(); cells.push(c);
    const i = c % W, j = (c / W) | 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      const n = nj * W + ni;
      if (mark[n] && comp[n] < 0) { comp[n] = id; q.push(n); }
    }
  }
  comps.push({ id, cells });
}
const kept = [];
for (const cp of comps) {
  const cells = cp.cells.filter((c) => !keep[c]);
  if (cells.length < MIN) continue;
  kept.push({ cells, area: cells.length });
}
kept.sort((a, b) => b.area - a.area);

// 边界环（格边串环 + 共线合并）
function ringOf(cells) {
  const set = new Set(cells);
  const edges = new Map(); // "x,y" -> [[bx,by,used], ...]
  const push = (ax, ay, bx, by) => { const k = ax + ',' + ay; let a = edges.get(k); if (!a) { a = []; edges.set(k, a); } a.push([bx, by, false]); };
  for (const c of cells) {
    const i = c % W, j = (c / W) | 0;
    if (!set.has(c - W)) push(i, j, i + 1, j);
    if (!set.has(c + W)) push(i + 1, j + 1, i, j + 1);
    if (!set.has(c - 1)) push(i, j + 1, i, j);
    if (!set.has(c + 1)) push(i + 1, j, i + 1, j + 1);
  }
  const loops = [];
  for (const [k0] of edges) {
    for (const e0 of edges.get(k0)) {
      if (e0[2]) continue;
      const ring = [];
      let k = k0, e = e0;
      for (let guard = 0; guard < 1e6; guard++) {
        e[2] = true;
        const [ax, ay] = k.split(',').map(Number);
        ring.push([ax, ay]);
        k = e[0] + ',' + e[1];
        const cand = edges.get(k);
        if (!cand) break;
        const nxt = cand.find((q) => !q[2]);
        if (!nxt) break;
        e = nxt;
        if (k === k0 && e === e0) break;
      }
      if (ring.length >= 4) loops.push(ring);
    }
  }
  const areaOf = (r) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return a / 2; };
  loops.sort((a, b) => Math.abs(areaOf(b)) - Math.abs(areaOf(a)));
  // 简化共线
  const simp = (r) => {
    const out = [];
    for (let i = 0; i < r.length; i++) {
      const a = r[(i - 1 + r.length) % r.length], b = r[i], c = r[(i + 1) % r.length];
      if ((b[0] - a[0]) * (c[1] - b[1]) === (b[1] - a[1]) * (c[0] - b[0])) continue;
      out.push(b);
    }
    return out.length >= 4 ? out : r;
  };
  const big = loops.filter((l) => Math.abs(areaOf(l)) >= 24);
  if (!big.length) return { outer: simp(loops[0]), holes: [], parts: 1 };
  return { outer: simp(big[0]), holes: big.slice(1).map(simp), parts: big.length };
}

// 命名：优先用包含中心的行政边界名（镇街），否则用最近地名
const adminPolys = [];
for (const r of G.admin || []) {
  const parts = r.slice(2).filter((v) => typeof v === 'string' && v[0] === 'o').map((v) => dec(v.slice(1)));
  adminPolys.push({ lv: r[0], name: nm(r[1]), polys: parts });
}
const townName = (cx, cy) => {
  let best = null, bestLv = -1;
  for (const a of adminPolys) {
    if (!a.name) continue;
    for (const p of a.polys) if (inPoly(cx, cy, p)) { if (a.lv > bestLv) { best = a.name; bestLv = a.lv; } }
  }
  if (best) return best;
  let d0 = 1e9;
  for (const p of G.places || []) {
    const d = Math.hypot(p[1] - cx, p[2] - cy);
    if (d < d0) { d0 = d; best = p[0]; }
  }
  return best || '山林';
};

const out = [];
kept.forEach((k, n) => {
  const { outer, holes } = ringOf(k.cells);
  let sx = 0, sy = 0;
  for (const c of k.cells) { sx += c % W; sy += (c / W) | 0; }
  const cx = sx / k.cells.length, cy = sy / k.cells.length;
  const name = townName(cx, cy).replace(/镇$|街道$/, '') + ' 山林';
  out.push({ id: 'wild' + (n + 1), name, area: k.area, cx: +cx.toFixed(1), cy: +cy.toFixed(1), outer, holes });
});

console.log('林地格', totalWood, '占比', (totalWood / (W * H) * 100).toFixed(1) + '%');
console.log('连通块', comps.length, '≥' + MIN + '格² 的', kept.length, '块，合计', kept.reduce((s, k) => s + k.area, 0), '格²');
for (const o of out) console.log('  ', o.id, o.name.padEnd(14), o.area + '格²', '中心(' + o.cx + ',' + o.cy + ')', '环点', o.outer.length, '洞', o.holes.length);

if (!dry) {
  const lines = out.map((o) => {
    const poly = [o.outer].concat(o.holes).map((r) => '[' + r.map((q) => '[' + q[0] + ',' + q[1] + ']').join(',') + ']').join(',');
    return "    { id: '" + o.id + "', name: '" + o.name + "', poly: [" + poly + '], scenic: true, open: null, lockNote: \'自然林地区域：不开发、不能设站\' },';
  });
  await writeFile('tools/_wild.txt', lines.join('\n') + '\n');
  console.log('已写 tools/_wild.txt（' + out.length + ' 个自然片区）');
}