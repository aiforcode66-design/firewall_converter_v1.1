import React from 'react';
import { Server } from 'lucide-react';

const SystemHealth: React.FC = () => {
  return (
    <div className="bg-white rounded-3xl border border-brand-100 shadow-card p-6 flex flex-col h-full">
      <h3 className="font-bold text-gray-900 text-lg mb-6 flex items-center gap-2">
        <Server className="w-5 h-5 text-brand-500" />
        System Health
      </h3>

      <div className="space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-brand-100">
          <span className="text-sm font-medium text-gray-600">Backend API</span>
          <span className="flex items-center gap-1.5 text-xs font-bold text-brand-600 bg-brand-50 px-2 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse"></span>
            Online
          </span>
        </div>
        <div className="flex items-center justify-between pb-4 border-b border-brand-100">
          <span className="text-sm font-medium text-gray-600">Supported Vendors</span>
          <span className="text-sm font-bold text-gray-900 font-mono">4</span>
        </div>
        <div className="flex items-center justify-between pb-4 border-b border-brand-100">
          <span className="text-sm font-medium text-gray-600">App Version</span>
          <span className="text-sm font-bold text-gray-900 font-mono">v2.0</span>
        </div>

        <div className="pt-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Supported Platforms</p>
          <div className="flex flex-wrap gap-2">
            {['Cisco ASA', 'Fortinet', 'Palo Alto', 'Check Point'].map(p => (
              <span key={p} className="px-2 py-1 bg-brand-50 text-brand-700 text-[10px] font-bold rounded border border-brand-100">
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemHealth;
