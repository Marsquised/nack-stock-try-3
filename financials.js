const { getSymbol, cache, finnhub } = require('./_lib');

// [ชื่อแถว, [concept ที่เป็นไปได้ตามลำดับ], รูปแบบ]
const MAP = {
  ic: [
    ['revenue', 'รายได้รวม', ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'RevenueFromContractWithCustomerIncludingAssessedTax', 'SalesRevenueNet']],
    ['cost', 'ต้นทุนขาย', ['CostOfRevenue', 'CostOfGoodsAndServicesSold', 'CostOfGoodsSold']],
    ['gross', 'กำไรขั้นต้น', ['GrossProfit']],
    ['rnd', 'ค่าวิจัยและพัฒนา', ['ResearchAndDevelopmentExpense']],
    ['sga', 'ค่าขายและบริหาร', ['SellingGeneralAndAdministrativeExpense']],
    ['op', 'กำไรจากการดำเนินงาน', ['OperatingIncomeLoss']],
    ['pretax', 'กำไรก่อนภาษี', ['IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest', 'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments']],
    ['net', 'กำไรสุทธิ', ['NetIncomeLoss', 'ProfitLoss', 'NetIncomeLossAvailableToCommonStockholdersBasic']],
    ['epsd', 'EPS (ปรับลด)', ['EarningsPerShareDiluted'], 'eps'],
    ['epsb', 'EPS (พื้นฐาน)', ['EarningsPerShareBasic'], 'eps']
  ],
  bs: [
    ['cash', 'เงินสดและรายการเทียบเท่า', ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents']],
    ['ca', 'สินทรัพย์หมุนเวียน', ['AssetsCurrent']],
    ['assets', 'สินทรัพย์รวม', ['Assets']],
    ['cl', 'หนี้สินหมุนเวียน', ['LiabilitiesCurrent']],
    ['liab', 'หนี้สินรวม', ['Liabilities']],
    ['ltd', 'เงินกู้ระยะยาว', ['LongTermDebtNoncurrent', 'LongTermDebt']],
    ['equity', 'ส่วนของผู้ถือหุ้น', ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest']]
  ],
  cf: [
    ['cfo', 'กระแสเงินสดจากการดำเนินงาน', ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations']],
    ['cfi', 'กระแสเงินสดจากการลงทุน', ['NetCashProvidedByUsedInInvestingActivities', 'NetCashProvidedByUsedInInvestingActivitiesContinuingOperations']],
    ['cff', 'กระแสเงินสดจากการจัดหาเงิน', ['NetCashProvidedByUsedInFinancingActivities', 'NetCashProvidedByUsedInFinancingActivitiesContinuingOperations']],
    ['capex', 'รายจ่ายลงทุน (CapEx)', ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets']],
    ['div', 'เงินปันผลจ่าย', ['PaymentsOfDividends', 'PaymentsOfDividendsCommonStock']],
    ['buyback', 'ซื้อหุ้นคืน', ['PaymentsForRepurchaseOfCommonStock']]
  ]
};

const strip = (c) => String(c || '').replace(/^[^_]+_/, '');

function extract(list, defs) {
  const byConcept = new Map();
  (list || []).forEach((it) => { const k = strip(it.concept); if (!byConcept.has(k) && typeof it.value === 'number') byConcept.set(k, it.value); });
  const out = {};
  defs.forEach(([key, , concepts]) => {
    for (const c of concepts) if (byConcept.has(c)) { out[key] = byConcept.get(c); return; }
    out[key] = null;
  });
  return out;
}

module.exports = async (req, res) => {
  const symbol = getSymbol(req, res);
  if (!symbol) return;
  try {
    const d = await finnhub('/stock/financials-reported', { symbol, freq: 'annual' });
    const filings = (d.data || []).filter((f) => f.report).sort((a, b) => String(b.endDate).localeCompare(String(a.endDate))).slice(0, 4);
    if (!filings.length) { cache(res, 3600); return res.status(200).json({ symbol, available: false, periods: [] }); }

    const cols = filings.map((f) => ({
      ic: extract(f.report.ic, MAP.ic), bs: extract(f.report.bs, MAP.bs), cf: extract(f.report.cf, MAP.cf)
    }));
    // ค่าที่คำนวณเพิ่ม
    cols.forEach((c) => {
      if (c.ic.gross == null && c.ic.revenue != null && c.ic.cost != null) c.ic.gross = c.ic.revenue - c.ic.cost;
      c.ic.grossMargin = c.ic.gross != null && c.ic.revenue ? (c.ic.gross / c.ic.revenue) * 100 : null;
      c.ic.netMargin = c.ic.net != null && c.ic.revenue ? (c.ic.net / c.ic.revenue) * 100 : null;
      c.cf.fcf = c.cf.cfo != null && c.cf.capex != null ? c.cf.cfo - Math.abs(c.cf.capex) : null;
    });
    const extra = {
      ic: [['grossMargin', 'อัตรากำไรขั้นต้น', 'pct'], ['netMargin', 'อัตรากำไรสุทธิ', 'pct']],
      bs: [], cf: [['fcf', 'กระแสเงินสดอิสระ (FCF)', 'usd']]
    };
    const table = (sec) => {
      const defs = MAP[sec].map(([key, label, , fmt]) => [key, label, fmt || 'usd']).concat(extra[sec]);
      return defs
        .map(([key, label, fmt]) => ({ key, label, fmt, values: cols.map((c) => c[sec][key]) }))
        .filter((r) => r.values.some((v) => v != null));
    };
    cache(res, 21600);
    res.status(200).json({
      symbol, available: true,
      periods: filings.map((f) => ({ label: 'FY' + (f.year || String(f.endDate).slice(0, 4)), end: String(f.endDate).slice(0, 10) })),
      ic: table('ic'), bs: table('bs'), cf: table('cf')
    });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
