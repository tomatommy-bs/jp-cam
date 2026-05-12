// Hokkaido 振興局 (subprefecture) mapping by JIS X 0402 5-digit code.
//
// The 14 振興局 are encoded by the third+fourth digits of the city code:
// the 郡 (district) groupings line up cleanly into ranges, plus a handful
// of designated/特定の 市 that need explicit overrides.

export const HOKKAIDO_SUBREGIONS = [
  { id: 'sorachi',   name: '空知' },
  { id: 'ishikari',  name: '石狩' },
  { id: 'shiribeshi',name: '後志' },
  { id: 'iburi',     name: '胆振' },
  { id: 'hidaka',    name: '日高' },
  { id: 'oshima',    name: '渡島' },
  { id: 'hiyama',    name: '檜山' },
  { id: 'kamikawa',  name: '上川' },
  { id: 'rumoi',     name: '留萌' },
  { id: 'soya',      name: '宗谷' },
  { id: 'okhotsk',   name: 'オホーツク' },
  { id: 'tokachi',   name: '十勝' },
  { id: 'kushiro',   name: '釧路' },
  { id: 'nemuro',    name: '根室' },
];

// Designated 市 (and a few 郡部 exceptions) — must be checked first because
// the 200-block (cities) doesn't follow the same 郡 grouping as the
// 300/400/500/600-blocks.
const CITY_OVERRIDES = {
  '01100': 'ishikari',  // 札幌市
  '01202': 'oshima',    // 函館市
  '01203': 'shiribeshi',// 小樽市
  '01204': 'kamikawa',  // 旭川市
  '01205': 'iburi',     // 室蘭市
  '01206': 'kushiro',   // 釧路市
  '01207': 'tokachi',   // 帯広市
  '01208': 'okhotsk',   // 北見市
  '01209': 'sorachi',   // 夕張市
  '01210': 'sorachi',   // 岩見沢市
  '01211': 'okhotsk',   // 網走市
  '01212': 'rumoi',     // 留萌市
  '01213': 'iburi',     // 苫小牧市
  '01214': 'soya',      // 稚内市
  '01215': 'sorachi',   // 美唄市
  '01216': 'sorachi',   // 芦別市
  '01217': 'ishikari',  // 江別市
  '01218': 'sorachi',   // 赤平市
  '01219': 'okhotsk',   // 紋別市
  '01220': 'kamikawa',  // 士別市
  '01221': 'kamikawa',  // 名寄市
  '01222': 'sorachi',   // 三笠市
  '01223': 'nemuro',    // 根室市
  '01224': 'ishikari',  // 千歳市
  '01225': 'sorachi',   // 滝川市
  '01226': 'sorachi',   // 砂川市
  '01227': 'sorachi',   // 歌志内市
  '01228': 'sorachi',   // 深川市
  '01229': 'kamikawa',  // 富良野市
  '01230': 'iburi',     // 登別市
  '01231': 'ishikari',  // 恵庭市
  '01233': 'iburi',     // 伊達市
  '01234': 'ishikari',  // 北広島市
  '01235': 'ishikari',  // 石狩市
  '01236': 'oshima',    // 北斗市
};

// 郡部 ranges (3xx〜7xx).
const RANGE_TABLE = [
  // 石狩振興局
  { from: 303, to: 304, id: 'ishikari' },   // 当別町・新篠津村
  // 渡島総合振興局
  { from: 331, to: 347, id: 'oshima' },     // 松前郡・上磯郡・亀田郡・茅部郡・二海郡・山越郡
  // 檜山振興局
  { from: 361, to: 371, id: 'hiyama' },     // 檜山郡・爾志郡・久遠郡・奥尻郡・瀬棚郡
  // 後志総合振興局
  { from: 391, to: 409, id: 'shiribeshi' }, // 島牧郡・寿都郡・磯谷郡・虻田郡・岩内郡・古宇郡・積丹郡・古平郡・余市郡
  // 空知総合振興局
  { from: 423, to: 438, id: 'sorachi' },    // 空知郡・夕張郡・樺戸郡・雨竜郡
  // 上川総合振興局
  { from: 452, to: 472, id: 'kamikawa' },   // 上川郡・空知郡・勇払郡・中川郡
  // 留萌振興局
  { from: 481, to: 487, id: 'rumoi' },      // 増毛郡・留萌郡・苫前郡・天塩郡
  // 宗谷総合振興局
  { from: 511, to: 520, id: 'soya' },       // 宗谷郡・枝幸郡・天塩郡・礼文郡・利尻郡
  // オホーツク総合振興局
  { from: 543, to: 564, id: 'okhotsk' },    // 網走郡・常呂郡・紋別郡
  // 胆振総合振興局
  { from: 571, to: 586, id: 'iburi' },      // 虻田郡・有珠郡・白老郡・勇払郡
  // 日高振興局
  { from: 601, to: 610, id: 'hidaka' },     // 沙流郡・新冠郡・浦河郡・様似郡・幌泉郡・日高郡
  // 十勝総合振興局
  { from: 631, to: 649, id: 'tokachi' },    // 河東郡・上川郡・河西郡・広尾郡・中川郡・足寄郡・十勝郡
  // 釧路総合振興局
  { from: 661, to: 668, id: 'kushiro' },    // 釧路郡・厚岸郡・川上郡・阿寒郡・白糠郡
  // 根室振興局
  { from: 691, to: 700, id: 'nemuro' },     // 野付郡・標津郡・目梨郡・北方領土の各村
];

export function hokkaidoSubregionOf(code) {
  if (!code || !code.startsWith('01')) return null;
  if (CITY_OVERRIDES[code]) return CITY_OVERRIDES[code];
  const tail = +code.slice(2);
  for (const r of RANGE_TABLE) {
    if (tail >= r.from && tail <= r.to) return r.id;
  }
  return null;
}
