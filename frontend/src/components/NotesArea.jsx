import { useEffect, useMemo, useState } from 'react';

function NotesArea({ filename }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notes, setNotes] = useState('');

  const storageKey = useMemo(() => {
    const safeName = (filename || 'untitled').trim();
    return `paperpilot_notes_${safeName}`;
  }, [filename]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      setNotes(saved || '');
    } catch (error) {
      console.error('Failed to load notes from localStorage:', error);
      setNotes('');
    }
  }, [storageKey]);

  const handleChange = (value) => {
    setNotes(value);
    try {
      localStorage.setItem(storageKey, value);
    } catch (error) {
      console.error('Failed to save notes to localStorage:', error);
    }
  };

  return (
    <div className="shrink-0 border-t border-[#E8E2DB] bg-[#FAFAF8]">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full px-4 py-3 text-left text-sm font-semibold text-[#8C7B6E] hover:text-[#2C2420] flex items-center justify-between"
      >
        <span>Notes</span>
        <span className="text-xs text-[#8C7B6E]">{isOpen ? '▼' : '▶'}</span>
      </button>

      {isOpen ? (
        <div className="px-4 pb-4">
          <textarea
            value={notes}
            onChange={(event) => handleChange(event.target.value)}
            placeholder="Write your notes about this paper..."
            rows={6}
            className="w-full bg-white border border-[#E8E2DB] rounded-lg p-3 text-sm text-[#2C2420] placeholder-gray-400 focus:outline-none focus:border-pink-400 focus:ring-1 focus:ring-pink-400 resize-none shadow-sm"
          />
        </div>
      ) : null}
    </div>
  );
}

export default NotesArea;
