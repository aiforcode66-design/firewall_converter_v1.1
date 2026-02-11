import React, { useState, useCallback, Dispatch, SetStateAction } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header.tsx';
import Sidebar from './components/Sidebar.tsx';
import Footer from './components/Footer.tsx';
import { Toast } from './components/common/ToastContainer';
import { Vendor, MappingData, GeneratorOptions } from './types/api';

// Steps - TypeScript components
import Step1_Upload from './components/Step1_Upload/Step1_Upload.tsx';
import Step2_Mapping from './components/Step2_Mapping/Step2_Mapping.tsx';
import Step3_Results from './components/Step3_Results/Step3_Results.tsx';
import Dashboard from './components/Dashboard/Dashboard.tsx';
import HistoryPage from './components/History/HistoryPage.tsx';
import WizardPage from './pages/WizardPage.tsx';

import LoadingOverlay from './components/common/LoadingOverlay.tsx';
import ToastContainer from './components/common/ToastContainer.tsx';

interface UploadedFiles {
  [key: string]: File | null;
}

interface TargetLayoutItem {
  name: string;
  members: string[];
}

// Common state types
type SetState<T> = Dispatch<SetStateAction<T>>;

interface AppContextType {
  isLoading: boolean;
  setIsLoading: SetState<boolean>;
  loadingText: string;
  setLoadingText: SetState<string>;
  toasts: Toast[];
  showToast: (message: string, type?: 'success' | 'error') => void;
  removeToast: (id: number | string) => void;

  // Data
  analysisData: any;
  setAnalysisData: SetState<any>;
  conversionResults: any;
  setConversionResults: SetState<any>;

  // User Inputs
  sourceVendor: Vendor;
  setSourceVendor: SetState<Vendor>;
  destVendor: Vendor;
  setDestVendor: SetState<Vendor>;
  uploadedFiles: UploadedFiles;
  setUpLoadedFiles: SetState<UploadedFiles>;
  mappingData: MappingData;
  setMappingData: SetState<MappingData>;
  targetLayout: TargetLayoutItem[];
  setTargetLayout: SetState<TargetLayoutItem[]>;
  generatorOptions: GeneratorOptions;
  setGeneratorOptions: SetState<GeneratorOptions>;
  excludeUnused: boolean;
  setExcludeUnused: SetState<boolean>;

  // Handlers
  handleReset: () => void;
  handleAnalysisComplete: (data: any) => void;
  handleConversionComplete: (data: any) => void;
}

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Processing...');
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Global State Data
  const [configData, setConfigData] = useState<any>(null);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [conversionResults, setConversionResults] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);

  // User Inputs
  const [sourceVendor, setSourceVendor] = useState<Vendor>('cisco_asa');
  const [destVendor, setDestVendor] = useState<Vendor>('fortinet');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFiles>({});
  const [mappingData, setMappingData] = useState<MappingData>({ interface_mapping: {}, zone_mapping: {} });
  const [targetLayout, setTargetLayout] = useState<TargetLayoutItem[]>([]);
  const [generatorOptions, setGeneratorOptions] = useState<GeneratorOptions>({});
  const [excludeUnused, setExcludeUnused] = useState(false);

  const removeToast = useCallback((id: number | string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  const handleAnalysisComplete = useCallback((data: any) => {
    setAnalysisData(data);
    // Extract session ID from analyze response
    if (data?.config_id) {
      setSessionId(data.config_id);
    }
  }, []);

  const handleConversionComplete = useCallback((data: any) => {
    setConversionResults(data);
  }, []);

  const handleReset = useCallback(() => {
    setUploadedFiles({});
    setMappingData({ interface_mapping: {}, zone_mapping: {} });
    setTargetLayout([]);
    setConversionResults(null);
    setAnalysisData(null);
    setSessionId(undefined);
  }, []);

  return (
    <div className="h-screen flex font-sans overflow-hidden bg-gradient-brand-subtle">
      <LoadingOverlay isVisible={isLoading} text={loadingText} />
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Sidebar Navigation */}
      <Sidebar onReset={handleReset} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        <main className="flex-1 overflow-auto p-6 relative">
          <Routes>
            {/* Dashboard Overview */}
            <Route path="/" element={<Dashboard />} />

            {/* Source Config Upload Workflow */}
            <Route path="/history" element={<HistoryPage />} />

            {/* New Wizard Flow */}
            <Route path="/wizard" element={<WizardPage />} />

            <Route path="/source-config" element={
              <Step1_Upload
                sourceVendor={sourceVendor}
                setSourceVendor={setSourceVendor}
                destVendor={destVendor}
                setDestVendor={setDestVendor}
                uploadedFiles={uploadedFiles}
                setUploadedFiles={setUploadedFiles}
                generatorOptions={generatorOptions}
                setGeneratorOptions={setGeneratorOptions}
                excludeUnused={excludeUnused}
                setExcludeUnused={setExcludeUnused}
                setIsLoading={setIsLoading}
                setLoadingText={setLoadingText}
                isLoading={isLoading}
                onAnalysisComplete={handleAnalysisComplete}
                showToast={showToast}

                // Dashboard Props
                analysisData={analysisData}
                mappingData={mappingData}
                setMappingData={setMappingData}
                conversionResults={conversionResults}
                onConversionComplete={handleConversionComplete}
                targetLayout={targetLayout}
                setTargetLayout={setTargetLayout}
              />
            } />

            <Route path="/mapping" element={
              <Step2_Mapping
                analysisData={analysisData}
                mappingData={mappingData}
                setMappingData={setMappingData}
                targetLayout={targetLayout}
                setTargetLayout={setTargetLayout}
                sourceVendor={sourceVendor}
                destVendor={destVendor}
                uploadedFiles={uploadedFiles}
                generatorOptions={generatorOptions}
                excludeUnused={excludeUnused}
                setIsLoading={setIsLoading}
                setLoadingText={setLoadingText}
                onConversionComplete={handleConversionComplete}
                showToast={showToast}
              />
            } />

            <Route path="/results/*" element={
              <Step3_Results
                results={conversionResults}
                sourceVendor={sourceVendor}
                destVendor={destVendor}
                onReset={handleReset}
                showToast={showToast}
                uploadedFiles={uploadedFiles}
                mappingData={mappingData}
                targetLayout={targetLayout}
                generatorOptions={generatorOptions}
                excludeUnused={excludeUnused}
                sessionId={sessionId}
              />
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <Footer />
      </div>
    </div>
  );
}

export default App;
