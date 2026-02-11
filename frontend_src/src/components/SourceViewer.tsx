import React from 'react';
import { FileCode, Lock } from 'lucide-react';

interface SourceViewerProps {
  fileName: string;
  content: string;
  className?: string;
}

const SourceViewer: React.FC<SourceViewerProps> = ({ fileName, content, className = "" }) => {
  if (!content) {
    return (
      <div className={`h-full flex flex-col items-center justify-center bg-white/60 border border-brand-100 rounded-xl p-8 text-center backdrop-blur-md shadow-card ${className}`}>
        <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mb-4 border border-brand-200">
          <FileCode className="w-8 h-8 text-brand-400" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">Source Configuration</h3>
        <p className="text-sm text-gray-500 max-w-xs">
          Upload a configuration file to view its content and start the analysis process.
        </p>
      </div>
    );
  }

  // Split content into lines for line numbers
  const lines = content.split('\n');

  return (
    <div className={`flex flex-col h-full bg-white/60 border border-brand-100 rounded-xl shadow-card overflow-hidden backdrop-blur-md ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-brand-100 bg-white/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          <span className="text-brand-400 font-mono text-sm">&lt;&gt;</span>
          <span className="text-sm font-semibold text-gray-600">Source: <span className="text-gray-900 font-bold">{fileName}</span></span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-brand-50 border border-brand-200 rounded text-[10px] font-medium text-brand-700 uppercase tracking-wide">
          <Lock className="w-3 h-3" /> Read Only
        </div>
      </div>

      {/* Code Content */}
      <div className="flex-1 overflow-auto custom-scrollbar bg-white/40 font-mono text-xs leading-5">
        <div className="flex min-w-max">
          {/* Line Numbers */}
          <div className="flex flex-col items-end px-3 py-4 bg-brand-50/30 border-r border-brand-100 text-gray-400 select-none min-w-[3rem]">
            {lines.map((_, i) => (
              <div key={i} className="h-5 text-right">{i + 1}</div>
            ))}
          </div>

          {/* Code Lines */}
          <div className="flex flex-col px-4 py-4 text-gray-800">
            {lines.map((line, i) => (
              <div key={i} className="h-5 whitespace-pre">{line || ' '}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SourceViewer;
