import { useState } from 'react';

function PageCitation({ page, onJumpToPage }) {
  if (!Number.isInteger(page)) return null;

  return (
    <button
      type="button"
      onClick={() => onJumpToPage?.(page)}
      className="text-xs font-mono text-pink-500 hover:text-pink-600 underline bg-transparent border-none"
    >
      [Page {page}]
    </button>
  );
}

function TranslateButton({ disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-2 py-1 text-xs rounded-md bg-white border border-[#E8E2DB] text-[#8C7B6E] hover:border-pink-400 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      译
    </button>
  );
}

function TranslationBlock({ text, isLoading, error }) {
  if (isLoading) {
    return (
      <div className="mt-2 flex items-center gap-2 text-xs text-[#8C7B6E]">
        <div className="animate-spin h-3.5 w-3.5 border-2 border-pink-400 border-t-transparent rounded-full" />
        <span>翻译中...</span>
      </div>
    );
  }

  if (error) {
    return <div className="mt-2 text-xs text-red-600">{error}</div>;
  }

  if (!text) return null;

  return <p className="mt-2 text-sm text-[#2C2420] leading-relaxed">{text}</p>;
}

function TabFigures({ analysis, isAnalyzing, onJumpToPage }) {
  const [translations, setTranslations] = useState({});

  const translateByKey = async (key, sourceText) => {
    const text = String(sourceText || '').trim();
    if (!text) return;

    setTranslations((prev) => ({
      ...prev,
      [key]: { text: '', isLoading: true, error: '' },
    }));

    try {
      const response = await fetch('http://localhost:3001/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || '翻译失败，请重试。');
      }

      setTranslations((prev) => ({
        ...prev,
        [key]: { text: result.translation || '', isLoading: false, error: '' },
      }));
    } catch (error) {
      setTranslations((prev) => ({
        ...prev,
        [key]: { text: '', isLoading: false, error: error?.message || '翻译失败，请重试。' },
      }));
    }
  };

  if (isAnalyzing) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="flex items-center gap-3 text-[#8C7B6E]">
          <div className="animate-spin h-5 w-5 border-2 border-pink-400 border-t-transparent rounded-full" />
          <span className="text-sm">Analyzing figures...</span>
        </div>
      </div>
    );
  }

  const figures = Array.isArray(analysis?.figures) ? analysis.figures : [];

  if (figures.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <p className="text-sm text-[#8C7B6E]">No figures detected</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto pr-1 space-y-2">
      {figures.map((item, index) => {
        const key = `figure-description-${index}`;
        const translated = translations[key] || {};

        return (
          <article
            key={`figure-${index}`}
            className="bg-white rounded-xl p-4 mb-3 border border-[#E8E2DB] hover:border-pink-200 shadow-sm transition-shadow"
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <p className="text-sm text-[#2C2420] leading-relaxed">{item?.description || 'N/A'}</p>
              <TranslateButton
                disabled={!String(item?.description || '').trim() || translated.isLoading}
                onClick={() => translateByKey(key, item?.description)}
              />
            </div>

            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-[#8C7B6E]">Page:</span>
              <PageCitation page={item?.page} onJumpToPage={onJumpToPage} />
            </div>

            <p className="text-sm text-[#2C2420] leading-relaxed">
              <span className="text-xs font-semibold text-[#8C7B6E] uppercase tracking-wider mr-2">Suggested use:</span>
              {item?.suggestedUse || 'N/A'}
            </p>

            <TranslationBlock
              text={translated.text}
              isLoading={Boolean(translated.isLoading)}
              error={translated.error}
            />
          </article>
        );
      })}
    </div>
  );
}

export default TabFigures;
