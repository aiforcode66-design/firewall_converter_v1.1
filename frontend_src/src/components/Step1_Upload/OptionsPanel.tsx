import React from 'react';
import { Shield, Layers, Fingerprint, Bug, Globe, FileWarning, Lock } from 'lucide-react';
import clsx from 'clsx';
import { GeneratorOptions } from '../../types/api';

interface OptionsPanelProps {
  destVendor: string;
  generatorOptions: GeneratorOptions;
  setGeneratorOptions: React.Dispatch<React.SetStateAction<GeneratorOptions>>;
}

const OptionsPanel: React.FC<OptionsPanelProps> = ({ destVendor, generatorOptions, setGeneratorOptions }) => {

  const handleOptionChange = (key: keyof GeneratorOptions, value: string) => {
    setGeneratorOptions(prev => ({ ...prev, [key]: value }));
  };

  if (destVendor === 'fortinet') {
    return (
      <div className="option-panel active-panel glass-panel p-5 rounded-2xl border border-brand-100 shadow-xl bg-white/90 backdrop-blur-md animate-slide-up">
        <div className="flex items-center gap-3 mb-4 border-b border-brand-100 pb-3">
          <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">FortiGate Profiles</h3>
            <p className="text-[10px] text-gray-500">Map security profiles to target policies</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">NAT Configuration</label>
            <div className="relative">
              <select
                className="input-field w-full rounded-lg py-2 px-3 text-sm appearance-none cursor-pointer"
                value={generatorOptions.fortinet_nat_mode || 'policy'}
                onChange={(e) => handleOptionChange('fortinet_nat_mode', e.target.value)}
              >
                <option value="policy">Policy-based NAT (Merge Rules)</option>
                <option value="central">Central NAT (Separate Table)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            <div className="relative group">
              <Fingerprint className="absolute left-3 top-2.5 text-gray-400 w-3 h-3 group-focus-within:text-brand-500 transition-colors" />
              <input
                type="text"
                placeholder="IPS Sensor Name"
                className="input-field w-full rounded-lg py-2 pl-9 pr-3 text-sm placeholder-gray-400"
                value={generatorOptions.fortinet_ips || ''}
                onChange={(e) => handleOptionChange('fortinet_ips', e.target.value)}
              />
            </div>
            <div className="relative group">
              <Bug className="absolute left-3 top-2.5 text-gray-400 w-3 h-3 group-focus-within:text-brand-500 transition-colors" />
              <input
                type="text"
                placeholder="AntiVirus Profile"
                className="input-field w-full rounded-lg py-2 pl-9 pr-3 text-sm placeholder-gray-400"
                value={generatorOptions.fortinet_av || ''}
                onChange={(e) => handleOptionChange('fortinet_av', e.target.value)}
              />
            </div>
            <div className="relative group">
              <Globe className="absolute left-3 top-2.5 text-gray-400 w-3 h-3 group-focus-within:text-brand-500 transition-colors" />
              <input
                type="text"
                placeholder="Web Filter Profile"
                className="input-field w-full rounded-lg py-2 pl-9 pr-3 text-sm placeholder-gray-400"
                value={generatorOptions.fortinet_web || ''}
                onChange={(e) => handleOptionChange('fortinet_web', e.target.value)}
              />
            </div>
            <div className="relative group">
              <FileWarning className="absolute left-3 top-2.5 text-gray-400 w-3 h-3 group-focus-within:text-brand-500 transition-colors" />
              <input
                type="text"
                placeholder="File Filter Profile"
                className="input-field w-full rounded-lg py-2 pl-9 pr-3 text-sm placeholder-gray-400"
                value={generatorOptions.fortinet_file || ''}
                onChange={(e) => handleOptionChange('fortinet_file', e.target.value)}
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 text-gray-400 w-3 h-3" />
              <select
                className="input-field w-full rounded-lg py-2 pl-9 pr-3 text-sm appearance-none cursor-pointer"
                value={generatorOptions.fortinet_ssl || ''}
                onChange={(e) => handleOptionChange('fortinet_ssl', e.target.value)}
              >
                <option value="" disabled>Select SSL Inspection...</option>
                <option value="certificate-inspection">Certificate Inspection</option>
                <option value="no-inspection">No Inspection</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (destVendor === 'palo_alto') {
    return (
      <div className="option-panel active-panel glass-panel p-5 rounded-2xl border border-brand-100 shadow-xl bg-white/90 backdrop-blur-md animate-slide-up">
        <div className="flex items-center gap-3 mb-4 border-b border-brand-100 pb-3">
          <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">Palo Alto Profiles</h3>
            <p className="text-[10px] text-gray-500">Configure profiles & Panorama settings</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Deployment Mode</label>
            <div className="relative">
              <select
                className="input-field w-full rounded-lg py-2 px-3 text-sm appearance-none cursor-pointer"
                value={generatorOptions.pa_output_mode || 'firewall'}
                onChange={(e) => handleOptionChange('pa_output_mode', e.target.value)}
              >
                <option value="firewall">Firewall (Standalone)</option>
                <option value="panorama">Panorama (Device Group)</option>
              </select>
            </div>
          </div>

          {generatorOptions.pa_output_mode === 'panorama' && (
            <div className="space-y-2 p-3 bg-gray-50 rounded-lg border border-brand-100 animate-fade-in">
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Device Group</label>
                <input
                  type="text"
                  className="input-field w-full rounded px-2 py-1.5 text-sm"
                  value={generatorOptions.pa_device_group || 'MyDeviceGroup'}
                  onChange={(e) => handleOptionChange('pa_device_group', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Template</label>
                <input
                  type="text"
                  className="input-field w-full rounded px-2 py-1.5 text-sm"
                  value={generatorOptions.pa_template || 'MyTemplate'}
                  onChange={(e) => handleOptionChange('pa_template', e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <input type="text" placeholder="AV Profile" className="input-field w-full rounded-lg py-2 px-3 text-sm placeholder-gray-400" onChange={(e) => handleOptionChange('pa_av_profile', e.target.value)} />
            <input type="text" placeholder="Anti-Spyware" className="input-field w-full rounded-lg py-2 px-3 text-sm placeholder-gray-400" onChange={(e) => handleOptionChange('pa_as_profile', e.target.value)} />
            <input type="text" placeholder="Vuln Protect" className="input-field w-full rounded-lg py-2 px-3 text-sm placeholder-gray-400" onChange={(e) => handleOptionChange('pa_vp_profile', e.target.value)} />
            <input type="text" placeholder="URL Filtering" className="input-field w-full rounded-lg py-2 px-3 text-sm placeholder-gray-400" onChange={(e) => handleOptionChange('pa_url_profile', e.target.value)} />
            <input type="text" placeholder="Wildfire" className="input-field w-full rounded-lg py-2 px-3 text-sm placeholder-gray-400" onChange={(e) => handleOptionChange('pa_wf_profile', e.target.value)} />
            <input type="text" placeholder="File Blocking" className="input-field w-full rounded-lg py-2 px-3 text-sm placeholder-gray-400" onChange={(e) => handleOptionChange('pa_fb_profile', e.target.value)} />
            <input type="text" placeholder="Log Forwarding" className="input-field w-full rounded-lg py-2 px-3 text-sm placeholder-gray-400 col-span-2" onChange={(e) => handleOptionChange('pa_log_profile', e.target.value)} />
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default OptionsPanel;
