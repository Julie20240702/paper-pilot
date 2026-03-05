const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const MODEL_FALLBACKS = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'];

async function listGenerateContentModels(apiKey, timeoutMs = 4000) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const controller = new AbortController();
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`ListModels timeout after ${timeoutMs}ms`)), timeoutMs);
  });
  let response;

  try {
    response = await Promise.race([
      fetch(endpoint, {
        method: 'GET',
        signal: controller.signal,
      }),
      timeoutPromise,
    ]);
  } catch (_error) {
    controller.abort();
    return [];
  }

  if (!response.ok) return [];

  const payload = await response.json().catch(() => ({}));
  const models = Array.isArray(payload?.models) ? payload.models : [];

  return models
    .filter((model) => Array.isArray(model.supportedGenerationMethods))
    .filter((model) => model.supportedGenerationMethods.includes('generateContent'))
    .map((model) => String(model.name || '').replace(/^models\//, ''))
    .filter(Boolean);
}

function getGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY');
  }
  return apiKey;
}

function extractGeminiText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .filter((part) => part && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n')
    .trim();
}

async function callGeminiGenerate({
  model = DEFAULT_MODEL,
  systemInstruction,
  contents,
  temperature = 0.2,
  timeoutMs = 60000,
  maxAttemptTimeoutMs = 4000,
}) {
  const apiKey = getGeminiApiKey();

  const body = {
    contents,
    generationConfig: {
      temperature,
    },
  };

  if (systemInstruction) {
    body.systemInstruction = {
      role: 'system',
      parts: [{ text: systemInstruction }],
    };
  }

  const discoveredModels = await listGenerateContentModels(apiKey).catch(() => []);
  const candidateModels = Array.from(
    new Set([
      model,
      model.replace(/-latest$/, ''),
      `${model}-latest`,
      ...MODEL_FALLBACKS,
      ...discoveredModels,
    ])
  )
    .filter(Boolean)
    .slice(0, 4);

  let lastError = null;

  const startedAt = Date.now();

  for (const candidateModel of candidateModels) {
    const elapsed = Date.now() - startedAt;
    const remaining = timeoutMs - elapsed;
    if (remaining <= 0) {
      const timeoutError = new Error(`Gemini total timeout after ${timeoutMs}ms`);
      timeoutError.code = 'GEMINI_TIMEOUT';
      throw timeoutError;
    }

    const attemptTimeoutMs = Math.min(remaining, maxAttemptTimeoutMs);
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${candidateModel}:generateContent?key=${apiKey}`;
    const controller = new AbortController();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error(`Gemini request timed out after ${attemptTimeoutMs}ms`)),
        attemptTimeoutMs
      );
    });
    let response;

    try {
      response = await Promise.race([
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        }),
        timeoutPromise,
      ]);
    } catch (error) {
      if (error?.name === 'AbortError' || /timed out/i.test(error?.message || '')) {
        controller.abort();
        const timeoutError = new Error(error?.message || `Gemini request timed out after ${timeoutMs}ms`);
        timeoutError.code = 'GEMINI_TIMEOUT';
        throw timeoutError;
      }
      throw error;
    }

    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      const text = extractGeminiText(payload);
      return { text, raw: payload, model: candidateModel };
    }

    if (response.status === 404) {
      lastError = new Error(payload?.error?.message || `Model ${candidateModel} not found`);
      lastError.status = response.status;
      lastError.payload = payload;
      continue;
    }

    const message = payload?.error?.message || `Gemini request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  throw lastError || new Error('No available Gemini model could be resolved.');
}

module.exports = {
  callGeminiGenerate,
  extractGeminiText,
};
