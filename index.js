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

// ─── Fonnte webhook ───────────────────────────────────────────────────────────
// Fonnte sends POST with JSON body:
//   sender  — sender's phone number e.g. "6281234567890"
//   message — message text
//   name    — sender's display name
//   device  — your registered Fonnte device number

app.post('/webhook', async (req, res) => {
  // Respond immediately so Fonnte doesn't retry
  res.sendStatus(200);

  const rawBody    = (req.body.message || '').trim();
  const senderRaw  = req.body.sender || '';
  const profileName = req.body.name || senderRaw;

  // Normalise to whatsapp:628xxx so all command files work unchanged
  const from = senderRaw.startsWith('whatsapp:') ? senderRaw : `whatsapp:${senderRaw}`;

  if (!rawBody || !senderRaw) return;

  const lower = rawBody.toLowerCase();
  console.log(`[webhook] ${profileName} (${senderRaw}): ${rawBody.slice(0, 80)}`);

  try {
    if (lower.startsWith('/deck')) {
      const brief = rawBody.slice(5).trim();
      if (!brief) return sendMessage(from, '🎾 Usage: /deck [brief]\nContoh: /deck strategi Q3 TennisTV');
      return handleDeck(brief, from, BASE_URL);
    }

    if (lower.startsWith('/sheet')) {
      const brief = rawBody.slice(6).trim();
      if (!brief) return sendMessage(from, '🎾 Usage: /sheet [brief]\nContoh: /sheet data registrasi Jakarta Open');
      return handleSheet(brief, from, BASE_URL);
    }

    if (lower.startsWith('/brief')) {
      const topic = rawBody.slice(6).trim();
      if (!topic) return sendMessage(from, '🎾 Usage: /brief [topic]\nContoh: /brief perkembangan tenis Indonesia 2025');
      return handleBrief(topic, from, BASE_URL);
    }

    if (lower.startsWith('/post')) {
      const brief = rawBody.slice(5).trim();
      if (!brief) return sendMessage(from, '🎾 Usage: /post [brief]\nContoh: /post highlights final Jakarta Open');
      return handlePost(brief, from);
    }

    if (lower.startsWith('/ask')) {
      const question = rawBody.slice(4).trim();
      if (!question) return sendMessage(from, '🎾 Usage: /ask [pertanyaan]\nContoh: /ask ranking 1 tenis Indonesia?');
      return handleAsk(question, from);
    }

    if (lower.startsWith('/note')) {
      const text = rawBody.slice(5).trim();
      if (!text) return sendMessage(from, '🎾 Usage: /note [text]\nContoh: /note rapat sponsor Selasa 14:00');
      return handleNote(text, from, profileName);
    }

    if (lower.startsWith('/task')) {
      const text = rawBody.slice(5).trim();
      if (!text) return sendMessage(from, '🎾 Usage: /task [description]\nContoh: /task upload konten IG Jakarta Open');
      return handleTask(text, from, profileName);
    }

    if (['hi', 'halo', 'hello', 'hey', '/help', 'start'].includes(lower)) {
      return sendMessage(from,
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
