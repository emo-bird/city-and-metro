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
    else if (w === 5) { yield [f, w, buf.readUInt32LE(p)]; p += 4; }
    else if (w === 1) { yield [f, w, Number(buf.readBigUInt64LE(p))]; p += 8; }
    else throw new Error('wire ' + w);
  }
}
function packed(b) { const out = []; let p = 0; while (p < b.length) { let v; [v, p] = varint(b, p); out.push(v); } return out; }
let pos = 0, blocks = 0, denseCount = 0, nodeCount = 0, tagCount = 0, nameCount = 0;
const tagKeys = new Map();
const found = [];
while (pos < buf.length) {
  const hl = buf.readInt32BE(pos); pos += 4;
  const header = buf.subarray(pos, pos + hl); pos += hl;
  let type = '', blen = 0;
  for (const [f, w, v] of iter(header, 0, header.length)) { if (f === 1) type = v.toString('utf8'); else if (f === 3) blen = v; }
  const blob = buf.subarray(pos, pos + blen); pos += blen;
  if (type !== 'OSMData') continue;
  blocks++;
  let raw = null, z = null;
  for (const [f, w, v] of iter(blob, 0, blob.length)) { if (f === 1) raw = v; else if (f === 3) z = v; }
  const data = raw || zlib.inflateSync(z);
  let gran = 100, loLat = 0, loLon = 0, st = null; const groups = [];
  for (const [f, w, v] of iter(data, 0, data.length)) {
    if (f === 1) st = v; else if (f === 2) groups.push(v);
    else if (f === 17) gran = v; else if (f === 19) loLat = v; else if (f === 20) loLon = v;
  }
  const strings = [];
  { let p = 0; while (p < st.length) { let len; [len, p] = varint(st, p); strings.push(st.subarray(p, p + len).toString('utf8')); p += len; } }
  for (const g of groups) {
    for (const [f, w, v] of iter(g, 0, g.length)) {
      if (f !== 1) continue;
      denseCount++;
      let lat = 0, lon = 0; const lats = [], lons = [];
      const kv = [];
      for (const [ff, ww, vv] of iter(v, 0, v.length)) {
        if (ff === 8) vv.forEach((q) => { lat += zig(q); lats.push(lat); });
        else if (ff === 9) vv.forEach((q) => { lon += zig(q); lons.push(lon); });
        else if (ff === 10) kv.push(...packed(vv));
      }
      let k = 0;
      for (let n = 0; n < lats.length; n++) {
        const y = (loLat + gran * lats[n]) * 1e-9, x = (loLon + gran * lons[n]) * 1e-9;
        const tags = {};
        while (k < kv.length && kv[k] !== 0) { tags[strings[kv[k]]] = strings[kv[k + 1]]; k += 2; }
        k++;
        const tk = Object.keys(tags).length;
        if (!tk) continue;
        tagCount++;
        for (const kk of Object.keys(tags)) tagKeys.set(kk, (tagKeys.get(kk) || 0) + 1);
        if (!tags.name) continue;
        nameCount++;
        if (x < BB.west || x > BB.east || y < BB.south || y > BB.north) continue;
        if (tags.natural === 'peak' || tags.natural === 'hill' || tags.natural === 'ridge' || (tags.place === 'locality' && tags.name)) {
          found.push({ name: tags.name, lat: +y.toFixed(5), lon: +x.toFixed(5), ele: tags.ele ? +(tags.ele.replace(/[^\d.]/g, '')) || null : null, kind: tags.natural || tags.place });
        }
      }
    }
  }
}
console.log('blocks', blocks, 'denseGroups', denseCount, 'taggedNodes', tagCount, 'named', nameCount, 'found', found.length);
console.log('top tag keys', [...tagKeys.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map((x) => x[0] + ':' + x[1]).join(' '));
fs.writeFileSync('tools/osm-cache/dg-peaks.json', JSON.stringify(found, null, 1));
console.log(found.filter((p) => p.kind === 'peak').sort((a, b) => (b.ele || 0) - (a.ele || 0)).slice(0, 30).map((p) => p.name + '(' + (p.ele || '?') + ')').join(' '));