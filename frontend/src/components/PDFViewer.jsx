import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

const versionedWorkerSrc = `${pdfWorkerSrc}${pdfWorkerSrc.includes('?') ? '&' : '?'}v=${pdfjs.version}`;
pdfjs.GlobalWorkerOptions.workerSrc = versionedWorkerSrc;
const documentOptions = {
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
};

const MIN_SCALE = 0.5;
const MAX_SCALE = 2.0;
const SCALE_STEP = 0.2;
const WHEEL_ZOOM_SENSITIVITY = 0.0015;
const ZOOM_DEBOUNCE_MS = 2000;

const clampZoom = (value) => {
  const bounded = Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
  return Number(bounded.toFixed(2));
};

const PDFViewer = forwardRef(function PDFViewer(
  { file, currentPage, totalPages, onPageChange, onTotalPagesLoad, onTranslateRequest },
  ref
) {
  const [zoom, setZoom] = useState(1.0);
  const [visualZoom, setVisualZoom] = useState(1.0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadedPages, setLoadedPages] = useState(0);
  const [translateTarget, setTranslateTarget] = useState(null);
  const pageContainerRef = useRef(null);
  const viewerRootRef = useRef(null);
  const zoomDebounceRef = useRef(null);
  const pendingScrollRef = useRef({ left: 0, top: 0 });
  const shouldRestoreScrollRef = useRef(false);
  const [fitWidth, setFitWidth] = useState(600);

  const maxPages = totalPages || loadedPages || 0;

  const jumpToPage = (pageNumber) => {
    if (!maxPages) return;
    const safePage = Math.min(Math.max(pageNumber, 1), maxPages);
    onPageChange?.(safePage);
  };

  useImperativeHandle(
    ref,
    () => ({
      onJumpToPage: jumpToPage,
    }),
    [maxPages, onPageChange]
  );

  const handlePrevPage = () => {
    if (currentPage > 1) {
      onPageChange?.(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (maxPages && currentPage < maxPages) {
      onPageChange?.(currentPage + 1);
    }
  };

  const commitZoomDebounced = useCallback((nextZoom) => {
    if (zoomDebounceRef.current) {
      clearTimeout(zoomDebounceRef.current);
    }

    zoomDebounceRef.current = setTimeout(() => {
      shouldRestoreScrollRef.current = true;
      setZoom(nextZoom);
      zoomDebounceRef.current = null;
    }, ZOOM_DEBOUNCE_MS);
  }, []);

  const requestZoom = useCallback((targetZoom) => {
    const clamped = clampZoom(targetZoom);
    const container = pageContainerRef.current;
    if (container) {
      pendingScrollRef.current = {
        left: container.scrollLeft,
        top: container.scrollTop,
      };
    }
    setVisualZoom(clamped);
    commitZoomDebounced(clamped);
  }, [commitZoomDebounced]);

  const handleZoomOut = () => {
    requestZoom(visualZoom - SCALE_STEP);
  };

  const handleZoomIn = () => {
    requestZoom(visualZoom + SCALE_STEP);
  };

  const handleWheelZoom = useCallback((event) => {
    const isZoomGesture = event.ctrlKey || event.metaKey;
    if (!isZoomGesture) return;

    event.preventDefault();

    const zoomDelta = -event.deltaY * WHEEL_ZOOM_SENSITIVITY;
    if (zoomDelta === 0) return;

    requestZoom(visualZoom + zoomDelta);
  }, [requestZoom, visualZoom]);

  useEffect(() => {
    const container = pageContainerRef.current;
    if (!container) return undefined;

    const updateFitWidth = () => {
      const width = Math.max(container.clientWidth - 8, 200);
      setFitWidth(width);
    };

    updateFitWidth();

    const observer = new ResizeObserver(updateFitWidth);
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const container = pageContainerRef.current;
    if (!container) return undefined;

    container.addEventListener('wheel', handleWheelZoom, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheelZoom);
    };
  }, [handleWheelZoom]);

  useEffect(() => () => {
    if (zoomDebounceRef.current) {
      clearTimeout(zoomDebounceRef.current);
      zoomDebounceRef.current = null;
    }
  }, []);

  const handleLoadSuccess = ({ numPages }) => {
    setLoadedPages(numPages);
    setIsLoading(false);
    setError('');
    onTotalPagesLoad?.(numPages);
    if (currentPage > numPages) {
      onPageChange?.(numPages);
    }
  };

  const handleLoadError = () => {
    setIsLoading(false);
    setError('Could not display this PDF. Try a different file.');
  };

  const handlePageRenderSuccess = () => {
    setIsLoading(false);
    if (!shouldRestoreScrollRef.current) return;

    const container = pageContainerRef.current;
    if (!container) return;

    const { left, top } = pendingScrollRef.current;
    requestAnimationFrame(() => {
      container.scrollTo({ left, top });
      shouldRestoreScrollRef.current = false;
    });
  };

  const hideTranslateButton = () => {
    setTranslateTarget(null);
  };

  const handleSelectionMouseUp = () => {
    if (typeof onTranslateRequest !== 'function') return;

    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() || '';
    if (!selectedText || !selection || selection.rangeCount === 0) {
      hideTranslateButton();
      return;
    }

    const rangeRect = selection.getRangeAt(0).getBoundingClientRect();
    const rootRect = viewerRootRef.current?.getBoundingClientRect();
    if (!rootRect || (!rangeRect.width && !rangeRect.height)) {
      hideTranslateButton();
      return;
    }

    const overlapsViewer =
      rangeRect.bottom >= rootRect.top &&
      rangeRect.top <= rootRect.bottom &&
      rangeRect.right >= rootRect.left &&
      rangeRect.left <= rootRect.right;

    if (!overlapsViewer) {
      hideTranslateButton();
      return;
    }

    const left = Math.min(
      Math.max(rangeRect.left - rootRect.left, 8),
      Math.max(rootRect.width - 110, 8)
    );
    const top = Math.min(
      Math.max(rangeRect.top - rootRect.top - 42, 8),
      Math.max(rootRect.height - 42, 8)
    );

    setTranslateTarget({
      text: selectedText.slice(0, 4000),
      left,
      top,
    });
  };

  const handleTranslateClick = () => {
    if (!translateTarget?.text) return;
    onTranslateRequest?.(translateTarget.text);
    window.getSelection()?.removeAllRanges();
    hideTranslateButton();
  };

  return (
    <div
      ref={viewerRootRef}
      onMouseUp={handleSelectionMouseUp}
      className="h-full w-full bg-[#F2EDE8] text-[#2C2420] flex flex-col relative"
    >
      <div className="h-14 px-4 border-b border-[#E8E2DB] bg-white flex items-center justify-between shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={currentPage <= 1 || !maxPages}
            className="px-3 py-2 text-sm font-medium rounded-lg bg-white text-[#2C2420] border border-[#E8E2DB] hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            上一页
          </button>
          <button
            type="button"
            onClick={handleNextPage}
            disabled={!maxPages || currentPage >= maxPages}
            className="px-3 py-2 text-sm font-medium rounded-lg bg-white text-[#2C2420] border border-[#E8E2DB] hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            下一页
          </button>
          <span className="text-sm text-[#8C7B6E]">
            第{currentPage}页/共{maxPages || 0}页
          </span>
        </div>

        <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={visualZoom <= MIN_SCALE}
              className="px-3 py-2 text-sm font-medium rounded-lg bg-white text-[#2C2420] border border-[#E8E2DB] hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              -
            </button>
          <span className="text-sm text-[#8C7B6E] w-14 text-center">{Math.round(visualZoom * 100)}%</span>
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={visualZoom >= MAX_SCALE}
            className="px-3 py-2 text-sm font-medium rounded-lg bg-white text-[#2C2420] border border-[#E8E2DB] hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            +
          </button>
        </div>
      </div>

      <div ref={pageContainerRef} className="flex-1 overflow-auto p-4">
        {error ? (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
        ) : (
          <div className="inline-block min-w-max">
            <Document
              file={file}
              options={documentOptions}
              onLoadSuccess={handleLoadSuccess}
              onLoadError={handleLoadError}
              loading={
                <div className="flex items-center gap-3 text-[#8C7B6E]">
                  <div className="animate-spin h-5 w-5 border-2 border-pink-400 border-t-transparent rounded-full" />
                  <span className="text-sm">PDF 加载中...</span>
                </div>
              }
            >
              <div
                style={{
                  transform: `scale(${zoom === 0 ? 1 : visualZoom / zoom})`,
                  transformOrigin: 'top left',
                  transition: 'transform 0.1s ease',
                  willChange: 'transform',
                }}
              >
                <Page
                  pageNumber={currentPage}
                  width={Math.max(Math.floor(fitWidth * zoom), 200)}
                  renderMode="canvas"
                  renderAnnotationLayer={false}
                  className="border border-[#E8E2DB] bg-white shadow-sm"
                  loading={null}
                  onLoadSuccess={handlePageRenderSuccess}
                  onRenderSuccess={handlePageRenderSuccess}
                />
              </div>
            </Document>
          </div>
        )}

        {isLoading && !error && (
          <div className="mt-3 text-xs text-[#8C7B6E] text-center">正在准备页面渲染...</div>
        )}
      </div>

      {translateTarget ? (
        <button
          type="button"
          onClick={handleTranslateClick}
          style={{ left: `${translateTarget.left}px`, top: `${translateTarget.top}px` }}
          className="absolute z-20 px-3 py-1.5 bg-pink-500 hover:bg-pink-600 text-[#2C2420] text-xs font-medium rounded-lg transition-colors duration-150 shadow-sm"
        >
          Translate
        </button>
      ) : null}
    </div>
  );
});

export default PDFViewer;
