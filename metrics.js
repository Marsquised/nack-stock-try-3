const { getSymbol, cache, finnhub } = require('./_lib');

module.exports = async (req, res) => {
  const symbol = getSymbol(req, res);
  if (!symbol) return;
  try {
    const d = await finnhub('/stock/metric', { symbol, metric: 'all' });
    const m = d.metric || {};
    const pick = (...keys) => { for (const k of keys) if (m[k] != null) return m[k]; return null; };
    cache(res, 3600); // ตัวเลขงบเปลี่ยนช้า แคช 1 ชม.
    res.status(200).json({
      symbol,
      pe: pick('peTTM', 'peBasicExclExtraTTM', 'peNormalizedAnnual'),
      forwardPe: pick('forwardPE'),
      eps: pick('epsTTM', 'epsBasicExclExtraItemsTTM'),
      pb: pick('pbQuarterly', 'pbAnnual'),
      ps: pick('psTTM'),
      dividendYield: pick('dividendYieldIndicatedAnnual', 'currentDividendYieldTTM'),
      roe: pick('roeTTM'),
      netMargin: pick('netProfitMarginTTM'),
      debtToEquity: pick('totalDebt/totalEquityQuarterly'),
      beta: pick('beta'),
      high52: pick('52WeekHigh'),
      low52: pick('52WeekLow'),
      revenueGrowth: pick('revenueGrowthTTMYoy'),
      epsGrowth: pick('epsGrowthTTMYoy')
    });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
