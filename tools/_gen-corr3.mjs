// 按《补全结果》A1（松山湖功能区 11 街镇内部出行占比）补全四个时代的通勤走廊
import { readFile, writeFile } from 'node:fs/promises';
const p = 'js/data_dg.js';
let s = await readFile(p, 'utf8');

const E = [
  // e1 2000–2007（2008 年报道仍是「镇内 93–95%」，只保留最紧的镇内走廊）
  [['humen', 'changan', 1.28], ['houjie', 'humen', 1.22], ['changan', 'dalingshan', 1.12], ['changping', 'zhangmutou', 1.18], ['shilong', 'shijie', 1.15], ['guancheng', 'nancheng', 1.12]],
  // e2 2008–2013（松山湖/生态园开始吸纳跨镇通勤）
  [['songshanhu', 'liaobu', 1.30], ['songshanhu', 'dalang', 1.25], ['songshanhu', 'dalingshan', 1.18], ['shengtaiyuan', 'dalang', 1.22], ['humen', 'changan', 1.20], ['nancheng', 'dongcheng', 1.14], ['zhongtang', 'wangniudun', 1.10], ['shilong', 'guancheng', 1.12]],
  // e3 2014–2018（华为迁入，松山湖—大朗/大岭山/寮步最强；寮步 6.61% 往市区）
  [['songshanhu', 'dalang', 1.40], ['songshanhu', 'dalingshan', 1.26], ['songshanhu', 'liaobu', 1.24], ['shengtaiyuan', 'dalang', 1.30], ['songshanhu', 'nancheng', 1.16], ['humen', 'changan', 1.16], ['tangxia', 'fenggang', 1.14], ['liaobu', 'nancheng', 1.12], ['shilong', 'chashan', 1.10]],
  // e4 2019–（2020 七普 / 交通调查跨镇 21–28%；生态园内部仅 51.1%）
  [['binhaiwan', 'changan', 1.34], ['binhaiwan', 'humen', 1.28], ['songshanhu', 'dalang', 1.34], ['shengtaiyuan', 'dalang', 1.32], ['songshanhu', 'dalingshan', 1.20], ['songshanhu', 'nancheng', 1.20], ['songshanhu', 'liaobu', 1.18], ['tangxia', 'fenggang', 1.28], ['changan', 'humen', 1.18]],
];

const line = arr => 'corridors: [' + arr.map(([a, b, f]) => "{ a: '" + a + "', b: '" + b + "', f: " + f.toFixed(2) + ' }').join(', ') + '],';
const lines = [...s.matchAll(/^ {8}corridors: \[[^\n]*$/gm)];
if (lines.length !== 4) throw new Error('corridors 行数异常: ' + lines.length);
let out = '', last = 0;
lines.forEach((m, k) => {
  out += s.slice(last, m.index) + '        ' + line(E[k]);
  last = m.index + m[0].length;
});
out += s.slice(last);
await writeFile(p, out);
console.log('四个时代的走廊已更新：' + E.map(a => a.length + ' 对').join(' / '));