import React from 'react';
import { Shield, Lock, Eye, FileWarning, Globe, Activity } from 'lucide-react';

interface SecurityProfileSettingsProps {
    destVendor: string;
    options: Record<string, string>;
    onChange: (key: string, value: string) => void;
}

export const SecurityProfileSettings: React.FC<SecurityProfileSettingsProps> = ({
    destVendor,
    options,
    onChange,
}) => {
    // Define fields based on vendor
    const getFields = () => {
        if (destVendor === 'fortinet') {
            return [
                { key: 'fortinet_ips', label: 'IPS Sensor', icon: Shield, placeholder: 'e.g. default' },
                { key: 'fortinet_av', label: 'AntiVirus Profile', icon: Activity, placeholder: 'e.g. default' },
                { key: 'fortinet_web', label: 'Web Filter', icon: Globe, placeholder: 'e.g. default' },
                { key: 'fortinet_file', label: 'File Filter', icon: FileWarning, placeholder: 'e.g. basic-file-blocking' },
                { key: 'fortinet_ssl', label: 'SSL Inspection', icon: Lock, placeholder: 'e.g. certificate-inspection' },
            ];
        } else if (destVendor === 'palo_alto' || destVendor === 'paloalto') {
            return [
                { key: 'pa_av_profile', label: 'Anti-Virus', icon: Activity, placeholder: 'e.g. default' },
                { key: 'pa_as_profile', label: 'Anti-Spyware', icon: Eye, placeholder: 'e.g. strict' },
                { key: 'pa_vp_profile', label: 'Vulnerability Protection', icon: Shield, placeholder: 'e.g. strict' },
                { key: 'pa_url_profile', label: 'URL Filtering', icon: Globe, placeholder: 'e.g. default' },
                { key: 'pa_fb_profile', label: 'File Blocking', icon: FileWarning, placeholder: 'e.g. basic-file-blocking' },
                { key: 'pa_wf_profile', label: 'WildFire Analysis', icon: Activity, placeholder: 'e.g. default' },
                { key: 'pa_log_profile', label: 'Log Forwarding', icon: FileWarning, placeholder: 'e.g. default' },
            ];
        }
        return [];
    };

    const fields = getFields();

    if (fields.length === 0) return null;

    return (
        <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                    <Shield className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Security Profile Defaults</h2>
                    <p className="text-sm text-gray-600">
                        Assign default security profiles to all converted policies
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {fields.map((field) => {
                    const Icon = field.icon;
                    return (
                        <div key={field.key} className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                <Icon className="w-4 h-4 text-gray-400" />
                                {field.label}
                            </label>
                            <input
                                type="text"
                                value={options[field.key] || ''}
                                onChange={(e) => onChange(field.key, e.target.value)}
                                placeholder={field.placeholder}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all outline-none"
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
