import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, FileVideo, FileImage, Sparkles, Bot, User, Trash2, Video, FolderOpen, Save } from 'lucide-react';
import { ChatMessage, SavedFramework } from '../types';
import { generateViralVideoPrompt } from '../services/geminiService';
import MarkdownRenderer from './MarkdownRenderer';
import ChatInterface from './ChatInterface';
import { LibraryExternalWindow } from './InputForm';
import { openDirectory, saveAnalysisToDirectory, isFileSystemSupported } from '../services/fileSystemService';

const ViralVideoModule: React.FC = () => {
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [extraPrompt, setExtraPrompt] = useState('');
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Local File System State
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [libraryRefreshTrigger, setLibraryRefreshTrigger] = useState(0);
  const [libraryFocusTrigger, setLibraryFocusTrigger] = useState(0);

  useEffect(() => {
    const urls = mediaFiles.map(file => {
      if (file.type.startsWith('image/')) {
        return URL.createObjectURL(file);
      } else if (file.type.startsWith('video/')) {
        return URL.createObjectURL(file);
      }
      return '';
    });
    setPreviewUrls(urls);

    return () => {
      urls.forEach(url => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [mediaFiles]);

  const scrollToBottom = () => {
    setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, isGenerating]);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
      setMediaFiles(prev => [...prev, ...files]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
      setMediaFiles(prev => [...prev, ...files]);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1 || items[i].type.indexOf('video') !== -1) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      setMediaFiles(prev => [...prev, ...files]);
    }
  };

  const removeFile = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (mediaFiles.length === 0) {
      setErrorMsg('请先上传至少一个视频或图片素材');
      return;
    }

    setErrorMsg('');
    setIsGenerating(true);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: `[上传了 ${mediaFiles.length} 个媒体文件]\n请拆解画面并反推即梦2.0提示词。${extraPrompt ? `\n额外要求：${extraPrompt}` : ''}`,
      timestamp: Date.now(),
    };
    setChatMessages(prev => [...prev, userMsg]);

    try {
      const result = await generateViralVideoPrompt(mediaFiles, extraPrompt);
      
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: result,
        timestamp: Date.now(),
      };
      setChatMessages(prev => [...prev, botMsg]);

      // Auto-save if directory is connected
      if (dirHandle && mediaFiles.length > 0) {
          try {
              // We pass empty string for script, and the result for analysis.
              await saveAnalysisToDirectory(dirHandle, mediaFiles[0].name, "", result);
              setLibraryRefreshTrigger(prev => prev + 1);
          } catch (e: any) {
              console.error("Auto-save failed", e);
          }
      }

    } catch (error: any) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: `生成失败: ${error.message || "未知错误"}`,
        timestamp: Date.now(),
      };
      setChatMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConnectFolder = async () => {
      try {
          const handle = await openDirectory(dirHandle);
          if (handle) {
              setDirHandle(handle);
              setLibraryRefreshTrigger(prev => prev + 1);
          }
      } catch (e: any) {
          console.error("Folder connection failed", e);
      }
  };

  const openLibrary = () => {
      if (isLibraryOpen) {
          setLibraryFocusTrigger(prev => prev + 1);
      } else {
          setIsLibraryOpen(true);
          setLibraryFocusTrigger(0);
      }
  };

  const handleLibrarySelect = (item: SavedFramework, videoFile: File | null) => {
      if (videoFile) {
          setMediaFiles([videoFile]);
      }
      setChatMessages([
          { 
              id: Date.now().toString(), 
              role: 'model', 
              content: `**[已从本地加载已保存的拆解模板：${item.title}]**\n\n${item.analysis}`, 
              timestamp: Date.now() 
          }
      ]);
  };

  return (
    <div className="flex h-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Left Sidebar: Input Area */}
      <aside className="w-[380px] min-w-[320px] max-w-[450px] bg-slate-900 border-r border-slate-800 flex flex-col z-10 shadow-xl">
        <div className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur flex justify-between items-center">
          <h2 className="text-sm font-semibold text-slate-400 flex items-center gap-2">
            <Video size={14} /> 即梦 Seedance 2.0 视觉总监 (Module G)
          </h2>
          
          {isFileSystemSupported() && (
             <div className="flex gap-2">
                 <button onClick={handleConnectFolder} className="text-xs flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition border border-slate-700">
                     <FolderOpen size={12} />
                     {dirHandle ? '切换目录' : '本地目录'}
                 </button>
                 {dirHandle && (
                     <button onClick={openLibrary} className="relative text-xs flex items-center gap-1.5 px-2 py-1 rounded bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 transition border border-indigo-500/20">
                         <Save size={12} />
                         素材库
                     </button>
                 )}
             </div>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-6">
          {/* File Upload Section */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xs">1</div>
                <h3 className="text-sm font-medium text-slate-200">上传参考视频/截图</h3>
              </div>
              <label className="cursor-pointer text-xs flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-500/10 px-2 py-1 rounded">
                <Upload size={12} />
                导入资料
                <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleFileSelect} />
              </label>
            </div>

            <div 
              className={`border-2 border-dashed rounded-lg p-4 transition-all text-center relative ${
                isDragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 hover:border-slate-600 bg-slate-900/50'
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              onPaste={handlePaste}
              tabIndex={0}
            >
              <textarea
                value={extraPrompt}
                onChange={(e) => setExtraPrompt(e.target.value)}
                placeholder="输入额外要求（如：换成红色的裙子），支持直接粘贴图片/视频到此处..."
                className="w-full h-24 bg-transparent resize-none focus:outline-none text-sm text-slate-300 placeholder-slate-600"
              />
              
              {mediaFiles.length > 0 && (
                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {mediaFiles.map((file, idx) => (
                      <div key={idx} className="relative group flex items-center justify-center bg-slate-800 rounded-md border border-slate-700 overflow-hidden w-16 h-16 shrink-0">
                        {file.type.startsWith('image/') && previewUrls[idx] ? (
                          <img src={previewUrls[idx]} alt={file.name} className="w-full h-full object-cover" />
                        ) : file.type.startsWith('video/') && previewUrls[idx] ? (
                          <video src={previewUrls[idx]} className="w-full h-full object-cover" />
                        ) : (
                          <FileVideo size={24} className="text-indigo-400" />
                        )}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                          <button onClick={() => removeFile(idx)} className="text-white hover:text-red-400 transition-colors p-1 bg-slate-900/50 rounded-full">
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <p className="text-[10px] text-slate-500 mt-2">提示：支持上传多张图片或视频。配置好额外要求后，点击下方按钮开始生成。</p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {errorMsg}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={isGenerating || mediaFiles.length === 0}
            className={`w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all shadow-lg ${
              isGenerating || mediaFiles.length === 0
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/25'
            }`}
          >
            <Sparkles size={18} />
            {isGenerating ? '正在反推提示词...' : '生成即梦2.0提示词'}
          </button>
        </div>
      </aside>

      {/* Right Content Area: Chat Interface */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-950 relative">
         <ChatInterface 
             messages={chatMessages} 
             setMessages={setChatMessages}
             isLoadingExternal={isGenerating}
             className="h-full w-full border-none rounded-none" 
             emptyStateTitle="即梦 Seedance 2.0 视觉总监"
             emptyStateDescription={
               <>
                 请在左侧上传短视频或截图，我将为您逆向拆解画面，<br/>
                 并生成适合即梦 2.0 运行的高表现力、摄影级、纯净无字幕提示词。<br/>
                 生成后的模板将支持自动保存到本地目录。
               </>
             }
             emptyStateIcon={<Video size={48} className="mb-6 opacity-20 text-indigo-500" />}
         />
      </main>

      {/* Library External Window Component */}
      <LibraryExternalWindow 
         isOpen={isLibraryOpen}
         onClose={() => setIsLibraryOpen(false)}
         onSelect={handleLibrarySelect}
         dirHandle={dirHandle}
         setDirHandle={setDirHandle}
         refreshTrigger={libraryRefreshTrigger}
         focusTrigger={libraryFocusTrigger}
         mode="G"
      />
    </div>
  );
};

export default ViralVideoModule;
