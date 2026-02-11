import React, { useState } from 'react';
import { Copy, AlertTriangle, Info, XCircle } from 'lucide-react';

interface RiskItem {
  severity: string;
  category: string;
  item_name: string;
  description: string;
  recommendation: string;
}

interface DuplicateItem {
  type: string;
  original_name: string;
  value: string;
  duplicate_names: string[];
  recommendation: string;
}

interface OverlapItem {
  rule_id: number | string;
  rule_name: string;
  reason: string;
  shadowed_by_id: number | string;
  shadowed_by: string;
  recommendation: string;
}

interface FindingsData {
  duplicates?: DuplicateItem[];
  overlaps?: OverlapItem[];
  risks?: RiskItem[];
  unused?: string[];
}

interface FindingsDetailProps {
  findings?: FindingsData;
}

interface EmptyStateProps {
  message: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ message }) => (
  <div className="text-center py-12">
    <Info className="w-12 h-12 text-slate-600 mx-auto mb-3" />
    <div className="text-sm text-slate-400">{message}</div>
  </div>
);

const FindingsDetail: React.FC<FindingsDetailProps> = ({ findings }) => {
  const [activeTab, setActiveTab] = useState('risks');

  if (!findings) return null;

  const { duplicates = [], overlaps = [], risks = [], unused = [] } = findings;

  const tabs = [
    { id: 'risks', label: 'Security Risks', count: risks.length, badge: 'rose' },
    { id: 'duplicates', label: 'Duplicate Objects', count: duplicates.length, badge: 'sky' },
    { id: 'overlaps', label: 'Overlapping Rules', count: overlaps.length, badge: 'purple' },
    { id: 'unused', label: 'Unused Objects', count: unused.length, badge: 'slate' },
  ];

  return (
    <div className="bg-slate-800/30 border border-slate-700 rounded-xl overflow-hidden">
      {/* Tab Headers */}
      <div className="flex border-b border-slate-700 bg-slate-800/50">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex-1 px-4 py-3 text-xs font-medium transition-all relative
              ${activeTab === tab.id
                ? 'text-white bg-slate-800/80'
                : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/30'
              }
            `}
          >
            <div className="flex items-center justify-center gap-2">
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className={`
                  px-1.5 py-0.5 rounded text-[10px] font-bold
                  ${activeTab === tab.id
                    ? `bg-${tab.badge}-500/20 text-${tab.badge}-400`
                    : `bg-slate-700 text-slate-400`
                  }
                `}>
                  {tab.count}
                </span>
              )}
            </div>
            {activeTab === tab.id && (
              <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-${tab.badge}-500`} />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'risks' && <RisksTable data={risks} />}
        {activeTab === 'duplicates' && <DuplicatesTable data={duplicates} />}
        {activeTab === 'overlaps' && <OverlapsTable data={overlaps} />}
        {activeTab === 'unused' && <UnusedTable data={unused} />}
      </div>
    </div>
  );
};

const RisksTable: React.FC<{ data: RiskItem[] }> = ({ data }) => {
  if (data.length === 0) {
    return <EmptyState message="No security risks detected! ðŸŽ‰" />;
  }

  const getSeverityBadge = (severity: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
      high: ' bg-amber-500/20 text-amber-400 border-amber-500/30',
      medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      low: 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    };
    return colors[severity] || colors.low;
  };

  return (
    <div className="space-y-3">
      {data.map((risk, idx) => (
        <div key={idx} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold border ${getSeverityBadge(risk.severity)}`}>
                {risk.severity}
              </span>
              <span className="text-xs text-slate-400">{risk.category}</span>
            </div>
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          </div>
          <div className="text-sm font-semibold text-white mb-1">{risk.item_name}</div>
          <div className="text-xs text-slate-400 mb-2">{risk.description}</div>
          <div className="bg-slate-900/50 border-l-2 border-sky-500 pl-3 py-2 mt-3">
            <div className="text-xs text-sky-400 font-medium mb-1">ðŸ’¡ Recommendation:</div>
            <div className="text-xs text-slate-300">{risk.recommendation}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

const DuplicatesTable: React.FC<{ data: DuplicateItem[] }> = ({ data }) => {
  if (data.length === 0) {
    return <EmptyState message="No duplicate objects found!" />;
  }

  return (
    <div className="space-y-3">
      {data.map((dup, idx) => (
        <div key={idx} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <span className="text-xs text-slate-400 uppercase">{dup.type}</span>
              <div className="text-sm font-semibold text-white mt-1">{dup.original_name}</div>
              <div className="text-xs text-slate-500 font-mono mt-1">{dup.value}</div>
            </div>
            <Copy className="w-4 h-4 text-sky-400 flex-shrink-0" />
          </div>
          <div className="mt-3 pt-3 border-t border-slate-700/50">
            <div className="text-xs text-slate-400 mb-2">
              Duplicates ({dup.duplicate_names.length}):
            </div>
            <div className="flex flex-wrap gap-1">
              {dup.duplicate_names.map((name, i) => (
                <span key={i} className="px-2 py-1 bg-slate-700/50 text-slate-300 text-xs rounded">
                  {name}
                </span>
              ))}
            </div>
          </div>
          <div className="bg-slate-900/50 border-l-2 border-sky-500 pl-3 py-2 mt-3">
            <div className="text-xs text-sky-400 font-medium mb-1">ðŸ’¡ Recommendation:</div>
            <div className="text-xs text-slate-300">{dup.recommendation}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

const OverlapsTable: React.FC<{ data: OverlapItem[] }> = ({ data }) => {
  if (data.length === 0) {
    return <EmptyState message="No overlapping rules detected!" />;
  }

  return (
    <div className="space-y-3">
      {data.map((overlap, idx) => (
        <div key={idx} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-sm font-semibold text-white">Rule #{overlap.rule_id}: {overlap.rule_name}</div>
              <div className="text-xs text-slate-400 mt-1">{overlap.reason}</div>
            </div>
            <XCircle className="w-4 h-4 text-purple-400 flex-shrink-0" />
          </div>
          <div className="bg-slate-900/50 rounded p-3 space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Shadowed by:</span>
              <span className="text-white font-medium">Rule #{overlap.shadowed_by_id}: {overlap.shadowed_by}</span>
            </div>
          </div>
          <div className="bg-slate-900/50 border-l-2 border-purple-500 pl-3 py-2 mt-3">
            <div className="text-xs text-purple-400 font-medium mb-1">ðŸ’¡ Recommendation:</div>
            <div className="text-xs text-slate-300">{overlap.recommendation}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

const UnusedTable: React.FC<{ data: string[] }> = ({ data }) => {
  if (data.length === 0) {
    return <EmptyState message="All objects are in use!" />;
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-slate-400 mb-3">
        Objects that are not referenced by any rules can be safely removed.
      </div>
      <div className="grid grid-cols-3 gap-2">
        {data.map((name, idx) => (
          <div key={idx} className="bg-slate-800/50 border border-slate-700 rounded px-3 py-2">
            <div className="text-xs text-slate-300 truncate" title={name}>{name}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FindingsDetail;
