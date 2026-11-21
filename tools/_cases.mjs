import fs from 'node:fs';
const s = fs.readFileSync('js/render.js', 'utf8');
const i = s.indexOf("case 'traditional'");
const seg = s.slice(i - 6000, i + 9000);
const cases = [...seg.matchAll(/case '([a-zA-Z0-9_]+)'/g)].map((x) => x[1]);
console.log([...new Set(cases)].join(' '));