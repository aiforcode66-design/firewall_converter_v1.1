import React, { useEffect } from 'react';
import { AnalyzeConfigResponse, MappingData, InterfaceInfo } from '../../types/api';

interface MappingTableProps {
  analysisData?: AnalyzeConfigResponse | null;
  mappingData: MappingData;
  setMappingData: (data: MappingData | ((prev: MappingData) => MappingData)) => void;
}

interface MappingItem {
  target_interface?: string;
  target_zone?: string;
}

const MappingTable: React.FC<MappingTableProps> = ({
  analysisData,
  mappingData,
  setMappingData
}) => {

  // Initialize mapping data if empty
  useEffect(() => {
    if (analysisData && analysisData.interfaces && Object.keys(mappingData).length === 0) {
      const initialMapping: MappingData = { interface_mapping: {}, zone_mapping: {} };
      // We don't necessarily need to pre-fill it, but we can if we want default values
      // For now, we'll let the inputs handle their own state or update the parent on change
    }
  }, [analysisData]);

  const handleInputChange = (sourceName: string, field: keyof MappingItem, value: string) => {
    setMappingData((prev: MappingData) => ({
      ...prev,
      [sourceName]: {
        ...(prev[sourceName as keyof MappingData] as MappingItem | undefined),
        [field]: value
      }
    }));
  };

  if (!analysisData || !analysisData.interfaces || analysisData.interfaces.length === 0) {
    return (
      <div className="p-6 text-center text-slate-500">
        No interfaces detected for mapping. You can proceed directly.
      </div>
    );
  }

  return (
    <div className="flex-grow overflow-auto border border-slate-700 rounded-lg bg-[#0d1117] relative custom-scrollbar">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-800 sticky top-0 z-10 text-xs uppercase font-semibold text-slate-200">
          <tr>
            <th className="px-6 py-3 border-b border-slate-700 w-1/4">Source Interface</th>
            <th className="px-6 py-3 border-b border-slate-700 w-1/4">Source Zone</th>
            <th className="px-6 py-3 border-b border-slate-700 w-1/4">Target Interface</th>
            <th className="px-6 py-3 border-b border-slate-700 w-1/4">Target Zone</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 text-sm text-slate-200 font-mono">
          {analysisData.interfaces.map((item: InterfaceInfo) => {
            const mappingItem = mappingData[item.name as keyof MappingData] as MappingItem | undefined;

            return (
              <tr key={item.name} className="border-b border-slate-700 hover:bg-slate-700/30 transition-colors">
                <td className="px-6 py-3 font-mono text-indigo-300 text-sm">{item.name}</td>
                <td className="px-6 py-3 font-mono text-slate-400 text-xs">{item.zone || '-'}</td>
                <td className="px-6 py-3">
                  <input
                    type="text"
                    className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder-slate-600"
                    placeholder={`${item.name} (Default)`}
                    value={mappingItem?.target_interface || ''}
                    onChange={(e) => handleInputChange(item.name, 'target_interface', e.target.value)}
                  />
                </td>
                <td className="px-6 py-3">
                  <input
                    type="text"
                    className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder-slate-600"
                    placeholder={item.zone || 'New Zone'}
                    value={mappingItem?.target_zone || ''}
                    onChange={(e) => handleInputChange(item.name, 'target_zone', e.target.value)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default MappingTable;
