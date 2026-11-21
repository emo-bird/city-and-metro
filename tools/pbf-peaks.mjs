// 从广东 PBF 抽出图幅附近的命名山体（natural=peak/hill/ridge/massif, place=locality）
// 修正：StringTable 是 message（field 1 重复 bytes），不是长度前缀序列；PrimitiveGroup.dense = 2
import fs from 'node:fs';
import zlib from 'node:zlib';
const PBF = process.argv[2] || 'tools/osm-cache/guangdong.osm.pbf';
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
function packed(b) { const o = []; let p = 0; while (p < b.length) { let v; [v, p] = varint(b, p); o.push(v); } return o; }
const found = [];
let pos = 0, totTagged = 0;
const kinds = new Map();
while (pos < buf.length) {
  const hl = buf.readInt32BE(pos); pos += 4;
  const header = buf.subarray(pos, pos + hl); pos += hl;
  let type = '', blen = 0;
  for (const [f, w, v] of iter(header, 0, header.length)) { if (f === 1) type = v.toString('utf8'); else if (f === 3) blen = v; }
  const blob = buf.subarray(pos, pos + blen); pos += blen;
  if (type !== 'OSMData') continue;
  let raw = null, z = null;
  for (const [f, w, v] of iter(blob, 0, blob.length)) { if (f === 1) raw = v; else if (f === 3) z = v; }
  const data = raw || zlib.inflateSync(z);
  let gran = 100, loLat = 0, loLon = 0, st = null; const groups = [];
  for (const [f, w, v] of iter(data, 0, data.length)) {
    if (f === 1) st = v; else if (f === 2) groups.push(v);
    else if (f === 17) gran = v; else if (f === 19) loLat = v; else if (f === 20) loLon = v;
  }
  const strings = [];
  for (const [f, w, v] of iter(st, 0, st.length)) if (f === 1) strings.push(v.toString('utf8'));
  for (const g of groups) {
    for (const [f, w, v] of iter(g, 0, g.length)) {
      if (f !== 2) continue;
      let lat = 0, lon = 0; const lats = [], lons = [], kv = [];
      for (const [ff, ww, vv] of iter(v, 0, v.length)) {
        if (ff === 8) for (const q of packed(vv)) { lat += zig(q); lats.push(lat); }
        else if (ff === 9) for (const q of packed(vv)) { lon += zig(q); lons.push(lon); }
        else if (ff === 10) kv.push(...packed(vv));
      }
      let k = 0;
      for (let n = 0; n < lats.length; n++) {
        const tags = {};
        while (k < kv.length && kv[k] !== 0) { tags[strings[kv[k]]] = strings[kv[k + 1]]; k += 2; }
        k++;
        if (!tags.name) continue;
        totTagged++;
        const y = (loLat + gran * lats[n]) * 1e-9, x = (loLon + gran * lons[n]) * 1e-9;
        if (x < BB.west || x > BB.east || y < BB.south || y > BB.north) continue;
        const nk = tags.natural || tags.place || '-';
        kinds.set(nk, (kinds.get(nk) || 0) + 1);
        if (!(tags.natural === 'peak' || tags.natural === 'hill' || tags.natural === 'ridge' || tags.natural === 'massif' || tags.natural === 'mountain_range' || tags.place === 'locality')) continue;
        const ele = tags.ele ? parseFloat(String(tags.ele).replace(/[^\d.]/g, '')) : NaN;
        found.push({ name: tags.name, lat: +y.toFixed(5), lon: +x.toFixed(5), ele: isFinite(ele) ? ele : null, kind: tags.natural || tags.place });
      }
    }
  }
}
fs.writeFileSync('tools/osm-cache/dg-peaks.json', JSON.stringify(found, null, 1));
console.log('named nodes', totTagged, 'features in BB', found.length);
console.log('kinds', [...kinds.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map((x) => x[0] + ':' + x[1]).join(' '));
console.log('top peaks:', found.filter((p) => p.kind === 'peak').sort((a, b) => (b.ele || 0) - (a.ele || 0)).slice(0, 30).map((p) => p.name + '(' + (p.ele || '?') + ')').join(' '));