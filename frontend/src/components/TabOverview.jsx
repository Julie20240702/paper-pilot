import { useState } from 'react';

const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'https://paper-pilot-backend-dppl.onrender.com';

const CIRCLED_NUMBERS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

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

function TabOverview({ analysis, isAnalyzing, onJumpToPage }) {
  const [translations, setTranslations] = useState({});

  const translateByKey = async (key, sourceText) => {
    const text = String(sourceText || '').trim();
    if (!text) return;

    setTranslations((prev) => ({
      ...prev,
      [key]: { text: '', isLoading: true, error: '' },
    }));

    try {
      const response = await fetch(`${API_BASE_URL}/api/translate`, {
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

  const renderBaseSection = (title, value, key) => {
    const translated = translations[key] || {};

    return (
      <section className="mb-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#A89080] uppercase tracking-wider">{title}</h3>
          <TranslateButton
            disabled={!String(value || '').trim() || translated.isLoading}
            onClick={() => translateByKey(key, value)}
          />
        </div>
        <p className="text-sm text-[#2C2420] leading-relaxed">{value || 'N/A'}</p>
        <TranslationBlock
          text={translated.text}
          isLoading={Boolean(translated.isLoading)}
          error={translated.error}
        />
      </section>
    );
  };

  const renderListSection = (title, items, keyPrefix) => (
    <section className="mb-4">
      <h3 className="text-sm font-semibold text-[#A89080] uppercase tracking-wider mb-2">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-[#8C7B6E]">No data.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => {
            const key = `${keyPrefix}-${index}`;
            const translated = translations[key] || {};
            const marker = CIRCLED_NUMBERS[index] || `${index + 1}.`;
            return (
              <div
                key={`${title}-${index}`}
                className="bg-white rounded-xl p-4 border border-[#E8E2DB] hover:border-pink-200 shadow-sm transition-shadow"
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <p className="text-sm text-[#2C2420] leading-relaxed">
                    <span className="mr-1 text-pink-500">{marker}</span>
                    {item?.text || 'N/A'}
                  </p>
                  <TranslateButton
                    disabled={!String(item?.text || '').trim() || translated.isLoading}
                    onClick={() => translateByKey(key, item?.text)}
                  />
                </div>
                <div className="mb-1">
                  <PageCitation page={item?.page} onJumpToPage={onJumpToPage} />
                </div>
                <TranslationBlock
                  text={translated.text}
                  isLoading={Boolean(translated.isLoading)}
                  error={translated.error}
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  if (isAnalyzing) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="flex items-center gap-3 text-[#8C7B6E]">
          <div className="animate-spin h-5 w-5 border-2 border-pink-400 border-t-transparent rounded-full" />
          <span className="text-sm">Analyzing paper...</span>
        </div>
      </div>
    );
  }

  const overview = analysis?.overview;

  if (!overview) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <p className="text-sm text-[#8C7B6E]">Upload and analyze a PDF to see the overview.</p>
      </div>
    );
  }

  const conclusions = Array.isArray(overview.conclusions) ? overview.conclusions : [];
  const limitations = Array.isArray(overview.limitations) ? overview.limitations : [];

  return (
    <div className="h-full w-full overflow-auto pr-1">
      {renderBaseSection('Field', overview.field, 'field')}
      {renderBaseSection('Question', overview.question, 'question')}
      {renderBaseSection('Methodology', overview.methodology, 'methodology')}
      {renderListSection('Conclusions', conclusions, 'conclusion')}
      {renderListSection('Limitations', limitations, 'limitation')}
    </div>
  );
}

export default TabOverview;
