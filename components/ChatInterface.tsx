
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Send, Bot, User, Trash2, Sparkles, Copy, Download, MessageSquare, Maximize2, X, Edit3, Eye } from 'lucide-react';
import { VideoState, ChatMessage } from '../types';
import { sendChatMessage } from '../services/geminiService';
import MarkdownRenderer from './MarkdownRenderer';

export interface ChatInterfaceProps {
  videoA?: VideoState;
  videoB?: VideoState;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  isLoadingExternal: boolean;
  className?: string;
  emptyStateTitle?: string;
  emptyStateDescription?: React.ReactNode;
  emptyStateIcon?: React.ReactNode;
}

// --- Independent Message Detail Window ---
interface MessageDetailWindowProps {
  message: ChatMessage;
  onClose: () => void;
  focusTrigger?: number;
}

const MessageDetailWindow: React.FC<MessageDetailWindowProps> = ({ message, onClose, focusTrigger }) => {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [viewMode, setViewMode] = useState<'source' | 'preview'>('preview');
  const windowRef = useRef<Window | null>(null);

  // Focus effect
  useEffect(() => {
    if (windowRef.current && !windowRef.current.closed) {
        windowRef.current.focus();
    }
  }, [focusTrigger]);

  useEffect(() => {
    const width = 900;
    const height = 800;
    const left = (window.screen.availWidth - width) / 2;
    const top = (window.screen.availHeight - height) / 2;

    const win = window.open('', '', `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`);
    
    if (win) {
      windowRef.current = win;
      win.document.title = `AI 回复详情 - ScriptMaster AI`;

      const tailwindScript = win.document.createElement('script');
      tailwindScript.src = "https://cdn.tailwindcss.com";
      win.document.head.appendChild(tailwindScript);

      const styleElement = win.document.createElement('style');
      styleElement.textContent = `
        body { background-color: #0f172a; color: #f8fafc; margin: 0; font-family: 'Inter', sans-serif; overflow: hidden; }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #1e293b; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #64748b; }
      `;
      win.document.head.appendChild(styleElement);

      const div = win.document.createElement('div');
      div.style.height = '100vh';
      div.style.display = 'flex';
      div.style.flexDirection = 'column';
      win.document.body.appendChild(div);
      setContainer(div);

      win.onbeforeunload = () => {
        onClose();
      };
    } else {
      alert("请允许弹出窗口以查看详情。");
      onClose();
    }

    return () => {
      if (windowRef.current) {
        windowRef.current.close();
      }
    };
  }, []); 

  const copyToClipboard = () => {
      navigator.clipboard.writeText(message.content);
  };

  if (!container) return null;

  return createPortal(
    <div className="flex flex-col h-full bg-slate-950 w-full animate-in fade-in duration-300">
      {/* Header */}
      <div className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 shrink-0 shadow-md z-10">
        <div className="flex items-center gap-3 overflow-hidden">
          <Bot className="text-sky-400 shrink-0" size={24} />
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-100 truncate">AI 回复详情</h2>
            <p className="text-xs text-slate-500">
               生成时间: {new Date(message.timestamp).toLocaleString('zh-CN')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
            {/* View Toggle Group */}
            <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700 mr-2">
                <button
                    onClick={() => setViewMode('source')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        viewMode === 'source' 
                        ? 'bg-slate-700 text-white shadow-sm' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                    <Edit3 size={14} /> 源文
                </button>
                <button
                    onClick={() => setViewMode('preview')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        viewMode === 'preview' 
                        ? 'bg-indigo-600 text-white shadow-sm' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                    <Eye size={14} /> 预览
                </button>
            </div>

            <button
              onClick={copyToClipboard}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors text-xs font-medium"
              title="复制全部内容"
            >
              <Copy size={14} /> 复制
            </button>
            <button
              onClick={() => windowRef.current?.close()}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-600/10 hover:bg-red-600 hover:text-white text-red-500 rounded-lg border border-red-600/20 transition-all text-xs font-medium"
            >
              <X size={14} /> 关闭窗口
            </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative bg-slate-950">
         {viewMode === 'source' ? (
             <textarea
                readOnly
                value={message.content}
                className="w-full h-full bg-slate-900 text-slate-300 font-mono text-sm p-6 resize-none focus:outline-none custom-scrollbar"
                style={{ border: 'none' }}
             />
         ) : (
             <div className="w-full h-full overflow-y-auto p-8 custom-scrollbar">
                <div className="max-w-5xl mx-auto">
                    <MarkdownRenderer content={message.content} />
                </div>
             </div>
         )}
      </div>
    </div>,
    container
  );
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  videoA, 
  videoB, 
  messages, 
  setMessages,
  isLoadingExternal,
  className = "h-[600px]",
  emptyStateTitle = "准备就绪",
  emptyStateDescription = (
    <>
      请在左侧上传视频并点击“开始融合生成”。<br/>
      生成后，您可以继续在此处与 AI 对话，例如：<br/>
      <span className="text-sky-500/80">“把结尾改得更有悬念一点”</span> 或 <span className="text-sky-500/80">“给我推荐几首适合的 BGM”</span>。
    </>
  ),
  emptyStateIcon = <Sparkles size={48} className="mb-6 opacity-20 text-indigo-500" />
}) => {
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Single Message Detail State
  const [viewingMessage, setViewingMessage] = useState<ChatMessage | null>(null);
  const [detailFocusTrigger, setDetailFocusTrigger] = useState(0);

  const scrollToBottom = () => {
    setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoadingExternal, isSending]);

  // --- Chat Logic ---

  const handleSend = async () => {
    if (!input.trim() || isSending || isLoadingExternal) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsSending(true);

    try {
      // Pass videoA and videoB if they exist
      const responseText = await sendChatMessage(
        messages, 
        userMsg.content,
        (videoA && videoA.file) || (videoB && videoB.file) ? { videoA, videoB } : undefined
      );

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: responseText,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, botMsg]);

    } catch (error) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: "抱歉，出错了，请稍后再试。",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const downloadContent = (content: string, id: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `script-export-${id}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleViewDetail = (msg: ChatMessage) => {
    // Only allow popping out model messages (the responses)
    if (msg.role !== 'model') return;

    if (viewingMessage?.id === msg.id) {
        setDetailFocusTrigger(prev => prev + 1);
    } else {
        setViewingMessage(msg);
        setDetailFocusTrigger(0);
    }
  };

  const isLoading = isSending || isLoadingExternal;

  return (
    <div className={`bg-slate-900 flex flex-col relative ${className}`}>
      
      {/* Header Actions (Clear) */}
      <div className="absolute top-4 right-6 z-20">
        <button 
            onClick={() => setMessages([])} 
            className="text-slate-600 hover:text-red-400 p-2 transition-colors bg-slate-900/50 rounded-full hover:bg-slate-800 backdrop-blur-sm border border-transparent hover:border-red-500/30"
            title="清空对话"
        >
            <Trash2 size={16} />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar bg-slate-950">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 text-center px-6 mt-10">
            {emptyStateIcon}
            <h4 className="text-lg font-semibold text-slate-300 mb-2">{emptyStateTitle}</h4>
            <p className="text-sm max-w-md leading-relaxed">
              {emptyStateDescription}
            </p>
            <p className="text-xs mt-6 text-slate-600 border border-slate-800 rounded px-2 py-1">
                Tip: 双击 AI 回复内容可在独立窗口中查看详情
            </p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 ${
              msg.role === 'user' ? 'flex-row-reverse' : ''
            }`}
          >
            {/* Avatar */}
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-lg ${
                msg.role === 'user' 
                  ? 'bg-gradient-to-br from-indigo-500 to-purple-600' 
                  : 'bg-gradient-to-br from-sky-500 to-blue-600'
              }`}
            >
              {msg.role === 'user' ? <User size={14} className="text-white" /> : <Bot size={14} className="text-white" />}
            </div>

            {/* Message Bubble */}
            <div
              onDoubleClick={() => handleViewDetail(msg)}
              className={`max-w-[95%] sm:max-w-[85%] rounded-2xl shadow-md overflow-hidden group transition-all ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-none px-5 py-3'
                  : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700 hover:border-slate-600 hover:shadow-lg cursor-pointer'
              }`}
              title={msg.role === 'model' ? "双击放大查看" : ""}
            >
              {msg.role === 'model' ? (
                <div className="relative">
                    {/* Message Actions */}
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800/90 backdrop-blur rounded-lg border border-slate-700 p-1 z-10 shadow-lg">
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleViewDetail(msg); }}
                            className="p-1.5 hover:bg-slate-700 rounded text-sky-400 hover:text-sky-300 transition-colors"
                            title="放大/独立窗口"
                        >
                            <Maximize2 size={14} />
                        </button>
                        <div className="w-px h-3 bg-slate-700 my-auto mx-0.5"></div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); copyToClipboard(msg.content); }}
                            className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                            title="复制"
                        >
                            <Copy size={14} />
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); downloadContent(msg.content, msg.id); }}
                            className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                            title="下载文本(Markdown)"
                        >
                            <Download size={14} />
                        </button>
                    </div>
                    <div className="p-5 select-text">
                         <MarkdownRenderer content={msg.content} />
                    </div>
                </div>
              ) : (
                <div className="whitespace-pre-wrap select-text">{msg.content}</div>
              )}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex items-start gap-4 animate-pulse">
             <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                <Bot size={14} className="text-slate-400" />
             </div>
             <div className="bg-slate-800 rounded-2xl rounded-tl-none px-6 py-4 border border-slate-700 flex items-center gap-2">
                <span className="text-sm text-slate-400">ScriptMaster 正在思考创作中...</span>
                <div className="flex gap-1 ml-2">
                  <span className="w-1.5 h-1.5 bg-sky-500 rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-sky-500 rounded-full animate-bounce delay-100"></span>
                  <span className="w-1.5 h-1.5 bg-sky-500 rounded-full animate-bounce delay-200"></span>
                </div>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 sm:p-6 bg-slate-900 border-t border-slate-800 shrink-0 relative z-10">
        <div className="relative max-w-4xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={messages.length === 0 ? "请先上传视频并生成脚本..." : "对脚本不满意？输入修改指令（如：让开头更吸引人）"}
            disabled={isLoading}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-5 pr-14 py-4 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-inner disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-lg transition-all ${
              !input.trim() || isLoading
                ? 'text-slate-600 cursor-not-allowed bg-transparent'
                : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/20'
            }`}
          >
            <Send size={18} />
          </button>
        </div>
        <p className="text-center text-[10px] text-slate-600 mt-3 font-mono">
           AI 生成内容可能包含错误，请人工核对后使用。
        </p>
      </div>

      {/* Detail Window Instance */}
      {viewingMessage && (
        <MessageDetailWindow 
           message={viewingMessage} 
           onClose={() => setViewingMessage(null)} 
           focusTrigger={detailFocusTrigger}
        />
      )}
    </div>
  );
};

export default ChatInterface;
