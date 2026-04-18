// /deck [brief] — Generate a PowerPoint via Claude + Python worker
const axios = require('axios');
const path  = require('path');
const fs    = require('fs');
const { v4: uuidv4 }    = require('uuid');
const { askClaudeJSON } = require('../utils/claude');
const { sendMedia, sendMessage } = require('../utils/twilio');

/**
 * Flow:
 * 1. Ask Claude for slide JSON (system prompt defines the exact schema)
 * 2. POST JSON to Python worker → receive PPTX binary
 * 3. Save to /uploads, expose at BASE_URL/files/:name
 * 4. Send file via Twilio WhatsApp
 */
async function handleDeck(brief, from, baseUrl) {
  await sendMessage(from, `🎾 Generating deck: _"${brief}"_\nLagi diproses... 🔄`);

  // The system prompt already specifies the JSON schema — just describe the deck
  const data = await askClaudeJSON(
    `Create a professional presentation deck for: "${brief}"\n` +
    `Make 6–8 slides. First slide is title only. Last slide is CTA/summary. ` +
    `Context: TennisTV.id — Indonesian tennis community brand.`
  );

  const workerRes = await axios.post(
    `${process.env.PYTHON_WORKER_URL}/generate-pptx`,
    data,
    { responseType: 'arraybuffer', timeout: 60_000 }
  );

  const filename   = `deck_${uuidv4()}.pptx`;
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const filepath = path.join(uploadsDir, filename);
  fs.writeFileSync(filepath, Buffer.from(workerRes.data));

  const fileUrl    = `${baseUrl}/files/${filename}`;
  const slideCount = data.slides?.length ?? 0;

  await sendMedia(
    from,
    `✅ *${data.title}*\n📊 ${slideCount} slides — deck siap!\n⬇️ Download di bawah`,
    fileUrl
  );

  // Clean up after 1 hour — Twilio fetches the file within seconds of delivery
  setTimeout(() => { try { fs.unlinkSync(filepath); } catch (_) {} }, 3_600_000);
}

module.exports = { handleDeck };
