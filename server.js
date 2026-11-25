// Local PRATAMA NEWS server. Uses the Bing News RSS search feed.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 4173);
const categories = {
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
const sentimentWords = {
  positive: ['rally','surge','surges','gain','gains','rose','rises','rise','beat','beats','profit','profits','growth','rebound','recovery','reclaims','booming','record high','upgrade','upgraded','inflow','inflows','approval','menguat','naik','laba','untung','tumbuh','pulih','positif','surplus','menguatkan'],
  negative: ['crash','crashes','plunge','plunges','slump','slumps','drop','drops','decline','declines','fell','falls','fall','loss','losses','cut','cuts','layoff','layoffs','bankrupt','bankruptcy','weak','weaker','weakness','downgrade','outflow','outflows','sell-off','crisis','hack','fraud','shrink','shrinks','shrinking','downside','below','weighs','fizzles','retreat','retreats','slides','slipped','bearish','cautious','recession','turun','melemah','anjlok','rugi','kerugian','penurunan','phk','defisit','gagal','tertekan','koreksi','lesu','kebocoran'],
};
const cache = new Map();
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };

function decodeXml(s = '') {
  return s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}
function tag(block, name) {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i');
  return decodeXml(block.match(re)?.[1]?.trim() || '');
}
function plainText(html = '') {
  return decodeXml(html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')).trim();
}
async function readFeed(search) {
  const url = new URL('https://www.bing.com/news/search');
  url.searchParams.set('q', search);
  url.searchParams.set('format', 'rss');
  url.searchParams.set('mkt', 'id-ID');
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PRATAMA-NEWS/1.0)', 'Accept': 'application/rss+xml, application/xml, text/xml' }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`Sumber berita merespons HTTP ${response.status}`);
  const xml = await response.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(([_, block]) => {
    const titleAndSource = tag(block, 'title');
    const source = tag(block, 'News:Source') || tag(block, 'source');
    const cleanTitle = source && titleAndSource.endsWith(` - ${source}`) ? titleAndSource.slice(0, -source.length - 3) : titleAndSource;
    const publishedAt = new Date(tag(block, 'pubDate') || 0);
    const wrappedLink = tag(block, 'link');
    let link = wrappedLink;
    try {
      const redirect = new URL(wrappedLink);
      const target = redirect.searchParams.get('url');
      if (target && ['http:', 'https:'].includes(new URL(target).protocol)) link = target;
    } catch { /* Keep the feed link if its publisher target cannot be unwrapped. */ }
    const image = tag(block, 'News:Image').replace(/^http:\/\//i, 'https://');
    return {
      title: cleanTitle,
      source: source || 'Bing News',
      link,
      publishedAt: Number.isNaN(publishedAt.getTime()) ? new Date(0).toISOString() : publishedAt.toISOString(),
      description: plainText(tag(block, 'description')),
      image,
    };
  }).filter(a => a.title && a.link && Date.now() - new Date(a.publishedAt).getTime() <= 30 * 86400000);
}
function analyzeArticle(article) {
  const title = article.title.toLowerCase();
  const description = article.description.toLowerCase();
  const termsIn = text => {
    const tokens = new Set(text.split(/[^\p{L}\p{N}]+/u));
    return word => word.includes(' ') || word.includes('-') ? text.includes(word) : tokens.has(word);
  };
  const positiveTitle = sentimentWords.positive.filter(termsIn(title));
  const negativeTitle = sentimentWords.negative.filter(termsIn(title));
  const positiveDescription = sentimentWords.positive.filter(termsIn(description));
  const negativeDescription = sentimentWords.negative.filter(termsIn(description));
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
  return { mood, evidence: [...positive.slice(0, 3), ...negative.slice(0, 3)], companyImpact, marketImpact };
}
async function getArticles(q, category) {
  let articles;
  if (category === 'Semua' && !q) {
    const topics = Object.entries(categories).filter(([label]) => label !== 'Semua');
    const feeds = await Promise.all(topics.flatMap(([label, queries]) => queries.map(async terms => ({ label, articles: await readFeed(terms).catch(() => []) }))));
    articles = feeds.flatMap(feed => feed.articles.map(article => ({ ...article, category: feed.label })));
  } else {
    const queries = category === 'Semua' ? [q] : categories[category];
    const feeds = await Promise.all(queries.map(async terms => readFeed((category === 'Semua' ? [terms] : [q, terms]).filter(Boolean).join(' ').slice(0, 220)).catch(() => [])));
    articles = feeds.flatMap(feed => feed.map(article => ({ ...article, category: category === 'Semua' ? 'Pasar' : category })));
  }
  const seen = new Set();
  articles = articles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)).filter(article => {
    const key = article.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const perCategory = new Map();
  articles = articles.filter(article => {
    const count = perCategory.get(article.category) || 0;
    const limit = category === 'Semua' && !q ? 10 : 50;
    if (count >= limit) return false;
    perCategory.set(article.category, count + 1);
    return true;
  }).slice(0, 50).map(article => ({ ...article, analysis: analyzeArticle(article) }));
  return articles;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api/news') {
    const q = (url.searchParams.get('q') || '').trim().slice(0, 120);
    const category = categories[url.searchParams.get('category')] !== undefined ? url.searchParams.get('category') : 'Semua';
    const key = `${category}\n${q.toLowerCase()}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.time < 60000) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify({ articles: cached.articles, updatedAt: cached.time, cached: true }));
    }
    try {
      const articles = await getArticles(q, category);
      cache.set(key, { articles, time: Date.now() });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify({ articles, updatedAt: Date.now(), cached: false }));
    } catch (error) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify({ error: `Tidak dapat mengambil feed berita. ${error.message}` }));
    }
  }
  const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const file = path.resolve(ROOT, `.${pathname}`);
  if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Tidak ditemukan');
  }
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
  fs.createReadStream(file).pipe(res);
});

let activePort = PORT;
server.once('listening', () => {
  console.log(`PRATAMA NEWS berjalan di http://127.0.0.1:${activePort}`);
  console.log('Buka alamat di atas di browser. Biarkan jendela ini tetap terbuka.');
});
function listen(port) {
  server.once('error', error => {
    if (error.code === 'EADDRINUSE' && port < PORT + 20) {
      console.log(`Port ${port} sedang dipakai; mencoba port ${port + 1}…`);
      return listen(port + 1);
    }
    console.error(`Server tidak dapat dimulai: ${error.message}`);
    process.exitCode = 1;
  });
  activePort = port;
  server.listen(port, '127.0.0.1');
}
listen(PORT);
