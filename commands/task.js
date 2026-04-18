// /task [text] — Create a task in Airtable (status: pending) and confirm
const { saveTask }    = require('../utils/airtable');
const { sendMessage } = require('../utils/twilio');

async function handleTask(text, from, profileName) {
  const senderNumber = from.replace('whatsapp:', '');
  const recordId = await saveTask(text, profileName, senderNumber);

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
    `✅ *Task created!*\n\n📋 "${text}"\n\n👤 ${profileName}\n📅 ${timestamp} WIB\n🔵 Status: *pending*\n🆔 \`${recordId}\``
  );
}

module.exports = { handleTask };
