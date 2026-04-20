
export interface ExtractedData {
  originalScript: string;
  analysis: string;
}

export interface FusionRequest {
  productContext: string; // Combined Script + Analysis from Video A (or Manual Text)
  styleContext: string;   // Combined Script + Analysis from Video B
  methodologyContext?: string; // Combined Script + Analysis from Video C
}

export interface GenerationResult {
  id: string;
  timestamp: number;
  content: string;
}

export type ExtractionType = 'product' | 'style' | 'methodology';

export interface VideoState {
  file: File | null;
  videoUrl: string | null;
  isExtracting: boolean;
  extractedScript: string;
  extractedAnalysis: string;
  error: string | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'error';
  content: string;
  timestamp: number;
}

export interface SavedFramework {
  id: string; // usually filename
  title: string;
  script: string;
  analysis: string;
  importedScript?: string;
  timestamp: number;
  videoFile: File | null; // The actual file object from disk
  hasVideo: boolean;
}
