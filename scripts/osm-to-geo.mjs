#!/usr/bin/env node
// OpenStreetMap → js/geo_<id>.js 转换器。
//
// 用法（在仓库根目录执行）：
//   node scripts/osm-to-geo.mjs --id dg --boundary 东莞市 --count           # 只统计要素数量，评估数据量
//   node scripts/osm-to-geo.mjs --id dg --boundary 东莞市 --fetch           # 下载原始数据到 tools/osm-cache/dg/
//   node scripts/osm-to-geo.mjs --id dg --boundary 东莞市 --build           # 由缓存生成 js/geo_dg.js
//   node scripts/osm-to-geo.mjs --id dg --build --bbox 113.5,22.6,114.3,23.2  # 直接指定矩形（跳过行政边界）
//
// 取图范围：行政区（或 --bbox）的外接矩形，再向上取整到整格 —— 矩形内属于邻近城市的要素同样保留，
// 因为游戏地图本身是矩形，边界外的地貌也是地图的一部分。
//
// 输出格式由 js/geo.js 唯一规定：坐标单位为格（250 m），折线用增量编码（×64 + zigzag + 5 位一字符）。
// 生成的文件是构建产物，可重复生成；中间缓存留在 tools/osm-cache/<id>/，不进 dist。

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CELL_M = 250;
// 与现有地图（data_hz / geo_hk / geo_sz …）一致：每格 250 m ⇒ 每度纬度 442.3 格
const CELLS_PER_DEG_LAT = 442.3;

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
// 多数镜像要求可识别的 User-Agent（缺省会返回 429/406）
const UA = 'city-and-metro-mapbuild/1.0 (+https://github.com/city-and-metro; static site map data build tool)';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.slice(0, 2) !== '--') throw new Error('无法识别的参数：' + a);
  const key = a.slice(2);
  const next = process.argv[i + 1];
  if (next === undefined || next.slice(0, 2) === '--') args[key] = true;
  else { args[key] = next; i++; }
}

const ID = String(args.id || '').trim();
if (!/^[a-z]{2}$/.test(ID)) throw new Error('需要 --id（两位小写字母，如 dg）');
const CACHE = path.join(ROOT, 'tools/osm-cache', args.cache || ID);
// 道路最低等级：2=次干道（含 tertiary，镇街内部路）、3=主干道（primary/secondary）、4=快速路。
// 镇街内部路太多会让开局"满屏道路"，交给城市发展自行生长，故可用 --road-min-cls 3 收一层。
const ROAD_MIN_CLS = Math.min(4, Math.max(2, Number(args['road-min-cls'] || 2)));
// 主干道（cls 3）最短保留长度（格，1 格 = 250 m）：默认 0 = 不过滤，保留 OSM 全部道路
const ROAD_ARTERY_MIN = Math.max(0, Number(args['road-artery-min'] || 0));
const OUT = path.join(ROOT, 'js', 'geo_' + ID + '.js');

const log = (...a) => console.error(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- Overpass

async function overpass(query, { timeout = 100000 } = {}) {
  const body = 'data=' + encodeURIComponent(query);
  let last = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    const urls = attempt ? ENDPOINTS.slice(attempt % ENDPOINTS.length).concat(ENDPOINTS.slice(0, attempt % ENDPOINTS.length)) : ENDPOINTS;
    for (const url of urls) {
      const t0 = Date.now();
      try {
        const r = await fetch(url, {
          method: 'POST', body,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
          signal: AbortSignal.timeout(timeout),
        });
        const txt = await r.text();
        if (!r.ok) { last = url + ' HTTP ' + r.status + ' ' + txt.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 300); log('  ! ' + last); continue; }
        if (txt.trim()[0] !== '{') { last = url + ' 非 JSON 响应：' + txt.slice(0, 80); log('  ! ' + last); continue; }
        log('  · ' + new URL(url).host + ' ' + ((Date.now() - t0) / 1000).toFixed(1) + 's, ' + (txt.length / 1048576).toFixed(1) + ' MB');
        return JSON.parse(txt);
      } catch (e) { last = url + ' ' + (e.name === 'TimeoutError' ? '超时' : e.message); log('  ! ' + last); }
    }
    if (attempt < 3) { log('  … 全部镜像失败，' + (8 * (attempt + 1)) + 's 后重试'); await sleep(8000 * (attempt + 1)); }
  }
  throw new Error('Overpass 请求失败：' + last);
}

// ---------------------------------------------------------------- 范围

function bboxFromRel(j) {
  const bag = { west: 1e9, south: 1e9, east: -1e9, north: -1e9 };
  let best = null;
  for (const el of j.elements || []) {
    if (el.type !== 'relation' || !el.members) continue;
    const r = { west: 1e9, south: 1e9, east: -1e9, north: -1e9 };
    let n = 0;
    for (const m of el.members) for (const p of m.geometry || []) {
      if (p.lon < r.west) r.west = p.lon; if (p.lon > r.east) r.east = p.lon;
      if (p.lat < r.south) r.south = p.lat; if (p.lat > r.north) r.north = p.lat;
      n++;
    }
    if (!n) continue;
    // 同名关系可能有多级，取点最多的主边界
    if (!best || n > best.n) best = { n, ...r, name: (el.tags || {}).name || '' };
    bag.west = Math.min(bag.west, r.west); bag.east = Math.max(bag.east, r.east);
    bag.south = Math.min(bag.south, r.south); bag.north = Math.max(bag.north, r.north);
  }
  return best || null;
}

async function loadBbox() {
  if (args.bbox) {
    const v = String(args.bbox).split(',').map(Number);
    if (v.length !== 4 || v.some((x) => !Number.isFinite(x))) throw new Error('--bbox 需要 west,south,east,north');
    return { west: v[0], south: v[1], east: v[2], north: v[3], name: '--bbox' };
  }
  const name = String(args.boundary || '').trim();
  if (!name) throw new Error('需要 --boundary <行政区名> 或 --bbox');
  log('· 查询行政边界：' + name);
  const j = await overpass('[out:json][timeout:300];rel["boundary"="administrative"]["name"="' + name + '"];out geom;');
  const bb = bboxFromRel(j);
  if (!bb) throw new Error('没有找到边界关系：' + name);
  log('· 边界 ' + bb.name + ' → 经度 ' + bb.west.toFixed(4) + '…' + bb.east.toFixed(4) + '，纬度 ' + bb.south.toFixed(4) + '…' + bb.north.toFixed(4));
  return bb;
}

function makeGrid(bb) {
  const latMid = (bb.north + bb.south) / 2;
  const ky = CELLS_PER_DEG_LAT;
  const kx = +(ky * Math.cos((latMid * Math.PI) / 180)).toFixed(2);
  // 宽高取整到 8 的倍数：js/maps.js 的 autoZone 只接受能同时整除 W、H 的交通小区边长
  // （[4,6,8,10,12,16,20,24]），否则回落到 4 并算出小数个小区，sim.js 建数组时抛 Invalid array length
  const STEP = 8;
  const W = Math.ceil(((bb.east - bb.west) * kx) / STEP) * STEP;
  const H = Math.ceil(((bb.north - bb.south) * ky) / STEP) * STEP;
  return {
    lon0: bb.west, lat0: bb.north, kx, ky, W, H,
    get lon1() { return this.lon0 + this.W / this.kx; },
    get lat1() { return this.lat0 - this.H / this.ky; },
  };
}

// ---------------------------------------------------------------- 下载

// 分 6 个小请求：单次查询越小越不容易被 Overpass 排队/超时；各自落盘缓存，中断后可续。
// 面状水体先用 way（湖、水库、河岸多为闭合 way）；大江大河在国内常被画成 natural=water 的 multipolygon 关系，
// 只取 way 会让东江这类干流只剩一条细线，所以另外单独一层 waterrel 取关系（分块请求，避免关系跨省展开拖垮查询）。
const JOBS = [
  {
    key: 'water', q: `(
      way["natural"="water"](BB);
      way["water"="river"](BB);
      way["waterway"="riverbank"](BB);
    );out geom;`,
  },
  {
    key: 'waterrel', tiles: 3, q: `(
      relation["natural"="water"](BB);
      relation["waterway"="riverbank"](BB);
    );out geom;`,
  },
  {
    key: 'waterline', q: `(
      way["waterway"="river"](BB);
      way["waterway"="canal"](BB);
    );out geom;`,
  },
  {
    key: 'roads', tiles: 6, q: `way["highway"~"^(motorway|trunk|primary|secondary|tertiary|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"](BB);out geom;`,
  },
  {
    key: 'rail', q: `way["railway"="rail"](BB);out geom;`,
  },
  {
    key: 'green', q: `(
      way["leisure"="park"](BB);
      way["leisure"="garden"](BB);
      relation["leisure"="park"](BB);
      way["boundary"~"^(protected_area|national_park)$"](BB);
      way["landuse"="forest"](BB);
      way["natural"="wood"](BB);
    );out geom;`,
  },
  {
    // 海岸线：珠江口这类入海口在 OSM 里不是 natural=water，而是 natural=coastline（海侧在行进方向右边）
    key: 'coast', tiles: 3, q: `way["natural"="coastline"](BB);out geom;`,
  },
  {
    key: 'places', q: `(
      node["place"~"^(city|town|suburb|quarter|neighbourhood|village)$"](BB);
      node["railway"="station"](BB);
    );out;`,
  },
];

function hushBB(grid) { return [grid.lat1, grid.lon0, grid.lat0, grid.lon1].map((v) => v.toFixed(5)).join(','); }

const TILES = Math.max(1, Math.floor(Number(args.tiles || 1)) || 1);
// 只下载指定的几层（逗号分隔），例如 --job roads；已有的缓存块会被跳过，所以可以反复重跑到补齐
const JOB_FILTER = String(args.job || '').split(',').map((s) => s.trim()).filter(Boolean);

// 把地图切成 TILES × TILES 块分别请求：单次查询越小越不容易被 Overpass 排队
function tileBounds(grid, tx, ty, T) {
  const x0 = Math.floor((tx * grid.W) / T), x1 = Math.ceil(((tx + 1) * grid.W) / T);
  const y0 = Math.floor((ty * grid.H) / T), y1 = Math.ceil(((ty + 1) * grid.H) / T);
  const pad = 1; // 1 格重叠，避免边界要素被切断后缺失
  return {
    west: grid.lon0 + (x0 - pad) / grid.kx,
    east: grid.lon0 + (x1 + pad) / grid.kx,
    north: grid.lat0 - (y0 - pad) / grid.ky,
    south: grid.lat0 - (y1 + pad) / grid.ky,
  };
}

async function download(grid) {
  await fsp.mkdir(CACHE, { recursive: true });
  await fsp.writeFile(path.join(CACHE, 'meta.json'), JSON.stringify({ id: ID, boundary: args.boundary || null, bbox: [grid.lon0, grid.lat1, grid.lon1, grid.lat0], grid: { lon0: grid.lon0, lat0: grid.lat0, kx: grid.kx, ky: grid.ky, W: grid.W, H: grid.H }, tiles: TILES, at: new Date().toISOString() }, null, 1));
  // 并发下载：Overpass 单请求很慢，同时向多个镜像各发一块能显著缩短总时长（块之间互不依赖，缓存可续）
  const CONC = Math.max(1, Math.floor(Number(args.conc || 3)) || 3);
  for (const job of JOBS) {
    if (JOB_FILTER.length && !JOB_FILTER.includes(job.key)) continue;
    // 每层可以单独指定分块数（道路数据量大，块要更细）
    const T = Math.max(1, Math.floor(Number(job.tiles || TILES)) || 1);
    const tasks = [];
    for (let ty = 0; ty < T; ty++) for (let tx = 0; tx < T; tx++) {
      const key = job.key + (T > 1 ? '-' + tx + '_' + ty : '');
      const file = path.join(CACHE, key + '.json');
      if (fs.existsSync(file) && !args.force) { log('· 已有缓存，跳过 ' + key); continue; }
      const b = T > 1 ? tileBounds(grid, tx, ty, T) : { west: grid.lon0, east: grid.lon1, south: grid.lat1, north: grid.lat0 };
      tasks.push({ key, file, BB: [b.south, b.west, b.north, b.east].map((v) => v.toFixed(5)).join(',') });
    }
    let got = 0, failed = [], cursor = 0;
    const worker = async () => {
      while (cursor < tasks.length) {
        const t = tasks[cursor++];
        log('· 下载 ' + t.key);
        let j = null;
        for (let tries = 0; tries < 3; tries++) {
          let res = null;
          try { res = await overpass('[out:json][timeout:240];' + job.q.replace(/\(BB\)/g, '(' + t.BB + ')')); }
          catch (e) { log('  ! ' + t.key + ' 请求失败：' + (e && e.message)); await sleep(4000); continue; }
          if ((res.elements || []).length > 0) { j = res; break; }
          // 有的镜像只含某一地区的数据，会对中国范围静默返回空结果
          log('  ! ' + t.key + ' 返回 0 个要素，疑似镜像数据不全，重试');
          await sleep(3000);
        }
        if (!j) { log('  ! ' + t.key + ' 多次重试仍为空，跳过该块'); failed.push(t.key); continue; }
        await fsp.writeFile(t.file, JSON.stringify(j));
        got += j.elements.length;
        log('  → ' + t.key + ' ' + j.elements.length + ' 个要素，' + ((JSON.stringify(j).length / 1048576).toFixed(1)) + ' MB');
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONC, tasks.length || 1) }, worker));
    log('· ' + job.key + ' 合计 ' + got + ' 个要素' + (failed.length ? '；未完成 ' + failed.length + ' 块：' + failed.join(' ') : ''));
  }
}

async function countOnly(grid) {
  const BB = hushBB(grid);
  for (const job of JOBS) {
    const q = '[out:json][timeout:240];' + job.q.replace(/\(BB\)/g, '(' + BB + ')').replace(/out(\s+geom)?;/, 'out count;');
    const j = await overpass(q);
    const c = (j.elements || [])[0];
    const t = (c && c.tags) || {};
    console.log(job.key, 'nodes=' + (t.nodes ?? '?'), 'ways=' + (t.ways ?? '?'), 'relations=' + (t.relations ?? '?'));
  }
}

// ---------------------------------------------------------------- 几何

const R = CELL_M; // 米/格

function gridXY(g, lat, lon) { return [(lon - g.lon0) * g.kx, (g.lat0 - lat) * g.ky]; }

// 线段与矩形求交（Liang–Barsky），返回 [t0,t1] 或 null
function clipT(ax, ay, bx, by, x0, y0, x1, y1) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dy = by - ay;
  const p = [-dx, dx, -dy, dy], q = [ax - x0, x1 - ax, ay - y0, y1 - ay];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return null; continue; }
    const t = q[i] / p[i];
    if (p[i] < 0) { if (t > t1) return null; if (t > t0) t0 = t; }
    else { if (t < t0) return null; if (t < t1) t1 = t; }
  }
  return [t0, t1];
}

// 折线裁到矩形内，返回若干段（cell 坐标，扁平数组）
// OUT_PAD：铁路与道路向外多留 1.5 格（375 m），让走向越过图幅边缘一点点——与 geo_sz / geo_hk 一致。
// 站点不跟着外扩，所以界外只有线、没有站。
const OUT_PAD = 1.5;
function clipLine(pts, g, pad) {
  const P = pad || 0;
  const x0 = -P, y0 = -P, x1 = g.W + P, y1 = g.H + P;
  const out = [];
  let cur = null;
  const flush = () => { if (cur && cur.length >= 4) out.push(cur); cur = null; };
  for (let k = 0; k + 3 < pts.length; k += 2) {
    const ax = pts[k], ay = pts[k + 1], bx = pts[k + 2], by = pts[k + 3];
    const t = clipT(ax, ay, bx, by, x0, y0, x1, y1);
    if (!t) { flush(); continue; }
    const ta = t[0], tb = t[1];
    const sx = ax + (bx - ax) * ta, sy = ay + (by - ay) * ta;
    const ex = ax + (bx - ax) * tb, ey = ay + (by - ay) * tb;
    if (!cur || ta > 1e-9) { flush(); cur = [sx, sy, ex, ey]; }
    else cur.push(ex, ey);
    if (tb < 1 - 1e-9) flush();
  }
  flush();
  return out;
}

// 环按矩形做 Sutherland–Hodgman 裁剪：界外部分真正切掉，不再把顶点拉到边界上（那样会沿边拉出直线、形状突变）
function clipRing(pts, g) {
  let poly = [];
  for (let k = 0; k + 1 < pts.length; k += 2) poly.push([pts[k], pts[k + 1]]);
  if (poly.length > 1) { const a = poly[0], b = poly[poly.length - 1]; if (a[0] === b[0] && a[1] === b[1]) poly.pop(); }
  if (poly.length < 3) return [];
  const inside = [
    (p) => p[0] >= 0, (p) => p[0] <= g.W,
    (p) => p[1] >= 0, (p) => p[1] <= g.H,
  ];
  const cut = (a, b, e) => {
    const ax = a[0], ay = a[1], bx = b[0], by = b[1];
    let t = 0;
    if (e === 0) t = (0 - ax) / (bx - ax);
    else if (e === 1) t = (g.W - ax) / (bx - ax);
    else if (e === 2) t = (0 - ay) / (by - ay);
    else t = (g.H - ay) / (by - ay);
    return [ax + (bx - ax) * t, ay + (by - ay) * t];
  };
  for (let e = 0; e < 4; e++) {
    const ins = inside[e], src = poly, out = [];
    for (let i = 0; i < src.length; i++) {
      const cur = src[i], prev = src[(i + src.length - 1) % src.length];
      const ci = ins(cur), pi = ins(prev);
      if (ci) { if (!pi) out.push(cut(prev, cur, e)); out.push(cur); }
      else if (pi) out.push(cut(prev, cur, e));
    }
    poly = out;
    if (poly.length < 3) return [];
  }
  const flat = [];
  for (const p of poly) flat.push(p[0], p[1]);
  return flat;
}

// Douglas–Peucker（扁平数组，格坐标）
function simplify(p, tol) {
  const n = p.length / 2;
  if (n < 3) return p;
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  const tol2 = tol * tol;
  while (stack.length) {
    const [a, b] = stack.pop();
    const ax = p[2 * a], ay = p[2 * a + 1], bx = p[2 * b], by = p[2 * b + 1];
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    let far = -1, fd = tol2;
    for (let i = a + 1; i < b; i++) {
      const px = p[2 * i], py = p[2 * i + 1];
      let d;
      if (len2 === 0) d = (px - ax) * (px - ax) + (py - ay) * (py - ay);
      else { const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)); const qx = ax + dx * t - px, qy = ay + dy * t - py; d = qx * qx + qy * qy; }
      if (d > fd) { fd = d; far = i; }
    }
    if (far > 0) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(p[2 * i], p[2 * i + 1]);
  return out;
}

function lineLen(p) { let s = 0; for (let k = 0; k + 3 < p.length; k += 2) s += Math.hypot(p[k + 2] - p[k], p[k + 3] - p[k + 1]); return s; }

function ringArea(p) {
  let a = 0;
  const n = p.length / 2;
  for (let k = 0; k < n; k++) { const j = (k + 1) % n; a += p[2 * k] * p[2 * j + 1] - p[2 * j] * p[2 * k + 1]; }
  return Math.abs(a) / 2;
}

// 编码：与 js/geo.js 的 Geo.enc 完全一致（坐标 ×64，差分 + zigzag，5 位一字符）
function enc(p) {
  let s = '', px = 0, py = 0;
  const put = (v) => {
    let u = v < 0 ? ~(v << 1) : (v << 1);
    while (u >= 32) { s += String.fromCharCode((32 | (u & 31)) + 63); u >>>= 5; }
    s += String.fromCharCode(u + 63);
  };
  for (let k = 0; k + 1 < p.length; k += 2) {
    const x = Math.round(p[k] * 64), y = Math.round(p[k + 1] * 64);
    put(x - px); put(y - py); px = x; py = y;
  }
  return s;
}

// ---------------------------------------------------------------- 由 JSON 取要素

// 闭合环（way 自带 geometry，首尾同名点视为闭合）
function closedWays(j) {
  const out = [];
  for (const el of j.elements || []) {
    if (el.type !== 'way' || !el.geometry || el.geometry.length < 4) continue;
    const a = el.geometry[0], b = el.geometry[el.geometry.length - 1];
    if (Math.abs(a.lat - b.lat) > 1e-9 || Math.abs(a.lon - b.lon) > 1e-9) continue;
    out.push({ tags: el.tags || {}, geom: el.geometry });
  }
  return out;
}

// 关系 → 外环（用端点索引一段段接起来；换掉了原来的贪心拼接，
// 之前的实现把"段首接环首"这种情况接错了方向，狮子洋这种关系整圈都闭不上、地图上整块水面消失）
function relRings(j, role) {
  const out = [];
  const key = (p) => p.lat.toFixed(7) + ',' + p.lon.toFixed(7);
  for (const el of j.elements || []) {
    if (el.type !== 'relation' || !el.members) continue;
    const segs = el.members
      .filter((m) => m.type === 'way' && m.geometry && m.geometry.length > 1 && (!role || m.role === role))
      .map((m) => m.geometry.slice());
    if (!segs.length) continue;
    const idx = new Map();
    segs.forEach((s, i) => {
      for (const end of [0, 1]) {
        const k = key(end ? s[s.length - 1] : s[0]);
        if (!idx.has(k)) idx.set(k, []);
        idx.get(k).push(i);
      }
    });
    const used = new Uint8Array(segs.length);
    for (let i0 = 0; i0 < segs.length; i0++) {
      if (used[i0]) continue;
      used[i0] = 1;
      let chain = segs[i0].slice();
      for (;;) {
        const k = key(chain[chain.length - 1]);
        const cand = (idx.get(k) || []).find((i) => !used[i]);
        if (cand === undefined) break;
        used[cand] = 1;
        const s = segs[cand];
        chain = chain.concat(key(s[0]) === k ? s.slice(1) : s.slice(0, -1).reverse());
      }
      for (;;) {
        const k = key(chain[0]);
        const cand = (idx.get(k) || []).find((i) => !used[i]);
        if (cand === undefined) break;
        used[cand] = 1;
        const s = segs[cand];
        chain = (key(s[s.length - 1]) === k ? s.slice(0, -1) : s.slice(1).reverse()).concat(chain);
      }
      if (chain.length >= 4 && key(chain[0]) === key(chain[chain.length - 1])) out.push({ tags: el.tags || {}, geom: chain });
    }
  }
  return out;
}

function openWays(j) {
  const out = [];
  for (const el of j.elements || []) {
    if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) continue;
    out.push({ tags: el.tags || {}, geom: el.geometry });
  }
  return out;
}

// ---------------------------------------------------------------- 生成

const names = [''];
const nameIdx = new Map([['', 0]]);
function intern(s) {
  if (!s) return 0;
  let i = nameIdx.get(s);
  if (i === undefined) { i = names.length; names.push(s); nameIdx.set(s, i); }
  return i;
}

function roadCls(tags) {
  const h = tags.highway || '';
  if (/^(motorway|trunk)/.test(h)) return 4;
  if (/^primary/.test(h)) return 3;
  if (/^secondary/.test(h)) return 3;
  if (/^tertiary/.test(h)) return 2;
  return 0;
}
function roadFlags(tags) {
  let f = 0;
  if (tags.bridge && tags.bridge !== 'no') f |= 1;
  if (tags.tunnel && tags.tunnel !== 'no') f |= 2;
  if (/_link$/.test(tags.highway || '')) f |= 4;
  return f;
}

function polyRows(feats, g, minAreaCells, tol) {
  const rows = [];
  for (const f of feats) {
    const raw = [];
    for (const p of f.geom) { const xy = gridXY(g, p.lat, p.lon); raw.push(xy[0], xy[1]); }
    // 跨界的水面/绿地按矩形真裁剪；完全在界外的直接丢掉
    const pts = clipRing(raw, g);
    if (pts.length < 8) continue;
    const s = simplify(pts, tol);
    if (s.length < 8) continue;
    if (ringArea(s) < minAreaCells) continue;
    rows.push([intern(f.tags.name), 'o' + enc(s)]);
  }
  return rows;
}

// ---------------------------------------------------------------- 海岸线 → 海域多边形
// OSM 约定：沿 coastline 方向行进时，陆地左手、水面右手。地图只有"水面多边形"这一种表示，
// 所以要把海岸线接成链、再沿格网边界闭合，才画得出珠江口这种宽阔入海口。

function coastChains(ways) {
  const segs = ways.map((w) => w.geom.slice());
  const key = (p) => p.lat.toFixed(7) + ',' + p.lon.toFixed(7);
  const used = new Uint8Array(segs.length);
  const chains = [];
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    let cur = segs[i].slice();
    let grew = true;
    while (grew) {
      grew = false;
      const a = cur[0], b = cur[cur.length - 1];
      if (key(a) === key(b)) break;                     // 已闭合（岛）
      for (let j = 0; j < segs.length; j++) {
        if (used[j]) continue;
        const s = segs[j], s0 = s[0], s1 = s[s.length - 1];
        if (key(b) === key(s0)) { cur = cur.concat(s.slice(1)); used[j] = 1; grew = true; break; }
        if (key(b) === key(s1)) { cur = cur.concat(s.slice().reverse().slice(1)); used[j] = 1; grew = true; break; }
        if (key(a) === key(s1)) { cur = s.slice(0, -1).concat(cur); used[j] = 1; grew = true; break; }
        if (key(a) === key(s0)) { cur = s.slice().reverse().slice(1).concat(cur); used[j] = 1; grew = true; break; }
      }
    }
    chains.push(cur);
  }
  return chains;
}

const EPS_B = 1e-6;
function borderPhase(x, y, g) {
  const W = g.W, H = g.H;
  if (Math.abs(y) < EPS_B) return x;                        // 上边 y=0，向东
  if (Math.abs(x - W) < EPS_B) return W + y;                // 右边 x=W，向南
  if (Math.abs(y - H) < EPS_B) return W + H + (W - x);      // 下边 y=H，向西
  if (Math.abs(x) < EPS_B) return 2 * W + H + (H - y);      // 左边 x=0，向北
  return -1;                                                // 不在边界上
}
function borderPoint(s, g) {
  const W = g.W, H = g.H, P = 2 * (W + H);
  s = ((s % P) + P) % P;
  if (s <= W) return [s, 0];
  if (s <= W + H) return [W, s - W];
  if (s <= 2 * W + H) return [W - (s - W - H), H];
  return [0, H - (s - 2 * W - H)];
}
// 沿边界从 a 走到 b（顺时针 = phase 增大），返回中间点（含角落，不含 a，含 b）
function borderWalk(ax, ay, bx, by, g, cw) {
  const W = g.W, H = g.H, P = 2 * (W + H);
  let sA = borderPhase(ax, ay, g), sB = borderPhase(bx, by, g);
  if (sA < 0 || sB < 0) return null;
  const out = [];
  const corners = [W, W + H, 2 * W + H, P];
  const near = (v) => v > 1e-6 && v < P - 1e-6;
  if (cw) {
    if (sB <= sA) sB += P;
    for (const c of corners) {
      for (const cc of [c, c + P]) if (near(cc - Math.floor(sA / P) * P) && cc > sA && cc < sB) out.push(borderPoint(cc, g));
    }
    out.sort((p, q) => borderPhase(p[0], p[1], g) - borderPhase(q[0], q[1], g));
  } else {
    if (sB >= sA) sB -= P;
    for (const c of corners) {
      for (const cc of [c - P, c - 2 * P]) if (cc < sA && cc > sB) out.push(borderPoint(cc, g));
    }
    out.sort((p, q) => borderPhase(q[0], q[1], g) - borderPhase(p[0], p[1], g));
  }
  out.push([bx, by]);
  return out;
}

function pointInRing(x, y, flat) {
  let inside = false;
  const n = flat.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = flat[2 * i], yi = flat[2 * i + 1], xj = flat[2 * j], yj = flat[2 * j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const SEA_BRIDGE_MAX = 26;   // 内部端点之间最多跨 26 格（6.5 km）接一次：河口两岸之间的封口
const SEA_DEBUG = !!process.env.SEA_DEBUG;

function flatRev(p) { const o = []; for (let k = p.length - 2; k >= 0; k -= 2) o.push(p[k], p[k + 1]); return o; }

// 海域：海岸线栅格化 + 从外海种子洪水填充，再把掩膜转回多边形。
// 为什么不用"端点接环 + 沿地图边闭合"：珠江口的岸线是一条贯穿整个珠三角的连续折线，
// 端点根本不在本图范围内，接环经常接错方向、把整片城区圈进水里。
// 洪水填充只依赖"水在哪一侧"这一物理事实。
// 栅格只取地图范围外扩 SEA_PAD 格（10 km）：海岸线的 way 带着完整几何，一定从缓冲框外面穿过去，
// 不会在框内断头；四边框线封死，水就只能停在岸边。岛屿自然成为环里的洞（'i' 环）。
const SEA_SEEDS = [[89.6, 194.6], [73.3, 190.2], [112, 232], [46, 236]];
const SEA_PAD = 40;

function seaMaskRows(ways, g, wallRings) {
  const W = Math.round(g.W), H = Math.round(g.H);
  const ox = -SEA_PAD, oy = -SEA_PAD;
  const RW = W + SEA_PAD * 2, RH = H + SEA_PAD * 2;
  const X0 = ox, Y0 = oy, X1 = ox + RW - 1, Y1 = oy + RH - 1;
  const wall = new Uint8Array(RW * RH);
  const mark = (X, Y) => {
    const ix = Math.floor(X) - ox, iy = Math.floor(Y) - oy;
    if (ix < 0 || iy < 0 || ix >= RW || iy >= RH) return;
    wall[iy * RW + ix] = 1;
  };
  const lineW = (ax, ay, cx, cy) => {
    const n = Math.max(2, Math.ceil(Math.hypot(cx - ax, cy - ay) * 2));
    for (let k = 0; k <= n; k++) mark(ax + ((cx - ax) * k) / n, ay + ((cy - ay) * k) / n);
  };

  // 1) 海岸线：裁到缓冲框，记下每段的端点（端点就是"断头处"，必须封口）
  const ends = [];
  let segs = 0;
  for (const w of ways) {
    let prev = null, pieceStart = null, pieceEnd = null;
    const flush = () => {
      if (pieceStart) ends.push(pieceStart);
      if (pieceEnd && (pieceEnd[0] !== pieceStart[0] || pieceEnd[1] !== pieceStart[1])) ends.push(pieceEnd);
      pieceStart = pieceEnd = null;
    };
    for (const p of w.geom) {
      const cur = gridXY(g, p.lat, p.lon);
      if (prev) {
        const t = clipT(prev[0], prev[1], cur[0], cur[1], X0, Y0, X1, Y1);
        if (t) {
          const ax = prev[0] + (cur[0] - prev[0]) * t[0], ay = prev[1] + (cur[1] - prev[1]) * t[0];
          const bx = prev[0] + (cur[0] - prev[0]) * t[1], by = prev[1] + (cur[1] - prev[1]) * t[1];
          lineW(ax, ay, bx, by);
          if (!pieceStart) pieceStart = [ax, ay];
          pieceEnd = [bx, by];
          segs++;
        } else flush();
      }
      prev = cur;
    }
    flush();
  }
  if (!segs) return [];

  // 2) 湖库/河口的环也是墙，同时作为"封口"的吸附目标
  const wpts = [];
  for (const ring of wallRings || []) {
    for (let k = 0; k + 3 < ring.length; k += 2) lineW(ring[k], ring[k + 1], ring[k + 2], ring[k + 3]);
    for (let k = 0; k + 1 < ring.length; k += 2) wpts.push(ring[k], ring[k + 1]);
  }
  const onBorder = (p) => p[0] <= X0 + 0.5 || p[0] >= X1 - 0.5 || p[1] <= Y0 + 0.5 || p[1] >= Y1 - 0.5;
  const nearestWall = (p) => {
    let best = -1, bd = 60 * 60;
    for (let k = 0; k + 1 < wpts.length; k += 2) {
      const dx = wpts[k] - p[0], dy = wpts[k + 1] - p[1];
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = k; }
    }
    return best < 0 ? null : [wpts[best], wpts[best + 1], Math.sqrt(bd)];
  };
  const toBorder = (p) => {
    const cand = [[X0, p[1]], [X1, p[1]], [p[0], Y0], [p[0], Y1]];
    let best = cand[0], bd = 1e18;
    for (const c of cand) { const d = Math.hypot(c[0] - p[0], c[1] - p[1]); if (d < bd) { bd = d; best = c; } }
    return best;
  };
  let sealed = 0;
  for (const e of ends) {
    if (onBorder(e)) continue;
    const nw = nearestWall(e);
    if (nw && nw[2] <= 40) { lineW(e[0], e[1], nw[0], nw[1]); sealed++; continue; }
    const b = toBorder(e);
    lineW(e[0], e[1], b[0], b[1]);
    sealed++;
  }

  for (let x = 0; x < RW; x++) { wall[x] = 1; wall[(RH - 1) * RW + x] = 1; }
  for (let y = 0; y < RH; y++) { wall[y * RW] = 1; wall[y * RW + RW - 1] = 1; }

  // 3) 洪水填充（4 邻域）：种子必须是确定的外海水面
  const sea = new Uint8Array(RW * RH);
  const q = new Int32Array(RW * RH);
  let qh = 0, qt = 0;
  for (const sd of SEA_SEEDS) {
    const ix = Math.round(sd[0]) - ox, iy = Math.round(sd[1]) - oy;
    if (ix < 1 || iy < 1 || ix >= RW - 1 || iy >= RH - 1) continue;
    const c = iy * RW + ix;
    if (wall[c] || sea[c]) continue;
    sea[c] = 1; q[qt++] = c;
  }
  if (!qt) { log('    海域：外海种子全部落在陆地/岸线上，跳过'); return []; }
  while (qh < qt) {
    const c = q[qh++];
    if (!sea[c - 1] && !wall[c - 1]) { sea[c - 1] = 1; q[qt++] = c - 1; }
    if (!sea[c + 1] && !wall[c + 1]) { sea[c + 1] = 1; q[qt++] = c + 1; }
    if (!sea[c - RW] && !wall[c - RW]) { sea[c - RW] = 1; q[qt++] = c - RW; }
    if (!sea[c + RW] && !wall[c + RW]) { sea[c + RW] = 1; q[qt++] = c + RW; }
  }

  // 4) 裁到地图范围，并把岸线所在格并入海域（边界贴着岸线，不留 1 格缝）
  const grow = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (sea[(y - oy) * RW + (x - ox)]) grow[y * W + x] = 1;
  }
  const grow2 = Uint8Array.from(grow);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = y * W + x;
    if (!grow[c]) continue;
    if (x > 0) grow2[c - 1] = 1;
    if (x < W - 1) grow2[c + 1] = 1;
    if (y > 0) grow2[c - W] = 1;
    if (y < H - 1) grow2[c + W] = 1;
  }
  let seaCells = 0;
  for (let c = 0; c < W * H; c++) if (grow2[c]) seaCells++;
  if (!seaCells) return [];
  if (seaCells > W * H * 0.4) {
    log('    海域：' + seaCells + ' 格（超过全图 40%），疑似洪水漏进内陆，放弃');
    return [];
  }

  // 5) 掩膜 → 轮廓：沿格子边界收集有向边，再串成环
  const at = (x, y) => (y < 0 || y >= H || x < 0 || x >= W ? 0 : grow2[y * W + x]);
  const edges = new Map();
  const push = (x0, y0, x1, y1) => {
    const k = x0 + ',' + y0;
    if (!edges.has(k)) edges.set(k, []);
    edges.get(k).push([x1, y1]);
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!at(x, y)) continue;
    if (!at(x, y - 1)) push(x, y, x + 1, y);
    if (!at(x + 1, y)) push(x + 1, y, x + 1, y + 1);
    if (!at(x, y + 1)) push(x + 1, y + 1, x, y + 1);
    if (!at(x - 1, y)) push(x, y + 1, x, y);
  }
  const loops = [];
  for (const [start, list] of edges) {
    while (list.length) {
      const path = [];
      let cur = start;
      let nxt = list.pop();
      let guard = 0;
      while (nxt && guard++ < 8 * W * H) {
        path.push([+cur.split(',')[0], +cur.split(',')[1]]);
        const k = nxt[0] + ',' + nxt[1];
        const arr = edges.get(k);
        if (!arr || !arr.length) { path.push(nxt); break; }
        cur = k; nxt = arr.pop();
        if (k === start) { path.push([+cur.split(',')[0], +cur.split(',')[1]]); break; }
      }
      if (path.length >= 4) loops.push(path);
    }
  }

  const area2 = (pts) => { let a = 0; for (let k = 0; k < pts.length; k++) { const j = (k + 1) % pts.length; a += pts[k][0] * pts[j][1] - pts[j][0] * pts[k][1]; } return a / 2; };
  const outers = [], holes = [];
  for (const L of loops) {
    const a = area2(L);
    if (Math.abs(a) < 6) continue;
    if (a > 0) outers.push(L); else holes.push(L);
  }
  const flat = (L) => { const o = []; for (const p of L) o.push(p[0], p[1]); return o; };
  const rows = [];
  for (const O of outers) {
    const oflat = flat(O);
    const row = [0, 'o' + enc(simplify(oflat, 1.1))];
    for (const Hl of holes) if (pointInRing(Hl[0][0] + 0.5, Hl[0][1] + 0.5, oflat)) row.push('i' + enc(simplify(flat(Hl), 1.1)));
    rows.push(row);
  }
  log('    海域：栅格 ' + RW + '×' + RH + '，封口 ' + sealed + ' 处，海域 ' + seaCells + ' 格，成环 ' + outers.length + ' 外 / ' + holes.length + ' 内');
  return rows;
}
async function build(grid) {
  const read = async (k) => { try { return JSON.parse(await fsp.readFile(path.join(CACHE, k + '.json'), 'utf8')); } catch { return null; } };

  const els = [];
  const seen = new Set();
  const files = (fs.existsSync(CACHE) ? await fsp.readdir(CACHE) : []).filter((f) => /\.json$/.test(f) && f !== 'meta.json');
  for (const f of files) {
    let j = null;
    try { j = JSON.parse(await fsp.readFile(path.join(CACHE, f), 'utf8')); } catch { continue; }
    for (const el of j.elements || []) {
      const k = el.type + '/' + el.id;
      if (seen.has(k)) continue;   // 分块下载时相邻块会重叠
      seen.add(k);
      els.push(el);
    }
  }
  if (!els.length) throw new Error('缺少缓存：先运行 --fetch');
  const jPlaces = { elements: els.filter((e) => e.type === 'node') };
  const pick = (test) => ({ elements: els.filter((e) => test(e.tags || {}, e)) });
  const jWater = pick((t, e) => (e.type === 'way'
    ? (t.natural === 'water' || t.water === 'river' || t.waterway === 'riverbank' || /^(river|canal|stream)$/.test(t.waterway || ''))
    : (t.natural === 'water' || t.waterway === 'riverbank')));
  const jRoads = pick((t, e) => e.type === 'way' && /^(motorway|trunk|primary|secondary|tertiary)/.test(t.highway || ''));
  // 支路（步行街道）：引擎的 Geo.streets，只画在已开发街区里，随城市生长逐月并入步行网（与其他地图同一机制）
  const jStreets = pick((t, e) => e.type === 'way' && /^(residential|unclassified|living_street|pedestrian|footway|path|steps|cycleway)$/.test(t.highway || ''));
  const jRail = pick((t, e) => e.type === 'way' && t.railway === 'rail' && !t.service);
  const jCoast = pick((t, e) => e.type === 'way' && t.natural === 'coastline');
  const jParks = pick((t) => t.leisure === 'park' || t.leisure === 'garden');
  const jRes = pick((t) => /^(protected_area|national_park)$/.test(t.boundary || ''));
  const jWoods = pick((t) => t.landuse === 'forest' || t.natural === 'wood');

  const water = [], roadRows = [], railRows = [];
  const parks = polyRows([...closedWays(jParks), ...relRings(jParks, 'outer')], grid, 0.35, 0.18);
  const reserves = polyRows([...closedWays(jRes), ...relRings(jRes, 'outer')], grid, 2, 0.25);
  const woods = polyRows([...closedWays(jWoods), ...relRings(jWoods, 'outer')], grid, 0.6, 0.25);

  let seaWalls = [];
  let riverWalls = [];
  if (jWater) {
    const areas = [...closedWays(jWater), ...relRings(jWater, 'outer')];
    seaWalls = areas.map((f) => {
      const raw = [];
      for (const q of f.geom) { const xy2 = gridXY(grid, q.lat, q.lon); raw.push(xy2[0], xy2[1]); }
      return clipRing(raw, grid);
    }).filter((r2) => r2.length >= 8);
    water.push(...polyRows(areas, grid, 0.35, 0.15));
    // 河道线：未闭合的 waterway=river|canal|stream，宽度按等级给格数
    // 注意：不能只看首顶点是否在框内——东莞的河大多从界外流进来，那样会把整条河丢掉（水系"中断"的根源）
    for (const f of openWays(jWater)) {
      const ww = f.tags.waterway;
      if (!ww || !/^(river|canal|stream)$/.test(ww)) continue;
      const pts = [];
      for (const p of f.geom) { const xy = gridXY(grid, p.lat, p.lon); pts.push(xy[0], xy[1]); }
      // 宽度：有 width 标签就按米换算（250 m 一格），否则按等级给默认值；
      // 引擎没有河宽数据，纯按线宽画，默认值太细会把东江画成一条细线
      let width = ww === 'river' ? 0.45 : ww === 'canal' ? 0.14 : 0.06;
      const wt = parseFloat(f.tags.width);
      if (wt > 0) width = Math.max(0.06, Math.min(6, wt / CELL_M));
      riverWalls.push(pts);
      for (const seg of clipLine(pts, grid)) {
        const s = simplify(seg, 0.1);
        if (lineLen(s) < 0.12) continue;
        water.push([intern(f.tags.name), width, enc(s)]);
      }
    }
  }

  // 道路顶点采样：给"海域多边形"判定陆地方向用（每 3 个点取 1 个，最多 6000 点）
  const roadPts = [];
  for (const f of (jRoads ? jRoads.elements : [])) {
    if (f.type !== 'way' || !roadCls(f.tags || {}) || !Array.isArray(f.geometry)) continue;
    for (let i = 0; i < f.geometry.length; i += 3) {
      const xy = gridXY(grid, f.geometry[i].lat, f.geometry[i].lon);
      if (xy[0] >= 0 && xy[1] >= 0 && xy[0] <= grid.W && xy[1] <= grid.H) roadPts.push(xy);
    }
    if (roadPts.length > 6000) break;
  }

  // 入海口（珠江口）：海岸线栅格化后从外海种子洪水填充，得到的掩膜再转回水面多边形（岛屿是内环）
  if (jCoast && jCoast.elements.length) {
    const sea = seaMaskRows(jCoast.elements.map((e) => ({ tags: e.tags || {}, geom: e.geometry || [] })).filter((w) => w.geom.length > 1), grid, seaWalls.concat(riverWalls));
    water.push(...sea);
    log('  海域多边形: ' + sea.length + '（来自 ' + jCoast.elements.length + ' 段海岸线）');
  }

  for (const f of openWays(jRoads)) {
    const cls = roadCls(f.tags);
    if (!cls || cls < ROAD_MIN_CLS) continue;
    const pts = [];
    for (const p of f.geom) { const xy = gridXY(grid, p.lat, p.lon); pts.push(xy[0], xy[1]); }
    for (const seg of clipLine(pts, grid, OUT_PAD)) {
      const s = simplify(seg, cls >= 3 ? 0.09 : 0.12);
      if (lineLen(s) < 0.15) continue;
      // 主干道也要求足够长：镇街内部一两百米的短干道在开局会糊成"满屏道路"，
      // 这类短线交给城市发展生长（street 格），只保留跨镇的联系性道路。
      if (cls === 3 && lineLen(s) < ROAD_ARTERY_MIN) continue;
      roadRows.push([intern(f.tags.name || f.tags.ref), cls, roadFlags(f.tags), enc(s)]);
    }
  }

  if (jRail) for (const f of openWays(jRail)) {
    const pts = [];
    for (const p of f.geom) { const xy = gridXY(grid, p.lat, p.lon); pts.push(xy[0], xy[1]); }
    const nm = f.tags.name || f.tags.ref || '';
    for (const seg of clipLine(pts, grid, OUT_PAD)) {
      const s = simplify(seg, 0.1);
      if (lineLen(s) < 0.2) continue;
      let flags = 0;
      if (f.tags.tunnel && f.tags.tunnel !== 'no') flags |= 2;
      if (/高速|高铁|客专|客运专线/.test(nm)) flags |= 16;   // 高铁：引擎按 hsrYear 通车、红白线样式
      railRows.push([intern(nm), flags, enc(s)]);
    }
  }

  // 支路（步行街道，Geo.streets）：'!' 连接的多段折线，引擎只画在已开发街区里（render.js:1199-1210），
  // 随城市生长逐步出现；这是其他地图步行路网"从老城长出来"的来源
  const streetRows = [];
  for (const f of openWays(jStreets)) {
    const pts = [];
    for (const p of f.geom) { const xy = gridXY(grid, p.lat, p.lon); pts.push(xy[0], xy[1]); }
    for (const seg of clipLine(pts, grid, 0.5)) {
      const s = simplify(seg, 0.06);
      if (lineLen(s) < 0.08) continue;
      streetRows.push(enc(s));
    }
  }
  log('  支路（步行街道）: ' + streetRows.length + ' 段');

  // 行政边界（v3.x）：市/区/镇界多边形。引擎用它在 v2.8+ 给区域着色、按区名做片区（city.js:584-648）。
  const adminRows = [];
  {
    const jAdmin = pick((t, e) => e.type === 'relation' && t.boundary === 'administrative' && +t.admin_level > 0);
    const feats = [];
    for (const f of relRings(jAdmin, 'outer')) {
      const lv = +f.tags.admin_level || 0;
      const nm = f.tags.name || '';
      if (!nm || !lv) continue;
      const raw = [];
      for (const p of f.geom) { const xy = gridXY(grid, p.lat, p.lon); raw.push(xy[0], xy[1]); }
      const pts = clipRing(raw, grid);
      if (pts.length < 8) continue;
      const s = simplify(pts, 0.6);
      if (s.length < 8 || ringArea(s) < 40) continue;   // 40 格² ≈ 2.5 km²，太小的村级界不要
      feats.push({ lv: lv, nm: nm, ring: s, area: ringArea(s) });
    }
    // 跨市同名镇（如东莞横沥镇与广州南沙横沥镇，都在本图内）：面积最大的一条保留原名，其余加「（市名）」，
    // 否则引擎按名字匹配片区时会把两块并成一块（city.js:584 用 f.name === rg.geo.admin）。
    const cities = feats.filter(function (f) { return f.lv === 5; });
    const byName = new Map();
    for (const f of feats) { if (!byName.has(f.nm)) byName.set(f.nm, []); byName.get(f.nm).push(f); }
    for (const [nm, list] of byName) {
      if (list.length < 2) continue;
      list.sort(function (a, b) { return b.area - a.area; });
      for (let k = 1; k < list.length; k++) {
        const f = list[k], px = f.ring[0], py = f.ring[1];
        let host = '';
        for (const c of cities) if (pointInRing(px, py, c.ring)) { host = c.nm; break; }
        if (!host) continue;
        const short = host.replace(/市$/, '');
        if (nm.indexOf(short) >= 0) continue;
        f.nm = nm + '（' + short + '）';
        log('  同名片区区分: ' + nm + ' → ' + f.nm);
      }
    }
    for (const f of feats) adminRows.push([f.lv, intern(f.nm), 'o' + enc(f.ring)]);
    log('  行政边界: ' + adminRows.length + ' 条');
  }

  const places = [];
  if (jPlaces) for (const el of jPlaces.elements || []) {
    if (el.type !== 'node' || !el.tags) continue;
    const n = el.tags['name:zh'] || el.tags.name || el.tags['name:en'];
    if (!n) continue;
    const xy = gridXY(grid, el.lat, el.lon);
    if (xy[0] < 0 || xy[1] < 0 || xy[0] > grid.W || xy[1] > grid.H) continue;
    const station = el.tags.railway === 'station' && !/^(subway|light_rail|halt|tram_stop)$/.test(el.tags.station || '');
    places.push([n, +xy[0].toFixed(2), +xy[1].toFixed(2), station ? 1 : 0]);
  }

  const out = { proj: { lon0: +grid.lon0.toFixed(6), lat0: +grid.lat0.toFixed(6), kx: grid.kx, ky: grid.ky },
    names, water, roads: roadRows, streets: streetRows.join('!'), rail: railRows, parks, reserves, woods, admin: adminRows, places };

  for (const [k, v] of Object.entries(out)) {
    if (Array.isArray(v)) log('  ' + k + ': ' + v.length + (v.length && Array.isArray(v[0]) ? ' 行' : ' 项'));
  }

  const head = "'use strict';\n" +
    '// ' + (args.title || ID.toUpperCase()) + ' · 地理数据（由 OpenStreetMap 数据生成，© OpenStreetMap 贡献者，ODbL）\n' +
    '// 生成命令：node scripts/osm-to-geo.mjs --id ' + ID + (args.boundary ? ' --boundary ' + args.boundary : '') + ' --fetch --build\n' +
    '// 范围：经度 ' + grid.lon0.toFixed(4) + '…' + grid.lon1.toFixed(4) + '，纬度 ' + grid.lat0.toFixed(4) + '…' + grid.lat1.toFixed(4) +
    '，' + grid.W + ' × ' + grid.H + ' 格（每格 ' + CELL_M + ' m）\n' +
    '(function (CM) {\n  (CM.GEOS = CM.GEOS || {}).' + ID + ' = {\n';
  const body = Object.entries(out).map(([k, v]) => '    ' + k + ': ' + JSON.stringify(v)).join(',\n');
  const text = head + body + '\n  };\n})(window.CM);\n';
  await fsp.writeFile(OUT, text);
  log('· 已写出 ' + path.relative(ROOT, OUT) + '，' + (text.length / 1048576).toFixed(2) + ' MB');
}

// ---------------------------------------------------------------- main

const bb = await loadBbox();
const grid = makeGrid(bb);
log('· 格网 ' + grid.W + ' × ' + grid.H + '（kx=' + grid.kx + ', ky=' + grid.ky + '）⇒ ' + (grid.W * grid.H).toLocaleString() + ' 格');

if (args.count) await countOnly(grid);
else if (args.fetch) await download(grid);
else if (args.build) await build(grid);
else log('· 没有任何动作：加 --count / --fetch / --build');