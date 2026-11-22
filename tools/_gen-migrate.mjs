// 东莞地图加迁移路径：mapVersion 2 + migrate（把新插入的事件索引在旧存档里后移）
import { readFile, writeFile } from 'node:fs/promises';
const p = 'js/data_dg.js';
let s = await readFile(p, 'utf8');

const OLD = "    kind: 'real', mapVersion: 1, scenario: 'dg-2000',";
if (!s.includes(OLD)) throw new Error('未找到注册尾部');
const NEW = [
  "    kind: 'real', mapVersion: 2, minVersion: 1, scenario: 'dg-2000',",
  "    // 存档迁移：地图数据升版时，旧存档按这里逐版升级（引擎见 js/save.js 的 mapVersion 段）。",
  "    // · 区域与地标状态按 id 对应（js/city.js 的 byIds），增删片区/地标不用写迁移；",
  "    // · 只有「在事件/任务数组中间插入条目」这类会改变序号的操作需要登记。",
  "    // 追加新事件请加在 events 末尾，这样老存档的序号不变；必须插在中间时，在下面的",
  "    // EVENT_INSERTS 里登记 [启用版本, 插入位置, 插入条数]，旧存档的已触发记录会按位置后移。",
  "    migrate: (function () {",
  "      const EVENT_INSERTS = [[2, 19, 2]];   // 第 2 版：events 第 19 位插入 2022 年两条规划事件",
  "      const shiftIdx = function (fe, at, n) {",
  "        const out = {};",
  "        for (const k in fe) { const i = +k; out[i >= at ? i + n : i] = fe[k]; }",
  "        return out;",
  "      };",
  "      return function (payload, from) {",
  "        let fe = payload.firedEvents || {};",
  "        for (const it of EVENT_INSERTS) if (from < it[0]) fe = shiftIdx(fe, it[1], it[2]);",
  "        payload.firedEvents = fe;",
  "        payload.mapUpgrade = { from: from, to: 2, at: Date.now(), note: '补齐 2022 年两条规划事件；区域与地标按 id 恢复' };",
  "        return payload;",
  "      };",
  "    })(),",
].join('\n');
s = s.replace(OLD, NEW);
await writeFile(p, s);
console.log('已写入 mapVersion 2 + migrate');