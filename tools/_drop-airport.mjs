import { readFile, writeFile } from 'node:fs/promises';
const p = 'js/data_dg.js';
let s = await readFile(p, 'utf8');
const m = s.match(/\n\s*\/\/[^\n]*机场[^\n]*\n\s*airport: \{[^}]*\},/);
if (!m) {
  const m2 = s.match(/\n[^\n]*airport: \{[^}]*\},/);
  if (!m2) throw new Error('未找到 airport 字段');
  s = s.replace(m2[0], '\n    // 东莞没有民用机场（不设 airport 字段，引擎会跳过机场逻辑）');
} else s = s.replace(m[0], '\n    // 东莞没有民用机场（不设 airport 字段，引擎会跳过机场逻辑）');
await writeFile(p, s);
console.log('airport 字段已移除');