export function renderWithCitations(text, onJumpToPage) {
  const parts = String(text || '').split(/(\[(?:Page \d+(?:,\s*Page \d+)*)\])/g);

  return parts.map((part, index) => {
    const citationMatch = part.match(/^\[(?:Page \d+(?:,\s*Page \d+)*)\]$/);
    if (citationMatch) {
      const pages = [...part.matchAll(/Page\s+(\d+)/g)].map((match) => Number(match[1]));

      return (
        <span key={`citation-group-${index}`} className="inline-flex items-center gap-1">
          {pages.map((page, pageIndex) => (
            <button
              key={`citation-${index}-${pageIndex}`}
              type="button"
              onClick={() => onJumpToPage?.(page)}
              className="text-xs font-mono text-pink-500 hover:text-pink-600 underline bg-transparent border-none p-0"
            >
              [Page {page}]
            </button>
          ))}
        </span>
      );
    }

    return <span key={`text-${index}`}>{part}</span>;
  });
}
