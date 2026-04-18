// /news — manually trigger a news push on demand
const { pushNewsFeed } = require('../scheduler/newsFeed');
const { sendMessage }  = require('../utils/twilio');

/**
 * Handles the /news command.
 * Fetches and pushes the latest tennis news immediately.
 * Sends to the GROUP_WHATSAPP_NUMBER, not back to the individual sender.
 */
async function handleNews(from) {
  await sendMessage(from, '🎾 Fetching latest tennis news... sebentar ya!');
  await pushNewsFeed('manual');
}

module.exports = { handleNews };
