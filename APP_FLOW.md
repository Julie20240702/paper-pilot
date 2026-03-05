# APP_FLOW.md — Application Flow
# Paper Pilot

---

## Screens

| Screen ID | Name | Route |
|-----------|------|-------|
| S1 | Landing / Upload | `/` |
| S2 | Main Reader | `/reader` |

---

## Screen S1: Landing / Upload

### What the user sees
- Paper Pilot logo and tagline
- A large upload zone in the center: "Upload your PDF to get started"
- Supports click-to-upload or drag-and-drop
- Accepted file types: `.pdf` only

### User Actions & What Happens

**Action: User drags a PDF onto the upload zone**
1. Upload zone highlights (border turns blue)
2. User releases → file is accepted
3. App transitions to S2 (Main Reader)

**Action: User clicks the upload zone**
1. OS file picker opens
2. User selects a `.pdf` file
3. App transitions to S2 (Main Reader)

**Error: User uploads a non-PDF file**
1. Show inline error: "Please upload a PDF file"
2. Stay on S1

**Error: File is too large (> 20MB)**
1. Show inline error: "File is too large. Please upload a PDF under 20MB"
2. Stay on S1

---

## Screen S2: Main Reader

### Layout
```
[Header: Logo | File name | Upload new PDF button]
─────────────────────────────────────────────────────
[ PDF Viewer Panel ] ║ [ AI Panel                  ]
[   (resizable)    ] ║ [   (resizable)              ]
[                  ] ║ [                            ]
─────────────────────────────────────────────────────
```

### On Entry (just uploaded a PDF)
**Sequence:**
1. PDF loads and displays page 1 in the left panel
2. Right panel shows a loading spinner with text: "Analyzing paper..."
3. App extracts text from the PDF (via backend)
4. App sends extracted text to Claude API for analysis
5. When analysis completes, "Paper Overview" tab populates automatically
6. "Key Arguments" and "Figures & Charts" tabs also populate
7. Loading spinner disappears
8. Default active tab is "Paper Overview"

**If analysis fails:**
- Show error message in right panel: "Analysis failed. You can still use the chat to ask questions."
- AI Chat tab remains functional

---

## Left Panel: PDF Viewer

### Controls
- **Previous Page button**: goes to page N-1, disabled on page 1
- **Next Page button**: goes to page N+1, disabled on last page
- **Page indicator**: shows "Page 3 / 24"
- **Zoom In button**: increases scale by 0.2
- **Zoom Out button**: decreases scale by 0.2, minimum scale 0.5

### Page Jump (triggered by AI panel)
- When user clicks `[Page X]` in the right panel
- Left panel smoothly scrolls/jumps to page X
- Page indicator updates to show page X

### Text Selection → Translation
1. User selects text in the PDF
2. A small "Translate" button appears near the selection
3. User clicks "Translate"
4. Right panel switches focus to show translation result
5. Translation appears: Chinese translation + terminology notes

---

## Right Panel: AI Panel

### Tab 1: Paper Overview
- Auto-populated after upload
- Sections: Research Field, Core Question, Methodology, Main Conclusions, Limitations
- Static display (not interactive), but user can click any `[Page X]` citation

### Tab 2: Key Arguments
- Auto-populated after upload
- Each argument is a card with:
  - Argument text (English)
  - Chinese explanation (one sentence)
  - Clickable `[Page X]` citation
- User can click any argument card to ask follow-up in chat

### Tab 3: Figures & Charts
- Auto-populated after upload
- Each entry: Figure description | Page (clickable) | Suggested use
- If no figures found: show "No figures detected in this paper"

### Tab 4: AI Chat
**Initial state**: Empty chat with placeholder "Ask anything about this paper..."

**Send a message sequence:**
1. User types question (Chinese or English) and presses Enter or clicks Send
2. User message appears in chat bubble (right-aligned)
3. Loading indicator appears (three dots)
4. AI response streams in (left-aligned)
5. Any `[Page X]` in the response is a clickable link
6. User can send next message

**Click `[Page X]` in chat:**
1. Left panel jumps to that page
2. Active tab stays on Chat (does not switch tabs)

**Error: API call fails**
- Show message: "Something went wrong. Please try again."
- Input remains enabled so user can retry

### Notes Area (bottom of right panel, collapsible)
**Collapsed state**: Shows "Notes ▼" header bar
**Expanded state**: Shows text area + character count

**Save behavior:**
- Notes auto-save to localStorage on every keystroke (debounced 500ms)
- Key format: `paperpilot_notes_{filename}`
- On load: if notes exist for this filename, pre-populate the text area

---

## Resizable Divider

- User hovers over the center divider → cursor changes to resize cursor
- User clicks and drags left/right → panels resize in real time
- Minimum left panel width: 30% of window
- Minimum right panel width: 25% of window
- Position is NOT saved between sessions (resets to 55/45 on reload)

---

## Upload New PDF (from S2)

1. User clicks "Upload new PDF" in header
2. File picker opens
3. User selects new file
4. Entire app state resets (PDF, analysis, chat history, translation)
5. Notes for the NEW filename load from localStorage
6. New PDF loads, analysis starts again

---

## Error States Summary

| Situation | What User Sees |
|-----------|---------------|
| Non-PDF uploaded | "Please upload a PDF file" |
| File > 20MB | "File is too large. Max 20MB." |
| PDF fails to render | "Could not display this PDF. Try a different file." |
| Analysis API fails | "Analysis failed. You can still use chat." |
| Chat API fails | "Something went wrong. Please try again." |
| PDF has no extractable text (scanned image) | "This PDF appears to be a scanned image. Text extraction is not supported yet." |
