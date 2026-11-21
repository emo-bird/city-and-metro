// 下载广东省 OSM 提取（osm.fr 镜像，每日更新），用于补齐 Overpass 拿不到的海岸线
import { createWriteStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const URL = 'https://download.openstreetmap.fr/extracts/asia/china/guangdong.osm.pbf';
const OUT = 'tools/osm-cache/guangdong.osm.pbf';
try { const s = await stat(OUT); console.log('已有文件', (s.size / 1048576).toFixed(1), 'MB'); process.exit(0); } catch { }

const t = Date.now();
let last = 0;
const r = await fetch(URL, { headers: { 'User-Agent': 'city-and-metro-mapbuild/1.0' } });
if (!r.ok) { console.error('HTTP', r.status); process.exit(1); }
const total = Number(r.headers.get('content-length') || 0);
let got = 0;
const src = Readable.fromWeb(r.body);
src.on('data', (c) => {
  got += c.length;
  if (got - last > 20 * 1048576) { last = got; console.log('· ' + (got / 1048576).toFixed(0) + ' / ' + (total / 1048576).toFixed(0) + ' MB，' + ((Date.now() - t) / 1000).toFixed(0) + 's'); }
});
await pipeline(src, createWriteStream(OUT));
console.log('· 完成 ' + (got / 1048576).toFixed(1) + ' MB，用时 ' + ((Date.now() - t) / 1000).toFixed(0) + ' s');