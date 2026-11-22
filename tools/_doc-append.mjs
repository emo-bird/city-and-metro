// 把 _doc-line3.md 追加到《东莞调研·未来规划与任务.md》（幂等：已有标记就跳过）
import fs from 'node:fs';
const doc = 'docs/东莞调研·未来规划与任务.md';
const add = fs.readFileSync('tools/_doc-line3.md', 'utf8');
let s = fs.readFileSync(doc, 'utf8');
const MARK = '## ⑨ 模拟线路：3 号线一期与 1 号线二期（游戏内推演）';
if (s.indexOf(MARK) >= 0) { console.log('已存在，跳过'); process.exit(0); }
s = s.replace(/\s+$/, '') + '\n\n' + add.replace(/^---\n\n/, '') + '\n';
fs.writeFileSync(doc, s);
console.log('appended', add.length, 'chars');