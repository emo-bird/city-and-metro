import fs from 'node:fs';
import zlib from 'node:zlib';
const buf = fs.readFileSync('tools/osm-cache/guangdong.osm.pbf');
function varint(b, p) { let v = 0, sh = 0, c; do { c = b[p++]; v += (c & 0x7f) * Math.pow(2, sh); sh += 7; } while (c & 0x80); return [v, p]; }
function* iter(b, start, end) {
  let p = start;
  while (p < end) {
    let key; [key, p] = varint(b, p);
    const f = key >>> 3, w = key & 7;
    if (w === 0) { let v; [v, p] = varint(b, p); yield [f, w, v]; }
    else if (w === 2) { let len; [len, p] = varint(b, p); yield [f, w, b.subarray(p, p + len)]; p += len; }
    else if (w === 5) { yield [f, w, buf.readUInt32LE(p)]; p += 4; }
    else if (w === 1) { yield [f, w, Number(buf.readBigUInt64LE(p))]; p += 8; }
    else throw new Error('wire ' + w + ' at ' + (p - 1));
  }
}
let pos = 0;
for (let bi = 0; bi < 3; bi++) {
  const hl = buf.readInt32BE(pos); pos += 4;
  const header = buf.subarray(pos, pos + hl); pos += hl;
  let type = '', blen = 0;
  for (const [f, w, v] of iter(header, 0, header.length)) { if (f === 1) type = v.toString('utf8'); else if (f === 3) blen = v; }
  const blob = buf.subarray(pos, pos + blen); pos += blen;
  console.log('block', bi, 'type', type, 'blen', blen);
  let raw = null, z = null, zraw = null;
  for (const [f, w, v] of iter(blob, 0, blob.length)) { if (f === 1) raw = v; else if (f === 3) z = v; else if (f === 2) zraw = v; }
  console.log('  raw?', !!raw, 'zlib?', !!z, 'zraw?', !!zraw);
  const data = raw || zlib.inflateSync(z);
  console.log('  data len', data.length);
  const fields = [];
  for (const [f, w, v] of iter(data, 0, data.length)) fields.push(f + ':' + (w === 2 ? 'len' + v.length : v));
  console.log('  fields', fields.slice(0, 12).join(' '));
}