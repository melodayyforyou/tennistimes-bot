// /brief [topic] — Generate a PDF report via Claude + Python worker
// Claude returns JSON with sections using "body" field (not "content")
const axios = require('axios');
const path  = require('path');
const fs    = require('fs');
const { v4: uuidv4 }    = require('uuid');
const { askClaudeJSON } = require('../utils/claude');
const { sendMedia, sendMessage } = require('../utils/twilio');

/**
 * Flow:
 * 1. Ask Claude for report JSON (system prompt defines schema with "body" field)
 * 2. POST JSON to Python worker → receive PDF binary
 * 3. Save to /uploads, serve at BASE_URL/files/:name
 * 4. Send file via Twilio WhatsApp
 */
async function handleBrief(topic, from, baseUrl) {
  await sendMessage(from, `🎾 Generating report: _"${topic}"_\nLagi diproses... 🔄`);

  // System prompt defines schema: { title, sections[{ heading, body }] }
  const data = await askClaudeJSON(
    `Write a comprehensive brief/report about: "${topic}"\n` +
    `Include 4–6 sections. Start with Executive Summary. End with Recommendations. ` +
    `Write each section as full paragraphs — no markdown, no bullet lists inside body. ` +
    `Context: TennisTV.id — Indonesian tennis community, media brand, tournament organizer.`
  );

  const workerRes = await axios.post(
    `${process.env.PYTHON_WORKER_URL}/generate-pdf`,
    data,
    { responseType: 'arraybuffer', timeout: 60_000 }
  );

  const filename   = `brief_${uuidv4()}.pdf`;
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const filepath = path.join(uploadsDir, filename);
  fs.writeFileSync(filepath, Buffer.from(workerRes.data));

  const fileUrl      = `${baseUrl}/files/${filename}`;
  const sectionCount = data.sections?.length ?? 0;

  await sendMedia(
    from,
    `✅ *${data.title}*\n📄 ${sectionCount} sections — report siap!\n⬇️ Download di bawah`,
    fileUrl
  );

  setTimeout(() => { try { fs.unlinkSync(filepath); } catch (_) {} }, 3_600_000);
}

module.exports = { handleBrief };
