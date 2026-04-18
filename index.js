// Tennistimes.id WhatsApp Bot — Main Express server
// Receives messages via Fonnte webhook, routes to command handlers
require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');

const { handleDeck }  = require('./commands/deck');
const { handleSheet } = require('./commands/sheet');
const { handleBrief } = require('./commands/brief');
const { handlePost }  = require('./commands/post');
const { handleAsk }   = require('./commands/ask');
const { handleNote }  = require('./commands/note');
const { handleTask }  = require('./commands/task');
const { sendMessage } = require('./utils/twilio');
const { startScheduler } = require('./scheduler/newsFeed');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// ─── File serving ─────────────────────────────────────────────────────────────

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Serve generated PPTX/XLSX/PDF at /files/:filename so Fonnte can fetch them
app.get('/files/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filepath = path.join(uploadsDir, filename);
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'File not found or already cleaned up' });
  }
  res.sendFile(filepath);
});

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/', (_req, res) => {
  res.json({ status: 'ok', bot: 'Tennistimes.id 🎾', time: new Date().toISOString() });
});

// ─── Debug: test Fonnte send from Railway ─────────────────────────────────────
// Call: GET /debug-send?to=628xxxxxx
app.get('/debug-send', async (req, res) => {
  const to = req.query.to || '62811663161';
  try {
    await sendMessage(`whatsapp:${to}`, '🔧 Debug: Railway → Fonnte send works!');
    res.json({ status: 'sent', to });
  } catch (err) {
    res.json({ status: 'error', error: err.message });
  }
});

// ─── Debug: log last webhook payload ─────────────────────────────────────────
let lastWebhookPayload = null;
app.get('/debug-webhook', (_req, res) => {
  res.json({ lastPayload: lastWebhookPayload, time: new Date().toISOString() });
});

// ─── Fonnte webhook ───────────────────────────────────────────────────────────
// Fonnte verifies the URL with GET first, then sends messages via POST.
// Payload fields: sender, message, name, device

// GET /webhook — URL verification (Fonnte pings this to confirm the URL is alive)
app.get('/webhook', (_req, res) => res.sendStatus(200));

app.post('/webhook', async (req, res) => {
  // Respond immediately so Fonnte doesn't retry
  res.sendStatus(200);

  // Store full payload for debugging
  lastWebhookPayload = { body: req.body, time: new Date().toISOString() };
  console.log('[webhook] Received:', JSON.stringify(req.body));


  const rawBody     = (req.body.message || req.body.text || '').trim();
  const isGroup     = req.body.isgroup === true || req.body.isgroup === 'true';
  const profileName = req.body.name || req.body.sender || '';

  // In a group: sender = group ID, member = person who typed
  // In private: sender = the person's number
  const senderRaw = isGroup
    ? (req.body.sender || '').replace(/@[cgs]\.us$/i, '')   // group ID → reply to group
    : (req.body.sender || req.body.from || '').replace(/@[cgs]\.us$/i, '');

  // Normalise to whatsapp:628xxx or whatsapp:groupID
  const from = senderRaw.startsWith('whatsapp:') ? senderRaw : `whatsapp:${senderRaw}`;

  if (!rawBody || !senderRaw) return;

  // In groups, only respond to messages that start with / — ignore casual chat
  if (isGroup && !rawBody.startsWith('/')) return;

  const lower = rawBody.toLowerCase();
  console.log(`[webhook] ${isGroup ? 'GROUP' : 'DM'} ${profileName}: ${rawBody.slice(0, 80)}`);

  try {
    if (lower.startsWith('/deck')) {
      const brief = rawBody.slice(5).trim();
      if (!brief) return await sendMessage(from, '🎾 Usage: /deck [brief]\nContoh: /deck strategi Q3 TennisTV');
      return await handleDeck(brief, from, BASE_URL);
    }

    if (lower.startsWith('/sheet')) {
      const brief = rawBody.slice(6).trim();
      if (!brief) return await sendMessage(from, '🎾 Usage: /sheet [brief]\nContoh: /sheet data registrasi Jakarta Open');
      return await handleSheet(brief, from, BASE_URL);
    }

    if (lower.startsWith('/brief')) {
      const topic = rawBody.slice(6).trim();
      if (!topic) return await sendMessage(from, '🎾 Usage: /brief [topic]\nContoh: /brief perkembangan tenis Indonesia 2025');
      return await handleBrief(topic, from, BASE_URL);
    }

    if (lower.startsWith('/post')) {
      const brief = rawBody.slice(5).trim();
      if (!brief) return await sendMessage(from, '🎾 Usage: /post [brief]\nContoh: /post highlights final Jakarta Open');
      return await handlePost(brief, from);
    }

    if (lower.startsWith('/ask')) {
      const question = rawBody.slice(4).trim();
      if (!question) return await sendMessage(from, '🎾 Usage: /ask [pertanyaan]\nContoh: /ask ranking 1 tenis Indonesia?');
      return await handleAsk(question, from);
    }

    if (lower.startsWith('/note')) {
      const text = rawBody.slice(5).trim();
      if (!text) return await sendMessage(from, '🎾 Usage: /note [text]\nContoh: /note rapat sponsor Selasa 14:00');
      return await handleNote(text, from, profileName);
    }

    if (lower.startsWith('/task')) {
      const text = rawBody.slice(5).trim();
      if (!text) return await sendMessage(from, '🎾 Usage: /task [description]\nContoh: /task upload konten IG Jakarta Open');
      return await handleTask(text, from, profileName);
    }

    if (['hi', 'halo', 'hello', 'hey', '/help', 'start'].includes(lower)) {
      return await sendMessage(from,
        `🎾 *Tennistimes.id Bot*\n` +
        `TennisTV.id Production Assistant\n\n` +
        `*File Generator:*\n` +
        `/deck [brief] — presentasi PPTX\n` +
        `/sheet [brief] — spreadsheet XLSX\n` +
        `/brief [topic] — report PDF\n\n` +
        `*Content & Search:*\n` +
        `/post [brief] — caption IG + TikTok\n` +
        `/ask [question] — tanya + web search\n\n` +
        `*Productivity:*\n` +
        `/note [text] — simpan catatan\n` +
        `/task [text] — buat task\n\n` +
        `Auto-push berita tenis 3x/hari ke grup 🎾`
      );
    }

  } catch (err) {
    console.error(`[webhook] Error:`, err.message);
    try { await sendMessage(from, `⚠️ Error: ${err.message || 'Something went wrong. Coba lagi.'}`); } catch (_) {}
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🎾 Tennistimes.id bot running on port ${PORT}`);
  console.log(`📡 Webhook: ${BASE_URL}/webhook`);
  startScheduler();
});
