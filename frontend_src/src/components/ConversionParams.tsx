import React, { Dispatch, SetStateAction } from 'react';
import { Settings, ArrowRight, CheckCircle, Loader2, Shield, Layers, Globe, Server, Box, Network, ShieldCheck, LucideIcon } from 'lucide-react';
import { AnalyzeConfigResponse, MappingData, GeneratorOptions } from '../../types/api';

/* --- INTERNAL UI COMPONENTS --- */

interface SplitSelectorOption {
  label: string;
  value: string;
  icon: LucideIcon;
}

interface SplitSelectorProps {
  options: SplitSelectorOption[];
  value: string;
  onChange: (value: string) => void;
}

const SplitSelector: React.FC<SplitSelectorProps> = ({ options, value, onChange }) => {
  return (
    <div className="flex p-1 bg-gray-100/50 rounded-xl border border-brand-100">
      {options.map((opt) => {
        const isSelected = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`
              flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all duration-300
              ${isSelected
                ? "bg-white text-brand-500 shadow-sm shadow-brand/20 ring-1 ring-brand-200"
                : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
              }
            `}
          >
            <opt.icon className={`w-4 h-4 ${isSelected ? "text-brand-500" : "text-gray-400"}`} />
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
};

interface ToggleSwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ label, checked, onChange }) => (
  <div
    onClick={() => onChange(!checked)}
    className={`
      flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all duration-300 group
      ${checked
        ? "bg-brand-50 border-brand-300 shadow-brand"
        : "bg-white border-gray-200 hover:border-brand-200 hover:bg-gray-50/50"
      }
    `}
  >
    <div className="flex flex-col">
      <span className={`text-[11px] font-bold ${checked ? "text-brand-700" : "text-gray-600"}`}>{label}</span>
      <span className="text-[9px] text-gray-400">
        {checked ? "Enabled" : "Disabled"}
      </span>
    </div>
    <div className={`
      w-9 h-5 rounded-full flex items-center transition-colors duration-300 px-0.5
      ${checked ? "bg-brand-500" : "bg-gray-200"}
    `}>
      <div className={`
        w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300
        ${checked ? "translate-x-4" : "translate-x-0"}
      `} />
    </div>
  </div>
);

interface ProfileChipProps {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const ProfileChip: React.FC<ProfileChipProps> = ({ label, value, onChange, placeholder = "default" }) => {
  const isActive = !!value;

  const handleToggle = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    onChange(isActive ? "" : placeholder);
  };

  return (
    <div
      onClick={handleToggle}
      className={`
        relative flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all duration-300 select-none
        ${isActive
          ? "bg-brand-500 border-brand-600 text-white shadow-brand"
          : "bg-white border-gray-200 text-gray-500 hover:border-brand-200 hover:bg-gray-50"
        }
      `}
    >
      <div className={`
        w-4 h-4 rounded-full flex items-center justify-center border transition-colors
        ${isActive ? "bg-white/20 border-white/40" : "bg-gray-100 border-gray-300"}
      `}>
        <Shield className={`w-2.5 h-2.5 ${isActive ? "text-white" : "text-gray-400"}`} />
      </div>

      <div className="flex-1 min-w-0">
        {isActive ? (
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-white/90 mb-0.5 tracking-wide opacity-90">{label}</span>
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-full bg-transparent border-none outline-none ring-0 p-0 text-xs font-bold text-white placeholder-white/50"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        ) : (
          <span className="text-xs font-medium">{label}</span>
        )}
      </div>

      {isActive && <CheckCircle className="w-3.5 h-3.5 text-white" />}
    </div>
  );
};

interface VendorCardProps {
  id: string;
  current: string;
  onClick: (id: string) => void;
  title: string;
  icon: LucideIcon;
  colorClass: string;
}

const VendorCard: React.FC<VendorCardProps> = ({ id, current, onClick, title, icon: Icon, colorClass }) => {
  const isSelected = current === id;
  return (
    <button
      onClick={() => onClick(id)}
      className={`
        relative flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all duration-200 w-full
        ${isSelected
          ? `border-2 border-brand-500 bg-brand-50 shadow-brand scale-[1.02]`
          : "border-brand-100 bg-white/50 hover:border-brand-200 hover:bg-white"
        }
      `}
    >
      <div className={`mb-2 p-2 rounded-full bg-white shadow-sm border border-brand-50`}>
        <Icon className={`w-5 h-5 ${isSelected ? "text-brand-500" : "text-gray-400"}`} />
      </div>
      <span className={`text-[10px] font-bold ${isSelected ? "text-brand-700" : "text-gray-500"}`}>
        {title}
      </span>
      {isSelected && (
        <div className="absolute top-1.5 right-1.5">
          <CheckCircle className="w-3 h-3 text-brand-500" />
        </div>
      )}
    </button>
  );
};

interface ModernInputProps {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const ModernInput: React.FC<ModernInputProps> = ({ label, value, onChange, placeholder, disabled = false, className = "" }) => (
  <div className={className}>
    <label className="block text-[10px] font-bold text-gray-600 mb-1 ml-1 tracking-wide">
      {label}
    </label>
    <input
      type="text"
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      className={`
        w-full text-xs px-3 py-2 rounded-lg border bg-white/50 backdrop-blur-sm transition-all duration-200
        focus:ring-2 focus:bg-white
        ${disabled
          ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
          : "border-brand-200 hover:border-brand-400 focus:border-brand-500 focus:ring-brand-200 text-gray-900"
        }
      `}
    />
  </div>
);

interface ConversionParamsProps {
  destVendor: string;
  setDestVendor: Dispatch<SetStateAction<string>>;
  analysisData: AnalyzeConfigResponse | null;
  mappingData: MappingData;
  setMappingData: Dispatch<SetStateAction<MappingData>>;
  excludeUnused: boolean;
  setExcludeUnused: Dispatch<SetStateAction<boolean>>;
  onGenerate: () => void;
  isGenerating: boolean;
  generatorOptions?: GeneratorOptions;
  setGeneratorOptions?: Dispatch<SetStateAction<GeneratorOptions>>;
}

const ConversionParams: React.FC<ConversionParamsProps> = ({
  destVendor,
  setDestVendor,
  analysisData,
  mappingData,
  setMappingData,
  excludeUnused,
  setExcludeUnused,
  onGenerate,
  isGenerating,
  generatorOptions = {},
  setGeneratorOptions = () => { }
}) => {

  const handleInterfaceChange = (sourceIf: string, targetIf: string) => {
    setMappingData(prev => ({
      ...prev,
      interface_mapping: { ...prev.interface_mapping, [sourceIf]: targetIf }
    }));
  };

  const handleZoneChange = (sourceIf: string, targetZone: string) => {
    setMappingData(prev => ({
      ...prev,
      zone_mapping: { ...prev.zone_mapping, [sourceIf]: targetZone }
    }));
  };

  const handleOptionChange = (key: keyof GeneratorOptions, value: string) => {
    setGeneratorOptions(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const interfaces = analysisData?.interfaces || [];

  return (
    <div className="flex flex-col h-full bg-white/80 backdrop-blur-md border border-brand-100 rounded-xl shadow-card overflow-hidden">
      {/* COMPACT HEADER */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-brand-100 bg-white/90 backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-brand-100 rounded-md">
            <Settings className="w-3.5 h-3.5 text-brand-500" />
          </div>
          <h3 className="text-xs font-bold text-gray-900 tracking-tight">Configuration Parameters</h3>
        </div>
        <button
          onClick={() => setGeneratorOptions({})}
          className="text-[10px] px-2.5 py-1 rounded-full bg-brand-50 hover:bg-brand-100 text-brand-700 font-medium transition-colors border border-transparent hover:border-brand-200"
        >
          Reset Defaults
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">

        {/* SECTION 1: TARGET PLATFORM */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-0.5 h-3 rounded-full bg-brand-500"></div>
            <h4 className="text-[10px] font-extrabold text-gray-900 uppercase tracking-widest">Target Environment</h4>
          </div>

          <div className="bg-white rounded-xl p-1 border border-brand-100 shadow-sm mb-4">
            <div className="grid grid-cols-4 gap-2 p-1">
              <VendorCard
                id="palo_alto"
                title="Palo Alto"
                current={destVendor}
                onClick={setDestVendor}
                icon={Layers}
                colorClass="brand"
              />
              <VendorCard
                id="fortinet"
                title="Fortinet"
                current={destVendor}
                onClick={setDestVendor}
                icon={Box}
                colorClass="orange"
              />
              <VendorCard
                id="checkpoint"
                title="Checkpoint"
                current={destVendor}
                onClick={setDestVendor}
                icon={ShieldCheck}
                colorClass="red"
              />
              <VendorCard
                id="cisco_asa"
                title="Cisco ASA"
                current={destVendor}
                onClick={setDestVendor}
                icon={Server}
                colorClass="gray"
              />
            </div>
          </div>

          <div className="px-1">
            <ModernInput
              label="Target OS Version"
              value="Latest Stable (Recommended)"
              disabled={true}
              onChange={() => { }}
            />
          </div>

          {/* DYNAMIC SETTINGS BASED ON VENDOR */}
          <div className="mt-4 space-y-3">

            {/* --- PALO ALTO SETTINGS --- */}
            {destVendor === 'palo_alto' && (
              <div className="animate-fade-in-up space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-700 mb-2 ml-1">Management Mode</label>
                  <SplitSelector
                    options={[
                      { label: "Standalone Firewall", value: "firewall", icon: Server },
                      { label: "Panorama", value: "panorama", icon: Globe }
                    ]}
                    value={generatorOptions.pa_output_mode || 'firewall'}
                    onChange={(val) => {
                      handleOptionChange('pa_output_mode', val);
                      if (val === 'panorama') {
                        if (!generatorOptions.pa_device_group) handleOptionChange('pa_device_group', 'MyDeviceGroup');
                        if (!generatorOptions.pa_template) handleOptionChange('pa_template', 'MyTemplate');
                      }
                    }}
                  />
                </div>

                {generatorOptions.pa_output_mode === 'panorama' && (
                  <div className="p-4 bg-brand-50 rounded-lg border border-brand-100 grid grid-cols-1 gap-3 animate-fade-in">
                    <ModernInput
                      label="Device Group"
                      placeholder="MyDeviceGroup"
                      value={generatorOptions.pa_device_group || 'MyDeviceGroup'}
                      onChange={(e) => handleOptionChange('pa_device_group', e.target.value)}
                    />
                    <ModernInput
                      label="Template Name"
                      placeholder="MyTemplate"
                      value={generatorOptions.pa_template || 'MyTemplate'}
                      onChange={(e) => handleOptionChange('pa_template', e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* --- FORTINET SETTINGS --- */}
            {destVendor === 'fortinet' && (
              <div className="animate-fade-in-up">
                <label className="block text-[10px] font-bold text-gray-700 mb-2 ml-1">NAT Configuration</label>
                <div className="grid grid-cols-2 gap-3">
                  <ToggleSwitch
                    label="Policy Based NAT"
                    checked={(generatorOptions.fortinet_nat_mode || 'policy') === 'policy'}
                    onChange={() => handleOptionChange('fortinet_nat_mode', 'policy')}
                  />
                  <ToggleSwitch
                    label="Central SNAT Table"
                    checked={generatorOptions.fortinet_nat_mode === 'central'}
                    onChange={() => handleOptionChange('fortinet_nat_mode', 'central')}
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* SECTION 2: SECURITY PROFILES */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-0.5 h-3 rounded-full bg-orange-500"></div>
            <h4 className="text-[10px] font-extrabold text-gray-900 uppercase tracking-widest">Security Profiles</h4>
          </div>

          <div className="bg-white/60 p-4 rounded-xl border border-brand-100 shadow-sm">

            {destVendor === 'palo_alto' && (
              <div className="grid grid-cols-2 gap-2">
                <ProfileChip label="Antivirus" value={generatorOptions.pa_av_profile} onChange={(v) => handleOptionChange('pa_av_profile', v)} />
                <ProfileChip label="Anti-Spyware" value={generatorOptions.pa_as_profile} placeholder="strict" onChange={(v) => handleOptionChange('pa_as_profile', v)} />
                <ProfileChip label="Vulnerability" value={generatorOptions.pa_vp_profile} placeholder="strict" onChange={(v) => handleOptionChange('pa_vp_profile', v)} />
                <ProfileChip label="URL Filtering" value={generatorOptions.pa_url_profile} onChange={(v) => handleOptionChange('pa_url_profile', v)} />
                <ProfileChip label="File Blocking" value={generatorOptions.pa_fb_profile} placeholder="strict-file" onChange={(v) => handleOptionChange('pa_fb_profile', v)} />
                <ProfileChip label="Log Fwd" value={generatorOptions.pa_log_profile} onChange={(v) => handleOptionChange('pa_log_profile', v)} />
              </div>
            )}

            {destVendor === 'fortinet' && (
              <div className="grid grid-cols-2 gap-2">
                <ProfileChip label="IPS Sensor" value={generatorOptions.fortinet_ips} onChange={(v) => handleOptionChange('fortinet_ips', v)} />
                <ProfileChip label="Antivirus" value={generatorOptions.fortinet_av} onChange={(v) => handleOptionChange('fortinet_av', v)} />
                <ProfileChip label="Web Filter" value={generatorOptions.fortinet_web} onChange={(v) => handleOptionChange('fortinet_web', v)} />
                <ProfileChip label="File Filter" value={generatorOptions.fortinet_file} onChange={(v) => handleOptionChange('fortinet_file', v)} />
                <ProfileChip label="SSL/SSH" value={generatorOptions.fortinet_ssl} placeholder="cert-inspect" onChange={(v) => handleOptionChange('fortinet_ssl', v)} />
              </div>
            )}

            {(destVendor === 'cisco_asa' || destVendor === 'checkpoint') && (
              <div className="flex items-center justify-center p-6 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                <span className="text-[10px] text-gray-400 italic font-medium">No extended security profiles available.</span>
              </div>
            )}
          </div>
        </section>

        {/* SECTION 3: INTERFACE & ZONE MAPPING */}
        <section className="space-y-6">
          {/* Interface Mapping */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-0.5 h-3 rounded-full bg-brand-400"></div>
              <h4 className="text-[10px] font-extrabold text-gray-900 uppercase tracking-widest">Interface Mapping</h4>
            </div>

            <div className="bg-white/40 backdrop-blur-md rounded-2xl border border-brand-100 shadow-sm overflow-hidden p-1">
              {interfaces.length > 0 ? (
                <table className="w-full text-left border-collapse">
                  <thead className="border-b border-brand-100">
                    <tr>
                      <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-1/3">Source Interface</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-gray-700 uppercase tracking-wider w-2/3 pl-6">Target Interface</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-50">
                    {interfaces.map((iface) => (
                      <tr key={iface.name} className="hover:bg-white/60 transition-colors group">
                        <td className="px-4 py-3 align-middle">
                          <div className="flex items-center gap-2">
                            <Network className="w-3.5 h-3.5 text-gray-400" />
                            <span className="text-xs font-mono font-medium text-gray-600">{iface.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <div className="relative flex items-center gap-3">
                            <ArrowRight className="w-4 h-4 text-brand-300 flex-shrink-0" />
                            <input
                              type="text"
                              className="w-full text-xs font-bold text-gray-900 border-none bg-white rounded-xl h-9 px-4 shadow-sm ring-1 ring-gray-100 focus:ring-2 focus:ring-brand-500 focus:shadow-md transition-all placeholder-gray-300"
                              placeholder={iface.name}
                              value={mappingData?.interface_mapping?.[iface.name] || ''}
                              onChange={(e) => handleInterfaceChange(iface.name, e.target.value)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-brand-600/30 bg-brand-50/20 rounded-xl">
                  <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center mb-2">
                    <Settings className="w-4 h-4 text-brand-400" />
                  </div>
                  <p className="text-xs font-medium">No interfaces found</p>
                </div>
              )}
            </div>
          </div>

          {/* Zone Mapping */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-0.5 h-3 rounded-full bg-brand-600"></div>
              <h4 className="text-[10px] font-extrabold text-gray-900 uppercase tracking-widest">Zone Mapping</h4>
            </div>

            {interfaces.length > 0 ? (
              <div className="bg-white/40 backdrop-blur-md rounded-2xl border border-brand-100 shadow-sm overflow-hidden p-1">
                <div className="grid grid-cols-1 divide-y divide-brand-50">
                  {interfaces.map((iface) => (
                    <div key={`${iface.name}-zone`} className="flex items-center justify-between px-4 py-3 hover:bg-white/60 transition-colors group">
                      {/* Source Side */}
                      <div className="flex items-center gap-3 w-1/3">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300 group-hover:bg-brand-400 transition-colors"></div>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-gray-700">{iface.zone || 'Unknown Zone'}</span>
                          <span className="text-[10px] text-gray-400 font-mono">from {iface.name}</span>
                        </div>
                      </div>

                      {/* Connection */}
                      <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-brand-500 transition-colors" />

                      {/* Target Side */}
                      <div className="w-1/2 max-w-[200px]">
                        <input
                          type="text"
                          className="w-full text-xs font-bold text-gray-900 border-none bg-white rounded-xl h-9 px-4 shadow-sm ring-1 ring-gray-100 focus:ring-2 focus:ring-brand-500 focus:shadow-md transition-all placeholder-gray-300"
                          placeholder="Assign Target Zone..."
                          value={mappingData?.zone_mapping?.[iface.name] || ''}
                          onChange={(e) => handleZoneChange(iface.name, e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-gray-400 italic">No zones to map</div>
            )}
          </div>
        </section>

        {/* SECTION 4: OPTIMIZATION */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-0.5 h-3 rounded-full bg-brand-700"></div>
            <h4 className="text-[10px] font-extrabold text-gray-900 uppercase tracking-widest">Optimization</h4>
          </div>

          <div
            onClick={() => setExcludeUnused(!excludeUnused)}
            className={`
              relative p-3 rounded-xl border cursor-pointer group flex items-start gap-3 transition-all duration-300
              ${excludeUnused
                ? "bg-brand-50 border-brand-300 shadow-sm"
                : "bg-white/60 border-brand-100 hover:bg-white hover:border-brand-200"
              }
            `}
          >
            <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center border transition-all duration-300 ${excludeUnused ? "bg-brand-500 border-brand-500 scale-110" : "bg-white border-gray-300"}`}>
              {excludeUnused && <CheckCircle className="w-3 h-3 text-white" />}
            </div>
            <div>
              <h5 className={`text-xs font-bold mb-0.5 ${excludeUnused ? "text-brand-900" : "text-gray-600"}`}>Remove Unused Objects</h5>
              <p className="text-[10px] text-gray-500 leading-snug">
                Automatically strip out unused address objects and services.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* ACTION FOOTER */}
      <div className="p-4 border-t border-brand-100 bg-white/90 backdrop-blur-xl z-20">
        <button
          onClick={onGenerate}
          disabled={isGenerating || !analysisData}
          className={`
            w-full group relative flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm tracking-wide shadow-lg transition-all duration-300
            ${isGenerating || !analysisData
              ? 'bg-gray-100 text-gray-400 shadow-none cursor-not-allowed border border-gray-200'
              : 'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-brand hover:shadow-brand-lg hover:scale-[1.01] active:scale-[0.99]'
              }
          `}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white/90" />
              <span>Processing...</span>
            </>
          ) : (
            <>
              <Settings className="w-4 h-4 text-white/90 group-hover:text-white transition-colors" />
              <span>Generate Blueprint</span>
            </>
          )}
        </button>

        {!analysisData && (
          <div className="text-center mt-3">
            <p className="text-[10px] font-medium text-gray-400">
              Upload a configuration file to proceed
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversionParams;
