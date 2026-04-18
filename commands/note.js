// /note [text] — Save a note to Airtable and confirm
const { saveNote }    = require('../utils/airtable');
const { sendMessage } = require('../utils/twilio');

async function handleNote(text, from, profileName) {
  const senderNumber = from.replace('whatsapp:', '');
  const recordId = await saveNote(text, profileName, senderNumber);

  const timestamp = new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  await sendMessage(
    from,
    `✅ *Note saved!*\n\n📝 "${text}"\n\n👤 ${profileName}\n📅 ${timestamp} WIB\n🆔 \`${recordId}\``
  );
}

module.exports = { handleNote };
