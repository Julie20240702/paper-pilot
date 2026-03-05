import { useEffect, useRef, useState } from 'react';
import { renderWithCitations } from '../utils/renderWithCitations.jsx';

const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'https://paper-pilot-backend-dppl.onrender.com';

const BUILT_IN_PROMPTS = [
  {
    label: '📝 文献综述助手',
    text: '我正在写一篇关于[你的研究主题]的文献综述。请分析这篇论文：①核心论点和结论 ②研究方法和样本 ③与该领域其他研究的关系 ④这篇论文可以支持什么论点 ⑤建议的引用格式和适合放在综述哪个部分',
  },
  {
    label: '🎓 导师式解读',
    text: '你是一位耐心的资深导师。请用通俗易懂的中文帮我理解这篇论文。遇到专业术语先用生活例子解释，再给学术定义。重点讲：这篇研究解决了什么问题、用了什么方法、得到了什么结论、为什么这个结论重要',
  },
  {
    label: '🔍 批判性分析',
    text: '请从批判性角度分析这篇论文：①研究设计有哪些局限性 ②样本或数据有什么不足 ③结论是否过度推断 ④作者没有考虑到的变量 ⑤如果你是审稿人会提什么意见',
  },
  {
    label: '🧪 实验方法精读',
    text: '请详细解析这篇论文的研究方法：①研究设计类型 ②样本来源和抽样方式 ③具体实验步骤和操作 ④数据收集和分析方法 ⑤如何复现这个实验',
  },
  {
    label: '⚡ 快速三问',
    text: '用最简洁的语言回答三个问题：①这篇论文解决了什么问题？②作者用什么方法解决的？③得到了什么结论？每个问题不超过3句话',
  },
  {
    label: '💡 研究启发',
    text: '基于这篇论文，请帮我思考：①这篇研究对我的研究方向有什么直接启发 ②有哪些可以延伸的研究方向 ③这篇论文的方法可以用在哪些新场景 ④如果要做后续研究应该关注什么问题',
  },
];

function TabChat({ chatHistory, setChatHistory, paperText, onJumpToPage }) {
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isSending]);

  const handleSend = async () => {
    const question = input.trim();
    if (!question || isSending || !paperText?.trim()) return;

    const nextHistory = [...(Array.isArray(chatHistory) ? chatHistory : [])];
    const userMessage = { role: 'user', content: question };
    nextHistory.push(userMessage);

    setChatHistory?.(nextHistory);
    setInput('');
    setIsSending(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          paperText,
          conversationHistory: nextHistory.slice(0, -1),
        }),
      });

      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Something went wrong. Please try again.');
      }

      setChatHistory?.((prev) => [
        ...(Array.isArray(prev) ? prev : []),
        { role: 'assistant', content: result.response || '' },
      ]);
    } catch (error) {
      console.error('Chat send failed:', error);
      setChatHistory?.((prev) => [
        ...(Array.isArray(prev) ? prev : []),
        {
          role: 'assistant',
          content: error?.message || 'Something went wrong. Please try again.',
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (event) => {
    if (isComposing || event.nativeEvent?.isComposing) {
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full w-full flex flex-col min-h-0 bg-[#FAFAF8]">
      <div className="flex-1 min-h-0 overflow-auto pr-1 space-y-3">
        {(Array.isArray(chatHistory) ? chatHistory : []).map((message, index) => {
          const isUser = message?.role === 'user';
          return (
            <div
              key={`message-${index}`}
              className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 border ${
                  isUser
                    ? 'bg-pink-500 border-pink-500 text-white text-sm'
                    : 'bg-gray-100 border-[#E8E2DB] text-[#2C2420] text-sm whitespace-pre-wrap'
                }`}
              >
                {isUser ? message?.content : renderWithCitations(message?.content, onJumpToPage)}
              </div>
            </div>
          );
        })}

        {isSending ? (
          <div className="w-full flex justify-start">
            <div className="max-w-[85%] rounded-lg px-3 py-2 border bg-gray-100 border-[#E8E2DB] text-[#2C2420] text-sm">
              <div className="flex items-center gap-2">
                <div className="animate-spin h-4 w-4 border-2 border-pink-400 border-t-transparent rounded-full" />
                <span>Thinking...</span>
              </div>
            </div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <div className="mt-3 shrink-0">
        {!paperText?.trim() ? (
          <p className="text-xs text-[#8C7B6E] mb-2">Analyze a PDF first to enable chat.</p>
        ) : null}

        <div className="mb-2">
          <div className="text-xs text-[#8C7B6E] mb-1">内置提问模板</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {BUILT_IN_PROMPTS.map((prompt, index) => (
              <button
                key={`prompt-${index}`}
                type="button"
                onClick={() => setInput(prompt.text)}
                disabled={isSending || !paperText?.trim()}
                className="shrink-0 px-2.5 py-1.5 text-xs rounded-md bg-white border border-[#E8E2DB] text-[#8C7B6E] hover:border-pink-400 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                title={prompt.text}
              >
                {prompt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            placeholder="Ask a question about this paper..."
            rows={2}
            className="w-full bg-white border border-[#E8E2DB] rounded-lg p-3 text-sm text-[#2C2420] placeholder-gray-400 focus:outline-none focus:border-pink-400 focus:ring-1 focus:ring-pink-400 resize-none shadow-sm"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending || !input.trim() || !paperText?.trim()}
            className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white text-sm font-medium rounded-lg transition-colors duration-150 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default TabChat;
