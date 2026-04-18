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
If a command needs more info, ask ONE question only.

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
 * Strips markdown code fences if present before parsing.
 */
async function askClaudeJSON(userMessage, options = {}) {
  const text = await askClaude(userMessage, options);

  // Strip ```json ... ``` or ``` ... ``` fences if Claude wraps the output
  const clean = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  return JSON.parse(clean);
}

module.exports = { askClaude, askClaudeJSON, SYSTEM_PROMPT };
