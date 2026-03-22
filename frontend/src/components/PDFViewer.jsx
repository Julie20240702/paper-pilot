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

const normalizeForMatch = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    // remove common CJK and ASCII punctuation for more robust matching
    .replace(/[.,/#!$%^&*;:{}=\-_`~()'"\[\]<>?@\\|+，。！？；：、（）【】《》“”‘’·—…]/g, '');

const STOPWORDS = new Set([
  'the', 'and', 'that', 'with', 'from', 'this', 'were', 'have', 'their', 'they',
  'into', 'about', 'which', 'would', 'there', 'could', 'should', 'then', 'than',
  'because', 'while', 'where', 'when', 'what', 'been', 'being', 'after', 'before',
  'through', 'those', 'these', 'such', 'only', 'also', 'very', 'more', 'most',
  'some', 'much', 'many', 'your', 'you', 'his', 'her', 'its', 'our', 'for', 'not',
  'are', 'was', 'were', 'is', 'am', 'be', 'to', 'of', 'in', 'on', 'at', 'by', 'an',
  'a', 'or', 'as', 'it', 'but', 'if', 'we', 'he', 'she', 'them', 'theirs',
  '的', '是', '了', '在', '和', '与', '及', '或', '也', '就', '都', '而', '并', '把',
  '被', '对', '将', '其', '这', '那', '一个', '一种', '进行', '通过', '以及', '其中',
  '可以', '认为', '指出', '表示', '具有', '没有', '不是', '由于', '因为', '如果'
]);

function extractHighlightKeywords(quote) {
  const normalized = normalizeForMatch(quote);
  if (!normalized) return [];

  const englishTokens = normalized.match(/[a-z]{4,}/g) || [];
  const cjkChunks = normalized.match(/[\u4e00-\u9fff]{2,}/g) || [];
  const cjkTokens = cjkChunks.flatMap((chunk) => {
    if (chunk.length <= 4) return [chunk];
    const grams = [];
    for (let i = 0; i <= chunk.length - 3; i += 1) {
      grams.push(chunk.slice(i, i + 3));
    }
    return grams;
  });

  const scored = new Map();
  [...englishTokens, ...cjkTokens].forEach((token) => {
    if (STOPWORDS.has(token)) return;
    scored.set(token, (scored.get(token) || 0) + token.length);
  });

  return Array.from(scored.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([token]) => token);
}

const PDFViewer = forwardRef(function PDFViewer(
  { file, currentPage, totalPages, onPageChange, onTotalPagesLoad, onTranslateRequest },
  ref
) {
  const [viewMode, setViewMode] = useState('paged');
  const [zoom, setZoom] = useState(1.0);
  const [visualZoom, setVisualZoom] = useState(1.0);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatchCount, setSearchMatchCount] = useState(0);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadedPages, setLoadedPages] = useState(0);
  const [translateTarget, setTranslateTarget] = useState(null);
  const pageContainerRef = useRef(null);
  const viewerRootRef = useRef(null);
  const searchInputRef = useRef(null);
  const zoomDebounceRef = useRef(null);
  const intersectionObserverRef = useRef(null);
  const pendingScrollRef = useRef({ left: 0, top: 0 });
  const shouldRestoreScrollRef = useRef(false);
  const pendingHighlightRef = useRef(null);
  const highlightedNodesRef = useRef([]);
  const searchMatchesRef = useRef([]);
  const currentSearchIndexRef = useRef(0);
  const pageRefs = useRef(new Map());
  const pageVisibilityRef = useRef(new Map());
  const [fitWidth, setFitWidth] = useState(600);

  const maxPages = totalPages || loadedPages || 0;
  const isScrollMode = viewMode === 'scroll';

  const setPageRef = useCallback((pageNumber, node) => {
    if (node) {
      pageRefs.current.set(pageNumber, node);
      return;
    }
    pageRefs.current.delete(pageNumber);
    pageVisibilityRef.current.delete(pageNumber);
  }, []);

  const getTextLayerForPage = useCallback((pageNumber) => {
    if (!pageNumber) return null;
    const pageNode = pageRefs.current.get(pageNumber);
    return pageNode?.querySelector('.react-pdf__Page__textContent') || null;
  }, []);

  const jumpToPage = (pageNumber) => {
    if (!maxPages) {
      onPageChange?.(Math.max(1, pageNumber));
      return;
    }
    const safePage = Math.min(Math.max(pageNumber, 1), maxPages);
    if (isScrollMode) {
      const pageNode = pageRefs.current.get(safePage);
      if (pageNode) {
        pageNode.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    }
    onPageChange?.(safePage);
  };

  const clearActiveHighlights = useCallback(() => {
    highlightedNodesRef.current.forEach((node) => {
      node.style.backgroundColor = '';
      node.style.borderRadius = '';
    });
    highlightedNodesRef.current = [];
  }, []);

  const clearSearchHighlights = useCallback(() => {
    searchMatchesRef.current.flat().forEach((node) => {
      node.style.boxShadow = '';
      node.style.borderRadius = '';
    });
    searchMatchesRef.current = [];
  }, []);

  const paintSearchMatches = useCallback((matches, activeIndex) => {
    clearSearchHighlights();
    matches.forEach((nodes, matchIndex) => {
      const shadowColor =
        matchIndex === activeIndex
          ? 'inset 0 0 0 9999px rgba(217, 70, 168, 0.28)'
          : 'inset 0 0 0 9999px rgba(217, 70, 168, 0.14)';
      nodes.forEach((node) => {
        node.style.boxShadow = shadowColor;
        node.style.borderRadius = '2px';
      });
    });
    searchMatchesRef.current = matches;
  }, [clearSearchHighlights]);

  const runSearchOnCurrentPage = useCallback((rawQuery) => {
    const normalizedQuery = normalizeForMatch(rawQuery);
    if (!normalizedQuery) {
      clearSearchHighlights();
      setSearchMatchCount(0);
      setCurrentSearchIndex(0);
      currentSearchIndexRef.current = 0;
      return;
    }

    const textLayer = getTextLayerForPage(currentPage);
    if (!textLayer) return;

    const spans = Array.from(textLayer.querySelectorAll('span'));
    if (spans.length === 0) return;

    const normalizedParts = spans.map((span) => normalizeForMatch(span.textContent));
    const fullChars = [];
    const charToSpanIndex = [];

    normalizedParts.forEach((part, spanIndex) => {
      if (!part) return;
      if (fullChars.length > 0) {
        fullChars.push(' ');
        charToSpanIndex.push(-1);
      }
      for (const char of part) {
        fullChars.push(char);
        charToSpanIndex.push(spanIndex);
      }
    });

    const fullText = fullChars.join('');
    const matches = [];
    let searchStart = 0;

    while (searchStart < fullText.length) {
      const matchStart = fullText.indexOf(normalizedQuery, searchStart);
      if (matchStart === -1) break;

      const matchEnd = matchStart + normalizedQuery.length;
      const spanIndexes = new Set();
      for (let index = matchStart; index < matchEnd; index += 1) {
        const spanIndex = charToSpanIndex[index];
        if (spanIndex >= 0) {
          spanIndexes.add(spanIndex);
        }
      }

      const matchedNodes = Array.from(spanIndexes)
        .sort((a, b) => a - b)
        .map((spanIndex) => spans[spanIndex]);

      if (matchedNodes.length > 0) {
        matches.push(matchedNodes);
      }

      searchStart = matchStart + Math.max(1, normalizedQuery.length);
    }

    setSearchMatchCount(matches.length);
    if (matches.length === 0) {
      clearSearchHighlights();
      setCurrentSearchIndex(0);
      currentSearchIndexRef.current = 0;
      return;
    }

    const nextActiveIndex = Math.min(currentSearchIndexRef.current, matches.length - 1);
    setCurrentSearchIndex(nextActiveIndex);
    currentSearchIndexRef.current = nextActiveIndex;
    paintSearchMatches(matches, nextActiveIndex);
    matches[nextActiveIndex]?.[0]?.scrollIntoView({ block: 'center', inline: 'nearest' });
  }, [clearSearchHighlights, currentPage, getTextLayerForPage, paintSearchMatches]);

  const applyHighlightToCurrentTextLayer = useCallback((quote) => {
    const keywords = extractHighlightKeywords(quote);
    if (keywords.length === 0) return false;

    const textLayer = getTextLayerForPage(currentPage);
    if (!textLayer) return false;

    const spans = Array.from(textLayer.querySelectorAll('span'));
    if (spans.length === 0) return false;

    const normalizedParts = spans.map((span) => normalizeForMatch(span.textContent));
    const windowSize = Math.min(18, Math.max(6, Math.ceil(spans.length / 12)));
    let bestStart = -1;
    let bestEnd = -1;
    let bestScore = 0;

    for (let start = 0; start < normalizedParts.length; start += 1) {
      const end = Math.min(normalizedParts.length, start + windowSize);
      const windowText = normalizedParts.slice(start, end).join(' ');
      let score = 0;

      keywords.forEach((keyword) => {
        if (windowText.includes(keyword)) {
          score += keyword.length;
        }
      });

      if (score > bestScore) {
        bestScore = score;
        bestStart = start;
        bestEnd = end;
      }
    }

    if (bestStart === -1 || bestScore === 0) return false;

    const matchedNodes = spans.slice(bestStart, bestEnd).filter((node, index) => {
      const normalizedText = normalizedParts[bestStart + index];
      return keywords.some((keyword) => normalizedText.includes(keyword));
    });

    if (matchedNodes.length === 0) return false;

    clearActiveHighlights();
    matchedNodes.forEach((node) => {
      node.style.backgroundColor = 'rgba(255, 213, 0, 0.4)';
      node.style.borderRadius = '2px';
    });
    highlightedNodesRef.current = matchedNodes;
    return true;
  }, [clearActiveHighlights, currentPage, getTextLayerForPage]);

  const tryApplyPendingHighlight = useCallback((attempt = 0) => {
    const pending = pendingHighlightRef.current;
    if (!pending) return;
    if (pending.page !== currentPage) return;

    const applied = applyHighlightToCurrentTextLayer(pending.quote);
    if (applied) {
      pendingHighlightRef.current = null;
      return;
    }

    if (attempt < 12) {
      setTimeout(() => tryApplyPendingHighlight(attempt + 1), 80);
    }
  }, [applyHighlightToCurrentTextLayer, currentPage]);

  const highlightText = useCallback((pageNumber, quote) => {
    clearActiveHighlights();
    pendingHighlightRef.current = { page: Math.max(1, pageNumber), quote: String(quote || '') };
    jumpToPage(pageNumber);
    setTimeout(() => tryApplyPendingHighlight(0), 0);
  }, [clearActiveHighlights, tryApplyPendingHighlight]);

  useImperativeHandle(
    ref,
    () => ({
      onJumpToPage: jumpToPage,
      highlightText,
    }),
    [jumpToPage, highlightText]
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

  const handleToggleViewMode = () => {
    setViewMode((prev) => (prev === 'paged' ? 'scroll' : 'paged'));
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

  const handleOpenSearch = () => {
    setIsSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  const handleCloseSearch = useCallback(() => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setSearchMatchCount(0);
    setCurrentSearchIndex(0);
    currentSearchIndexRef.current = 0;
    clearSearchHighlights();
  }, [clearSearchHighlights]);

  const handleSearchNavigation = useCallback((direction) => {
    if (searchMatchesRef.current.length === 0) return;
    const nextIndex =
      (currentSearchIndexRef.current + direction + searchMatchesRef.current.length) %
      searchMatchesRef.current.length;
    currentSearchIndexRef.current = nextIndex;
    setCurrentSearchIndex(nextIndex);
    paintSearchMatches(searchMatchesRef.current, nextIndex);
    searchMatchesRef.current[nextIndex]?.[0]?.scrollIntoView({
      block: 'center',
      inline: 'nearest',
    });
  }, [paintSearchMatches]);

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

  useEffect(() => {
    currentSearchIndexRef.current = currentSearchIndex;
  }, [currentSearchIndex]);

  useEffect(() => {
    if (!isSearchOpen) return undefined;

    const handleWindowKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      handleCloseSearch();
    };

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown);
    };
  }, [handleCloseSearch, isSearchOpen]);

  useEffect(() => () => {
    if (zoomDebounceRef.current) {
      clearTimeout(zoomDebounceRef.current);
      zoomDebounceRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isSearchOpen) return;
    const timer = setTimeout(() => {
      runSearchOnCurrentPage(searchQuery);
    }, 0);
    return () => clearTimeout(timer);
  }, [currentPage, isSearchOpen, runSearchOnCurrentPage, searchQuery]);

  useEffect(() => {
    const container = pageContainerRef.current;
    if (!container || !isScrollMode || !maxPages) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const pageNumber = Number(entry.target.getAttribute('data-page-number'));
          if (!pageNumber) return;
          pageVisibilityRef.current.set(pageNumber, entry.isIntersecting ? entry.intersectionRatio : 0);
        });

        let bestPage = currentPage;
        let bestRatio = 0;
        pageVisibilityRef.current.forEach((ratio, pageNumber) => {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestPage = pageNumber;
          }
        });

        if (bestRatio > 0 && bestPage !== currentPage) {
          onPageChange?.(bestPage);
        }
      },
      {
        root: container,
        threshold: [0.1, 0.25, 0.5, 0.75],
      }
    );

    intersectionObserverRef.current = observer;
    pageRefs.current.forEach((node) => observer.observe(node));

    return () => {
      observer.disconnect();
      intersectionObserverRef.current = null;
    };
  }, [currentPage, isScrollMode, maxPages, onPageChange]);

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
    if (isSearchOpen && searchQuery.trim()) {
      setTimeout(() => runSearchOnCurrentPage(searchQuery), 0);
    }
    if (!shouldRestoreScrollRef.current) {
      tryApplyPendingHighlight(0);
      return;
    }

    const container = pageContainerRef.current;
    if (!container) return;

    const { left, top } = pendingScrollRef.current;
    requestAnimationFrame(() => {
      container.scrollTo({ left, top });
      shouldRestoreScrollRef.current = false;
      tryApplyPendingHighlight(0);
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

  useEffect(() => () => {
    clearActiveHighlights();
    clearSearchHighlights();
  }, [clearActiveHighlights, clearSearchHighlights]);

  return (
    <div
      ref={viewerRootRef}
      onMouseUp={handleSelectionMouseUp}
      className="h-full w-full bg-[#F2EDE8] text-[#2C2420] flex flex-col relative"
    >
      <div className="h-14 px-4 border-b border-[#E8E2DB] bg-white flex items-center justify-between shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2">
          {!isScrollMode ? (
            <>
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
            </>
          ) : null}
          <span className="text-sm text-[#8C7B6E]">
            第{currentPage}页/共{maxPages || 0}页
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleViewMode}
            className="px-3 py-2 text-sm font-medium rounded-lg bg-white text-[#2C2420] border border-[#E8E2DB] hover:bg-gray-50"
          >
            {isScrollMode ? '📜 滚动' : '📄 翻页'}
          </button>
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
          {!isSearchOpen ? (
            <button
              type="button"
              onClick={handleOpenSearch}
              className="px-3 py-2 text-sm font-medium rounded-lg bg-white text-[#2C2420] border border-[#E8E2DB] hover:bg-gray-50"
            >
              🔍
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-[#E8E2DB] bg-white px-2 py-1">
              <span className="text-sm text-[#8C7B6E]">🔍</span>
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleSearchNavigation(event.shiftKey ? -1 : 1);
                  }
                }}
                placeholder="搜索当前页"
                className="w-36 bg-transparent text-sm text-[#2C2420] outline-none"
              />
              <span className="min-w-20 text-center text-xs text-[#8C7B6E]">
                {searchMatchCount > 0 ? `第${currentSearchIndex + 1}处/共${searchMatchCount}处` : '0 结果'}
              </span>
              <button
                type="button"
                onClick={() => handleSearchNavigation(-1)}
                disabled={searchMatchCount === 0}
                className="text-sm text-[#8C7B6E] disabled:opacity-40"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => handleSearchNavigation(1)}
                disabled={searchMatchCount === 0}
                className="text-sm text-[#8C7B6E] disabled:opacity-40"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={handleCloseSearch}
                className="text-sm text-[#8C7B6E]"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      <div ref={pageContainerRef} className="flex-1 overflow-auto p-4">
        {error ? (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
        ) : (
          <div className={`min-w-max ${isScrollMode ? 'block' : 'inline-block'}`}>
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
                className={isScrollMode ? 'flex flex-col gap-2' : undefined}
              >
                {isScrollMode
                  ? Array.from({ length: maxPages }, (_, index) => {
                    const pageNumber = index + 1;
                    return (
                      <div
                        key={`page-${pageNumber}`}
                        ref={(node) => setPageRef(pageNumber, node)}
                        data-page-number={pageNumber}
                      >
                        <Page
                          pageNumber={pageNumber}
                          width={Math.max(Math.floor(fitWidth * zoom), 200)}
                          renderMode="canvas"
                          renderTextLayer
                          renderAnnotationLayer={false}
                          className="border border-[#E8E2DB] bg-white shadow-sm"
                          loading={null}
                          onLoadSuccess={handlePageRenderSuccess}
                          onRenderSuccess={handlePageRenderSuccess}
                        />
                      </div>
                    );
                  })
                  : (
                    <div
                      ref={(node) => setPageRef(currentPage, node)}
                      data-page-number={currentPage}
                    >
                      <Page
                        pageNumber={currentPage}
                        width={Math.max(Math.floor(fitWidth * zoom), 200)}
                        renderMode="canvas"
                        renderTextLayer
                        renderAnnotationLayer={false}
                        className="border border-[#E8E2DB] bg-white shadow-sm"
                        loading={null}
                        onLoadSuccess={handlePageRenderSuccess}
                        onRenderSuccess={handlePageRenderSuccess}
                      />
                    </div>
                  )}
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
