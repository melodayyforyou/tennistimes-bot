// /sheet [brief] — Generate an Excel spreadsheet via Claude + Python worker
// Claude returns flat JSON: { title, headers, rows, summary }
const axios = require('axios');
const path  = require('path');
const fs    = require('fs');
const { v4: uuidv4 }    = require('uuid');
const { askClaudeJSON } = require('../utils/claude');
const { sendMedia, sendMessage } = require('../utils/twilio');

/**
 * Flow:
 * 1. Ask Claude for spreadsheet JSON (flat schema from system prompt)
 * 2. POST JSON to Python worker → receive XLSX binary
 * 3. Save to /uploads, serve at BASE_URL/files/:name
 * 4. Send file via Twilio WhatsApp
 */
async function handleSheet(brief, from, baseUrl) {
  let data;
  try {
    data = await askClaudeJSON(
      `Create a spreadsheet for: "${brief}"\n` +
      `Include relevant column headers and 5–10 realistic sample data rows. ` +
      `Use numbers (not strings) for numeric columns. ` +
      `Context: TennisTV.id operations — tournaments, registrations, media, sponsors.`
    );
  } catch (err) {
    if (err.code === 'NO_JSON') {
      await sendMessage(from, err.rawText);
      return { pending: true, command: 'sheet', brief };
    }
    throw err;
  }

  await sendMessage(from, `🎾 Generating spreadsheet: _"${brief}"_\nLagi diproses... 🔄`);

  const workerRes = await axios.post(
    `${process.env.PYTHON_WORKER_URL}/generate-xlsx`,
    data,
    { responseType: 'arraybuffer', timeout: 60_000 }
  );

  const filename   = `sheet_${uuidv4()}.xlsx`;
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const filepath = path.join(uploadsDir, filename);
  fs.writeFileSync(filepath, Buffer.from(workerRes.data));

  const fileUrl  = `${baseUrl}/files/${filename}`;
  const rowCount = data.rows?.length ?? 0;

  await sendMedia(
    from,
    `✅ *${data.title}*\n📊 ${rowCount} rows — spreadsheet siap!\n⬇️ Download di bawah`,
    fileUrl
  );

  setTimeout(() => { try { fs.unlinkSync(filepath); } catch (_) {} }, 3_600_000);
}

module.exports = { handleSheet };
