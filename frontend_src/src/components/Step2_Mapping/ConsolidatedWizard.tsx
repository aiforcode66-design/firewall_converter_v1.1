import React, { useState, useMemo, useCallback, Dispatch, SetStateAction } from 'react';
import {
  ArrowRight, Check, Layers, List, Network, Plus, Trash2,
} from 'lucide-react';
import clsx from 'clsx';
import { AnalyzeConfigResponse, MappingData, TargetLayoutItem } from '../../types/api';

// Constants
const TARGET_ZONES = ['trust', 'untrust', 'dmz', 'mgmt', 'vpn', 'guest'];
const DEFAULT_TARGET_INTERFACES = Array.from({ length: 8 }, (_, i) => `ethernet1/${i + 1}`);

interface ConsolidatedWizardProps {
  analysisData: AnalyzeConfigResponse | null;
  mappingData: MappingData;
  setMappingData: Dispatch<SetStateAction<MappingData>>;
  targetLayout: TargetLayoutItem[];
  setTargetLayout: Dispatch<SetStateAction<TargetLayoutItem[]>>;
  targetIpConfig?: Record<string, any>;
  setTargetIpConfig?: Dispatch<SetStateAction<Record<string, any>>>;
}

const ConsolidatedWizard: React.FC<ConsolidatedWizardProps> = ({
  analysisData,
  mappingData,
  setMappingData,
  targetLayout,
  setTargetLayout,
  targetIpConfig,
  setTargetIpConfig
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [mapTab, setMapTab] = useState<'zones' | 'interfaces'>('zones');

  // Data Extraction
  const sourceInterfaces = analysisData?.interfaces || [];

  // Extract unique non-null zones
  const sourceZones = useMemo(() => {
    const zones = new Set<string>();
    sourceInterfaces.forEach(i => {
      const z = i.zone;
      if (z && z !== 'Unknown') zones.add(z);
    });
    return Array.from(zones).sort();
  }, [sourceInterfaces]);

  // Helper: Get Name/Zone/IP
  const getItemDetails = useCallback((item: any) => {
    if (!item) return { name: 'Unknown', zone: 'Unknown', ip: 'N/A' };
    if (typeof item === 'string') return { name: item, zone: 'Unknown', ip: 'N/A' };
    return {
      name: item.name || 'Unknown',
      zone: item.zone || 'Unknown',
      ip: item.ip_address ? `${item.ip_address}/${item.mask_length || ''}` : 'N/A'
    };
  }, []);

  // Handlers
  const addAggregate = () => {
    setTargetLayout(prev => [...prev, { name: '', members: [] }]);
  };

  const updateAggregate = useCallback((idx: number, field: keyof TargetLayoutItem, val: any) => {
    const newLayout = [...targetLayout];
    newLayout[idx] = { ...newLayout[idx], [field]: val };
    setTargetLayout(newLayout);
  }, [targetLayout, setTargetLayout]);

  const removeAggregate = useCallback((idx: number) => {
    const newLayout = [...targetLayout];
    newLayout.splice(idx, 1);
    setTargetLayout(newLayout);
  }, [targetLayout]);

  const updateMapping = useCallback((type: 'zone' | 'interface', source: string, target: string) => {
    setMappingData(prev => ({
      ...prev,
      [type === 'zone' ? 'zone_mapping' : 'interface_mapping']: {
        ...prev[type === 'zone' ? 'zone_mapping' : 'interface_mapping'],
        [source]: target
      }
    }));
    setSelectedSource(null);
  }, [setMappingData]);

  const getAvailableTargetInterfaces = useCallback(() => {
    const layout = targetLayout || [];
    const aggs = layout.map(l => l.name).filter(n => n);
    return [...DEFAULT_TARGET_INTERFACES, ...aggs, 'tunnel.1', 'loopback'];
  }, [targetLayout]);

  const renderStepIndicator = () => (
    <div className="flex justify-between items-center mb-10 px-12 relative">
      {/* Progress Bar Background */}
      <div className="absolute top-[2.5rem] left-24 right-24 h-1 bg-brand-100 -z-0 rounded-full"></div>
      {/* Active Progress Bar */}
      <div
        className="absolute top-[2.5rem] left-24 h-1 bg-gradient-to-r from-brand-500 to-brand-600 -z-0 transition-all duration-700 ease-out rounded-full shadow-sm"
        style={{ width: `calc(${(currentStep - 1) / 2} * (100% - 12rem))` }}
      ></div>

      {[1, 2, 3].map(step => (
        <div key={step} className="flex flex-col items-center relative z-10 group">
          <div className={clsx(
            "w-20 h-20 rounded-2xl flex flex-col items-center justify-center font-bold text-lg transition-all duration-500 border-4",
            step === currentStep ? "bg-white border-brand-500 text-brand-500 shadow-brand-lg scale-110 rotate-3" :
              step < currentStep ? "bg-gradient-to-br from-brand-400 to-brand-600 border-transparent text-white scale-100" : "bg-white border-brand-100 text-gray-300 scale-95"
          )}>
            {step < currentStep ? <Check className="w-8 h-8" /> : <span className="font-bold">{step}</span>}
          </div>
          <div className={clsx(
            "text-xs mt-4 font-bold uppercase tracking-widest transition-colors duration-300",
            step === currentStep || step < currentStep ? "text-brand-600" : "text-gray-300"
          )}>
            {step === 1 ? 'Target' : step === 2 ? 'Mapping' : 'Review'}
          </div>
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Target Configuration</h2>
        <p className="text-gray-500">Define aggregate interfaces for your target platform</p>
      </div>

      <div className="bg-white rounded-2xl border border-brand-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800">Aggregate Interfaces</h3>
          <button
            onClick={addAggregate}
            className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-bold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Aggregate
          </button>
        </div>

        {targetLayout.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Network className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No aggregates defined. Add one to bundle interfaces.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {targetLayout.map((agg, idx) => (
              <div key={idx} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <div className="flex-1 grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Aggregate Name"
                    value={agg.name}
                    onChange={(e) => updateAggregate(idx, 'name', e.target.value)}
                    className="input-field"
                  />
                  <input
                    type="text"
                    placeholder="Members (comma-separated)"
                    value={agg.members.join(', ')}
                    onChange={(e) => updateAggregate(idx, 'members', e.target.value.split(',').map(s => s.trim()))}
                    className="input-field"
                  />
                </div>
                <button
                  onClick={() => removeAggregate(idx)}
                  className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Interface & Zone Mapping</h2>
        <p className="text-gray-500">Map your source interfaces and zones to target values</p>
      </div>

      {/* Tab Toggle */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setMapTab('zones')}
            className={clsx(
              "px-6 py-2 rounded-lg text-sm font-bold transition-all",
              mapTab === 'zones'
                ? "bg-white text-brand-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Layers className="w-4 h-4 inline mr-2" />
            Zones
          </button>
          <button
            onClick={() => setMapTab('interfaces')}
            className={clsx(
              "px-6 py-2 rounded-lg text-sm font-bold transition-all",
              mapTab === 'interfaces'
                ? "bg-white text-brand-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Network className="w-4 h-4 inline mr-2" />
            Interfaces
          </button>
        </div>
      </div>

      {/* Zone Mapping */}
      {mapTab === 'zones' && (
        <div className="bg-white rounded-2xl border border-brand-100 p-6">
          <h3 className="font-bold text-gray-800 mb-4">Zone Mapping</h3>
          {sourceZones.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No zones found in source configuration</div>
          ) : (
            <div className="space-y-2">
              {sourceZones.map(zone => (
                <div key={zone} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600">
                      <Layers className="w-4 h-4" />
                    </div>
                    <span className="font-medium text-gray-700">{zone}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                  <select
                    value={mappingData.zone_mapping?.[zone] || ''}
                    onChange={(e) => updateMapping('zone', zone, e.target.value)}
                    className="input-field w-48"
                  >
                    <option value="">Select target zone...</option>
                    {TARGET_ZONES.map(z => (
                      <option key={z} value={z}>{z}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Interface Mapping */}
      {mapTab === 'interfaces' && (
        <div className="bg-white rounded-2xl border border-brand-100 p-6">
          <h3 className="font-bold text-gray-800 mb-4">Interface Mapping</h3>
          {sourceInterfaces.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No interfaces found in source configuration</div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {sourceInterfaces.map(iface => (
                <div key={iface.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600">
                      <Network className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-700">{iface.name}</div>
                      <div className="text-xs text-gray-400">{iface.zone || 'No zone'}</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 mx-2" />
                  <select
                    value={mappingData.interface_mapping?.[iface.name] || ''}
                    onChange={(e) => updateMapping('interface', iface.name, e.target.value)}
                    className="input-field w-48"
                  >
                    <option value="">Select target interface...</option>
                    {getAvailableTargetInterfaces().map(i => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Review Configuration</h2>
        <p className="text-gray-500">Review your mappings before conversion</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Zone Summary */}
        <div className="bg-white rounded-2xl border border-brand-100 p-6">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Layers className="w-5 h-5 text-brand-500" />
            Zone Mappings
          </h3>
          <div className="space-y-2">
            {Object.entries(mappingData.zone_mapping || {}).map(([source, target]) => (
              <div key={source} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-600">{source}</span>
                <ArrowRight className="w-4 h-4 text-brand-400" />
                <span className="font-medium text-brand-600">{target as string}</span>
              </div>
            ))}
            {Object.keys(mappingData.zone_mapping || {}).length === 0 && (
              <p className="text-gray-400 text-sm">No zone mappings defined</p>
            )}
          </div>
        </div>

        {/* Interface Summary */}
        <div className="bg-white rounded-2xl border border-brand-100 p-6">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Network className="w-5 h-5 text-brand-500" />
            Interface Mappings
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {Object.entries(mappingData.interface_mapping || {}).map(([source, target]) => (
              <div key={source} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-600 text-sm">{source}</span>
                <ArrowRight className="w-4 h-4 text-brand-400" />
                <span className="font-medium text-brand-600 text-sm">{target as string}</span>
              </div>
            ))}
            {Object.keys(mappingData.interface_mapping || {}).length === 0 && (
              <p className="text-gray-400 text-sm">No interface mappings defined</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Step Indicator */}
      {renderStepIndicator()}

      {/* Step Content */}
      <div className="flex-1 overflow-auto">
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
      </div>

      {/* Step Navigation */}
      <div className="flex justify-between mt-6">
        <button
          onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
          disabled={currentStep === 1}
          className="px-6 py-3 rounded-xl border border-brand-200 text-brand-600 hover:bg-brand-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-bold text-sm flex items-center"
        >
          Previous
        </button>
        <button
          onClick={() => setCurrentStep(Math.min(3, currentStep + 1))}
          disabled={currentStep === 3}
          className="px-6 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-bold text-sm flex items-center shadow-brand"
        >
          {currentStep === 3 ? 'Finish' : 'Next'}
          <ArrowRight className="w-4 h-4 ml-2" />
        </button>
      </div>
    </div>
  );
};

export default ConsolidatedWizard;
