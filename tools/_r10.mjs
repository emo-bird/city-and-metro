import fs from 'node:fs';
let s = fs.readFileSync('js/economy.js', 'utf8');
const a = "const t = Object.assign({ kind: 'hist', status: 'active', issuedAt: [y, m], streak: 0 }, JSON.parse(JSON.stringify(Tasks.withPlan(g, h))));";
const b = "const t = Object.assign({ kind: h.kind || 'hist', status: 'active', issuedAt: [y, m], streak: 0 }, JSON.parse(JSON.stringify(Tasks.withPlan(g, h))));";
if (!s.includes(a)) throw new Error('economy 未找到');
s = s.split(a).join(b);
fs.writeFileSync('js/economy.js', s);

let p = fs.readFileSync('js/pages.js', 'utf8');
const a2 = "const kindTag0 = function (t) { return t.kind === 'hist' ? h('span', { class: 'tag hist' }, '历史参考') :";
const b2 = "const kindTag0 = function (t) { return t.kind === 'hist' ? h('span', { class: 'tag hist' }, '历史参考') : (t.kind === 'plan' ? h('span', { class: 'tag info' }, '规划目标') : (t.kind === 'sim' ? h('span', { class: 'tag info' }, '推演挑战') :";
if (!p.includes(a2)) throw new Error('pages 未找到');
p = p.split(a2).join(b2);
// 配对括号：原来结构是 A ? x : (B ? y : (C ? z : w)); 我们多包了两层，末尾补两个 ')'
const a3 = "h('span', { class: 'tag info' }, '动态任务'))); };";
const b3 = "h('span', { class: 'tag info' }, '动态任务'))))); };";
if (!p.includes(a3)) throw new Error('pages 收尾未找到');
p = p.split(a3).join(b3);
fs.writeFileSync('js/pages.js', p);
console.log('economy + pages 已改');