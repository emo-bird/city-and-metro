import { readFile } from 'node:fs/promises';
const s = await readFile('js/data_dg.js', 'utf8');
console.log('crlf:', s.includes('\r\n'));
const m = s.match(/\{ id: 'dgpf1', n: [^\n]*/);
console.log(m && m[0]);
const sh = s.match(/\{ id: 'dgpf46', n: [^\n]*/);
console.log(sh && sh[0]);