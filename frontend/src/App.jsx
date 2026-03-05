import { useRef, useState } from 'react';
import AIPanel from './components/AIPanel';
import PDFViewer from './components/PDFViewer';
import ResizableDivider from './components/ResizableDivider';
import UploadZone from './components/UploadZone';
import './App.css';

const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'https://paper-pilot-backend-dppl.onrender.com';

function App() {
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfText, setPdfText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [analysis, setAnalysis] = useState(null);
  const [analysisError, setAnalysisError] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [translationResult, setTranslationResult] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateError, setTranslateError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [leftPanelWidth, setLeftPanelWidth] = useState(55);
  const pdfViewerRef = useRef(null);
  const contentRef = useRef(null);

  const handleFileSelect = async (file) => {
    setPdfFile(file);
    setPdfText('');
    setCurrentPage(1);
    setTotalPages(0);
    setAnalysis(null);
    setAnalysisError('');
    setIsAnalyzing(true);
    setChatHistory([]);
    setTranslationResult(null);
    setTranslateError('');
    setActiveTab('overview');

    try {
      const formData = new FormData();
      formData.append('file', file);
      const controller = new AbortController();
      let timeoutId;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort();
          reject(new Error('ANALYZE_TIMEOUT'));
        }, 120000);
      });

      const requestPromise = (async () => {
        const response = await fetch(`${API_BASE_URL}/api/analyze`, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });
        const result = await response.json();
        return { response, result };
      })();

      const { response, result } = await Promise.race([requestPromise, timeoutPromise]).finally(() => {
        clearTimeout(timeoutId);
      });
      if (!response.ok || !result?.success) {
        const backendMessage = result?.message || '';
        if (result?.error === 'NO_TEXT_EXTRACTED') {
          throw new Error('This PDF appears to be a scanned image. Text extraction is not supported yet.');
        }
        if (backendMessage) {
          throw new Error(backendMessage);
        }
        throw new Error('Analysis failed. You can still use chat.');
      }

      setAnalysis(result.data || null);
      setPdfText(result.paperText || JSON.stringify(result.data || {}));
      setAnalysisError('');
    } catch (error) {
      console.error('Analyze flow failed:', error);
      setAnalysis(null);
      setPdfText('');
      if (error?.name === 'AbortError' || error?.message === 'ANALYZE_TIMEOUT') {
        setAnalysisError('Analysis request timed out after 120s. Please retry.');
      } else {
        setAnalysisError(
          error?.message === 'This PDF appears to be a scanned image. Text extraction is not supported yet.'
            ? error.message
            : `Analysis failed: ${error?.message || 'You can still use chat.'}`
        );
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleTotalPagesLoad = (pages) => {
    setTotalPages(pages);
  };

  const handleJumpToPage = (page) => {
    if (pdfViewerRef.current?.onJumpToPage) {
      pdfViewerRef.current.onJumpToPage(page);
      return;
    }
    setCurrentPage(page);
  };

  const handleTranslateRequest = async (selectedText) => {
    const text = String(selectedText || '').trim();
    if (!text || isTranslating) return;

    setIsTranslating(true);
    setTranslateError('');
    setTranslationResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Translate request failed');
      }

      setTranslationResult({
        sourceText: text,
        translation: result.translation || '',
        terms: Array.isArray(result.terms) ? result.terms : [],
      });
    } catch (error) {
      console.error('Translate flow failed:', error);
      setTranslateError(error?.message || 'Translate request failed');
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#F2EDE8] text-[#2C2420]">
      <header className="h-14 shrink-0 bg-[#F2EDE8] border-b border-[#E8E2DB] px-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#2C2420]">Paper Pilot</h1>
        <p className="text-sm text-[#8C7B6E] truncate ml-4">
          {pdfFile?.name || 'No file selected'}
        </p>
      </header>

      <main className="flex-1 min-h-0 flex flex-row overflow-hidden">
        {!pdfFile ? (
          <UploadZone onFileSelect={handleFileSelect} />
        ) : (
          <div ref={contentRef} className="flex-1 min-w-0 min-h-0 flex flex-row overflow-hidden">
            <div
              style={{ flex: `0 0 ${leftPanelWidth}%` }}
              className="min-w-0 min-h-0 border-r border-[#E8E2DB] overflow-hidden bg-[#F2EDE8]"
            >
              <PDFViewer
                ref={pdfViewerRef}
                file={pdfFile}
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                onTotalPagesLoad={handleTotalPagesLoad}
                onJumpToPage={handleJumpToPage}
                onTranslateRequest={handleTranslateRequest}
              />
            </div>
            <ResizableDivider
              containerRef={contentRef}
              onResize={setLeftPanelWidth}
              minLeft={30}
              minRight={25}
            />
            <div className="flex-1 min-w-0 min-h-0 bg-[#FAFAF8] border-l border-[#E8E2DB] overflow-hidden">
              <AIPanel
                activeTab={activeTab}
                onTabChange={setActiveTab}
                analysis={analysis}
                analysisError={analysisError}
                isAnalyzing={isAnalyzing}
                onJumpToPage={handleJumpToPage}
                chatHistory={chatHistory}
                setChatHistory={setChatHistory}
                paperText={pdfText}
                translationResult={translationResult}
                isTranslating={isTranslating}
                translateError={translateError}
                filename={pdfFile?.name || ''}
                onClearTranslation={() => {
                  setTranslationResult(null);
                  setTranslateError('');
                }}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
