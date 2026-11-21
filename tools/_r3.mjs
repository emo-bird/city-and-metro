import fs from 'node:fs';
const s = fs.readFileSync('js/city.js', 'utf8');
for (const kw of ['landMax', 'heritageGuards', 'this.heritage', 'canBuild', 'blockedByLandmark']) {
  let i = -1, n = 0;
  while ((i = s.indexOf(kw, i + 1)) >= 0 && n < 8) {
    n++; console.log('== city.js', kw, i, JSON.stringify(s.slice(Math.max(0, i - 120), i + 180)));
  }
}
const r = fs.readFileSync('js/render.js', 'utf8');
let i = r.indexOf('drawHeritage');
i = r.indexOf('drawHeritage', i + 1);
console.log('=== drawHeritage body');
console.log(r.slice(i - 200, i + 2600));