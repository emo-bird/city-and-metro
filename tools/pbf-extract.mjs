// 从省级 PBF 一次性抽出地图所需的全部图层，写成与 Overpass 同形的 JSON 缓存。
// 目的：不再依赖 Overpass（各镜像长期 502/504、跨市大关系必然超时），water/roads/rail/green/coast/admin 全部由 PBF 生成。
//
//   node tools/pbf-extract.mjs                      # 默认读 tools/osm-cache/guangdong.osm.pbf
//   node tools/pbf-extract.mjs --pbf <file> --out <dir>
//
// 输出目录里每个图层一个 JSON：pbf-water / pbf-waterrel / pbf-waterline / pbf-roads / pbf-rail /
// pbf-green / pbf-places / pbf-coast / pbf-admin，形状与 Overpass `out geom` 完全一致，
// 因此 scripts/osm-to-geo.mjs --build 可以直接吃。
//
// PBF 布局： [4 字节大端 headerLen][BlobHeader][Blob(datasize 字节)]
//   BlobHeader: 1 = type(OSMHeader/OSMData), 3 = datasize
//   Blob:       1 = raw, 3 = zlib
//   PrimitiveBlock: 1 = stringtable, 2 = primitivegroup, 17 = granularity(100), 19 = lat_offset, 20 = lon_offset
//   DenseNodes: 1 = id, 8 = lat, 9 = lon（均为 packed sint64 增量）
//   Node: 1 = id, 2 = keys, 3 = vals, 8 = lat, 9 = lon
//   Way: 1 = id, 2 = keys, 3 = vals, 8 = refs（packed sint64 增量）
//   Relation: 1 = id, 2 = keys, 3 = vals, 8 = memids, 9 = types, 10 = roles
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import path from 'node:path';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.slice(0, 2) !== '--') throw new Error('无法识别的参数：' + a);
  const next = process.argv[i + 1];
  if (next === undefined || next.slice(0, 2) === '--') args[a.slice(2)] = true;
  else { args[a.slice(2)] = next; i++; }
}

const PBF = args.pbf || 'tools/osm-cache/guangdong.osm.pbf';
const OUT = args.out || 'tools/osm-cache/dg-pbf';
// 取图范围 = 地图矩形（113.50,22.63…114.28,23.17）再向外放 0.45°：
// 界外的半个交通小区、跨界的河面/环城高速都要完整取到，否则裁剪后边界上会出现缺口。
const BB = { west: 113.05, south: 22.18, east: 114.73, north: 23.62 };

const log = (...a) => console.error(...a);

const buf = await readFile(PBF);
log('· PBF ' + (buf.length / 1048576).toFixed(1) + ' MB');

// ---------------------------------------------------------------- protobuf

function readVarint(b, p) {
  let r = 0, s = 0, c;
  do { c = b[p++]; r += (c & 0x7f) * 2 ** s; s += 7; } while (c & 0x80);
  return [r, p];
}
const zig = (v) => (v % 2 ? -(v + 1) / 2 : v / 2);

function* iterate(b, start, end) {
  let p = start;
  while (p < end) {
    let key; [key, p] = readVarint(b, p);
    const field = Math.floor(key / 8), wire = key % 8;
    if (wire === 0) { let v; [v, p] = readVarint(b, p); yield [field, 0, v]; }
    else if (wire === 2) { let len; [len, p] = readVarint(b, p); yield [field, 2, b.subarray(p, p + len)]; p += len; }
    else if (wire === 5) p += 4;
    else if (wire === 1) p += 8;
    else throw new Error('unsupported wire ' + wire + ' @' + p);
  }
}
function packedList(x) { const out = []; let p = 0; while (p < x.length) { let d; [d, p] = readVarint(x, p); out.push(d); } return out; }

function* blobs() {
  let pos = 0;
  while (pos < buf.length) {
    const headerLen = buf.readUInt32BE(pos); pos += 4;
    const headerEnd = pos + headerLen;
    let type = null, datasize = 0;
    for (const [f, , v] of iterate(buf, pos, headerEnd)) {
      if (f === 1) type = Buffer.from(v).toString('utf8');
      else if (f === 3) datasize = v;
    }
    pos = headerEnd;
    const blobEnd = pos + datasize;
    let raw = null, z = null;
    for (const [f, , v] of iterate(buf, pos, blobEnd)) {
      if (f === 1) raw = v;
      else if (f === 3) z = v;
    }
    pos = blobEnd;
    yield [type, raw || (z ? inflateSync(z) : null)];
  }
}

// 一个 PrimitiveBlock → { st, groups, granularity, latOff, lonOff }
function parseBlock(block) {
  let st = null, granularity = 100, latOff = 0, lonOff = 0;
  const groups = [];
  for (const [f, , v] of iterate(block, 0, block.length)) {
    if (f === 1) {
      st = [];
      for (const [k, , x] of iterate(v, 0, v.length)) if (k === 1) st.push(Buffer.from(x).toString('utf8'));
    } else if (f === 2) groups.push(v);
    else if (f === 17) granularity = v;
    else if (f === 19) latOff = zig(v);
    else if (f === 20) lonOff = zig(v);
  }
  return { st, groups, granularity, latOff, lonOff };
}
const inBB = (lat, lon) => lat >= BB.south && lat <= BB.north && lon >= BB.west && lon <= BB.east;

// ---------------------------------------------------------------- 第一遍：关系

const rels = [];          // 与地图有关的关系（水体/绿地/行政边界）
const relWayIds = new Set();
let nRel = 0;
for (const [type, block] of blobs()) {
  if (type !== 'OSMData' || !block) continue;
  const { st, groups } = parseBlock(block);
  if (!st) continue;
  for (const g of groups) {
    for (const [f, , v] of iterate(g, 0, g.length)) {
      if (f !== 4) continue;
      nRel++;
      let id = 0; const keys = [], vals = [], memids = [], types = [], roles = [];
      for (const [k, wire, x] of iterate(v, 0, v.length)) {
        if (k === 1) id = x;
        else if (k === 2) keys.push(...(wire === 2 ? packedList(x) : [x]));
        else if (k === 3) vals.push(...(wire === 2 ? packedList(x) : [x]));
        // Relation 的字段顺序是 roles_sid=8、memids=9（sint64 增量）、types=10（0=node/1=way/2=relation）
        else if (k === 8) roles.push(...(wire === 2 ? packedList(x) : [x]));
        else if (k === 9) memids.push(...(wire === 2 ? packedList(x) : [x]));
        else if (k === 10) types.push(...(wire === 2 ? packedList(x) : [x]));
      }
      const tags = {};
      for (let i = 0; i < keys.length; i++) tags[st[keys[i]]] = st[vals[i]] || '';
      const water = tags.natural === 'water' || tags.waterway === 'riverbank' || /^(river|lake|reservoir|basin|canal)$/.test(tags.water || '');
      const green = /^(park|garden)$/.test(tags.leisure || '') || /^(protected_area|national_park)$/.test(tags.boundary || '') || tags.landuse === 'forest' || tags.natural === 'wood';
      const admin = tags.boundary === 'administrative' && +tags.admin_level > 0;
      if (!water && !green && !admin) continue;
      const members = [];
      let ref = 0;
      for (let i = 0; i < memids.length; i++) {
        ref += zig(memids[i]);
        const t = types[i] || 0;
        if (t !== 1) continue;                      // 只要 way 成员
        members.push({ type: 'way', ref, role: st[roles[i] || 0] || '' });
        relWayIds.add(ref);
      }
      if (!members.length) continue;
      rels.push({ id, tags, members });
    }
  }
}
log('· 关系总数 ' + nRel.toLocaleString() + '，收下 ' + rels.length + '（成员 way ' + relWayIds.size + '）');

// ---------------------------------------------------------------- 第二遍：节点 + way

const nIdx = new Map();
const nx = [], ny = [];
const places = [];
const ways = [];          // {id, tags, refs}
let nNode = 0, nWay = 0;

const wantWay = (t, id) => {
  if (relWayIds.has(id)) return true;
  if (t.natural === 'water' || t.waterway === 'riverbank' || t.landuse === 'reservoir') return true;
  if (/^(river|lake|reservoir|basin|canal|pond)$/.test(t.water || '')) return true;
  if (/^(river|canal|stream)$/.test(t.waterway || '')) return true;
  if (/^(motorway|trunk|primary|secondary|tertiary)(_link)?$/.test(t.highway || '')) return true;
  if (/^(residential|unclassified|living_street|pedestrian|footway|path|steps|cycleway)$/.test(t.highway || '')) return true;
  if (t.railway === 'rail') return true;
  if (/^(park|garden)$/.test(t.leisure || '')) return true;
  if (/^(protected_area|national_park)$/.test(t.boundary || '')) return true;
  if (t.landuse === 'forest' || t.natural === 'wood') return true;
  if (t.natural === 'coastline') return true;
  return false;
};

for (const [type, block] of blobs()) {
  if (type !== 'OSMData' || !block) continue;
  const { st, groups, granularity, latOff, lonOff } = parseBlock(block);
  for (const g of groups) {
    for (const [f, , v] of iterate(g, 0, g.length)) {
      if (f === 2) {                                 // DenseNodes
        const ids = [], lats = [], lons = [], kv = [];
        for (const [k, , x] of iterate(v, 0, v.length)) {
          if (k === 1) ids.push(...packedList(x));
          else if (k === 8) lats.push(...packedList(x));
          else if (k === 9) lons.push(...packedList(x));
          // keys_vals：key,val,key,val…，0 表示该节点结束（带标签的节点走这里）
          else if (k === 10) kv.push(...packedList(x));
        }
        let id = 0, la = 0, lo = 0, q = 0;
        for (let i = 0; i < ids.length; i++) {
          id += zig(ids[i]); la += zig(lats[i] || 0); lo += zig(lons[i] || 0);
          const tla = (latOff + granularity * la) * 1e-9, tlo = (lonOff + granularity * lo) * 1e-9;
          const tags = {};
          if (kv.length) {                            // 每个节点至少有一个 0 终止符
            while (q < kv.length && kv[q] !== 0) {
              const kk = kv[q++], vv = kv[q++];
              tags[st[kk]] = st[vv] || '';
            }
            q++;
          }
          if (!inBB(tla, tlo)) continue;
          nx.push(tla); ny.push(tlo); nIdx.set(id, nx.length - 1); nNode++;
          if (kv.length && (/^(city|town|suburb|quarter|neighbourhood|village|hamlet)$/.test(tags.place || '') || tags.railway === 'station')) {
            places.push({ type: 'node', id, lat: tla, lon: tlo, tags });
          }
        }
      } else if (f === 1) {                          // Node
        let id = 0, la = 0, lo = 0; const keys = [], vals = [];
        for (const [k, wire, x] of iterate(v, 0, v.length)) {
          if (k === 1) id = x;
          else if (k === 2) keys.push(...(wire === 2 ? packedList(x) : [x]));
          else if (k === 3) vals.push(...(wire === 2 ? packedList(x) : [x]));
          else if (k === 8) la = zig(x);
          else if (k === 9) lo = zig(x);
        }
        const tla = (latOff + granularity * la) * 1e-9, tlo = (lonOff + granularity * lo) * 1e-9;
        if (!inBB(tla, tlo)) continue;
        nx.push(tla); ny.push(tlo); nIdx.set(id, nx.length - 1); nNode++;
        if (st && (keys.length || vals.length)) {
          const tags = {};
          for (let i = 0; i < keys.length; i++) tags[st[keys[i]]] = st[vals[i]] || '';
          if (/^(city|town|suburb|quarter|neighbourhood|village|hamlet)$/.test(tags.place || '') || tags.railway === 'station') {
            places.push({ type: 'node', id, lat: tla, lon: tlo, tags });
          }
        }
      } else if (f === 3) {                          // Way
        nWay++;
        let id = 0; const keys = [], vals = [], refs = [];
        for (const [k, wire, x] of iterate(v, 0, v.length)) {
          if (k === 1) id = x;
          else if (k === 2) keys.push(...(wire === 2 ? packedList(x) : [x]));
          else if (k === 3) vals.push(...(wire === 2 ? packedList(x) : [x]));
          else if (k === 8) { let r = 0; for (const d of packedList(x)) { r += zig(d); refs.push(r); } }
        }
        if (!st || !refs.length) continue;
        const tags = {};
        for (let i = 0; i < keys.length; i++) tags[st[keys[i]]] = st[vals[i]] || '';
        if (!wantWay(tags, id)) continue;
        ways.push({ id, tags, refs });
      }
    }
  }
}
log('· 节点 ' + nNode.toLocaleString() + '，way ' + nWay.toLocaleString() + '，收下 way ' + ways.length + '，地点 ' + places.length);

// ---------------------------------------------------------------- 第三遍：关系成员的界外节点

// 跨市水域（狮子洋/珠江口）和市界关系的成员 way 大多延伸出取图范围，缺了界外节点就拼不出闭合环。
// 这一遍只为这些 way 的节点补坐标，别的节点一律跳过。
const need = new Set();
for (const w of ways) {
  if (!relWayIds.has(w.id)) continue;
  for (const r of w.refs) if (!nIdx.has(r)) need.add(r);
}
log('· 关系成员缺节点 ' + need.size.toLocaleString());
if (need.size) {
  let got = 0;
  for (const [type, block] of blobs()) {
    if (type !== 'OSMData' || !block) continue;
    const { groups, granularity, latOff, lonOff } = parseBlock(block);
    for (const g of groups) {
      for (const [f, , v] of iterate(g, 0, g.length)) {
        if (f === 2) {
          const ids = [], lats = [], lons = [];
          for (const [k, , x] of iterate(v, 0, v.length)) {
            if (k === 1) ids.push(...packedList(x));
            else if (k === 8) lats.push(...packedList(x));
            else if (k === 9) lons.push(...packedList(x));
          }
          let id = 0, la = 0, lo = 0;
          for (let i = 0; i < ids.length; i++) {
            id += zig(ids[i]); la += zig(lats[i] || 0); lo += zig(lons[i] || 0);
            if (!need.has(id)) continue;
            const tla = (latOff + granularity * la) * 1e-9, tlo = (lonOff + granularity * lo) * 1e-9;
            nx.push(tla); ny.push(tlo); nIdx.set(id, nx.length - 1); got++;
          }
        } else if (f === 1) {
          let id = 0, la = 0, lo = 0;
          for (const [k, , x] of iterate(v, 0, v.length)) {
            if (k === 1) id = x;
            else if (k === 8) la = zig(x);
            else if (k === 9) lo = zig(x);
          }
          if (!need.has(id)) continue;
          const tla = (latOff + granularity * la) * 1e-9, tlo = (lonOff + granularity * lo) * 1e-9;
          nx.push(tla); ny.push(tlo); nIdx.set(id, nx.length - 1); got++;
        }
      }
    }
  }
  log('· 补到 ' + got.toLocaleString() + ' 个节点');
}

// ---------------------------------------------------------------- 组装几何

function geomOf(refs) {
  const g = [];
  let miss = 0;
  for (const r of refs) {
    const i = nIdx.get(r);
    if (i === undefined) { miss++; continue; }
    g.push({ lat: nx[i], lon: ny[i] });
  }
  return { geom: g, full: miss === 0 && g.length === refs.length };
}

const byId = new Map();
for (const w of ways) {
  const { geom, full } = geomOf(w.refs);
  if (geom.length < 2) continue;
  byId.set(w.id, { type: 'way', id: w.id, tags: w.tags, geometry: geom, full });
}

const el = (w) => ({ type: 'way', id: w.id, tags: w.tags, geometry: w.geometry });

// 关系：成员的 way 几何 + 关系 tags
const relOut = new Map(rels.map((r) => [r.id, { type: 'relation', id: r.id, tags: r.tags, members: [] }]));
for (const r of rels) {
  const o = relOut.get(r.id);
  for (const m of r.members) {
    const w = byId.get(m.ref);
    if (!w || !w.full) continue;                   // 只有完整几何才能拼环
    o.members.push({ type: 'way', ref: m.ref, role: m.role, geometry: w.geometry });
  }
}

const layers = { water: [], waterrel: [], waterline: [], roads: [], streets: [], rail: [], green: [], coast: [], admin: [] };
// 支路（步行街道）：引擎的 Geo.streets，只在开发街区里绘制、随城市生长；其他地图的数据里都有这一层
const isStreet = (t) => /^(residential|unclassified|living_street|pedestrian|footway|path|steps|cycleway)$/.test(t.highway || '');
const isWaterArea = (t) => t.natural === 'water' || t.waterway === 'riverbank' || t.landuse === 'reservoir' || /^(river|lake|reservoir|basin|canal|pond)$/.test(t.water || '');
const isWaterLine = (t) => /^(river|canal|stream)$/.test(t.waterway || '');
const isGreen = (t) => /^(park|garden)$/.test(t.leisure || '') || /^(protected_area|national_park)$/.test(t.boundary || '') || t.landuse === 'forest' || t.natural === 'wood';

for (const w of byId.values()) {
  const t = w.tags;
  if (isWaterArea(t)) layers.water.push(el(w));
  if (isWaterLine(t)) layers.waterline.push(el(w));
  if (/^(motorway|trunk|primary|secondary|tertiary)(_link)?$/.test(t.highway || '')) layers.roads.push(el(w));
  if (isStreet(t)) layers.streets.push(el(w));
  if (t.railway === 'rail') layers.rail.push(el(w));
  if (isGreen(t)) layers.green.push(el(w));
  if (t.natural === 'coastline') layers.coast.push(el(w));
}
for (const o of relOut.values()) {
  const t = o.tags;
  if (!o.members.length) continue;
  if (isWaterArea(t)) layers.waterrel.push(o);
  if (isGreen(t)) layers.green.push(o);
  if (t.boundary === 'administrative') layers.admin.push(o);
}
layers.places = places;

await mkdir(OUT, { recursive: true });
let total = 0;
for (const [k, list] of Object.entries(layers)) {
  const p = path.join(OUT, 'pbf-' + k + '.json');
  const txt = JSON.stringify({ elements: list });
  await writeFile(p, txt);
  total += txt.length;
  log('  pbf-' + k + '.json  ' + list.length + ' 个要素  ' + (txt.length / 1048576).toFixed(2) + ' MB');
}

// 行政边界单独留一份给区域生成用（格网坐标由 scripts/osm-to-geo.mjs 负责；这里给经纬度）
const adminOut = layers.admin.map((o) => ({ id: o.id, name: o.tags.name || '', nameEn: o.tags['name:en'] || '', level: +o.tags.admin_level || 0, tags: o.tags, members: o.members }));
await writeFile(path.join(OUT, 'admin-raw.json'), JSON.stringify(adminOut));
log('· 行政边界 ' + adminOut.length + ' 个 → admin-raw.json');
log('· 合计 ' + (total / 1048576).toFixed(1) + ' MB → ' + OUT);