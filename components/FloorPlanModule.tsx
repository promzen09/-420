import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, Plus, Save, Download, Image as ImageIcon, Trash2, X, Move, Maximize2, FileUp, FileDown } from 'lucide-react';
import { get, set } from 'idb-keyval';

interface AnchorPoint {
  id: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  note: string;
  imageUrl: string | null; // base64 data URL
  color?: string;
}

interface FloorPlanData {
  baseMapUrl: string | null;
  anchors: AnchorPoint[];
}

const STORAGE_KEY = 'floor_plan_data';
const PREDEFINED_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'];

const FloorPlanModule: React.FC = () => {
  const [baseMapUrl, setBaseMapUrl] = useState<string | null>(null);
  const [anchors, setAnchors] = useState<AnchorPoint[]>([]);
  const [selectedAnchorId, setSelectedAnchorId] = useState<string | null>(null);
  const [isDraggingAnchor, setIsDraggingAnchor] = useState<string | null>(null);
  const [hoveredAnchorId, setHoveredAnchorId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const anchorImageInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await get<FloorPlanData>(STORAGE_KEY);
        if (data) {
          setBaseMapUrl(data.baseMapUrl);
          setAnchors(data.anchors || []);
        }
      } catch (error) {
        console.error("Failed to load floor plan data:", error);
      }
    };
    loadData();
  }, []);

  // Auto-save
  const autoSave = useCallback(async (newBaseMapUrl: string | null, newAnchors: AnchorPoint[]) => {
    try {
      await set(STORAGE_KEY, { baseMapUrl: newBaseMapUrl, anchors: newAnchors });
      setSaveMessage('已自动保存');
      setTimeout(() => setSaveMessage(''), 2000);
    } catch (error) {
      console.error("Auto-save failed:", error);
      setSaveMessage('自动保存失败');
    }
  }, []);

  const handleManualSave = async () => {
    setIsSaving(true);
    try {
      await set(STORAGE_KEY, { baseMapUrl, anchors });
      setSaveMessage('保存成功');
      setTimeout(() => setSaveMessage(''), 2000);
    } catch (error) {
      console.error("Save failed:", error);
      setSaveMessage('保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBaseMapUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setBaseMapUrl(result);
        autoSave(result, anchors);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingAnchor || selectedAnchorId) {
      // If we are dragging or have an anchor selected, don't add a new one on click
      // Unless we click exactly on the background to deselect
      if ((e.target as HTMLElement).id === 'map-container' || (e.target as HTMLElement).tagName === 'IMG') {
        setSelectedAnchorId(null);
      }
      return;
    }

    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const randomColor = PREDEFINED_COLORS[Math.floor(Math.random() * PREDEFINED_COLORS.length)];

    const newAnchor: AnchorPoint = {
      id: Date.now().toString(),
      x,
      y,
      note: '新建锚点',
      imageUrl: null,
      color: randomColor,
    };

    const newAnchors = [...anchors, newAnchor];
    setAnchors(newAnchors);
    setSelectedAnchorId(newAnchor.id);
    autoSave(baseMapUrl, newAnchors);
  };

  const handleAnchorMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedAnchorId(id);
    setIsDraggingAnchor(id);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingAnchor && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      let x = ((e.clientX - rect.left) / rect.width) * 100;
      let y = ((e.clientY - rect.top) / rect.height) * 100;
      
      // Clamp values
      x = Math.max(0, Math.min(100, x));
      y = Math.max(0, Math.min(100, y));

      setAnchors(prev => prev.map(a => a.id === isDraggingAnchor ? { ...a, x, y } : a));
    }
  };

  const handleMouseUp = () => {
    if (isDraggingAnchor) {
      setIsDraggingAnchor(null);
      autoSave(baseMapUrl, anchors);
    }
  };

  const updateSelectedAnchor = (updates: Partial<AnchorPoint>) => {
    if (!selectedAnchorId) return;
    const newAnchors = anchors.map(a => a.id === selectedAnchorId ? { ...a, ...updates } : a);
    setAnchors(newAnchors);
    autoSave(baseMapUrl, newAnchors);
  };

  const deleteSelectedAnchor = () => {
    if (!selectedAnchorId) return;
    const newAnchors = anchors.filter(a => a.id !== selectedAnchorId);
    setAnchors(newAnchors);
    setSelectedAnchorId(null);
    autoSave(baseMapUrl, newAnchors);
  };

  const handleAnchorImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        updateSelectedAnchor({ imageUrl: event.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnchorImagePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            updateSelectedAnchor({ imageUrl: event.target?.result as string });
          };
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  };

  const handleAnchorImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        updateSelectedAnchor({ imageUrl: event.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const exportToJson = () => {
    const dataToExport: FloorPlanData = { baseMapUrl, anchors };
    const jsonString = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '装修实景标注工程.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleJsonImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsedData = JSON.parse(content) as FloorPlanData;
        
        if (parsedData.anchors !== undefined) {
          setBaseMapUrl(parsedData.baseMapUrl || null);
          setAnchors(parsedData.anchors || []);
          setSelectedAnchorId(null);
          autoSave(parsedData.baseMapUrl || null, parsedData.anchors || []);
          setSaveMessage('导入成功');
          setTimeout(() => setSaveMessage(''), 2000);
        } else {
          alert('无效的 JSON 文件格式');
        }
      } catch (error) {
        console.error('Failed to parse JSON:', error);
        alert('解析 JSON 失败，请确保文件格式正确');
      }
    };
    reader.readAsText(file);
    
    // Reset input so the same file can be imported again if needed
    if (jsonInputRef.current) {
      jsonInputRef.current.value = '';
    }
  };

  const exportToHtml = () => {
    const htmlContent = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>装修户型图实景标注</title>
    <style>
        body { margin: 0; padding: 20px; font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
        h1 { text-align: center; color: #0f172a; }
        .text-center { text-align: center; }
        .map-wrapper { position: relative; display: inline-block; max-width: 100%; border: 1px solid #e2e8f0; border-radius: 8px; background: #f1f5f9; }
        .map-image { max-width: 100%; height: auto; display: block; }
        .anchor { position: absolute; width: 16px; height: 16px; border: 2px solid white; border-radius: 50%; transform: translate(-50%, -50%); cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.2); transition: transform 0.2s; }
        .anchor:hover { transform: translate(-50%, -50%) scale(1.2); z-index: 10; }
        .tooltip { position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); margin-bottom: 10px; background: white; padding: 12px; border-radius: 8px; box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1); display: none; width: 250px; pointer-events: none; z-index: 20; border: 1px solid #e2e8f0; }
        .anchor:hover .tooltip { display: block; }
        .tooltip img { width: 100%; border-radius: 4px; margin-bottom: 8px; }
        .tooltip p { margin: 0; font-size: 14px; color: #334155; font-weight: 500; }
        .modal { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 100; align-items: center; justify-content: center; padding: 20px; }
        .modal.active { display: flex; }
        .modal img { max-width: 100%; max-height: 90vh; border-radius: 8px; }
        .modal-close { position: absolute; top: 20px; right: 20px; color: white; font-size: 30px; cursor: pointer; background: none; border: none; }
        .modal-note { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.7); color: white; padding: 10px 20px; border-radius: 20px; font-size: 16px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>装修户型图实景标注</h1>
        <div class="text-center">
            <div class="map-wrapper">
                <img src="${baseMapUrl || ''}" class="map-image" alt="户型图" />
                ${anchors.map(a => `
                    <div class="anchor" style="left: ${a.x}%; top: ${a.y}%; background-color: ${a.color || '#ef4444'};" onclick="openModal('${a.id}')">
                        <div class="tooltip">
                            ${a.imageUrl ? `<img src="${a.imageUrl}" alt="实景图" />` : '<div style="height: 100px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; color: #94a3b8; margin-bottom: 8px; border-radius: 4px;">无实景图</div>'}
                            <p>${a.note || '无备注'}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>

    <div id="imageModal" class="modal" onclick="closeModal()">
        <button class="modal-close" onclick="closeModal()">&times;</button>
        <img id="modalImg" src="" alt="大图" onclick="event.stopPropagation()" />
        <div id="modalNote" class="modal-note"></div>
    </div>

    <script>
        const anchorsData = ${JSON.stringify(anchors)};
        
        function openModal(id) {
            const anchor = anchorsData.find(a => a.id === id);
            if (anchor && anchor.imageUrl) {
                document.getElementById('modalImg').src = anchor.imageUrl;
                document.getElementById('modalNote').textContent = anchor.note;
                document.getElementById('imageModal').classList.add('active');
            }
        }

        function closeModal() {
            document.getElementById('imageModal').classList.remove('active');
        }
    </script>
</body>
</html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '装修实景标注.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const selectedAnchor = anchors.find(a => a.id === selectedAnchorId);

  return (
    <div className="flex h-full bg-slate-950 text-slate-100 overflow-hidden" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      
      {/* Main Area: Floor Plan */}
      <div className="flex-1 flex flex-col relative">
        {/* Toolbar */}
        <div className="h-14 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="font-medium text-slate-200">模块 H: 装修户型图实景标注</h2>
            {saveMessage && (
              <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full animate-in fade-in">
                {saveMessage}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="file" 
              accept=".json" 
              className="hidden" 
              ref={jsonInputRef} 
              onChange={handleJsonImport} 
            />
            <button 
              onClick={() => jsonInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
              title="导入 JSON 工程文件"
            >
              <FileUp size={16} />
              导入工程
            </button>
            <button 
              onClick={exportToJson}
              disabled={!baseMapUrl && anchors.length === 0}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors disabled:opacity-50"
              title="导出为 JSON 工程文件"
            >
              <FileDown size={16} />
              导出工程
            </button>
            <div className="w-px h-6 bg-slate-700 mx-1"></div>
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleBaseMapUpload} 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
            >
              <Upload size={16} />
              {baseMapUrl ? '更换底图' : '上传底图'}
            </button>
            <button 
              onClick={handleManualSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <Save size={16} />
              保存
            </button>
            <button 
              onClick={exportToHtml}
              disabled={!baseMapUrl}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <Download size={16} />
              导出分享
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 overflow-auto bg-slate-950 p-4 sm:p-8 flex justify-center items-start sm:items-center relative">
          {!baseMapUrl ? (
            <div className="text-center">
              <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-500">
                <ImageIcon size={32} />
              </div>
              <h3 className="text-lg font-medium text-slate-300 mb-2">请先上传户型图底图</h3>
              <p className="text-slate-500 text-sm mb-6">支持 JPG, PNG 格式图片</p>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors shadow-lg shadow-indigo-500/20"
              >
                选择图片
              </button>
            </div>
          ) : (
            <div 
              ref={containerRef}
              id="map-container"
              className="relative shadow-2xl shadow-black/50 border border-slate-800 cursor-crosshair select-none inline-block shrink-0"
              onClick={handleMapClick}
            >
              <img 
                src={baseMapUrl} 
                alt="户型图底图" 
                className="max-w-full block pointer-events-none"
                style={{ maxHeight: '75vh' }}
                draggable={false}
              />
              
              {/* Anchors */}
              {anchors.map(anchor => (
                <div
                  key={anchor.id}
                  className={`absolute w-4 h-4 -ml-2 -mt-2 rounded-full border-2 shadow-lg cursor-grab active:cursor-grabbing flex items-center justify-center transition-transform ${
                    selectedAnchorId === anchor.id 
                      ? 'border-white scale-125 z-20' 
                      : 'border-white hover:scale-110 z-10'
                  }`}
                  style={{ 
                    left: `${anchor.x}%`, 
                    top: `${anchor.y}%`,
                    backgroundColor: anchor.color || '#ef4444'
                  }}
                  onMouseDown={(e) => handleAnchorMouseDown(e, anchor.id)}
                  onMouseEnter={() => setHoveredAnchorId(anchor.id)}
                  onMouseLeave={() => setHoveredAnchorId(null)}
                >
                  {/* Tooltip on hover */}
                  {hoveredAnchorId === anchor.id && !isDraggingAnchor && (
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-2 pointer-events-none z-30">
                      {anchor.imageUrl ? (
                        <img src={anchor.imageUrl} alt="预览" className="w-full h-24 object-cover rounded mb-2" />
                      ) : (
                        <div className="w-full h-24 bg-slate-900 rounded mb-2 flex items-center justify-center text-slate-600 text-xs">无实景图</div>
                      )}
                      <p className="text-xs text-slate-300 truncate text-center">{anchor.note || '无备注'}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar: Anchor Editor */}
      {selectedAnchor && (
        <aside className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col z-20 shadow-xl shrink-0 animate-in slide-in-from-right-8">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-medium text-slate-200 flex items-center gap-2">
              <Move size={16} className="text-indigo-400" />
              编辑锚点
            </h3>
            <button 
              onClick={() => setSelectedAnchorId(null)}
              className="text-slate-500 hover:text-slate-300 p-1"
            >
              <X size={18} />
            </button>
          </div>
          
          <div className="p-4 flex-1 overflow-y-auto custom-scrollbar space-y-6">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">锚点颜色</label>
              <div className="flex flex-wrap gap-2">
                {PREDEFINED_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => updateSelectedAnchor({ color: c })}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${
                      (selectedAnchor.color === c) || (!selectedAnchor.color && c === '#ef4444') 
                        ? 'border-white scale-110 shadow-md' 
                        : 'border-transparent hover:scale-110'
                    }`}
                    style={{ backgroundColor: c }}
                    title="选择颜色"
                  />
                ))}
                <div className="relative w-6 h-6 rounded-full overflow-hidden border-2 border-transparent hover:scale-110 transition-transform cursor-pointer" title="自定义颜色">
                  <input 
                    type="color" 
                    value={selectedAnchor.color || '#ef4444'} 
                    onChange={(e) => updateSelectedAnchor({ color: e.target.value })}
                    className="absolute -inset-2 w-10 h-10 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">备注信息</label>
              <textarea
                value={selectedAnchor.note}
                onChange={(e) => updateSelectedAnchor({ note: e.target.value })}
                onPaste={handleAnchorImagePaste}
                placeholder="输入备注... (支持直接在此处 Ctrl+V 粘贴图片)"
                className="w-full h-24 bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">实景图</label>
              
              <div 
                className="border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-950/50 rounded-lg p-4 text-center transition-colors cursor-pointer relative group overflow-hidden"
                onClick={() => anchorImageInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleAnchorImageDrop}
                onPaste={handleAnchorImagePaste}
                tabIndex={0}
              >
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={anchorImageInputRef} 
                  onChange={handleAnchorImageUpload} 
                />
                
                {selectedAnchor.imageUrl ? (
                  <>
                    <img src={selectedAnchor.imageUrl} alt="实景图" className="w-full h-40 object-cover rounded" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                      <span className="text-white text-sm font-medium flex items-center gap-1"><Upload size={14} /> 更换图片</span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setFullScreenImage(selectedAnchor.imageUrl);
                        }}
                        className="px-3 py-1 bg-indigo-600 text-white text-xs rounded-full hover:bg-indigo-500 flex items-center gap-1"
                      >
                        <Maximize2 size={12} /> 放大查看
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="py-6 flex flex-col items-center text-slate-500">
                    <ImageIcon size={24} className="mb-2 opacity-50" />
                    <p className="text-sm">点击、拖拽或粘贴上传</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-slate-800">
            <button 
              onClick={deleteSelectedAnchor}
              className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 size={16} />
              删除此锚点
            </button>
          </div>
        </aside>
      )}

      {/* Full Screen Image Modal */}
      {fullScreenImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 sm:p-8 animate-in fade-in"
          onClick={() => setFullScreenImage(null)}
        >
          <button 
            className="absolute top-4 right-4 text-white/50 hover:text-white p-2"
            onClick={() => setFullScreenImage(null)}
          >
            <X size={32} />
          </button>
          <img 
            src={fullScreenImage} 
            alt="放大实景图" 
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default FloorPlanModule;
