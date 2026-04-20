
import React, { useState } from 'react';
import { FusionRequest, VideoState, ChatMessage } from './types';
import InputForm from './components/InputForm';
import ChatInterface from './components/ChatInterface';
import BatchImportModule from './components/BatchImportModule';
import CreatorCloneModule from './components/CreatorCloneModule';
import CharacterAssetModule from './components/CharacterAssetModule';
import ViralVideoModule from './components/ViralVideoModule';
import FloorPlanModule from './components/FloorPlanModule';
import { LayoutDashboard, Sparkles, FolderSync, UserCheck, Image as ImageIcon, Video, Map } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'generation' | 'batchImport' | 'creatorClone' | 'characterAsset' | 'viralVideo' | 'floorPlan'>('generation');

  // Lifted State for Videos
  const [videoA, setVideoA] = useState<VideoState>({ file: null, videoUrl: null, isExtracting: false, extractedScript: '', extractedAnalysis: '', error: null });
  const [videoB, setVideoB] = useState<VideoState>({ file: null, videoUrl: null, isExtracting: false, extractedScript: '', extractedAnalysis: '', error: null });
  
  // Shared Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Trigger Fusion from InputForm (Video A + B)
  const handleFusion = async (data: FusionRequest) => {
    setIsProcessing(true);
    
    // Add a user message representing the "Start" action (visible to user)
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: "请根据左侧上传的视频A（产品）和视频B（风格框架），为我生成一个新的短视频脚本。",
      timestamp: Date.now(),
    };
    
    setChatMessages(prev => [...prev, userMsg]);
    
    try {
        const { sendChatMessage } = await import('./services/geminiService');
        const responseText = await sendChatMessage(
            chatMessages, 
            "", 
            { 
                videoA: data.productContext, 
                videoB: data.styleContext,
                isFusionRequest: true
            }
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

  // Trigger Sublimation from InputForm (Video A + C)
  const handleSublimation = async (data: FusionRequest) => {
    setIsProcessing(true);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: "请基于产品A的信息，并运用方法论C中的理论，为我生成/优化一条大师级脚本。",
      timestamp: Date.now(),
    };
    
    setChatMessages(prev => [...prev, userMsg]);

    try {
        const { sendChatMessage } = await import('./services/geminiService');
        const responseText = await sendChatMessage(
            chatMessages, 
            "", 
            { 
                videoA: data.productContext, 
                videoC: data.methodologyContext,
                isSublimationRequest: true
            }
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
            content: `升华生成失败: ${error.message || "未知错误"}`,
            timestamp: Date.now(),
        };
        setChatMessages(prev => [...prev, errorMsg]);
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 shrink-0 z-20 shadow-md">
        <div className="w-full px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-1.5 rounded-lg shadow-lg shadow-indigo-500/20">
                <LayoutDashboard size={20} className="text-white" />
              </div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                ScriptMaster AI
              </h1>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 ml-8 border-l border-slate-700 pl-6">
              <button
                onClick={() => setActiveTab('generation')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'generation'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Sparkles size={16} />
                脚本生成 (主界面)
              </button>
              <button
                onClick={() => setActiveTab('creatorClone')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'creatorClone'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <UserCheck size={16} />
                博主风格克隆 (模块E)
              </button>
              <button
                onClick={() => setActiveTab('batchImport')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'batchImport'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <FolderSync size={16} />
                独立批量导入 (模块D)
              </button>
              <button
                onClick={() => setActiveTab('characterAsset')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'characterAsset'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <ImageIcon size={16} />
                角色资产三视图指导 (模块F)
              </button>
              <button
                onClick={() => setActiveTab('viralVideo')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'viralVideo'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Video size={16} />
                即梦 Seedance 2.0 视觉总监 (模块G)
              </button>
              <button
                onClick={() => setActiveTab('floorPlan')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'floorPlan'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Map size={16} />
                装修实景标注 (模块H)
              </button>
            </div>
          </div>

          <div className="text-right flex items-center gap-4">
             <span className="text-[10px] font-mono text-slate-500 border border-slate-800 px-2 py-1 rounded bg-slate-900 hidden sm:inline-block">
               Gemini 3.1 Pro
             </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className={`flex flex-1 overflow-hidden ${activeTab === 'generation' ? '' : 'hidden'}`}>
        {/* Left Sidebar: Video Inputs */}
        <aside className="w-[380px] min-w-[320px] max-w-[450px] bg-slate-900 border-r border-slate-800 flex flex-col z-10 shadow-xl">
           <div className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur">
              <h2 className="text-sm font-semibold text-slate-400 flex items-center gap-2">
                 <Sparkles size={14} /> 视频素材配置
              </h2>
           </div>
           <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <InputForm 
                onSubmit={handleFusion} 
                onSublimate={handleSublimation}
                isGenerating={isProcessing} 
                videoA={videoA}
                setVideoA={setVideoA}
                videoB={videoB}
                setVideoB={setVideoB}
              />
           </div>
        </aside>

        {/* Right Content Area: Unified Chat Interface */}
        <main className="flex-1 flex flex-col min-w-0 bg-slate-950 relative">
             <ChatInterface 
                messages={chatMessages} 
                setMessages={setChatMessages}
                isLoadingExternal={isProcessing}
                videoA={videoA} 
                videoB={videoB} 
                className="h-full w-full border-none rounded-none" 
             />
        </main>
      </div>

      <div className={`flex-1 overflow-hidden ${activeTab === 'creatorClone' ? '' : 'hidden'}`}>
        <CreatorCloneModule />
      </div>

      <div className={`flex-1 overflow-hidden ${activeTab === 'batchImport' ? '' : 'hidden'}`}>
        <BatchImportModule />
      </div>

      <div className={`flex-1 overflow-hidden ${activeTab === 'characterAsset' ? '' : 'hidden'}`}>
        <CharacterAssetModule />
      </div>

      <div className={`flex-1 overflow-hidden ${activeTab === 'viralVideo' ? '' : 'hidden'}`}>
        <ViralVideoModule />
      </div>

      <div className={`flex-1 overflow-hidden ${activeTab === 'floorPlan' ? '' : 'hidden'}`}>
        <FloorPlanModule />
      </div>
    </div>
  );
};

export default App;
