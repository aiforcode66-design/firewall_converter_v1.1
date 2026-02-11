import React, { useState } from 'react';
import { CheckCircle, Download, FileText, RefreshCw, Copy, FileCode, List, Network, ArrowLeftRight, Terminal, FileSpreadsheet } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useWizardState } from '../../hooks/useWizardState';
import DataTable from '../Step3_Results/DataTable';

interface KPICardProps {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string | number;
    color: string;
}

const KPICard: React.FC<KPICardProps> = ({ icon: Icon, label, value, color }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`bg-white rounded-xl p-6 border-2 ${color} shadow-lg`}
    >
        <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-lg flex items-center justify-center ${color.replace('border-', 'bg-').replace('500', '100')}`}>
                <Icon className={`w-7 h-7 ${color.replace('border-', 'text-')}`} />
            </div>
            <div>
                <p className="text-sm font-medium text-gray-600">{label}</p>
                <p className="text-3xl font-bold text-gray-900">{value}</p>
            </div>
        </div>
    </motion.div>
);

const WizardStep4_Results: React.FC = () => {
    const { resetWizard, uploadData, mappingData, resultsData } = useWizardState();
    const [activeTab, setActiveTab] = useState<'summary' | 'objects' | 'rules' | 'nat' | 'routes' | 'script'>('summary');
    const [copied, setCopied] = useState(false);

    // Use real results data
    const stats = resultsData?.stats || { rule_count: 0, object_count: 0 };

    const results = {
        totalPolicies: stats.rule_count,
        totalObjects: stats.object_count,
        zonesConverted: Object.keys(mappingData.zones).length,
        interfacesConverted: Object.keys(mappingData.interfaces).length,
    };

    const handleExport = (format: 'script' | 'excel' | 'pdf') => {
        // TODO: Implement actual export logic
        alert(`Export as ${format.toUpperCase()} - Feature coming soon!`);
    };

    const handleCopyScript = () => {
        const scriptContent = resultsData?.script || '';
        navigator.clipboard.writeText(scriptContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleStartNew = () => {
        if (confirm('Start a new conversion? All current data will be lost.')) {
            resetWizard();
        }
    };

    const tabs = [
        { id: 'summary', label: 'Summary', icon: CheckCircle },
        { id: 'objects', label: 'Objects', icon: Network },
        { id: 'rules', label: 'Policies', icon: List },
        { id: 'nat', label: 'NAT', icon: ArrowLeftRight },
        { id: 'routes', label: 'Routes', icon: FileCode },
        { id: 'script', label: 'Script', icon: Terminal },
    ];

    return (
        <div className="flex-1 flex flex-col h-full">
            {/* Header */}
            <div className="text-center mb-6 flex-none">
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                    className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-3"
                >
                    <CheckCircle className="w-8 h-8 text-green-600" />
                </motion.div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">
                    Conversion Complete
                </h1>
                <p className="text-gray-600">
                    Your {uploadData.sourceVendor} configuration has been converted to {uploadData.destVendor}
                </p>
            </div>

            {/* Tabs */}
            <div className="flex justify-center mb-6 flex-none">
                <div className="bg-gray-100/50 p-1 rounded-xl inline-flex shadow-inner border border-gray-200">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={clsx(
                                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200",
                                    isActive
                                        ? "bg-white text-brand-600 shadow-sm ring-1 ring-gray-200"
                                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
                                )}
                            >
                                <Icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                        className="flex-1 flex flex-col h-full overflow-hidden"
                    >
                        {activeTab === 'summary' && (
                            <div className="overflow-y-auto custom-scrollbar p-1">
                                <div className="max-w-6xl w-full mx-auto space-y-6 pb-8">
                                    {/* KPI Cards */}
                                    <div className="grid md:grid-cols-4 gap-4">
                                        <KPICard icon={FileText} label="Security Policies" value={results.totalPolicies} color="border-brand-500" />
                                        <KPICard icon={FileCode} label="Network Objects" value={results.totalObjects} color="border-brand-500" />
                                        <KPICard icon={CheckCircle} label="Zones Mapped" value={results.zonesConverted} color="border-green-500" />
                                        <KPICard icon={CheckCircle} label="Interfaces Mapped" value={results.interfacesConverted} color="border-purple-500" />
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                                        <h2 className="text-xl font-bold text-gray-900 mb-4">Export Options</h2>
                                        <div className="grid md:grid-cols-3 gap-4">
                                            <button onClick={() => handleExport('script')} className="flex items-center justify-center gap-3 px-6 py-4 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors font-medium shadow-lg hover:shadow-brand">
                                                <Download className="w-5 h-5" /> Download Script
                                            </button>
                                            <button onClick={() => handleExport('excel')} className="flex items-center justify-center gap-3 px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-lg hover:shadow-green-200">
                                                <FileSpreadsheet className="w-5 h-5" /> Export to Excel
                                            </button>
                                            <button onClick={() => handleExport('pdf')} className="flex items-center justify-center gap-3 px-6 py-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium shadow-lg hover:shadow-red-200">
                                                <FileText className="w-5 h-5" /> Export to PDF
                                            </button>
                                        </div>
                                    </div>

                                    {/* Start New Conversion */}
                                    <div className="bg-gradient-to-r from-brand-50 to-orange-50 border border-brand-200 rounded-xl p-8 text-center">
                                        <h3 className="text-2xl font-bold text-gray-900 mb-3">Ready for Another Conversion?</h3>
                                        <p className="text-gray-700 mb-6">Start a new wizard session to convert another firewall configuration</p>
                                        <button onClick={handleStartNew} className="inline-flex items-center gap-3 px-8 py-4 bg-white border-2 border-brand-500 text-brand-600 rounded-lg hover:bg-brand-50 transition-colors font-bold text-lg shadow-lg">
                                            <RefreshCw className="w-6 h-6" /> Start New Conversion
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'objects' && (
                            <div className="h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                                {/* @ts-ignore */}
                                <DataTable data={resultsData?.objects_table} type="network_objects" />
                            </div>
                        )}

                        {activeTab === 'rules' && (
                            <div className="h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                                {/* @ts-ignore */}
                                <DataTable data={resultsData?.rules_table} type="rules" />
                            </div>
                        )}

                        {activeTab === 'nat' && (
                            <div className="h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                                {/* @ts-ignore */}
                                <DataTable data={resultsData?.nat_rules_table} type="nat" />
                            </div>
                        )}

                        {activeTab === 'routes' && (
                            <div className="h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                                {/* @ts-ignore */}
                                <DataTable data={resultsData?.routes_table} type="routes" />
                            </div>
                        )}

                        {activeTab === 'script' && (
                            <div className="flex-1 bg-gray-900 rounded-xl shadow-lg p-0 overflow-hidden flex flex-col relative border border-gray-800">
                                <div className="flex justify-between items-center p-3 bg-gray-800 border-b border-gray-700">
                                    <span className="text-gray-400 text-xs font-mono">generated_config.txt</span>
                                    <button onClick={handleCopyScript} className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors text-xs font-medium text-white">
                                        {copied ? <><CheckCircle className="w-3.5 h-3.5 text-green-400" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                                    </button>
                                </div>
                                <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                                    <pre className="font-mono text-sm text-green-400 whitespace-pre-wrap leading-relaxed">
                                        {resultsData?.script || '# No configuration generated'}
                                    </pre>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};

export default WizardStep4_Results;
