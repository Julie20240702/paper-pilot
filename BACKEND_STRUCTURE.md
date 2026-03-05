# BACKEND_STRUCTURE.md — Backend Structure
# Paper Pilot

---

## Architecture Overview

Simple Express.js server with 3 API routes. No database. No authentication. Stateless — every request is self-contained.

```
Frontend (React, port 5173)
        ↓ HTTP POST
Backend (Express, port 3001)
        ↓
   pdf-parse (text extraction)
        ↓
   Anthropic Claude API
        ↓
   JSON response back to frontend
```

---

## API Endpoints

### POST /api/analyze
**Purpose**: Extract text from uploaded PDF and generate full paper analysis.

**Request**:
```
Content-Type: multipart/form-data
Body: { file: <PDF binary> }
```

**Processing steps**:
1. Receive PDF via multer (stored in memory, NOT written to disk)
2. Extract text using pdf-parse
3. If text length < 100 characters → return error (scanned PDF, no extractable text)
4. Truncate text to 15,000 characters if longer (to stay within token limits)
5. Send to Claude API with the ANALYSIS_PROMPT (see Prompts section)
6. Parse response as JSON
7. Return structured result

**Response (success)**:
```json
{
  "success": true,
  "data": {
    "overview": {
      "field": "Linguistics / Phonetics",
      "question": "How does acoustic clipping affect vowel perception in noise?",
      "methodology": "Perceptual experiment with 40 native English speakers",
      "conclusions": [
        { "text": "Clipping significantly reduces intelligibility above 50% signal loss", "page": 7 },
        { "text": "Listeners compensate using prosodic cues", "page": 9 }
      ],
      "limitations": [
        { "text": "Sample limited to native English speakers only", "page": 12 }
      ]
    },
    "arguments": [
      {
        "text": "Acoustic clipping is distinct from spectral degradation",
        "explanation": "声学截断与频谱降质是两种不同的信号损失机制",
        "page": 3
      }
    ],
    "figures": [
      {
        "description": "Figure 1: Spectrogram showing clipped vs unclipped signal",
        "page": 4,
        "suggestedUse": "Good for PPT to visualize the core concept"
      }
    ]
  }
}
```

**Response (error)**:
```json
{
  "success": false,
  "error": "NO_TEXT_EXTRACTED",
  "message": "This PDF appears to be a scanned image. Text extraction is not supported yet."
}
```

---

### POST /api/chat
**Purpose**: Answer a user's question about the paper.

**Request**:
```json
{
  "question": "What experiment did they run?",
  "paperText": "...extracted text from PDF...",
  "conversationHistory": [
    { "role": "user", "content": "What is this paper about?" },
    { "role": "assistant", "content": "This paper is about..." }
  ]
}
```

**Processing steps**:
1. Validate that `question` and `paperText` are present
2. Truncate `paperText` to 15,000 characters if needed
3. Build message history with paper context in system prompt
4. Send to Claude API
5. Return response text

**Response (success)**:
```json
{
  "success": true,
  "response": "The experiment involved 40 participants who listened to clipped audio samples [Page 5]. Each participant was tested on three signal-to-noise ratios [Page 6]."
}
```

---

### POST /api/translate
**Purpose**: Translate selected PDF text to Chinese with terminology explanation.

**Request**:
```json
{
  "text": "The acoustic clipping threshold was measured using a forced-choice paradigm."
}
```

**Response (success)**:
```json
{
  "success": true,
  "translation": "声学截断阈值通过强迫选择范式进行测量。",
  "terms": [
    {
      "term": "acoustic clipping threshold",
      "explanation": "声学截断阈值：信号被截断到刚好可被感知的临界点"
    },
    {
      "term": "forced-choice paradigm",
      "explanation": "强迫选择范式：实验方法，要求被试从有限选项中选择一个答案，消除猜测偏差"
    }
  ]
}
```

---

## Claude API Prompts

### ANALYSIS_PROMPT
```
You are an academic paper analysis assistant. Analyze the following paper text and return ONLY a valid JSON object with no markdown formatting, no code blocks, just raw JSON.

The JSON must follow this exact structure:
{
  "overview": {
    "field": "string - research field in one sentence",
    "question": "string - the core research question",
    "methodology": "string - how they conducted the research",
    "conclusions": [{"text": "string", "page": number}],
    "limitations": [{"text": "string", "page": number}]
  },
  "arguments": [
    {
      "text": "string - the argument in English",
      "explanation": "string - one-sentence explanation in Chinese (中文)",
      "page": number
    }
  ],
  "figures": [
    {
      "description": "string - what this figure shows",
      "page": number,
      "suggestedUse": "string - when to use this (PPT, lit review, etc.)"
    }
  ]
}

Rules:
- page numbers must be integers, estimate based on content position if not explicit
- include 3-6 arguments
- include all notable figures and tables
- if a field cannot be determined, use null
- return ONLY the JSON, nothing else

Paper text:
{PAPER_TEXT}
```

### CHAT_PROMPT (System message)
```
You are an academic reading assistant helping a student understand a research paper. 

Rules:
- When you reference specific content from the paper, always add [Page X] at the end of that sentence, where X is your best estimate of the page number based on the text
- If the user writes in Chinese, respond in Chinese. If in English, respond in English
- Be concise and helpful
- If asked about content not in the paper, say so clearly
- Format page citations as [Page X] - these will be made clickable in the UI

The paper text is provided below. Use it to answer questions accurately.

Paper text:
{PAPER_TEXT}
```

### TRANSLATE_PROMPT
```
Translate the following academic English text to Chinese. Also identify and explain any technical terms.

Return ONLY a valid JSON object:
{
  "translation": "Chinese translation here",
  "terms": [
    {"term": "English term", "explanation": "中文解释"}
  ]
}

If there are no notable technical terms, return an empty array for terms.
Return ONLY the JSON, nothing else.

Text to translate:
{TEXT}
```

---

## Error Handling Rules

1. All routes must be wrapped in try/catch
2. Always return `{ success: false, error: "ERROR_CODE", message: "Human readable message" }` on failure
3. Log errors to console with `console.error`
4. Never expose raw error objects to the frontend
5. HTTP status codes: 200 for success, 400 for client errors, 500 for server errors

---

## Security Rules

1. API key is ONLY in `.env`, never in frontend code, never committed to git
2. Uploaded PDFs are processed in memory (multer `memoryStorage`), never written to disk
3. Validate file type: reject if not `application/pdf`
4. Validate file size: reject if > 20MB
5. No user data is stored anywhere on the server
