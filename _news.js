// จัดหมวดข่าว + วิเคราะห์ความรู้สึก + ระดับผลกระทบ (แบบกฎ ไม่ต้องใช้ AI)
// [id, ชื่อไทย, น้ำหนักผลกระทบ, regex]
const CATS = [
  ['earnings', 'ผลประกอบการ', 3, /\b(earnings|revenue|eps|quarterly|quarter|q[1-4]|guidance|net income|profit|forecast|outlook|sales)\b/gi],
  ['deal', 'ดีล/ควบรวมกิจการ', 3, /\b(acquir\w*|acquisition|merger|merge[sd]?|buyout|takeover|divest\w*|spin-?off|ipo|to buy|stake sale)\b/gi],
  ['legal', 'กฎหมาย/การกำกับดูแล', 3, /\b(lawsuit\w*|sue[sd]?|sec|investigat\w*|probe|fine[sd]?|regulat\w*|antitrust|ban(s|ned)?|tariff\w*|export controls?|sanction\w*|settlement|subpoena|court|doj|ftc)\b/gi],
  ['analyst', 'นักวิเคราะห์/เป้าราคา', 2, /\b(price target|upgrade[sd]?|downgrade[sd]?|analyst\w*|rating|initiates?|coverage|overweight|underweight|outperform|underperform|buy rating|sell rating)\b/gi],
  ['capital', 'ปันผล/ซื้อหุ้นคืน/ระดมทุน', 2, /\b(dividend\w*|buyback|repurchase\w*|share offering|stock offering|stock split|debt offering|notes offering)\b/gi],
  ['mgmt', 'ผู้บริหาร/องค์กร', 2, /\b(ceo|cfo|cto|chairman|resign\w*|appoint\w*|steps? down|layoff\w*|restructur\w*|hires?|board)\b/gi],
  ['contract', 'สัญญา/ลูกค้า/พันธมิตร', 2, /\b(contract\w*|award\w*|orders?|customer\w*|agreement|partnership|partners?|collaborat\w*|deal with|selected by)\b/gi],
  ['product', 'ผลิตภัณฑ์/เทคโนโลยี', 2, /\b(launch\w*|unveil\w*|introduc\w*|new product|chips?|ai|models?|platform|release[sd]?|rollout|technology|innovation|patent\w*|breakthrough|facility|plant|production|capacity)\b/gi],
  ['insider', 'ผู้ถือหุ้นรายใหญ่/สถาบัน', 1, /\b(insider|13f|institutional|position in|holdings|stake in|acquires new|boosts? stake|trims? stake|purchased|sold)\b/gi],
  ['macro', 'ตลาดโดยรวม/เศรษฐกิจ', 1, /\b(fed|inflation|rate cuts?|rate hikes?|jobs report|gdp|market|stocks|sector|nasdaq|s&p|dow|etfs?|treasury|yields?)\b/gi]
];
const OTHER = ['other', 'ข่าวทั่วไป', 1];

const POS = /\b(surg\w*|soar\w*|jump\w*|beat|beats|record|raise[sd]?|upgrade[sd]?|outperform\w*|strong\w*|growth|gain\w*|rall\w*|boost\w*|wins?|won|approv\w*|expand\w*|bullish|tops?|topped|rise[sn]?|rising|climb\w*|higher|profit\w*|breakthrough|overweight|momentum|upside|accelerat\w*|optimis\w*|buy rating)\b/gi;
const NEG = /\b(plung\w*|tumbl\w*|slump\w*|miss|misses|missed|cuts?|slash\w*|downgrade[sd]?|weak\w*|lawsuit\w*|probe|investigat\w*|fall|falls|fell|drops?|dropped|declin\w*|loss|losses|recall\w*|ban|bans|banned|delay\w*|warn\w*|layoff\w*|bearish|sell-?off|lower|risks?|concern\w*|fraud|fines?|fined|underperform\w*|underweight|sink\w*|sank|crash\w*|halt\w*|shortfall|downside|struggl\w*|pressure)\b/gi;

const found = (re, t) => (t.match(re) || []).map((s) => s.toLowerCase());
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function classify(item, ctx) {
  const head = item.headline || '', body = item.summary || '', text = head + ' ' + body;

  // หมวดหมู่
  let best = OTHER, bestScore = 0;
  for (const [id, th, w, re] of CATS) {
    const n = Math.min(found(re, head).length * 2 + found(re, body).length, 4);
    const sc = n * w;
    if (sc > bestScore) { bestScore = sc; best = [id, th, w]; }
  }

  // ความรู้สึก (พาดหัวน้ำหนัก 2 เท่า)
  const ph = found(POS, head), nh = found(NEG, head), pb = found(POS, body), nb = found(NEG, body);
  const sScore = 2 * (ph.length - nh.length) + (pb.length - nb.length);
  const sentiment = sScore >= 2 ? 'pos' : sScore <= -2 ? 'neg' : 'neu';
  const keywords = [...new Set([...(sScore >= 0 ? [...ph, ...pb] : [...nh, ...nb])])].slice(0, 3);

  // ความเกี่ยวข้องกับหุ้นโดยตรง
  const sym = new RegExp('\\b' + esc(ctx.symbol) + '\\b');
  const nameTok = String(ctx.name || '').split(/[\s,.]+/)[0];
  const direct = sym.test(head) || (nameTok.length >= 4 && new RegExp('\\b' + esc(nameTok) + '\\b', 'i').test(head));
  const manyTickers = String(item.related || '').split(',').filter(Boolean).length > 3;

  // ระดับผลกระทบ
  const ageH = (Date.now() / 1000 - (item.datetime || 0)) / 3600;
  const strength = Math.abs(sScore) >= 4 ? 2 : Math.abs(sScore) >= 2 ? 1 : 0;
  const iScore = best[2] + strength + (direct ? 1 : 0) + (ageH < 24 ? 1 : 0) - (manyTickers ? 1 : 0);
  const impact = iScore >= 6 ? 'high' : iScore >= 4 ? 'mid' : 'low';

  return { category: { id: best[0], th: best[1] }, sentiment, sScore, impact, iScore, keywords, direct };
}

function aggregate(items) {
  const w = { high: 3, mid: 2, low: 1 };
  let num = 0, den = 0; const counts = { pos: 0, neg: 0, neu: 0 }, cats = {};
  items.forEach((n) => {
    counts[n.sentiment]++; cats[n.category.id] = (cats[n.category.id] || 0) + 1;
    const sign = n.sentiment === 'pos' ? 1 : n.sentiment === 'neg' ? -1 : 0;
    num += sign * w[n.impact]; den += w[n.impact];
  });
  const score = den ? num / den : 0;
  const label = !items.length ? 'ไม่มีข่าว' : score > 0.25 ? 'เชิงบวก' : score < -0.25 ? 'เชิงลบ' : 'ผสม/เป็นกลาง';
  return { score: Math.round(score * 100) / 100, label, counts, categories: cats, total: items.length };
}

module.exports = { classify, aggregate };
