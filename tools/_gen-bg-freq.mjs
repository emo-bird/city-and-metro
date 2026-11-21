// 第 5 条：把背景交通的班次(speed/head)按史实改成逐年演化的曲线
import { readFile, writeFile } from 'node:fs/promises';
const p = 'js/data_dg.js';
let s = await readFile(p, 'utf8');

const TUNE = {
  // 广深线（普速与早期动车）：1994 年准高速、1998 年新时速，班次逐年加密
  dg_广深线_旧: { speed: 120, head: '[[1911, 240], [1950, 150], [1990, 90], [1994, 60], [2000, 45]]' },
  dg_广深线_中: { speed: 160, head: '[[2003, 45], [2006, 30]]' },
  // 广深城际动车：2007 年公交化开行，高峰 10 余分钟一班
  dg_广深线: { speed: 200, head: '[[2006, 30], [2011, 20], [2020, 15]]' },
  // 京九线（东莞东）：普速干线，客流以长途为主，班次少
  dg_京九线: { speed: 90, head: '[[1911, 300], [1996, 180], [2000, 120], [2010, 90], [2020, 60]]' },
  // 穗深城际：2019 通车，公交化运营，班次逐年加密
  dg_穗深城际线: { speed: 160, head: '[[2019, 60], [2025, 30]]' },
  // 广惠城际（佛莞+莞惠贯通）：200 km/h 城际
  dg_广惠城际线: { speed: 200, head: '[[2016, 60], [2020, 40], [2025, 30]]' },
  // 广深港高铁：2011 通车，2015 后加密
  dg_广深港高速线: { speed: 300, head: '[[2011, 40], [2015, 25], [2020, 15]]' },
  // 京港高铁：2021 通车
  dg_京港高速线: { speed: 300, head: '[[2021, 60], [2025, 30]]' },
  // 虎门—南沙汽车渡轮：1991–2019，约 30 分钟一班，2019 南沙大桥通车后停运
  'dg-ferry': { speed: 14, head: '[[1991, 30], [2019, 30]]' },
};

let n = 0;
for (const [id, cfg] of Object.entries(TUNE)) {
  const key = 'id: "' + id + '"';
  const i = s.indexOf(key);
  if (i < 0) { console.warn('未找到线路', id); continue; }
  const win = s.slice(i, i + 260);
  const m = win.match(/speed: \d+, head: \d+/);
  if (!m) { console.warn('字段格式不符', id); continue; }
  const rep = 'speed: ' + cfg.speed + ', head: ' + cfg.head;
  s = s.slice(0, i) + win.replace(m[0], rep) + s.slice(i + 260);
  n++;
}

// 背景交通能抢到的出行份额：东莞跨市与中长距离出行以国铁/城际为主，市内以公交与自驾为主
s = s.replace('maxShare: 0.45,', 'maxShare: 0.40,');
await writeFile(p, s);
console.log('背景交通班次已按史实调整', n, '条');