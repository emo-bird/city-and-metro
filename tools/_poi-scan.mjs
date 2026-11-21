// 从省级 PBF 里扫出"有名气"的 POI（医院/高校/商场/公园/文体/产业/交通），
// 用 admin_level=8 的镇界多边形把每个点落到镇街，输出 JSON 供人工筛选。
//   node tools/_poi-scan.mjs
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const PBF = 'tools/osm-cache/guangdong.osm.pbf';
const BB = { west: 113.35, south: 22.55, east: 114.35, north: 23.22 };
const LOGF = 'tools/_poi-scan.log';
writeFileSync(LOGF, '');
const log = (...a) => appendFileSync(LOGF, a.join(' ') + '\n');

const buf = readFileSync(PBF);
function readVarint(b, p) { let r = 0, s = 0, c; do { c = b[p++]; r += (c & 0x7f) * 2 ** s; s += 7; } while (c & 0x80); return [r, p]; }
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
    else throw new Error('wire ' + wire);
  }
}
function packedList(x) { const o = []; let p = 0; while (p < x.length) { let d; [d, p] = readVarint(x, p); o.push(d); } return o; }
function* blobs() {
  let pos = 0;
  while (pos < buf.length) {
    const hl = buf.readUInt32BE(pos); pos += 4;
    const he = pos + hl;
    let type = null, datasize = 0;
    for (const [f, , v] of iterate(buf, pos, he)) { if (f === 1) type = Buffer.from(v).toString('utf8'); else if (f === 3) datasize = v; }
    pos = he; const be = pos + datasize;
    let raw = null, z = null;
    for (const [f, , v] of iterate(buf, pos, be)) { if (f === 1) raw = v; else if (f === 3) z = v; }
    pos = be;
    yield [type, raw || (z ? inflateSync(z) : null)];
  }
}
function parseBlock(block) {
  let st = null, granularity = 100, latOff = 0, lonOff = 0;
  const groups = [];
  for (const [f, , v] of iterate(block, 0, block.length)) {
    if (f === 1) { st = []; for (const [k, , x] of iterate(v, 0, v.length)) if (k === 1) st.push(Buffer.from(x).toString('utf8')); }
    else if (f === 2) groups.push(v);
    else if (f === 17) granularity = v;
    else if (f === 19) latOff = zig(v);
    else if (f === 20) lonOff = zig(v);
  }
  return { st, groups, granularity, latOff, lonOff };
}
const inBB = (lat, lon) => lat >= BB.south && lat <= BB.north && lon >= BB.west && lon <= BB.east;

// ---------------------------------------------------------------- 类别判定
const KEEP_TAGS = ['name', 'name:en', 'amenity', 'healthcare', 'shop', 'tourism', 'leisure',
  'landuse', 'building', 'railway', 'aeroway', 'historic', 'office', 'man_made', 'operator',
  'brand', 'start_date', 'opening_date', 'capacity', 'religion', 'industrial', 'place', 'addr:street'];

function classify(t) {
  const a = t.amenity || '', h = t.healthcare || '', sh = t.shop || '', to = t.tourism || '';
  const le = t.leisure || '', lu = t.landuse || '', rw = t.railway || '', aw = t.aeroway || '';
  const bd = t.building || '', hi = t.historic || '', of = t.office || '', mm = t.man_made || '';
  if (a === 'hospital' || h === 'hospital') return 'medical';
  if (a === 'clinic' || h === 'clinic') return 'medical';
  if (a === 'university' || a === 'college') return 'edu';
  if (sh === 'mall' || sh === 'department_store') return 'mall';
  if (a === 'marketplace') return 'mall';
  if (lu === 'retail' && t.name) return 'mall';
  if (le === 'park' || le === 'nature_reserve' || le === 'garden') return 'park';
  if (to === 'attraction' || to === 'theme_park' || to === 'museum' || to === 'zoo') return 'park';
  if (hi === 'memorial' || hi === 'monument' || hi === 'castle' || hi === 'fort') return 'park';
  if (a === 'theatre' || a === 'library' || a === 'museum' || a === 'arts_centre' || a === 'exhibition_centre' || a === 'community_centre' || a === 'conference_centre') return 'culture';
  if (le === 'stadium' || le === 'sports_centre' || le === 'sports_hall' || le === 'water_park') return 'culture';
  if (rw === 'station' || rw === 'halt') return 'transport';
  if (aw === 'aerodrome' || aw === 'terminal' || aw === 'gate') return 'transport';
  if (lu === 'industrial' || lu === 'port' || lu === 'harbour' || mm === 'works' || of === 'company' || bd === 'industrial') return 'industry';
  if (lu === 'commercial' && t.name) return 'industry';
  return null;
}
const NAME_HINT = /华为|OPPO|vivo|步步高|玖龙|雀巢|生益|散裂|中子源|松山湖|滨海湾|银瓶|虎门港|东莞港|港区|科学城|产业园|工业园|研发|总部|基地|大桥|码头|港/;

// ---------------------------------------------------------------- Pass A：关系
const rels = [];
const relWayIds = new Set();
for (const [type, block] of blobs()) {
  if (type !== 'OSMData' || !block) continue;
  const { st, groups } = parseBlock(block);
  if (!st) continue;
  for (const g of groups) {
    for (const [f, , v] of iterate(g, 0, g.length)) {
      if (f !== 4) continue;
      let id = 0; const keys = [], vals = [], memids = [], types = [], roles = [];
      for (const [k, wire, x] of iterate(v, 0, v.length)) {
        if (k === 1) id = x;
        else if (k === 2) keys.push(...(wire === 2 ? packedList(x) : [x]));
        else if (k === 3) vals.push(...(wire === 2 ? packedList(x) : [x]));
        else if (k === 8) roles.push(...(wire === 2 ? packedList(x) : [x]));
        else if (k === 9) memids.push(...(wire === 2 ? packedList(x) : [x]));
        else if (k === 10) types.push(...(wire === 2 ? packedList(x) : [x]));
      }
      const tags = {};
      for (let i = 0; i < keys.length; i++) tags[st[keys[i]]] = st[vals[i]] || '';
      if (!tags.name) continue;
      if (tags.boundary === 'administrative') { rels.push({ id, tags, wayRefs: [], admin: true }); continue; }
      const cat = classify(tags);
      if (!cat) continue;
      const wayRefs = []; let ref = 0;
      for (let i = 0; i < memids.length; i++) {
        ref += zig(memids[i]);
        if ((types[i] || 0) === 1) wayRefs.push(ref);
      }
      if (!wayRefs.length) continue;
      for (const w of wayRefs) relWayIds.add(w);
      rels.push({ id, tags, wayRefs, cat });
    }
  }
}
log('rel', rels.length, 'relWays', relWayIds.size);

// ---------------------------------------------------------------- Pass B：way
const ways = new Map(); // id -> refs
const wayCands = [];
for (const [type, block] of blobs()) {
  if (type !== 'OSMData' || !block) continue;
  const { st, groups } = parseBlock(block);
  if (!st) continue;
  for (const g of groups) {
    for (const [f, , v] of iterate(g, 0, g.length)) {
      if (f !== 3) continue;
      let id = 0; const keys = [], vals = [], refs = [];
      for (const [k, wire, x] of iterate(v, 0, v.length)) {
        if (k === 1) id = x;
        else if (k === 2) keys.push(...(wire === 2 ? packedList(x) : [x]));
        else if (k === 3) vals.push(...(wire === 2 ? packedList(x) : [x]));
        else if (k === 8) { let r = 0; for (const d of packedList(x)) { r += zig(d); refs.push(r); } }
      }
      const tags = {};
      for (let i = 0; i < keys.length; i++) tags[st[keys[i]]] = st[vals[i]] || '';
      const isRel = relWayIds.has(id);
      const cat = tags.name ? classify(tags) : null;
      const named = tags.name && (cat || NAME_HINT.test(tags.name));
      if (!isRel && !named) continue;
      ways.set(id, refs);
      if (named) wayCands.push({ id, tags, cat, refs });
    }
  }
}
log('ways kept', ways.size, 'cand', wayCands.length);
for (const r of rels) if (r.wayRefs.length) { r.refs = []; for (const w of r.wayRefs) { const rr = ways.get(w); if (rr) r.refs.push(...rr); } }
relWayIds.clear();
ways.clear();

// ---------------------------------------------------------------- Pass C：节点
const need = new Set();
for (const w of wayCands) for (const r of w.refs) need.add(r);
for (const r of rels) if (r.refs) for (const x of r.refs) need.add(x);
log('need nodes', need.size);

const coord = new Map();
const nodeCands = [];
for (const [type, block] of blobs()) {
  if (type !== 'OSMData' || !block) continue;
  const { st, groups, granularity, latOff, lonOff } = parseBlock(block);
  for (const g of groups) {
    for (const [f, , v] of iterate(g, 0, g.length)) {
      if (f === 2) {
        const ids = [], lats = [], lons = [], kv = [];
        for (const [k, , x] of iterate(v, 0, v.length)) {
          if (k === 1) ids.push(...packedList(x));
          else if (k === 8) lats.push(...packedList(x));
          else if (k === 9) lons.push(...packedList(x));
          else if (k === 10) kv.push(...packedList(x));
        }
        let id = 0, la = 0, lo = 0, q = 0;
        for (let i = 0; i < ids.length; i++) {
          id += zig(ids[i]); la += zig(lats[i] || 0); lo += zig(lons[i] || 0);
          const tla = (latOff + granularity * la) * 1e-9, tlo = (lonOff + granularity * lo) * 1e-9;
          const tags = {};
          if (kv.length) {
            while (q < kv.length && kv[q] !== 0) { const kk = kv[q++], vv = kv[q++]; tags[st[kk]] = st[vv] || ''; }
            q++;
          }
          if (!inBB(tla, tlo)) continue;
          if (need.has(id)) coord.set(id, [tla, tlo]);
          if (!tags.name) continue;
          const cat = classify(tags);
          if (!cat && !NAME_HINT.test(tags.name)) continue;
          nodeCands.push({ id, tags, cat, lat: tla, lon: tlo });
        }
      } else if (f === 1) {
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
        if (need.has(id)) coord.set(id, [tla, tlo]);
        if (!st || !keys.length) continue;
        const tags = {};
        for (let i = 0; i < keys.length; i++) tags[st[keys[i]]] = st[vals[i]] || '';
        if (!tags.name) continue;
        const cat = classify(tags);
        if (!cat && !NAME_HINT.test(tags.name)) continue;
        nodeCands.push({ id, tags, cat, lat: tla, lon: tlo });
      }
    }
  }
}
log('coords', coord.size, 'nodes', nodeCands.length);

const pick = (t) => { const o = {}; for (const k of KEEP_TAGS) if (t[k]) o[k] = t[k]; return o; };
const center = (refs) => {
  let minLat = 99, maxLat = -99, minLon = 999, maxLon = -999, n = 0;
  for (const r of refs) { const c = coord.get(r); if (!c) continue; n++; if (c[0] < minLat) minLat = c[0]; if (c[0] > maxLat) maxLat = c[0]; if (c[1] < minLon) minLon = c[1]; if (c[1] > maxLon) maxLon = c[1]; }
  if (!n) return null;
  return [(minLat + maxLat) / 2, (minLon + maxLon) / 2];
};

const out = nodeCands.map((c) => ({ kind: 'node', name: c.tags.name, cat: c.cat, lat: +c.lat.toFixed(5), lon: +c.lon.toFixed(5), tags: pick(c.tags) }));
for (const w of wayCands) {
  const c = center(w.refs); if (!c) continue;
  out.push({ kind: 'way', name: w.tags.name, cat: w.cat, lat: +c[0].toFixed(5), lon: +c[1].toFixed(5), tags: pick(w.tags) });
}
for (const r of rels) {
  if (!r.refs || !r.refs.length) continue;
  if (!inBB(...(() => { const c = center(r.refs); return c ? [c[0], c[1]] : [99, 0]; })())) continue;
  const c = center(r.refs); if (!c) continue;
  out.push({ kind: 'relation', name: r.tags.name, cat: r.cat || 'admin', lat: +c[0].toFixed(5), lon: +c[1].toFixed(5), admin: r.tags.admin_level || null, tags: pick(r.tags) });
}

// ---------------------------------------------------------------- 输出（镇街归属另跑 _poi-town.mjs）
writeFileSync('tools/_poi-raw.json', JSON.stringify({ bb: BB, items: out }));
const byCat = {};
for (const o of out) byCat[o.cat] = (byCat[o.cat] || 0) + 1;
log('total ' + out.length + ' ' + JSON.stringify(byCat));
console.log('done ' + out.length);