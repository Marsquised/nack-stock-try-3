const { cache, finnhub } = require('./_lib');

const TYPES = new Set(['Common Stock', 'ETP', 'ADR', 'REIT', 'ETF']);

module.exports = async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!/^[A-Za-z0-9.\- ]{1,30}$/.test(q)) return res.status(400).json({ error: 'คำค้นไม่ถูกต้อง' });
  try {
    const d = await finnhub('/search', { q, exchange: 'US' });
    const up = q.toUpperCase();
    const rank = (r) => r.symbol === up ? 0 : r.symbol.startsWith(up) ? 1 : r.description.toUpperCase().startsWith(up) ? 2 : 3;
    const seen = new Set();
    const results = (d.result || [])
      .filter((r) => r.symbol && TYPES.has(r.type) && /^[A-Z]{1,6}([.\-][A-Z])?$/.test(r.symbol))
      .filter((r) => (seen.has(r.symbol) ? false : seen.add(r.symbol)))
      .sort((a, b) => rank(a) - rank(b) || a.symbol.length - b.symbol.length)
      .slice(0, 8)
      .map((r) => ({ symbol: r.symbol, name: r.description, type: r.type === 'ETP' ? 'ETF' : r.type, market: 'US' }));
    cache(res, 3600);
    res.status(200).json({ q, results });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
