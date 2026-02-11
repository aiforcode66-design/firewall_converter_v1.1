import React from 'react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { LucideIcon, Terminal, AlertTriangle, Scale, Box, Shield, Globe, Clock, Route, Activity, LayoutDashboard } from 'lucide-react';

interface ResultTabsProps {
  warningsCount?: number;
}

const ResultTabs: React.FC<ResultTabsProps> = ({ warningsCount = 0 }) => {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'objects', label: 'Objects', icon: Box },
    { id: 'rules', label: 'Rules', icon: Shield },
    { id: 'nat', label: 'NAT', icon: Globe },
    { id: 'time_ranges', label: 'Schedules', icon: Clock },
    { id: 'routes', label: 'Routes', icon: Route },
    { id: 'cli', label: 'CLI', icon: Terminal },
    { id: 'warnings', label: 'Warnings', icon: AlertTriangle, badge: warningsCount },
    { id: 'analysis', label: 'Analysis', icon: Activity },
    { id: 'comparison', label: 'Compare', icon: Scale },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2 px-1">
      {tabs.map((tab) => (
        <NavLink
          key={tab.id}
          to={`/results/${tab.id}`}
          className={({ isActive }) => clsx(
            "flex items-center gap-2 whitespace-nowrap relative px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 border select-none group focus:outline-none focus:ring-2 focus:ring-brand-teal/50",
            isActive
              ? "bg-brand-emerald text-white border-brand-emerald shadow-lg shadow-emerald-500/30 -translate-y-0.5"
              : "bg-white border-emerald-100 text-emerald-600/70 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 hover:shadow-sm"
          )}
        >
          {({ isActive }) => (
            <>
              {tab.icon && (
                <tab.icon className={clsx(
                  "w-4 h-4 transition-colors",
                  isActive ? "text-white" : "text-emerald-400 group-hover:text-emerald-600",
                  tab.id === 'warnings' && !isActive ? "text-brand-coral" : "",
                  tab.id === 'comparison' && !isActive ? "text-brand-teal" : ""
                )} />
              )}
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className={clsx(
                  "ml-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold shadow-sm",
                  isActive ? "bg-white/20 text-white" : "bg-brand-coral text-white shadow-red-500/20"
                )}>
                  {tab.badge}
                </span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </div>
  );
};

export default ResultTabs;
