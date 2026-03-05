# IMPLEMENTATION_PLAN.md — Build Sequence
# Paper Pilot

**Rule: Build in this exact order. Do NOT skip ahead. Each step must work before moving to the next.**

---

## Phase 1: Project Setup (Day 1)

### Step 1.1 — Initialize frontend
```bash
cd paper-pilot
npm create vite@latest frontend -- --template react
cd frontend
npm install
```

### Step 1.2 — Install frontend dependencies
```bash
npm install react-pdf pdfjs-dist tailwindcss autoprefixer postcss
npx tailwindcss init -p
```

### Step 1.3 — Configure Tailwind
- Add Tailwind directives to `src/index.css`
- Set content paths in `tailwind.config.js`

### Step 1.4 — Configure Vite for PDF.js worker
In `vite.config.js`, add the PDF.js worker configuration so react-pdf can render PDFs in the browser.

### Step 1.5 — Initialize backend
```bash
cd ../
mkdir backend && cd backend
npm init -y
npm install express multer pdf-parse @anthropic-ai/sdk cors dotenv
```

### Step 1.6 — Create .env file
```
ANTHROPIC_API_KEY=your_key_here
PORT=3001
```

### Step 1.7 — Create folder structure
Create all folders and empty files as specified in TECH_STACK.md.

**✅ Checkpoint**: Both `npm run dev` (frontend) and `node server.js` (backend) run without errors.

---

## Phase 2: PDF Upload & Display (Day 1–2)

### Step 2.1 — Build UploadZone component
- Large centered upload area
- Supports click-to-upload and drag-and-drop
- Accepts `.pdf` files only
- Shows error for non-PDF or oversized files
- Follow FRONTEND_GUIDELINES.md for styling

### Step 2.2 — Build App.jsx state management
State variables needed:
- `pdfFile` — the uploaded File object
- `pdfText` — extracted text string (comes from backend later)
- `currentPage` — current page number
- `totalPages` — total page count
- `analysis` — the AI analysis result object
- `isAnalyzing` — boolean loading state
- `chatHistory` — array of message objects

### Step 2.3 — Build PDFViewer component
- Use `react-pdf` Document and Page components
- Show PDF file passed as prop
- Previous/Next page buttons
- Page indicator "Page X / Y"
- Zoom in/out controls
- Expose `jumpToPage(pageNumber)` function via ref or prop

### Step 2.4 — Build basic layout in App.jsx
- Header with logo and filename
- Left panel (PDFViewer) and right panel (placeholder)
- Hard-coded 55/45 split for now

**✅ Checkpoint**: Upload a PDF → it displays in the left panel → can navigate pages and zoom.

---

## Phase 3: Resizable Panels (Day 2)

### Step 3.1 — Build ResizableDivider component
- Mouse down on divider → start drag
- Mouse move → update split percentage
- Mouse up → stop drag
- Enforce min widths (30% left, 25% right)
- Change cursor to `col-resize` on hover

### Step 3.2 — Wire divider into App.jsx layout

**✅ Checkpoint**: Can drag the divider to resize left and right panels.

---

## Phase 4: Backend API (Day 2–3)

### Step 4.1 — Build server.js
- Express app with CORS enabled
- Mount routes from `/routes/` folder
- Error handling middleware

### Step 4.2 — Build /api/analyze route
- Accept PDF upload via multer (memory storage)
- Validate file type and size
- Extract text with pdf-parse
- Check text length (reject if < 100 chars)
- Truncate to 15,000 chars
- Call Claude API with ANALYSIS_PROMPT from BACKEND_STRUCTURE.md
- Parse JSON response
- Return structured data

### Step 4.3 — Build /api/chat route
- Accept question, paperText, conversationHistory
- Build Claude API messages array
- Return AI response text

### Step 4.4 — Build /api/translate route
- Accept selected text string
- Call Claude API with TRANSLATE_PROMPT
- Return translation and terms

**✅ Checkpoint**: Test all 3 routes with a REST client (or curl). All return correct JSON.

---

## Phase 5: AI Panel — Auto-Analysis Tabs (Day 3–4)

### Step 5.1 — Build AIPanel component shell
- 4 tab buttons at the top
- Tab content area below
- Follow FRONTEND_GUIDELINES.md tab styles

### Step 5.2 — Wire upload → analyze flow in App.jsx
- When user uploads PDF:
  1. Set `pdfFile` state (triggers PDF display)
  2. Send PDF to `/api/analyze`
  3. Set `isAnalyzing = true`
  4. On response, set `analysis` state
  5. Set `isAnalyzing = false`

### Step 5.3 — Build TabOverview component
- Show loading spinner while `isAnalyzing`
- Render `analysis.overview` data when ready
- Sections: Field, Question, Methodology, Conclusions, Limitations
- Conclusions and Limitations render with clickable `[Page X]`

### Step 5.4 — Build TabArguments component
- Show loading spinner while `isAnalyzing`
- Render `analysis.arguments` as cards
- Each card: English argument + Chinese explanation + `[Page X]`

### Step 5.5 — Build TabFigures component
- Show loading spinner while `isAnalyzing`
- Render `analysis.figures` as list
- Each item: description + page (clickable) + suggested use
- Show "No figures detected" if array is empty

### Step 5.6 — Wire page jump
- All `[Page X]` buttons in all tabs call `jumpToPage(X)` on the PDF viewer
- Pass `onJumpToPage` callback down through props

**✅ Checkpoint**: Upload a paper → all 3 auto-generated tabs populate → clicking `[Page X]` jumps the PDF.

---

## Phase 6: AI Chat (Day 4–5)

### Step 6.1 — Build TabChat component
- Message list (user messages right-aligned, AI left-aligned)
- Text input at the bottom
- Send button (also triggered by Enter key)
- Loading indicator while waiting for response

### Step 6.2 — Wire chat to /api/chat
- On send: append user message to `chatHistory`
- POST to `/api/chat` with question, paperText, conversationHistory
- On response: append AI message to `chatHistory`
- Parse `[Page X]` in AI response → render as clickable links

### Step 6.3 — Render clickable page citations in chat
Write a helper function `renderWithCitations(text, onJumpToPage)`:
- Find all `[Page X]` patterns with regex
- Replace with clickable `<button>` elements
- Return array of text and button elements

**✅ Checkpoint**: Can ask questions about the paper → AI responds with page citations → clicking jumps PDF.

---

## Phase 7: Translation (Day 5)

### Step 7.1 — Detect text selection in PDF area
- Listen for `mouseup` event in the PDF viewer container
- Use `window.getSelection().toString()` to get selected text
- If selection is non-empty, show a "Translate" button near the selection

### Step 7.2 — Wire translate button to /api/translate
- POST selected text to `/api/translate`
- Show result in right panel (can use a temporary overlay or switch to a result section)

**✅ Checkpoint**: Select text in PDF → click Translate → see Chinese translation and term explanations.

---

## Phase 8: Notes (Day 5)

### Step 8.1 — Build NotesArea component
- Collapsible section at bottom of right panel
- Textarea for freeform notes
- "Notes ▼" header toggles open/closed

### Step 8.2 — Wire localStorage persistence
- On every keystroke (debounced 500ms), save to `localStorage`
- Key: `paperpilot_notes_{filename}`
- On component mount: load notes for current filename

**✅ Checkpoint**: Write a note → refresh page → note is still there.

---

## Phase 9: Polish & Deploy (Day 6–7)

### Step 9.1 — Error states
Implement all error states defined in APP_FLOW.md.

### Step 9.2 — Loading states
Ensure every async operation has a proper loading indicator.

### Step 9.3 — Small screen warning
If window width < 1024px, show "Paper Pilot works best on a desktop browser."

### Step 9.4 — Test with real papers
Test with at least 3 different PDFs:
- A short paper (5 pages)
- A long paper (20+ pages)
- A paper with many figures

### Step 9.5 — Deploy to Vercel
- Push code to GitHub
- Connect repo to Vercel
- Set `ANTHROPIC_API_KEY` in Vercel environment variables
- Deploy and verify the public URL works

### Step 9.6 — Share with 3 users
- Send to 3 real users
- Collect feedback
- Note any bugs or confusing UX

**✅ DONE**: Public URL is live and working. Real users have tested it.
