// 深惠城际按新闻延期到 2029-12：同步 bg 线 y0、事件年月、阶段目标年份
import { readFile, writeFile } from 'node:fs/promises';
const p = 'js/data_dg.js';
let s = await readFile(p, 'utf8');
const before = s;

// 1) 背景线开通年月
s = s.replace("y0: [2026, 11],", "y0: [2029, 12],");
s = s.replace("y0: [2026,11],", "y0: [2029,12],");

// 2) 事件
s = s.replace("{ y: 2026, m: 11, tag: '交通', title: '深惠城际凤岗站通车'",
              "{ y: 2029, m: 12, tag: '交通', title: '深惠城际凤岗站通车'");

// 3) 阶段目标：接深惠凤岗站由 2026 推到 2029，并顺延后续两条
s = s.replace("{ id: 'dg-g16', from: 2026, type: 'connect', reward: 320000, title: '接上深惠城际凤岗站',",
              "{ id: 'dg-g16', from: 2029, type: 'connect', reward: 320000, title: '接上深惠城际凤岗站',");
s = s.replace("desc: '深惠城际在雁田设凤岗站，2026 年 11 月开通。把地铁或公交接进凤岗站，让凤岗、雁田一带直连深圳平湖、前海方向。',",
              "desc: '深惠城际在雁田设凤岗站，原计划 2026 年通车，因前保—五和段工期延期至 2029 年 12 月。把地铁或公交接进凤岗站，让凤岗、雁田一带直连深圳平湖、前海方向。',");

if (s === before) throw new Error('没有替换成功');
await writeFile(p, s);

const chk = await readFile(p, 'utf8');
const has = {
  线: /dg_深惠城际[\s\S]{0,200}?y0: \[2029, 12\]/.test(chk),
  事件: chk.includes("{ y: 2029, m: 12, tag: '交通', title: '深惠城际凤岗站通车'"),
  目标: chk.includes("{ id: 'dg-g16', from: 2029,"),
};
console.log(has);