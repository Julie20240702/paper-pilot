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

function TabArguments({ analysis, isAnalyzing, onJumpToPage }) {
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
        <article
          key={`argument-${index}`}
          className="bg-white rounded-xl p-4 mb-3 border border-[#E8E2DB] hover:border-pink-200 shadow-sm transition-shadow"
        >
          <div className="text-xs font-semibold text-[#8C7B6E] uppercase tracking-wider mb-2">
            论点 {index + 1}
          </div>
          <p className="text-sm text-[#2C2420] leading-relaxed mb-2">{renderMarkedTerms(item?.text || 'N/A')}</p>
          <p className="text-sm text-[#2C2420] leading-relaxed mb-2">{item?.explanation || 'N/A'}</p>
          <PageCitation page={item?.page} onJumpToPage={onJumpToPage} />
        </article>
      ))}
    </div>
  );
}

export default TabArguments;
