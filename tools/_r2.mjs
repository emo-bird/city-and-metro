import fs from 'node:fs';
for (const f of ['js/data_gz.js', 'js/traits.js', 'js/city.js', 'js/render.js', 'js/facility.js']) {
  const s = fs.readFileSync(f, 'utf8');
  for (const kw of ['琶洲', 'expo', 'guards', 'heritage']) {
    let i = -1, n = 0;
    while ((i = s.indexOf(kw, i + 1)) >= 0 && n < 6) {
      n++;
      console.log(f, kw, i, JSON.stringify(s.slice(Math.max(0, i - 160), i + 200)));
    }
  }
}