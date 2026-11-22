// 按《补全结果》C1/C2 补两条「规划」类事件
import { readFile, writeFile } from 'node:fs/promises';
const p = 'js/data_dg.js';
let s = await readFile(p, 'utf8');

const NEW = [
  "{ y: 2022, m: 3, tag: '规划', title: '地铁 3 号线规划获批', desc: '3 号线建设规划获国家发改委批复（发改基础〔2022〕427 号），是东莞继 2 号线之后第二条获批的骨干线；工可与初步设计仍在推进，尚未开工。' },",
  "{ y: 2022, m: 6, tag: '规划', title: '佛穗莞城际东莞段方案披露', desc: '广州 28 号线（佛穗莞城际）东莞段披露 8 站、36.7 公里前期论证方案，全部地下，自东泊经万江、莞城、鸿福路、黄旗南、寮步至松山湖；当时尚未进入环评与工可审批。' },",
];

// 找到 2023 年那条事件，插在它前面（保持时间顺序）
const anchor = "  { y: 2023, m: 12, tag: '政策', title: '深圳都市圈获批'";
if (s.indexOf(anchor) < 0) throw new Error('未找到 2023 事件锚点');
if (s.includes('地铁 3 号线规划获批')) { console.log('已存在，跳过'); } else {
  s = s.replace(anchor, NEW.join('\n') + '\n' + anchor);
  await writeFile(p, s);
  console.log('已插入 2 条规划事件');
}