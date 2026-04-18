# CLAUDE.md — Tennistimes.id Bot
# Read this file first before doing anything else.
# This is your complete project context, build instructions, and deployment guide.

---

## WHO YOU ARE BUILDING FOR

Project: Tennistimes.id WhatsApp AI Bot
Owner: Senz (Ahmad Syahndy), entrepreneur, Jakarta Selatan, Indonesia
Company: TennisTV.id — Indonesian tennis community platform, media brand, tournament organizer
Team: 2–5 internal users
Purpose: Internal productivity bot that responds to commands in a WhatsApp group and delivers real file outputs (PPTX, XLSX, PDF) directly into the chat

---

## WHAT YOU ARE BUILDING

A production-ready Node.js bot that:
1. Receives WhatsApp messages via Twilio webhook
2. Parses commands and calls Claude API to generate content
3. Calls a Python Flask worker to generate real files (PPTX, XLSX, PDF)
4. Sends files and text replies back to WhatsApp via Twilio
5. Automatically pushes live tennis news 3x daily to the group

---

## FULL TECH STACK

| Layer              | Tool                          |
|--------------------|-------------------------------|
| WhatsApp           | Twilio WhatsApp API (sandbox) |
| Bot server         | Node.js + Express.js          |
| AI brain           | Anthropic Claude API (claude-sonnet-4-20250514) |
| File generation    | Python Flask worker           |
| Scheduling         | node-cron                     |
| HTTP calls         | axios                         |
| News               | NewsAPI.org + Google News RSS |
| Memory/storage     | Airtable                      |
| Web search         | Serper.dev                    |
| Node.js hosting    | Railway.app                   |
| Python hosting     | Render.com                    |

---

## ENVIRONMENT VARIABLES

Create a .env file with these variables. Never commit this file to GitHub.

```
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
ANTHROPIC_API_KEY=your_anthropic_api_key
NEWSAPI_KEY=your_newsapi_key
SERPER_API_KEY=your_serper_api_key
AIRTABLE_API_KEY=your_airtable_personal_access_token
AIRTABLE_BASE_ID=your_airtable_base_id
AIRTABLE_NOTES_TABLE=Notes
AIRTABLE_TASKS_TABLE=Tasks
PYTHON_WORKER_URL=https://your-python-worker.onrender.com
GROUP_WHATSAPP_NUMBER=whatsapp:+628xxxxxxxxxx
PORT=3000
```

---

## FILE STRUCTURE TO BUILD

```
tennistimes-bot/
├── CLAUDE.md                  ← this file
├── .env                       ← never commit this
├── .env.example               ← commit this with empty values
├── .gitignore
├── package.json
├── railway.json
├── index.js                   ← main Express server + webhook
├── commands/
│   ├── deck.js                ← /deck → PPTX
│   ├── sheet.js               ← /sheet → XLSX
│   ├── brief.js               ← /brief → PDF
│   ├── post.js                ← /post → caption
│   ├── ask.js                 ← /ask → search + answer
│   ├── note.js                ← /note → save to Airtable
│   └── task.js                ← /task → save task to Airtable
├── scheduler/
│   └── newsFeed.js            ← 3x daily tennis news push
├── utils/
│   ├── claude.js              ← Claude API helper
│   ├── airtable.js            ← Airtable read/write helper
│   ├── serper.js              ← Serper web search helper
│   └── twilio.js              ← Send WhatsApp message helper
└── python-worker/
    ├── app.py                 ← Flask app with 3 file endpoints
    ├── requirements.txt
    └── render.yaml
```

---

## BOT COMMANDS — FULL SPECS

### /deck [brief]
- Call Claude API with the brief
- Claude returns structured JSON with slide titles and content
- Send JSON to Python worker POST /generate-pptx
- Worker returns PPTX file as binary
- Upload file to Twilio media or a public URL
- Send file to WhatsApp via Twilio

### /sheet [brief]
- Call Claude API with the brief
- Claude returns structured JSON with headers, rows, and any formulas
- Send JSON to Python worker POST /generate-xlsx
- Worker returns XLSX file as binary
- Send file to WhatsApp via Twilio

### /brief [topic]
- Call Claude API with the topic
- Claude returns structured report content
- Send to Python worker POST /generate-pdf
- Worker returns PDF file as binary
- Send file to WhatsApp via Twilio

### /post [brief]
- Call Claude API to write an Instagram or TikTok caption
- Detect language from input (EN or ID) and respond in same language
- Reply as text message in WhatsApp

### /ask [question]
- Search Airtable Notes table for relevant saved notes
- Search web via Serper.dev API
- Send both results + question to Claude API
- Reply answer as text in WhatsApp

### /note [text]
- Save to Airtable Notes table with: text, sender name, timestamp
- Reply confirmation in WhatsApp

### /task [text]
- Save to Airtable Tasks table with: task, sender name, timestamp, status: pending
- Reply confirmation in WhatsApp

---

## LIVE TENNIS NEWS FEED — AUTO PUSH

Use node-cron to schedule 3 pushes daily to GROUP_WHATSAPP_NUMBER:

Schedule (all WIB = UTC+7):
- 07:00 WIB → Morning Briefing
- 12:00 WIB → Midday Flash (only send if new articles found since last push)
- 18:00 WIB → Evening Recap

Each push flow:
1. Fetch from NewsAPI: query "tennis", language "en", sortBy "publishedAt", pageSize 5
2. Fetch from Google News RSS: https://news.google.com/rss/search?q=tenis+indonesia&hl=id&gl=ID&ceid=ID:id
3. Merge and deduplicate articles by title
4. Send to Claude API with this prompt:
   "Summarize these tennis news articles into a WhatsApp update for the TennisTV.id team.
   Format: emoji header, bullet points, max 5 items, include source names.
   Keep it short and scannable. End with — Tennistimes.id bot 🎾"
5. Send formatted message to GROUP_WHATSAPP_NUMBER via Twilio

Morning format label: 🎾 PAGI — [date]
Midday format label: ⚡ SIANG FLASH
Evening format label: 🌙 MALAM RECAP

---

## CLAUDE API SYSTEM PROMPT

Use this exact system prompt for ALL Claude API calls:

```
You are Tennistimes.id bot 🎾, the AI production assistant for TennisTV.id 
— Indonesia's tennis community platform, media brand, and tournament organizer 
based in Jakarta.

Your personality: Fast, sharp, no fluff. You speak like a Jakarta startup operator.

Always respond in the same language the user writes in (Bahasa Indonesia or English).
Never over-explain. Output first, context second.
If a command needs more info, ask ONE question only.

Current team: Small core team (2-5 people), early-stage, building community 
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
}
```

---

## PYTHON WORKER — FULL SPECS

File: python-worker/app.py
Host: Render.com (free tier)

Three endpoints:

### POST /generate-pptx
Input: JSON with title and slides array (see schema above)
Process: Use python-pptx to build a PPTX file
- Dark background (black #000000)
- Gold/amber title text (#F5A623)
- White body text
- TennisTV.id branding on each slide footer
Output: Return PPTX file as binary with correct Content-Type header

### POST /generate-xlsx
Input: JSON with title, headers, rows array
Process: Use openpyxl to build XLSX file
- Bold headers with green fill (#1D6A3A)
- White header text
- Auto-sized columns
- TennisTV.id in cell A1 as title
Output: Return XLSX file as binary

### POST /generate-pdf
Input: JSON with title and sections array
Process: Use fpdf2 to build PDF
- Clean professional layout
- TennisTV.id header on first page
- Section headings bold, body text regular
- Page numbers in footer
Output: Return PDF file as binary

requirements.txt:
```
flask==3.0.0
python-pptx==0.6.23
openpyxl==3.1.2
fpdf2==2.7.9
gunicorn==21.2.0
```

render.yaml:
```yaml
services:
  - type: web
    name: tennistimes-python-worker
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: gunicorn app:app
    envVars:
      - key: PYTHON_ENV
        value: production
```

---

## AIRTABLE SETUP

Create two tables in one Airtable base:

Table 1: Notes
Fields: Note (Long text), Sender (Single line), CreatedAt (Date), Tags (Single line)

Table 2: Tasks
Fields: Task (Long text), Sender (Single line), CreatedAt (Date), Status (Single select: pending/done), DueDate (Date)

After creating, find your Base ID:
- Go to airtable.com/api
- Select your base
- Base ID starts with "app..." — copy it into .env as AIRTABLE_BASE_ID

---

## TWILIO WHATSAPP SANDBOX SETUP

Sandbox number: whatsapp:+14155238886
To join sandbox: Anyone on the team must send "join [your-sandbox-keyword]" to +14155238886 on WhatsApp

Webhook URL to set in Twilio console:
- Go to Messaging → Try it out → Send a WhatsApp message
- Set webhook URL to: https://your-railway-app.up.railway.app/webhook
- Method: HTTP POST

---

## DEPLOYMENT ORDER

Follow this exact order:

STEP 1 — Python worker on Render
1. Push python-worker/ folder to a GitHub repo
2. Go to render.com → New Web Service → Connect GitHub repo
3. Render auto-detects render.yaml and deploys
4. Copy the public URL (e.g. https://tennistimes-python-worker.onrender.com)
5. Paste into .env as PYTHON_WORKER_URL

STEP 2 — Node.js bot on Railway
1. Push tennistimes-bot/ root folder to GitHub repo
2. Go to railway.app → New Project → Deploy from GitHub
3. Add all environment variables from .env into Railway dashboard
4. Railway gives you a public URL
5. Paste that URL into Twilio webhook field

STEP 3 — Test
1. Send "join [keyword]" to Twilio sandbox from your WhatsApp
2. Send "/post test caption about tennis tournament in Jakarta"
3. Bot should reply with a caption
4. Send "/note test note saving"
5. Check Airtable — note should appear
6. Send "/sheet budget for 32 player tennis tournament"
7. Bot should send back an XLSX file

---

## BUILD INSTRUCTIONS FOR CLAUDE CODE

Build all files completely and production-ready. No placeholder code.
Start with: package.json → .env.example → .gitignore → index.js → utils/ → commands/ → scheduler/ → railway.json → python-worker/

After building all files:
1. Run: npm install
2. Ask Senz to fill in .env with his API keys
3. Run: node index.js to test locally
4. Then guide deployment to Render (Python) then Railway (Node.js)

If you hit any errors during npm install or node index.js, fix them immediately before moving on.

---

## IMPORTANT NOTES

- Senz has zero coding background. Explain every step in plain language.
- When asking Senz to do something manual (like pasting a URL), be very specific about exactly where to click.
- If a step requires the browser, tell Senz exactly which URL to open and what to look for.
- Always confirm each step worked before moving to the next.
- Language: Senz speaks both English and Bahasa Indonesia. Use English for technical instructions.
- Keep momentum — don't over-explain. Do first, explain after if needed.
