import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { FusionRequest, VideoState, ExtractionType, SavedFramework } from '../types';
import { extractVideoInfo, extractMultimodalInfo } from '../services/geminiService';
// Import new File System Service
import { openDirectory, loadLibraryFromDirectory, saveToDirectory, saveAnalysisToDirectory, saveImportedScriptToDirectory, deleteFromDirectory, isFileSystemSupported, verifyPermission } from '../services/fileSystemService';
import { Video, FileText, Sparkles, UploadCloud, Loader2, CheckCircle2, RefreshCw, Layers, AlertCircle, FolderOpen, Save, Trash2, X, Play, Pause, Maximize2, ExternalLink, FileDown, Eye, HardDrive, ArrowUpDown, ArrowUp, ArrowDown, Clock, FolderInput, Check, Lightbulb, PenTool, MessageSquare, Plus, FileType, Image as ImageIcon, Zap, Settings2 } from 'lucide-react';
import ExpandableTextArea from './ExpandableTextArea';
import MarkdownRenderer from './MarkdownRenderer';

interface InputFormProps {
  onSubmit: (data: FusionRequest) => void;
  onSublimate: (data: FusionRequest) => void; // New prop for standalone sublimation
  isGenerating: boolean;
  videoA: VideoState;
  setVideoA: React.Dispatch<React.SetStateAction<VideoState>>;
  videoB: VideoState;
  setVideoB: React.Dispatch<React.SetStateAction<VideoState>>;
}

// --- Independent Video Player Window ---
const openVideoWindow = (videoUrl: string, title: string) => {
    const width = 450; // Adjusted for vertical feeling
    const height = 800;
    const left = (window.screen.availWidth - width) / 2;
    const top = (window.screen.availHeight - height) / 2;

    const win = window.open('', '', `width=${width},height=${height},left=${left},top=${top},resizable=yes`);
    if (!win) return;

    win.document.title = `播放: ${title}`;
    const style = win.document.createElement('style');
    style.textContent = `
      body { margin: 0; background: #000; display: flex; height: 100vh; width: 100vw; overflow: hidden; align-items: center; justify-content: center; }
      video { width: 100%; height: 100%; object-fit: contain; }
    `;
    win.document.head.appendChild(style);
    
    const video = win.document.createElement('video');
    video.src = videoUrl;
    video.controls = true;
    video.autoplay = true;
    win.document.body.appendChild(video);
    // Focus the new window
    win.focus();
};

// --- Framework Detail Independent Window ---
interface FrameworkDetailWindowProps {
  item: SavedFramework;
  onClose: () => void;
  focusTrigger?: number; // Prop to trigger window focus
}

const FrameworkDetailWindow: React.FC<FrameworkDetailWindowProps> = ({ item, onClose, focusTrigger }) => {
  const [container, setContainer] = useState<HTMLElement | null>(null);
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
      win.document.title = `${item.title} - 完整拆解详情`;

      const tailwindScript = win.document.createElement('script');
      tailwindScript.src = "https://cdn.tailwindcss.com";
      win.document.head.appendChild(tailwindScript);

      const styleElement = win.document.createElement('style');
      styleElement.textContent = `
        body { background-color: #0f172a; color: #f8fafc; margin: 0; font-family: 'Inter', sans-serif; overflow: hidden; }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #1e293b; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }
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

  if (!container) return null;

  return createPortal(
    <div className="flex flex-col h-full bg-slate-950 w-full animate-in fade-in duration-300">
      <div className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 shrink-0 shadow-md">
        <div className="flex items-center gap-3 overflow-hidden">
          <FileText className="text-sky-400 shrink-0" size={24} />
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-100 truncate">{item.title}</h2>
            <p className="text-xs text-slate-500">文件位置: 本地目录</p>
          </div>
        </div>
        <button
          onClick={() => windowRef.current?.close()}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-600 transition-all text-xs font-medium shrink-0"
        >
          <X size={14} /> 关闭窗口
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-950">
         <div className="max-w-4xl mx-auto space-y-8">
            {item.importedScript && (
                <section>
                    <h3 className="text-xl font-bold text-emerald-400 mb-4 flex items-center gap-2 border-b border-slate-800 pb-2">
                       <FileText size={20} /> 导入文案
                    </h3>
                    <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800 text-slate-300 leading-relaxed font-mono whitespace-pre-wrap text-sm shadow-inner">
                        {item.importedScript}
                    </div>
                </section>
            )}

            <section>
                <h3 className="text-xl font-bold text-sky-400 mb-4 flex items-center gap-2 border-b border-slate-800 pb-2">
                   <FileText size={20} /> 原始口播文案
                </h3>
                <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-800 text-slate-300 leading-relaxed font-mono whitespace-pre-wrap text-sm shadow-inner">
                    {item.script || "未找到文案部分 (请检查txt文件格式)"}
                </div>
            </section>

            <section>
                <h3 className="text-xl font-bold text-indigo-400 mb-4 flex items-center gap-2 border-b border-slate-800 pb-2">
                   <Layers size={20} /> 框架拆解与分析
                </h3>
                <div className="bg-slate-900/30 p-2 rounded-xl">
                   <MarkdownRenderer content={item.analysis} />
                </div>
            </section>
         </div>
      </div>
    </div>,
    container
  );
};


// --- Library External Window Component ---
export interface LibraryExternalWindowProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: SavedFramework, videoFile: File | null) => void;
  // Passing directory state up so saving can use it
  dirHandle: FileSystemDirectoryHandle | null;
  setDirHandle: (handle: FileSystemDirectoryHandle | null) => void;
  refreshTrigger: number;
  focusTrigger: number; // Prop to trigger window focus
  mode: 'B' | 'C' | 'G'; // Selector mode (added G for ViralVideoModule)
}

type SortKey = 'title' | 'timestamp';
type SortDirection = 'asc' | 'desc';

interface ItemProcessingStatus {
    status: 'idle' | 'analyzing' | 'waiting_retry' | 'success' | 'error';
    retryCount: number;
    message?: string;
}

export const LibraryExternalWindow: React.FC<LibraryExternalWindowProps> = ({ 
  isOpen, onClose, onSelect, dirHandle, setDirHandle, refreshTrigger, focusTrigger, mode
}) => {
  const [items, setItems] = useState<SavedFramework[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isContentDragging, setIsContentDragging] = useState(false);
  const [isHeaderDragging, setIsHeaderDragging] = useState(false); // New state for header drag
  
  // Batch Processing State
  const [processingStatus, setProcessingStatus] = useState<Record<string, ItemProcessingStatus>>({});
  const processingQueueRef = useRef<SavedFramework[]>([]);
  const activeWorkersRef = useRef(0);
  const abortedItemsRef = useRef<Set<string>>(new Set());
  
  // Concurrency Setting
  const [concurrentLimit, setConcurrentLimit] = useState(3);
  const concurrentLimitRef = useRef(3);

  const [externalContainer, setExternalContainer] = useState<HTMLElement | null>(null);
  const externalWindowRef = useRef<Window | null>(null);
  
  // Detail Window State
  const [viewingItem, setViewingItem] = useState<SavedFramework | null>(null);
  const [detailFocusTrigger, setDetailFocusTrigger] = useState(0);

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{key: SortKey, direction: SortDirection}>({ key: 'timestamp', direction: 'desc' });
  
  // Cache for object URLs
  const [videoPreviews, setVideoPreviews] = useState<Record<string, string>>({});

  const fileInputExcelRef = useRef<HTMLInputElement>(null);

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !dirHandle) return;

      setIsLoading(true);
      try {
          let data: ArrayBuffer;
          try {
              data = await file.arrayBuffer();
          } catch (e: any) {
              throw new Error(`读取Excel文件失败 (可能是文件被占用或在同步文件夹中): ${e.message}`);
          }
          
          // CRITICAL FIX: XLSX with type 'array' requires a Uint8Array, not a raw ArrayBuffer.
          // Passing a raw ArrayBuffer causes it to be parsed as a raw text/CSV file, resulting in binary garbage.
          let workbook;
          try {
              workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
          } catch (e: any) {
              throw new Error(`解析Excel文件失败: ${e.message}`);
          }
          
          // Combine all sheets to ensure we don't miss data if it's on a different sheet
          let json: any[][] = [];
          for (const sheetName of workbook.SheetNames) {
              const ws = workbook.Sheets[sheetName];
              const sheetJson = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
              if (sheetJson.length > 0) {
                  json = json.concat(sheetJson);
              }
          }
          
          let filenameColIdx = -1;
          let scriptColIdx = -1;
          
          // 1. Find the column indices by scanning the entire sheet
          for (let i = 0; i < Math.min(json.length, 50); i++) {
              const row = json[i];
              if (!row || !Array.isArray(row)) continue;
              
              let tempFIdx = -1;
              let tempSIdx = -1;
              
              for (let j = 0; j < row.length; j++) {
                  const cellValue = String(row[j] || '').replace(/\s+/g, '');
                  if (cellValue === '文件名' || cellValue.includes('文件名')) {
                      if (tempFIdx === -1) tempFIdx = j;
                  }
                  if (cellValue === '文案' || cellValue === '脚本' || cellValue.includes('文案')) {
                      if (tempSIdx === -1 && tempFIdx !== j) tempSIdx = j; // Must be a different column
                  }
              }
              
              // Only accept if we found BOTH and they are DIFFERENT columns
              if (tempFIdx !== -1 && tempSIdx !== -1 && tempFIdx !== tempSIdx) {
                  filenameColIdx = tempFIdx;
                  scriptColIdx = tempSIdx;
                  break;
              }
          }
          
          // Fallback: If we couldn't find them, assume standard layout:
          // Col 0: 序号, Col 1: 文件名, Col 2: 文案
          if (filenameColIdx === -1 || scriptColIdx === -1) {
              filenameColIdx = 1;
              scriptColIdx = 2;
          }

          let importedCount = 0;
          
          // Helper for robust matching (ignores spaces, newlines, case)
          const normalizeStr = (str: string) => String(str).replace(/\s+/g, '').toLowerCase();
          
          for (let i = 0; i < json.length; i++) {
              const row = json[i];
              if (!row || !Array.isArray(row) || row.length === 0) continue;
              
              const rawFilename = row[filenameColIdx];
              const rawScript = row[scriptColIdx];
              
              if (!rawFilename || !rawScript) continue;
              
              const filenameStr = String(rawFilename).trim();
              const scriptStr = String(rawScript).trim();
              
              // Skip header rows that might have been caught in data
              const checkHeader = normalizeStr(filenameStr);
              if (checkHeader.includes('文件名') || checkHeader === '序号') continue;
              if (normalizeStr(scriptStr).includes('文案')) continue;
              
              if (filenameStr && scriptStr) {
                  const excelNameNoExt = filenameStr.replace(/\.[^/.]+$/, "").trim();
                  const normExcelNameNoExt = normalizeStr(excelNameNoExt);
                  
                  if (!normExcelNameNoExt) continue; // Skip if empty after normalization
                  
                  const matchingItem = items.find(item => {
                      const localNameNoExt = item.title.replace(/\.[^/.]+$/, "").trim();
                      const normLocalNameNoExt = normalizeStr(localNameNoExt);
                      
                      // 1. Exact match
                      if (normLocalNameNoExt === normExcelNameNoExt) return true;
                      
                      // 2. Substring match (length > 5 to avoid false positives)
                      if (normExcelNameNoExt.length > 5 && normLocalNameNoExt.includes(normExcelNameNoExt)) return true;
                      if (normLocalNameNoExt.length > 5 && normExcelNameNoExt.includes(normLocalNameNoExt)) return true;
                      
                      return false;
                  });
                  
                  if (matchingItem) {
                      await saveImportedScriptToDirectory(dirHandle, matchingItem.title, scriptStr);
                      importedCount++;
                  }
              }
          }
          
          if (importedCount === 0 && json.length > 1) {
              // Find the first valid data row for diagnostic info
              let sampleExcel = "";
              for (let i = 0; i < json.length; i++) {
                  const row = json[i];
                  if (row && Array.isArray(row) && row[filenameColIdx]) {
                      const name = String(row[filenameColIdx]).trim();
                      const norm = normalizeStr(name);
                      if (!norm.includes('文件名') && norm !== '序号' && norm.length > 0) {
                          sampleExcel = name;
                          break;
                      }
                  }
              }
              const sampleLocal = items.length > 0 ? items[0].title : "无本地文件";
              const msg = `成功导入 0 条文案。\n\n【诊断信息】\nExcel读取到的第一个文件名:\n${sampleExcel}\n\n本地第一个视频文件名:\n${sampleLocal}\n\n请检查两者是否一致。如果仍有问题，请联系开发者。`;
              
              if (externalWindowRef.current) {
                  externalWindowRef.current.alert(msg);
              } else {
                  alert(msg);
              }
          } else {
              if (externalWindowRef.current) {
                  externalWindowRef.current.alert(`成功导入 ${importedCount} 条文案`);
              } else {
                  alert(`成功导入 ${importedCount} 条文案`);
              }
          }
          
          await loadItems(dirHandle);
          
      } catch (error: any) {
          console.error("Excel import failed:", error);
          const msg = error instanceof Error ? error.message : String(error);
          if (externalWindowRef.current) {
              externalWindowRef.current.alert(`导入失败: ${msg}`);
          } else {
              alert(`导入失败: ${msg}`);
          }
      } finally {
          setIsLoading(false);
          if (fileInputExcelRef.current) {
              fileInputExcelRef.current.value = '';
          }
      }
  };

  // Focus effect
  useEffect(() => {
    if (isOpen && externalWindowRef.current && !externalWindowRef.current.closed) {
        externalWindowRef.current.focus();
    }
  }, [focusTrigger, isOpen]);

  // Load items when dirHandle changes or refresh triggers
  useEffect(() => {
    if (dirHandle) {
      loadItems(dirHandle);
    } else {
        // Reset items if handle is lost
        setItems([]);
    }
  }, [dirHandle, refreshTrigger]);

  // Sync concurrent limit ref and trigger expansion if queue exists
  useEffect(() => {
    concurrentLimitRef.current = concurrentLimit;
    if (processingQueueRef.current.length > 0) {
        startWorkerPool();
    }
  }, [concurrentLimit]);

  const loadItems = async (handle: FileSystemDirectoryHandle) => {
    setIsLoading(true);
    try {
      const loadedItems = await loadLibraryFromDirectory(handle);
      setItems(loadedItems);
    } catch (e: any) {
      console.error("Error loading directory", e);
      const msg = e instanceof Error ? e.message : String(e);
      if (externalWindowRef.current) externalWindowRef.current.alert("读取文件夹失败: " + msg);
      else alert("读取文件夹失败: " + msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenFolder = async () => {
    try {
      if (!isFileSystemSupported()) {
        alert("您的浏览器不支持直接访问本地文件夹，请使用 Chrome 或 Edge 浏览器。");
        return;
      }
      
      const targetWin = externalWindowRef.current || window;
      const handle = await openDirectory(targetWin);
      setDirHandle(handle); 
    } catch (error: any) {
      console.error(error);
      let msg: string = "未知错误";
      if (error instanceof Error) {
        msg = error.message;
      } else {
        msg = String(error);
      }
      
      if (msg && !msg.includes("取消")) {
          const alertMsg = `操作提示: ${msg}`;
          if (externalWindowRef.current) externalWindowRef.current.alert(alertMsg);
          else alert(alertMsg);
      }
    }
  };

  // --- Auto-Retry Analysis Logic ---

  const updateItemStatus = (id: string, newStatus: Partial<ItemProcessingStatus>) => {
      setProcessingStatus(prev => ({
          ...prev,
          [id]: { ...(prev[id] || { status: 'idle', retryCount: 0 }), ...newStatus }
      }));
  };

  const handleStopAnalysis = (id: string) => {
      abortedItemsRef.current.add(id);
      // Remove from queue if it's waiting
      processingQueueRef.current = processingQueueRef.current.filter(item => item.id !== id);
      updateItemStatus(id, { status: 'idle', message: '已停止' });
  };

  const processSingleItem = async (item: SavedFramework) => {
      if (!dirHandle || !item.videoFile) return;

      const performAnalysis = async (retryCount: number) => {
          if (abortedItemsRef.current.has(item.id)) {
              updateItemStatus(item.id, { status: 'idle', message: '已停止' });
              abortedItemsRef.current.delete(item.id);
              return;
          }

          updateItemStatus(item.id, { status: 'analyzing', retryCount, message: retryCount > 0 ? `第 ${retryCount} 次重试中...` : 'AI 正在解析...' });
          
          try {
              const type = mode === 'B' ? 'style' : 'methodology';
              const { script, analysis } = await extractVideoInfo(item.videoFile!, type);
              
              if (abortedItemsRef.current.has(item.id)) {
                  updateItemStatus(item.id, { status: 'idle', message: '已停止' });
                  abortedItemsRef.current.delete(item.id);
                  return;
              }

              await saveAnalysisToDirectory(dirHandle, item.id, script, analysis);
              
              updateItemStatus(item.id, { status: 'success', message: '解析完成' });
              
              // Refresh list to show new content
              await loadItems(dirHandle);

          } catch (e: any) {
              if (abortedItemsRef.current.has(item.id)) {
                  updateItemStatus(item.id, { status: 'idle', message: '已停止' });
                  abortedItemsRef.current.delete(item.id);
                  return;
              }

              const errorMsg = e instanceof Error ? e.message : String(e);
              console.error(`Analysis failed for ${item.title}:`, errorMsg);

              // Check for fatal errors that shouldn't be retried
              const isFatal = errorMsg.includes("413") || errorMsg.includes("400") || errorMsg.includes("格式");
              
              if (isFatal) {
                  updateItemStatus(item.id, { status: 'error', message: `解析失败: ${errorMsg}` });
              } else {
                  // Silent Retry Logic
                  const nextRetry = retryCount + 1;
                  updateItemStatus(item.id, { status: 'waiting_retry', message: `失败，3秒后重试 (${nextRetry})` });
                  
                  // Wait 3 seconds then recurse
                  await new Promise(resolve => setTimeout(resolve, 3000));
                  await performAnalysis(nextRetry);
              }
          }
      };

      await performAnalysis(0);
  };

  const queueProcessor = async () => {
      if (processingQueueRef.current.length === 0) return;
      // Dynamic limit check
      if (activeWorkersRef.current >= concurrentLimitRef.current) return;

      const item = processingQueueRef.current.shift();
      if (!item) return;

      activeWorkersRef.current++;
      
      try {
          await processSingleItem(item);
      } catch (e: any) {
          console.error("Worker error:", e);
      } finally {
          activeWorkersRef.current--;
          queueProcessor(); // Pick up next
      }
  };

  const startWorkerPool = () => {
      // Start workers up to the limit
      const needed = concurrentLimitRef.current - activeWorkersRef.current;
      for (let i = 0; i < needed; i++) {
          queueProcessor();
      }
  };

  const handleBatchAnalyze = () => {
      if (!dirHandle) return;
      
      // Filter items that don't have analysis
      const unanalyzedItems = items.filter(item => !item.analysis && !processingStatus[item.id]?.status);
      
      if (unanalyzedItems.length === 0) {
          const msg = "当前文件夹内所有视频均已解析，无需处理。";
          if (externalWindowRef.current) externalWindowRef.current.alert(msg); else alert(msg);
          return;
      }

      if (externalWindowRef.current?.confirm(`发现 ${unanalyzedItems.length} 个未解析视频，是否开始批量解析？(支持多线程 + 自动重试)`)) {
          // Add to queue
          processingQueueRef.current = [...processingQueueRef.current, ...unanalyzedItems];
          
          // Mark as pending in UI
          const newStatus: Record<string, ItemProcessingStatus> = {};
          unanalyzedItems.forEach(item => {
              newStatus[item.id] = { status: 'idle', retryCount: 0, message: '等待队列中...' };
          });
          setProcessingStatus(prev => ({ ...prev, ...newStatus }));

          // Start
          startWorkerPool();
      }
  };

  // Generic Drag Handler for Directory
  const handleDirectoryDrop = async (e: React.DragEvent) => {
      e.preventDefault();
      // Reset drag states
      setIsContentDragging(false);
      setIsHeaderDragging(false);

      if (!e.dataTransfer) return;

      const items = e.dataTransfer.items;
      if (!items || items.length === 0) return;

      const item = items[0];
      // Check for getAsFileSystemHandle support (Chrome/Edge 86+)
      if ('getAsFileSystemHandle' in item) {
          try {
              // Cast to any to avoid TS error on getAsFileSystemHandle
              const handle = await (item as any).getAsFileSystemHandle();
              if (handle && handle.kind === 'directory') {
                  const dirHandle = handle as any;
                  // SECURITY FIX: Request readwrite permission immediately during drop event
                  // This prevents "User activation is required" errors later when saving files.
                  const granted = await verifyPermission(dirHandle, true);
                  if (granted) {
                      setDirHandle(dirHandle);
                  } else {
                      const msg = "您拒绝了读写权限，无法保存分析结果。请重新拖入并允许权限。";
                      if (externalWindowRef.current) externalWindowRef.current.alert(msg); else alert(msg);
                  }
              } else {
                  if (externalWindowRef.current) {
                      externalWindowRef.current.alert("请拖入一个文件夹");
                  } else {
                      alert("请拖入一个文件夹");
                  }
              }
          } catch (err: any) {
              console.error(err);
              const msg = "无法读取拖入的文件夹，请尝试使用“打开本地文件夹”按钮。";
              if (externalWindowRef.current) externalWindowRef.current.alert(msg); else alert(msg);
          }
      } else {
           const msg = "您的浏览器不支持拖拽读取文件夹，请使用 Chrome 或 Edge 浏览器，或使用点击按钮。";
           if (externalWindowRef.current) externalWindowRef.current.alert(msg); else alert(msg);
      }
  };

  // Handle Window Creation
  useEffect(() => {
    if (isOpen && !externalWindowRef.current) {
        const width = 1100;
        const height = 700;
        const left = (window.screen.availWidth - width) / 2;
        const top = (window.screen.availHeight - height) / 2;
        
        const newWindow = window.open('', '', `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`);
        if (newWindow) {
            externalWindowRef.current = newWindow;
            newWindow.document.title = `本地素材库 (${mode === 'B' ? '风格框架' : '方法论'}) - ScriptMaster AI`;
            
            const tailwindScript = newWindow.document.createElement('script');
            tailwindScript.src = "https://cdn.tailwindcss.com";
            newWindow.document.head.appendChild(tailwindScript);

            const styleElement = newWindow.document.createElement('style');
            styleElement.textContent = `
                body { background-color: #0f172a; color: #f8fafc; margin: 0; font-family: 'Inter', sans-serif; overflow: hidden; }
                .custom-scrollbar::-webkit-scrollbar { width: 8px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: #1e293b; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }
                table { border-collapse: collapse; width: 100%; }
                th { position: sticky; top: 0; background: #0f172a; z-index: 10; cursor: pointer; user-select: none; }
                th:hover { background-color: #1e293b; }
                tr:hover td { background-color: rgba(30, 41, 59, 0.5); }
            `;
            newWindow.document.head.appendChild(styleElement);

            const container = newWindow.document.createElement('div');
            container.style.height = '100vh';
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            newWindow.document.body.appendChild(container);
            setExternalContainer(container);

            newWindow.onbeforeunload = () => {
                onClose();
                externalWindowRef.current = null;
                setExternalContainer(null);
            };
        } else {
            onClose();
            alert("请允许弹出窗口以使用素材库。");
        }
    } else if (!isOpen && externalWindowRef.current) {
        externalWindowRef.current.close();
        externalWindowRef.current = null;
        setExternalContainer(null);
    }
  }, [isOpen, onClose]);

  // Cleanup Object URLs
  useEffect(() => {
      return () => {
          Object.values(videoPreviews).forEach(url => URL.revokeObjectURL(url));
      };
  }, []);

  // Sorting Logic
  const handleSort = (key: SortKey) => {
      setSortConfig(current => ({
          key,
          direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
      }));
  };

  const sortedItems = useMemo(() => {
      const sorted = [...items];
      sorted.sort((a, b) => {
          // Special Natural Sort for Titles (Handles numeric file names properly: 2 > 10)
          if (sortConfig.key === 'title') {
              // localeCompare with numeric: true provides natural sort order
              // e.g., "2.mp4" vs "10.mp4" -> 2 comes before 10
              const comparison = a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
              return sortConfig.direction === 'asc' ? comparison : -comparison;
          }

          let valA: string | number = 0;
          let valB: string | number = 0;

          if (sortConfig.key === 'timestamp') {
              valA = a.timestamp;
              valB = b.timestamp;
          } else {
              // Safety fallback
              valA = (a as any)[sortConfig.key];
              valB = (b as any)[sortConfig.key];
          }
          
          if (typeof valA === 'string' && typeof valB === 'string') {
               valA = valA.toLowerCase();
               valB = valB.toLowerCase();
          }

          if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
          if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });
      return sorted;
  }, [items, sortConfig]);

  const getSortIcon = (key: SortKey) => {
      if (sortConfig.key !== key) return <ArrowUpDown size={14} className="opacity-30" />;
      return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-sky-400" /> : <ArrowDown size={14} className="text-sky-400" />;
  };

  const getPreviewUrl = (item: SavedFramework): string => {
      if (videoPreviews[item.id]) return videoPreviews[item.id];
      if (item.videoFile) {
          const url = URL.createObjectURL(item.videoFile);
          setVideoPreviews(prev => ({...prev, [item.id]: url}));
          return url;
      }
      return "";
  };

  const handleDelete = async (item: SavedFramework) => {
    if (!dirHandle) return;
    if (externalWindowRef.current?.confirm(`确定要从硬盘删除 "${item.title}" 及其文案文件吗？此操作不可恢复。`)) {
      try {
        await deleteFromDirectory(dirHandle, item.id);
        // Refresh list
        loadItems(dirHandle);
      } catch (e: any) {
        const msg = e instanceof Error ? e.message : String(e);
        if (externalWindowRef.current) externalWindowRef.current.alert("删除失败: " + msg);
        else alert("删除失败: " + msg);
      }
    }
  };
  
  const handleAnalyzeLocalVideo = async (item: SavedFramework) => {
    // Single analysis trigger also uses the concurrent processor for consistency
    processingQueueRef.current.push(item);
    
    // Mark as pending in UI immediately
    updateItemStatus(item.id, { status: 'idle', retryCount: 0, message: '等待队列中...' });
    
    startWorkerPool();
  };

  const handlePopoutVideo = (item: SavedFramework) => {
      const url = getPreviewUrl(item);
      if (url) {
          openVideoWindow(url, item.title);
      }
  };

  const handleViewDetail = (item: SavedFramework) => {
    if (viewingItem?.id === item.id) {
        // If already viewing this item, trigger focus on the existing window
        setDetailFocusTrigger(prev => prev + 1);
    } else {
        setViewingItem(item);
        // Reset trigger for new window logic, although useEffect depends on it changing
        setDetailFocusTrigger(0); 
    }
  };

  const handleDownloadText = (item: SavedFramework) => {
       const content = `视频文件: ${item.title}\n\n========== 原始文案 ==========\n${item.script}\n\n========== 框架分析 ==========\n${item.analysis}\n\n========== 导入文案 ==========\n${item.importedScript || '无'}`;
       const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
       const url = URL.createObjectURL(blob);
       const a = document.createElement('a');
       a.href = url;
       a.download = `${item.title}.txt`;
       document.body.appendChild(a);
       a.click();
       document.body.removeChild(a);
       URL.revokeObjectURL(url);
  };

  // Helper to render status badge
  const renderStatus = (item: SavedFramework) => {
      const pStatus = processingStatus[item.id];
      if (pStatus) {
          if (pStatus.status === 'analyzing' || pStatus.status === 'waiting_retry') {
              return (
                  <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1 text-indigo-400">
                          {pStatus.status === 'analyzing' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} className="animate-spin-slow text-orange-400" />}
                          <span className="text-[10px] font-bold">{pStatus.status === 'analyzing' ? '解析中...' : '等待重试'}</span>
                      </div>
                      {pStatus.retryCount > 0 && <span className="text-[9px] text-orange-400">重试 #{pStatus.retryCount}</span>}
                      {pStatus.status === 'waiting_retry' && <span className="text-[9px] text-slate-500">{pStatus.message}</span>}
                      <button 
                          onClick={() => handleStopAnalysis(item.id)}
                          className="text-[10px] text-red-400 hover:text-red-300 underline mt-1"
                      >
                          停止解析
                      </button>
                  </div>
              );
          }
          if (pStatus.status === 'success') {
              return (
                  <div className="flex items-center gap-1 text-green-400">
                      <CheckCircle2 size={14} />
                      <span className="text-[10px] font-bold">Success</span>
                  </div>
              );
          }
          if (pStatus.status === 'error') {
              return (
                  <div className="flex flex-col items-center gap-1 text-red-400">
                      <AlertCircle size={14} />
                      <span className="text-[9px] max-w-[80px] truncate" title={pStatus.message}>{pStatus.message}</span>
                  </div>
              );
          }
          if (pStatus.status === 'idle') {
              return (
                  <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] text-slate-500">{pStatus.message || '等待处理...'}</span>
                      {pStatus.message === '等待队列中...' && (
                          <button 
                              onClick={() => handleStopAnalysis(item.id)}
                              className="text-[10px] text-red-400 hover:text-red-300 underline mt-1"
                          >
                              取消排队
                          </button>
                      )}
                  </div>
              );
          }
      }

      // Default state (not in processing queue)
      if (item.analysis) {
          return null; // Normal view
      }

      return (
        <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-1 text-slate-600">
                <AlertCircle size={14} />
                <span className="text-[10px]">未解析</span>
            </div>
            <button 
                onClick={() => handleAnalyzeLocalVideo(item)}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-md shadow-lg shadow-indigo-900/20 transition-all hover:scale-105 active:scale-95"
            >
                <Sparkles size={12} /> 单个AI拆解
            </button>
        </div>
      );
  };

  if (!isOpen || !externalContainer) return null;

  return (
    <>
        {createPortal(
            <div className="flex flex-col h-full bg-slate-950 w-full animate-in fade-in duration-300">
                {/* Header with Drag Drop Support */}
                <div className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 shrink-0 shadow-md z-20">
                    <div className="flex items-center gap-3">
                        <FolderOpen className="text-sky-400" size={24} />
                        <div>
                            <h2 className="text-lg font-bold text-slate-100">本地素材库 - {mode === 'B' ? "风格框架" : "创作方法论"}</h2>
                            <p className="text-xs text-slate-500">
                                {dirHandle ? `当前目录: ${dirHandle.name}` : "请打开一个本地文件夹以加载/保存素材"}
                            </p>
                        </div>
                    </div>
                    
                    {/* Header Action Area */}
                    <div className="flex items-center gap-3">
                        {/* Concurrency Settings */}
                        <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-2 py-1.5 border border-slate-700" title="设置并发解析线程数">
                            <Settings2 size={14} className="text-slate-400" />
                            <span className="text-[10px] text-slate-400">并发:</span>
                            <input 
                                type="number" 
                                min={1} 
                                max={10} 
                                value={concurrentLimit}
                                onChange={(e) => setConcurrentLimit(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                                className="w-8 bg-transparent text-center text-xs font-bold text-white focus:outline-none border-b border-slate-600 focus:border-indigo-500 transition-colors"
                            />
                        </div>

                        {/* Batch Analyze Button */}
                        <button
                            onClick={handleBatchAnalyze}
                            disabled={!dirHandle || isLoading}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold shadow-lg transition-all ${
                                !dirHandle 
                                ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                                : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/20 hover:scale-105 active:scale-95'
                            }`}
                            title="自动扫描并解析所有未处理视频"
                        >
                            <Zap size={14} className={isLoading ? "animate-pulse" : ""} />
                            一键批量AI解析
                        </button>

                        {/* Import Excel Button */}
                        <button
                            onClick={() => fileInputExcelRef.current?.click()}
                            disabled={!dirHandle || isLoading}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold shadow-lg transition-all ${
                                !dirHandle 
                                ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20 hover:scale-105 active:scale-95'
                            }`}
                            title="导入包含文案的Excel表格"
                        >
                            <FileText size={14} />
                            导入文案表格
                        </button>
                        <input 
                            ref={fileInputExcelRef} 
                            type="file" 
                            accept=".xlsx, .xls" 
                            className="hidden" 
                            onChange={handleExcelImport} 
                        />

                        <div 
                           onDragOver={(e) => { e.preventDefault(); setIsHeaderDragging(true); }}
                           onDragLeave={() => setIsHeaderDragging(false)}
                           onDrop={handleDirectoryDrop}
                           className={`relative p-1 rounded-xl transition-all duration-200 ${isHeaderDragging ? 'bg-indigo-600/30 ring-2 ring-indigo-500 scale-105' : ''}`}
                        >
                            <button
                                onClick={handleOpenFolder}
                                className={`flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all text-xs font-bold shadow-lg ${isHeaderDragging ? 'pointer-events-none' : ''}`}
                            >
                                {isHeaderDragging ? (
                                    <>
                                        <FolderInput size={14} className="animate-bounce" />
                                        释放以切换文件夹
                                    </>
                                ) : (
                                    <>
                                        <HardDrive size={14} /> 
                                        {dirHandle ? "切换文件夹" : "打开本地文件夹"}
                                    </>
                                )}
                            </button>
                        </div>

                        <button
                            onClick={() => { onClose(); externalWindowRef.current?.close(); }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-600 transition-all text-xs font-medium"
                        >
                        <X size={14} /> 关闭
                        </button>
                    </div>
                </div>

                {/* Content - Table View */}
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-950 p-6">
                    {!dirHandle ? (
                        <div 
                            className={`flex flex-col items-center justify-center h-full text-slate-500 transition-all duration-200 ${isContentDragging ? 'bg-indigo-900/10 border-2 border-dashed border-indigo-500' : ''}`}
                            onDragOver={(e) => { e.preventDefault(); setIsContentDragging(true); }}
                            onDragLeave={() => setIsContentDragging(false)}
                            onDrop={handleDirectoryDrop}
                        >
                             <HardDrive size={64} className={`mb-6 opacity-20 transition-all ${isContentDragging ? 'scale-110 text-indigo-400 opacity-50' : ''}`} />
                             <p className="text-lg font-medium mb-2">{isContentDragging ? "释放以打开文件夹" : "未连接本地文件夹"}</p>
                             <p className="text-sm opacity-60 max-w-md text-center mb-6">
                                 {isContentDragging ? "松开鼠标以加载该文件夹内的视频素材" : "点击右上角按钮选择，或直接拖拽文件夹到此处"}
                             </p>
                             <button
                                onClick={handleOpenFolder}
                                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-xl transition-transform hover:scale-105"
                             >
                                 选择文件夹
                             </button>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="text-center py-20 text-slate-500">
                        {isLoading ? (
                            <Loader2 size={48} className="mx-auto mb-4 animate-spin text-indigo-500" />
                        ) : (
                            <Sparkles size={64} className="mx-auto mb-6 opacity-20" />
                        )}
                        <p className="text-lg font-medium">{isLoading ? "正在扫描文件..." : "文件夹内暂无视频素材"}</p>
                        <p className="text-sm mt-2 opacity-60">请确文件夹内包含 .mp4/.mov 视频文件，或解析新视频并保存。</p>
                        </div>
                    ) : (
                        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900 shadow-xl">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                                    <th className="p-4 font-semibold w-[160px] cursor-default">视频预览</th>
                                    
                                    <th className="p-4 font-semibold w-[160px]" onClick={() => handleSort('timestamp')}>
                                        <div className="flex items-center gap-1.5 hover:text-slate-200 transition-colors">
                                            <Clock size={14} /> 创建时间 {getSortIcon('timestamp')}
                                        </div>
                                    </th>

                                    <th className="p-4 font-semibold w-[220px]" onClick={() => handleSort('title')}>
                                        <div className="flex items-center gap-1.5 hover:text-slate-200 transition-colors">
                                            <FileText size={14} /> 文件名 {getSortIcon('title')}
                                        </div>
                                    </th>

                                    <th className="p-4 font-semibold cursor-default">导入文案</th>
                                    <th className="p-4 font-semibold cursor-default">本地拆解文案 (.TXT)</th>
                                    <th className="p-4 font-semibold w-[280px] text-center cursor-default">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {sortedItems.map(item => (
                                    <tr key={item.id} className="group transition-colors">
                                        <td className="p-4 align-top">
                                            <div className="w-[120px] aspect-[9/16] bg-black rounded-lg overflow-hidden relative border border-slate-800 shadow-sm group-hover:border-slate-600 transition-colors">
                                                <video 
                                                    src={getPreviewUrl(item)} 
                                                    className="w-full h-full object-cover" 
                                                    controls={true}
                                                    playsInline
                                                />
                                                <button 
                                                    onClick={() => handlePopoutVideo(item)}
                                                    className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-sky-600 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                                    title="大屏播放"
                                                >
                                                    <Maximize2 size={12} />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="p-4 align-top">
                                            <div className="text-xs text-slate-400 font-mono">
                                                {new Date(item.timestamp).toLocaleString('zh-CN', {
                                                    year: 'numeric',
                                                    month: '2-digit',
                                                    day: '2-digit',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </div>
                                        </td>
                                        <td className="p-4 align-top">
                                            <div className="font-bold text-slate-200 text-sm break-all line-clamp-3 mb-1" title={item.title}>
                                                {item.title}
                                            </div>
                                            <span className="inline-block px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-500 border border-slate-700">
                                                本地文件
                                            </span>
                                        </td>
                                        <td className="p-4 align-top">
                                            <div className="p-3 bg-slate-950/50 rounded-lg border border-slate-800/50 h-full relative min-h-[100px]">
                                                {item.importedScript ? (
                                                    <p className="text-xs text-slate-400 line-clamp-4 leading-relaxed font-mono">
                                                        {item.importedScript.slice(0, 200)}...
                                                    </p>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center h-full text-slate-500 py-2 gap-3">
                                                        <span className="text-[10px]">无导入文案</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 align-top">
                                            <div className="p-3 bg-slate-950/50 rounded-lg border border-slate-800/50 h-full relative min-h-[100px]">
                                                {item.analysis ? (
                                                    <p className="text-xs text-slate-400 line-clamp-4 leading-relaxed font-mono">
                                                        {item.analysis.slice(0, 200)}...
                                                    </p>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center h-full text-slate-500 py-2 gap-3">
                                                        {renderStatus(item)}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 align-middle">
                                            <div className="flex flex-col gap-2 items-center">
                                                <div className="flex w-full gap-2">
                                                    <button 
                                                        onClick={() => onSelect(item, item.videoFile)}
                                                        disabled={!item.analysis && !item.importedScript}
                                                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-md ${
                                                            (item.analysis || item.importedScript)
                                                            ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/20' 
                                                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                                        }`}
                                                        title={(item.analysis || item.importedScript) ? "使用此框架生成新脚本" : "缺少拆解文案，无法调用"}
                                                    >
                                                        <ExternalLink size={14} /> 调用
                                                    </button>
                                                    <button 
                                                        onClick={() => handleViewDetail(item)}
                                                        disabled={!item.analysis && !item.importedScript}
                                                        className={`px-3 py-2 rounded-lg transition-all shadow-md ${
                                                             (item.analysis || item.importedScript)
                                                             ? 'bg-slate-700 hover:bg-sky-600 text-white' 
                                                             : 'bg-slate-800 text-slate-500'
                                                        }`}
                                                        title="在独立窗口中查看完整拆解详情"
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                </div>
                                                
                                                <div className="flex w-full gap-2">
                                                    <button 
                                                        onClick={() => handleDownloadText(item)}
                                                        disabled={!item.analysis && !item.importedScript}
                                                        className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs transition-colors disabled:opacity-50"
                                                        title="另存为副本"
                                                    >
                                                        <FileDown size={14} /> 副本
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(item)}
                                                        className="px-3 py-2 bg-slate-800 hover:bg-red-900/20 hover:text-red-400 hover:border-red-900/30 text-slate-500 border border-slate-700 rounded-lg text-xs transition-all"
                                                        title="从硬盘删除视频和文档"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </div>
                    )}
                </div>
            </div>,
            externalContainer
        )}
        
        {/* Render Detail Window if active */}
        {viewingItem && (
            <FrameworkDetailWindow 
                item={viewingItem} 
                onClose={() => setViewingItem(null)}
                focusTrigger={detailFocusTrigger} 
            />
        )}
    </>
  );
};

const InputForm: React.FC<InputFormProps> = ({ 
  onSubmit, 
  onSublimate, // Receive new prop
  isGenerating, 
  videoA, setVideoA, 
  videoB, setVideoB 
}) => {
  // New State for Video C
  const [videoC, setVideoC] = useState<VideoState>({ file: null, videoUrl: null, isExtracting: false, extractedScript: '', extractedAnalysis: '', error: null });
  
  // Video A Manual Input State
  const [inputTypeA, setInputTypeA] = useState<'video' | 'text' | 'chat'>('video');
  const [manualScriptA, setManualScriptA] = useState('');
  
  // Chat/Multimodal State for A
  const [chatFilesA, setChatFilesA] = useState<File[]>([]);
  const [chatTextA, setChatTextA] = useState('');
  const chatFileInputRefA = useRef<HTMLInputElement>(null);

  // Video B Manual Input State
  const [inputTypeB, setInputTypeB] = useState<'video' | 'text'>('video');
  const [manualScriptB, setManualScriptB] = useState('');

  // Video C Manual Input State
  const [inputTypeC, setInputTypeC] = useState<'video' | 'text'>('video');
  const [manualScriptC, setManualScriptC] = useState('');

  // Library States - Split into B and C for independent folders
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [libraryMode, setLibraryMode] = useState<'B' | 'C'>('B');
  const [dirHandleB, setDirHandleB] = useState<FileSystemDirectoryHandle | null>(null);
  const [dirHandleC, setDirHandleC] = useState<FileSystemDirectoryHandle | null>(null);
  const [libraryRefreshTrigger, setLibraryRefreshTrigger] = useState(0);
  const [libraryFocusTrigger, setLibraryFocusTrigger] = useState(0);

  // Drag States
  const [isDraggingA, setIsDraggingA] = useState(false);
  const [isDraggingB, setIsDraggingB] = useState(false);
  const [isDraggingC, setIsDraggingC] = useState(false);

  // Play States
  // Save status states
  const [saveStatusA, setSaveStatusA] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveStatusB, setSaveStatusB] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveStatusC, setSaveStatusC] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  
  // Refs
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const videoCRef = useRef<HTMLVideoElement>(null);
  const fileInputARef = useRef<HTMLInputElement>(null);
  const fileInputBRef = useRef<HTMLInputElement>(null);
  const fileInputCRef = useRef<HTMLInputElement>(null);

  // Helper to seek video
  const handleSeek = (videoRef: React.RefObject<HTMLVideoElement>, seconds: number) => {
    if (videoRef.current) {
        videoRef.current.currentTime = seconds;
        videoRef.current.pause();
    }
  };

  // Unified File Processing & Auto-Extraction
  const processVideoFile = async (file: File, target: 'A' | 'B' | 'C') => {
      if (!file.type.startsWith('video/')) {
          alert("请上传有效的视频文件 (如 .mp4, .mov)");
          return;
      }
      
      let setState, setSaveStatus;
      if (target === 'A') { setState = setVideoA; setSaveStatus = setSaveStatusA; }
      else if (target === 'B') { setState = setVideoB; setSaveStatus = setSaveStatusB; }
      else { setState = setVideoC; setSaveStatus = setSaveStatusC; }

      const url = URL.createObjectURL(file);

      // 1. Initial State Update (Show file, start loader)
      setState((prev: VideoState) => ({
        ...prev,
        file,
        videoUrl: url,
        extractedScript: '',
        extractedAnalysis: '',
        error: null,
        isExtracting: true // Auto-start extraction
      }));
      setSaveStatus('idle');

      // 2. Perform Extraction Immediately
      const type: ExtractionType = target === 'A' ? 'product' : (target === 'B' ? 'style' : 'methodology');
      try {
        const { script, analysis } = await extractVideoInfo(file, type);
        setState((prev: VideoState) => ({
          ...prev,
          extractedScript: script,
          extractedAnalysis: analysis,
          isExtracting: false
        }));

        // 3. Auto-save to Library if connected
        // Check which directory handle to use based on target
        const currentHandle = target === 'B' ? dirHandleB : (target === 'C' ? dirHandleC : null);

        if (currentHandle) {
             setSaveStatus('saving');
             try {
                 await saveAnalysisToDirectory(currentHandle, file.name, script, analysis);
                 setLibraryRefreshTrigger(prev => prev + 1);
                 setSaveStatus('saved');
                 console.log(`Auto-saved analysis for ${file.name} to library.`);
             } catch (e: any) {
                 console.error("Auto-save failed", e);
                 setSaveStatus('error');
             }
        }

      } catch (error: any) {
        setState((prev: VideoState) => ({
          ...prev,
          isExtracting: false,
          error: error.message || "解析失败"
        }));
        setSaveStatus('idle');
      }
  };

  // Input Change Handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, target: 'A' | 'B' | 'C') => {
    const file = e.target.files?.[0];
    if (file) {
        processVideoFile(file, target);
        e.target.value = ''; // Reset input
    }
  };

  // Chat/Multimodal File Handler
  const handleChatFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []) as File[];
      const validFiles = files.filter(f => f.type.startsWith('image/') || f.type === 'application/pdf');
      
      if (validFiles.length !== files.length) {
          alert("部分文件格式不支持，仅支持图片和PDF文件。");
      }
      
      setChatFilesA(prev => [...prev, ...validFiles]);
      e.target.value = '';
  };

  const removeChatFile = (index: number) => {
      setChatFilesA(prev => prev.filter((_, i) => i !== index));
  };

  const handleMultimodalAnalyze = async () => {
      if (chatFilesA.length === 0 && !chatTextA.trim()) {
          alert("请上传文件或输入描述");
          return;
      }

      setVideoA(prev => ({ ...prev, isExtracting: true, error: null }));
      
      try {
          const { script, analysis } = await extractMultimodalInfo(chatFilesA, chatTextA);
          setVideoA(prev => ({
              ...prev,
              extractedScript: script,
              extractedAnalysis: analysis,
              isExtracting: false
          }));
      } catch (error: any) {
          setVideoA(prev => ({
              ...prev,
              isExtracting: false,
              error: error.message || "多模态解析失败"
          }));
      }
  };

  // Drag and Drop Handlers
  const handleDragOver = (e: React.DragEvent, target: 'A' | 'B' | 'C') => {
      e.preventDefault();
      if (target === 'A') setIsDraggingA(true);
      else if (target === 'B') setIsDraggingB(true);
      else setIsDraggingC(true);
  };

  const handleDragLeave = (e: React.DragEvent, target: 'A' | 'B' | 'C') => {
      e.preventDefault();
      if (target === 'A') setIsDraggingA(false);
      else if (target === 'B') setIsDraggingB(false);
      else setIsDraggingC(false);
  };

  const handleDrop = (e: React.DragEvent, target: 'A' | 'B' | 'C') => {
      e.preventDefault();
      if (target === 'A') setIsDraggingA(false);
      else if (target === 'B') setIsDraggingB(false);
      else setIsDraggingC(false);
      
      // If we are in Chat Mode for A, handle drop differently
      if (target === 'A' && inputTypeA === 'chat') {
          const files = Array.from(e.dataTransfer.files) as File[];
          const validFiles = files.filter(f => f.type.startsWith('image/') || f.type === 'application/pdf');
          setChatFilesA(prev => [...prev, ...validFiles]);
          return;
      }

      const file = e.dataTransfer.files?.[0];
      if (file) {
          processVideoFile(file, target);
      }
  };

  const handleExtract = async (target: 'A' | 'B' | 'C') => {
    let state, setState, setSaveStatus;
    if (target === 'A') { state = videoA; setState = setVideoA; setSaveStatus = setSaveStatusA; }
    else if (target === 'B') { state = videoB; setState = setVideoB; setSaveStatus = setSaveStatusB; }
    else { state = videoC; setState = setVideoC; setSaveStatus = setSaveStatusC; }

    const type: ExtractionType = target === 'A' ? 'product' : (target === 'B' ? 'style' : 'methodology');

    if (!state.file) return;

    setState((prev: VideoState) => ({ ...prev, isExtracting: true, error: null }));
    setSaveStatus('idle');

    try {
      const { script, analysis } = await extractVideoInfo(state.file, type);
      setState((prev: VideoState) => ({
        ...prev,
        extractedScript: script,
        extractedAnalysis: analysis,
        isExtracting: false
      }));

      // Auto-save to Library if connected
      const currentHandle = target === 'B' ? dirHandleB : (target === 'C' ? dirHandleC : null);

      if (currentHandle) {
             setSaveStatus('saving');
             try {
                 await saveAnalysisToDirectory(currentHandle, state.file.name, script, analysis);
                 setLibraryRefreshTrigger(prev => prev + 1);
                 setSaveStatus('saved');
             } catch (e: any) {
                 console.error("Auto-save failed", e);
                 setSaveStatus('error');
             }
      }
    } catch (error: any) {
      setState((prev: VideoState) => ({
        ...prev,
        isExtracting: false,
        error: error.message || "解析失败"
      }));
    }
  };

  const handleLibrarySelect = (item: SavedFramework, videoFile: File | null) => {
     // Based on libraryMode, populate Video B or C
     const setState = libraryMode === 'B' ? setVideoB : setVideoC;
     const setSaveStatus = libraryMode === 'B' ? setSaveStatusB : setSaveStatusC;

     if (videoFile) {
        const url = URL.createObjectURL(videoFile);
        setState({
            file: videoFile,
            videoUrl: url,
            isExtracting: false,
            extractedScript: item.script || item.importedScript || '',
            extractedAnalysis: item.analysis || item.importedScript || '',
            error: null
        });
        setSaveStatus('saved'); 
     } else {
        setState((prev: VideoState) => ({
            ...prev,
            file: null,
            videoUrl: null,
            extractedScript: item.script || item.importedScript || '',
            extractedAnalysis: item.analysis || item.importedScript || '',
            isExtracting: false,
            error: null
        }));
     }
  };
  
  const handleSaveToLibrary = async (target: 'B' | 'C') => {
    const state = target === 'B' ? videoB : videoC;
    const setSaveStatus = target === 'B' ? setSaveStatusB : setSaveStatusC;
    // Use the correct directory handle
    const currentHandle = target === 'B' ? dirHandleB : dirHandleC;
    const setCurrentHandle = target === 'B' ? setDirHandleB : setDirHandleC;

    if (!state.file || !state.extractedAnalysis) {
        alert(`请先上传视频${target}并完成解析，才能保存到本地库。`);
        return;
    }

    setSaveStatus('saving');
    try {
        let handle = currentHandle;
        if (!handle) {
            if (!isFileSystemSupported()) {
                alert("浏览器不支持文件系统访问");
                setSaveStatus('error');
                return;
            }
            handle = await openDirectory();
            setCurrentHandle(handle);
        }
        
        await saveToDirectory(handle!, state.file, state.extractedScript, state.extractedAnalysis);
        setLibraryRefreshTrigger(prev => prev + 1);
        setSaveStatus('saved');
        alert("保存成功！");
    } catch (e: any) {
        console.error(e);
        const errMsg = e instanceof Error ? e.message : String(e);
        if (!errMsg.includes("取消")) {
            alert("保存失败: " + errMsg);
        }
        setSaveStatus('error');
    }
  };

  const getProductContext = () => {
      if (inputTypeA === 'video') {
         return `
[产品视频文案]
${videoA.extractedScript}

[产品卖点分析]
${videoA.extractedAnalysis}
         `.trim();
      } else if (inputTypeA === 'chat') {
         return `
[多模态产品提炼信息]
${videoA.extractedScript}

[AI 提取卖点]
${videoA.extractedAnalysis}
         `.trim();
      } else {
         return `
[产品文案 (手动输入)]
${manualScriptA}
         `.trim();
      }
  };

  const getStyleContext = () => {
      if (inputTypeB === 'text') {
          return `
[风格参考文案 (手动输入)]
${manualScriptB}
          `.trim();
      }
      return `
[风格参考文案]
${videoB.extractedScript}

[风格框架拆解]
${videoB.extractedAnalysis}
      `.trim();
  };

  const getMethodologyContext = () => {
      if (inputTypeC === 'text') {
          return `
[创作方法论 (手动输入)]
${manualScriptC}
          `.trim();
      }
      return `
[方法论视频文案]
${videoC.extractedScript}

[创作方法论 (大师理论)]
${videoC.extractedAnalysis}
      `.trim();
  };

  const handleSubmit = () => {
      const productContext = getProductContext();
      const styleContext = getStyleContext();
      // Only fuse A + B for the main action
      onSubmit({ productContext, styleContext });
  };

  const handleSublimationClick = () => {
      const productContext = getProductContext();
      const methodologyContext = getMethodologyContext();
      // Standalone sublimation action (A + C)
      onSublimate({ productContext, styleContext: '', methodologyContext });
  };

  // Logic: Can submit if A (video analysed or manual text present) AND B analyzed are present.
  const isAValid = (inputTypeA === 'video' && videoA.extractedAnalysis) || (inputTypeA === 'text' && manualScriptA.trim().length > 0) || (inputTypeA === 'chat' && videoA.extractedAnalysis);
  const isBValid = (inputTypeB === 'video' && videoB.extractedAnalysis) || (inputTypeB === 'text' && manualScriptB.trim().length > 0);
  const isCValid = (inputTypeC === 'video' && videoC.extractedAnalysis) || (inputTypeC === 'text' && manualScriptC.trim().length > 0);

  const canSubmit = isAValid && isBValid && !isGenerating;
  const canSublimation = isAValid && isCValid && !isGenerating;

  return (
    <div className="flex flex-col gap-6 pb-10">
      
      {/* Video A Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-sky-400 flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-sky-500/20 text-sky-400 flex items-center justify-center text-xs border border-sky-500/30">A</div>
                产品素材 (内容源)
            </h3>
            
            {/* Input Toggle */}
            <div className="flex bg-slate-800 rounded p-0.5 border border-slate-700">
                <button
                    onClick={() => setInputTypeA('video')}
                    className={`px-2 py-0.5 text-[10px] rounded transition-all flex items-center gap-1 ${inputTypeA === 'video' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                    title="视频上传"
                >
                    视频
                </button>
                <button
                    onClick={() => setInputTypeA('text')}
                    className={`px-2 py-0.5 text-[10px] rounded transition-all flex items-center gap-1 ${inputTypeA === 'text' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                    title="手动输入"
                >
                    手动
                </button>
                <button
                    onClick={() => setInputTypeA('chat')}
                    className={`px-2 py-0.5 text-[10px] rounded transition-all flex items-center gap-1 ${inputTypeA === 'chat' ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                    title="AI 多模态提炼 (支持图片/PDF)"
                >
                    <MessageSquare size={10} /> AI提炼
                </button>
            </div>
        </div>
        
        {inputTypeA === 'video' ? (
            /* Video Upload UI for A */
            <div 
                onDragOver={(e) => handleDragOver(e, 'A')}
                onDragLeave={(e) => handleDragLeave(e, 'A')}
                onDrop={(e) => handleDrop(e, 'A')}
                className={`rounded-xl transition-all ${isDraggingA ? 'ring-2 ring-sky-500 bg-sky-900/20 scale-[1.01]' : ''}`}
            >
                {!videoA.file ? (
                    <div 
                        onClick={() => fileInputARef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors aspect-[9/16] w-[260px] mx-auto ${isDraggingA ? 'border-sky-500 bg-sky-900/10' : 'border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-slate-700'}`}
                    >
                        <UploadCloud size={32} className={`mb-4 ${isDraggingA ? 'text-sky-400' : 'text-slate-500'}`} />
                        <p className={`text-sm font-medium mb-1 ${isDraggingA ? 'text-sky-400' : 'text-slate-400'}`}>{isDraggingA ? "释放以添加" : "点击或拖拽上传"}</p>
                    </div>
                ) : (
                    <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 relative shadow-xl">
                        {isDraggingA && <div className="absolute inset-0 bg-sky-900/80 backdrop-blur-sm z-20 flex items-center justify-center text-sky-400 font-bold rounded-xl border border-sky-500">释放替换</div>}
                        <div className="flex flex-col items-center gap-4">
                            <div className="relative w-[180px] aspect-[9/16] bg-black rounded-lg overflow-hidden shrink-0 shadow-lg border border-slate-700 group">
                                {videoA.videoUrl && <video ref={videoARef} src={videoA.videoUrl} controls className="w-full h-full object-cover" playsInline />}
                                <button 
                                    onClick={() => setVideoA({ file: null, videoUrl: null, isExtracting: false, extractedScript: '', extractedAnalysis: '', error: null })}
                                    className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all z-10"
                                    title="移除视频"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                            <div className="w-full space-y-3">
                                <div className="flex items-center justify-between bg-slate-900 p-2 rounded-lg border border-slate-800">
                                    <span className="text-xs text-slate-300 truncate font-mono flex-1 mr-2">{videoA.file.name}</span>
                                    <button onClick={() => handleExtract('A')} disabled={videoA.isExtracting} className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition-all ${videoA.isExtracting ? 'bg-slate-800 text-slate-500' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}>
                                        {videoA.isExtracting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {videoA.extractedAnalysis ? "重分析" : "分析"}
                                    </button>
                                </div>
                                {videoA.error && <div className="text-xs text-red-400 bg-red-900/20 p-2 rounded border border-red-900/30">{videoA.error}</div>}
                                {videoA.extractedAnalysis && (
                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 pt-2 border-t border-slate-800/50">
                                        <ExpandableTextArea label="产品文案" placeholder="文案..." value={videoA.extractedScript} onChange={(v) => setVideoA(prev => ({...prev, extractedScript: v}))} className="h-24" onTimestampClick={(sec) => handleSeek(videoARef, sec)} />
                                        <ExpandableTextArea label="卖点分析" placeholder="分析..." value={videoA.extractedAnalysis} onChange={(v) => setVideoA(prev => ({...prev, extractedAnalysis: v}))} className="h-32" enablePreview onTimestampClick={(sec) => handleSeek(videoARef, sec)} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                <input ref={fileInputARef} type="file" accept="video/*" className="hidden" onChange={(e) => handleFileChange(e, 'A')} />
            </div>
        ) : inputTypeA === 'chat' ? (
            /* Chat / Multimodal Input for A */
            <div 
                className={`bg-slate-950 rounded-xl border border-slate-800 shadow-inner flex flex-col transition-all ${isDraggingA ? 'ring-2 ring-sky-500 bg-sky-900/20' : ''}`}
                onDragOver={(e) => handleDragOver(e, 'A')}
                onDragLeave={(e) => handleDragLeave(e, 'A')}
                onDrop={(e) => handleDrop(e, 'A')}
            >
                <div className="p-4 flex flex-col gap-4">
                    {/* File Preview Area */}
                    <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar min-h-[60px]">
                        {chatFilesA.length === 0 ? (
                            <div 
                                onClick={() => chatFileInputRefA.current?.click()}
                                className="w-full h-16 border-2 border-dashed border-slate-700 rounded-lg flex items-center justify-center text-slate-500 text-xs cursor-pointer hover:bg-slate-900 hover:border-slate-600 transition-colors"
                            >
                                <Plus size={16} className="mr-2" /> 点击或拖拽上传图片/PDF
                            </div>
                        ) : (
                            <>
                                {chatFilesA.map((file, idx) => (
                                    <div key={idx} className="relative group shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-slate-700 bg-slate-900">
                                        {file.type.startsWith('image/') ? (
                                            <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                                                <FileType size={20} />
                                                <span className="text-[8px] uppercase mt-1">PDF</span>
                                            </div>
                                        )}
                                        <button 
                                            onClick={() => removeChatFile(idx)}
                                            className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X size={10} />
                                        </button>
                                    </div>
                                ))}
                                <button 
                                    onClick={() => chatFileInputRefA.current?.click()}
                                    className="shrink-0 w-16 h-16 border border-dashed border-slate-700 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-900 hover:text-sky-400 transition-colors"
                                >
                                    <Plus size={20} />
                                </button>
                            </>
                        )}
                        <input 
                            ref={chatFileInputRefA} 
                            type="file" 
                            accept="image/*,application/pdf" 
                            multiple 
                            className="hidden" 
                            onChange={handleChatFilesChange} 
                        />
                    </div>

                    {/* Text Input */}
                    <div className="relative">
                        <textarea
                            value={chatTextA}
                            onChange={(e) => setChatTextA(e.target.value)}
                            placeholder="在此补充产品描述，或直接点击提取..."
                            className="w-full h-24 bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-300 placeholder-slate-600 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 resize-none font-mono"
                        />
                        <button 
                            onClick={handleMultimodalAnalyze}
                            disabled={videoA.isExtracting}
                            className={`absolute bottom-2 right-2 px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-all ${videoA.isExtracting ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-sky-600 hover:bg-sky-500 text-white shadow-lg'}`}
                        >
                            {videoA.isExtracting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} 
                            {videoA.extractedAnalysis ? "重新提炼" : "开始提炼"}
                        </button>
                    </div>
                </div>

                {/* Analysis Output (Reused from VideoState) */}
                {videoA.error && <div className="mx-4 mb-4 text-xs text-red-400 bg-red-900/20 p-2 rounded border border-red-900/30">{videoA.error}</div>}
                
                {videoA.extractedAnalysis && (
                    <div className="px-4 pb-4 space-y-2 animate-in fade-in slide-in-from-top-2 border-t border-slate-800/50 pt-2">
                        <ExpandableTextArea 
                            label="产品详情汇总" 
                            placeholder="详情..." 
                            value={videoA.extractedScript} 
                            onChange={(v) => setVideoA(prev => ({...prev, extractedScript: v}))} 
                            className="h-24" 
                        />
                        <ExpandableTextArea 
                            label="卖点分析结果" 
                            placeholder="分析..." 
                            value={videoA.extractedAnalysis} 
                            onChange={(v) => setVideoA(prev => ({...prev, extractedAnalysis: v}))} 
                            className="h-32" 
                            enablePreview 
                        />
                    </div>
                )}
            </div>
        ) : (
            /* Manual Text UI for A */
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 shadow-inner">
                <div className="flex items-center gap-2 mb-2 text-slate-400 text-xs">
                    <PenTool size={14} />
                    <span>请直接粘贴产品介绍或原始文案</span>
                </div>
                <ExpandableTextArea 
                    label="产品文案"
                    placeholder="在此输入产品名称、核心卖点、优惠机制等信息..."
                    value={manualScriptA}
                    onChange={setManualScriptA}
                    className="h-64 font-mono text-sm"
                />
            </div>
        )}
      </div>

      <div className="h-px bg-slate-800" />

      {/* Video B Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-purple-400 flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs border border-purple-500/30">B</div>
                风格框架 (模仿对象)
            </h3>
            <div className="flex gap-2 items-center">
                {/* Input Toggle B */}
                <div className="flex bg-slate-800 rounded p-0.5 border border-slate-700 mr-2">
                    <button
                        onClick={() => setInputTypeB('video')}
                        className={`px-2 py-0.5 text-[10px] rounded transition-all ${inputTypeB === 'video' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        视频上传
                    </button>
                    <button
                        onClick={() => setInputTypeB('text')}
                        className={`px-2 py-0.5 text-[10px] rounded transition-all ${inputTypeB === 'text' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        手动输入
                    </button>
                </div>

                <button 
                    onClick={() => { setLibraryMode('B'); setIsLibraryOpen(true); setLibraryFocusTrigger(prev => prev + 1); }}
                    className={`text-xs flex items-center gap-1 transition-colors px-2 py-1 rounded border ${dirHandleB ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/50' : 'bg-indigo-900/20 text-indigo-400 border-indigo-500/30'}`}
                >
                    <FolderOpen size={14} /> {dirHandleB ? "已连" : "库"}
                </button>
                <button onClick={() => fileInputBRef.current?.click()} className="text-xs flex items-center gap-1 text-slate-400 hover:text-purple-400 transition-colors bg-slate-800/50 px-2 py-1 rounded">
                    <UploadCloud size={14} /> 上传
                </button>
            </div>
            <input ref={fileInputBRef} type="file" accept="video/*" className="hidden" onChange={(e) => handleFileChange(e, 'B')} />
        </div>

        {inputTypeB === 'video' ? (
            <div 
                onDragOver={(e) => handleDragOver(e, 'B')}
                onDragLeave={(e) => handleDragLeave(e, 'B')}
                onDrop={(e) => handleDrop(e, 'B')}
                className={`rounded-xl transition-all ${isDraggingB ? 'ring-2 ring-purple-500 bg-purple-900/20 scale-[1.01]' : ''}`}
            >
                {!videoB.file ? (
                    <div onClick={() => fileInputBRef.current?.click()} className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors aspect-[9/16] w-[260px] mx-auto ${isDraggingB ? 'border-purple-500 bg-purple-900/10' : 'border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-slate-700'}`}>
                        <UploadCloud size={32} className={`mb-4 ${isDraggingB ? 'text-purple-400' : 'text-slate-500'}`} />
                        <p className={`text-sm font-medium mb-1 ${isDraggingB ? 'text-purple-400' : 'text-slate-400'}`}>{isDraggingB ? "释放以添加" : "点击或拖拽上传"}</p>
                    </div>
                ) : (
                    <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 relative shadow-xl">
                        {isDraggingB && <div className="absolute inset-0 bg-purple-900/80 backdrop-blur-sm z-20 flex items-center justify-center text-purple-400 font-bold rounded-xl border border-purple-500">释放替换</div>}
                        <div className="flex flex-col items-center gap-4">
                            <div className="relative w-[180px] aspect-[9/16] bg-black rounded-lg overflow-hidden shrink-0 shadow-lg border border-slate-700 group">
                                {videoB.videoUrl && <video ref={videoBRef} src={videoB.videoUrl} controls className="w-full h-full object-cover" playsInline />}
                                <button 
                                    onClick={() => setVideoB({ file: null, videoUrl: null, isExtracting: false, extractedScript: '', extractedAnalysis: '', error: null })}
                                    className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all z-10"
                                    title="移除视频"
                                >
                                    <X size={14} />
                                </button>
                            </div>

                            <div className="w-full space-y-3">
                                <div className="flex items-center justify-between bg-slate-900 p-2 rounded-lg border border-slate-800">
                                    <span className="text-xs text-slate-300 truncate font-mono flex-1 mr-2">{videoB.file.name}</span>
                                    <div className="flex gap-2 items-center shrink-0">
                                        {saveStatusB === 'saved' && <span className="text-[10px] text-green-400 flex items-center gap-0.5"><Check size={10}/> 已存</span>}
                                        {saveStatusB === 'error' && <span className="text-[10px] text-red-400 flex items-center gap-0.5"><AlertCircle size={10}/> 失败</span>}
                                        {videoB.extractedAnalysis && <button onClick={() => handleSaveToLibrary('B')} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors" title="保存"><Save size={16} /></button>}
                                        <button onClick={() => handleExtract('B')} disabled={videoB.isExtracting} className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition-all ${videoB.isExtracting ? 'bg-slate-800 text-slate-500' : 'bg-purple-600 hover:bg-purple-500 text-white'}`}>
                                            {videoB.isExtracting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {videoB.extractedAnalysis ? "重拆解" : "分析"}
                                        </button>
                                    </div>
                                </div>
                                {videoB.error && <div className="text-xs text-red-400 bg-red-900/20 p-2 rounded border border-red-900/30">{videoB.error}</div>}
                                {videoB.extractedAnalysis && (
                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 pt-2 border-t border-slate-800/50">
                                        <ExpandableTextArea label="原片文案" placeholder="文案..." value={videoB.extractedScript} onChange={(v) => setVideoB(prev => ({...prev, extractedScript: v}))} className="h-24" onTimestampClick={(sec) => handleSeek(videoBRef, sec)} />
                                        <ExpandableTextArea label="框架分析" placeholder="分析..." value={videoB.extractedAnalysis} onChange={(v) => setVideoB(prev => ({...prev, extractedAnalysis: v}))} className="h-48" enablePreview onTimestampClick={(sec) => handleSeek(videoBRef, sec)} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        ) : (
            /* Manual Text UI for B */
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 shadow-inner">
                <div className="flex items-center gap-2 mb-2 text-slate-400 text-xs">
                    <PenTool size={14} />
                    <span>请直接粘贴风格参考文案或框架分析</span>
                </div>
                <ExpandableTextArea 
                    label="手动输入风格/框架"
                    placeholder="在此输入参考视频的文案、脚本结构或风格分析..."
                    value={manualScriptB}
                    onChange={setManualScriptB}
                    className="h-64 font-mono text-sm"
                />
            </div>
        )}
      </div>

      <div className="h-px bg-slate-800" />

      {/* Video C Section (Methodology) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-amber-500 flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-amber-500/20 text-amber-500 flex items-center justify-center text-xs border border-amber-500/30">C</div>
                创作方法论 (大师理论)
            </h3>
            <div className="flex gap-2 items-center">
                {/* Input Toggle C */}
                <div className="flex bg-slate-800 rounded p-0.5 border border-slate-700 mr-2">
                    <button
                        onClick={() => setInputTypeC('video')}
                        className={`px-2 py-0.5 text-[10px] rounded transition-all ${inputTypeC === 'video' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        视频上传
                    </button>
                    <button
                        onClick={() => setInputTypeC('text')}
                        className={`px-2 py-0.5 text-[10px] rounded transition-all ${inputTypeC === 'text' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        手动输入
                    </button>
                </div>

                <button 
                    onClick={() => { setLibraryMode('C'); setIsLibraryOpen(true); setLibraryFocusTrigger(prev => prev + 1); }}
                    className={`text-xs flex items-center gap-1 transition-colors px-2 py-1 rounded border ${dirHandleC ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/50' : 'bg-indigo-900/20 text-indigo-400 border-indigo-500/30'}`}
                >
                    <FolderOpen size={14} /> {dirHandleC ? "已连" : "库"}
                </button>
                <button onClick={() => fileInputCRef.current?.click()} className="text-xs flex items-center gap-1 text-slate-400 hover:text-amber-500 transition-colors bg-slate-800/50 px-2 py-1 rounded">
                    <UploadCloud size={14} /> 上传
                </button>
            </div>
            <input ref={fileInputCRef} type="file" accept="video/*" className="hidden" onChange={(e) => handleFileChange(e, 'C')} />
        </div>

        {inputTypeC === 'video' ? (
            <div 
                onDragOver={(e) => handleDragOver(e, 'C')}
                onDragLeave={(e) => handleDragLeave(e, 'C')}
                onDrop={(e) => handleDrop(e, 'C')}
                className={`rounded-xl transition-all ${isDraggingC ? 'ring-2 ring-amber-500 bg-amber-900/20 scale-[1.01]' : ''}`}
            >
                {!videoC.file ? (
                    <div onClick={() => fileInputCRef.current?.click()} className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors aspect-[9/16] w-[260px] mx-auto ${isDraggingC ? 'border-amber-500 bg-amber-900/10' : 'border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-slate-700'}`}>
                        <Lightbulb size={32} className={`mb-4 ${isDraggingC ? 'text-amber-500' : 'text-slate-500'}`} />
                        <p className={`text-sm font-medium mb-1 ${isDraggingC ? 'text-amber-500' : 'text-slate-400'}`}>{isDraggingC ? "释放以添加" : "点击或拖拽上传"}</p>
                    </div>
                ) : (
                    <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 relative shadow-xl">
                        {isDraggingC && <div className="absolute inset-0 bg-amber-900/80 backdrop-blur-sm z-20 flex items-center justify-center text-amber-400 font-bold rounded-xl border border-amber-500">释放替换</div>}
                        <div className="flex flex-col items-center gap-4">
                            <div className="relative w-[180px] aspect-[9/16] bg-black rounded-lg overflow-hidden shrink-0 shadow-lg border border-slate-700 group">
                                {videoC.videoUrl && <video ref={videoCRef} src={videoC.videoUrl} controls className="w-full h-full object-cover" playsInline />}
                                <button 
                                    onClick={() => setVideoC({ file: null, videoUrl: null, isExtracting: false, extractedScript: '', extractedAnalysis: '', error: null })}
                                    className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all z-10"
                                    title="移除视频"
                                >
                                    <X size={14} />
                                </button>
                            </div>

                            <div className="w-full space-y-3">
                                <div className="flex items-center justify-between bg-slate-900 p-2 rounded-lg border border-slate-800">
                                    <span className="text-xs text-slate-300 truncate font-mono flex-1 mr-2">{videoC.file.name}</span>
                                    <div className="flex gap-2 items-center shrink-0">
                                        {saveStatusC === 'saved' && <span className="text-[10px] text-green-400 flex items-center gap-0.5"><Check size={10}/> 已存</span>}
                                        {saveStatusC === 'error' && <span className="text-[10px] text-red-400 flex items-center gap-0.5"><AlertCircle size={10}/> 失败</span>}
                                        {videoC.extractedAnalysis && <button onClick={() => handleSaveToLibrary('C')} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors" title="保存"><Save size={16} /></button>}
                                        <button onClick={() => handleExtract('C')} disabled={videoC.isExtracting} className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 transition-all ${videoC.isExtracting ? 'bg-slate-800 text-slate-500' : 'bg-amber-600 hover:bg-amber-500 text-white'}`}>
                                            {videoC.isExtracting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {videoC.extractedAnalysis ? "重分析" : "分析"}
                                        </button>
                                    </div>
                                </div>
                                {videoC.error && <div className="text-xs text-red-400 bg-red-900/20 p-2 rounded border border-red-900/30">{videoC.error}</div>}
                                {videoC.extractedAnalysis && (
                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 pt-2 border-t border-slate-800/50">
                                        <ExpandableTextArea label="原片文案" placeholder="文案..." value={videoC.extractedScript} onChange={(v) => setVideoC(prev => ({...prev, extractedScript: v}))} className="h-24" onTimestampClick={(sec) => handleSeek(videoCRef, sec)} />
                                        <ExpandableTextArea label="创作方法论" placeholder="理论分析..." value={videoC.extractedAnalysis} onChange={(v) => setVideoC(prev => ({...prev, extractedAnalysis: v}))} className="h-40" enablePreview onTimestampClick={(sec) => handleSeek(videoCRef, sec)} />
                                        
                                        {/* One-click Sublimation Button */}
                                        <button 
                                            onClick={handleSublimationClick} 
                                            disabled={!canSublimation}
                                            className={`w-full py-2 rounded-lg font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.02] ${
                                                canSublimation 
                                                ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-amber-900/20' 
                                                : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
                                            }`}
                                            title={canSublimation ? "结合产品A + 方法论C 生成优化方案" : "需完成产品A和方法论C的分析"}
                                        >
                                            <Lightbulb size={16} /> 一键升华：融合大师理论生成
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        ) : (
            /* Manual Text UI for C */
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 shadow-inner">
                <div className="flex items-center gap-2 mb-2 text-slate-400 text-xs">
                    <PenTool size={14} />
                    <span>请直接粘贴大师理论或创作公式</span>
                </div>
                <ExpandableTextArea 
                    label="手动输入方法论"
                    placeholder="在此输入方法论、大师理论或创作公式..."
                    value={manualScriptC}
                    onChange={setManualScriptC}
                    className="h-64 font-mono text-sm"
                />
                {/* One-click Sublimation Button for Manual Input C */}
                <div className="mt-4">
                    <button 
                        onClick={handleSublimationClick} 
                        disabled={!canSublimation}
                        className={`w-full py-2 rounded-lg font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.02] ${
                            canSublimation 
                            ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-amber-900/20' 
                            : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
                        }`}
                        title={canSublimation ? "结合产品A + 方法论C 生成优化方案" : "需完成产品A和方法论C的分析"}
                    >
                        <Lightbulb size={16} /> 一键升华：融合大师理论生成
                    </button>
                </div>
            </div>
        )}
      </div>
      
      {/* Submit Action */}
      <div className="pt-4 sticky bottom-0 bg-slate-900 pb-2">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl ${
                canSubmit 
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:scale-[1.02] active:scale-[0.98] shadow-indigo-900/30' 
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            }`}
          >
            {isGenerating ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  正在融合生成脚本...
                </>
            ) : (
                <>
                  <Sparkles size={18} />
                  开始融合生成 (A + B)
                </>
            )}
          </button>
          {!canSubmit && (
              <p className="text-[10px] text-center text-slate-600 mt-2">
                  需完成 视频A(产品) 和 视频B(风格) 的AI分析后方可生成
              </p>
          )}
      </div>

      {/* Library Window Instance */}
      <LibraryExternalWindow 
         isOpen={isLibraryOpen}
         onClose={() => setIsLibraryOpen(false)}
         onSelect={handleLibrarySelect}
         dirHandle={libraryMode === 'B' ? dirHandleB : dirHandleC}
         setDirHandle={libraryMode === 'B' ? setDirHandleB : setDirHandleC}
         refreshTrigger={libraryRefreshTrigger}
         focusTrigger={libraryFocusTrigger}
         mode={libraryMode}
      />
    </div>
  );
};

export default InputForm;