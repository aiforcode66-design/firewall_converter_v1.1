import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Network, Route, Box, Layers, Terminal, AlertTriangle, Copy, Check, FileText, FileSpreadsheet, Rocket, CheckCircle, LucideIcon, Search, Loader2 } from 'lucide-react';
import { ConversionResults } from '../../types/api';

// Import from JSX (to be migrated later)
const DataTable = React.lazy(() => import('./Step3_Results/DataTable'));
const CLIViewer = React.lazy(() => import('./Step3_Results/CLIViewer'));
const LogViewer = React.lazy(() => import('./Step3_Results/LogViewer'));

interface TabButtonProps {
  id: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  onClick: (id: string) => void;
}

const TabButton: React.FC<TabButtonProps> = ({ id, label, icon: Icon, active, onClick }) => (
  <button
    onClick={() => onClick(id)}
    className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-full transition-all duration-300 shadow-sm ${active
      ? 'bg-brand-600 text-white shadow-brand-lg transform scale-105'
      : 'bg-white text-gray-700 border border-brand-200 hover:bg-brand-50 hover:shadow-md hover:border-brand-300'
      }`}
  >
    <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-brand-500'}`} />
    {label}
  </button>
);

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon: Icon, color }) => (
  <div className="bg-white p-4 rounded-xl border border-brand-100 shadow-card flex items-center gap-4 hover:shadow-brand transition-all duration-300">
    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${color}`}>
      <Icon className="w-5 h-5 text-white" />
    </div>
    <div>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
      <h4 className="text-xl font-bold text-gray-900 leading-tight">{value}</h4>
    </div>
  </div>
);

interface ResultPanelProps {
  results: ConversionResults | null;
  onDownload?: (format: 'txt' | 'xlsx') => void;
  onCopyScript?: () => void;
  sessionId?: string; // NEW: session ID for database fetch
}

const ResultPanel: React.FC<ResultPanelProps> = ({ results, onDownload, onCopyScript, sessionId }) => {
  const [activeTab, setActiveTab] = useState('rules');

  if (!results) return null;

  // Calculate Stats
  const stats = {
    rules: results.rules_table?.length || 0,
    objects: (results.objects_table?.length || 0),
    nat: results.nat_rules_table?.length || 0,
    routes: results.routes_table?.length || 0
  };

  // Prepare tabs config
  const tabs = [
    { id: 'rules', label: 'Rules', icon: Shield },
    { id: 'nat', label: 'NAT', icon: Network },
    { id: 'routes', label: 'Routes', icon: Route },
    { id: 'objects', label: 'Objects', icon: Box },
    { id: 'services', label: 'Services', icon: Layers },
    { id: 'cli', label: 'CLI Output', icon: Terminal },
    { id: 'logs', label: 'Conversion Logs', icon: AlertTriangle },
  ];

  return (
    <div id="result-panel" className="flex flex-col gap-6 mt-8 animate-fade-in-up">

      {/* 1. Success Header */}
      <div className="bg-gradient-to-br from-brand-700 to-brand-600 rounded-3xl p-8 relative overflow-hidden shadow-brand-lg text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-md border border-white/30">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <span className="text-white/80 font-bold tracking-wide text-xs uppercase">Conversion Successful</span>
            </div>
            <h2 className="text-4xl font-bold text-white mb-2 tracking-tight">Migration Complete!</h2>
            <p className="text-white/70 max-w-lg">
              Your configuration has been successfully analyzed and converted. Review the details below.
            </p>
          </div>

          {/* Floating Icon Effect */}
          <div className="hidden md:block relative animate-float">
            <div className="absolute inset-0 bg-brand-400/30 blur-2xl rounded-full"></div>
            <Rocket className="w-24 h-24 text-white drop-shadow-[0_10px_10px_rgba(0,0,0,0.3)] transform -rotate-45" />
          </div>
        </div>

        {/* Integrated Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          <StatCard label="Total Rules" value={stats.rules} icon={Shield} color="bg-brand-500" />
          <StatCard label="Network Objects" value={stats.objects} icon={Box} color="bg-orange-500" />
          <StatCard label="NAT Policies" value={stats.nat} icon={Network} color="bg-amber-500" />
          <StatCard label="Routes" value={stats.routes} icon={Route} color="bg-red-500" />
        </div>
      </div>

      {/* 2. Main Content Area */}
      <div className="bg-white rounded-3xl border border-brand-100 shadow-card overflow-hidden flex flex-col h-[600px]">
        {/* Tabs & Actions */}
        <div className="flex-none p-4 border-b border-brand-100 flex flex-col md:flex-row items-center justify-between gap-4 bg-white/80 backdrop-blur-xl z-20">
          <div className="flex flex-wrap gap-2 justify-center md:justify-start">
            {tabs.map(tab => (
              <TabButton
                key={tab.id}
                id={tab.id}
                label={tab.label}
                icon={tab.icon}
                active={activeTab === tab.id}
                onClick={setActiveTab}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onDownload && onDownload('xlsx')}
              className="p-2.5 rounded-xl bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors"
              title="Export Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDownload && onDownload('txt')}
              className="p-2.5 rounded-xl bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors"
              title="Export Text"
            >
              <FileText className="w-4 h-4" />
            </button>
            <div className="w-px h-6 bg-gray-200 mx-1"></div>
            <button
              onClick={onCopyScript}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition-all font-bold text-xs shadow-brand"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Script</span>
            </button>
          </div>
        </div>

        {/* Data Table Viewport */}
        <div className="flex-1 overflow-hidden relative bg-gray-50/30">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full overflow-auto"
            >
              <React.Suspense fallback={<div className="flex items-center justify-center h-full text-gray-400">Loading...</div>}>
                {/* Rules tab now fetches from database */}
                {activeTab === 'rules' && (
                  <RulesTableDBWrapper
                    sessionId={sessionId}
                    fallbackData={results.rules_table || []}
                  />
                )}
                {/* NAT tab now fetches from database */}
                {activeTab === 'nat' && (
                  <NATTableDBWrapper
                    sessionId={sessionId}
                    fallbackData={results.nat_rules_table || []}
                  />
                )}
                {activeTab === 'routes' && <DataTable data={results.routes_table || []} type="routes" />}
                {/* Objects tab now fetches from database */}
                {activeTab === 'objects' && (
                  <ObjectsTableDBWrapper
                    sessionId={sessionId}
                    fallbackData={results.objects_table || []}
                  />
                )}
                {/* Services tab now fetches from database */}
                {activeTab === 'services' && (
                  <ServicesTableDBWrapper
                    sessionId={sessionId}
                    fallbackData={results.objects_table || []}
                  />
                )}
                {activeTab === 'cli' && <CLIViewer content={results.script || ''} />}
                {activeTab === 'logs' && <LogViewer logs={results.conversion_warnings || []} />}
              </React.Suspense>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// RulesTableDBWrapper - Fetches rules from database
// ============================================================================

interface RulesTableDBWrapperProps {
  sessionId?: string;
  fallbackData: any[];
}

const RulesTableDBWrapper: React.FC<RulesTableDBWrapperProps> = ({ sessionId, fallbackData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'database' | 'memory'>('memory');

  useEffect(() => {
    const fetchRulesFromDB = async () => {
      if (!sessionId) {
        setRules(fallbackData || []);
        setDataSource('memory');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/v1/history/sessions/${sessionId}/rules`);
        if (!response.ok) {
          throw new Error('Failed to fetch rules from database');
        }
        const data = await response.json();

        if (data && data.length > 0) {
          // Transform database format to table format
          // NOTE: DataTable expects specific property names
          const transformedRules = data.map((rule: any, index: number) => ({
            id: rule.sequence_id || index + 1,
            description: rule.name || '',
            action: rule.action || 'allow',
            enabled: rule.enabled !== false,
            log: rule.log || false,
            // DataTable expects these property names:
            source_zones: Array.isArray(rule.source_zone) ? rule.source_zone : [],
            destination_zones: Array.isArray(rule.destination_zone) ? rule.destination_zone : [],
            source_addresses: Array.isArray(rule.source) ? rule.source : [],
            destination_addresses: Array.isArray(rule.destination) ? rule.destination : [],
            services: Array.isArray(rule.service) ? rule.service : [],
            application: Array.isArray(rule.application) ? rule.application : [],
            original_text: rule.original_text || ''
          }));
          setRules(transformedRules);
          setDataSource('database');
        } else {
          setRules(fallbackData || []);
          setDataSource('memory');
        }
      } catch (err: any) {
        console.error('Error fetching rules:', err);
        setError(err.message);
        setRules(fallbackData || []);
        setDataSource('memory');
      } finally {
        setLoading(false);
      }
    };

    fetchRulesFromDB();
  }, [sessionId, fallbackData]);

  const filteredData = useMemo(() => {
    if (!rules) return [];
    if (!searchTerm) return rules;

    const lower = searchTerm.toLowerCase();
    return rules.filter(item => JSON.stringify(item).toLowerCase().includes(lower));
  }, [rules, searchTerm]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar with search and data source indicator */}
      <div className="flex-none bg-white border-b border-gray-100 p-3 flex items-center justify-between gap-4 sticky top-0 z-10">
        <div className="relative flex-grow max-w-md">
          <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search rules..."
            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 pl-10 pr-4 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Data source indicator */}
        <div className={`px-3 py-1.5 rounded-lg text-xs font-bold ${dataSource === 'database'
          ? "bg-green-100 text-green-700"
          : "bg-amber-100 text-amber-700"
          }`}>
          {loading ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading...
            </span>
          ) : (
            <span>📊 Source: {dataSource === 'database' ? '🛢️ Database' : '💾 Memory'}</span>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 bg-amber-50 border-b border-amber-200 text-amber-700 text-sm">
           {error} - Showing data from memory
        </div>
      )}

      {/* Data table */}
      <div className="flex-grow overflow-auto">
        <React.Suspense fallback={<div className="p-8 text-center text-gray-400">Loading table...</div>}>
          <DataTable data={filteredData} type="rules" />
        </React.Suspense>
      </div>
    </div>
  );
};

// ============================================================================
// ObjectsTableDBWrapper - Fetches network objects from database
// ============================================================================

interface ObjectsTableDBWrapperProps {
  sessionId?: string;
  fallbackData: any[];
}

const ObjectsTableDBWrapper: React.FC<ObjectsTableDBWrapperProps> = ({ sessionId, fallbackData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [objects, setObjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'database' | 'memory'>('memory');

  useEffect(() => {
    const fetchObjectsFromDB = async () => {
      if (!sessionId) {
        setObjects(fallbackData || []);
        setDataSource('memory');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/v1/history/sessions/${sessionId}/objects`);
        if (!response.ok) {
          throw new Error('Failed to fetch objects from database');
        }
        const data = await response.json();

        if (data && data.length > 0) {
          // Transform database format to table format
          // DataTable expects: name, type, value1, value2, is_unused
          const transformedObjects = data.map((obj: any) => ({
            name: obj.name || '',
            type: obj.type || '',
            value1: obj.value1 || (obj.members && obj.members.length > 0 ? obj.members.join(', ') : ''),
            value2: obj.value2 || '',
            is_unused: obj.is_unused || false,
            original_text: obj.original_text || ''
          }));
          setObjects(transformedObjects);
          setDataSource('database');
        } else {
          setObjects(fallbackData || []);
          setDataSource('memory');
        }
      } catch (err: any) {
        console.error('Error fetching objects:', err);
        setError(err.message);
        setObjects(fallbackData || []);
        setDataSource('memory');
      } finally {
        setLoading(false);
      }
    };

    fetchObjectsFromDB();
  }, [sessionId, fallbackData]);

  const filteredData = useMemo(() => {
    if (!objects) return [];
    if (!searchTerm) return objects;

    const lower = searchTerm.toLowerCase();
    return objects.filter(item => JSON.stringify(item).toLowerCase().includes(lower));
  }, [objects, searchTerm]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar with search and data source indicator */}
      <div className="flex-none bg-white border-b border-gray-100 p-3 flex items-center justify-between gap-4 sticky top-0 z-10">
        <div className="relative flex-grow max-w-md">
          <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search objects..."
            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 pl-10 pr-4 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Data source indicator */}
        <div className={`px-3 py-1.5 rounded-lg text-xs font-bold ${dataSource === 'database'
          ? "bg-green-100 text-green-700"
          : "bg-amber-100 text-amber-700"
          }`}>
          {loading ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading...
            </span>
          ) : (
            <span>📊 Source: {dataSource === 'database' ? '🛢️ Database' : '💾 Memory'}</span>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 bg-amber-50 border-b border-amber-200 text-amber-700 text-sm">
           {error} - Showing data from memory
        </div>
      )}

      {/* Data table */}
      <div className="flex-grow overflow-auto">
        <React.Suspense fallback={<div className="p-8 text-center text-gray-400">Loading table...</div>}>
          <DataTable data={filteredData} type="network_objects" />
        </React.Suspense>
      </div>
    </div>
  );
};

// ============================================================================
// ServicesTableDBWrapper - Fetches service objects from database
// ============================================================================

interface ServicesTableDBWrapperProps {
  sessionId?: string;
  fallbackData: any[];
}

const ServicesTableDBWrapper: React.FC<ServicesTableDBWrapperProps> = ({ sessionId, fallbackData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'database' | 'memory'>('memory');

  useEffect(() => {
    const fetchServicesFromDB = async () => {
      if (!sessionId) {
        setServices(fallbackData || []);
        setDataSource('memory');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/v1/history/sessions/${sessionId}/services`);
        if (!response.ok) {
          throw new Error('Failed to fetch services from database');
        }
        const data = await response.json();

        if (data && data.length > 0) {
          // Transform database format to table format
          // DataTable expects: name, protocol, port
          const transformedServices = data.map((svc: any) => ({
            name: svc.name || '',
            protocol: svc.protocol || '',
            port: svc.port || (svc.members && svc.members.length > 0 ? svc.members.join(', ') : ''),
            is_unused: svc.is_unused || false,
            original_text: svc.original_text || ''
          }));
          setServices(transformedServices);
          setDataSource('database');
        } else {
          setServices(fallbackData || []);
          setDataSource('memory');
        }
      } catch (err: any) {
        console.error('Error fetching services:', err);
        setError(err.message);
        setServices(fallbackData || []);
        setDataSource('memory');
      } finally {
        setLoading(false);
      }
    };

    fetchServicesFromDB();
  }, [sessionId, fallbackData]);

  const filteredData = useMemo(() => {
    if (!services) return [];
    if (!searchTerm) return services;

    const lower = searchTerm.toLowerCase();
    return services.filter(item => JSON.stringify(item).toLowerCase().includes(lower));
  }, [services, searchTerm]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-none bg-white border-b border-gray-100 p-3 flex items-center justify-between gap-4 sticky top-0 z-10">
        <div className="relative flex-grow max-w-md">
          <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search services..."
            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 pl-10 pr-4 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className={`px-3 py-1.5 rounded-lg text-xs font-bold ${dataSource === 'database' ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
          }`}>
          {loading ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading...
            </span>
          ) : (
            <span>📊 Source: {dataSource === 'database' ? '🛢️ Database' : '💾 Memory'}</span>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-amber-50 border-b border-amber-200 text-amber-700 text-sm">
           {error} - Showing data from memory
        </div>
      )}

      <div className="flex-grow overflow-auto">
        <React.Suspense fallback={<div className="p-8 text-center text-gray-400">Loading table...</div>}>
          <DataTable data={filteredData} type="service_objects" />
        </React.Suspense>
      </div>
    </div>
  );
};

// ============================================================================
// NATTableDBWrapper - Fetches NAT rules from database
// ============================================================================

interface NATTableDBWrapperProps {
  sessionId?: string;
  fallbackData: any[];
}

const NATTableDBWrapper: React.FC<NATTableDBWrapperProps> = ({ sessionId, fallbackData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [natRules, setNatRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'database' | 'memory'>('memory');

  useEffect(() => {
    const fetchNATFromDB = async () => {
      if (!sessionId) {
        setNatRules(fallbackData || []);
        setDataSource('memory');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/v1/history/sessions/${sessionId}/nat`);
        if (!response.ok) {
          throw new Error('Failed to fetch NAT rules from database');
        }
        const data = await response.json();

        if (data && data.length > 0) {
          // Transform database format to table format
          // DataTable expects: id, original_source, translated_source, original_destination, translated_destination
          const transformedNAT = data.map((nat: any, index: number) => ({
            id: nat.sequence_id || index + 1,
            original_source: Array.isArray(nat.original_source) ? nat.original_source : [],
            translated_source: nat.translated_source ? [nat.translated_source] : [],
            original_destination: Array.isArray(nat.original_destination) ? nat.original_destination : [],
            translated_destination: nat.translated_destination ? [nat.translated_destination] : [],
            original_text: nat.original_text || ''
          }));
          setNatRules(transformedNAT);
          setDataSource('database');
        } else {
          setNatRules(fallbackData || []);
          setDataSource('memory');
        }
      } catch (err: any) {
        console.error('Error fetching NAT rules:', err);
        setError(err.message);
        setNatRules(fallbackData || []);
        setDataSource('memory');
      } finally {
        setLoading(false);
      }
    };

    fetchNATFromDB();
  }, [sessionId, fallbackData]);

  const filteredData = useMemo(() => {
    if (!natRules) return [];
    if (!searchTerm) return natRules;

    const lower = searchTerm.toLowerCase();
    return natRules.filter(item => JSON.stringify(item).toLowerCase().includes(lower));
  }, [natRules, searchTerm]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-none bg-white border-b border-gray-100 p-3 flex items-center justify-between gap-4 sticky top-0 z-10">
        <div className="relative flex-grow max-w-md">
          <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search NAT rules..."
            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 pl-10 pr-4 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className={`px-3 py-1.5 rounded-lg text-xs font-bold ${dataSource === 'database' ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
          }`}>
          {loading ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading...
            </span>
          ) : (
            <span>📊 Source: {dataSource === 'database' ? '🛢️ Database' : '💾 Memory'}</span>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-amber-50 border-b border-amber-200 text-amber-700 text-sm">
           {error} - Showing data from memory
        </div>
      )}

      <div className="flex-grow overflow-auto">
        <React.Suspense fallback={<div className="p-8 text-center text-gray-400">Loading table...</div>}>
          <DataTable data={filteredData} type="nat" />
        </React.Suspense>
      </div>
    </div>
  );
};

export default ResultPanel;



