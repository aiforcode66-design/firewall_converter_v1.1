import React, { useEffect, useRef, useState } from 'react';
import { Copy, Check, AlertTriangle } from 'lucide-react';

// Types
interface LogItemData {
  message: string;
  severity?: string;
  original_line?: string;
  details?: string[];
  count?: number;
  key?: string;
}

interface LogViewerProps {
  logs?: LogItemData[] | string;
  type?: 'warnings' | 'logs';
}

// Helper Component for Individual Log Item
interface LogItemProps {
  item: LogItemData;
  index: number;
}

const LogItem: React.FC<LogItemProps> = ({ item, index }) => {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = item.details && item.details.length > 0;

  return (
    <div className="border-b border-emerald-50 last:border-0 px-2 -mx-2 hover:bg-emerald-50/50 rounded-lg transition-colors group">
      <div
        className={`flex items-start gap-3 py-2 ${hasDetails ? 'cursor-pointer' : ''}`}
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        <span className="text-emerald-900/30 font-mono text-[10px] pt-0.5 select-none w-8 text-right flex-shrink-0 group-hover:text-emerald-900/50 transition-colors">
          {String(index + 1).padStart(3, '0')}
        </span>

        <div className="flex-1 overflow-hidden">
          <div className="flex items-center gap-2 flex-wrap">
            {item.severity && (
              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase flex-shrink-0 border shadow-sm ${item.severity === 'HIGH' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                  item.severity === 'MEDIUM' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                    'bg-blue-50 text-blue-700 border-blue-100'
                }`}>
                {item.severity}
              </span>
            )}

            <code className="text-xs font-mono text-emerald-950 whitespace-pre-wrap leading-relaxed truncate max-w-full">
              {item.message}
            </code>

            {item.count && item.count > 1 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] bg-emerald-100 text-emerald-700 font-bold border border-emerald-200 whitespace-nowrap">
                x{item.count}
              </span>
            )}

            {hasDetails && (
              <span className="text-[10px] text-brand-teal ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                {expanded ? 'Hide details' : 'Show details'}
              </span>
            )}
          </div>

          {/* Expanded Details */}
          {expanded && hasDetails && (
            <div className="mt-2 pl-3 border-l-2 border-emerald-200 ml-1 py-1 animate-fade-in">
              <div className="text-[10px] font-bold text-emerald-500 mb-1 uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Original Source Context:
              </div>
              <div className="bg-white border border-emerald-100 rounded-lg p-3 overflow-x-auto text-[11px] font-mono text-emerald-800 max-h-40 overflow-y-auto custom-scrollbar shadow-inner">
                {item.details!.slice(0, 50).map((line, idx) => (
                  <div key={idx} className="border-b border-emerald-50/50 last:border-0 py-0.5 whitespace-pre hover:bg-emerald-50/30">
                    {line || <span className="text-emerald-200 italic">Empty line</span>}
                  </div>
                ))}
                {item.details!.length > 50 && (
                  <div className="text-emerald-400 italic pt-2 text-[10px] text-center border-t border-emerald-50 mt-1">
                    ... and {item.details!.length - 50} more lines
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const LogViewer: React.FC<LogViewerProps> = ({ logs, type = 'warnings' }) => {
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-indent helper for Fortinet CLI format
  const autoIndent = (text: string): string => {
    const lines = text.split('\n');
    // Heuristic: Check if likely Fortinet (contains config/edit blocks)
    const isFortinet = lines.some(l => l.trim().startsWith('config ') || l.trim().startsWith('edit '));
    if (!isFortinet) return text;

    let indent = 0;
    return lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';

      // Decrease indent before printing for closing tags
      if ((trimmed.startsWith('next') || trimmed.startsWith('end')) && indent > 0) {
        indent--;
      }

      const pad = '    '.repeat(indent);
      const res = pad + trimmed;

      // Increase indent after printing for opening tags
      if (trimmed.startsWith('config ') || trimmed.startsWith('edit ')) {
        indent++;
      }

      return res;
    }).join('\n');
  };

  // Normalize content to string for copy
  const contentString: string = Array.isArray(logs)
    ? logs.map(l => {
      if (typeof l === 'object') {
        // Prioritize original command/line
        let text = l.original_line || `[${l.severity}] ${l.message}`;

        // If details (sub-commands) exist, append them to reconstruct the full block
        if (l.details && Array.isArray(l.details) && l.details.length > 0) {
          text += '\n' + l.details.join('\n');
          // Re-add 'end' for config blocks if it's missing (heuristically, mostly for Fortinet)
          if ((text.startsWith('config ') || text.startsWith('edit ')) && !text.trim().endsWith('end')) {
            text += '\nend';
          }
        }
        // Apply auto-indentation if applicable
        return autoIndent(text);
      }
      return String(l);
    }).join('\n')
    : (logs || '');

  const logList: LogItemData[] = Array.isArray(logs)
    ? logs as LogItemData[]
    : (logs ? (logs as string).split('\n').map((line, i) => ({ message: line, key: String(i) })) : []);

  const handleCopy = () => {
    navigator.clipboard.writeText(contentString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Auto-scroll to top when content changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [logs]);

  return (
    <div className="absolute inset-0 flex flex-col bg-transparent">
      <div className="flex justify-between items-center px-6 py-4 sticky top-0 bg-white/60 backdrop-blur-md border-b border-emerald-100 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-lg ${type === 'warnings' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
            {type === 'warnings' ? 'Conversion Warnings' : 'System Logs'}
          </span>
          <span className="ml-2 px-2.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-mono font-bold">
            {logList.length}
          </span>
        </div>
        <button
          onClick={handleCopy}
          disabled={logList.length === 0}
          className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1.5 bg-white hover:bg-emerald-50 border border-emerald-200 hover:border-emerald-300 rounded-lg px-3 py-1.5 transition-all shadow-sm disabled:opacity-50"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Copy Log'}
        </button>
      </div>

      <div ref={scrollRef} className="flex-grow overflow-auto p-6 custom-scrollbar bg-white/40">
        {logList.length > 0 ? (
          <div className="space-y-1 bg-white/80 rounded-2xl p-4 shadow-sm border border-emerald-100/50">
            {(() => {
              // Group identical consecutive logs AND accumulate original lines
              const groupedLogs: LogItemData[] = [];
              let lastLog: LogItemData | null = null;
              let currentDetails: string[] = [];
              let count = 0;

              logList.forEach((log) => {
                const isObj = typeof log === 'object';
                const message = isObj ? log.message : log;
                const severity = isObj ? log.severity : undefined;
                const originalLine = isObj ? log.original_line : undefined;
                const key = `${message}-${severity}`;

                if (lastLog && lastLog.key === key) {
                  count++;
                  if (originalLine) currentDetails.push(originalLine);
                } else {
                  if (lastLog) {
                    groupedLogs.push({ ...lastLog, count, details: currentDetails });
                  }
                  lastLog = { message, severity, key };
                  currentDetails = originalLine ? [originalLine] : [];
                  count = 1;
                }
              });

              if (lastLog) {
                groupedLogs.push({ ...lastLog, count, details: currentDetails });
              }

              return groupedLogs.map((item, i) => (
                <LogItem key={i} item={item} index={i} />
              ));
            })()}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-emerald-900/30">
            <Check className="w-16 h-16 text-emerald-100/50 mb-4" />
            <p className="text-sm font-medium text-emerald-800/60">No warnings or errors found.</p>
            <p className="text-xs">Conversion completed cleanly.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LogViewer;
