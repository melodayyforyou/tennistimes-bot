// /post [brief] — Generate Instagram + TikTok captions via Claude
const { askClaude } = require('../utils/claude');
const { sendMessage } = require('../utils/twilio');

/**
 * Detects input language (ID/EN) and generates matching captions for both platforms.
 */
async function handlePost(brief, from) {
  const isID = detectIndonesian(brief);

  const prompt = isID
    ? `Kamu adalah social media manager TennisTV.id. Buat caption untuk Instagram dan TikTok:

Brief: "${brief}"

Format output PERSIS seperti ini:

📸 *INSTAGRAM CAPTION*
[Caption Instagram — 3–5 paragraf pendek, engaging, energetik. Tambahkan minimal 10 hashtag relevan di akhir tentang tenis, Jakarta, sport lifestyle.]

🎬 *TIKTOK CAPTION*
[Caption TikTok — maksimal 150 karakter, hook kuat di awal, 5 hashtag trending.]

Tone: Jakarta startup operator — singkat, hype, credible.`
    : `You are the social media manager for TennisTV.id. Create captions for both platforms:

Brief: "${brief}"

Format output EXACTLY like this:

📸 *INSTAGRAM CAPTION*
[Instagram caption — 3–5 short paragraphs, engaging, energetic. Add minimum 10 relevant hashtags at the end about tennis, Jakarta, sport lifestyle.]

🎬 *TIKTOK CAPTION*
[TikTok caption — max 150 characters, strong hook at start, 5 trending hashtags.]

Tone: Jakarta startup operator — concise, hype, credible.`;

  const caption = await askClaude(prompt);
  await sendMessage(from, caption);
}

/** Heuristic: look for common Indonesian words/particles */
function detectIndonesian(text) {
  return /\b(dan|yang|ini|itu|dengan|untuk|dari|ke|di|ada|adalah|tidak|bisa|juga|sudah|akan|saya|kami|kita|mereka|tapi|atau|jika|kalau|karena|tentang|pada|dalam|lebih|sangat|buat|mau|banget|siap|dong|deh|yuk|yah|gue|gw|lo|nih|woy|sih|udah|belum|lagi|nanti|sama|mana|gimana|kenapa|kapan)\b/i.test(text);
}

module.exports = { handlePost };
