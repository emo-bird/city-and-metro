// 把 tools/_wild.txt 的自然片区插到 data_dg.js 的 REG 列表里（公园之后、镇街之前）
// 可重复执行：先删除已有的 `id: 'wildN'` 行
import { readFile, writeFile } from 'node:fs/promises';
const p = 'js/data_dg.js';
let s = await readFile(p, 'utf8');
const wild = (await readFile('tools/_wild.txt', 'utf8')).trimEnd();
const anchorLine = s.match(/\{ id: 'dgbotany'[^\n]*\n/);
if (!anchorLine) throw new Error('未找到插入锚点（dgbotany 行）');
const anchor = anchorLine[0];
// 去掉旧的自然片区行
s = s.split('\n').filter((l) => !/^\s*\{ id: 'wild\d+'/.test(l)).join('\n');
const i = s.indexOf(anchor) + anchor.length;
s = s.slice(0, i) + '    // 自然林地区域（OSM 林地聚类，scenic → LU.HILL，不产生人口与岗位）\n' + wild + '\n' + s.slice(i);
await writeFile(p, s);
console.log('自然片区已写入', (wild.match(/id: 'wild/g) || []).length, '条');