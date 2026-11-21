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
function packed(b) { const o = []; let p = 0; while (p < b.length) { let v; [v, p] = varint(b, p); o.push(v); } return o; }
let pos = 0, bi = 0;
while (pos < buf.length && bi < 4) {
  const hl = buf.readInt32BE(pos); pos += 4;
  const header = buf.subarray(pos, pos + hl); pos += hl;
  let type = '', ds = 0;
  for (const [f, w, v] of iter(header, 0, header.length)) { if (f === 1) type = v.toString('utf8'); else if (f === 3) ds = v; }
  const blob = buf.subarray(pos, pos + ds); pos += ds;
  bi++;
  if (type !== 'OSMData') { console.log('block', type, 'skip'); continue; }
  let raw = null, z = null;
  for (const [f, w, v] of iter(blob, 0, blob.length)) { if (f === 1) raw = v; else if (f === 3) z = v; }
  const data = raw || zlib.inflateSync(z);
  let gran = 100, loLat = 0, loLon = 0, st = null; const groups = [];
  for (const [f, w, v] of iter(data, 0, data.length)) {
    if (f === 1) st = v; else if (f === 2) groups.push(v); else if (f === 17) gran = v; else if (f === 19) loLat = v; else if (f === 20) loLon = v;
  }
  const strings = [];
  for (const [f, w, v] of iter(st, 0, st.length)) if (f === 1) strings.push(v.toString('utf8'));
  console.log('OSMData strings', strings.length, 'groups', groups.length, 'gran', gran, 'loLat', loLat, 'loLon', loLon);
  for (const g of groups.slice(0, 1)) {
    for (const [f, w, v] of iter(g, 0, g.length)) {
      if (f !== 2) { console.log(' group field', f, 'len', v.length); continue; }
      const lats = [], lons = [], kv = []; let la = 0, lo = 0;
      const flds = [];
      for (const [ff, ww, vv] of iter(v, 0, v.length)) {
        flds.push(ff);
        if (ff === 8) vv.forEach((q) => { la += zig(q); lats.push(la); });
        else if (ff === 9) vv.forEach((q) => { lo += zig(q); lons.push(lo); });
        else if (ff === 10) kv.push(...packed(vv));
      }
      console.log(' dense fields', flds, 'nlat', lats.length, 'nlon', lons.length, 'kv', kv.length);
      for (let i = 0; i < Math.min(3, lats.length); i++) {
        console.log('  node', i, 'lat', (loLat + gran * lats[i]) * 1e-9, 'lon', (loLon + gran * lons[i]) * 1e-9);
      }
      let k = 0;
      for (let i = 0; i < Math.min(6, lats.length); i++) {
        const tags = {};
        while (k < kv.length && kv[k] !== 0) { tags[strings[kv[k]]] = strings[kv[k + 1]]; k += 2; }
        k++;
        console.log('   tags', JSON.stringify(tags).slice(0, 120));
      }
    }
  }
}