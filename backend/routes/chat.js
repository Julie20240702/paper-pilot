const express = require('express');
const { callGeminiGenerate } = require('../utils/gemini');

const router = express.Router();

const MAX_TEXT_LENGTH = 50000;

const CHAT_PROMPT = `You are an academic reading assistant helping a student understand a research paper. 
You are a deep academic reading assistant. You can answer complex questions about the paper including how to write a literature review, critical analysis, methodology evaluation, and research implications. Always try your best to give a thorough answer.

Rules:
- When you reference specific content from the paper, always add [Page X] at the end of that sentence, where X is your best estimate of the page number based on the text
- If the user writes in Chinese, respond in Chinese. If in English, respond in English
- Be concise and helpful
- If asked about content not in the paper, say so clearly
- Format page citations as [Page X] - these will be made clickable in the UI
- Do not use markdown formatting. Do not use **bold**. Output plain text only.
- Never use markdown formatting. No asterisks, no bold, no headers. Output plain text only.
- Never use markdown formatting. No asterisks (*), no bold, no bullet points with *, no headers with #. Use plain text only.
- Structure your response in clear paragraphs. Leave a blank line between paragraphs.
- When responding in Chinese, write in natural conversational Mandarin. Avoid literal translation patterns. Use common everyday Chinese expressions. Technical terms can keep English with a brief Chinese explanation in parentheses.
- IMPORTANT: You MUST format your response with clear paragraph breaks. After every 2-3 sentences, add a blank line. Never write a wall of text. Structure longer responses with clear sections. Do NOT use markdown symbols like * or #.

The paper text is provided below. Use it to answer questions accurately.

Paper text:
{PAPER_TEXT}`;

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .filter(
      (item) =>
        item &&
        (item.role === 'user' || item.role === 'assistant') &&
        typeof item.content === 'string' &&
        item.content.trim()
    )
    .map((item) => ({
      role: item.role,
      content: item.content.trim(),
    }));
}

function toGeminiContents(history, question) {
  const items = history.map((item) => ({
    role: item.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: item.content }],
  }));

  items.push({
    role: 'user',
    parts: [{ text: question }],
  });

  return items;
}

function normalizePlainTextResponse(text) {
  const raw = String(text || '');
  if (!raw.trim()) return '';

  const noMarkdown = raw
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[*•]\s+/gm, '')
    .replace(/`+/g, '')
    .replace(/\r\n/g, '\n');

  const normalizedLines = noMarkdown
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return normalizedLines.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

router.post('/', async (req, res) => {
  try {
    const { question, paperText, conversationHistory } = req.body || {};

    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_QUESTION',
        message: 'Question is required.',
      });
    }

    if (!paperText || typeof paperText !== 'string' || !paperText.trim()) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_PAPER_TEXT',
        message: 'paperText is required.',
      });
    }

    const truncatedPaperText = paperText.trim().slice(0, MAX_TEXT_LENGTH);
    const systemPrompt = CHAT_PROMPT.replace('{PAPER_TEXT}', truncatedPaperText);
    const history = sanitizeHistory(conversationHistory);
    const contents = toGeminiContents(history, question.trim());
    const { text: responseText } = await callGeminiGenerate({
      systemInstruction: systemPrompt,
      contents,
      temperature: 0.2,
      timeoutMs: 120000,
      maxAttemptTimeoutMs: 120000,
    });

    const normalizedResponse = normalizePlainTextResponse(responseText);

    return res.status(200).json({
      success: true,
      response: normalizedResponse,
    });
  } catch (error) {
    console.error('Chat route error (full):', error);

    if (error?.code === 'GEMINI_TIMEOUT' || /timed out/i.test(error?.message || '')) {
      return res.status(504).json({
        success: false,
        error: 'CHAT_TIMEOUT',
        message: `Chat request timed out after 120s: ${error?.message || 'Timeout'}`,
      });
    }

    return res.status(500).json({
      success: false,
      error: 'CHAT_FAILED',
      message: error?.message || 'Unknown error',
    });
  }
});

module.exports = router;
