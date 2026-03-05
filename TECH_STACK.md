# TECH_STACK.md — Technology Stack
# Paper Pilot

**Rule: Never deviate from these versions without updating this document first.**

---

## Frontend

| Package | Version | Purpose |
|---------|---------|---------|
| react | 18.2.0 | UI framework |
| react-dom | 18.2.0 | DOM rendering |
| vite | 5.1.0 | Build tool and dev server |
| tailwindcss | 3.4.1 | Utility-first CSS |
| autoprefixer | 10.4.17 | CSS vendor prefixes |
| postcss | 8.4.35 | CSS processing |
| react-pdf | 7.7.0 | Render PDF in browser |
| pdfjs-dist | 3.11.174 | PDF.js worker (peer dep of react-pdf) |

---

## Backend

| Package | Version | Purpose |
|---------|---------|---------|
| express | 4.18.2 | HTTP server |
| multer | 1.4.5-lts.1 | Handle file uploads |
| pdf-parse | 1.1.1 | Extract text from PDF |
| @anthropic-ai/sdk | 0.20.1 | Claude API client |
| cors | 2.8.5 | Allow frontend to call backend |
| dotenv | 16.4.1 | Load environment variables |

---

## APIs

| Service | Usage | Auth Method |
|---------|-------|-------------|
| Anthropic Claude API | All AI features (analysis, chat, translation) | API key in `.env` |

**Model**: `claude-sonnet-4-6` (always use this exact string)  
**Max tokens**: 4096 for analysis, 2048 for chat responses

---

## Infrastructure

| Tool | Usage |
|------|-------|
| Vercel | Frontend deployment (free tier) |
| Vercel Serverless Functions | Backend API routes (alternative to Express if needed) |
| localStorage | Notes persistence (browser-side only, no server) |

---

## Project Structure

```
paper-pilot/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── PDFViewer.jsx        # Left panel PDF renderer
│   │   │   ├── AIPanel.jsx          # Right panel container
│   │   │   ├── TabOverview.jsx      # Paper Overview tab
│   │   │   ├── TabArguments.jsx     # Key Arguments tab
│   │   │   ├── TabFigures.jsx       # Figures & Charts tab
│   │   │   ├── TabChat.jsx          # AI Chat tab
│   │   │   ├── NotesArea.jsx        # Collapsible notes
│   │   │   ├── ResizableDivider.jsx # Drag to resize panels
│   │   │   └── UploadZone.jsx       # Landing upload area
│   │   ├── App.jsx                  # Root component, state management
│   │   ├── main.jsx                 # Entry point
│   │   └── index.css                # Tailwind imports
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
├── backend/
│   ├── server.js                    # Express entry point
│   ├── routes/
│   │   ├── analyze.js               # POST /api/analyze
│   │   ├── chat.js                  # POST /api/chat
│   │   └── translate.js             # POST /api/translate
│   ├── utils/
│   │   └── extractText.js           # PDF text extraction logic
│   └── package.json
├── .env                             # API keys (never commit)
├── .env.example                     # Template (safe to commit)
├── CLAUDE.md
├── PRD.md
├── APP_FLOW.md
├── TECH_STACK.md
├── FRONTEND_GUIDELINES.md
├── BACKEND_STRUCTURE.md
├── IMPLEMENTATION_PLAN.md
└── progress.txt
```

---

## Environment Variables

```bash
# .env (never commit this file)
ANTHROPIC_API_KEY=your_key_here
PORT=3001
```

---

## Key Technical Constraints

1. **PDF text extraction happens on the backend** — never send raw PDF binary to Claude API directly
2. **react-pdf requires a PDF.js worker** — must configure `pdfjs-dist` worker in vite.config.js
3. **CORS must be enabled** — frontend (port 5173) calls backend (port 3001) during development
4. **File uploads are temporary** — uploaded PDFs are NOT stored on the server; extract text then discard
5. **No database in v1** — all persistence is localStorage only
