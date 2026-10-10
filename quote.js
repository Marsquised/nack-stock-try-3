const { getSymbol, cache, finnhub, yahooChart } = require('./_lib');

module.exports = async (req, res) => {
  const symbol = getSymbol(req, res);
  if (!symbol) return;
  try {
    let q = null;
    try {
      const d = await finnhub('/quote', { symbol });
      if (d && d.c) q = { price: d.c, change: d.d, changePct: d.dp, high: d.h, low: d.l, open: d.o, prevClose: d.pc, time: d.t, source: 'finnhub' };
    } catch (e) { /* ใช้ Yahoo สำรอง */ }

    if (!q) {
      const r = await yahooChart(symbol, '5d', '1d');
      const m = r.meta;
      q = {
        price: m.regularMarketPrice,
        prevClose: m.chartPreviousClose,
        change: m.regularMarketPrice - m.chartPreviousClose,
        changePct: ((m.regularMarketPrice - m.chartPreviousClose) / m.chartPreviousClose) * 100,
        high: m.regularMarketDayHigh, low: m.regularMarketDayLow, open: null,
        time: m.regularMarketTime, source: 'yahoo'
      };
    }

    // ชื่อบริษัทและข้อมูลทั่วไป
    let profile = {};
    try { profile = await finnhub('/stock/profile2', { symbol }); } catch (e) {}
    cache(res, 60);
    res.status(200).json({ symbol, ...q, name: profile.name || symbol, logo: profile.logo || null, exchange: profile.exchange || null, industry: profile.finnhubIndustry || null, marketCap: profile.marketCapitalization || null });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
