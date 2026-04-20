import React, { useState, useRef } from 'react';
import { FolderOpen, FileSpreadsheet, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { openDirectory, saveImportedScriptToDirectory } from '../services/fileSystemService';

interface MatchResult {
  filename: string;
  script: string;
  status: 'success' | 'failed' | 'pending';
  error?: string;
}

const BatchImportModule: React.FC = () => {
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [folderName, setFolderName] = useState<string>('');
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successCount, setSuccessCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);

  const handleSelectFolder = async () => {
    try {
      const handle = await openDirectory(window);
      setDirHandle(handle);
      setFolderName(handle.name);
      setResults([]);
      setSuccessCount(0);
      setErrorMsg('');
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
                    // Request readwrite permission if not already granted
                    const permission = await handle.requestPermission({ mode: 'readwrite' });
                    if (permission === 'granted') {
                        setDirHandle(handle);
                        setFolderName(handle.name);
                        setResults([]);
                        setSuccessCount(0);
                        setErrorMsg('');
                    } else {
                        setErrorMsg('需要读写权限才能处理文件夹中的文件。');
                    }
                    return;
                }
            } catch (err: any) {
                setErrorMsg(`拖拽读取文件夹失败: ${err.message}`);
            }
        }
    }
  };

  const handleExcelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setExcelFile(file);
      setResults([]);
      setSuccessCount(0);
      setErrorMsg('');
    }
  };

  const processImport = async () => {
    if (!dirHandle || !excelFile) {
      setErrorMsg('请先选择视频文件夹和Excel文件');
      return;
    }

    setIsProcessing(true);
    setErrorMsg('');
    setResults([]);
    setSuccessCount(0);

    try {
      // 1. Read Excel File
      let data: ArrayBuffer;
      try {
        data = await excelFile.arrayBuffer();
      } catch (e: any) {
        throw new Error(`读取Excel文件失败 (可能是文件被占用或在同步文件夹中): ${e.message}`);
      }

      let workbook;
      try {
        workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
      } catch (e: any) {
        throw new Error(`解析Excel文件失败: ${e.message}`);
      }

      // Combine all sheets
      let json: any[][] = [];
      for (const sheetName of workbook.SheetNames) {
        const ws = workbook.Sheets[sheetName];
        const sheetJson = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        if (sheetJson.length > 0) {
          json = json.concat(sheetJson);
        }
      }

      if (json.length === 0) {
        throw new Error('Excel文件为空');
      }

      // 2. Find Columns
      let filenameColIdx = -1;
      let scriptColIdx = -1;

      for (let i = 0; i < Math.min(json.length, 50); i++) {
        const row = json[i];
        if (!Array.isArray(row)) continue;

        let tempFilenameIdx = -1;
        let tempScriptIdx = -1;

        for (let j = 0; j < row.length; j++) {
          const cellValue = String(row[j] || '').trim();
          if (!cellValue) continue;

          if (cellValue.includes('文件名') || cellValue.includes('视频名') || cellValue.includes('素材名')) {
            tempFilenameIdx = j;
          }
          if (cellValue.includes('文案') || cellValue.includes('脚本') || cellValue.includes('内容') || cellValue.includes('文本')) {
            tempScriptIdx = j;
          }
        }

        if (tempFilenameIdx !== -1 && tempScriptIdx !== -1 && tempFilenameIdx !== tempScriptIdx) {
          filenameColIdx = tempFilenameIdx;
          scriptColIdx = tempScriptIdx;
          break;
        }
      }

      if (filenameColIdx === -1 || scriptColIdx === -1) {
        filenameColIdx = 1; // Default to column B
        scriptColIdx = 2;   // Default to column C
        console.warn('未找到明确的表头，默认使用第2列作为文件名，第3列作为文案。');
      }

      // 3. Extract Data
      const excelData: { filename: string; script: string }[] = [];
      for (let i = 1; i < json.length; i++) {
        const row = json[i];
        if (!Array.isArray(row)) continue;

        const rawFilename = String(row[filenameColIdx] || '').trim();
        const script = String(row[scriptColIdx] || '').trim();

        if (rawFilename && script && !rawFilename.includes('文件名') && !script.includes('文案')) {
          excelData.push({ filename: rawFilename, script });
        }
      }

      if (excelData.length === 0) {
        throw new Error('未在Excel中找到有效的数据行。请确保包含文件名和文案列。');
      }

      // 4. Read Directory Files
      const localFiles: string[] = [];
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
          localFiles.push(entry.name);
        }
      }

      // 5. Match and Save
      const newResults: MatchResult[] = [];
      let success = 0;

      for (const item of excelData) {
        const cleanExcelName = item.filename.replace(/\.[^/.]+$/, "").toLowerCase();
        
        const matchedLocalFile = localFiles.find(localName => {
          const cleanLocalName = localName.replace(/\.[^/.]+$/, "").toLowerCase();
          return cleanLocalName === cleanExcelName || 
                 cleanLocalName.includes(cleanExcelName) || 
                 cleanExcelName.includes(cleanLocalName);
        });

        if (matchedLocalFile) {
          try {
            await saveImportedScriptToDirectory(dirHandle, matchedLocalFile, item.script);
            newResults.push({ filename: matchedLocalFile, script: item.script, status: 'success' });
            success++;
          } catch (err: any) {
            newResults.push({ filename: matchedLocalFile, script: item.script, status: 'failed', error: err.message });
          }
        } else {
          newResults.push({ filename: item.filename, script: item.script, status: 'failed', error: '未在文件夹中找到匹配的视频文件' });
        }
      }

      setResults(newResults);
      setSuccessCount(success);

    } catch (error: any) {
      setErrorMsg(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full space-y-8">
        
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">独立批量导入模块 (模块 D)</h2>
          <p className="text-slate-400">此模块专门用于将 Excel 中的文案批量匹配并导入到本地视频文件夹中，生成对应的 .imported.txt 文件。与主界面的解析逻辑完全独立，避免冲突。</p>
        </div>

        {/* Step 1: Select Folder */}
        <div 
          className={`bg-slate-900 border ${isDragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-800'} rounded-xl p-6 shadow-lg transition-all`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleFolderDrop}
        >
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">1</span>
            选择本地视频文件夹
          </h3>
          <div className="flex items-center gap-4">
            <button
              onClick={handleSelectFolder}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors font-medium"
            >
              <FolderOpen size={18} />
              {folderName ? '重新选择文件夹' : '选择文件夹'}
            </button>
            {folderName && (
              <span className="text-emerald-400 flex items-center gap-2 bg-emerald-400/10 px-3 py-1.5 rounded-lg border border-emerald-400/20">
                <CheckCircle size={16} /> 已选择: {folderName}
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm mt-3">
            提示：如果点击按钮无响应，可以直接将本地文件夹拖拽到此区域。
          </p>
        </div>

        {/* Step 2: Select Excel */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">2</span>
            选择文案 Excel 表格
          </h3>
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              className="hidden"
              ref={fileInputRef}
              onChange={handleExcelChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors font-medium"
            >
              <FileSpreadsheet size={18} />
              {excelFile ? '重新选择表格' : '选择表格'}
            </button>
            {excelFile && (
              <span className="text-emerald-400 flex items-center gap-2 bg-emerald-400/10 px-3 py-1.5 rounded-lg border border-emerald-400/20">
                <CheckCircle size={16} /> 已选择: {excelFile.name}
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm mt-3">
            提示：表格中需要包含“文件名”和“文案”两列。如果没有表头，系统默认读取第2列(B列)为文件名，第3列(C列)为文案。
          </p>
        </div>

        {/* Step 3: Execute */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm">3</span>
            开始批量匹配导入
          </h3>
          
          {errorMsg && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3 text-red-400">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <div className="text-sm">{errorMsg}</div>
            </div>
          )}

          <button
            onClick={processImport}
            disabled={!dirHandle || !excelFile || isProcessing}
            className={`flex items-center justify-center gap-2 w-full py-3 rounded-lg font-bold text-lg transition-all ${
              !dirHandle || !excelFile
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : isProcessing
                ? 'bg-indigo-600/70 text-white cursor-wait'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25'
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 size={24} className="animate-spin" />
                正在处理中...
              </>
            ) : (
              '一键匹配并导入'
            )}
          </button>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center justify-between">
              <span>处理结果</span>
              <span className="text-sm font-normal text-slate-400">
                成功: <span className="text-emerald-400 font-bold">{successCount}</span> / 总计: {results.length}
              </span>
            </h3>
            
            <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
              {results.map((res, idx) => (
                <div 
                  key={idx} 
                  className={`p-3 rounded-lg border flex flex-col gap-1 ${
                    res.status === 'success' 
                      ? 'bg-emerald-500/5 border-emerald-500/20' 
                      : 'bg-red-500/5 border-red-500/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-200 truncate pr-4" title={res.filename}>
                      {res.filename}
                    </span>
                    {res.status === 'success' ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-400 shrink-0">
                        <CheckCircle size={14} /> 成功
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-red-400 shrink-0">
                        <XCircle size={14} /> 失败
                      </span>
                    )}
                  </div>
                  {res.status === 'failed' && res.error && (
                    <div className="text-xs text-red-400 mt-1">{res.error}</div>
                  )}
                  <div className="text-xs text-slate-500 truncate" title={res.script}>
                    文案: {res.script}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default BatchImportModule;
