import React, { useCallback } from 'react';
import { UploadCloud, FileCode, Table, Network, Route, Cloud, Archive, LucideIcon } from 'lucide-react';
import clsx from 'clsx';

interface UploadedFiles {
  config_file?: File | null;
  checkpoint_objects?: File | null;
  checkpoint_policy?: File | null;
  checkpoint_nat?: File | null;
  checkpoint_config?: File | null;
  checkpoint_csv_zip?: File | null;
}

interface FileUploaderProps {
  sourceVendor: string;
  uploadedFiles: UploadedFiles;
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFiles>>;
}

const FileUploader: React.FC<FileUploaderProps> = ({ sourceVendor, uploadedFiles, setUploadedFiles }) => {

  const handleFileChange = (key: keyof UploadedFiles, file: File | null) => {
    console.log('FileUploader handleFileChange:', { key, file, fileName: file?.name });
    setUploadedFiles(prev => {
      const newState = { ...prev, [key]: file };
      console.log('FileUploader new state:', newState);
      return newState;
    });
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange('config_file', e.dataTransfer.files[0]);
    }
  }, []);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const UploadCard: React.FC<{
    label: string;
    subLabel: string;
    fileKey: keyof UploadedFiles;
    icon: LucideIcon;
    required?: boolean;
  }> = ({ label, subLabel, fileKey, icon: Icon, required = false }) => (
    <div className="p-3 rounded-xl border border-brand-100 bg-white/60 hover:bg-white transition-all hover:shadow-card hover:border-brand-300 group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center text-brand-500 group-hover:scale-110 transition-transform">
            <Icon className="w-5 h-5" />
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">{label}</p>
            <p className={clsx(
              "text-[10px] font-mono truncate max-w-[150px]",
              uploadedFiles[fileKey] ? "text-brand-600 font-bold" : "text-gray-400"
            )}>
              {uploadedFiles[fileKey] ? uploadedFiles[fileKey]!.name : (required ? "Required" : subLabel)}
            </p>
          </div>
        </div>
        <label className="px-3 py-1.5 rounded-lg bg-brand-50 border border-brand-100 hover:bg-brand-100 text-[10px] font-bold text-brand-700 cursor-pointer transition-colors shadow-sm">
          Browse
          <input
            type="file"
            className="hidden"
            onChange={(e) => handleFileChange(fileKey, e.target.files?.[0] || null)}
          />
        </label>
      </div>
    </div>
  );

  if (sourceVendor === 'checkpoint') {
    return (
      <div className="grid grid-cols-1 gap-3 animate-fade-in w-full">
        {/* Required Files */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide px-1">Required Files</p>
          <UploadCard
            label="objects_5_0.c"
            subLabel="(*.c)"
            fileKey="checkpoint_objects"
            icon={FileCode}
            required
          />
          <UploadCard
            label="policy.csv"
            subLabel="(*.csv)"
            fileKey="checkpoint_policy"
            icon={Table}
            required
          />
        </div>

        {/* Optional Files */}
        <div className="space-y-2 pt-1">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide px-1">Optional Files</p>

          {/* nat.csv */}
          <label className="cursor-pointer block">
            <div className="p-2.5 rounded-xl border-2 border-dashed border-brand-200/50 bg-brand-50/20 hover:bg-brand-50/50 hover:border-brand-400/50 transition-all flex items-center justify-between gap-3 group">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-50/50 flex items-center justify-center text-brand-400 group-hover:text-brand-500 transition-colors">
                  <Network className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="block text-[10px] font-bold text-brand-800 uppercase">nat.csv</span>
                  <span className={clsx(
                    "block text-[9px] truncate max-w-[150px]",
                    uploadedFiles.checkpoint_nat ? "text-brand-600 font-bold" : "text-brand-600/50"
                  )}>
                    {uploadedFiles.checkpoint_nat ? uploadedFiles.checkpoint_nat.name : "NAT rules (optional)"}
                  </span>
                </div>
              </div>
              <input type="file" accept=".csv" className="hidden" onChange={(e) => handleFileChange('checkpoint_nat', e.target.files?.[0] || null)} />
              <span className="px-2 py-1 rounded-md bg-white border border-brand-100 text-[9px] text-brand-700 font-bold shadow-sm">Browse</span>
            </div>
          </label>

          {/* show configuration.txt */}
          <label className="cursor-pointer block">
            <div className="p-2.5 rounded-xl border-2 border-dashed border-brand-200/50 bg-brand-50/20 hover:bg-brand-50/50 hover:border-brand-400/50 transition-all flex items-center justify-between gap-3 group">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-50/50 flex items-center justify-center text-brand-400 group-hover:text-brand-500 transition-colors">
                  <Route className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="block text-[10px] font-bold text-brand-800 uppercase">show configuration.txt</span>
                  <span className={clsx(
                    "block text-[9px] truncate max-w-[150px]",
                    uploadedFiles.checkpoint_config ? "text-brand-600 font-bold" : "text-brand-600/50"
                  )}>
                    {uploadedFiles.checkpoint_config ? uploadedFiles.checkpoint_config.name : "Routing config (optional)"}
                  </span>
                </div>
              </div>
              <input type="file" accept=".txt" className="hidden" onChange={(e) => handleFileChange('checkpoint_config', e.target.files?.[0] || null)} />
              <span className="px-2 py-1 rounded-md bg-white border border-brand-100 text-[9px] text-brand-700 font-bold shadow-sm">Browse</span>
            </div>
          </label>

          {/* objects.zip */}
          <label className="cursor-pointer block">
            <div className="p-2.5 rounded-xl border-2 border-dashed border-brand-200/50 bg-brand-50/20 hover:bg-brand-50/50 hover:border-brand-400/50 transition-all flex items-center justify-between gap-3 group">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-50/50 flex items-center justify-center text-brand-400 group-hover:text-brand-500 transition-colors">
                  <Archive className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="block text-[10px] font-bold text-brand-800 uppercase">objects.zip</span>
                  <span className={clsx(
                    "block text-[9px] truncate max-w-[150px]",
                    uploadedFiles.checkpoint_csv_zip ? "text-brand-600 font-bold" : "text-brand-600/50"
                  )}>
                    {uploadedFiles.checkpoint_csv_zip ? uploadedFiles.checkpoint_csv_zip.name : "Supplemental objects (optional)"}
                  </span>
                </div>
              </div>
              <input type="file" accept=".zip" className="hidden" onChange={(e) => handleFileChange('checkpoint_csv_zip', e.target.files?.[0] || null)} />
              <span className="px-2 py-1 rounded-md bg-white border border-brand-100 text-[9px] text-brand-700 font-bold shadow-sm">Browse</span>
            </div>
          </label>
        </div>
      </div>
    );
  }

  // Default Single File Upload
  return (
    <div className="group/drop animate-fade-in h-52 w-full">
      <div
        className={clsx(
          "relative h-full rounded-2xl p-6 transition-all duration-300 cursor-pointer text-center flex flex-col items-center justify-center border-2 border-dashed",
          uploadedFiles.config_file
            ? "bg-brand-50/50 border-brand-500 shadow-inner"
            : "bg-white/40 border-brand-200/60 hover:border-brand-400 hover:bg-brand-50/30 hover:shadow-brand"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <input
          type="file"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          onChange={(e) => handleFileChange('config_file', e.target.files?.[0] || null)}
        />
        <div className="space-y-3 pointer-events-none relative z-0">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto text-brand-500 shadow-card group-hover/drop:scale-110 group-hover/drop:text-brand-600 transition-all duration-500">
            <Cloud className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm text-gray-900 font-bold">
              {uploadedFiles.config_file ? "File Selected" : "Click to upload config"}
            </p>
            {!uploadedFiles.config_file && (
              <p className="text-xs text-gray-500 mt-1 font-medium">or drag & drop here</p>
            )}
            <p className={clsx(
              "text-[10px] font-mono mt-3 transition-all",
              uploadedFiles.config_file ? "text-brand-600 font-bold bg-brand-100/50 py-1.5 px-3 rounded-lg inline-block shadow-sm" : "text-gray-400"
            )}>
              {uploadedFiles.config_file ? uploadedFiles.config_file.name : ".txt, .conf, .log"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileUploader;
