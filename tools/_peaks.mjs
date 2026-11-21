// 从广东 PBF 里抽出图幅附近的高程点（natural=peak / place=locality 带名字），用于给山体命名
import fs from 'node:fs';
import zlib from 'node:zlib';

const PBF = 'tools/osm-cache/guangdong.osm.pbf';
const BB = { west: 113.05, south: 22.18, east: 114.73, north: 23.62 };
const buf = fs.readFileSync(PBF);

function varint(b, p) { let v = 0, sh = 0, c; do { c = b[p++]; v += (c & 0x7f) * Math.pow(2, sh); sh += 7; } while (c & 0x80); return [v, p]; }
function zig(v) { return v % 2 ? -(v + 1) / 2 : v / 2; }
function* iter(b, start, end) {
  let p = start;
  while (p < end) {
    let key; [key, p] = varint(b, p);
    const f = key >>> 3, w = key & 7;
    if (w === 0) { let v; [v, p] = varint(b, p); yield [f, w, v]; }
    else if (w === 2) { let len; [len, p] = varint(b, p); yield [f, w, b.subarray(p, p + len)]; p += len; }
    else if (w === 5) { yield [f, w, b.readUInt32LE(p)]; p += 4; }
    else if (w === 1) { yield [f, w, Number(b.readBigUInt64LE(p))]; p += 8; }
    else throw new Error('wire ' + w);
  }
}
function packed(b) { const out = []; let p = 0; while (p < b.length) { let v; [v, p] = varint(b, p); out.push(v); } return out; }

const peaks = [];
let pos = 0, blocks = 0;
while (pos < buf.length) {
  const hl = buf.readInt32BE(pos); pos += 4;
  const header = buf.subarray(pos, pos + hl); pos += hl;
  let type = '';
  for (const [f, w, v] of iter(header, 0, header.length)) if (f === 1) type = v.toString('utf8');
  let blen = 0; for (const [f,w,v] of iter(header,0,header.length)) if (f===3) blen = v;
  const blob = buf.subarray(pos, pos + blen); pos += blen;
  if (type !== 'OSMData') continue;
  blocks++;
  let raw = null, z = null;
  for (const [f, w, v] of iter(blob, 0, blob.length)) { if (f === 1) raw = v; else if (f === 3) z = v; }
  const data = raw || zlib.inflateSync(z);
  let gran = 100, loLat = 0, loLon = 0, st = null;
  const groups = [];
  for (const [f, w, v] of iter(data, 0, data.length)) {
    if (f === 1) st = v;
    else if (f === 2) groups.push(v);
    else if (f === 17) gran = v;
    else if (f === 19) loLat = v;
    else if (f === 20) loLon = v;
  }
  if (!st) continue;
  const strings = [];
  { let p = 0; while (p < st.length) { let len; [len, p] = varint(st, p); strings.push(st.subarray(p, p + len).toString('utf8')); p += len; } }
  for (const g of groups) {
    for (const [f, w, v] of iter(g, 0, g.length)) {
      if (f !== 1) continue;
      // dense
      let lat = 0, lon = 0; const keys = [], vals = [];
      for (const [ff, ww, vv] of iter(v, 0, v.length)) {
        if (ff === 8) vv.forEach((q) => keys.push(q));
        else if (ff === 9) vv.forEach((q) => vals.push(q));
      }
      let i = 0, j = 0;
      const lats = [], lons = [], ids = [];
      for (const [ff, ww, vv] of iter(v, 0, v.length)) {
        if (ff === 1) vv.forEach((q) => ids.push(q));
        else if (ff === 8) { vv.forEach((q) => { lat += zig(q); lats.push(lat); }); }
        else if (ff === 9) { vv.forEach((q) => { lon += zig(q); lons.push(lon); }); }
      }
      // tags: keys_vals packed in field 10
      const kv = [];
      for (const [ff, ww, vv] of iter(v, 0, v.length)) if (ff === 10) kv.push(...packed(vv));
      let k = 0;
      for (let n = 0; n < lats.length; n++) {
        const y = (loLat + gran * lats[n]) * 1e-9, x = (loLon + gran * lons[n]) * 1e-9;
        const tags = {};
        while (k < kv.length && kv[k] !== 0) { tags[strings[kv[k]]] = strings[kv[k + 1]]; k += 2; }
        k++;
        if (x < BB.west || x > BB.east || y < BB.south || y > BB.north) continue;
        if (!(tags.natural === 'peak' || tags.natural === 'hill' || tags.place === 'locality' || tags.natural === 'ridge')) continue;
        if (!tags.name) continue;
        peaks.push({ name: tags.name, lat: +y.toFixed(5), lon: +x.toFixed(5), ele: +(tags.ele || 0) || null, kind: tags.natural || tags.place });
      }
    }
  }
}
const seen = new Set();
const out = peaks.filter((p) => { const k = p.name; if (seen.has(k)) return false; seen.add(k); return true; });
fs.writeFileSync('tools/osm-cache/dg-peaks.json', JSON.stringify(out, null, 1));
console.log('blocks', blocks, 'peaks', peaks.length, 'unique', out.length);
console.log(out.filter((p) => p.kind === 'peak').sort((a, b) => (b.ele || 0) - (a.ele || 0)).slice(0, 40).map((p) => p.name + '(' + (p.ele || '?') + 'm)').join(' '));