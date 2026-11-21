// 把 tools/dg-bg2.txt 整段替换进 js/data_dg.js（可重复执行）。临时工具，不进发布。
import { readFile, writeFile } from 'node:fs/promises';

const FILE = 'js/data_dg.js';
const src = await readFile(FILE, 'utf8');
const block = await readFile('tools/dg-bg2.txt', 'utf8');
const START = '  // ===== 车站';
const ANCHOR = '  (CM.MAP_LIST = CM.MAP_LIST || []).push({';
const a = src.indexOf(START);
const b = src.indexOf(ANCHOR);
if (b < 0) throw new Error('找不到注册锚点');
if (a < 0) {
  const out = src.slice(0, b) + block + '\n' + src.slice(b);
  await writeFile(FILE, out);
} else {
  const out = src.slice(0, a) + block + '\n' + src.slice(b);
  await writeFile(FILE, out);
}
console.log('已写入', FILE);