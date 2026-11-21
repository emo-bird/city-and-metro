import fs from 'node:fs';

const md = fs.readFileSync('scripts/_dg-poi.md', 'utf8');
const lines = md.split(/\r?\n/);
const out = [];
const rows = [];
for (const ln of lines) {
  if (!ln.startsWith('|')) continue;
  if (/^\|\s*-+/.test(ln) || ln.includes('名称 | 类别') || ln.includes('镇街/园区 | 代表条目')) continue;
  const cells = ln.split('|').slice(1, -1).map(s => s.trim());
  if (cells.length < 8) { out.push('BAD_COLS(' + cells.length + '): ' + ln.slice(0, 90)); continue; }
  rows.push(cells);
}

const cats = {};
const towns = new Map();
const problems = [];
const seen = new Set();
for (const c of rows) {
  const [id, name, cat, town, latS, lonS, year, size, note] = c;
  cats[cat] = (cats[cat] || 0) + 1;
  if (seen.has(name)) problems.push('DUP: ' + name);
  seen.add(name);
  const lat = Number(latS), lon = Number(lonS);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) problems.push('BAD_COORD: ' + name + ' ' + latS + ',' + lonS);
  else {
    if (lat < 22.55 || lat > 23.25) problems.push('LAT_RANGE: ' + name + ' ' + lat);
    if (lon < 113.35 || lon > 114.40) problems.push('LON_RANGE: ' + name + ' ' + lon);
    if (!/^-?\d+\.\d{4}$/.test(latS) || !/^-?\d+\.\d{4}$/.test(lonS)) problems.push('PRECISION: ' + name + ' ' + latS + ',' + lonS);
  }
  const isDG = town.startsWith('东莞·');
  const key = (isDG ? '【莞】' : '【外】') + town.replace(/^东莞·|^深圳·|^广州·/, '');
  if (!towns.has(key)) towns.set(key, []);
  towns.get(key).push(name);
}

const dgTowns = [...towns.keys()].filter(k => k.startsWith('【莞】'));
const lines2 = [];
lines2.push('rows=' + rows.length + ' tables=' + Object.keys(cats).length);
lines2.push('cats=' + JSON.stringify(cats));
lines2.push('dgtownCount=' + dgTowns.length);
for (const t of dgTowns.sort()) lines2.push('  ' + t + ' x' + towns.get(t).length + ' :: ' + towns.get(t).slice(0, 3).join(' / '));
const outside = [...towns.keys()].filter(k => !k.startsWith('东'));
lines2.push('outside=' + outside.length + ' ' + outside.join(', '));
lines2.push('problems=' + problems.length);
problems.forEach(p => lines2.push('  ! ' + p));
fs.writeFileSync('tools/_poi-check.txt', lines2.join('\n'), 'utf8');
console.log(lines2.slice(0, 2).join(' | '));