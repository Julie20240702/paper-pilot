function extractSurroundingSentence(parts, citationIndex) {
  const textBeforeCitation = parts
    .slice(0, citationIndex)
    .filter((_, index) => index % 2 === 0)
    .join('');

  const normalized = textBeforeCitation.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';

  const sentenceParts = normalized.split(/(?<=[.!?。！？])\s+/);
  return sentenceParts[sentenceParts.length - 1]?.trim() || normalized;
}

export function renderWithCitations(text, onJumpToPage, onHighlightArgument) {
  const parts = String(text || '').split(/(\[(?:Page \d+(?:,\s*Page \d+)*)\])/g);

  return parts.map((part, index) => {
    const citationMatch = part.match(/^\[(?:Page \d+(?:,\s*Page \d+)*)\]$/);
    if (citationMatch) {
      const pages = [...part.matchAll(/Page\s+(\d+)/g)].map((match) => Number(match[1]));
      const surroundingText = extractSurroundingSentence(parts, index);

      return (
        <span key={`citation-group-${index}`} className="inline-flex items-center gap-1">
          {pages.map((page, pageIndex) => (
            <button
              key={`citation-${index}-${pageIndex}`}
              type="button"
              onClick={() => {
                if (typeof onHighlightArgument === 'function') {
                  onHighlightArgument(page, surroundingText);
                  return;
                }
                onJumpToPage?.(page);
              }}
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
