import React, { useState } from 'react';
import { ArrowRight, Check, X, Wand2, Shield, Network } from 'lucide-react';
import clsx from 'clsx';
import { MappingData, AnalyzeConfigResponse, InterfaceInfo } from '../../types/api';

const TARGET_ZONES = ['trust', 'untrust', 'dmz', 'mgmt', 'vpn', 'guest'];
const TARGET_INTERFACES = Array.from({ length: 8 }, (_, i) => `ethernet1/${i + 1}`).concat(['ae1', 'ae2', 'tunnel.1']);

interface InteractiveMappingProps {
  analysisData?: AnalyzeConfigResponse | null;
  mappingData: MappingData;
  setMappingData: (data: MappingData | ((prev: MappingData) => MappingData)) => void;
  onClose?: () => void;
}

type MappingStep = 'zones' | 'interfaces';

const InteractiveMapping: React.FC<InteractiveMappingProps> = ({
  analysisData,
  mappingData,
  setMappingData,
  onClose
}) => {
  const [step, setStep] = useState<MappingStep>('zones');
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  // Extract identified items
  const sourceZones = analysisData?.zones || [];
  const sourceInterfaces = analysisData?.interfaces || [];

  // Helper to update mapping
  const updateMapping = (source: string, target: string) => {
    setMappingData((prev: MappingData) => ({
      ...prev,
      [step === 'zones' ? 'zone_mapping' : 'interface_mapping']: {
        ...(prev[step === 'zones' ? 'zone_mapping' : 'interface_mapping']),
        [source]: target
      }
    }));
    setSelectedSource(null);
  };

  // Helper to remove mapping
  const removeMapping = (source: string) => {
    setMappingData((prev: MappingData) => {
      const mappingKey = step === 'zones' ? 'zone_mapping' : 'interface_mapping';
      const newMapping = { ...prev[mappingKey] };
      delete newMapping[source];
      return {
        ...prev,
        [mappingKey]: newMapping
      };
    });
  };

  // Auto-suggest logic
  const runAutoSuggest = () => {
    const suggestions: Record<string, string> = {};
    const sources = step === 'zones' ? sourceZones : sourceInterfaces;
    const targets = step === 'zones' ? TARGET_ZONES : TARGET_INTERFACES;

    sources.forEach(src => {
      const srcName = typeof src === 'string' ? src : src.name;
      const lowerSrc = srcName.toLowerCase();
      // Simple regex matching
      if (lowerSrc.includes('in')) suggestions[srcName] = targets.find(t => t === 'trust') || 'trust';
      else if (lowerSrc.includes('out')) suggestions[srcName] = targets.find(t => t === 'untrust') || 'untrust';
      else if (lowerSrc.includes('dmz')) suggestions[srcName] = targets.find(t => t === 'dmz') || 'dmz';
    });

    setMappingData((prev: MappingData) => ({
      ...prev,
      [step === 'zones' ? 'zone_mapping' : 'interface_mapping']: {
        ...(prev[step === 'zones' ? 'zone_mapping' : 'interface_mapping']),
        ...suggestions
      }
    }));
  };

  const currentMapping = mappingData[step === 'zones' ? 'zone_mapping' : 'interface_mapping'] || {};
  const sourcesList = step === 'zones' ? sourceZones : sourceInterfaces;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-slate-800/50 p-6 border-b border-slate-700 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-indigo-400" />
              Interactive Mapping Wizard
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              {step === 'zones' ? 'Step 1: Map Security Zones' : 'Step 2: Map Network Interfaces'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={runAutoSuggest}
              className="px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Wand2 className="w-4 h-4" /> Auto-Suggest
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Source Column */}
          <div className="w-1/3 flex flex-col border-r border-slate-800 bg-slate-900/50 p-6 overflow-y-auto">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              {step === 'zones' ? <Shield className="w-4 h-4" /> : <Network className="w-4 h-4" />}
              Source (Detected)
            </h3>
            <div className="space-y-3">
              {sourcesList.map((item, idx) => {
                const itemName = typeof item === 'string' ? item : (item as InterfaceInfo).name;
                const itemZone = typeof item === 'object' ? (item as InterfaceInfo).zone : undefined;
                const isMapped = !!currentMapping[itemName];
                const isSelected = selectedSource === itemName;

                return (
                  <button
                    key={itemName}
                    onClick={() => setSelectedSource(itemName)}
                    className={clsx(
                    "w-full text-left p-4 rounded-xl border transition-all relative",
                    isSelected ? "border-indigo-500 bg-indigo-500/10 ring-2 ring-indigo-500/20" :
                      isMapped ? "border-emerald-500/30 bg-emerald-500/5" : "border-slate-700 bg-slate-800 hover:border-slate-600"
                    )}
                  >
                    <div className="font-medium text-white">{itemName}</div>
                    {itemZone && (
                      <div className="text-xs text-slate-500 mt-1">Zone: {itemZone}</div>
                    )}
                    {isMapped && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400">
                        <Check className="w-4 h-4" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Connection Area (Visual Indicator) */}
          <div className="w-1/3 bg-slate-950/50 flex flex-col items-center justify-center p-6 border-r border-slate-800 relative">
            {selectedSource ? (
              <div className="text-center animate-pulse">
                <div className="inline-block p-3 rounded-full bg-indigo-500/20 text-indigo-400 mb-4">
                  <ArrowRight className="w-6 h-6" />
                </div>
                <h4 className="text-lg font-medium text-white">Select Target</h4>
                <p className="text-slate-400 text-sm mt-1">
                  Map <strong>{selectedSource}</strong> to...
                </p>
              </div>
            ) : (
              <div className="text-center text-slate-600">
                <p>Select an item from the left column to start mapping</p>
              </div>
            )}

            {/* Active Mappings List (Mini View) */}
            <div className="absolute bottom-6 left-6 right-6">
              <div className="text-xs text-slate-500 uppercase font-bold mb-2">Recent Mappings</div>
              <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                {Object.entries(currentMapping).map(([src, dst]) => (
                  <div key={src} className="flex items-center justify-between text-sm bg-slate-900 border border-slate-800 p-2 rounded">
                    <span className="text-slate-300 truncate max-w-[100px]">{src}</span>
                    <ArrowRight className="w-3 h-3 text-slate-600" />
                    <span className="text-emerald-400 truncate max-w-[100px]">{dst as string}</span>
                    <button onClick={() => removeMapping(src)} className="ml-2 text-slate-600 hover:text-rose-400"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Target Column */}
          <div className="w-1/3 flex flex-col p-6 overflow-y-auto bg-slate-900/50">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Target (Palo Alto)</h3>
            <div className="space-y-2">
              {(step === 'zones' ? TARGET_ZONES : TARGET_INTERFACES).map(target => (
                <button
                  key={target}
                  disabled={!selectedSource}
                  onClick={() => selectedSource && updateMapping(selectedSource, target)}
                  className={clsx(
                    "w-full text-left p-3 rounded-lg border transition-all flex justify-between items-center group",
                    selectedSource
                      ? "border-slate-600 bg-slate-800 hover:border-indigo-500 hover:bg-slate-700 cursor-pointer"
                      : "border-slate-800 bg-slate-900/50 text-slate-500 cursor-not-allowed"
                  )}
                >
                  <span className="font-mono text-sm">{target}</span>
                  {selectedSource && <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400" />}
                </button>
              ))}

              {/* Custom Target Input */}
              {selectedSource && (
                <div className="mt-4 pt-4 border-t border-slate-800">
                  <p className="text-xs text-slate-500 mb-2">Or type custom target:</p>
                  <input
                    type="text"
                    placeholder="Custom value..."
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-indigo-500 outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const target = (e.target as HTMLInputElement).value;
                        if (target) {
                          updateMapping(selectedSource, target);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-800/50 p-6 border-t border-slate-700 flex justify-between items-center">
          <div className="text-sm text-slate-400">
            {Object.keys(currentMapping).length} / {sourcesList.length} items mapped
          </div>
          <div className="flex gap-3">
            {step === 'interfaces' && (
              <button
                onClick={() => setStep('zones')}
                className="px-6 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                Back
              </button>
            )}

            {step === 'zones' ? (
              <button
                onClick={() => setStep('interfaces')}
                className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
              >
                Next: Map Interfaces
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-8 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-500/20"
              >
                Finish Wizard
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InteractiveMapping;
