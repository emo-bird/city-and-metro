// 接驳口修正：片区 id 改成新的拼音 id；按 dg-links 调研换成真实的接驳线（佛莞城际麻涌、深惠城际凤岗）。
import { readFile, writeFile } from 'node:fs/promises';
let s = await readFile('js/data_dg.js', 'utf8');

const oldGz = s.slice(s.indexOf("    { use: 'cityLink', icon: 'bridge', label: '穗莞连接'"), s.indexOf("    { use: 'cityLink', icon: 'bridge', label: '深莞连接'"));
const oldSz = s.slice(s.indexOf("    { use: 'cityLink', icon: 'bridge', label: '深莞连接'"), s.indexOf('\n    ],\n  };\n\n\n  // ===== 车站'));

const GZ = `    { use: 'cityLink', icon: 'bridge', label: '穗莞连接', map: 'gz', name: '广州', ach: '穗莞一线', region: 'gz_out',
      why: '佛莞城际 2024 年 5 月 26 日开通，从广州南经番禺、麻涌接入东莞西，与莞惠城际贯通成 258 公里的大湾区一号线。',
      gates: [
        { id: 'dg_gate_gz', n: '麻涌接驳口', to: '广州 · 番禺', at: [19.6, 76.1], dir: 'W', y: [2024, 5], pax: [[2024.3, 0.6], [2030, 1.4], [2040, 2.2]],
          title: '佛莞城际通车', desc: '佛莞城际在 2024 年 5 月开通，从广州南经番禺跨狮子洋到麻涌、东莞西，与莞惠城际贯通运营。麻涌接驳口开放。',
          note: '2024 年 5 月 26 日随佛莞城际开通。', why: '佛莞城际 2024-05-26 与广佛南环同步开通，与佛肇、莞惠贯通成 258 公里大湾区一号线，200 km/h。' },
        { id: 'dg_gate_gz2', n: '中堂接驳口', to: '广州 · 新塘', at: [50.9, 28.7], dir: 'NW', y: [2019, 12], pax: [[2019.9, 0.5], [2025, 1.2], [2035, 2.0]],
          title: '穗深城际通车', desc: '穗深城际新塘南至深圳机场段 2019 年 12 月开通，东莞境内设中堂、望牛墩、东莞西等 10 站。中堂接驳口开放。',
          note: '2019 年 12 月 15 日随穗深城际开通。', why: '穗深城际新塘南—深圳机场 2019-12-15 通车，2026 年 7 月竹料—新塘南段接通后全线贯通。' },
      ] },
`;

const SZ = `    { use: 'cityLink', icon: 'bridge', label: '深莞连接', map: 'sz', name: '深圳', ach: '深莞一线', region: 'sz_out',
      why: '深惠城际在凤岗镇雁田设凤岗站，是东莞境内唯一一座深惠城际车站，2026 年底随深圳段一同通车。',
      gates: [
        { id: 'dg_gate_sz', n: '雁田接驳口', to: '深圳 · 平湖', at: [262.0, 208.3], dir: 'S', y: [2026, 12], pax: [[2027, 0.8], [2032, 1.8], [2040, 2.6]],
          title: '深惠城际凤岗站', desc: '深惠城际在前海保税区与坪地之间设 11 站，凤岗站落在东莞凤岗镇雁田，是东莞境内唯一车站。雁田接驳口开放。',
          note: '2026 年底随深惠城际深圳段通车。', why: '深惠城际 58.9 公里 11 站、160 km/h，凤岗站为东莞唯一境内站，官方口径 2026 年底建成。' },
        { id: 'dg_gate_sz2', n: '长安接驳口', to: '深圳 · 沙井', at: [124.7, 168.1], dir: 'S', y: [2019, 12], pax: [[2019.9, 0.4], [2028, 1.0], [2038, 1.6]],
          title: '穗深城际到长安', desc: '穗深城际 2019 年 12 月开通，经长安西、长安进入深圳，沙井西、福海西直到深圳机场。长安接驳口开放。',
          note: '2019 年 12 月 15 日随穗深城际开通。', why: '穗深城际东莞段 53.2 公里设 10 站，长安、长安西两站在长安镇境内。' },
      ] },
`;

if (!oldGz || !oldSz) throw new Error('找不到 cityLink 块');
s = s.replace(oldGz, GZ).replace(oldSz, SZ);
await writeFile('js/data_dg.js', s);
console.log('接驳口已更新：麻涌（佛莞城际 2024-05）+ 中堂（穗深 2019-12）；雁田（深惠城际 2026-12）+ 长安（穗深 2019-12）');