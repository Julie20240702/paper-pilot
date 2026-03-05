import TabArguments from './TabArguments';
import TabChat from './TabChat';
import TabFigures from './TabFigures';
import NotesArea from './NotesArea';
import TabOverview from './TabOverview';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'arguments', label: 'Arguments' },
  { key: 'figures', label: 'Figures' },
  { key: 'chat', label: 'Chat' },
];

function AIPanel({
  activeTab = 'overview',
  onTabChange,
  analysis,
  analysisError,
  isAnalyzing,
  onJumpToPage,
  chatHistory,
  setChatHistory,
  paperText,
  translationResult,
  isTranslating,
  translateError,
  onClearTranslation,
  filename,
}) {
  const activeLabel = TABS.find((tab) => tab.key === activeTab)?.label || 'Overview';

  return (
    <div className="h-full w-full bg-[#FAFAF8] text-[#2C2420] flex flex-col overflow-hidden">
      <div className="h-14 shrink-0 border-b border-[#E8E2DB] bg-[#FAFAF8] px-2 flex items-end">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange?.(tab.key)}
              className={
                isActive
                  ? 'px-4 py-2 text-sm font-medium text-[#2C2420] border-b-2 border-pink-500 bg-transparent'
                  : 'px-4 py-2 text-sm font-medium text-[#8C7B6E] border-b-2 border-transparent hover:text-[#8C7B6E] hover:border-gray-300 bg-transparent'
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-auto p-4">
          {analysisError && !isAnalyzing ? (
            <div className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              {analysisError}
            </div>
          ) : null}

          {isTranslating ? (
            <div className="mb-4 bg-white rounded-xl p-3 border border-[#E8E2DB] shadow-sm">
              <div className="flex items-center gap-2 text-[#8C7B6E]">
                <div className="animate-spin h-4 w-4 border-2 border-pink-400 border-t-transparent rounded-full" />
                <span className="text-sm">Translating selected text...</span>
              </div>
            </div>
          ) : null}

          {translateError ? (
            <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              {translateError}
            </div>
          ) : null}

          {translationResult ? (
            <div className="mb-4 bg-white rounded-xl p-4 border border-[#E8E2DB] shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-[#8C7B6E] uppercase tracking-wider">
                  Translation Result
                </h3>
                <button
                  type="button"
                  onClick={() => onClearTranslation?.()}
                  className="text-xs text-[#8C7B6E] hover:text-[#8C7B6E] bg-transparent border-none"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-[#8C7B6E] mb-2 line-clamp-2">{translationResult.sourceText}</p>
              <p className="text-sm text-[#2C2420] leading-relaxed mb-3">
                {translationResult.translation || 'N/A'}
              </p>

              <h4 className="text-xs font-semibold text-[#8C7B6E] uppercase tracking-wider mb-2">Terms</h4>
              {Array.isArray(translationResult.terms) && translationResult.terms.length > 0 ? (
                <div className="space-y-2">
                  {translationResult.terms.map((termItem, index) => (
                    <div key={`term-${index}`} className="bg-[#F2EDE8] rounded-lg p-2 border border-[#E8E2DB]">
                      <p className="text-sm text-[#2C2420]">{termItem?.term || 'N/A'}</p>
                      <p className="text-sm text-[#8C7B6E]">{termItem?.explanation || 'N/A'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#8C7B6E]">No notable technical terms.</p>
              )}
            </div>
          ) : null}

          {activeTab === 'overview' ? (
            <TabOverview analysis={analysis} isAnalyzing={isAnalyzing} onJumpToPage={onJumpToPage} />
          ) : null}

          {activeTab === 'arguments' ? (
            <TabArguments analysis={analysis} isAnalyzing={isAnalyzing} onJumpToPage={onJumpToPage} />
          ) : null}

          {activeTab === 'figures' ? (
            <TabFigures analysis={analysis} isAnalyzing={isAnalyzing} onJumpToPage={onJumpToPage} />
          ) : null}

          {activeTab === 'chat' ? (
            <TabChat
              chatHistory={chatHistory}
              setChatHistory={setChatHistory}
              paperText={paperText}
              onJumpToPage={onJumpToPage}
            />
          ) : null}

          {activeTab !== 'overview' && activeTab !== 'arguments' && activeTab !== 'figures' && activeTab !== 'chat' ? (
            <div className="h-full rounded-xl border border-[#E8E2DB] bg-white shadow-sm flex items-center justify-center">
              <p className="text-sm text-[#8C7B6E]">{activeLabel} 内容 Coming Soon</p>
            </div>
          ) : null}
        </div>

        <NotesArea filename={filename} />
      </div>
    </div>
  );
}

export default AIPanel;
