import React from 'react';
import { FileText, Layers, Network, AlertTriangle, ArrowUpRight, LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  subInfo?: React.ReactNode;
  icon: LucideIcon;
  colorClass: string;
  statusColor: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, subInfo, icon: Icon, colorClass, statusColor }) => (
  <div className="bg-white p-4 rounded-xl border border-brand-100 shadow-card flex items-start justify-between hover:shadow-brand transition-all duration-300">
    <div>
      <p className="text-[10px] font-bold text-gray-700/60 uppercase tracking-wider mb-1">{label}</p>
      <h3 className="text-2xl font-bold text-gray-900 tracking-tight">{value}</h3>
      <div className={`flex items-center gap-1 mt-2 text-[11px] font-medium ${statusColor}`}>
        {subInfo}
      </div>
    </div>
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClass}`}>
      <Icon className="w-5 h-5" />
    </div>
  </div>
);

interface StatsData {
  rulesCount?: string | number;
  objectsCount?: string | number;
  natCount?: string | number;
  warningsCount?: string | number;
  rulesTrend?: string;
  objectsUnused?: string | number;
  natStatus?: string;
  warningsStatus?: string;
}

interface KPIStatsRowProps {
  stats?: StatsData;
}

const KPIStatsRow: React.FC<KPIStatsRowProps> = ({ stats }) => {
  // Default values if no stats provided
  const {
    rulesCount = '-',
    objectsCount = '-',
    natCount = '-',
    warningsCount = '-',
    rulesTrend = 'Waiting for analysis',
    objectsUnused = '-',
    natStatus = '-',
    warningsStatus = '-'
  } = stats || {};

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard
        label="Total Rules Identified"
        value={rulesCount}
        subInfo={<><ArrowUpRight className="w-3 h-3" /> {rulesTrend}</>}
        icon={FileText}
        colorClass="bg-brand-50 text-brand-500"
        statusColor="text-brand-600"
      />
      <StatCard
        label="Object Groups"
        value={objectsCount}
        subInfo={<>{objectsUnused} Unused</>}
        icon={Layers}
        colorClass="bg-orange-50 text-orange-500"
        statusColor="text-orange-600"
      />
      <StatCard
        label="NAT Entries"
        value={natCount}
        subInfo={<>{natStatus}</>}
        icon={Network}
        colorClass="bg-amber-50 text-amber-600"
        statusColor="text-amber-600"
      />
      <StatCard
        label="Conversion Warnings"
        value={warningsCount}
        subInfo={<>{warningsStatus}</>}
        icon={AlertTriangle}
        colorClass="bg-red-50 text-red-600"
        statusColor="text-red-600"
      />
    </div>
  );
};

export default KPIStatsRow;
