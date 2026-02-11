import React from 'react';
import { Layers, FileText, Server, Shield, ArrowUpRight, LucideIcon } from 'lucide-react';

interface StatWidgetProps {
  label: string;
  value: string;
  icon: LucideIcon;
  color: string;
  trend?: string;
}

const StatWidget: React.FC<StatWidgetProps> = ({ label, value, icon: Icon, color, trend }) => (
  <div className="bg-white rounded-2xl p-6 border border-brand-100 shadow-card hover:shadow-brand hover:-translate-y-1 transition-all duration-300 group">
    <div className="flex justify-between items-start mb-4">
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
        <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
      </div>
      <div className={`p-3 rounded-xl ${color} bg-opacity-10 group-hover:bg-opacity-20 transition-colors`}>
        <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
      </div>
    </div>
    {trend && (
      <div className="flex items-center gap-1 text-xs font-bold text-brand-600 bg-brand-50 px-2 py-1 rounded inline-flex">
        <ArrowUpRight className="w-3 h-3" />
        {trend}
      </div>
    )}
  </div>
);

const QuickStats: React.FC = () => {
  // Mock Data - In real app, this would come from a context or API
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatWidget
        label="Total Conversions"
        value="9"
        icon={FileText}
        color="bg-brand-500"
      />
      <StatWidget
        label="Total Rules Processed"
        value="1,306"
        icon={Layers}
        color="bg-orange-500"
        trend="+12% this week"
      />
      <StatWidget
        label="Most Used Source"
        value="cisco_asa"
        icon={Server}
        color="bg-amber-600"
      />
      <StatWidget
        label="Most Used Dest"
        value="palo_alto"
        icon={Shield}
        color="bg-red-600"
      />
    </div>
  );
};

export default QuickStats;
