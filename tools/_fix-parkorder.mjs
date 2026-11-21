// 把松山湖园区 / 东莞生态园两条片区移到镇街之前（区域按数组顺序认领格子，否则会被镇街抢光）
import { readFile, writeFile } from 'node:fs/promises';
const p = 'js/data_dg.js';
let s = await readFile(p, 'utf8');
const lines = s.split('\n');
const ids = ['songshanhu', 'shengtaiyuan'];
const grabbed = [];
const rest = [];
for (const l of lines) {
  const m = l.match(/\{ id: '([a-z0-9_]+)'/);
  if (m && ids.includes(m[1])) { grabbed.push(l); continue; }
  rest.push(l);
}
if (grabbed.length !== ids.length) throw new Error('未找到两条园区行：' + grabbed.length);
// 插入点：最后一条 wild 之后
let at = -1;
rest.forEach((l, i) => { if (/\{ id: 'wild\d+'/.test(l)) at = i; });
if (at < 0) throw new Error('未找到 wild 片区分界');
rest.splice(at + 1, 0, '    // 专业园区（同样要在镇街之前认领格子）', ...grabbed);
await writeFile(p, rest.join('\n'));
console.log('已把', ids.join('、'), '移到镇街之前');