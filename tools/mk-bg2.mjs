// 从 PBF 提取缓存生成 DATA.bg.lines 的铁路部分（允许走向超出图幅）。
// 做法：同名铁路 way 建路网（0.5 格吸附）→ 取最长连通链作为走向 → 把 OSM 客运站投影到走向上排序 → 输出站序与增量编码路径。
// 临时工具，不进发布。
import { readFile, writeFile } from 'node:fs/promises';

const CACHE = 'tools/osm-cache/dg-pbf';
const RAIL = JSON.parse(await readFile(CACHE + '/pbf-rail.json', 'utf8'));
const PLACES = JSON.parse(await readFile(CACHE + '/pbf-places.json', 'utf8'));
const proj = { lon0: 113.5, lat0: 23.17, kx: 407.44, ky: 442.3 };
const W = 320, H = 240;
const X = (lon) => (lon - proj.lon0) * proj.kx;
const Y = (lat) => (proj.lat0 - lat) * proj.ky;
const MARGIN = 10; // 走向超出图幅 10 格（2.5 km），让线路明显伸出图外
const SNAP = 1.0;  // 路网吸附网格（格）：同名线路里的双线与并行段会合并成一条

function enc(pts) {
  const out = []; let px = 0, py = 0;
  for (const [x0, y0] of pts) {
    const x = Math.round(x0 * 64), y = Math.round(y0 * 64);
    let dx = x - px, dy = y - py; px = x; py = y;
    dx = dx < 0 ? ~(dx << 1) : dx << 1; dy = dy < 0 ? ~(dy << 1) : dy << 1;
    for (const n0 of [dx, dy]) {
      let n = n0, more = true;
      while (more) { let b = n & 31; n >>>= 5; if (n) b |= 32; else more = false; out.push(String.fromCharCode(b + 63)); }
    }
  }
  return out.join('');
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// ---------- 1. 路网 ----------
const nodeOf = new Map();
const adj = new Map();
const key = (x, y) => Math.round(x  / SNAP) + ',' + Math.round(y  / SNAP);
function nid(p) {
  const k = key(p[0], p[1]);
  let id = nodeOf.get(k);
  if (id == null) { id = nodeOf.size; nodeOf.set(k, id); adj.set(id, []); }
  return id;
}
const waysByName = new Map();
for (const e of RAIL.elements) {
  if (e.type !== 'way' || !e.tags || e.tags.railway !== 'rail' || e.tags.service || !e.geometry) continue;
  const nm = e.tags.name || '';
  if (!nm) continue;
  const pts = e.geometry.map((g) => [X(g.lon), Y(g.lat)]);
  if (!waysByName.has(nm)) waysByName.set(nm, []);
  waysByName.get(nm).push(pts);
}

function buildGraph(ways) {
  const idOf = new Map(), coords = [], localAdj = [];
  const lkey = (p) => Math.round(p[0]  / SNAP) + ',' + Math.round(p[1]  / SNAP);
  const get = (p) => {
    const k = lkey(p);
    let id = idOf.get(k);
    if (id == null) { id = coords.length; idOf.set(k, id); coords.push(p); localAdj.push([]); }
    return id;
  };
  for (const w of ways) {
    for (let i = 0; i + 1 < w.length; i++) {
      const a = get(w[i]), b = get(w[i + 1]);
      if (a === b) continue;
      const d = dist(coords[a], coords[b]);
      if (d > 8) continue; // 跨大跳（OSM 断点）不连
      localAdj[a].push([b, d]); localAdj[b].push([a, d]);
    }
  }
  const N = coords.length;
  const g = { coords, localAdj, idOf, comp: null, bestComp: -1, N };
  // 连通分量
  const comp = new Int32Array(N).fill(-1);
  let c = 0;
  for (let s = 0; s < N; s++) {
    if (comp[s] >= 0) continue;
    const q = [s]; comp[s] = c;
    while (q.length) { const u = q.pop(); for (const [v] of localAdj[u]) if (comp[v] < 0) { comp[v] = c; q.push(v); } }
    c++;
  }
  g.comp = comp; g.nc = c;
  // 桥接：OSM 里同一条线常被断成若干段，把相邻分量的最近点对用带惩罚的边接起来，让整条线连成一体
  const groups = new Map();
  for (let i = 0; i < N; i++) { if (!groups.has(comp[i])) groups.set(comp[i], []); groups.get(comp[i]).push(i); }
  const list = [...groups.values()].filter((ns) => ns.length >= 3).map((ns) => ns.filter((_, k) => k % 4 === 0 || k === ns.length - 1));
  for (let a = 0; a < list.length; a++) {
    for (let b = a + 1; b < list.length; b++) {
      let best = { d: 1e9, u: -1, v: -1 };
      for (const u of list[a]) for (const v of list[b]) { const d = dist(coords[u], coords[v]); if (d < best.d) best = { d, u, v }; }
      if (best.d <= 18 && best.u >= 0) {
        const w = best.d * 4 + 6;
        localAdj[best.u].push([best.v, w]); localAdj[best.v].push([best.u, w]);
      }
    }
  }
  // 重算连通分量
  comp.fill(-1);
  let bestComp = -1, bestN = 0; c = 0;
  for (let s = 0; s < N; s++) {
    if (comp[s] >= 0) continue;
    const q = [s]; comp[s] = c; let n = 0;
    while (q.length) { const u = q.pop(); n++; for (const [v] of localAdj[u]) if (comp[v] < 0) { comp[v] = c; q.push(v); } }
    if (n > bestN) { bestN = n; bestComp = c; }
    c++;
  }
  g.bestComp = bestComp;
  return g;
}

function dijkstra(g, src, only) {
  const n = g.N;
  const dist_ = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  dist_[src] = 0;
  // 二叉堆
  const heap = [[0, src]];
  const push = (it) => { heap.push(it); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (; ;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  while (heap.length) {
    const [d, u] = pop();
    if (done[u]) continue;
    done[u] = 1;
    for (const [v, w] of g.localAdj[u]) {
      if (only != null && g.comp[v] !== only) continue;
      const nd = d + w;
      if (nd < dist_[v]) { dist_[v] = nd; prev[v] = u; push([nd, v]); }
    }
  }
  return { dist: dist_, prev };
}

function longestPath(g, ways) {
  const only = g.bestComp, n = g.N;
  const p0 = ways[0][0];
  const startId = g.idOf.get(Math.round(p0[0]  / SNAP) + ',' + Math.round(p0[1]  / SNAP));
  let s = startId != null && g.comp[startId] === only ? startId : -1;
  if (s < 0) for (let i = 0; i < n; i++) if (g.comp[i] === only) { s = i; break; }
  let A = s, dA = -1;
  { const { dist: d } = dijkstra(g, s, only); for (let i = 0; i < n; i++) if (g.comp[i] === only && d[i] < Infinity && d[i] > dA) { dA = d[i]; A = i; } }
  const { dist: d2, prev } = dijkstra(g, A, only);
  let B = A, dB = -1;
  for (let i = 0; i < n; i++) if (g.comp[i] === only && d2[i] < Infinity && d2[i] > dB) { dB = d2[i]; B = i; }
  const chain = [];
  for (let u = B; u >= 0; u = prev[u]) { chain.push(u); if (u === A) break; }
  chain.reverse();
  return chain.map((u) => g.coords[u]);
}

// ---------- 2. 裁剪到图幅外扩矩形 ----------
function clipPoly(pts, box) {
  const [x0, y0, x1, y1] = box;
  const out = []; let cur = [];
  const seg = (a, b) => {
    // 粗糙但够用：逐段裁到矩形 (Liang-Barsky)
    let t0 = 0, t1 = 1;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const clip = (p, q) => { if (p === 0) return q >= 0; const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } return true; };
    if (!clip(-dx, a[0] - x0)) return null;
    if (!clip(dx, x1 - a[0])) return null;
    if (!clip(-dy, a[1] - y0)) return null;
    if (!clip(dy, y1 - a[1])) return null;
    return [[a[0] + t0 * dx, a[1] + t0 * dy], [a[0] + t1 * dx, a[1] + t1 * dy]];
  };
  let prevB = null;
  for (let i = 0; i + 1 < pts.length; i++) {
    const s = seg(pts[i], pts[i + 1]);
    if (!s) { if (cur.length >= 2) out.push(cur); cur = []; prevB = null; continue; }
    const [p, q] = s;
    if (cur.length && prevB && dist(cur[cur.length - 1], p) < 0.01) cur.push(q);
    else { if (cur.length >= 2) out.push(cur); cur = [p, q]; }
    prevB = q;
  }
  if (cur.length >= 2) out.push(cur);
  out.sort((a, b) => {
    const L = (g) => { let s = 0; for (let i = 0; i + 1 < g.length; i++) s += dist(g[i], g[i + 1]); return s; };
    return L(b) - L(a);
  });
  return out[0] || [];
}

// ---------- 3. 车站 ----------
const stationNodes = PLACES.elements.filter((e) => {
  if (e.type !== 'node' || !e.tags || e.tags.railway !== 'station') return false;
  const st = e.tags.station;
  if (st === 'subway' || st === 'light_rail' || st === 'monorail' || st === 'tram') return false;
  if (e.tags.subway === 'yes' || e.tags.light_rail === 'yes' || e.tags.monorail === 'yes') return false;
  return !!(e.tags.train === 'yes' || st === 'train' || e.tags.public_transport === 'station' || st == null);
});
const ST = stationNodes.map((e) => ({ name: (e.tags.name || '').replace(/\s+/g, ''), p: [X(e.lon), Y(e.lat)], tags: e.tags }));
console.log('客运站候选', ST.length);

function projectOn(pts, p) {
  let best = { d: 1e9, at: 0 }, acc = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1e-9;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2));
    const q = [a[0] + t * dx, a[1] + t * dy], d = dist(p, q), L = Math.sqrt(L2);
    if (d < best.d) best = { d, at: acc + t * L, q };
    acc += L;
  }
  return best;
}


// ---------- 4. 逐线计算走向 ----------
const SPEC = [
  { name: '广深线', speed: 70, head: 45, y0: 1911 },
  { name: '京九线', speed: 70, head: 60, y0: 1996 },
  { name: '穗深城际线', speed: 120, head: 30, y0: 2019 },
  { name: '广惠城际线', speed: 100, head: 30, y0: 2016, extra: ['东莞西'] },
  { name: '广深港高速线', speed: 200, head: 30, y0: 2011, hsr: true, extra: ['光明城'] },
  { name: '京港高速线', speed: 200, head: 60, y0: 2021, hsr: true },
];
const built = [];
for (const sp of SPEC) {
  const ways = waysByName.get(sp.name);
  if (!ways) { console.log('缺线路', sp.name); continue; }
  const g = buildGraph(ways);
  const full = longestPath(g, ways);
  const pts = clipPoly(full, [-MARGIN, -MARGIN, W + MARGIN, H + MARGIN]);
  if (pts.length < 4) { console.log('裁剪后过短', sp.name); continue; }
  built.push({ sp, pts });
}

// ---------- 5. 车站归到最近的线路，再按走向排序 ----------
const MAXD = 1.3; // 车站到走向的允许距离（格）
const assign = built.map(() => []);
for (const s of ST) {
  if (!s.name) continue;
  let bi = -1, bd = 1e9, bp = null;
  built.forEach((b, i) => { const pr = projectOn(b.pts, s.p); if (pr.d < bd) { bd = pr.d; bi = i; bp = pr; } });
  if (bi < 0 || bd > MAXD) continue;
  assign[bi].push({ name: s.name, at: bp.at, q: bp.q, d: bd });
}

const out = [];
built.forEach((b, i) => {
  const list = assign[i].slice();
  for (const nm of b.sp.extra || []) {
    if (list.some((c) => c.name === nm)) continue;
    const st = ST.find((c) => c.name === nm);
    if (!st) continue;
    const pr = projectOn(b.pts, st.p);
    list.push({ name: nm, at: pr.at, q: pr.q, d: pr.d });
    console.log('  强制纳入共站：' + nm);
  }
  // 只保留图内站点：走向可以伸出图外，站点不出图（与深圳图一致）
  const inMap = list.filter((c) => c.q[0] >= 0 && c.q[0] <= W && c.q[1] >= 0 && c.q[1] <= H);
  console.log('  图外站点已剔除：' + (list.length - inMap.length) + ' 个');
  list.length = 0;
  list.push(...inMap);
  list.sort((p, q) => p.at - q.at || p.d - q.d);
  const stops = [];
  for (const c of list) {
    const last = stops[stops.length - 1];
    if (last && last.name === c.name) continue;
    if (last && c.at - last.at < 0.6) continue; // 极近重复站合并
    stops.push({ name: c.name, x: +c.q[0].toFixed(2), y: +c.q[1].toFixed(2), at: c.at });
  }
  console.log(`${b.sp.name}: 走向 ${b.pts.length} 点，车站 ${stops.length} → ${stops.map((s) => s.name).join(' → ')}`);
  out.push({
    id: 'dg_' + b.sp.name.replace(/[^a-z\u4e00-\u9fa5]/g, ''),
    kind: 'rail', name: b.sp.name, speed: b.sp.speed, head: b.sp.head, y0: b.sp.y0,
    hsr: !!b.sp.hsr,
    stops: stops.map((s) => [s.name, s.x, s.y]),
    path: enc(b.pts),
  });
});
await writeFile('tools/dg-bg-lines2.json', JSON.stringify(out, null, 1));
console.log('\n已写 tools/dg-bg-lines2.json');