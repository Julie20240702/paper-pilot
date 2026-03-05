import { useRef, useState } from 'react';

const MAX_FILE_SIZE = 20 * 1024 * 1024;

function UploadZone({ onFileSelect, disabled = false }) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');

  const validatePdfFile = (file) => {
    if (!file) return null;

    const isPdfMime = file.type === 'application/pdf';
    const isPdfName = file.name.toLowerCase().endsWith('.pdf');

    if (!isPdfMime && !isPdfName) {
      return 'Please upload a PDF file';
    }

    if (file.size > MAX_FILE_SIZE) {
      return 'File is too large. Max 20MB.';
    }

    return null;
  };

  const processFile = (file) => {
    const validationError = validatePdfFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    if (typeof onFileSelect === 'function') {
      onFileSelect(file);
    }
  };

  const handleInputChange = (event) => {
    const file = event.target.files?.[0];
    processFile(file);
    event.target.value = '';
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const file = event.dataTransfer.files?.[0];
    processFile(file);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const openFilePicker = () => {
    if (!disabled) {
      inputRef.current?.click();
    }
  };

  return (
    <div className="h-full w-full flex items-center justify-center p-4 bg-[#F2EDE8]">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleInputChange}
        className="hidden"
      />

      <button
        type="button"
        onClick={openFilePicker}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        disabled={disabled}
        className={`w-full max-w-3xl h-[420px] rounded-xl border-2 border-dashed border-[#E8E2DB] bg-white p-8 text-center transition-colors duration-150 shadow-sm focus:outline-none focus:ring-2 focus:ring-pink-400 ${
          isDragging
            ? 'border-pink-500 bg-[#FDF2F8]'
            : 'hover:border-[#D8CFC6]'
        } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
      >
        <div className="h-full flex flex-col items-center justify-center gap-3">
          <div className="text-5xl text-[#8C7B6E]">↑</div>
          <h2 className="text-xl font-semibold text-[#8C7B6E]">Upload Your PDF</h2>
          <p className="text-sm text-[#8C7B6E]">
            Click to select a file or drag and drop it here
          </p>
          <p className="text-xs text-[#8C7B6E]">PDF only, up to 20MB</p>
          {error && (
            <div className="mt-3 w-full max-w-lg rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}
        </div>
      </button>
    </div>
  );
}

export default UploadZone;
