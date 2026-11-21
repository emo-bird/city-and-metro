import fs from 'node:fs';
let s = fs.readFileSync('tools/pbf-peaks.mjs', 'utf8');
// 1) 恢复 datasize 取 Blob 长度
s = s.replace("  let type = '';\n  for (const [f, w, v] of iter(header, 0, header.length)) if (f === 1) type = v.toString('utf8');\n  const blen = buf.readInt32BE(pos); pos += 4;",
  "  let type = '', blen = 0;\n  for (const [f, w, v] of iter(header, 0, header.length)) { if (f === 1) type = v.toString('utf8'); else if (f === 3) blen = v; }");
// 2) 8/9 用 packed 解码
s = s.replace("        if (ff === 8) vv.forEach((q) => { lat += zig(q); lats.push(lat); });\n        else if (ff === 9) vv.forEach((q) => { lon += zig(q); lons.push(lon); });",
  "        if (ff === 8) for (const q of packed(vv)) { lat += zig(q); lats.push(lat); }\n        else if (ff === 9) for (const q of packed(vv)) { lon += zig(q); lons.push(lon); }");
fs.writeFileSync('tools/pbf-peaks.mjs', s);
console.log('patched', s.includes('for (const q of packed(vv))'), s.includes('else if (f === 3) blen = v;'));