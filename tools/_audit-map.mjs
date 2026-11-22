import { readFile } from 'node:fs/promises';
const s = await readFile('js/data_dg.js', 'utf8');
const i = s.indexOf('(CM.MAP_LIST = CM.MAP_LIST || []).push(');
console.log('push at', i);
const seg = s.slice(i, s.indexOf('\n})', i) + 3);
const keys = ['id', 'name', 'title', 'sub', 'desc', 'facts', 'modes', 'kind', 'mapVersion', 'scenario', 'region', 'tagline', 'difficulty', 'tags', 'intro', 'features', 'highlights', 'geo', 'data', 'econ', 'cfg', 'cam', 'minVersion', 'migrate', 'extent', 'tutorial'];
console.log(keys.map(k => k + ':' + (new RegExp('(^|[\\s{,]' + k + ')\\s*:').test(seg) ? 'y' : 'N')).join(' '));
// en.js 里有没有地图名/简介
const en = await readFile('js/locales/en.js', 'utf8');
console.log('en 含「东莞」:', en.includes('东莞'), '含「东莞 · 2000」:', en.includes('东莞 · 2000'));
const title = seg.match(/title: '([^']*)'/);
const sub = seg.match(/sub: '([^']*)'/);
console.log('title:', title && title[1], '| sub:', sub && sub[1]);
console.log('en 含 title:', title && en.includes(title[1]), '| en 含 sub:', sub && en.includes(sub[1]));