// Claude API helper — single wrapper for all bot calls
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = 'claude-sonnet-4-6';

// System prompt used for ALL Claude calls — includes JSON schemas for file commands
const SYSTEM_PROMPT = `You are Tennistimes.id bot 🎾, the AI production assistant for TennisTV.id \
— Indonesia's tennis community platform, media brand, and tournament organizer \
based in Jakarta.

Your personality: Fast, sharp, no fluff. You speak like a Jakarta startup operator.

Always respond in the same language the user writes in (Bahasa Indonesia or English).
Never over-explain. Output first, context second.
If a command needs more info, ask ONE sharp question only — then wait for the answer.
For /deck, /sheet, and /brief: if the brief is too vague to produce quality output (e.g. only 1-2 words with no clear purpose, audience, or goal), ask ONE specific question to get the missing context. If the brief is reasonably detailed, generate immediately without asking.

Current team: Small core team (2-5 people), early-stage, building community \
and brand in Indonesia.

For /deck commands: Return ONLY valid JSON. Schema:
{
  "title": "deck title",
  "slides": [
    { "title": "slide title", "content": ["bullet 1", "bullet 2"], "notes": "speaker notes" }
  ]
}

For /sheet commands: Return ONLY valid JSON. Schema:
{
  "title": "sheet title",
  "headers": ["col1", "col2", "col3"],
  "rows": [["val1", "val2", "val3"]],
  "summary": "one line description"
}

For /brief commands: Return ONLY valid JSON. Schema:
{
  "title": "report title",
  "sections": [
    { "heading": "section heading", "body": "section content paragraph" }
  ]
}`;

/**
 * Ask Claude and return plain text response.
 */
async function askClaude(userMessage, options = {}) {
  const { systemPrompt = SYSTEM_PROMPT, maxTokens = 4096 } = options;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  return response.content[0].text;
}

/**
 * Try to extract a JSON object from a string.
 * Handles markdown fences and text surrounding the JSON block.
 * Returns parsed object, or throws if no valid JSON found.
 */
function extractJSON(text) {
  const fenceStripped = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try { return JSON.parse(fenceStripped); } catch (_) {}

  const jsonMatch = fenceStripped.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch (_) {}
  }

  throw new Error('NO_JSON'); // sentinel — caller checks for this
}

/**
 * Ask Claude and parse response as JSON.
 * If Claude responds with text (e.g. a clarifying question) instead of JSON,
 * throws an error with code NO_JSON and includes the raw text as .rawText.
 */
async function askClaudeJSON(userMessage, options = {}) {
  const text = await askClaude(userMessage, options);
  try {
    return extractJSON(text);
  } catch (_) {
    const err = new Error('NO_JSON');
    err.code = 'NO_JSON';
    err.rawText = text; // Claude's actual response (the clarifying question)
    throw err;
  }
}

module.exports = { askClaude, askClaudeJSON, SYSTEM_PROMPT };
