// /ask [question] — Answer using Airtable notes + Serper web search + Claude
const { askClaude }   = require('../utils/claude');
const { searchNotes } = require('../utils/airtable');
const { webSearch }   = require('../utils/serper');
const { sendMessage } = require('../utils/twilio');

/**
 * Flow:
 * 1. Parallel search: Airtable notes + Serper web
 * 2. Combine context + question → Claude
 * 3. Reply to WhatsApp
 */
async function handleAsk(question, from) {
  const [notesResult, webResult] = await Promise.allSettled([
    searchNotes(question),
    webSearch(question, 5),
  ]);

  const notes      = notesResult.status === 'fulfilled' ? notesResult.value : [];
  const webResults = webResult.status  === 'fulfilled' ? webResult.value  : [];

  let context = '';

  if (notes.length > 0) {
    context += '=== Internal Team Notes ===\n';
    context += notes.map((n) => `• [${n.createdAt?.slice(0, 10)}] ${n.sender}: ${n.note}`).join('\n');
    context += '\n\n';
  }

  if (webResults.length > 0) {
    context += '=== Web Search Results ===\n';
    context += webResults.map((r) => `• ${r.title}\n  ${r.snippet}\n  ${r.link}`).join('\n\n');
    context += '\n\n';
  }

  const prompt = context
    ? `Answer this question: "${question}"\n\nContext:\n${context}\nLead with the direct answer. Cite the source if relevant. Match the language of the question. Max 250 words.`
    : `Answer this question: "${question}"\nLead with the direct answer. Match the language of the question. Max 200 words.`;

  const answer = await askClaude(prompt);
  await sendMessage(from, answer);
}

module.exports = { handleAsk };
