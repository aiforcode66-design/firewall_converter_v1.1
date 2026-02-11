import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check, ChevronRight, Terminal } from 'lucide-react';

interface Section {
  line: number;
  label: string;
}

interface Sections {
  [key: string]: Section;
}

interface CLIViewerProps {
  commands?: string;
  content?: string;
  onCopy?: (content: string) => void;
  mode?: 'light' | 'dark';
}

const CLIViewer: React.FC<CLIViewerProps> = ({ commands, content: legacyContent, onCopy, mode = 'light' }) => {
  // Adapt props: content or commands
  const content = commands || legacyContent || '';
  const isDark = mode === 'dark';

  const [copied, setCopied] = useState(false);
  const [sections, setSections] = useState<Sections>({ header: { line: 0, label: '' } });
  const contentRef = useRef<HTMLDivElement>(null);

  // Parse sections from content
  useEffect(() => {
    if (!content) return;

    const lines = content.split('\n');
    const newSections: Sections = { header: { line: 0, label: '' } }; // Default section

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      if (trimmed.startsWith('! ---') || trimmed.startsWith('# ---')) {
        const id = `section-${index}`;
        const label = trimmed.replace(/!|#|---/g, '').trim();
        newSections[id] = { line: index, label };
        return;
      }

      if (trimmed.match(/^\[DYNAMIC|^\[SKIPPED|^IMPORTANT|^Note:|^Warning:/i)) return;

      if (trimmed.match(/^[!#].*(Interface|Object|Rule|Route|Policy|NAT|Zone|Service|Address|Group|ACL).*/i)) {
        if (trimmed.includes('[') && trimmed.includes(']')) return;
        const id = `section-${index}`;
        const label = trimmed.replace(/!|#|-/g, '').trim() || `Section ${index}`;
        newSections[id] = { line: index, label };
      }
    });

    if (Object.keys(newSections).length === 1) {
      lines.forEach((line, index) => {
        if (line.startsWith('!') && line.length > 5 && !line.includes('no shutdown')) {
          if (line.match(/\[DYNAMIC|\[SKIPPED|IMPORTANT|Note:|Warning:/i)) return;
          const id = `section-${index}`;
          const label = line.replace(/!/g, '').trim();
          if (label) newSections[id] = { line: index, label };
        }
      });
    }

    setSections(newSections);
  }, [content]);

  const handleCopy = () => {
    if (onCopy) onCopy(content);
    else navigator.clipboard.writeText(content);

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const scrollToLine = (lineIndex: number) => {
    const element = document.getElementById(`cli-line-${lineIndex}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const lines = content.split('\n');

  return (
    <div className={`flex h-full font-mono text-xs overflow-hidden ${isDark
        ? 'bg-transparent'
        : 'bg-white/50 backdrop-blur-sm border border-emerald-100 rounded-2xl shadow-inner'
        }`}>
      {/* Sidebar Navigation */}
      <div className={`w-48 flex-none flex flex-col ${isDark
          ? 'bg-slate-900/50 border-r border-slate-800'
          : 'w-64 border-r border-emerald-100 bg-emerald-50/30'
          }`}>
        {!isDark && (
          <div className="p-4 border-b border-emerald-100 flex items-center gap-2 text-emerald-800 font-sans font-bold text-xs uppercase tracking-wider">
            <Terminal className="w-3.5 h-3.5 text-brand-teal" /> Navigation
          </div>
        )}
        <div className="flex-grow overflow-y-auto custom-scrollbar p-2 space-y-0.5">
          {Object.entries(sections).map(([id, sec]) => (
            id !== 'header' && (
              <button
                key={id}
                onClick={() => scrollToLine(sec.line)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-all truncate flex items-center gap-2 group ${isDark
                    ? 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'
                    : 'text-emerald-900/70 hover:text-brand-emerald hover:bg-white hover:shadow-sm border border-transparent hover:border-emerald-100'
                    }`}
              >
                <ChevronRight className={`w-3 h-3 transition-opacity ${isDark
                    ? 'text-slate-600 group-hover:text-slate-400'
                    : 'text-emerald-300 group-hover:text-brand-teal opacity-0 group-hover:opacity-100'
                    }`} />
                {sec.label}
              </button>
            )
          ))}
          {Object.keys(sections).length <= 1 && (
            <div className={`px-3 py-4 italic text-center ${isDark ? 'text-slate-700' : 'text-emerald-900/30'
              }`}>No sections detected</div>
          )}
        </div>
      </div>

      {/* Code Viewer */}
      <div className="flex-grow flex flex-col min-w-0">
        {!isDark && (
          <div className="flex justify-between items-center px-4 py-2 bg-emerald-50/50 border-b border-emerald-100">
            <span className="text-emerald-900/50 font-sans font-semibold text-sm">Generated Config</span>
            <button
              onClick={handleCopy}
              className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1.5 bg-white hover:bg-emerald-50 border border-emerald-200 hover:border-emerald-300 rounded-lg px-3 py-1.5 transition-all shadow-sm"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}

        <div ref={contentRef} className={`flex-grow overflow-auto p-4 custom-scrollbar scroll-smooth ${isDark ? 'bg-transparent' : 'bg-white/80 p-6'
          }`}>
          <div className="min-w-max">
            {lines.map((line, i) => (
              <div
                key={i}
                id={`cli-line-${i}`}
                className={`whitespace-pre text-sm leading-relaxed font-mono font-normal w-full ${isDark
                    ? 'text-emerald-400 opacity-90 hover:bg-slate-800/50'
                    : 'text-emerald-950 opacity-90 hover:bg-emerald-50/50'
                    }`}
              >
                {line || ' '}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CLIViewer;
