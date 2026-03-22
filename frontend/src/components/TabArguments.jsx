import { useEffect, useRef, useState } from 'react';

function PageCitation({ page, quote, onJumpToPage, onHighlightArgument }) {
  if (!Number.isInteger(page)) return null;

  const handleClick = () => {
    if (typeof onHighlightArgument === 'function') {
      onHighlightArgument(page, quote);
      return;
    }
    onJumpToPage?.(page);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="text-xs font-mono text-pink-500 hover:text-pink-600 underline bg-transparent border-none"
    >
      [Page {page}]
    </button>
  );
}

function renderMarkedTerms(text) {
  const content = String(text || '');
  const parts = content.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    const match = part.match(/^\*\*([^*]+)\*\*$/);
    if (match) {
      return (
        <strong key={`strong-${index}`} className="font-semibold text-[#2C2420]">
          {match[1]}
        </strong>
      );
    }

    return <span key={`text-${index}`}>{part}</span>;
  });
}

function ArgumentCard({ item, index, onJumpToPage, onHighlightArgument }) {
  const [isQuoteOpen, setIsQuoteOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const copyResetTimerRef = useRef(null);
  const hasQuote = Boolean(String(item?.quote || '').trim());

  const handleCopyQuote = async () => {
    if (!hasQuote) return;
    try {
      await navigator.clipboard.writeText(item.quote);
      setIsCopied(true);
      if (copyResetTimerRef.current) {
        clearTimeout(copyResetTimerRef.current);
      }
      copyResetTimerRef.current = setTimeout(() => {
        setIsCopied(false);
        copyResetTimerRef.current = null;
      }, 2000);
    } catch (error) {
      console.error('Copy quote failed:', error);
    }
  };

  useEffect(
    () => () => {
      if (copyResetTimerRef.current) {
        clearTimeout(copyResetTimerRef.current);
      }
    },
    []
  );

  return (
    <article
      className="bg-white rounded-xl p-4 mb-3 border border-[#E8E2DB] hover:border-pink-200 shadow-sm transition-shadow"
    >
      <div className="text-xs font-semibold text-[#8C7B6E] uppercase tracking-wider mb-2">
        论点 {index + 1}
      </div>
      <p className="text-sm text-[#2C2420] leading-relaxed mb-2">{renderMarkedTerms(item?.text || 'N/A')}</p>
      <p className="text-sm text-[#2C2420] leading-relaxed mb-2">{item?.explanation || 'N/A'}</p>

      {hasQuote ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setIsQuoteOpen((prev) => !prev)}
            className="text-xs text-[#8C7B6E] hover:text-[#2C2420] bg-transparent border-none p-0"
          >
            {isQuoteOpen ? '收起原文 ▼' : '查看原文 ▶'}
          </button>

          {isQuoteOpen ? (
            <div className="mt-2 bg-amber-50 border-l-2 border-amber-400 rounded-r-lg px-3 py-2">
              <p className="text-sm text-[#2C2420] leading-relaxed">{item.quote}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 pt-3 border-t border-[#F1ECE6] flex items-center justify-between gap-3">
        <PageCitation
          page={item?.page}
          quote={item?.quote}
          onJumpToPage={onJumpToPage}
          onHighlightArgument={onHighlightArgument}
        />
        {hasQuote ? (
          <button
            type="button"
            onClick={handleCopyQuote}
            className="text-xs text-[#8C7B6E] hover:text-[#2C2420] bg-transparent border-none p-0 whitespace-nowrap"
          >
            {isCopied ? '✓ 已复制' : '📋 复制原文'}
          </button>
        ) : <span />}
      </div>
    </article>
  );
}

function TabArguments({ analysis, isAnalyzing, onJumpToPage, onHighlightArgument }) {
  if (isAnalyzing) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="flex items-center gap-3 text-[#8C7B6E]">
          <div className="animate-spin h-5 w-5 border-2 border-pink-400 border-t-transparent rounded-full" />
          <span className="text-sm">Analyzing arguments...</span>
        </div>
      </div>
    );
  }

  const argumentsList = Array.isArray(analysis?.arguments) ? analysis.arguments : [];

  if (argumentsList.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <p className="text-sm text-[#8C7B6E]">No arguments available yet.</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto pr-1 space-y-2">
      {argumentsList.map((item, index) => (
        <ArgumentCard
          key={`argument-${index}`}
          item={item}
          index={index}
          onJumpToPage={onJumpToPage}
          onHighlightArgument={onHighlightArgument}
        />
      ))}
    </div>
  );
}

export default TabArguments;
