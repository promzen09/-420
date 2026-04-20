
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PlayCircle, Download, ExternalLink, X, ZoomIn } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  onTimestampClick?: (seconds: number) => void;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, onTimestampClick }) => {
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Pre-process content to unescape literal "\n" sequences
  const formattedContent = React.useMemo(() => {
    if (!content) return "";
    return content.replace(/\\n/g, '\n');
  }, [content]);

  // Helper function to parse "MM:SS" into seconds
  const parseTimeSeconds = (timeStr: string): number | null => {
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      return min * 60 + sec;
    }
    return null;
  };

  // Custom text renderer to find timestamps
  const renderTextWithTimestamps = (text: string) => {
    if (!onTimestampClick) return text;

    // Regex to match time patterns like 0:05, 01:23, 00:00-00:05
    // We capture the time part specifically
    const parts = text.split(/(\d{1,2}:\d{2})/g);
    
    if (parts.length === 1) return text;

    return parts.map((part, index) => {
      const seconds = parseTimeSeconds(part);
      if (seconds !== null) {
        return (
          <span key={index} className="inline-flex items-center gap-1 align-middle whitespace-nowrap group">
            <span className="font-mono text-sky-300 font-medium">{part}</span>
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevent row click events etc
                onTimestampClick(seconds);
              }}
              className="text-slate-500 hover:text-sky-400 hover:scale-110 transition-all cursor-pointer p-0.5 rounded-full hover:bg-slate-700/50"
              title={`跳转到 ${part}`}
            >
              <PlayCircle size={14} className="fill-slate-800" />
            </button>
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="prose prose-invert prose-slate max-w-none w-full">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-6 rounded-lg border border-slate-700">
              <table className="min-w-full divide-y divide-slate-700 bg-slate-800 text-left text-sm" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-slate-900 font-semibold text-slate-200" {...props} />
          ),
          tbody: ({ node, ...props }) => (
            <tbody className="divide-y divide-slate-700 bg-slate-800" {...props} />
          ),
          tr: ({ node, ...props }) => (
            <tr className="hover:bg-slate-700/50 transition-colors" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-400" {...props} />
          ),
          // Intercept table cells to look for timestamps
          td: ({ node, children, ...props }) => {
             // If children is just a string, try to parse it. 
             // If it's structured (like strong/em), we might miss it here, but usually timestamps are plain text.
             let content = children;
             if (typeof children === 'string') {
                 content = renderTextWithTimestamps(children);
             } else if (Array.isArray(children)) {
                 content = children.map((child, i) => {
                     if (typeof child === 'string') return <React.Fragment key={i}>{renderTextWithTimestamps(child)}</React.Fragment>;
                     return child;
                 });
             }

             return (
                <td className="px-4 py-3 text-slate-300 whitespace-pre-wrap" {...props}>
                    {content}
                </td>
             );
          },
          h1: ({ node, ...props }) => (
            <h1 className="text-3xl font-bold text-sky-400 mt-8 mb-4 border-b border-slate-700 pb-2" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-2xl font-bold text-sky-300 mt-8 mb-4" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-xl font-semibold text-sky-200 mt-6 mb-3" {...props} />
          ),
          p: ({ node, children, ...props }) => {
             // Also check paragraphs for timestamps
             let content = children;
             if (typeof children === 'string') {
                 content = renderTextWithTimestamps(children);
             } else if (Array.isArray(children)) {
                 content = children.map((child, i) => {
                     if (typeof child === 'string') return <React.Fragment key={i}>{renderTextWithTimestamps(child)}</React.Fragment>;
                     return child;
                 });
             }
             return <p className="mb-4 leading-relaxed text-slate-300" {...props}>{content}</p>
          },
          ul: ({ node, ...props }) => (
            <ul className="list-disc list-outside ml-6 mb-4 text-slate-300" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal list-outside ml-6 mb-4 text-slate-300" {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-4 border-sky-500 pl-4 py-1 italic text-slate-400 bg-slate-800/50 rounded-r my-4" {...props} />
          ),
          code: ({ node, inline, ...props }: any) => (
             inline 
              ? <code className="bg-slate-700 rounded px-1 py-0.5 text-sky-300 font-mono text-sm" {...props} />
              : <code className="block bg-slate-900 p-4 rounded-lg overflow-x-auto text-slate-300 font-mono text-sm my-4 border border-slate-700" {...props} />
          ),
          img: ({ node, src, alt, ...props }) => {
            if (!src) return null;
            return (
              <div className="relative group inline-block rounded-lg overflow-hidden border border-slate-700 my-4 max-w-full">
                <img 
                  src={src} 
                  alt={alt} 
                  className="max-w-full h-auto block cursor-pointer" 
                  onClick={() => setPreviewImage(src)}
                  {...props} 
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 backdrop-blur-sm pointer-events-none">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setPreviewImage(src); }}
                    className="p-2.5 bg-slate-800/80 hover:bg-slate-700 rounded-full text-white transition-colors shadow-lg pointer-events-auto"
                    title="放大预览"
                  >
                    <ZoomIn size={20} />
                  </button>
                  <button 
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        let downloadUrl = src;
                        // If it's a blob URL, we can download it directly.
                        // If it's a data URI, we should convert it to a blob first to ensure reliable download
                        if (src.startsWith('data:')) {
                           const response = await fetch(src);
                           const blob = await response.blob();
                           downloadUrl = URL.createObjectURL(blob);
                        }
                        const a = document.createElement('a');
                        a.href = downloadUrl;
                        a.download = `generated-image-${Date.now()}.png`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        if (src.startsWith('data:')) {
                           URL.revokeObjectURL(downloadUrl);
                        }
                      } catch (err) {
                        console.error("Download failed", err);
                      }
                    }}
                    className="p-2.5 bg-indigo-600/80 hover:bg-indigo-500 rounded-full text-white transition-colors shadow-lg pointer-events-auto"
                    title="下载图片"
                  >
                    <Download size={20} />
                  </button>
                </div>
              </div>
            );
          },
        }}
      >
        {formattedContent}
      </ReactMarkdown>

      {previewImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <button 
            className="absolute top-6 right-6 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all"
            onClick={() => setPreviewImage(null)}
          >
            <X size={24} />
          </button>
          <img 
            src={previewImage} 
            alt="Preview" 
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default MarkdownRenderer;
