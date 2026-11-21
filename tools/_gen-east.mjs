// 引擎的「连片」规则：开局只有最大的那片已开放城区可以建设。
// 东部镇街面积大，若 2000 年就全开，会压过西部核心区，导致莞城一带开局不能建设。
// 按史实微调：东部镇街（樟木头/塘厦/凤岗/清溪/大朗）开放年 1995 → 2001（与寮步、大岭山、黄江、茶山同年，随镇镇通路接上）。
import { readFile, writeFile } from 'node:fs/promises';
const p = 'js/data_dg.js';
let s = await readFile(p, 'utf8');
const EAST = ['zhangmutou', 'tangxia', 'fenggang', 'qingxi', 'dalang'];
for (const id of EAST) {
  const re = new RegExp("(\\{ id: '" + id + "',[^\\n]*?)open: 1995");
  if (!re.test(s)) throw new Error('未找到 ' + id);
  s = s.replace(re, '$1open: 2001');
}
await writeFile(p, s);
console.log('东部 5 镇开放年 1995 → 2001');