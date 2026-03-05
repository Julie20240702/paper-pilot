const express = require('express');
const multer = require('multer');
const { callGeminiGenerate } = require('../utils/gemini');
const { extractTextFromPdfBuffer } = require('../utils/extractText');

const router = express.Router();

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_TEXT_LENGTH = 50000;
const MAX_ANALYSIS_INPUT_LENGTH = 30000;
const MIN_TEXT_LENGTH = 100;
const ANALYZE_TOTAL_TIMEOUT_MS = 120000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

const ANALYSIS_PROMPT = `You are an academic paper analysis assistant. Analyze the following paper text and return ONLY a valid JSON object with no markdown formatting, no code blocks, just raw JSON.

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
      "text": "string - the argument in English. For technical terms, you MUST use format: English Term（中文解释）",
      "explanation": "string - one-sentence explanation in Chinese (中文，必须使用简体中文)",
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
- For every technical term or concept, you MUST format it exactly like this: English Term（中文解释）. For example: MyoElastic-AeroDynamic principle（肌弹性气动原理）. Apply this to ALL fields: overview fields AND argument text fields. This is mandatory.
- Order ALL lists logically from most important to least important. Each point must be a complete, standalone sentence that someone who has NOT read the paper can understand. Start each conclusion with the key finding, not background context. Arguments should flow from foundational claims to specific findings.
- return ONLY the JSON, nothing else
- Detect the language of the paper. If the paper is in Chinese, write ALL output fields in Chinese including field, question, methodology, conclusions, limitations, argument text, argument explanation, and figure descriptions

Paper text:
{PAPER_TEXT}`;

function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

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

async function requestAnalysisText(sourceText, maxChars, { geminiTimeoutMs, wrapperTimeoutMs } = {}) {
  const prompt = ANALYSIS_PROMPT.replace('{PAPER_TEXT}', sourceText.slice(0, maxChars));
  const { text } = await withTimeout(
    callGeminiGenerate({
      systemInstruction:
        'You are an academic paper analysis assistant. Return only valid JSON, no markdown.',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      temperature: 0.1,
      timeoutMs: geminiTimeoutMs || 45000,
      maxAttemptTimeoutMs: geminiTimeoutMs || 45000,
    }),
    wrapperTimeoutMs || 50000,
    'Gemini analyze call'
  );

  return text;
}

router.post('/', (req, res) => {
  upload.single('file')(req, res, async (uploadError) => {
    const startedAt = Date.now();
    let timedOut = false;
    const totalTimer = setTimeout(() => {
      timedOut = true;
      if (!res.headersSent) {
        res.status(504).json({
          success: false,
          error: 'ANALYZE_TIMEOUT',
          message: 'Analyze request timed out after 120s. Please retry.',
        });
      }
    }, ANALYZE_TOTAL_TIMEOUT_MS);

    try {
      console.log('[analyze] request started');

      if (uploadError) {
        if (uploadError.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            error: 'FILE_TOO_LARGE',
            message: 'File size exceeds 20MB limit.',
          });
        }

        console.error('Upload error:', uploadError);
        return res.status(400).json({
          success: false,
          error: 'INVALID_UPLOAD',
          message: 'Failed to process uploaded file.',
        });
      }

      const file = req.file;
      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'NO_FILE',
          message: 'Please upload a PDF file.',
        });
      }

      if (file.mimetype !== 'application/pdf') {
        return res.status(400).json({
          success: false,
          error: 'INVALID_FILE_TYPE',
          message: 'Only PDF files are allowed.',
        });
      }

      if (timedOut) return;
      console.log('[analyze] extracting text...');
      const extractedText = await extractTextFromPdfBuffer(file.buffer, {
        timeoutMs: 40000,
        maxPages: 50,
      });
      console.log(`[analyze] text extracted, length=${extractedText?.length || 0}`);
      const normalizedText = extractedText.trim();

      if (normalizedText.length < MIN_TEXT_LENGTH) {
        return res.status(400).json({
          success: false,
          error: 'NO_TEXT_EXTRACTED',
          message: 'This PDF appears to be a scanned image. Text extraction is not supported yet.',
        });
      }

      let assistantText;
      try {
        if (timedOut) return;
        console.log('[analyze] calling Gemini (full context)...');
        assistantText = await requestAnalysisText(normalizedText, MAX_ANALYSIS_INPUT_LENGTH, {
          geminiTimeoutMs: 40000,
          wrapperTimeoutMs: 45000,
        });
      } catch (error) {
        if (error?.code === 'GEMINI_TIMEOUT' || /timed out/i.test(error?.message || '')) {
          console.warn('Analyze timed out on full context, retrying with shorter text window...');
          if (timedOut) return;
          assistantText = await requestAnalysisText(normalizedText, 8000, {
            geminiTimeoutMs: 18000,
            wrapperTimeoutMs: 22000,
          });
        } else {
          throw error;
        }
      }

      let parsedData;
      try {
        parsedData = parseModelJson(assistantText);
      } catch (parseError) {
        console.error('Model JSON parse error:', parseError);
        return res.status(500).json({
          success: false,
          error: 'AI_RESPONSE_PARSE_ERROR',
          message: 'Failed to parse AI analysis response.',
        });
      }

      if (timedOut || res.headersSent) return;
      console.log(`[analyze] success in ${Date.now() - startedAt}ms`);
      return res.status(200).json({
        success: true,
        data: parsedData,
        paperText: normalizedText.slice(0, MAX_TEXT_LENGTH),
      });
    } catch (error) {
      console.error('Analyze route error:', error);
      if (timedOut || res.headersSent) return;
      return res.status(500).json({
        success: false,
        error: 'ANALYZE_FAILED',
        message: 'Failed to analyze the uploaded PDF.',
      });
    } finally {
      clearTimeout(totalTimer);
    }
  });
});

module.exports = router;
