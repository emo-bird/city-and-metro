import fs from 'node:fs';
const s = fs.readFileSync('js/render.js', 'utf8');
const i = s.indexOf('facMarkers');
console.log(s.slice(i - 300, i + 3200));