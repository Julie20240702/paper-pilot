const express = require('express');
const { callGeminiGenerate } = require('../utils/gemini');

const router = express.Router();

const TRANSLATE_PROMPT = `翻译要自然流畅，符合中文母语者的表达习惯，不要逐字翻译，意译为主。专业术语保留英文并在括号内给出简短中文说明。
请把下面学术英文翻译成中文，并识别术语。

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
{TEXT}`;

function parseModelJson(rawText) {
  if (!rawText) {
    throw new Error('Empty model response');
  }

  try {
    return JSON.parse(rawText);
  } catch (_error) {
    // continue with fallbacks
  }

  const fencedMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return JSON.parse(fencedMatch[1].trim());
  }

  const firstBrace = rawText.indexOf('{');
  const lastBrace = rawText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = rawText.slice(firstBrace, lastBrace + 1);
    return JSON.parse(candidate);
  }

  throw new Error('Unable to parse model JSON response');
}

router.post('/', async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_TEXT',
        message: 'Text is required for translation.',
      });
    }

    const prompt = TRANSLATE_PROMPT.replace('{TEXT}', text.trim());
    const { text: assistantText } = await callGeminiGenerate({
      systemInstruction: 'Translate academic English to Chinese and return strict JSON only.',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      temperature: 0.1,
      timeoutMs: 20000,
      maxAttemptTimeoutMs: 8000,
    });
    let parsed;
    try {
      parsed = parseModelJson(assistantText);
    } catch (parseError) {
      console.error('Translate JSON parse error:', parseError);
      return res.status(500).json({
        success: false,
        error: 'AI_RESPONSE_PARSE_ERROR',
        message: 'Failed to parse translation response.',
      });
    }

    return res.status(200).json({
      success: true,
      translation: parsed.translation || '',
      terms: Array.isArray(parsed.terms) ? parsed.terms : [],
    });
  } catch (error) {
    console.error('Translate route error:', error);
    return res.status(500).json({
      success: false,
      error: 'TRANSLATE_FAILED',
      message: 'Failed to translate selected text.',
    });
  }
});

module.exports = router;
