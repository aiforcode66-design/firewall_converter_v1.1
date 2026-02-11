import React from 'react';
import { ListChecks } from 'lucide-react';
import clsx from 'clsx';

interface DiffModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  category?: string;
  details?: string[];
  diffType?: 'added' | 'removed';
}

const DiffModal: React.FC<DiffModalProps> = ({ isOpen = false, onClose, category = '', details = [], diffType = 'added' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto" aria-labelledby="diff-modal-title" role="dialog" aria-modal="true">
      <div className="flex items-center justify-center min-h-screen px-4 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity" aria-hidden="true" onClick={onClose}></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom glass-panel rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-glass-border bg-[#1e293b] animate-fade-in">
          <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                <h3 className="text-lg leading-6 font-bold text-white flex items-center gap-2" id="diff-modal-title">
                  <ListChecks className="text-indigo-400 w-5 h-5" /> {category} Differences
                </h3>
                <div className="mt-2">
                  <p className="text-xs text-slate-400">
                    {diffType === 'added'
                      ? `The following ${details.length} objects were added (newly created or split):`
                      : `The following ${details.length} objects were removed (likely unused) or merged:`
                    }
                  </p>
                </div>

                <div className="mt-4 max-h-60 overflow-y-auto custom-scrollbar bg-slate-900/50 rounded-lg border border-slate-700 p-2">
                  {details.map((item, index) => (
                    <div
                      key={index}
                      className={clsx(
                        "px-3 py-2 border-b border-slate-700/50 text-xs font-mono last:border-0 hover:bg-slate-800/50 transition-colors",
                        diffType === 'added' ? "text-emerald-300" : "text-rose-300"
                      )}
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-white/5">
            <button
              type="button"
              className="w-full inline-flex justify-center rounded-xl border border-slate-600 shadow-sm px-4 py-2 bg-transparent text-base font-medium text-slate-300 hover:bg-slate-800 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm transition-colors"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiffModal;
