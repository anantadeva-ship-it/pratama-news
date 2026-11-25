// Cloudflare Worker API for the static GitHub Pages frontend.
// Deploy this file as a Worker, then set its base URL in config.js.
const CATEGORIES = {
  'Semua': '',
  'Saham AS': [
    'US stocks Wall Street Nasdaq companies earnings',
    'US economy inflation Federal Reserve jobs GDP markets',
    'US corporations merger acquisition layoffs bankruptcy stock market',
  ],
  'Saham Indonesia': [
    'saham Indonesia emiten IHSG perusahaan bursa BEI',
    'perusahaan Indonesia laba dividen IPO rights issue saham',
    'ekonomi Indonesia inflasi Bank Indonesia rupiah pasar',
  ],
  'Crypto': [
    'Bitcoin cryptocurrency crypto market companies ETF regulation',
    'perusahaan crypto exchange stablecoin regulation hack',
    'crypto market bitcoin ethereum price institutional investment',
  ],
  'Emas': [
    'harga emas gold price precious metals mining companies',
    'gold mining companies production earnings central bank demand',
    'harga emas Indonesia logam mulia inflasi bank sentral',
  ],
  'USD': [
    'US dollar forex USD exchange rate currency markets',
    'rupiah dollar USD IDR Bank Indonesia foreign exchange',
    'US economy Federal Reserve inflation dollar global markets',
  ],
};
const WORDS = {
  positive: ['rally','surge','surges','gain','gains','rose','rises','rise','beat','beats','profit','profits','growth','rebound','recovery','reclaims','booming','record high','upgrade','upgraded','inflow','inflows','approval','menguat','naik','laba','untung','tumbuh','pulih','positif','surplus','menguatkan'],
  negative: ['crash','crashes','plunge','plunges','slump','slumps','drop','drops','decline','declines','fell','falls','fall','loss','losses','cut','cuts','layoff','layoffs','bankrupt','bankruptcy','weak','weaker','weakness','downgrade','outflow','outflows','sell-off','crisis','hack','fraud','shrink','shrinks','shrinking','downside','below','weighs','fizzles','retreat','retreats','slides','slipped','bearish','cautious','recession','turun','melemah','anjlok','rugi','kerugian','penurunan','phk','defisit','gagal','tertekan','koreksi','lesu','kebocoran'],
};
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=60', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };

async function economicCalendar() {
  const today = new Date();
  const from = new Date(today.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const end = new Date(today.getTime() + 180 * 86400000).toISOString().slice(0, 10);
  const endpoint = new URL('https://xoomar.com/api/markets/calendar');
  endpoint.searchParams.set('from', from);
  endpoint.searchParams.set('to', end);
  endpoint.searchParams.set('importance', 'high');
  const response = await fetch(endpoint, { headers: { 'Accept': 'application/json' } });
  if (!response.ok) throw new Error(`Kalender ekonomi merespons HTTP ${response.status}`);
  const payload = await response.json();
  const events = (payload.data || []).filter(event => /cpi|nonfarm payroll|employment situation|fomc rate decision/i.test(event.eventName || ''));
  return {
    updatedAt: payload.updatedAt || Date.now(),
    source: 'XOOMAR · jadwal BLS dan Federal Reserve',
    sourceUrl: 'https://xoomar.com/markets/api/calendar',
    events: events.map(event => ({
      name: event.eventName,
      scheduledAt: event.scheduledAt,
      period: event.periodLabel,
      previous: event.previous,
      actual: event.actual,
      unit: event.unit,
      source: event.source,
      sourceUrl: event.canonicalUrl || (event.source === 'fed' ? 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm' : 'https://www.bls.gov/schedule/news_release/'),
    })),
  };
}

function decodeXml(value = '') {
  return value.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}
function readTag(block, name) {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return decodeXml(match?.[1]?.trim() || '');
}
function plainText(html = '') {
  return decodeXml(html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')).trim();
}
function containsTerms(text) {
  const tokens = new Set(text.split(/[^\p{L}\p{N}]+/u));
  return word => word.includes(' ') || word.includes('-') ? text.includes(word) : tokens.has(word);
}
// Keep aliases specific enough to avoid mistaking ordinary words for tickers.
const ISSUERS = [
  ['BBCA', 'Bank Central Asia', ['bbca', 'bank central asia', 'bca']],
  ['BBRI', 'Bank Rakyat Indonesia', ['bbri', 'bank rakyat indonesia', 'bri']],
  ['BMRI', 'Bank Mandiri', ['bmri', 'bank mandiri']],
  ['BBNI', 'Bank Negara Indonesia', ['bbni', 'bank negara indonesia', 'bni']],
  ['TLKM', 'Telkom Indonesia', ['tlkm', 'telkom indonesia', 'telkom']],
  ['ASII', 'Astra International', ['asii', 'astra international']],
  ['GOTO', 'GoTo Gojek Tokopedia', ['goto', 'gojek', 'tokopedia']],
  ['BREN', 'Barito Renewables Energy', ['bren', 'barito renewables']],
  ['AMMN', 'Amman Mineral Internasional', ['ammn', 'amman mineral']],
  ['ANTM', 'Aneka Tambang', ['antm', 'aneka tambang', 'antam']],
  ['UNVR', 'Unilever Indonesia', ['unvr', 'unilever indonesia']],
  ['ICBP', 'Indofood CBP', ['icbp', 'indofood cbp']],
  ['INDF', 'Indofood Sukses Makmur', ['indf', 'indofood sukses makmur']],
  ['ADRO', 'Alamtri Resources Indonesia (Adaro)', ['adro', 'alamtri resources', 'adaro']],
  ['PTBA', 'Bukit Asam', ['ptba', 'bukit asam']],
  ['MEDC', 'Medco Energi', ['medc', 'medco energi']],
  ['BRPT', 'Barito Pacific', ['brpt', 'barito pacific']],
  ['CPIN', 'Charoen Pokphand Indonesia', ['cpin', 'charoen pokphand indonesia']],
  ['MAPI', 'Mitra Adiperkasa', ['mapi', 'mitra adiperkasa']],
  ['PGAS', 'Perusahaan Gas Negara', ['pgas', 'perusahaan gas negara']],
  ['AAPL', 'Apple', ['aapl', 'apple']],
  ['MSFT', 'Microsoft', ['msft', 'microsoft']],
  ['NVDA', 'NVIDIA', ['nvda', 'nvidia']],
  ['GOOGL', 'Alphabet / Google', ['googl', 'goog', 'alphabet', 'google']],
  ['AMZN', 'Amazon', ['amzn', 'amazon']],
  ['META', 'Meta Platforms', ['meta platforms', 'facebook']],
  ['TSLA', 'Tesla', ['tsla', 'tesla']],
  ['JPM', 'JPMorgan Chase', ['jpm', 'jpmorgan', 'jp morgan']],
  ['COIN', 'Coinbase', ['coinbase', 'coin']],
  ['MSTR', 'Strategy (MicroStrategy)', ['mstr', 'microstrategy', 'strategy inc']],
];
function identifyIssuers(article) {
  const text = `${article.title} ${article.description}`.toLowerCase();
  return ISSUERS.filter(([, , aliases]) => aliases.some(alias => {
    if (alias.includes(' ')) return text.includes(alias);
    return new RegExp(`(^|[^\\p{L}\\p{N}])\\$?${alias}([^\\p{L}\\p{N}]|$)`, 'u').test(text);
  })).map(([ticker, name]) => ({ ticker, name }));
}
function analyze(article) {
  const title = article.title.toLowerCase();
  const description = article.description.toLowerCase();
  const positiveTitle = WORDS.positive.filter(containsTerms(title));
  const negativeTitle = WORDS.negative.filter(containsTerms(title));
  const positiveDescription = WORDS.positive.filter(containsTerms(description));
  const negativeDescription = WORDS.negative.filter(containsTerms(description));
  const positive = [...positiveTitle, ...positiveDescription];
  const negative = [...negativeTitle, ...negativeDescription];
  const positiveScore = positiveTitle.length * 2 + positiveDescription.length;
  const negativeScore = negativeTitle.length * 2 + negativeDescription.length;
  const mood = positiveScore && negativeScore && Math.abs(positiveScore - negativeScore) <= 1 ? 'mixed' : positiveScore > negativeScore ? 'positive' : negativeScore > positiveScore ? 'negative' : 'neutral';
  const stance = mood === 'positive' ? 'bullish' : mood === 'negative' ? 'bearish' : mood;
  const issuers = identifyIssuers(article);
  const marketName = {
    'Saham AS': 'pasar Amerika Serikat',
    'Saham Indonesia': 'pasar Indonesia',
    Crypto: 'pasar kripto global dan investor di negara terkait',
    Emas: 'pasar emas global dan negara produsen atau pengguna emas',
    USD: 'pasar valas pada negara dan mata uang yang disebut dalam berita',
  }[article.category] || 'pasar negara terkait';
  const issuerLabel = issuers.length ? issuers.map(item => `${item.name} (${item.ticker})`).join(', ') : 'Emiten belum teridentifikasi dari judul/ringkasan';
  const companyImpact = {
    positive: `Bullish untuk ${issuerLabel}: kabar bernada positif berpotensi mendukung sentimen dan minat investor. Dampak ke harga atau kinerja emiten belum dapat dipastikan tanpa memeriksa isi berita dan laporan perusahaan.`,
    negative: `Bearish untuk ${issuerLabel}: kabar bernada negatif berpotensi menekan sentimen investor. Besar dampak pada harga, operasi, atau keuangan perlu dikonfirmasi dari isi berita dan laporan perusahaan.`,
    mixed: `Campuran untuk ${issuerLabel}: terdapat sinyal positif dan negatif, sehingga arah dampaknya belum jelas dan volatilitas dapat meningkat.`,
    neutral: `Netral / belum terkonfirmasi untuk ${issuerLabel}: judul dan ringkasan belum memberi sinyal arah yang kuat.`,
  }[mood];
  const marketImpact = {
    positive: `Jika kabar ini mencerminkan perbaikan fundamental, sentimen dapat mendukung ${marketName}; pengaruh luasnya bergantung pada skala dan banyaknya aset yang terdampak.`,
    negative: `Jika kabar ini mencerminkan pelemahan fundamental, sentimen dapat menekan ${marketName} atau meningkatkan kehati-hatian investor; dampak nasional bergantung pada skala peristiwanya.`,
    mixed: `Sinyal yang beragam dapat menambah volatilitas di ${marketName}; arah pasar belum dapat disimpulkan dari ringkasan saja.`,
    neutral: `Belum terlihat arah dampak yang jelas pada ${marketName} dari judul dan ringkasan yang tersedia.`,
  }[mood];
  return { mood, stance, issuers, issuerLabel, evidence: [...positive, ...negative].slice(0, 6), companyImpact, marketImpact };
}
async function readFeed(search) {
  const url = new URL('https://www.bing.com/news/search');
  url.searchParams.set('q', search);
  url.searchParams.set('format', 'rss');
  url.searchParams.set('mkt', 'id-ID');
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PRATAMA-NEWS/1.0)', 'Accept': 'application/rss+xml, application/xml, text/xml' } });
  if (!response.ok) throw new Error(`Bing News merespons HTTP ${response.status}`);
  const xml = await response.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(([, block]) => {
    const title = readTag(block, 'title');
    const source = readTag(block, 'News:Source') || 'Bing News';
    const published = new Date(readTag(block, 'pubDate') || 0);
    const wrapped = readTag(block, 'link');
    let link = wrapped;
    try { const target = new URL(wrapped).searchParams.get('url'); if (target && ['http:', 'https:'].includes(new URL(target).protocol)) link = target; } catch {}
    return { title, source, link, publishedAt: Number.isNaN(published.getTime()) ? new Date(0).toISOString() : published.toISOString(), description: plainText(readTag(block, 'description')), image: readTag(block, 'News:Image').replace(/^http:\/\//i, 'https://') };
  }).filter(item => item.title && item.link && Date.now() - new Date(item.publishedAt).getTime() <= 30 * 86400000);
}
async function collect(q, category) {
  let articles;
  if (category === 'Semua' && !q) {
    const groups = Object.entries(CATEGORIES).filter(([name]) => name !== 'Semua');
    const feeds = await Promise.all(groups.flatMap(([label, terms]) => terms.map(async term => ({ label, items: await readFeed(term).catch(() => []) }))));
    articles = feeds.flatMap(feed => feed.items.map(item => ({ ...item, category: feed.label })));
  } else {
    const terms = category === 'Semua' ? [q] : CATEGORIES[category];
    const feeds = await Promise.all(terms.map(term => readFeed((category === 'Semua' ? [term] : [q, term]).filter(Boolean).join(' ').slice(0, 220)).catch(() => [])));
    articles = feeds.flatMap(feed => feed.map(item => ({ ...item, category: category === 'Semua' ? 'Pasar' : category })));
  }
  const seen = new Set();
  articles = articles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)).filter(item => {
    const key = item.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const perCategory = new Map();
  return articles.filter(item => {
    const count = perCategory.get(item.category) || 0;
    const limit = category === 'Semua' && !q ? 10 : 50;
    if (count >= limit) return false;
    perCategory.set(item.category, count + 1);
    return true;
  }).slice(0, 50).map(item => ({ ...item, analysis: analyze(item) }));
}
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: jsonHeaders });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: jsonHeaders });
    if (url.pathname === '/api/calendar') {
      const cacheKey = new Request('https://pratama-news-cache.invalid/api/calendar');
      const cached = await caches.default.match(cacheKey);
      if (cached) return cached;
      try {
        const data = await economicCalendar();
        const headers = { ...jsonHeaders, 'Cache-Control': 'public, max-age=300' };
        const response = new Response(JSON.stringify(data), { headers });
        ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
        return response;
      } catch (error) {
        return new Response(JSON.stringify({ error: `Tidak dapat mengambil kalender USD. ${error.message}` }), { status: 502, headers: jsonHeaders });
      }
    }
    if (url.pathname !== '/api/news') return new Response('Not found', { status: 404, headers: jsonHeaders });
    const q = (url.searchParams.get('q') || '').trim().slice(0, 120);
    const categoryName = CATEGORIES[url.searchParams.get('category')] !== undefined ? url.searchParams.get('category') : 'Semua';
    const cacheUrl = new URL(`https://pratama-news-cache.invalid/api/news?category=${encodeURIComponent(categoryName)}&q=${encodeURIComponent(q.toLowerCase())}`);
    const cacheKey = new Request(cacheUrl);
    const cached = await caches.default.match(cacheKey);
    if (cached) return cached;
    try {
      const articles = await collect(q, categoryName);
      const response = new Response(JSON.stringify({ articles, updatedAt: Date.now(), cached: false }), { headers: jsonHeaders });
      ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
      return response;
    } catch (error) {
      return new Response(JSON.stringify({ error: `Tidak dapat mengambil feed berita. ${error.message}` }), { status: 502, headers: jsonHeaders });
    }
  },
};
