// WhatsApp messaging via Fonnte API
// Fonnte uses a team member's WhatsApp number as the bot sender.
// Function names kept the same (sendMessage/sendMedia) so all command files work unchanged.
require('dotenv').config();
const axios = require('axios');

const FONNTE_URL = 'https://api.fonnte.com/send';

function getHeaders() {
  return { Authorization: process.env.FONNTE_TOKEN };
}

/** Strip whatsapp: prefix and leading + so Fonnte gets 628xxx or 120363xxx@g.us */
function cleanTarget(number) {
  return number.replace('whatsapp:', '').replace(/^\+/, '');
}

/**
 * Send a plain text WhatsApp message via Fonnte.
 * @param {string} to - phone number (any format)
 * @param {string} body - message text
 */
async function sendMessage(to, body) {
  const target = cleanTarget(to);
  await axios.post(FONNTE_URL, { target, message: body }, { headers: getHeaders() });
}

/**
 * Send a WhatsApp message with a file attachment via Fonnte.
 * Fonnte fetches the file from mediaUrl and delivers it.
 * @param {string} to - phone number or group ID
 * @param {string} body - caption text
 * @param {string} mediaUrl - public HTTPS URL of the file
 */
async function sendMedia(to, body, mediaUrl) {
  const target = cleanTarget(to);
  await axios.post(
    FONNTE_URL,
    { target, message: body, url: mediaUrl },
    { headers: getHeaders() }
  );
}

module.exports = { sendMessage, sendMedia };
