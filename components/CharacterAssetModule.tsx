import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Image as ImageIcon, Loader2, AlertCircle, UserCheck, X, Upload, FileImage, FileVideo, Wand2 } from 'lucide-react';
import { ChatMessage } from '../types';
import ChatInterface from './ChatInterface';

const dummyVideoState = {
  file: null,
  videoUrl: null,
  isExtracting: false,
  extractedScript: '',
  extractedAnalysis: '',
  error: null
};

const CharacterAssetModule: React.FC = () => {
  const [productInfo, setProductInfo] = useState('');
  const [productFiles, setProductFiles] = useState<File[]>([]);
  const [isExtractingProduct, setIsExtractingProduct] = useState(false);
  const [isDraggingProduct, setIsDraggingProduct] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const productFileInputRef = useRef<HTMLInputElement>(null);

  const [errorMsg, setErrorMsg] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  useEffect(() => {
    const urls = productFiles.map(file => {
      if (file.type.startsWith('image/')) {
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
  }, [productFiles]);

  const handleProductFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingProduct(false);
    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (validFiles.length > 0) {
      setProductFiles(prev => [...prev, ...validFiles]);
    } else if (files.length > 0) {
      setErrorMsg('请上传图片或视频文件');
    }
  };

  const handleProductFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const validFiles = files.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
      if (validFiles.length > 0) {
        setProductFiles(prev => [...prev, ...validFiles]);
      } else {
        setErrorMsg('请上传图片或视频文件');
      }
    }
    if (productFileInputRef.current) {
      productFileInputRef.current.value = '';
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
      e.preventDefault();
      setProductFiles(prev => [...prev, ...files]);
    }
  };

  const removeProductFile = (index: number) => {
    setProductFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleExtractProduct = async (filesToProcess: File[] = productFiles, prompt: string = productInfo) => {
    if (filesToProcess.length === 0) return;
    setIsExtractingProduct(true);
    setErrorMsg('');
    
    // Add user message
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: `[上传了 ${filesToProcess.length} 个媒体文件]\n${prompt ? `额外要求: ${prompt}` : '请提取角色资产并生成三视图提示词。'}`,
      timestamp: Date.now(),
    };
    
    setChatMessages(prev => [...prev, userMsg]);

    try {
      const { extractCharacterAsset } = await import('../services/geminiService');
      const responseText = await extractCharacterAsset(filesToProcess, prompt);
      
      const botMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          content: responseText,
          timestamp: Date.now(),
      };
      setChatMessages(prev => [...prev, botMsg]);
      
      // Clear files after successful extraction if you want, but keeping them might be good for context
      // setProductFiles([]); 
    } catch (error: any) {
      setErrorMsg(`提取失败: ${error.message}`);
      const errorMsgObj: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'error',
          content: `生成失败: ${error.message || "未知错误"}`,
          timestamp: Date.now(),
      };
      setChatMessages(prev => [...prev, errorMsgObj]);
    } finally {
      setIsExtractingProduct(false);
    }
  };

  const handleGenerateImage = async () => {
    // Find the last model message containing the prompt
    const lastModelMessage = chatMessages.slice().reverse().find(m => m.role === 'model' && m.content.includes('最终 AI 提示词'));
    if (!lastModelMessage) return;

    // Extract the prompt text
    let promptToUse = lastModelMessage.content;
    const match = promptToUse.match(/🎨 最终 AI 提示词 \(Copy & Paste\)\n([\s\S]*?)(?:\n🚫 负向提示词|$)/);
    if (match && match[1]) {
      promptToUse = match[1].trim();
    }

    setIsGeneratingImage(true);
    setErrorMsg('');

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: `[一键生图] 请根据上述提示词生成角色三视图。`,
      timestamp: Date.now(),
    };
    setChatMessages(prev => [...prev, userMsg]);

    try {
      const { generateImage } = await import('../services/geminiService');
      const imageUrl = await generateImage(promptToUse);
      
      const botMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          content: `✅ 角色三视图生成成功！\n\n![Generated Character Sheet](${imageUrl})`,
          timestamp: Date.now(),
      };
      setChatMessages(prev => [...prev, botMsg]);
    } catch (error: any) {
      setErrorMsg(`生图失败: ${error.message}`);
      const errorMsgObj: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'error',
          content: `生图失败: ${error.message || "未知错误"}`,
          timestamp: Date.now(),
      };
      setChatMessages(prev => [...prev, errorMsgObj]);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const hasGeneratedPrompt = chatMessages.some(m => m.role === 'model' && m.content.includes('最终 AI 提示词'));

  return (
    <div className="flex h-full overflow-hidden relative">
      {/* Left Sidebar: Configuration */}
      <aside className="w-[480px] min-w-[400px] max-w-[600px] bg-slate-900 border-r border-slate-800 flex flex-col z-10 shadow-xl">
        <div className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur">
          <h2 className="text-sm font-semibold text-slate-400 flex items-center gap-2">
            <UserCheck size={16} /> 角色资产三视图指导 (Module F)
          </h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
          
          <div 
            className={`bg-slate-950/50 border ${isDraggingProduct ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-800'} rounded-xl p-5 transition-all`}
            onDragOver={(e) => { e.preventDefault(); setIsDraggingProduct(true); }}
            onDragLeave={() => setIsDraggingProduct(false)}
            onDrop={handleProductFileDrop}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <span className="bg-indigo-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">1</span>
                上传角色参考图/视频
              </h3>
              <button 
                onClick={() => productFileInputRef.current?.click()}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 bg-indigo-500/10 px-2 py-1 rounded transition-colors"
                title="支持图片、视频"
              >
                <Upload size={14} /> 导入资料
              </button>
            </div>
            
            <input 
              type="file" 
              ref={productFileInputRef} 
              onChange={handleProductFileSelect} 
              multiple 
              accept="image/*,video/*" 
              className="hidden" 
            />

            <textarea
              value={productInfo}
              onChange={(e) => setProductInfo(e.target.value)}
              onPaste={handlePaste}
              placeholder="输入额外要求（如：换成红色的裙子），支持直接粘贴图片/视频到此处..."
              className="w-full h-32 bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none custom-scrollbar"
            />

            {productFiles.length > 0 && (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {productFiles.map((file, idx) => (
                    <div key={idx} className="relative group flex items-center justify-center bg-slate-800 rounded-md border border-slate-700 overflow-hidden w-16 h-16 shrink-0">
                      {file.type.startsWith('image/') && previewUrls[idx] ? (
                        <img src={previewUrls[idx]} alt={file.name} className="w-full h-full object-cover" />
                      ) : (
                        <FileVideo size={24} className="text-indigo-400" />
                      )}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                        <button onClick={() => removeProductFile(idx)} className="text-white hover:text-red-400 transition-colors p-1 bg-slate-900/50 rounded-full">
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <p className="text-xs text-slate-500 mt-3">
              提示：支持上传多张图片或视频。配置好额外要求后，点击下方按钮开始生成。
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2 text-red-400 text-sm">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div>{errorMsg}</div>
            </div>
          )}

          <button
            onClick={() => handleExtractProduct(productFiles, productInfo)}
            disabled={isExtractingProduct || productFiles.length === 0}
            className={`w-full py-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${
              isExtractingProduct || productFiles.length === 0
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25'
            }`}
          >
            {isExtractingProduct ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                正在提取特征并生成...
              </>
            ) : (
              <>
                <Sparkles size={18} />
                生成提示词
              </>
            )}
          </button>

          {hasGeneratedPrompt && (
            <button
              onClick={handleGenerateImage}
              disabled={isGeneratingImage}
              className={`w-full py-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                isGeneratingImage
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/25'
              }`}
            >
              {isGeneratingImage ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  正在生成角色三视图...
                </>
              ) : (
                <>
                  <Wand2 size={18} />
                  一键生图 (基于最新提示词)
                </>
              )}
            </button>
          )}
        </div>
      </aside>

      {/* Right Content Area: Chat Interface */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-950 relative">
        {chatMessages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
            <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <ImageIcon size={32} className="text-indigo-500/50" />
            </div>
            <h3 className="text-xl font-medium text-slate-300 mb-2">角色资产三视图指导已就绪</h3>
            <p className="max-w-md text-sm leading-relaxed">
              在左侧上传人物图片或视频，AI 将自动提取其视觉特征（容貌、发型、服装、配饰），并生成高度标准化的 AI 绘画提示词，用于生成包含“头部高清特写 + 全身三视图”的专业角色人设图。
            </p>
          </div>
        ) : (
          <ChatInterface 
            messages={chatMessages} 
            setMessages={setChatMessages}
            isLoadingExternal={isExtractingProduct}
            videoA={dummyVideoState}
            videoB={dummyVideoState}
            className="h-full w-full border-none rounded-none" 
          />
        )}
      </main>
    </div>
  );
};

export default CharacterAssetModule;
