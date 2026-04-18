// Serper.dev web search helper
require('dotenv').config();
const axios = require('axios');

/**
 * Search the web via Serper.dev Google Search API.
 * Returns an array of { title, snippet, link }.
 */
async function webSearch(query, numResults = 5) {
  const response = await axios.post(
    'https://google.serper.dev/search',
    { q: query, num: numResults, gl: 'id', hl: 'id' },
    {
      headers: {
        'X-API-KEY': process.env.SERPER_API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 10_000,
    }
  );

  return (response.data.organic || []).map((r) => ({
    title: r.title || '',
    snippet: r.snippet || '',
    link: r.link || '',
  }));
}

module.exports = { webSearch };
