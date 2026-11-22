// 按《东莞地铁经营参数》调研改 dg 的经营参数（覆盖从广州继承的默认值）
import { readFile, writeFile } from 'node:fs/promises';
const p = 'js/data_dg.js';
let s = await readFile(p, 'utf8');

const BLOCK = [
  "      // ===== 经营参数（按东莞地铁真实数据标定，见 docs/东莞调研·经营参数.md）=====",
  "      // 造价单位：万元/公里，按 1990 年不变价（引擎按 cost.inflation 3.5%/年 折到各年）。",
  "      // 校验：2 号线 195 亿/37.8 km = 5.16 亿/km（2015）→ 21500×2.36≈5.07 亿；1 号线 378.79 亿/57.478 km = 6.61 亿/km（2025）→ 7.1 亿。",
  "      cost: Object.assign({}, CM.CFG.cost, {",
  "        trackPerKm: { underground: 21500, surface: 4200, elevated: 9000 },",
  "        riverPerKm: { underground: 26000, surface: 18000, elevated: 18000 },   // 狮子洋、东江越江",
  "        hillPerKm: 11000, protectedPerKm: 5000, demolishPerCell: 22000,",
  "        station: {",
  "          underground: { S: 11000, M: 19000, L: 30000 },",
  "          elevated: { S: 6000, M: 10000, L: 16000 },",
  "          surface: { S: 4000, M: 6500, L: 9500 },",
  "        },",
  "      }),",
  "      // 运营成本：真实 2 号线 2024 年运营成本 5.19 亿元、票款 1.82 亿元（票款覆盖率 35%）、补贴 5.11 亿元。",
  "      // 折算：约 24 元/车公里、9.5 万元/站·日（2024）；按运营口径 2000→2024 的 2.56 倍价格指数，2000 年价约 9.4 元/车公里、3.7 万元/站·日。",
  "      ops: { carKmCost: 0.00065, stationDaily: { S: 0.9, M: 1.5, L: 2.6, XL: 4.2 }, serviceHours: 18, inflation: 0.04 },",
  "      // 票价：2 元起步含 4 公里，之后每 5 公里加 1 元（起步价的 0.5 倍），封顶 4 倍（8 元）。",
  "      // 真实票价表：4–12 km 每 4 km 加 1、12–24 km 每 6 km 加 1、超过 24 km 每 8 km 加 1；东莞站→虎门站 37.8 km = 8 元，本参数在 37.8 km 处正好 8 元。",
  "      fareDefault: { mode: 'dist', flat: 2 },",
  "      fareDist: { km0: 4, step: 5, inc: 0.5, cap: 4 },",
  "      fareRange: { min: 0, max: 14, step: 0.1, scale: true },",
  "      // 财政：2 号线 40% 财政资本金 + 60% 银团贷款；专项债 2023 年 3.5%、2024 年 2.2%，城投债 2025 年加权 2.37%。",
  "      // 真实运营缺口几乎全部由财政补贴覆盖（5.11 亿 / 5.19 亿），这里按 0.9 计。",
  "      economy: Object.assign({}, CM.CFG.economy, {",
  "        opsSubsidy: 0.9, startFunds: 260000, debtLimit: -220000,",
  "        grantBase: [[2000, 30000], [2010, 55000], [2020, 90000], [2030, 120000], [2050, 160000]],",
  "        bonds: {",
  "          local: { rate: [[2000, 0.035], [2010, 0.04], [2016, 0.032], [2020, 0.033], [2023, 0.035], [2024, 0.022], [2030, 0.028], [2050, 0.035]], quotaMonths: 6, capMonths: 30 },",
  "          ct: { spread: 0.008, quotaMonths: 4, capMonths: 18 },",
  "          term6: 0.003,",
  "        },",
  "      }),",
  "      // 工作周：东莞制造业六天 42% + 七天 44%（86% 周六上班），加权 61.6 小时/周；随产业升级逐年回落。",
  "      workWeek: { sat: [[2000, 0.86], [2010, 0.80], [2020, 0.62], [2030, 0.50], [2050, 0.40]], school: [[2000, 0.05], [2020, 0.02]] },",
].join('\n');

const ANCHOR = "      growth: Object.assign({}, CM.CFG.growth, {";
if (!s.includes(ANCHOR)) throw new Error('未找到 growth 锚点');
s = s.replace(ANCHOR, BLOCK + '\n' + ANCHOR);

// 行为曲线按发展阶段平移：dg 用 gz 的曲线前移 6 年（2000 年的东莞≈广州 2006 年的小汽车与收入水平）
s = s.replace("    cam: { cx: W * 0.5, cy: H * 0.5, zoom: 7 },",
  "    econ: { devOffset: -6, money: 1 },   // 出行行为曲线按发展阶段前移 6 年（dg 2000 年 ≈ 广州 2006 年）\n    cam: { cx: W * 0.5, cy: H * 0.5, zoom: 7 },");

await writeFile(p, s);
console.log('已写入产营参数（cost/ops/fare/economy/workWeek）+ econ.devOffset');