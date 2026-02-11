import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConsolidatedWizard from './ConsolidatedWizard';
import { ArrowLeft, Wand2 } from 'lucide-react';
import { AnalyzeConfigResponse, MappingData, GeneratorOptions, TargetLayoutItem, ConversionResults } from '../../types/api';

interface UploadedFiles {
  config_file?: File | null;
  checkpoint_objects?: File | null;
  checkpoint_policy?: File | null;
  checkpoint_nat?: File | null;
  checkpoint_config?: File | null;
  checkpoint_csv_zip?: File | null;
}

interface Step2MappingProps {
  analysisData: AnalyzeConfigResponse | null;
  mappingData: MappingData;
  setMappingData: React.Dispatch<React.SetStateAction<MappingData>>;
  targetLayout: TargetLayoutItem[];
  setTargetLayout: React.Dispatch<React.SetStateAction<TargetLayoutItem[]>>;
  sourceVendor: string;
  destVendor: string;
  uploadedFiles: UploadedFiles;
  generatorOptions: GeneratorOptions;
  excludeUnused: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setLoadingText: React.Dispatch<React.SetStateAction<string>>;
  onConversionComplete: (data: ConversionResults | null) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

const Step2_Mapping: React.FC<Step2MappingProps> = ({
  analysisData,
  mappingData,
  setMappingData,
  targetLayout,
  setTargetLayout,
  sourceVendor,
  destVendor,
  uploadedFiles,
  generatorOptions,
  excludeUnused,
  setIsLoading,
  setLoadingText,
  onConversionComplete,
  showToast
}) => {
  const navigate = useNavigate();
  const [targetIpConfig, setTargetIpConfig] = useState<Record<string, any>>({});

  const handleConvert = async () => {
    setIsLoading(true);
    setLoadingText('Generating final configuration...');

    const formData = new FormData();
    formData.append('source_vendor', sourceVendor);
    formData.append('destination_vendor', destVendor);

    // Append Files (Re-append because FormData is not persistent)
    if (sourceVendor === 'checkpoint') {
      if (uploadedFiles.checkpoint_objects) formData.append('checkpoint_objects', uploadedFiles.checkpoint_objects);
      formData.append('checkpoint_policy', uploadedFiles.checkpoint_policy);
      if (uploadedFiles.checkpoint_nat) formData.append('checkpoint_nat', uploadedFiles.checkpoint_nat);
      if (uploadedFiles.checkpoint_config) formData.append('checkpoint_config', uploadedFiles.checkpoint_config);
      if (uploadedFiles.checkpoint_csv_zip) formData.append('checkpoint_csv_zip', uploadedFiles.checkpoint_csv_zip);
    } else if (uploadedFiles.config_file) {
      formData.append('config_file', uploadedFiles.config_file);
    }

    // Append Mapping Data
    console.log('='.repeat(60));
    console.log('[FRONTEND DEBUG] === CONVERSION REQUEST ===');
    console.log('[FRONTEND DEBUG] mappingData:', JSON.stringify(mappingData, null, 2));
    console.log('[FRONTEND DEBUG] interface_mapping entries:', Object.keys(mappingData.interface_mapping || {}).length);
    console.log('[FRONTEND DEBUG] zone_mapping entries:', Object.keys(mappingData.zone_mapping || {}).length);

    if (Object.keys(mappingData.interface_mapping || {}).length === 0 &&
      Object.keys(mappingData.zone_mapping || {}).length === 0) {
      console.warn('[FRONTEND DEBUG] âš ï¸ WARNING: No mappings provided! All interfaces will keep original names.');
    }

    console.log('='.repeat(60));
    formData.append('interface_mapping_data', JSON.stringify(mappingData));
    formData.append('target_layout_data', JSON.stringify(targetLayout));

    // Append IP Config
    if (Object.keys(targetIpConfig).length > 0) {
      formData.append('target_ip_config', JSON.stringify(targetIpConfig));
    }

    // Append Options
    if (excludeUnused) {
      formData.append('exclude_unused', 'on');
    }

    Object.keys(generatorOptions).forEach(key => {
      if (generatorOptions[key as keyof GeneratorOptions]) {
        formData.append(key, generatorOptions[key as keyof GeneratorOptions] as string);
      }
    });

    try {
      const response = await fetch('/convert', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Conversion failed');
      }

      onConversionComplete(data);
      showToast('Conversion successful!');
      navigate('/');
    } catch (error) {
      showToast((error as Error).message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col justify-center transition-all duration-500 ease-in-out">
      <div className="max-w-[1400px] mx-auto w-full flex flex-col gap-6 h-full max-h-[95vh] p-4 lg:p-8">

        {/* Main Wizard */}
        <ConsolidatedWizard
          analysisData={analysisData}
          mappingData={mappingData}
          setMappingData={setMappingData}
          targetLayout={targetLayout}
          setTargetLayout={setTargetLayout}
          targetIpConfig={targetIpConfig}
          setTargetIpConfig={setTargetIpConfig}
        />

        {/* Floating Action Bar / Footer */}
        <div className="flex-none pt-2 flex justify-between items-center bg-white/80 backdrop-blur-xl p-4 rounded-2xl border border-brand-100 shadow-card">
          <button
            className="px-6 py-3 rounded-xl border border-brand-200 text-brand-600 hover:bg-brand-50 transition-colors font-bold text-sm flex items-center"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Upload
          </button>

          <div className="flex items-center gap-6">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:block">
              Review all steps above before converting.
            </div>
            <button
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 hover:shadow-brand-lg text-white font-bold text-sm shadow-brand transition-all transform active:scale-95 flex items-center"
              onClick={handleConvert}
            >
              Start Conversion Engine <Wand2 className="w-4 h-4 ml-2" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step2_Mapping;
