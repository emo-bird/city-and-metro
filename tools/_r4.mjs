import fs from 'node:fs';
const files = ['js/city.js', 'js/game.js', 'js/scenery.js', 'js/facility.js', 'js/data_gz.js'];
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  for (const kw of ['landmarkAt', 'lmAt', 'demolish', 'protected', 'hb:']) {
    let i = -1, n = 0;
    while ((i = s.indexOf(kw, i + 1)) >= 0 && n < 5) {
      n++; console.log('==', f, kw, i, JSON.stringify(s.slice(Math.max(0, i - 110), i + 150)));
    }
  }
}