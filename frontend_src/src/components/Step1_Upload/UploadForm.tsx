import React from 'react';
import { Server, Target, ChevronDown, ArrowRight } from 'lucide-react';
import { Vendor } from '../../types/api';
import FileUploader from './FileUploader';

interface UploadedFiles {
  config_file?: File | null;
  checkpoint_objects?: File | null;
  checkpoint_policy?: File | null;
  checkpoint_nat?: File | null;
  checkpoint_config?: File | null;
  checkpoint_csv_zip?: File | null;
}

interface UploadFormProps {
  sourceVendor: Vendor;
  setSourceVendor: (vendor: Vendor) => void;
  destVendor: Vendor;
  setDestVendor: (vendor: Vendor) => void;
  uploadedFiles: UploadedFiles;
  setUploadedFiles: (files: UploadedFiles) => void;
  onAnalyze: () => void;
}

const UploadForm: React.FC<UploadFormProps> = ({
  sourceVendor,
  setSourceVendor,
  destVendor,
  setDestVendor,
  uploadedFiles,
  setUploadedFiles,
  onAnalyze
}) => {

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAnalyze();
  };

  return (
    <div className="glass-panel p-6 rounded-2xl border border-glass-border shadow-2xl relative overflow-hidden animate-slide-up bg-[#1e293b]/40 backdrop-blur-md">
      {/* Decorative Top Line */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-indigo-500 via-purple-500 to-transparent"></div>

      <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
        <span className="bg-indigo-500/10 text-indigo-400 w-8 h-8 rounded-full flex items-center justify-center text-sm border border-indigo-500/20 shadow-inner">1</span>
        Source & Destination
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Source Vendor */}
          <div className="group">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">From (Source)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Server className="text-slate-500 w-3 h-3 group-focus-within:text-indigo-400 transition-colors" />
              </div>
              <select
                className="glass-input w-full rounded-xl py-2.5 pl-9 pr-4 text-white text-sm appearance-none cursor-pointer"
                value={sourceVendor}
                onChange={(e) => setSourceVendor(e.target.value as Vendor)}
              >
                <option value="cisco_asa">Cisco ASA</option>
                <option value="checkpoint">Check Point</option>
                <option value="fortinet">Fortinet</option>
                <option value="palo_alto">Palo Alto</option>
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <ChevronDown className="w-3 h-3 text-slate-500" />
              </div>
            </div>
          </div>

          {/* Target Vendor */}
          <div className="group">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">To (Target)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Target className="text-slate-500 w-3 h-3 group-focus-within:text-purple-400 transition-colors" />
              </div>
              <select
                className="glass-input w-full rounded-xl py-2.5 pl-9 pr-4 text-white text-sm appearance-none cursor-pointer"
                value={destVendor}
                onChange={(e) => setDestVendor(e.target.value as Vendor)}
              >
                <option value="fortinet">Fortinet</option>
                <option value="checkpoint">Check Point</option>
                <option value="palo_alto">Palo Alto</option>
                <option value="cisco_asa">Cisco ASA</option>
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <ChevronDown className="w-3 h-3 text-slate-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        <div className="pt-1">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Configuration Files</label>
          <FileUploader
            sourceVendor={sourceVendor}
            uploadedFiles={uploadedFiles}
            setUploadedFiles={setUploadedFiles}
          />
        </div>

        <button
          type="submit"
          className="w-full group relative flex justify-center py-3.5 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-lg shadow-indigo-500/30 transition-all duration-300 overflow-hidden transform hover:-translate-y-0.5"
        >
          <span className="relative z-10 flex items-center gap-2 text-sm">
            Proceed to Mapping <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </span>
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
        </button>
      </form>
    </div>
  );
};

export default UploadForm;
