# CLAUDE.md — AI Operating Manual
# Paper Pilot

**Read this file at the start of every session before writing any code.**

---

## What This Project Is

Paper Pilot is a web app that combines a PDF reader (left panel) and an AI assistant (right panel) in one interface. Users upload academic papers and get AI-powered analysis, Q&A, and translation — all without leaving the page.

---

## Tech Stack (locked — do not change)

- **Frontend**: React 18.2.0 + Vite 5.1.0 + Tailwind CSS 3.4.1
- **PDF rendering**: react-pdf 7.7.0
- **Backend**: Node.js + Express 4.18.2
- **AI**: Anthropic Claude API, model `claude-sonnet-4-6`
- **Deployment**: Vercel
- **Storage**: localStorage only, no database

---

## File Naming Conventions

- React components: `PascalCase.jsx` (e.g., `PDFViewer.jsx`, `TabChat.jsx`)
- Utility functions: `camelCase.js` (e.g., `extractText.js`)
- CSS: Tailwind utility classes only, no separate CSS files per component
- API routes: `camelCase.js` in `/backend/routes/` (e.g., `analyze.js`)

---

## Component Patterns

### All components must:
1. Be functional components with hooks (no class components)
2. Accept props explicitly (no prop spreading with `{...props}` unless necessary)
3. Handle their own loading and error states
4. Follow FRONTEND_GUIDELINES.md for all styling

### Page citation pattern (used everywhere):
```jsx
// Render text with clickable [Page X] citations
function renderWithCitations(text, onJumpToPage) {
  const parts = text.split(/(\[Page \d+\])/g);
  return parts.map((part, i) => {
    const match = part.match(/\[Page (\d+)\]/);
    if (match) {
      return (
        <button
          key={i}
          onClick={() => onJumpToPage(parseInt(match[1]))}
          className="text-xs font-mono text-blue-400 hover:text-blue-300 underline"
        >
          {part}
        </button>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
```

---

## State Management

All state lives in `App.jsx`. Key state variables:
```javascript
const [pdfFile, setPdfFile] = useState(null);        // File object
const [pdfText, setPdfText] = useState('');           // Extracted text
const [currentPage, setCurrentPage] = useState(1);   // Current PDF page
const [totalPages, setTotalPages] = useState(0);      // Total PDF pages  
const [analysis, setAnalysis] = useState(null);       // AI analysis result
const [isAnalyzing, setIsAnalyzing] = useState(false); // Loading state
const [chatHistory, setChatHistory] = useState([]);   // Chat messages
const [activeTab, setActiveTab] = useState('overview'); // Active right panel tab
```

Pass `onJumpToPage` as a callback prop down to any component that renders `[Page X]` citations.

---

## API Calls

All API calls go through the Express backend at `http://localhost:3001` in development.

Never call the Anthropic API directly from frontend code. The API key must only exist in the backend `.env` file.

---

## Constraints — What NOT to Do

1. **Do NOT** add a database or user authentication in v1
2. **Do NOT** store uploaded PDFs on the server (use multer memory storage)
3. **Do NOT** add new npm packages without checking TECH_STACK.md first
4. **Do NOT** write inline styles — use Tailwind classes only
5. **Do NOT** make the app mobile-responsive in v1 (desktop only)
6. **Do NOT** add features outside the scope defined in PRD.md

---

## When You're Unsure

Check these files in this order:
1. `PRD.md` — what to build and what not to build
2. `APP_FLOW.md` — how users navigate and what happens on each action
3. `FRONTEND_GUIDELINES.md` — how things should look
4. `BACKEND_STRUCTURE.md` — API contracts and prompts
5. `IMPLEMENTATION_PLAN.md` — what to build next

---

## Current Progress

See `progress.txt` for the current build state.
