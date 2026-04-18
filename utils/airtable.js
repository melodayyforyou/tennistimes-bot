// Airtable helper — read/write Notes and Tasks tables
// Table: Notes   → fields: Note, Sender, CreatedAt, Tags
// Table: Tasks   → fields: Task, Sender, CreatedAt, Status, DueDate
require('dotenv').config();
const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);

const NOTES_TABLE = process.env.AIRTABLE_NOTES_TABLE || 'Notes';
const TASKS_TABLE = process.env.AIRTABLE_TASKS_TABLE || 'Tasks';

/**
 * Save a note. Returns the new Airtable record ID.
 */
async function saveNote(text, senderName, senderNumber) {
  const record = await base(NOTES_TABLE).create({
    Note: text,
    Sender: senderName || senderNumber,
    CreatedAt: new Date().toISOString(),
  });
  return record.id;
}

/**
 * Save a task with status: pending. Returns the new record ID.
 */
async function saveTask(text, senderName, senderNumber) {
  const record = await base(TASKS_TABLE).create({
    Task: text,
    Sender: senderName || senderNumber,
    CreatedAt: new Date().toISOString(),
    Status: 'pending',
  });
  return record.id;
}

/**
 * Search Notes by text. Returns up to 5 most recent matches.
 */
async function searchNotes(query) {
  const safeQuery = query.replace(/"/g, '\\"');

  const records = await base(NOTES_TABLE)
    .select({
      filterByFormula: `SEARCH(LOWER("${safeQuery}"), LOWER({Note}))`,
      maxRecords: 5,
      sort: [{ field: 'CreatedAt', direction: 'desc' }],
    })
    .firstPage();

  return records.map((r) => ({
    id: r.id,
    note: r.fields.Note || '',
    sender: r.fields.Sender || '',
    createdAt: r.fields.CreatedAt || '',
  }));
}

module.exports = { saveNote, saveTask, searchNotes };
