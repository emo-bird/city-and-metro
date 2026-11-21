// 第 4 点：按史实处理停办客运的车站。
//  · 土塘（从未办客）、红海（只办货运）→ 删掉地标与设施
//  · 茶山（2003-09 停办）、塘头厦（2006 停办）→ 设施加 close，广深线按年份拆成三段（引擎既有 y0/y1 机制，不改代码）
import { readFile, writeFile } from 'node:fs/promises';
let s = await readFile('js/data_dg.js', 'utf8');

// 1) 删地标（土塘 dgst6、红海 dgst10）
for (const id of ['dgst6', 'dgst10']) {
  const before = s.length;
  s = s.replace(new RegExp('\\n\\s*\\{ id: \'' + id + '\'[^\\n]*'), '');
  if (s.length === before) throw new Error('删地标失败 ' + id);
}
// 2) 删设施
for (const id of ['dgst6', 'dgst10']) {
  const before = s.length;
  s = s.replace(new RegExp('\\n\\s*\\{ id: \'dgf\\d+\', n: \'[^\']+\', t: \'rail\', lm: \'' + id + '\'[^\\n]*'), '');
  if (s.length === before) throw new Error('删设施失败 ' + id);
}
// 3) 停办年份：设施加 close（js/facility.js 的 Fac.active 用 f.close）
const CLOSE = { dgst8: [2003, 9], dgst4: [2006, 1] };
s = s.split('\n').map((line) => {
  for (const [lm, when] of Object.entries(CLOSE)) {
    if (line.indexOf("lm: '" + lm + "'") >= 0 && line.indexOf('close:') < 0) {
      const k = line.lastIndexOf(' }');
      return line.slice(0, k) + ', close: [' + when[0] + ', ' + when[1] + ']' + line.slice(k);
    }
  }
  return line;
}).join('\n');
for (const lm of Object.keys(CLOSE)) {
  if (!new RegExp("lm: '" + lm + "'[^\\n]*close:").test(s)) throw new Error('加 close 失败 ' + lm);
}

// 4) 广深线拆三段：1911–2003-09（含茶山）、2003-09–2006（去茶山）、2006–（去塘头厦）
const m = s.match(/\{ id: "dg_广深线"[\s\S]*?path: "([^"]+)" \},/);
if (!m) throw new Error('找不到广深线');
const path = m[1];
const ST = {
  平湖南: [256.99, 225.11], 木古: [256.38, 220.12], 平湖: [252.45, 210.12], 塘头厦: [243.16, 164.27],
  樟木头: [229.28, 117.44], 常平: [203.97, 80.78], 茶山: [153.05, 40.96], 东莞: [144.36, 34.9], 广州新塘: [41.01, 14.87],
};
const mk = (id, y0, y1, names) =>
  '      { id: "' + id + '", kind: \'rail\', name: "广深线", speed: 70, head: 45, y0: ' + y0 +
  (y1 ? ', y1: [' + y1.join(', ') + ']' : '') +
  ', stops: [' + names.map((n) => '["' + n + '",' + ST[n][0] + ',' + ST[n][1] + ']').join(',') +
  '], path: "' + path + '" },';
const A = ['平湖南', '木古', '平湖', '塘头厦', '樟木头', '常平', '茶山', '东莞', '广州新塘'];
const B = ['平湖南', '木古', '平湖', '塘头厦', '樟木头', '常平', '东莞', '广州新塘'];
const C = ['平湖南', '木古', '平湖', '樟木头', '常平', '东莞', '广州新塘'];
const block = [
  '      // 广深线：2003-09 起普速 8443/8444 停运，茶山停办客运；2006 塘头厦停办。按引擎既有的 y0/y1 分段，不改代码。',
  mk('dg_广深线_旧', '1911', [2003, 9], A),
  mk('dg_广深线_中', '[2003, 9]', [2006, 1], B),
  mk('dg_广深线', '[2006, 1]', null, C),
].join('\n');
s = s.replace(m[0], block);
await writeFile('js/data_dg.js', s);
console.log('停办车站已处理：删土塘/红海，茶山 2003-09、塘头厦 2006 停止；广深线拆为三段');