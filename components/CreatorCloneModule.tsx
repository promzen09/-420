import React, { useState, useRef } from 'react';
import { Sparkles, FolderOpen, CheckCircle, Loader2, AlertCircle, UserCheck, PlayCircle, X, FileText, ListVideo, Shuffle, Target, Clock, ArrowUp, ArrowDown, Upload, Copy } from 'lucide-react';
import { openDirectory } from '../services/fileSystemService';
import { ChatMessage, VideoState } from '../types';
import ChatInterface from './ChatInterface';

const dummyVideoState: VideoState = {
  file: null,
  videoUrl: null,
  isExtracting: false,
  extractedScript: '',
  extractedAnalysis: '',
  error: null
};

interface CreatorItem {
  id: string;
  name: string;
  text: string;
  videoUrl?: string;
  lastModified: number;
}

// --- Draggable Floating Video Component ---
const DraggableVideo: React.FC<{ item: CreatorItem, initialX: number, initialY: number, onClose: () => void, onContextMenu: (e: React.MouseEvent, item: CreatorItem) => void }> = ({ item, initialX, initialY, onClose, onContextMenu }) => {
  const [pos, setPos] = useState({ x: initialX, y: initialY });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number, startY: number, initialPosX: number, initialPosY: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialPosX: pos.x,
      initialPosY: pos.y
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos({
      x: dragRef.current.initialPosX + dx,
      y: dragRef.current.initialPosY + dy
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div 
      className="fixed z-50 w-64 h-[455px] bg-black rounded-xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
      style={{ left: pos.x, top: pos.y, touchAction: 'none' }}
    >
      {/* Drag Handle Header */}
      <div 
        className="h-8 bg-gradient-to-b from-black/80 to-black/40 flex items-center justify-between px-3 cursor-grab active:cursor-grabbing shrink-0 absolute top-0 left-0 right-0 z-10"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="flex items-center gap-1.5 opacity-60">
           <div className="w-1 h-1 rounded-full bg-white"></div>
           <div className="w-1 h-1 rounded-full bg-white"></div>
           <div className="w-1 h-1 rounded-full bg-white"></div>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="p-1 hover:bg-white/20 rounded-full text-white/80 hover:text-white transition-colors"
          onPointerDown={(e) => e.stopPropagation()} // Prevent drag when clicking close
        >
          <X size={14} />
        </button>
      </div>
      {/* Video Player */}
      <div 
        className="flex-1 relative bg-black w-full h-full"
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu(e, item);
        }}
      >
        <video 
          src={item.videoUrl} 
          className="w-full h-full object-contain" 
          autoPlay 
          controls 
          playsInline 
        />
      </div>
    </div>
  );
};

// --- Video Preview Component ---
const VideoPreview: React.FC<{ url: string, onClick: (e: React.MouseEvent) => void }> = ({ url, onClick }) => {
  return (
    <div className="relative w-full h-full group cursor-pointer bg-black" onClick={(e) => { e.stopPropagation(); onClick(e); }}>
      <video 
        src={url} 
        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
        muted 
        playsInline 
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-colors">
        <PlayCircle size={28} className="text-white drop-shadow-md opacity-90" />
      </div>
    </div>
  );
};

const CreatorCloneModule: React.FC = () => {
  const [productInfo, setProductInfo] = useState('');
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [folderName, setFolderName] = useState('');
  
  const [creatorItems, setCreatorItems] = useState<CreatorItem[]>([]);
  const [previewItem, setPreviewItem] = useState<CreatorItem | null>(null);
  const [hoverPreviewItem, setHoverPreviewItem] = useState<CreatorItem | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, item: CreatorItem } | null>(null);
  
  // Sorting State
  const [sortBy, setSortBy] = useState<'date' | 'name'>('name');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  
  // Floating Video State
  const [floatingVideo, setFloatingVideo] = useState<{item: CreatorItem, x: number, y: number} | null>(null);
  
  const [genMode, setGenMode] = useState<'all' | 'single' | 'batch'>('all');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [batchCount, setBatchCount] = useState<number>(3);

  // Product Files State
  const [productFiles, setProductFiles] = useState<File[]>([]);
  const [isExtractingProduct, setIsExtractingProduct] = useState(false);
  const [isDraggingProduct, setIsDraggingProduct] = useState(false);
  const productFileInputRef = useRef<HTMLInputElement>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleSelectFolder = async () => {
    try {
      const handle = await openDirectory(window);
      await loadScriptsFromHandle(handle);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        setErrorMsg(`选择文件夹失败: ${error.message} (如果按钮无法点击，请尝试直接将文件夹拖拽到此区域)`);
      }
    }
  };

  const handleFolderDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const items = e.dataTransfer.items;
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
            try {
                const entry = await item.getAsFileSystemHandle();
                if (entry?.kind === 'directory') {
                    const handle = entry as FileSystemDirectoryHandle;
                    const permission = await handle.requestPermission({ mode: 'read' });
                    if (permission === 'granted') {
                        await loadScriptsFromHandle(handle);
                    } else {
                        setErrorMsg('需要读取权限才能处理文件夹中的文件。');
                    }
                    return;
                }
            } catch (err: any) {
                setErrorMsg(`拖拽读取文件夹失败: ${err.message}`);
            }
        }
    }
  };

  const loadScriptsFromHandle = async (handle: FileSystemDirectoryHandle) => {
    setDirHandle(handle);
    setFolderName(handle.name);
    setErrorMsg('');
    setCreatorItems([]);
    setIsProcessing(true);

    try {
      const itemsMap = new Map<string, { text?: string, videoHandle?: FileSystemFileHandle, name: string, lastModified: number }>();
      
      for await (const entry of handle.values()) {
        if (entry.kind === 'file') {
          const fileHandle = entry as FileSystemFileHandle;
          const name = entry.name;
          const lowerName = name.toLowerCase();

          if (lowerName.endsWith('.txt')) {
            let baseName = name.slice(0, -4);
            if (baseName.toLowerCase().endsWith('.mp4') || baseName.toLowerCase().endsWith('.mov') || baseName.toLowerCase().endsWith('.webm')) {
               baseName = baseName.slice(0, -4);
            }
            const file = await fileHandle.getFile();
            const text = await file.text();
            if (text.trim().length > 10) {
               if (!itemsMap.has(baseName)) itemsMap.set(baseName, { name: baseName, lastModified: file.lastModified });
               const item = itemsMap.get(baseName)!;
               item.text = text.trim();
               item.lastModified = Math.max(item.lastModified, file.lastModified);
            }
          } else if (lowerName.endsWith('.mp4') || lowerName.endsWith('.mov') || lowerName.endsWith('.webm')) {
            const baseName = name.slice(0, -4);
            const file = await fileHandle.getFile();
            if (!itemsMap.has(baseName)) itemsMap.set(baseName, { name: baseName, lastModified: file.lastModified });
            const item = itemsMap.get(baseName)!;
            item.videoHandle = fileHandle;
            item.lastModified = Math.max(item.lastModified, file.lastModified);
          }
        }
      }
      
      const newItems: CreatorItem[] = [];
      for (const [baseName, data] of itemsMap.entries()) {
         if (data.text) { 
            let videoUrl;
            if (data.videoHandle) {
               const file = await data.videoHandle.getFile();
               videoUrl = URL.createObjectURL(file);
            }
            newItems.push({
               id: baseName,
               name: baseName,
               text: data.text,
               videoUrl,
               lastModified: data.lastModified
            });
         }
      }

      if (newItems.length === 0) {
        setErrorMsg('在该文件夹中没有找到任何有效的 .txt 文案文件。');
      } else {
        setCreatorItems(newItems);
        setSelectedItemId(newItems[0].id);
      }
    } catch (error: any) {
      setErrorMsg(`读取文件夹内容失败: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProductFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingProduct(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setProductFiles(prev => [...prev, ...files]);
    }
  };

  const handleProductFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      setProductFiles(prev => [...prev, ...files]);
    }
    // Reset input value so the same file can be selected again
    if (productFileInputRef.current) {
      productFileInputRef.current.value = '';
    }
  };

  const removeProductFile = (index: number) => {
    setProductFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleExtractProduct = async () => {
    if (productFiles.length === 0) return;
    setIsExtractingProduct(true);
    setErrorMsg('');
    try {
      const { extractMultimodalInfo } = await import('../services/geminiService');
      const { script, analysis } = await extractMultimodalInfo(productFiles, productInfo);
      
      setProductInfo(prev => {
        const newInfo = `【AI提取产品信息】\n${script}\n\n【AI提炼卖点】\n${analysis}`;
        return prev ? `${prev}\n\n${newInfo}` : newInfo;
      });
      
      setProductFiles([]); // Clear files after successful extraction
    } catch (error: any) {
      setErrorMsg(`提取产品卖点失败: ${error.message}`);
    } finally {
      setIsExtractingProduct(false);
    }
  };

  const handleGenerate = async () => {
    if (!productInfo.trim()) {
      setErrorMsg('请输入产品卖点或素材信息');
      return;
    }
    if (creatorItems.length === 0) {
      setErrorMsg('请先加载博主素材库');
      return;
    }

    setIsProcessing(true);
    setErrorMsg('');

    let systemPrompt = "";
    let userContent = "";

    if (genMode === 'all') {
        const maxScriptsToUse = 100;
        const selectedScripts = creatorItems.slice(0, maxScriptsToUse).map(i => i.text);
        const creatorContext = selectedScripts.map((script, index) => `--- 博主历史爆款文案 ${index + 1} ---\n${script}`).join('\n\n');
        
        systemPrompt = `你现在是一个顶尖的短视频爆款编导。我将提供一位优秀博主的数百条历史爆款文案（作为你的创作大脑和风格参考），以及我当前需要推广的产品卖点。
请你：
1. 深度拆解并学习这位博主的创作思路、爆款开头（Hook）、情绪递进、词汇偏好和转化逻辑。
2. 完全模仿该博主的才华和风格，为我的新产品创作一条全新的短视频脚本。

【博主历史文案库（风格参考）】：
${creatorContext}

【我的新产品卖点/素材】：
${productInfo}

请直接输出你模仿该博主风格创作的新脚本，并在结尾简要说明你提取了该博主的哪些核心创作思路。`;
        
        userContent = `请根据我提供的产品卖点，并综合模仿已加载的 ${selectedScripts.length} 条博主历史文案的风格，为我创作一条全新的短视频脚本。`;

    } else if (genMode === 'single') {
        const targetItem = creatorItems.find(i => i.id === selectedItemId);
        if (!targetItem) { setErrorMsg('请选择要参考的文案'); setIsProcessing(false); return; }
        
        systemPrompt = `你现在是一个顶尖的短视频爆款编导。我将提供一条极其优秀的爆款文案作为你的唯一对标参考，以及我当前需要推广的产品卖点。
请你：
1. 像素级拆解这条参考文案的结构、Hook、情绪起伏、句式特点。
2. 严格按照这条文案的框架和风格，将我的产品卖点填入，创作一条全新的短视频脚本。

【指定的参考爆款文案】：
${targetItem.text}

【我的新产品卖点/素材】：
${productInfo}

请直接输出仿写后的新脚本，并在结尾简要说明你是如何套用参考文案框架的。`;
        
        userContent = `请严格参照选定的文案《${targetItem.name}》的风格和框架，结合我的产品卖点，仿写一条新脚本。`;

    } else if (genMode === 'batch') {
        const shuffled = [...creatorItems].sort(() => 0.5 - Math.random());
        const selectedItems = shuffled.slice(0, batchCount);
        const creatorContext = selectedItems.map((item, index) => `--- 参考文案 ${index + 1} ---\n${item.text}`).join('\n\n');

        systemPrompt = `你现在是一个顶尖的短视频爆款编导。我将提供 ${selectedItems.length} 条不同风格的优秀爆款文案作为参考，以及我当前需要推广的产品卖点。
请你：
分别模仿这 ${selectedItems.length} 条参考文案的独特风格和框架，为我的产品生成 ${selectedItems.length} 条完全不同的全新短视频脚本。

【参考文案库】：
${creatorContext}

【我的新产品卖点/素材】：
${productInfo}

请按照以下格式输出：
### 脚本 1（模仿参考文案 1）
[脚本内容]

### 脚本 2（模仿参考文案 2）
[脚本内容]
...以此类推。`;
        
        userContent = `请从素材库中随机抽取 ${selectedItems.length} 条文案作为参考，为我的产品批量生成 ${selectedItems.length} 条不同风格的新脚本。`;
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userContent,
      timestamp: Date.now(),
    };
    
    setChatMessages(prev => [...prev, userMsg]);

    try {
        const { sendChatMessage } = await import('../services/geminiService');
        
        const responseText = await sendChatMessage(
            [], // Empty history for the first call
            systemPrompt, 
            { isFusionRequest: false, isSublimationRequest: false }
        );

        const botMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            content: responseText,
            timestamp: Date.now(),
        };
        setChatMessages(prev => [...prev, botMsg]);
    } catch (error: any) {
        const errorMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            content: `生成失败: ${error.message || "未知错误"}`,
            timestamp: Date.now(),
        };
        setChatMessages(prev => [...prev, errorMsg]);
    } finally {
        setIsProcessing(false);
    }
  };

  // Sort items
  const extractLikes = (str: string) => {
    const match = str.match(/^(\d+(?:\.\d+)?)\s*(w|k|万|千)?/i);
    if (!match) return null;
    let num = parseFloat(match[1]);
    const unit = match[2]?.toLowerCase();
    if (unit === 'w' || unit === '万') num *= 10000;
    if (unit === 'k' || unit === '千') num *= 1000;
    return num;
  };

  const sortedItems = [...creatorItems].sort((a, b) => {
    if (sortBy === 'name') {
      const numA = extractLikes(a.name);
      const numB = extractLikes(b.name);
      
      if (numA !== null && numB !== null && numA !== numB) {
         return sortOrder === 'asc' ? numA - numB : numB - numA;
      }
      
      // Fallback to natural string comparison (handles "10" vs "2" correctly)
      const compareResult = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      return sortOrder === 'asc' ? compareResult : -compareResult;
    } else {
      return sortOrder === 'asc' ? a.lastModified - b.lastModified : b.lastModified - a.lastModified;
    }
  });

  return (
    <div className="flex h-full overflow-hidden relative">
      {/* Left Sidebar: Configuration */}
      <aside className="w-[480px] min-w-[400px] max-w-[600px] bg-slate-900 border-r border-slate-800 flex flex-col z-10 shadow-xl">
        <div className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur">
          <h2 className="text-sm font-semibold text-slate-400 flex items-center gap-2">
            <UserCheck size={16} /> 博主风格克隆配置
          </h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
          
          {/* Step 1: Creator Library */}
          <div 
            className={`bg-slate-950/50 border ${isDragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-800'} rounded-xl p-5 transition-all`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleFolderDrop}
          >
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <span className="bg-indigo-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">1</span>
              导入优秀博主素材库
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              选择包含该博主历史视频及 .txt 文案的文件夹。
            </p>
            
            <button
              onClick={handleSelectFolder}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors text-sm font-medium border border-slate-700"
            >
              <FolderOpen size={16} />
              {folderName ? '重新选择文件夹' : '选择素材库文件夹'}
            </button>
            
            {folderName && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
                        <CheckCircle size={14} /> 已加载 {creatorItems.length} 条素材
                    </span>
                    <div className="flex items-center gap-2 text-xs">
                        <select 
                            value={sortBy} 
                            onChange={(e) => setSortBy(e.target.value as 'name'|'date')} 
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-indigo-500"
                        >
                            <option value="date">按发布时间</option>
                            <option value="name">按文件名</option>
                        </select>
                        <button 
                            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} 
                            className="p-1 hover:bg-slate-800 border border-slate-700 rounded text-slate-400 transition-colors"
                            title={sortOrder === 'asc' ? '升序' : '降序'}
                        >
                            {sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                        </button>
                    </div>
                </div>
                
                {/* Visual List of loaded items */}
                <div className="max-h-[350px] overflow-y-auto custom-scrollbar pr-2 space-y-3">
                    {sortedItems.map(item => {
                        const isSelected = genMode === 'single' && selectedItemId === item.id;
                        return (
                            <div key={item.id} className={`flex gap-3 p-2 rounded-xl border transition-all ${isSelected ? 'bg-indigo-900/20 border-indigo-500/50 shadow-sm shadow-indigo-500/10' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}>
                                {/* Video Thumbnail (Left) */}
                                <div 
                                    className="w-24 h-32 bg-black rounded-lg overflow-hidden flex-shrink-0 relative border border-slate-800"
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        setContextMenu({ x: e.clientX, y: e.clientY, item });
                                    }}
                                >
                                    {item.videoUrl ? (
                                        <VideoPreview 
                                            url={item.videoUrl} 
                                            onClick={(e) => {
                                                const videoWidth = 256; // w-64
                                                const videoHeight = 455; // h-[455px]
                                                
                                                let x = e.clientX + 20;
                                                let y = e.clientY - videoHeight / 2;
                                                
                                                const maxX = window.innerWidth - videoWidth - 20;
                                                const maxY = window.innerHeight - videoHeight - 20;
                                                
                                                x = Math.max(20, Math.min(x, maxX));
                                                y = Math.max(20, Math.min(y, maxY));

                                                setFloatingVideo({ item, x, y });
                                            }} 
                                        />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 bg-slate-950">
                                            <FileText size={24} className="mb-1 opacity-50" />
                                            <span className="text-[10px]">无视频</span>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Info (Right) */}
                                <div className="flex-1 min-w-0 flex flex-col py-1">
                                    <h4 className="text-sm font-medium text-slate-200 truncate" title={item.name}>{item.name}</h4>
                                    <div className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5">
                                        <Clock size={12} className="text-slate-600" />
                                        {new Date(item.lastModified).toLocaleDateString()} {new Date(item.lastModified).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </div>
                                    
                                    <div className="mt-auto flex gap-2 pt-2">
                                        <button 
                                            onClick={() => setPreviewItem(item)} 
                                            onMouseEnter={() => setHoverPreviewItem(item)}
                                            onMouseLeave={() => setHoverPreviewItem(null)}
                                            className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors border border-slate-700 relative"
                                        >
                                            详情预览
                                        </button>
                                        <button 
                                            onClick={() => { setGenMode('single'); setSelectedItemId(item.id); }} 
                                            className={`flex-1 py-1.5 text-xs rounded-lg transition-colors border ${isSelected ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-indigo-600/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/20'}`}
                                        >
                                            {isSelected ? '已指定' : '指定仿写'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Generation Mode */}
          <div className={`bg-slate-950/50 border border-slate-800 rounded-xl p-5 transition-opacity ${creatorItems.length === 0 ? 'opacity-50 pointer-events-none' : ''}`}>
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <span className="bg-indigo-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">2</span>
              选择克隆模式
            </h3>
            
            <div className="grid grid-cols-3 gap-2 mb-4">
                <button 
                    onClick={() => setGenMode('all')}
                    className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg border text-xs transition-colors ${genMode === 'all' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'}`}
                >
                    <ListVideo size={16} />
                    综合克隆
                </button>
                <button 
                    onClick={() => setGenMode('single')}
                    className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg border text-xs transition-colors ${genMode === 'single' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'}`}
                >
                    <Target size={16} />
                    指定仿写
                </button>
                <button 
                    onClick={() => setGenMode('batch')}
                    className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg border text-xs transition-colors ${genMode === 'batch' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'}`}
                >
                    <Shuffle size={16} />
                    随机批量
                </button>
            </div>

            {/* Mode Specific Options */}
            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                {genMode === 'all' && (
                    <p className="text-xs text-slate-400 leading-relaxed">
                        系统将提取库中所有文案，深度学习该博主的整体风格、常用句式和爆款逻辑，为你生成一条集大成的新脚本。
                    </p>
                )}
                {genMode === 'single' && (
                    <div className="space-y-2">
                        <label className="text-xs text-slate-400">当前对标参考文案：</label>
                        <select 
                            value={selectedItemId}
                            onChange={(e) => setSelectedItemId(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                        >
                            {sortedItems.map(item => (
                                <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                        </select>
                        <p className="text-[10px] text-slate-500 mt-1">提示：你也可以直接在上方素材列表中点击“指定仿写”来选择。</p>
                    </div>
                )}
                {genMode === 'batch' && (
                    <div className="space-y-2">
                        <label className="text-xs text-slate-400">生成数量 (随机抽取参考)：</label>
                        <input 
                            type="number" 
                            min="1" 
                            max="10"
                            value={batchCount}
                            onChange={(e) => setBatchCount(parseInt(e.target.value) || 1)}
                            className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                    </div>
                )}
            </div>
          </div>

          {/* Step 3: Product Info */}
          <div 
            className={`bg-slate-950/50 border ${isDraggingProduct ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-800'} rounded-xl p-5 transition-all`}
            onDragOver={(e) => { e.preventDefault(); setIsDraggingProduct(true); }}
            onDragLeave={() => setIsDraggingProduct(false)}
            onDrop={handleProductFileDrop}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <span className="bg-indigo-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">3</span>
                输入新产品卖点
              </h3>
              <button 
                onClick={() => productFileInputRef.current?.click()}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 bg-indigo-500/10 px-2 py-1 rounded transition-colors"
                title="支持图片、视频、PDF等"
              >
                <Upload size={14} /> 导入资料
              </button>
            </div>
            
            <input 
              type="file" 
              ref={productFileInputRef} 
              onChange={handleProductFileSelect} 
              multiple 
              accept="image/*,video/*,application/pdf" 
              className="hidden" 
            />

            <textarea
              value={productInfo}
              onChange={(e) => setProductInfo(e.target.value)}
              placeholder="手动输入，或拖拽图片/视频/PDF到此处进行AI提炼..."
              className="w-full h-32 bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none custom-scrollbar"
            />

            {productFiles.length > 0 && (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {productFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 bg-slate-800 text-xs text-slate-300 px-2.5 py-1.5 rounded-md border border-slate-700">
                      <span className="truncate max-w-[150px]" title={file.name}>{file.name}</span>
                      <button onClick={() => removeProductFile(idx)} className="text-slate-500 hover:text-red-400 transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleExtractProduct}
                  disabled={isExtractingProduct}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-indigo-400 border border-slate-700 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {isExtractingProduct ? (
                    <><Loader2 size={14} className="animate-spin" /> 正在AI提炼中...</>
                  ) : (
                    <><Sparkles size={14} /> AI 智能提炼卖点</>
                  )}
                </button>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2 text-red-400 text-sm">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div>{errorMsg}</div>
            </div>
          )}

          {/* Step 4: Generate */}
          <button
            onClick={handleGenerate}
            disabled={isProcessing || creatorItems.length === 0 || !productInfo.trim()}
            className={`w-full py-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${
              isProcessing || creatorItems.length === 0 || !productInfo.trim()
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25'
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                正在克隆并生成...
              </>
            ) : (
              <>
                <Sparkles size={18} />
                开始创作 ({genMode === 'batch' ? `生成 ${batchCount} 条` : '生成 1 条'})
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Right Content Area: Chat Interface */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-950 relative">
        {chatMessages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
            <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <UserCheck size={32} className="text-indigo-500/50" />
            </div>
            <h3 className="text-xl font-medium text-slate-300 mb-2">博主风格克隆已就绪</h3>
            <p className="max-w-md text-sm leading-relaxed">
              在左侧导入优秀博主的历史文案库，并输入你的产品卖点。AI 将深度学习该博主的爆款逻辑、情绪递进和词汇偏好，为你量身定制一条具备同等才华的新脚本。
            </p>
          </div>
        ) : (
          <ChatInterface 
            messages={chatMessages} 
            setMessages={setChatMessages}
            isLoadingExternal={isProcessing}
            videoA={dummyVideoState}
            videoB={dummyVideoState}
            className="h-full w-full border-none rounded-none" 
          />
        )}
      </main>

      {/* Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/80">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <FileText size={18} className="text-indigo-400" />
                        素材预览: {previewItem.name}
                    </h3>
                    <button 
                        onClick={() => setPreviewItem(null)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
                
                {/* Modal Body */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left: Video Player */}
                    <div 
                        className="w-1/2 bg-black border-r border-slate-800 flex items-center justify-center relative"
                        onContextMenu={(e) => {
                            e.preventDefault();
                            setContextMenu({ x: e.clientX, y: e.clientY, item: previewItem });
                        }}
                    >
                        {previewItem.videoUrl ? (
                            <video 
                                src={previewItem.videoUrl} 
                                controls 
                                className="max-w-full max-h-full object-contain"
                            />
                        ) : (
                            <div className="text-slate-600 flex flex-col items-center gap-3">
                                <ListVideo size={48} className="opacity-50" />
                                <p className="text-sm">该素材没有匹配到视频文件</p>
                            </div>
                        )}
                    </div>
                    
                    {/* Right: Text Content */}
                    <div className="w-1/2 p-6 overflow-y-auto custom-scrollbar bg-slate-950">
                        <div className="prose prose-invert prose-sm max-w-none">
                            <pre className="whitespace-pre-wrap font-sans text-slate-300 leading-relaxed">
                                {previewItem.text}
                            </pre>
                        </div>
                    </div>
                </div>
                
                {/* Modal Footer */}
                <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end">
                    <button 
                        onClick={() => {
                            setGenMode('single');
                            setSelectedItemId(previewItem.id);
                            setPreviewItem(null);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors text-sm font-medium shadow-lg shadow-indigo-500/20"
                    >
                        <Target size={16} />
                        使用此文案进行指定仿写
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Hover Text Preview Floating Window */}
      {hoverPreviewItem && !previewItem && (
        <div className="fixed top-1/2 left-[500px] -translate-y-1/2 z-40 w-80 max-h-[60vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-left-4 duration-200 pointer-events-none">
            <div className="p-3 border-b border-slate-800 bg-slate-950 flex items-center gap-2">
                <FileText size={16} className="text-indigo-400" />
                <h3 className="text-sm font-medium text-slate-200 truncate">{hoverPreviewItem.name}</h3>
            </div>
            <div className="p-4 overflow-y-auto custom-scrollbar">
                <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {hoverPreviewItem.text}
                </p>
            </div>
        </div>
      )}

      {/* Custom Context Menu */}
      {contextMenu && (
        <>
            <div className="fixed inset-0 z-50" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}></div>
            <div 
                className="fixed z-50 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1 w-64 animate-in fade-in zoom-in-95 duration-100"
                style={{ left: Math.min(contextMenu.x, window.innerWidth - 256), top: Math.min(contextMenu.y, window.innerHeight - 100) }}
            >
                <div className="px-1 py-1">
                    <button 
                        className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 transition-colors flex items-center gap-2 rounded-md"
                        onClick={() => {
                            try {
                                // 尝试检测是否在桌面端套壳环境(如Electron)中
                                if (typeof window !== 'undefined' && (window as any).require) {
                                    const { shell } = (window as any).require('electron');
                                    shell.openPath(folderName); // 尝试打开当前加载的文件夹
                                    setContextMenu(null);
                                    return;
                                }
                                // 纯网页环境抛出错误进入降级
                                throw new Error("Browser sandbox restriction");
                            } catch (e) {
                                navigator.clipboard.writeText(contextMenu.item.name);
                                setContextMenu(null);
                                showToast("⚠️ 网页端受限无法直接打开文件夹，已自动为您复制文件名");
                            }
                        }}
                    >
                        <FolderOpen size={14} />
                        打开所在文件夹
                    </button>
                    <button 
                        className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 transition-colors flex items-center gap-2 rounded-md"
                        onClick={() => {
                            navigator.clipboard.writeText(contextMenu.item.name);
                            setContextMenu(null);
                            showToast(`已复制文件名: ${contextMenu.item.name}`);
                        }}
                    >
                        <Copy size={14} />
                        复制文件名 (便于本地搜索)
                    </button>
                </div>
            </div>
        </>
      )}

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg border border-slate-700 animate-in fade-in slide-in-from-bottom-4">
          {toastMsg}
        </div>
      )}

      {/* Floating Video Player */}
      {floatingVideo && (
        <DraggableVideo 
          item={floatingVideo.item} 
          initialX={floatingVideo.x} 
          initialY={floatingVideo.y} 
          onClose={() => setFloatingVideo(null)} 
          onContextMenu={(e, item) => {
            setContextMenu({ x: e.clientX, y: e.clientY, item });
          }}
        />
      )}
    </div>
  );
};

export default CreatorCloneModule;
