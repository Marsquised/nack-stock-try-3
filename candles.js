const { getSymbol, cache, yahooChart } = require('./_lib');

// tf: day|week|month  range: ช่วงที่ดึงจาก Yahoo (ดึงเกินช่วงที่โชว์ เพื่อให้เส้น EMA/RSI คำนวณครบตั้งแต่ขอบซ้ายของกราฟ)
const INTERVAL = { day: '1d', week: '1wk', month: '1mo' };
const RANGES = new Set(['2y', '5y', '10y', 'max']);
const TTL = { day: 120, week: 600, month: 3600 };

module.exports = async (req, res) => {
  const symbol = getSymbol(req, res);
  if (!symbol) return;
  const tf = INTERVAL[req.query.tf] ? req.query.tf : 'day';
  const range = RANGES.has(req.query.range) ? req.query.range : '2y';
  try {
    const r = await yahooChart(symbol, range, INTERVAL[tf]);
    const q = r.indicators.quote[0];
    const candles = [];
    (r.timestamp || []).forEach((t, i) => {
      if (q.open[i] == null || q.close[i] == null || q.high[i] == null || q.low[i] == null) return;
      candles.push({ time: t, open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i], volume: q.volume[i] || 0 });
    });
    cache(res, TTL[tf]);
    res.status(200).json({ symbol, tf, range, candles });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
