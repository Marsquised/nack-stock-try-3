const { getSymbol, cache, finnhub } = require('./_lib');
const { classify, aggregate } = require('./_news');

const ymd = (d) => d.toISOString().slice(0, 10);

async function loadNews(symbol) {
  const to = new Date(), from = new Date(Date.now() - 7 * 86400000);
  const [items, prof] = await Promise.all([
    finnhub('/company-news', { symbol, from: ymd(from), to: ymd(to) }),
    finnhub('/stock/profile2', { symbol }).catch(() => ({}))
  ]);
  const ctx = { symbol, name: prof.name || '' };
  const news = (Array.isArray(items) ? items : [])
    .filter((n) => n.headline && n.url)
    .sort((a, b) => b.datetime - a.datetime)
    .slice(0, 20)
    .map((n) => ({
      headline: n.headline, summary: (n.summary || '').slice(0, 260), source: n.source, url: n.url, time: n.datetime, image: n.image || null,
      ...classify(n, ctx)
    }));
  return { news, agg: aggregate(news), name: prof.name || symbol };
}

module.exports = async (req, res) => {
  const symbol = getSymbol(req, res);
  if (!symbol) return;
  try {
    const d = await loadNews(symbol);
    cache(res, 300);
    res.status(200).json({ symbol, ...d });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
module.exports.loadNews = loadNews;
