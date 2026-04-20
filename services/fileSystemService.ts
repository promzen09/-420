
import { SavedFramework } from "../types";

// --- Type Definitions for File System Access API ---
declare global {
  interface Window {
    showDirectoryPicker(options?: any): Promise<FileSystemDirectoryHandle>;
  }
  interface FileSystemHandle {
    readonly kind: 'file' | 'directory';
    readonly name: string;
    isSameEntry(other: FileSystemHandle): Promise<boolean>;
    queryPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
    requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  }
  interface FileSystemFileHandle extends FileSystemHandle {
    readonly kind: 'file';
    getFile(): Promise<File>;
    createWritable(options?: any): Promise<FileSystemWritableFileStream>;
  }
  interface FileSystemDirectoryHandle extends FileSystemHandle {
    readonly kind: 'directory';
    values(): AsyncIterableIterator<FileSystemHandle>;
    getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
    getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
    removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  }
  interface FileSystemWritableFileStream extends WritableStream {
    write(data: any): Promise<void>;
    seek(position: number): Promise<void>;
    truncate(size: number): Promise<void>;
    close(): Promise<void>;
  }
}

// Helper to check if browser supports FSA API
export const isFileSystemSupported = () => 'showDirectoryPicker' in window;

// Separators for our text file format
const SEP_SCRIPT = "\n========== 原始文案 ==========\n";
const SEP_ANALYSIS = "\n========== 框架分析 ==========\n";

/**
 * Verifies if the user has granted the requested permission (read or readwrite).
 * If 'prompt' is returned, it attempts to request permission (requires user activation).
 */
export const verifyPermission = async (fileHandle: FileSystemHandle, readWrite: boolean): Promise<boolean> => {
  const options: { mode: 'read' | 'readwrite' } = { mode: readWrite ? 'readwrite' : 'read' };
  
  // Check if permission was already granted
  if ((await fileHandle.queryPermission(options)) === 'granted') {
    return true;
  }
  
  // Request permission
  if ((await fileHandle.requestPermission(options)) === 'granted') {
    return true;
  }
  
  return false;
};

/**
 * Opens a directory picker and returns the handle.
 * @param targetWindow The window context to trigger the picker in (required for user activation checks in popups)
 */
export const openDirectory = async (targetWindow: Window = window): Promise<FileSystemDirectoryHandle> => {
  try {
    // Ensure the API is available on the target window
    if (typeof targetWindow.showDirectoryPicker !== 'function') {
        throw new Error("该窗口环境不支持文件系统访问");
    }

    return await targetWindow.showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents'
    });
  } catch (error) {
    const err = error as Error;
    if (err.name === 'AbortError') {
      throw new Error("用户取消了文件夹选择");
    }
    if (err.name === 'SecurityError') {
        throw new Error("权限被拒绝：请确保在点击按钮后立即调用，或检查浏览器权限设置。");
    }
    throw error;
  }
};

/**
 * Reads a text file and tries to parse our custom format.
 */
const parseTextFile = async (file: File): Promise<{ script: string, analysis: string }> => {
  const text = await file.text();

  // Simple parsing based on separators
  const scriptStart = text.indexOf(SEP_SCRIPT);
  const analysisStart = text.indexOf(SEP_ANALYSIS);

  if (scriptStart !== -1 && analysisStart !== -1) {
    const script = text.substring(scriptStart + SEP_SCRIPT.length, analysisStart).trim();
    const analysis = text.substring(analysisStart + SEP_ANALYSIS.length).trim();
    return { script, analysis };
  }

  // Fallback: If format doesn't match, just return whole text as analysis
  return { script: "", analysis: text };
};

/**
 * Scans the directory for video files and matching text files.
 */
export const loadLibraryFromDirectory = async (dirHandle: FileSystemDirectoryHandle): Promise<SavedFramework[]> => {
  const items: SavedFramework[] = [];
  const entries: { handle: FileSystemFileHandle, name: string }[] = [];

  // 1. Get all file handles
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file') {
      // Cast to FileSystemFileHandle because we checked kind === 'file'
      entries.push({ handle: entry as FileSystemFileHandle, name: entry.name });
    }
  }

  // 2. Filter for media files (videos AND images)
  const mediaExtensions = ['.mp4', '.mov', '.webm', '.mkv', '.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const videoEntries = entries.filter(e => mediaExtensions.some(ext => e.name.toLowerCase().endsWith(ext)));

  // 3. Process each media file
  for (const vidEntry of videoEntries) {
    const vidFile = await vidEntry.handle.getFile();
    
    // Construct expected text filename: "VideoName.mp4.txt"
    const txtName = `${vidEntry.name}.txt`;
    const txtEntry = entries.find(e => e.name === txtName);

    const importedTxtName = `${vidEntry.name}.imported.txt`;
    const importedTxtEntry = entries.find(e => e.name === importedTxtName);

    let script = "";
    let analysis = "";
    let importedScript = "";
    
    // ALWAYS use the video file's timestamp (creation/modification time of the source video)
    const timestamp = vidFile.lastModified;

    if (txtEntry) {
      const txtFile = await txtEntry.handle.getFile();
      const parsed = await parseTextFile(txtFile);
      script = parsed.script;
      analysis = parsed.analysis;
    }

    if (importedTxtEntry) {
      const importedTxtFile = await importedTxtEntry.handle.getFile();
      importedScript = await importedTxtFile.text();
    }

    items.push({
      id: vidEntry.name,
      title: vidEntry.name,
      script,
      analysis,
      importedScript,
      timestamp,
      videoFile: vidFile,
      hasVideo: true
    });
  }
  
  // Sort by newest
  return items.sort((a, b) => b.timestamp - a.timestamp);
};

/**
 * Saves only the analysis text file to the directory (avoids re-writing video).
 */
export const saveAnalysisToDirectory = async (
  dirHandle: FileSystemDirectoryHandle,
  videoFilename: string,
  script: string,
  analysis: string
): Promise<void> => {
   // Create Text Content
  const textContent = `视频文件: ${videoFilename}
保存时间: ${new Date().toLocaleString()}

${SEP_SCRIPT}
${script}

${SEP_ANALYSIS}
${analysis}
`;

  // Write Text File
  const txtName = `${videoFilename}.txt`;
  // Important: This call requires User Activation if permission is not persisted.
  // We rely on verifyPermission() being called during the directory selection phase.
  const txtHandle = await dirHandle.getFileHandle(txtName, { create: true });
  const txtWritable = await txtHandle.createWritable();
  await txtWritable.write(textContent);
  await txtWritable.close();
};

export const saveImportedScriptToDirectory = async (
  dirHandle: FileSystemDirectoryHandle,
  videoFilename: string,
  importedScript: string
): Promise<void> => {
  const txtName = `${videoFilename}.imported.txt`;
  try {
    const txtHandle = await dirHandle.getFileHandle(txtName, { create: true });
    const txtWritable = await txtHandle.createWritable();
    await txtWritable.write(importedScript);
    await txtWritable.close();
  } catch (error: any) {
    // Handle InvalidStateError which happens when file is modified by sync engines (OneDrive, iCloud)
    if (error.name === 'InvalidStateError' || error.message?.includes('state cached')) {
      console.warn(`Encountered InvalidStateError for ${txtName}, attempting to recreate file...`);
      try {
        await dirHandle.removeEntry(txtName);
      } catch (e) {
        // Ignore if remove fails
      }
      const txtHandle = await dirHandle.getFileHandle(txtName, { create: true });
      const txtWritable = await txtHandle.createWritable();
      await txtWritable.write(importedScript);
      await txtWritable.close();
    } else {
      throw error;
    }
  }
};

/**
 * Saves video and text to the directory.
 */
export const saveToDirectory = async (
  dirHandle: FileSystemDirectoryHandle,
  videoFile: File,
  script: string,
  analysis: string
): Promise<void> => {
  // 1. Write Video File (if it doesn't exist or we overwrite)
  // We actually just write the file data provided.
  const videoHandle = await dirHandle.getFileHandle(videoFile.name, { create: true });
  const videoWritable = await videoHandle.createWritable();
  await videoWritable.write(videoFile);
  await videoWritable.close();

  // 2. Save Analysis
  await saveAnalysisToDirectory(dirHandle, videoFile.name, script, analysis);
};

/**
 * Deletes video and associated text file.
 */
export const deleteFromDirectory = async (dirHandle: FileSystemDirectoryHandle, filename: string): Promise<void> => {
  try {
    // Delete video
    await dirHandle.removeEntry(filename);
    
    // Try delete text
    const txtName = `${filename}.txt`;
    await dirHandle.removeEntry(txtName).catch(() => {}); // Ignore if text doesn't exist

    const importedTxtName = `${filename}.imported.txt`;
    await dirHandle.removeEntry(importedTxtName).catch(() => {});
  } catch (e) {
    console.error("Delete failed", e);
    throw e;
  }
};
