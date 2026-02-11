import React, { useState } from 'react';
import { Layers, Plus, Trash2 } from 'lucide-react';

interface TargetLayoutItem {
  name: string;
  members: string[];
}

interface AggregateModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  targetLayout: TargetLayoutItem[];
  setTargetLayout: (layout: TargetLayoutItem[]) => void;
}

const AggregateModal: React.FC<AggregateModalProps> = ({ isOpen = false, onClose, targetLayout, setTargetLayout }) => {
  const [localLayout, setLocalLayout] = useState<TargetLayoutItem[]>(
    targetLayout.length > 0 ? targetLayout : [{ name: '', members: '' }]
  );

  if (!isOpen) return null;

  const handleAddRow = () => {
    setLocalLayout([...localLayout, { name: '', members: '' }]);
  };

  const handleRemoveRow = (index: number) => {
    const newLayout = [...localLayout];
    newLayout.splice(index, 1);
    setLocalLayout(newLayout);
  };

  const handleChange = (index: number, field: keyof TargetLayoutItem, value: string) => {
    const newLayout = [...localLayout];
    newLayout[index][field] = field === 'members' ? value.split(',').map(s => s.trim()) : value;
    setLocalLayout(newLayout);
  };

  const handleSave = () => {
    const validLayout = localLayout.filter(item => item.name.trim() !== '');
    setTargetLayout(validLayout);
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-center justify-center min-h-screen px-4 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity" aria-hidden="true" onClick={onClose}></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom glass-panel rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full border border-glass-border bg-[#1e293b] animate-fade-in">
          <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                <h3 className="text-lg leading-6 font-bold text-white flex items-center gap-2" id="modal-title">
                  <Layers className="text-indigo-400 w-5 h-5" /> Configure Target Aggregates
                </h3>
                <div className="mt-2">
                  <p className="text-xs text-slate-400">
                    Define aggregate interfaces (e.g., ae1, port-channel1) and their physical members for the target firewall.
                  </p>
                </div>

                <div className="mt-4 space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                  {localLayout.map((row, index) => (
                    <div key={index} className="flex gap-2 items-center animate-fade-in">
                      <input
                        type="text"
                        placeholder="Name (e.g. ae1)"
                        className="glass-input w-1/3 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500"
                        value={row.name}
                        onChange={(e) => handleChange(index, 'name', e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="Members (e.g. eth1/1, eth1/2)"
                        className="glass-input w-2/3 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500"
                        value={Array.isArray(row.members) ? row.members.join(', ') : row.members}
                        onChange={(e) => handleChange(index, 'members', e.target.value)}
                      />
                      <button
                        type="button"
                        className="text-slate-500 hover:text-rose-500 transition-colors px-2"
                        onClick={() => handleRemoveRow(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="mt-4 inline-flex items-center px-3 py-2 border border-dashed border-slate-600 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:border-indigo-500 hover:bg-indigo-500/10 transition-all w-full justify-center"
                  onClick={handleAddRow}
                >
                  <Plus className="w-4 h-4 mr-2" /> Add New Aggregate
                </button>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-white/5">
            <button
              type="button"
              className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm transition-colors"
              onClick={handleSave}
            >
              Save & Close
            </button>
            <button
              type="button"
              className="mt-3 w-full inline-flex justify-center rounded-xl border border-slate-600 shadow-sm px-4 py-2 bg-transparent text-base font-medium text-slate-300 hover:bg-slate-800 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AggregateModal;
