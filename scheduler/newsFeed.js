// 3x daily tennis news push to WhatsApp group
// 07:00 WIB = 00:00 UTC  → 🎾 PAGI — [date]
// 12:00 WIB = 05:00 UTC  → ⚡ SIANG FLASH  (only if new articles)
// 18:00 WIB = 11:00 UTC  → 🌙 MALAM RECAP
require('dotenv').config();
const cron   = require('node-cron');
const axios  = require('axios');
const xml2js = require('xml2js');
const { askClaude }   = require('../utils/claude');
const { sendMessage } = require('../utils/twilio');

// Deduplicate by title across all pushes today; reset at midnight
const sentTitles  = new Set();
let lastResetDate = new Date().toDateString();

function resetDaily() {
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    sentTitles.clear();
    lastResetDate = today;
  }
}

// ─── Fetch sources ────────────────────────────────────────────────────────────

// Keywords that must appear in title or description for article to be considered tennis
const TENNIS_KEYWORDS = [
  'tennis', 'tenis', 'atp', 'wta', 'grand slam', 'wimbledon', 'us open',
  'french open', 'australian open', 'roland garros', 'serve', 'forehand',
  'backhand', 'racket', 'court', 'set ', 'match point', 'tournament',
  'djokovic', 'alcaraz', 'sinner', 'swiatek', 'nadal', 'federer',
];

function isTennisRelevant(article) {
  const text = `${article.title} ${article.description}`.toLowerCase();
  return TENNIS_KEYWORDS.some(kw => text.includes(kw));
}

async function fetchNewsAPI() {
  try {
    const res = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        // More specific query — must include tennis AND a sport-related term
        q: 'tennis AND (player OR tournament OR match OR ATP OR WTA OR Grand Slam OR ranking)',
        language: 'en',
        sortBy: 'publishedAt',
        pageSize: 15,  // Fetch more so we have enough after filtering
        apiKey: process.env.NEWSAPI_KEY,
      },
      timeout: 10_000,
    });
    const articles = (res.data.articles || []).map((a) => ({
      title: a.title || '',
      description: a.description || '',
      source: a.source?.name || 'NewsAPI',
    }));
    // Keep only articles that are genuinely tennis-related
    return articles.filter(isTennisRelevant);
  } catch (err) {
    console.error('[newsFeed] NewsAPI error:', err.message);
    return [];
  }
}

async function fetchGoogleNewsRSS() {
  try {
    const rssUrl = 'https://news.google.com/rss/search?q=tenis+indonesia&hl=id&gl=ID&ceid=ID:id';
    const res = await axios.get(rssUrl, { timeout: 10_000 });
    const parsed = await new xml2js.Parser().parseStringPromise(res.data);
    const items = parsed?.rss?.channel?.[0]?.item || [];
    return items.slice(0, 10).map((item) => ({
      title: (item.title?.[0] || '').replace(/<[^>]*>/g, '').trim(),
      description: (item.description?.[0] || '').replace(/<[^>]*>/g, '').trim(),
      source: 'Google News',
    }));
  } catch (err) {
    console.error('[newsFeed] Google News RSS error:', err.message);
    return [];
  }
}

// ─── Push function ────────────────────────────────────────────────────────────

async function pushNewsFeed(session) {
  resetDaily();

  const groupNumber = process.env.GROUP_WHATSAPP_NUMBER;
  if (!groupNumber) {
    console.warn('[newsFeed] GROUP_WHATSAPP_NUMBER not set — skipping');
    return;
  }

  const [apiArticles, rssArticles] = await Promise.all([fetchNewsAPI(), fetchGoogleNewsRSS()]);

  // Merge and deduplicate by title (case-insensitive, normalised)
  const newArticles = [];
  for (const article of [...apiArticles, ...rssArticles]) {
    if (!article.title) continue;
    const key = article.title.toLowerCase().replace(/\s+/g, ' ').trim();
    if (sentTitles.has(key)) continue;
    sentTitles.add(key);
    newArticles.push(article);
  }

  // Midday: only push if there are new articles since morning
  if (session === 'midday' && newArticles.length === 0) {
    console.log('[newsFeed] No new articles for midday — skipping');
    return;
  }

  if (newArticles.length === 0) {
    // Manual trigger: still push even if all articles were seen before
    if (session === 'manual') {
      const fallback = [...apiArticles, ...rssArticles].slice(0, 5);
      if (fallback.length === 0) {
        console.log('[newsFeed] No articles found at all — skipping');
        return;
      }
      fallback.forEach(a => newArticles.push(a));
    } else {
      console.log('[newsFeed] No articles found — skipping');
      return;
    }
  }

  const articleList = newArticles
    .slice(0, 5)
    .map((a, i) => `${i + 1}. [${a.source}] ${a.title}${a.description ? '\n   ' + a.description : ''}`)
    .join('\n\n');

  // Format label as specified in CLAUDE.md
  const today = new Date().toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const label = {
    morning: `🎾 PAGI — ${today}`,
    midday:  `⚡ SIANG FLASH`,
    evening: `🌙 MALAM RECAP`,
    manual:  `📡 TENNIS UPDATE — ${today}`,
  }[session] || `📡 TENNIS UPDATE — ${today}`;

  const prompt =
    `Summarize these tennis news articles into a WhatsApp update for the TennisTV.id team.\n` +
    `Format: emoji header, bullet points, max 5 items, include source names.\n` +
    `Keep it short and scannable. End with — Tennistimes.id bot 🎾\n\n` +
    `IMPORTANT: Only include articles that are directly about tennis (players, tournaments, matches, rankings).\n` +
    `Skip anything that is not tennis — even if the word "tennis" appears in passing.\n\n` +
    `Header label to use: ${label}\n\n` +
    `Articles:\n${articleList}`;

  const summary = await askClaude(prompt);
  await sendMessage(groupNumber, summary);
  console.log(`[newsFeed] ${session} push sent (${newArticles.length} new articles)`);
}

// ─── Cron registration (all times UTC — Railway runs UTC) ─────────────────────

function startScheduler() {
  cron.schedule('0 0 * * *',  () => pushNewsFeed('morning'), { timezone: 'UTC' }); // 07:00 WIB
  cron.schedule('0 5 * * *',  () => pushNewsFeed('midday'),  { timezone: 'UTC' }); // 12:00 WIB
  cron.schedule('0 11 * * *', () => pushNewsFeed('evening'), { timezone: 'UTC' }); // 18:00 WIB
  console.log('[scheduler] Cron jobs set: 07:00, 12:00, 18:00 WIB');
}

module.exports = { startScheduler, pushNewsFeed };
