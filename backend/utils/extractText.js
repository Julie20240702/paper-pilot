const { fork } = require('child_process');
const path = require('path');
const { PDFParse } = require('pdf-parse');

async function runPdfParseInChild(base64Data, maxPages = 50) {
  const buffer = Buffer.from(base64Data, 'base64');
  const parser = new PDFParse({ data: buffer });

  try {
    // Parse the first N pages; for short PDFs this still means full text.
    const result = await parser.getText({ first: maxPages });
    return result?.text || '';
  } finally {
    await parser.destroy();
  }
}

function extractTextFromPdfBuffer(buffer, { timeoutMs = 20000, maxPages = 50 } = {}) {
  return new Promise((resolve, reject) => {
    const child = fork(path.resolve(__filename), ['--child'], {
      stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
    });

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(new Error(`PDF text extraction timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.on('message', (message) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill('SIGKILL');

      if (message?.ok) {
        resolve(message.text || '');
      } else {
        reject(new Error(message?.error || 'Failed to extract PDF text'));
      }
    });

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });

    child.on('exit', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`PDF extractor process exited unexpectedly (code ${code})`));
    });

    child.send({ base64Data: buffer.toString('base64'), maxPages });
  });
}

if (process.argv.includes('--child')) {
  process.on('message', async (message) => {
    try {
      const text = await runPdfParseInChild(message?.base64Data || '', Number(message?.maxPages) || 50);
      process.send?.({ ok: true, text });
    } catch (error) {
      process.send?.({ ok: false, error: error?.message || 'Unknown PDF parse error' });
    }
  });
}

module.exports = {
  extractTextFromPdfBuffer,
};
