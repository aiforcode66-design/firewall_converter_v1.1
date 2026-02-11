import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, RotateCcw, Copy, FileText, FileSpreadsheet, Search, Filter, Loader2 } from 'lucide-react';
import Dashboard from './Dashboard';
import ResultTabs from './ResultTabs';
import DataTable from './DataTable';
import LogViewer from './LogViewer';
import CLIViewer from './CLIViewer';
import DiffModal from './DiffModal';
import AnalysisReport from './AnalysisReport';
import clsx from 'clsx';
import { ConversionResults, Vendor, MappingData, GeneratorOptions, TargetLayoutItem } from '../../types/api';

interface UploadedFiles {
  config_file?: File | null;
  checkpoint_objects?: File | null;
  checkpoint_policy?: File | null;
  checkpoint_nat?: File | null;
  checkpoint_config?: File | null;
  checkpoint_csv_zip?: File | null;
}

interface Step3ResultsProps {
  results: ConversionResults | null;
  sourceVendor: Vendor;
  destVendor: Vendor;
  onReset: () => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
  uploadedFiles: UploadedFiles;
  mappingData: MappingData;
  targetLayout: TargetLayoutItem[];
  generatorOptions: GeneratorOptions;
  excludeUnused: boolean;
  sessionId?: string; // NEW: session ID from analyze response
}

const Step3_Results: React.FC<Step3ResultsProps> = ({
  results, sourceVendor, destVendor, onReset, showToast,
  uploadedFiles, mappingData, targetLayout, generatorOptions, excludeUnused,
  sessionId
}) => {
  const navigate = useNavigate();
  const [diffModalState, setDiffModalState] = useState<{
    isOpen: boolean;
    category: string;
    details: any[];
    diffType: string;
  }>({ isOpen: false, category: '', details: [], diffType: '' });

  const vendorNames: Record<string, string> = {
    'cisco_asa': 'Cisco ASA',
    'checkpoint': 'Check Point',
    'fortinet': 'Fortinet',
    'palo_alto': 'Palo Alto'
  };

  const handleDownload = async (format: string) => {
    const formData = new FormData();
    formData.append('source_vendor', sourceVendor);
    formData.append('destination_vendor', destVendor);
    formData.append('format', format);

    if (sourceVendor === 'checkpoint') {
      if (uploadedFiles.checkpoint_objects) formData.append('checkpoint_objects', uploadedFiles.checkpoint_objects);
      if (uploadedFiles.checkpoint_policy) formData.append('checkpoint_policy', uploadedFiles.checkpoint_policy);
      if (uploadedFiles.checkpoint_nat) formData.append('checkpoint_nat', uploadedFiles.checkpoint_nat);
      if (uploadedFiles.checkpoint_config) formData.append('checkpoint_config', uploadedFiles.checkpoint_config);
    } else if (uploadedFiles.config_file) {
      formData.append('config_file', uploadedFiles.config_file);
    }

    formData.append('interface_mapping_data', JSON.stringify(mappingData));
    formData.append('target_layout_data', JSON.stringify(targetLayout));
    if (excludeUnused) formData.append('exclude_unused', 'on');

    Object.keys(generatorOptions).forEach(key => {
      // @ts-ignore
      if (generatorOptions[key]) formData.append(key, generatorOptions[key]);
    });

    try {
      const response = await fetch('/download', { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversion.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  const handleCopyScript = (content: string) => {
    if (!content) {
      showToast('No content to copy', 'error');
      return;
    }
    navigator.clipboard.writeText(content).then(() => {
      showToast('Copied to clipboard!');
    }).catch(() => {
      showToast('Copy failed', 'error');
    });
  };

  const handleDiffClick = (category: string, details: any[], diffType: string) => {
    setDiffModalState({ isOpen: true, category, details, diffType });
  };

  if (!results) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="h-full flex flex-col animate-fade-in gap-6 p-4 lg:p-8 max-w-[1600px] mx-auto w-full">
      {/* Header Section */}
      <div className="flex-none flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/60 backdrop-blur-xl p-6 rounded-2xl border border-white shadow-sm transition-all hover:shadow-md">
        <div>
          <div className="flex items-center gap-3 text-sm font-medium mb-2">
            <span className="bg-emerald-100/80 text-emerald-800 px-3 py-1 rounded-full border border-emerald-200/50 shadow-sm">{vendorNames[sourceVendor]}</span>
            <ArrowRight className="w-4 h-4 text-emerald-400" />
            <span className="bg-brand-teal/10 text-brand-emerald px-3 py-1 rounded-full border border-teal-200/50 shadow-sm">{vendorNames[destVendor]}</span>
          </div>
          <h2 className="text-3xl font-serif font-bold text-emerald-950 tracking-tight">Conversion Results</h2>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden lg:flex items-center gap-2 mr-4 bg-emerald-50/50 p-1.5 rounded-lg border border-emerald-100/50">
            <div className="text-xs font-medium text-emerald-600 px-2">Export As:</div>
            <button onClick={() => handleDownload('txt')} className="p-2 text-emerald-700 hover:bg-white hover:shadow-sm rounded-md transition-all" title="Download .txt"><FileText className="w-4 h-4" /></button>
            <button onClick={() => handleDownload('xlsx')} className="p-2 text-emerald-700 hover:bg-white hover:shadow-sm rounded-md transition-all" title="Download .xlsx"><FileSpreadsheet className="w-4 h-4" /></button>
            <div className="w-px h-4 bg-emerald-200 mx-1"></div>
            <button onClick={() => handleCopyScript(results.script)} className="p-2 text-brand-teal hover:bg-white hover:shadow-sm rounded-md transition-all" title="Copy Script"><Copy className="w-4 h-4" /></button>
          </div>

          <button
            onClick={() => {
              onReset();
              navigate('/');
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-xl text-sm font-bold border border-slate-200 hover:border-rose-200 shadow-sm hover:shadow transition-all"
          >
            <RotateCcw className="w-4 h-4" /> Start Over
          </button>
        </div>
      </div>

      {/* Main Content Content */}
      <div className="flex-grow flex flex-col glass-card bg-white/80 backdrop-blur-3xl rounded-[2rem] border border-white/60 shadow-2xl shadow-emerald-900/5 overflow-hidden relative">
        {/* Navigation Tabs */}
        <div className="flex-none px-6 pt-4 border-b border-emerald-100/50 bg-white/50 backdrop-blur-sm">
          <ResultTabs warningsCount={results.conversion_warnings?.length || 0} />
        </div>

        {/* Viewport */}
        <div className="flex-grow overflow-auto relative bg-brand-cream/50 custom-scrollbar flex flex-col">
          <Routes>
            <Route path="/" element={<Navigate to="dashboard" replace />} />

            <Route path="dashboard" element={
              <div className="p-8">
                <Dashboard
                  stats={results.stats}
                  onUnusedClick={() => navigate('objects?filter=unused')}
                />
              </div>
            } />

            <Route path="objects" element={<DataTableWrapper data={results.objects_table} type="network_objects" onDiffClick={handleDiffClick} />} />

            {/* Rules tab now fetches from database */}
            <Route path="rules" element={
              <RulesTableWrapper
                sessionId={sessionId}
                fallbackData={results.rules_table}
                onDiffClick={handleDiffClick}
              />
            } />

            <Route path="nat" element={<DataTableWrapper data={results.nat_rules_table} type="nat" onDiffClick={handleDiffClick} />} />
            <Route path="time_ranges" element={<DataTableWrapper data={results.time_ranges_table} type="time_ranges" onDiffClick={handleDiffClick} />} />
            <Route path="routes" element={<DataTableWrapper data={results.routes_table} type="routes" onDiffClick={handleDiffClick} />} />

            <Route path="comparison" element={<DataTableWrapper data={results.comparison_table} type="comparison" onDiffClick={handleDiffClick} />} />

            <Route path="warnings" element={
              <LogViewer
                content={results.conversion_warnings.map(w => `${(w.original_line || '<unknown>').trim().padEnd(60, ' ')} # [${w.category}] ${w.message}`).join('\n')}
                type="warnings"
                onCopy={handleCopyScript}
              />
            } />

            <Route path="analysis" element={
              <div className="p-8">
                {/* @ts-ignore */}
                <AnalysisReport analysis={results.analysis} />
              </div>
            } />

            <Route path="cli" element={<CLIViewer content={results.script} onCopy={handleCopyScript} />} />
          </Routes>
        </div>
      </div>

      <DiffModal
        isOpen={diffModalState.isOpen}
        onClose={() => setDiffModalState(prev => ({ ...prev, isOpen: false }))}
        category={diffModalState.category}
        details={diffModalState.details}
        diffType={diffModalState.diffType}
      />
    </div>
  );
};

// ============================================================================
// RulesTableWrapper - Fetches rules from database
// ============================================================================

interface RulesTableWrapperProps {
  sessionId?: string;
  fallbackData: any[];
  onDiffClick: (category: string, details: any[], diffType: string) => void;
}

const RulesTableWrapper: React.FC<RulesTableWrapperProps> = ({ sessionId, fallbackData, onDiffClick }) => {
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
          const transformedRules = data.map((rule: any, index: number) => ({
            sequence_id: rule.sequence_id || index + 1,
            name: rule.name || '',
            action: rule.action || 'allow',
            enabled: rule.enabled !== false,
            log: rule.log || false,
            source_zone: Array.isArray(rule.source_zone) ? rule.source_zone.join(', ') : rule.source_zone || '',
            destination_zone: Array.isArray(rule.destination_zone) ? rule.destination_zone.join(', ') : rule.destination_zone || '',
            source: Array.isArray(rule.source) ? rule.source.join(', ') : rule.source || '',
            destination: Array.isArray(rule.destination) ? rule.destination.join(', ') : rule.destination || '',
            service: Array.isArray(rule.service) ? rule.service.join(', ') : rule.service || '',
            application: Array.isArray(rule.application) ? rule.application.join(', ') : rule.application || '',
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
    <div className="flex flex-col h-full bg-white/40">
      {/* Toolbar */}
      <div className="flex-none bg-white/60 backdrop-blur-md border-b border-emerald-100 p-4 flex justify-between items-center gap-4 shadow-sm sticky top-0 z-20">
        <div className="relative flex-grow max-w-md group">
          <Search className="absolute left-3.5 top-2.5 text-emerald-400/60 w-4 h-4 group-focus-within:text-brand-emerald transition-colors" />
          <input
            type="text"
            placeholder="Search rules..."
            className="w-full bg-white border border-emerald-100 rounded-xl py-2 pl-10 pr-4 text-sm text-emerald-900 placeholder:text-emerald-900/30 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 outline-none transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Data source indicator */}
        <div className={clsx(
          "px-3 py-1.5 rounded-lg text-xs font-medium",
          dataSource === 'database'
            ? "bg-emerald-100 text-emerald-700"
            : "bg-amber-100 text-amber-700"
        )}>
          {loading ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading...
            </span>
          ) : (
            <span>Source: {dataSource === 'database' ? 'ðŸ“€ Database' : 'ðŸ’¾ Memory'}</span>
          )}
        </div>
      </div>

      <div className="flex-grow overflow-auto p-4 lg:p-6">
        {error && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
            âš ï¸ {error} - Showing data from memory instead
          </div>
        )}
        <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
          {/* @ts-ignore */}
          <DataTable data={filteredData} type="rules" onDiffClick={onDiffClick} />
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// DataTableWrapper - Original wrapper for other data types
// ============================================================================

interface DataTableWrapperProps {
  data: any[];
  type: string;
  onDiffClick: (category: string, details: any[], diffType: string) => void;
}

const DataTableWrapper: React.FC<DataTableWrapperProps> = ({ data = [], type, onDiffClick }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showUnusedOnly, setShowUnusedOnly] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('filter') === 'unused') {
      setShowUnusedOnly(true);
    } else {
      setShowUnusedOnly(false);
    }
  }, [location.search]);

  const filteredData = useMemo(() => {
    let d = data;
    if (type === 'network_objects' && showUnusedOnly) {
      d = d.filter(item => item.is_unused);
    }
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      d = d.filter(item => JSON.stringify(item).toLowerCase().includes(lower));
    }
    return d;
  }, [data, searchTerm, showUnusedOnly, type]);

  return (
    <div className="flex flex-col h-full bg-white/40">
      {/* Toolbar */}
      <div className="flex-none bg-white/60 backdrop-blur-md border-b border-emerald-100 p-4 flex justify-between items-center gap-4 shadow-sm sticky top-0 z-20">
        <div className="relative flex-grow max-w-md group">
          <Search className="absolute left-3.5 top-2.5 text-emerald-400/60 w-4 h-4 group-focus-within:text-brand-emerald transition-colors" />
          <input
            type="text"
            placeholder="Search configuration..."
            className="w-full bg-white border border-emerald-100 rounded-xl py-2 pl-10 pr-4 text-sm text-emerald-900 placeholder:text-emerald-900/30 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 outline-none transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {type === 'network_objects' && (
          <button
            onClick={() => setShowUnusedOnly(!showUnusedOnly)}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm border ${showUnusedOnly ? 'bg-brand-coral text-white border-brand-coral' : 'bg-white text-emerald-600 border-emerald-100 hover:bg-emerald-50'}`}
          >
            <Filter className={clsx("w-3.5 h-3.5", showUnusedOnly ? "text-white" : "text-emerald-400")} />
            {showUnusedOnly ? "Unused Only" : "Show Unused"}
          </button>
        )}
      </div>

      <div className="flex-grow overflow-auto p-4 lg:p-6">
        <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
          {/* @ts-ignore */}
          <DataTable data={filteredData} type={type} onDiffClick={onDiffClick} />
        </div>
      </div>
    </div>
  );
}

export default Step3_Results;

