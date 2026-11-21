import fs from 'node:fs';
import zlib from 'node:zlib';
const buf = fs.readFileSync('tools/osm-cache/guangdong.osm.pbf');
function varint(b, p) { let v = 0, sh = 0, c; do { c = b[p++]; v += (c & 0x7f) * Math.pow(2, sh); sh += 7; } while (c & 0x80); return [v, p]; }
function zig(v) { return v % 2 ? -(v + 1) / 2 : v / 2; }
function* iter(b, start, end) {
  let p = start;
  while (p < end) {
    let key; [key, p] = varint(b, p);
    const f = key >>> 3, w = key & 7;
    if (w === 0) { let v; [v, p] = varint(b, p); yield [f, w, v]; }
    else if (w === 2) { let len; [len, p] = varint(b, p); yield [f, w, b.subarray(p, p + len)]; p += len; }
    else if (w === 5) { yield [f, w, buf.readUInt32LE(p)]; p += 4; }
    else if (w === 1) { yield [f, w, Number(buf.readBigUInt64LE(p))]; p += 8; }
    else throw new Error('wire ' + w);
  }
}
let pos = 0;
const hl = buf.readInt32BE(pos); pos += 4;
pos += hl;
// skip header block
{
  let blen = 0; const header = buf.subarray(pos - hl, pos);
  for (const [f, w, v] of iter(buf, pos - hl, pos)) if (f === 3) blen = v;
  let p2 = pos; const l = buf.readInt32BE(p2); pos = p2 + 4 + l;
}
const hl2 = buf.readInt32BE(pos); pos += 4;
const header2 = buf.subarray(pos, pos + hl2); pos += hl2;
let type = '', blen = 0;
for (const [f, w, v] of iter(header2, 0, header2.length)) { if (f === 1) type = v.toString('utf8'); else if (f === 3) blen = v; }
const blob = buf.subarray(pos, pos + blen);
let raw = null, z = null;
for (const [f, w, v] of iter(blob, 0, blob.length)) { if (f === 1) raw = v; else if (f === 3) z = v; }
const data = raw || zlib.inflateSync(z);
let gran = 100, loLat = 0, loLon = 0; const groups = [];
for (const [f, w, v] of iter(data, 0, data.length)) {
  if (f === 2) groups.push(v); else if (f === 17) gran = v; else if (f === 19) loLat = v; else if (f === 20) loLon = v;
}
console.log('type', type, 'groups', groups.length, 'gran', gran, 'loLat', loLat, 'loLon', loLon);
for (const g of groups.slice(0, 2)) {
  for (const [f, w, v] of iter(g, 0, g.length)) {
    console.log(' group field', f, 'len', v.length);
    if (f !== 2) continue;
    let lat = 0, lon = 0; const lats = [], lons = [];
    const fields = new Set();
    for (const [ff, ww, vv] of iter(v, 0, v.length)) {
      fields.add(ff);
      if (ff === 8) vv.forEach((q) => { lat += zig(q); lats.push(lat); });
      else if (ff === 9) vv.forEach((q) => { lon += zig(q); lons.push(lon); });
    }
    console.log('  fields', [...fields], 'n', lats.length);
    const y = (loLat + gran * lats[0]) * 1e-9, x = (loLon + gran * lons[0]) * 1e-9;
    console.log('  first', y.toFixed(5), x.toFixed(5), 'raw', lats[0], lons[0]);
  }
}