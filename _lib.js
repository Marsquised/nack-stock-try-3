// ตัวช่วยกลาง: ตรวจ symbol, เรียก Finnhub/Yahoo, ตั้งค่าแคช
const FINNHUB = 'https://finnhub.io/api/v1';

function getSymbol(req, res) {
  const s = String(req.query.symbol || '').toUpperCase().trim();
  if (!/^[A-Z][A-Z.\-]{0,9}$/.test(s)) {
    res.status(400).json({ error: 'symbol ไม่ถูกต้อง' });
    return null;
  }
  return s;
}

// แคชที่ edge ของ Vercel: คนเข้าพร้อมกันกี่คนก็เรียก API ภายนอกแค่ 1 ครั้งต่อรอบ
function cache(res, seconds) {
  res.setHeader('Cache-Control', `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 3}`);
}

async function finnhub(path, params = {}) {
  const key = process.env.FINNHUB_KEY;
  if (!key) throw new Error('ยังไม่ได้ตั้งค่า FINNHUB_KEY');
  const qs = new URLSearchParams({ ...params, token: key });
  const r = await fetch(`${FINNHUB}${path}?${qs}`);
  if (r.status === 429) throw new Error('เรียก API ถี่เกินโควต้า ลองใหม่ในอีกสักครู่');
  if (r.status === 401 || r.status === 403) throw new Error('FINNHUB_KEY ไม่ถูกต้อง หรือไม่มีสิทธิ์ใช้ข้อมูลนี้');
  if (!r.ok) throw new Error(`Finnhub ${r.status}`);
  return r.json();
}

const YH_HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; StockDashboard/1.0)' };

async function yahooChart(symbol, range, interval) {
  const hosts = ['query1', 'query2'];
  let lastErr;
  for (const h of hosts) {
    try {
      const url = `https://${h}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`;
      const r = await fetch(url, { headers: YH_HEADERS });
      if (!r.ok) throw new Error(`Yahoo ${r.status}`);
      const j = await r.json();
      const result = j.chart && j.chart.result && j.chart.result[0];
      if (!result) throw new Error('ไม่พบข้อมูล');
      return result;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

module.exports = { getSymbol, cache, finnhub, yahooChart };
