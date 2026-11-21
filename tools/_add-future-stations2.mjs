import fs from 'node:fs';
let d = fs.readFileSync('js/data_dg.js', 'utf8');
if (d.includes("id: 'dgfl1'")) { console.log('已存在'); process.exit(0); }
const LM = [
  ["dgfl1", "凤岗站", 271.2, 206.9, 2026],
  ["dgfl2", "交椅湾站", 83.9, 187.5, 2028],
  ["dgfl3", "东泊站", 53.0, 44.2, 2031],
];
const lmEnd = d.indexOf('\n    ],', d.indexOf('landmarks: ['));
if (lmEnd < 0) throw new Error('landmarks end not found');
const lmTxt = LM.map(([id, n, x, y, yr]) => `      { id: '${id}', name: '${n}', x: ${x}, y: ${y}, w: 180, d: 80, year: ${yr}, kind: 'rail' },`).join('\n');
d = d.slice(0, lmEnd) + '\n' + lmTxt + d.slice(lmEnd);

const facEnd = d.indexOf('\n    ],', d.indexOf('facilities: ['));
if (facEnd < 0) throw new Error('facilities end not found');
const facTxt = LM.map(([id, n, , , yr], k) => `{ id: 'dgf1${k + 1}', n: '${n}', t: 'rail', lm: '${id}', pax: [[${yr},0.3],[${yr + 8},1.6],[${yr + 18},2.6]] },`).join('\n');
d = d.slice(0, facEnd) + '\n' + facTxt + d.slice(facEnd);
fs.writeFileSync('js/data_dg.js', d);
console.log('未来站已加入');