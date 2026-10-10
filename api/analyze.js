const { getSymbol, cache, finnhub } = require('./_lib');
const { loadNews } = require('./news');

const CAT_TH = { earnings: 'ผลประกอบการ', deal: 'ดีล', legal: 'กฎหมาย', analyst: 'นักวิเคราะห์', capital: 'ปันผล/ทุน', mgmt: 'ผู้บริหาร', contract: 'สัญญา', product: 'ผลิตภัณฑ์', insider: 'สถาบัน', macro: 'ตลาด', other: 'ทั่วไป' };
const n2 = (v) => (v == null ? '–' : Number(v).toFixed(1));

// วิเคราะห์พื้นฐาน + ข่าว แบบกฎ (ใช้ได้เสมอ ไม่ต้องมี AI)
function ruleAnalysis(m, agg) {
  const pros = [], cons = [], notes = []; let score = 0, data = 0;
  const g = (k) => (m[k] == null ? null : Number(m[k]));
  const rev = g('revenueGrowthTTMYoy'), epsG = g('epsGrowthTTMYoy'), nm = g('netProfitMarginTTM'), roe = g('roeTTM');
  const de = g('totalDebt/totalEquityQuarterly'), pe = g('peTTM') ?? g('peBasicExclExtraTTM'), eps = g('epsTTM'), dy = g('dividendYieldIndicatedAnnual'), beta = g('beta');

  if (rev != null) { data++; if (rev >= 20) { score += 2; pros.push(`รายได้เติบโตแรง (+${n2(rev)}% YoY)`); } else if (rev >= 5) { score += 1; pros.push(`รายได้เติบโตต่อเนื่อง (+${n2(rev)}% YoY)`); } else if (rev < 0) { score -= 1; cons.push(`รายได้หดตัว (${n2(rev)}% YoY)`); } }
  if (epsG != null) { data++; if (epsG >= 20) { score += 2; pros.push(`กำไรต่อหุ้นโตแรง (+${n2(epsG)}% YoY)`); } else if (epsG >= 5) { score += 1; pros.push(`กำไรต่อหุ้นเพิ่มขึ้น (+${n2(epsG)}% YoY)`); } else if (epsG < 0) { score -= 1; cons.push(`กำไรต่อหุ้นลดลง (${n2(epsG)}% YoY)`); } }
  if (nm != null) { data++; if (nm >= 20) { score += 1; pros.push(`อัตรากำไรสุทธิสูง (${n2(nm)}%)`); } else if (nm < 0) { score -= 2; cons.push('บริษัทยังขาดทุนสุทธิ'); } else if (nm < 5) { score -= 1; cons.push(`อัตรากำไรสุทธิบาง (${n2(nm)}%)`); } }
  if (roe != null) { data++; if (roe >= 20) { score += 1; pros.push(`ROE สูง (${n2(roe)}%) ใช้เงินทุนได้มีประสิทธิภาพ`); } else if (roe < 0) { score -= 1; cons.push('ROE ติดลบ'); } }
  if (de != null) { data++; if (de > 2) { score -= 1; cons.push(`หนี้สินต่อทุนสูง (D/E ${n2(de)} เท่า)`); } else if (de < 0.5) { pros.push(`ภาระหนี้ต่ำ (D/E ${n2(de)} เท่า)`); } }
  if (pe != null && pe > 0) {
    data++;
    if (pe >= 50) { score -= 1; cons.push(`ราคาแพงเทียบกำไร (P/E ${n2(pe)}) ราคาสะท้อนความคาดหวังสูง ถ้าผลงานไม่ถึงเสี่ยงปรับฐาน`); }
    else if (pe <= 15) { score += 1; pros.push(`มูลค่าไม่แพง (P/E ${n2(pe)})`); }
    else notes.push(`P/E ${n2(pe)} อยู่ระดับปานกลาง`);
    if (epsG != null && epsG > 0) { const peg = pe / epsG; if (peg < 1) { score += 1; pros.push(`PEG ประมาณ ${n2(peg)} (<1) ราคาเทียบการเติบโตดูไม่แพง`); } else if (peg > 2) { score -= 1; cons.push(`PEG ประมาณ ${n2(peg)} (>2) ราคาแพงเมื่อเทียบการเติบโต`); } }
  } else if (eps != null && eps < 0) { data++; score -= 1; cons.push('ยังไม่มีกำไร (EPS ติดลบ) มูลค่าขึ้นกับความคาดหวังการเติบโต'); }
  if (dy != null && dy >= 3) pros.push(`จ่ายปันผลสูง (${n2(dy)}% ต่อปี)`);
  if (beta != null && beta > 1.5) cons.push(`ราคาผันผวนมากกว่าตลาด (Beta ${n2(beta)})`);

  // ข่าว
  let newsView = 'ไม่มีข่าวใหม่ใน 7 วัน';
  if (agg.total) {
    if (agg.score > 0.25) { score += 1; pros.push(`ข่าวล่าสุดโน้มเอียงเชิงบวก (บวก ${agg.counts.pos} / ลบ ${agg.counts.neg})`); }
    else if (agg.score < -0.25) { score -= 1; cons.push(`ข่าวล่าสุดโน้มเอียงเชิงลบ (ลบ ${agg.counts.neg} / บวก ${agg.counts.pos})`); }
    const top = Object.entries(agg.categories).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => `${CAT_TH[k]} ${v} ข่าว`).join(', ');
    newsView = `ข่าว 7 วันล่าสุด${agg.label} เน้น ${top}`;
  }

  const verdict = data < 3 ? { key: 'na', label: 'ข้อมูลงบไม่พอ' } : score >= 3 ? { key: 'pos', label: 'เชิงบวก' } : score <= -2 ? { key: 'neg', label: 'ควรระวัง' } : { key: 'mixed', label: 'ผสม/เป็นกลาง' };
  const fundamentalView = data < 3
    ? 'ข้อมูลงบของหุ้นตัวนี้มีไม่พอ (อาจเป็น ETF/กองทุน หรือบริษัทใหม่) จึงประเมินจากข่าวและกราฟเป็นหลัก'
    : verdict.key === 'pos' ? 'พื้นฐานค่อนข้างแข็งแรง การเติบโตและความสามารถทำกำไรเป็นแรงหนุนระยะกลาง-ยาว'
    : verdict.key === 'neg' ? 'พื้นฐานมีจุดอ่อนที่ควรติดตาม ทั้งการเติบโต ความสามารถทำกำไร หรือมูลค่า'
    : 'พื้นฐานมีทั้งจุดแข็งและจุดอ่อนสมดุลกัน ควรติดตามงบไตรมาสถัดไปเพื่อดูทิศทาง';
  return { verdict, pros, cons, notes, newsView, fundamentalView, dataPoints: data };
}

async function askClaude(symbol, name, m, news, agg) {
  const key = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';
  const metrics = { pe: m.peTTM, eps: m.epsTTM, revenueGrowthYoY: m.revenueGrowthTTMYoy, epsGrowthYoY: m.epsGrowthTTMYoy, netMargin: m.netProfitMarginTTM, roe: m.roeTTM, debtToEquity: m['totalDebt/totalEquityQuarterly'], dividendYield: m.dividendYieldIndicatedAnnual, beta: m.beta, high52: m['52WeekHigh'], low52: m['52WeekLow'] };
  const heads = news.slice(0, 12).map((n, i) => `${i + 1}. [${n.category.th}/${n.sentiment}/${n.impact}] ${n.headline} — ${n.summary || ''}`.slice(0, 380)).join('\n');
  const prompt = `คุณเป็นนักวิเคราะห์หุ้นสหรัฐ วิเคราะห์ ${symbol} (${name}) จากข้อมูลด้านล่างเป็นภาษาไทย กระชับ ตรงประเด็น ห้ามให้เป้าราคา ห้ามฟันธงให้ซื้อหรือขาย ให้บอกทั้งโอกาสและความเสี่ยง และอย่าแต่งข้อมูลที่ไม่มีในข้อมูลที่ให้
ตัวชี้วัด: ${JSON.stringify(metrics)}
สรุปข่าว 7 วัน: ${JSON.stringify(agg)}
พาดหัวข่าว:
${heads || '(ไม่มีข่าว)'}

ตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น รูปแบบ:
{"summary":"สรุปภาพรวมบริษัทและข่าว 2-3 ประโยค","short":"แนวโน้มระยะสั้น (1-3 เดือน) จากข่าวและตัวเลข","medium":"แนวโน้มระยะกลาง (3-12 เดือน)","long":"แนวโน้มระยะยาว (1 ปีขึ้นไป)","catalysts":["ปัจจัยหนุน 2-4 ข้อ"],"risks":["ความเสี่ยง 2-4 ข้อ"],"newsNotes":[{"i":1,"why":"ข่าวข้อนี้ส่งผลต่อหุ้นอย่างไร ประโยคเดียว"}]}`;
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 1500, messages: [{ role: 'user', content: prompt }] })
  });
  if (!r.ok) throw new Error(`Claude API ${r.status}`);
  const j = await r.json();
  const text = (j.content || []).map((b) => b.text || '').join('');
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s < 0 || e < 0) throw new Error('AI ตอบรูปแบบไม่ถูกต้อง');
  return JSON.parse(text.slice(s, e + 1));
}

module.exports = async (req, res) => {
  const symbol = getSymbol(req, res);
  if (!symbol) return;
  const wantAI = req.query.ai === '1';
  const aiAvailable = !!process.env.ANTHROPIC_API_KEY;
  try {
    const [nw, mt] = await Promise.all([loadNews(symbol), finnhub('/stock/metric', { symbol, metric: 'all' }).catch(() => ({}))]);
    const m = mt.metric || {};
    const out = { symbol, name: nw.name, aiAvailable, rule: ruleAnalysis(m, nw.agg), agg: nw.agg };
    if (wantAI && aiAvailable) {
      try { out.ai = await askClaude(symbol, nw.name, m, nw.news, nw.agg); }
      catch (e) { out.aiError = e.message; }
    }
    cache(res, wantAI ? 3600 : 1800);
    res.status(200).json(out);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
module.exports.ruleAnalysis = ruleAnalysis;
