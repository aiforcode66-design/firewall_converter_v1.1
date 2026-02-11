import React from 'react';
import { LucideIcon, Network, Layers, Server, Boxes, Clock, Shield, Globe, Route, Trash2 } from 'lucide-react';

interface KPICardProps {
  icon: LucideIcon;
  label: string;
  value: number;
  gradient: string;
  delay?: number;
}

interface DashboardStats {
  addresses: number;
  groups: number;
  services: number;
  service_groups: number;
  time_ranges: number;
  rules: number;
  nat_rules: number;
  unused_objects: number;
  routes: number;
}

interface DashboardProps {
  stats?: Partial<DashboardStats>;
  onUnusedClick?: () => void;
}

const KPICard: React.FC<KPICardProps> = ({ icon: Icon, label, value, gradient, delay = 0 }) => (
  <div
    className="bg-white/60 backdrop-blur-sm border border-emerald-100 rounded-2xl p-5 flex flex-col items-start gap-3 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group animate-fade-in"
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
      <Icon className="w-5 h-5 text-white" />
    </div>
    <div>
      <p className="text-xs font-bold text-emerald-800/60 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl font-serif font-bold text-emerald-950">{value}</p>
    </div>
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ stats, onUnusedClick }) => {
  const defaultStats: DashboardStats = {
    addresses: 0,
    groups: 0,
    services: 0,
    service_groups: 0,
    time_ranges: 0,
    rules: 0,
    nat_rules: 0,
    unused_objects: 0,
    routes: 0,
  };

  const mergedStats = { ...defaultStats, ...stats };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
      <KPICard icon={Network} label="Addresses" value={mergedStats.addresses} gradient="from-emerald-400 to-teal-500" delay={0} />
      <KPICard icon={Layers} label="Addr Groups" value={mergedStats.groups} gradient="from-teal-400 to-cyan-500" delay={50} />
      <KPICard icon={Server} label="Services" value={mergedStats.services} gradient="from-cyan-400 to-blue-500" delay={100} />
      <KPICard icon={Boxes} label="Svc Groups" value={mergedStats.service_groups} gradient="from-blue-400 to-indigo-500" delay={150} />

      <KPICard icon={Clock} label="Schedules" value={mergedStats.time_ranges} gradient="from-violet-400 to-purple-500" delay={200} />
      <KPICard icon={Shield} label="Rules" value={mergedStats.rules} gradient="from-fuchsia-400 to-pink-500" delay={250} />
      <KPICard icon={Globe} label="NAT" value={mergedStats.nat_rules} gradient="from-rose-400 to-orange-500" delay={300} />

      <div
        className="bg-white/60 backdrop-blur-sm border border-emerald-100 rounded-2xl p-5 flex flex-col items-start gap-3 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group cursor-pointer animate-fade-in hover:border-brand-coral/30"
        style={{ animationDelay: '350ms' }}
        onClick={onUnusedClick}
      >
        <div className="p-3 rounded-xl bg-gradient-to-br from-brand-coral to-red-500 shadow-sm group-hover:scale-110 transition-transform duration-300">
          <Trash2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-xs font-bold text-emerald-800/60 uppercase tracking-wider mb-1">Unused Objects</p>
          <p className="text-3xl font-serif font-bold text-emerald-950">{mergedStats.unused_objects}</p>
        </div>
      </div>

      <div className="col-span-2 md:col-span-4 mt-4 bg-emerald-50/50 rounded-2xl p-6 border border-emerald-100 animate-fade-in" style={{ animationDelay: '400ms' }}>
        <h3 className="text-lg font-bold text-emerald-900 mb-2 flex items-center gap-2">
          <Route className="w-5 h-5 text-brand-teal" /> Routing Table
        </h3>
        <div className="flex items-end gap-2">
          <span className="text-4xl font-serif font-bold text-brand-emerald">{mergedStats.routes}</span>
          <span className="text-emerald-700/60 font-medium mb-1.5">Total Routes Evaluated</span>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
