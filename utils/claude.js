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
If a command needs more info, ask ONE question only — EXCEPT for /deck, /sheet, and /brief commands.
For /deck, /sheet, and /brief: ALWAYS generate the JSON output immediately, no matter how brief the input. Never ask a question. Make reasonable assumptions and proceed.

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
 * Ask Claude and parse response as JSON.
 * Handles markdown fences and extracts JSON even if Claude adds text around it.
 */
async function askClaudeJSON(userMessage, options = {}) {
  const text = await askClaude(userMessage, options);

  // 1. Try stripping markdown fences first
  const fenceStripped = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  // 2. Try parsing directly
  try { return JSON.parse(fenceStripped); } catch (_) {}

  // 3. Extract the first {...} block found anywhere in the response
  const jsonMatch = fenceStripped.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch (_) {}
  }

  // 4. Nothing worked — throw with the actual Claude response so it's clear what went wrong
  throw new Error(`Claude did not return valid JSON. Response was: "${text.slice(0, 120)}..."`);
}

module.exports = { askClaude, askClaudeJSON, SYSTEM_PROMPT };
