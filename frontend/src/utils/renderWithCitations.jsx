export function renderWithCitations(text, onJumpToPage) {
  const parts = String(text || '').split(/(\[Page \d+\])/g);

  return parts.map((part, index) => {
    const match = part.match(/^\[Page (\d+)\]$/);
    if (match) {
      const page = Number(match[1]);
      return (
        <button
          key={`citation-${index}`}
          type="button"
          onClick={() => onJumpToPage?.(page)}
          className="text-xs font-mono text-pink-500 hover:text-pink-600 underline bg-transparent border-none"
        >
          {part}
        </button>
      );
    }

    return <span key={`text-${index}`}>{part}</span>;
  });
}
