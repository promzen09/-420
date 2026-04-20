
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Copy, Eye, Edit3, X } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

interface ExpandableTextAreaProps {
  label: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  className?: string; // height etc
  enablePreview?: boolean;
  onTimestampClick?: (seconds: number) => void; // New prop for video seeking
}

const ExpandableTextArea: React.FC<ExpandableTextAreaProps> = ({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  className = "h-32",
  enablePreview = false,
  onTimestampClick
}) => {
  const [isPoppedOut, setIsPoppedOut] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [externalContainer, setExternalContainer] = useState<HTMLElement | null>(null);
  const externalWindowRef = useRef<Window | null>(null);

  // Auto-switch to preview if enabled and has content
  useEffect(() => {
    if (isPoppedOut && enablePreview && value) {
      setViewMode('preview');
    } else if (isPoppedOut && !value) {
      setViewMode('edit');
    }
  }, [isPoppedOut, enablePreview]);

  // Handle opening the external window
  const openExternalWindow = () => {
    // 1. Determine initial size and position
    
    // --- SIZE CALCULATION (Same as before: Match Right Content Area) ---
    const sidebarWidth = 380; 
    const headerHeight = 64;
    
    // Default dimensions: Fill the intended right side area
    let width = window.innerWidth - sidebarWidth;
    let height = window.innerHeight - headerHeight;
    
    // Safety clamp
    if (width < 320) width = 800;
    if (height < 300) height = 600;

    // --- POSITION CALCULATION (Modified: Align to Rightmost of Screen) ---
    // window.screen.availWidth gives the total usable width of the screen.
    // Placing it at (availWidth - width) ensures it hugs the right edge.
    let left = window.screen.availWidth - width;
    
    // Top position remains calculated to sit below the header area relative to the screen top,
    // assuming the user wants it vertically aligned similar to the browser content.
    const chromeHeight = window.outerHeight - window.innerHeight;
    let top = window.screenY + chromeHeight + headerHeight;

    try {
      const saved = localStorage.getItem('scriptmaster_window_rect');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Valid saved state overrides defaults
        if (parsed.width && parsed.height) {
            width = parsed.width;
            height = parsed.height;
            left = parsed.left;
            top = parsed.top;
        }
      }
    } catch (e) {
      console.error("Error reading window state", e);
    }

    // 2. Open the new browser window with specific coordinates
    const featureString = `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`;
    const newWindow = window.open('', '', featureString);
    
    if (newWindow) {
      externalWindowRef.current = newWindow;
      
      // 3. Set Title
      newWindow.document.title = "脚本详情查看 - ScriptMaster AI";
      
      // 4. Inject Tailwind CSS
      const tailwindScript = newWindow.document.createElement('script');
      tailwindScript.src = "https://cdn.tailwindcss.com";
      newWindow.document.head.appendChild(tailwindScript);

      // 5. Inject Base Styles and Critical Layout CSS
      const styleElement = newWindow.document.createElement('style');
      styleElement.textContent = `
        body {
          background-color: #0f172a; /* slate-950 */
          color: #f8fafc; /* slate-50 */
          margin: 0;
          font-family: 'Inter', sans-serif;
          overflow: hidden; 
        }
        
        /* CRITICAL: Enforce Flex layout immediately before Tailwind loads */
        .popout-header {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            height: 64px !important;
            background-color: #0f172a !important;
            border-bottom: 1px solid #1e293b !important;
            padding: 0 24px !important;
            width: 100% !important;
            box-sizing: border-box !important;
        }
        .popout-header-left {
            display: flex !important;
            align-items: center !important;
            gap: 16px !important;
        }
        .popout-header-right {
            display: flex !important;
            align-items: center !important;
            gap: 12px !important;
        }
        .popout-toggle-group {
            display: flex !important;
            align-items: center !important;
            background-color: #1e293b !important;
            border: 1px solid #334155 !important;
            border-radius: 8px !important;
            padding: 4px !important;
            margin-right: 8px !important;
        }

        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `;
      newWindow.document.head.appendChild(styleElement);

      // 6. Inject Persistence Script (The "Brain" of the window memory)
      // This runs INSIDE the popped out window, so it works even if React re-renders/unmounts
      const persistenceScript = newWindow.document.createElement('script');
      persistenceScript.textContent = `
        (function() {
            function saveState() {
                try {
                    // Save global window position and size
                    const state = {
                        width: window.outerWidth,
                        height: window.outerHeight,
                        left: window.screenX,
                        top: window.screenY
                    };
                    localStorage.setItem('scriptmaster_window_rect', JSON.stringify(state));
                } catch(e) { console.error(e); }
            }

            // Save on window close
            window.addEventListener('beforeunload', saveState);

            // Poll every 1 second to capture position changes (drag to other screen)
            // Browsers don't always fire a 'move' event, so polling is robust.
            setInterval(saveState, 1000);
        })();
      `;
      newWindow.document.body.appendChild(persistenceScript);

      // 7. Create Container for React Portal
      const container = newWindow.document.createElement('div');
      container.style.height = '100vh';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      newWindow.document.body.appendChild(container);
      setExternalContainer(container);
      setIsPoppedOut(true);

      // 8. Handle Window Close Event (Manual X click) - React side cleanup
      newWindow.onbeforeunload = () => {
        // We don't need to save here, the injected script handles saving.
        // We just clean up React state.
        setIsPoppedOut(false);
        setExternalContainer(null);
        externalWindowRef.current = null;
      };
    }
  };

  const closeExternalWindow = () => {
    if (externalWindowRef.current) {
      // The injected script will save state via beforeunload, but we can double check
      externalWindowRef.current.close();
      externalWindowRef.current = null;
    }
    setIsPoppedOut(false);
    setExternalContainer(null);
  };

  const copyToClipboard = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(value);
  };

  // Content to render inside the portal
  const PoppedOutContent = (
    <div className="flex flex-col h-full bg-slate-950 w-full animate-in fade-in duration-300">
      {/* Top Bar inside New Window */}
      <div className="popout-header h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 shrink-0 shadow-md">
        <div className="popout-header-left flex items-center gap-4">
           <div className="text-lg font-bold text-slate-100 flex items-center gap-2">
              {label}
           </div>
        </div>

        <div className="popout-header-right flex items-center gap-3">
             {enablePreview && (
                <div className="popout-toggle-group flex bg-slate-800 rounded-lg p-1 border border-slate-700 mr-2">
                  <button
                    onClick={() => setViewMode('edit')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      viewMode === 'edit' 
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
              )}

            <button
              onClick={(e) => copyToClipboard(e)}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors text-xs font-medium"
            >
              <Copy size={14} /> 复制
            </button>
            <button
              onClick={closeExternalWindow}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-600/10 hover:bg-red-600 hover:text-white text-red-500 rounded-lg border border-red-600/20 transition-all text-xs font-medium"
            >
              <X size={14} /> 关闭窗口
            </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
          {viewMode === 'edit' ? (
             <div className="w-full h-full p-6">
                 <textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full h-full bg-slate-900/50 border border-slate-800 rounded-xl p-6 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none leading-relaxed no-scrollbar font-mono"
                    disabled={disabled}
                />
            </div>
          ) : (
             <div className="w-full h-full overflow-y-auto no-scrollbar p-6">
                <div className="w-full px-4">
                    {value ? (
                        <MarkdownRenderer content={value} onTimestampClick={onTimestampClick} />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-[50vh] text-slate-500">
                            <Eye size={48} className="mb-4 opacity-20" />
                            <p>暂无内容可预览</p>
                        </div>
                    )}
                </div>
             </div>
          )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-2 relative group">
      {/* Portal Rendering */}
      {isPoppedOut && externalContainer && createPortal(PoppedOutContent, externalContainer)}

      <div className="flex justify-between items-center">
        <div className="text-xs font-semibold text-slate-400 flex items-center gap-1">
          {label}
        </div>
        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
          {enablePreview && value && (
             <span className="text-[10px] text-indigo-400 mr-2 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
               支持预览
             </span>
          )}
          <button
            onClick={(e) => copyToClipboard(e)}
            className="p-1 text-slate-500 hover:text-sky-400 transition-colors rounded hover:bg-slate-800"
            title="复制内容"
          >
            <Copy size={12} />
          </button>
          
          {/* Button to Trigger Native Window Pop-out */}
          <button
            onClick={openExternalWindow}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${
                isPoppedOut 
                ? 'bg-indigo-600 text-white border-indigo-500'
                : 'bg-slate-800 hover:bg-slate-700 text-sky-400 border-slate-700'
            }`}
            title="在独立窗口中打开 (支持跨屏)"
          >
            <Maximize2 size={12} /> 
            <span className="font-medium">{isPoppedOut ? "已在独立窗口打开" : "独立窗口"}</span>
          </button>
        </div>
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={disabled ? "等待处理..." : placeholder}
        className={`w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-sm text-slate-300 placeholder-slate-600 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition-all resize-none leading-relaxed custom-scrollbar font-mono ${className} ${isPoppedOut ? 'opacity-50' : ''}`}
        disabled={disabled}
      />
      {isPoppedOut && (
          <div className="absolute inset-0 top-8 bg-slate-900/80 flex items-center justify-center backdrop-blur-[1px] rounded-lg border border-slate-700 pointer-events-none">
              <span className="text-xs text-indigo-300 font-medium flex items-center gap-2">
                  <Maximize2 size={14} /> 正在独立窗口中查看
              </span>
          </div>
      )}
    </div>
  );
};

export default ExpandableTextArea;
