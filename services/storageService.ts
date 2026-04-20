import { SavedFramework } from "../types";

const STORAGE_KEY = 'scriptmaster_framework_library';
const DB_NAME = 'ScriptMasterDB';
const DB_VERSION = 1;
const STORE_NAME = 'videos';

// --- IndexedDB Helpers for Video Storage ---

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

export const saveVideoToDB = async (id: string, file: File): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    // Store the file blob with the framework ID as key
    store.put(file, id);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error("Failed to save video to DB", e);
    // Non-blocking error, user just won't have video next time
  }
};

export const getVideoFromDB = async (id: string): Promise<Blob | null> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as Blob || null);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error("Failed to get video from DB", e);
    return null;
  }
};

export const deleteVideoFromDB = async (id: string): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
    });
  } catch (e) {
    console.error("Failed to delete video from DB", e);
  }
};

// --- LocalStorage Helpers for Metadata ---

export const getFrameworks = (): SavedFramework[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to load frameworks", e);
    return [];
  }
};

export const saveFramework = async (
  framework: Omit<SavedFramework, 'id' | 'timestamp' | 'hasVideo'>, 
  videoFile?: File | null
): Promise<SavedFramework> => {
  const frameworks = getFrameworks();
  
  const id = Date.now().toString();
  const hasVideo = !!videoFile;

  // 1. Save Video Blob to IndexedDB if exists
  if (videoFile) {
    await saveVideoToDB(id, videoFile);
  }

  // 2. Save Metadata to LocalStorage
  const newItem: SavedFramework = {
    ...framework,
    id,
    timestamp: Date.now(),
    hasVideo
  };

  const updated = [newItem, ...frameworks];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return newItem;
};

export const deleteFramework = async (id: string): Promise<SavedFramework[]> => {
  // 1. Delete Video Blob
  await deleteVideoFromDB(id);

  // 2. Delete Metadata
  const frameworks = getFrameworks();
  const updated = frameworks.filter(item => item.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
};

export const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};
