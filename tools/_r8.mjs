import fs from 'node:fs';
let s = fs.readFileSync('tools/pbf-peaks.mjs', 'utf8');
s = s.replace("  let type = '', blen = 0;", "  let type = '';");
s = s.replace(
  "for (const [f, w, v] of iter(header, 0, header.length)) { if (f === 1) type = v.toString('utf8'); else if (f === 3) blen = v; }\n  const blob = buf.subarray(pos, pos + blen); pos += blen;",
  "for (const [f, w, v] of iter(header, 0, header.length)) if (f === 1) type = v.toString('utf8');\n  const blen = buf.readInt32BE(pos); pos += 4;\n  const blob = buf.subarray(pos, pos + blen); pos += blen;"
);
fs.writeFileSync('tools/pbf-peaks.mjs', s);
console.log('ok', s.includes('const blen = buf.readInt32BE(pos); pos += 4;'));