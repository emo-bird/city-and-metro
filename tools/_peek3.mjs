import { readFile } from 'node:fs/promises';
const s = await readFile('js/data_dg.js', 'utf8');
for (const id of ['dgst90', 'dgst91']) {
  const m = s.match(new RegExp("\\{ id: '" + id + "'[\\s\\S]{0,220}?\\},"));
  console.log(m && m[0].replace(/\n/g, ' '));
}
const f = s.match(/\{ id: 'dgf?\d+', n: '[^']*(渡口|渡轮)[^']*'[^\n]*/g);
console.log('--- ferry facilities ---');
(f || []).forEach(l => console.log(l));
console.log('--- 穗深相关设施 ---');
const re = /\{ id: '(dgpf?\d+)', n: '([^']*(?:东莞西|洪梅|中堂|望牛墩|道滘|厚街|虎门北|虎门东|长安西|沙井西|福海西)[^']*)', t: '([^']*)', lm: '([^']*)', pax: ([^\n]*?)\}/g;
for (const m of s.matchAll(re)) console.log(m[1], m[2], m[3], m[5].slice(0, 80));