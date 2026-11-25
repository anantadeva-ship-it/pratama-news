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
  const marketName = {
    'Saham AS': 'pasar Amerika Serikat',
    'Saham Indonesia': 'pasar Indonesia',
    Crypto: 'pasar kripto global dan investor di negara terkait',
    Emas: 'pasar emas global dan negara produsen atau pengguna emas',
    USD: 'pasar valas pada negara dan mata uang yang disebut dalam berita',
  }[article.category] || 'pasar negara terkait';
  const companyImpact = {
    positive: 'Nada positif dapat mendukung sentimen investor terhadap perusahaan yang diberitakan. Dampak pada laba atau valuasi bergantung pada apakah berita ini menyangkut kinerja, kontrak, atau hanya pergerakan harga.',
    negative: 'Nada negatif dapat menekan sentimen investor terhadap perusahaan yang diberitakan. Dampak operasional dan keuangan perlu dilihat dari isi lengkap berita serta laporan perusahaan.',
    mixed: 'Berita memuat sinyal yang beragam; dampak pada perusahaan bergantung pada faktor mana yang lebih kuat dan berapa lama pengaruhnya.',
    neutral: 'Judul dan ringkasan belum menunjukkan arah yang jelas untuk perusahaan. Baca isi lengkap untuk mengetahui dampak spesifiknya.',
  }[mood];
  const marketImpact = {
    positive: `Jika kabar ini mencerminkan perbaikan fundamental, sentimen dapat mendukung ${marketName}; pengaruh luasnya bergantung pada skala dan banyaknya aset yang terdampak.`,
    negative: `Jika kabar ini mencerminkan pelemahan fundamental, sentimen dapat menekan ${marketName} atau meningkatkan kehati-hatian investor; dampak nasional bergantung pada skala peristiwanya.`,
    mixed: `Sinyal yang beragam dapat menambah volatilitas di ${marketName}; arah pasar belum dapat disimpulkan dari ringkasan saja.`,
    neutral: `Belum terlihat arah dampak yang jelas pada ${marketName} dari judul dan ringkasan yang tersedia.`,
  }[mood];
  return { mood, evidence: [...positive, ...negative].slice(0, 6), companyImpact, marketImpact };
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
    if (request.method !== 'GET' || url.pathname !== '/api/news') return new Response('Not found', { status: 404, headers: jsonHeaders });
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
