import React, { useState, useEffect, useCallback, Dispatch, SetStateAction } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Wand2, RotateCcw, Network, Shield, Cloud, Loader2, LucideIcon } from 'lucide-react';
import { Vendor, MappingData, GeneratorOptions, TargetLayoutItem, ConversionResults, AnalyzeConfigResponse } from '../../types/api';

// Types for component props
interface UploadedFiles {
  config_file?: File | null;
  checkpoint_objects?: File | null;
  checkpoint_policy?: File | null;
  checkpoint_nat?: File | null;
  checkpoint_config?: File | null;
  checkpoint_csv_zip?: File | null;
}

interface StatsData {
  rulesCount: number;
  objectsCount: number;
  natCount: number;
  routesCount: number;
  objectsUnused: number;
  warningsCount: number;
  rulesTrend: string;
}

interface Step1UploadProps {
  sourceVendor: Vendor;
  setSourceVendor: Dispatch<SetStateAction<Vendor>>;
  destVendor: Vendor;
  setDestVendor: Dispatch<SetStateAction<Vendor>>;
  uploadedFiles: UploadedFiles;
  setUploadedFiles: Dispatch<SetStateAction<UploadedFiles>>;
  generatorOptions: GeneratorOptions;
  setGeneratorOptions: Dispatch<SetStateAction<GeneratorOptions>>;
  excludeUnused: boolean;
  setExcludeUnused: Dispatch<SetStateAction<boolean>>;
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setLoadingText: Dispatch<SetStateAction<string>>;
  onAnalysisComplete: (data: AnalyzeConfigResponse | null) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  analysisData: AnalyzeConfigResponse | null;
  mappingData: MappingData;
  setMappingData: Dispatch<SetStateAction<MappingData>>;
  conversionResults: ConversionResults | null;
  onConversionComplete: (data: ConversionResults | null) => void;
  targetLayout: TargetLayoutItem[];
  setTargetLayout: Dispatch<SetStateAction<TargetLayoutItem[]>>;
}

const Step1_Upload: React.FC<Step1UploadProps> = ({
  sourceVendor,
  setSourceVendor,
  destVendor,
  setDestVendor,
  uploadedFiles,
  setUploadedFiles,
  generatorOptions,
  setGeneratorOptions,
  excludeUnused,
  setExcludeUnused,
  isLoading,
  setIsLoading,
  setLoadingText,
  onAnalysisComplete,
  showToast,
  analysisData,
  mappingData,
  setMappingData,
  conversionResults,
  onConversionComplete,
  targetLayout,
  setTargetLayout
}) => {
  const [fileContent, setFileContent] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Debug uploadedFiles state
  useEffect(() => {
    console.log('Step1_Upload State:', { sourceVendor, uploadedFiles });
  }, [sourceVendor, uploadedFiles]);

  // Auto-scroll to results when available
  useEffect(() => {
    if (conversionResults) {
      setTimeout(() => {
        document.getElementById('result-panel')?.scrollIntoView({ behavior: 'smooth' });
      }, 500);
    }
  }, [conversionResults]);

  // Read file content when uploaded & Auto-Analyze
  useEffect(() => {
    if (sourceVendor !== 'checkpoint' && uploadedFiles.config_file) {
      const reader = new FileReader();
      reader.onload = (e) => setFileContent(e.target?.result as string || '');
      reader.readAsText(uploadedFiles.config_file);
      handleAnalyze();
    }
  }, [uploadedFiles.config_file, sourceVendor]);

  const hasFile = !!uploadedFiles.config_file || (
    sourceVendor === 'checkpoint' &&
    !!uploadedFiles.checkpoint_policy &&
    (!!uploadedFiles.checkpoint_objects || !!uploadedFiles.checkpoint_csv_zip)
  );

  // For Checkpoint, wait for analysis to complete before showing main interface
  const showMainInterface = sourceVendor === 'checkpoint' ? !!analysisData : hasFile;

  const handleAnalyze = async () => {
    if (!uploadedFiles.config_file && sourceVendor !== 'checkpoint') return;

    // CheckPoint requires policy + (objects OR csv_zip)
    if (sourceVendor === 'checkpoint') {
      if (!uploadedFiles.checkpoint_policy) {
        showToast('Please upload Checkpoint Policy CSV', 'error');
        return;
      }
      if (!uploadedFiles.checkpoint_objects && !uploadedFiles.checkpoint_csv_zip) {
        showToast('Please upload Checkpoint Objects (.c) or CSV ZIP', 'error');
        return;
      }
    }

    setIsLoading(true);
    setLoadingText('Analyzing Configuration...');

    const formData = new FormData();
    formData.append('source_vendor', sourceVendor);

    if (sourceVendor === 'checkpoint') {
      if (uploadedFiles.checkpoint_objects) formData.append('checkpoint_objects', uploadedFiles.checkpoint_objects);
      formData.append('checkpoint_policy', uploadedFiles.checkpoint_policy);
      if (uploadedFiles.checkpoint_nat) formData.append('checkpoint_nat', uploadedFiles.checkpoint_nat);
      if (uploadedFiles.checkpoint_config) formData.append('checkpoint_config', uploadedFiles.checkpoint_config);
      if (uploadedFiles.checkpoint_csv_zip) formData.append('checkpoint_csv_zip', uploadedFiles.checkpoint_csv_zip);
    } else {
      formData.append('config_file', uploadedFiles.config_file!);
    }

    try {
      const response = await fetch('/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        const errorMessage = err.error || (typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail)) || 'Analysis failed';
        throw new Error(errorMessage);
      }

      const data = await response.json();

      // Smooth transition: Small delay before revealing results
      setTimeout(() => {
        onAnalysisComplete(data);
        showToast('Analysis complete!', 'success');

        // Smooth scroll to KPI stats section after brief delay
        setTimeout(() => {
          const kpiSection = document.querySelector('.kpi-stats-section');
          if (kpiSection) {
            kpiSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      }, 300);

    } catch (error) {
      console.error('Analysis Error:', error);
      showToast((error as Error).message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!analysisData) return;

    setIsGenerating(true);
    onConversionComplete(null); // Clear previous results
    setIsLoading(true);
    setLoadingText('Generating Blueprint & Optimizing...');

    const formData = new FormData();
    formData.append('source_vendor', sourceVendor);
    formData.append('destination_vendor', destVendor);

    if (sourceVendor === 'checkpoint') {
      if (uploadedFiles.checkpoint_objects) formData.append('checkpoint_objects', uploadedFiles.checkpoint_objects);
      formData.append('checkpoint_policy', uploadedFiles.checkpoint_policy);
      if (uploadedFiles.checkpoint_nat) formData.append('checkpoint_nat', uploadedFiles.checkpoint_nat);
      if (uploadedFiles.checkpoint_config) formData.append('checkpoint_config', uploadedFiles.checkpoint_config);
      if (uploadedFiles.checkpoint_csv_zip) formData.append('checkpoint_csv_zip', uploadedFiles.checkpoint_csv_zip);
    } else {
      formData.append('config_file', uploadedFiles.config_file!);
    }

    formData.append('interface_mapping_data', JSON.stringify(mappingData));
    formData.append('target_layout_data', JSON.stringify(targetLayout || []));
    if (excludeUnused) formData.append('exclude_unused', 'on');

    // Add Generator Options (Security Profiles, etc.)
    formData.append('generator_options', JSON.stringify(generatorOptions));

    try {
      const response = await fetch('/convert', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        const errorMessage = err.error || (typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail)) || 'Conversion failed';
        throw new Error(errorMessage);
      }

      const data = await response.json();

      onConversionComplete(data);
      showToast('Blueprint generated successfully!', 'success');

    } catch (error) {
      console.error('Conversion Error:', error);
      showToast((error as Error).message, 'error');
    } finally {
      setIsGenerating(false);
      setIsLoading(false);
    }
  };

  const handleDownload = async (format: string) => {
    const formData = new FormData();
    formData.append('source_vendor', sourceVendor);
    formData.append('destination_vendor', destVendor);
    formData.append('format', format);

    if (sourceVendor === 'checkpoint') {
      if (uploadedFiles.checkpoint_objects) formData.append('checkpoint_objects', uploadedFiles.checkpoint_objects);
      formData.append('checkpoint_policy', uploadedFiles.checkpoint_policy);
      if (uploadedFiles.checkpoint_nat) formData.append('checkpoint_nat', uploadedFiles.checkpoint_nat);
      if (uploadedFiles.checkpoint_config) formData.append('checkpoint_config', uploadedFiles.checkpoint_config);
      if (uploadedFiles.checkpoint_csv_zip) formData.append('checkpoint_csv_zip', uploadedFiles.checkpoint_csv_zip);
    } else {
      formData.append('config_file', uploadedFiles.config_file!);
    }

    formData.append('interface_mapping_data', JSON.stringify(mappingData));
    formData.append('target_layout_data', JSON.stringify(targetLayout || []));
    if (excludeUnused) formData.append('exclude_unused', 'on');

    Object.keys(generatorOptions).forEach(key => {
      if (generatorOptions[key as keyof GeneratorOptions]) formData.append(key, generatorOptions[key as keyof GeneratorOptions] as string);
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
    } catch (error) {
      showToast((error as Error).message, 'error');
    }
  };

  const handleCopyScript = () => {
    if (conversionResults?.script) {
      navigator.clipboard.writeText(conversionResults.script);
      showToast('Configuration script copied to clipboard');
    }
  };

  // Compute Stats for KPI
  const stats: StatsData = {
    rulesCount: conversionResults?.stats?.rule_count || analysisData?.stats?.rule_count || 0,
    objectsCount: conversionResults?.stats?.object_count || analysisData?.stats?.object_count || 0,
    natCount: conversionResults?.stats?.nat_count || analysisData?.stats?.nat_count || 0,
    routesCount: conversionResults?.stats?.route_count || analysisData?.stats?.route_count || 0,
    objectsUnused: conversionResults?.stats?.warning_count || 0,
    warningsCount: conversionResults?.stats?.warning_count || analysisData?.stats?.warning_count || 0,
    rulesTrend: conversionResults ? 'Conversion Complete' : (analysisData ? 'Analysis Ready' : 'Waiting for analysis')
  };

  const KPIStatsRow = React.lazy(() => import('../common/KPIStatsRow'));
  const FileUploader = React.lazy(() => import('./FileUploader'));
  const SourceViewer = React.lazy(() => import('../SourceViewer'));
  const ConversionParams = React.lazy(() => import('../ConversionParams'));
  const ResultPanel = React.lazy(() => import('../ResultPanel'));

  return (
    <div className="flex flex-col gap-6">

      {/* 1. KPI Stats Row - Always visible, animate when data loads */}
      <div className={`kpi-stats-section transition-all duration-500 ${analysisData ? 'opacity-100 translate-y-0' : 'opacity-100'
        }`}>
        <React.Suspense fallback={<div className="h-32 bg-white/50 rounded-2xl animate-pulse" />}>
          <KPIStatsRow stats={stats} />
        </React.Suspense>
      </div>

      {/* Start Over Button - Only visible when analysis data exists */}
      {analysisData && (
        <div className="flex justify-end">
          <button
            onClick={() => {
              if (window.confirm('Start over? This will clear all current data and reset the conversion.')) {
                // Reset all state
                setUploadedFiles({});
                setMappingData({ interface_mapping: {}, zone_mapping: {} });
                onAnalysisComplete(null);
                onConversionComplete(null);
                showToast('Conversion reset. Ready to start fresh!', 'info');
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white/80 border border-brand-100 text-brand-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 rounded-lg font-medium transition-all shadow-sm backdrop-blur-sm group"
          >
            <RotateCcw className="w-4 h-4 transition-transform group-hover:-rotate-180" />
            Start Over
          </button>
        </div>
      )}

      {/* 2. Main Dashboard Area (Split View) - Always visible, animate when data loads */}
      <div className={`h-[600px] w-full bg-white rounded-xl border border-brand-100 shadow-card overflow-hidden flex flex-col transition-all duration-500 delay-200`}>

        {/* Source Vendor Header (Visible when files are loaded) */}
        {hasFile && (
          <div className="px-4 py-2 border-b border-brand-100 bg-brand-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-gray-500">Source Configuration:</label>
              <select
                value={sourceVendor}
                onChange={(e) => {
                  if (window.confirm("Changing source vendor will reset current file selection. Continue?")) {
                    setSourceVendor(e.target.value as Vendor);
                    setUploadedFiles({ config_file: null, checkpoint_objects: null, checkpoint_policy: null });
                    setFileContent('');
                  }
                }}
                className="text-sm bg-white border border-brand-200 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-brand-200 focus:border-brand-500 font-medium text-gray-700 hover:bg-gray-50 hover:border-brand-300 transition-all outline-none"
              >
                <option value="cisco_asa">Cisco ASA</option>
                <option value="fortinet">Fortinet</option>
                <option value="palo_alto">Palo Alto</option>
                <option value="checkpoint">Check Point</option>
              </select>
            </div>
            <div className="text-[10px] text-gray-400">
              Auto-detected based on file structure
            </div>
          </div>
        )}

        {!showMainInterface ? (
          <div className="min-h-[600px] w-full grid grid-cols-1 lg:grid-cols-2 gap-12 p-8 lg:p-12 items-center relative overflow-hidden">

            {/* Background Decor - Blobs */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-brand-400/10 rounded-full blur-[100px] -z-10 animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-brand-300/5 rounded-full blur-[100px] -z-10" />

            {/* Left Column: Copy & Source Selection */}
            <div className="flex flex-col gap-8 z-10">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/60 border border-brand-200 backdrop-blur-sm w-fit shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-brand-800">New Migration Engine v2.0</span>
                </div>
                <h1 className="text-5xl lg:text-6xl font-bold text-brand-600 leading-tight">
                  Migrate with <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-orange-500">Confidence.</span>
                </h1>
                <p className="text-lg text-gray-600 max-w-md font-medium leading-relaxed">
                  Transform legacy firewall configurations into modern, optimized blueprints.
                  Select your source platform to begin the analysis.
                </p>
              </div>

              {/* Source Selection Pills */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-gray-500 pl-1">Select Source Platform</label>
                <div className="flex flex-wrap gap-3">
                  {(['cisco_asa', 'fortinet', 'palo_alto', 'checkpoint'] as Vendor[]).map(v => (
                    <button
                      key={v}
                      onClick={() => setSourceVendor(v)}
                      className={`
                        px-6 py-3 rounded-full text-sm font-bold capitalize transition-all duration-300 shadow-sm
                        ${sourceVendor === v
                          ? 'bg-brand-500 text-white shadow-brand-lg scale-105 ring-4 ring-brand-100'
                          : 'bg-white text-gray-700 hover:bg-brand-50 hover:text-brand-600 hover:shadow-sm border border-brand-100'
                        }
                      `}
                    >
                      {v.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mini Features */}
              <div className="flex gap-6 pt-4">
                {[
                  { label: 'AI Analysis', icon: Wand2 },
                  { label: 'Auto-Mapping', icon: Network },
                  { label: 'Validation', icon: Shield }
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-gray-600">
                    <div className="p-1.5 rounded-full bg-white/50 border border-brand-200">
                      <f.icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wide">{f.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Visual & Upload Card */}
            <div className="relative flex items-center justify-center perspective-1000">

              {/* Floating Icons Visualization */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-10">
                <div className="absolute top-10 right-20 text-brand-400/20 animate-float" style={{ animationDelay: '0s' }}>
                  <Shield className="w-24 h-24" />
                </div>
                <div className="absolute bottom-20 left-10 text-brand-300/10 animate-float" style={{ animationDelay: '2s' }}>
                  <div className="w-20 h-20 rounded-2xl bg-current rotate-12" />
                </div>
              </div>

              {/* Glass Upload Card */}
              <div className="w-full max-w-md relative group">
                {/* Card Glow */}
                <div className="absolute -inset-1 bg-gradient-to-r from-brand-400 to-brand-600 rounded-3xl opacity-20 group-hover:opacity-30 blur transition duration-500"></div>

                <div className="relative glass-card p-6 lg:p-8 backdrop-blur-xl bg-white/80">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-brand-600">Upload Configuration</h3>
                      <p className="text-xs text-gray-500 font-medium">Supported: .conf, .txt, .xml</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center text-brand-500">
                      <Cloud className="w-5 h-5" />
                    </div>
                  </div>

                  <React.Suspense fallback={<div className="h-32 animate-pulse" />}>
                    <FileUploader
                      sourceVendor={sourceVendor}
                      uploadedFiles={uploadedFiles}
                      setUploadedFiles={setUploadedFiles}
                    />
                  </React.Suspense>

                  {/* Manual Analysis Trigger for Checkpoint */}
                  {sourceVendor === 'checkpoint' &&
                    uploadedFiles.checkpoint_policy &&
                    (uploadedFiles.checkpoint_objects || uploadedFiles.checkpoint_csv_zip) && (
                      <div className="mt-6 flex justify-center animate-fade-in">
                        <button
                          onClick={handleAnalyze}
                          disabled={isLoading}
                          className="group relative cursor-pointer overflow-hidden rounded-xl bg-brand-500 px-8 py-3 text-white shadow-brand transition-all hover:scale-105 hover:shadow-brand-lg active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                          <div className="relative z-10 flex items-center gap-2 font-bold text-sm tracking-wide">
                            {isLoading ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Analyzing...</span>
                              </>
                            ) : (
                              <>
                                <Wand2 className="w-4 h-4" />
                                <span>Start Analysis</span>
                              </>
                            )}
                          </div>
                          {/* Gloss effect */}
                          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                        </button>
                      </div>
                    )}
                </div>
              </div>

            </div>
          </div>
        ) : (
          <PanelGroup direction="horizontal" className="flex-grow">
            <Panel defaultSize={45} minSize={30} className="bg-white/50 backdrop-blur-md">
              <React.Suspense fallback={<div className="h-full flex items-center justify-center text-gray-400">Loading...</div>}>
                <SourceViewer
                  fileName={uploadedFiles.config_file?.name || uploadedFiles.checkpoint_policy?.name || 'Policy File'}
                  content={fileContent}
                  className="h-full border-none rounded-none bg-transparent"
                />
              </React.Suspense>
            </Panel>
            <PanelResizeHandle className="w-1 bg-brand-200 hover:bg-brand-400 transition-colors cursor-col-resize" />
            <Panel defaultSize={55} minSize={30} className="bg-white">
              <React.Suspense fallback={<div className="h-full flex items-center justify-center text-gray-400">Loading...</div>}>
                <ConversionParams
                  destVendor={destVendor}
                  setDestVendor={setDestVendor}
                  analysisData={analysisData}
                  mappingData={mappingData}
                  setMappingData={setMappingData}
                  excludeUnused={excludeUnused}
                  setExcludeUnused={setExcludeUnused}
                  onGenerate={handleGenerate}
                  isGenerating={isGenerating}
                  generatorOptions={generatorOptions}
                  setGeneratorOptions={setGeneratorOptions}
                />
              </React.Suspense>
            </Panel>
          </PanelGroup>
        )}
      </div>

      {/* 3. Result Panel */}
      {
        conversionResults && (
          <React.Suspense fallback={<div className="h-64 bg-white/50 rounded-2xl animate-pulse" />}>
            <ResultPanel
              results={conversionResults}
              onDownload={handleDownload}
              onCopyScript={handleCopyScript}
              sessionId={analysisData?.config_id}
            />
          </React.Suspense>
        )
      }
    </div >
  );
};

export default Step1_Upload;
