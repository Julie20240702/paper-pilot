# Paper Pilot

Paper Pilot is an AI-assisted academic reading workspace. It lets you upload a PDF, read it side-by-side with an AI panel, ask deep questions, translate selected passages, and keep file-specific notes.

## Product Overview

Paper Pilot is designed for literature reading and writing workflows:
- Upload and preview academic PDFs in browser
- Generate structured analysis (overview, arguments, figures)
- Ask follow-up questions with citation-style page links
- Translate selected text with term explanations
- Save notes per document with local persistence

## Core Features

- PDF upload and rendering with pagination and zoom
- Resizable split layout (PDF panel + AI panel)
- AI analysis tabs:
  - Overview
  - Arguments
  - Figures
  - Chat
- Chat assistant with built-in prompt templates
- Clickable `[Page X]` citations that jump to PDF page
- Selection-based translation via `/api/translate`
- Notes area with `localStorage` key format:
  - `paperpilot_notes_{filename}`

## Tech Stack

- Frontend
  - React + Vite
  - Tailwind CSS
  - `react-pdf` / `pdfjs-dist`
- Backend
  - Node.js + Express
  - `multer` (file upload)
  - `pdf-parse` (PDF text extraction)
  - Gemini API integration
  - `cors`, `dotenv`

## Local Development

### 1. Install dependencies

```bash
cd frontend && npm install
cd ../backend && npm install
```

### 2. Configure environment variables

Create `backend/.env`:

```env
GEMINI_API_KEY=your_real_key
GEMINI_MODEL=gemini-2.0-flash
PORT=3001
```

### 3. Start backend

```bash
cd backend
npm run dev
```

### 4. Start frontend

```bash
cd frontend
npm run dev
```

Default local URLs:
- Frontend: `http://localhost:5173` (or next available Vite port)
- Backend: `http://localhost:3001`
