import React, { useState, useEffect } from 'react';
import { Settings, Network, Save } from 'lucide-react';
import { useWizardState } from '../../hooks/useWizardState';
import MappingCombobox from './MappingCombobox.tsx';
import { SecurityProfileSettings } from './SecurityProfileSettings';

// Preset options for target platforms
const presetZones = ['Trust', 'Untrust', 'DMZ', 'VPN', 'Management', 'Guest'];
const presetInterfaces = ['ethernet1/1', 'ethernet1/2', 'ethernet1/3', 'ae1', 'ae2'];

const WizardStep2_Configure: React.FC = () => {
    const { mappingData, setMappingData, uploadData } = useWizardState();
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Derive source items from analysis data
    // Derive source items from analysis data
    const sourceZones = React.useMemo(() =>
        uploadData.analysisData?.zones || [],
        [uploadData.analysisData]
    );

    const sourceInterfaces = React.useMemo(() =>
        uploadData.analysisData?.interfaces?.map((i: any) => i.name) || [],
        [uploadData.analysisData]
    );

    // Initialize empty mappings for all source items
    useEffect(() => {
        const initialZones: Record<string, string> = {};
        sourceZones.forEach(zone => {
            if (mappingData.zones[zone] === undefined) {
                initialZones[zone] = '';
            }
        });

        const initialInterfaces: Record<string, string> = {};
        sourceInterfaces.forEach(iface => {
            if (mappingData.interfaces[iface] === undefined) {
                initialInterfaces[iface] = '';
            }
        });

        if (Object.keys(initialZones).length > 0 || Object.keys(initialInterfaces).length > 0) {
            setMappingData({
                zones: { ...mappingData.zones, ...initialZones },
                interfaces: { ...mappingData.interfaces, ...initialInterfaces },
            });
        }
    }, [sourceZones, sourceInterfaces, mappingData.zones, mappingData.interfaces, setMappingData]);

    const handleZoneChange = (sourceZone: string, targetZone: string) => {
        setMappingData({
            zones: { ...mappingData.zones, [sourceZone]: targetZone },
        });
        setHasUnsavedChanges(true);
    };

    const handleInterfaceChange = (sourceInterface: string, targetInterface: string) => {
        setMappingData({
            interfaces: { ...mappingData.interfaces, [sourceInterface]: targetInterface },
        });
        setHasUnsavedChanges(true);
    };

    const handleSaveTemplate = () => {
        // TODO: Implement template saving
        setHasUnsavedChanges(false);
        alert('Template saved! (Feature coming soon)');
    };

    const isZoneMappingComplete = sourceZones.length === 0 || sourceZones.every(
        zone => mappingData.zones[zone] && mappingData.zones[zone].trim() !== ''
    );

    const isInterfaceMappingComplete = sourceInterfaces.length === 0 || sourceInterfaces.every(
        iface => mappingData.interfaces[iface] && mappingData.interfaces[iface].trim() !== ''
    );

    // const isStepComplete = isZoneMappingComplete && isInterfaceMappingComplete;

    const handleOptionChange = (key: string, value: string) => {
        setMappingData({
            generatorOptions: {
                ...mappingData.generatorOptions,
                [key]: value
            }
        });
        setHasUnsavedChanges(true);
    };

    return (
        <div className="flex-1 flex flex-col">
            {/* Hero Section */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-100 rounded-full mb-4">
                    <Settings className="w-8 h-8 text-brand-600" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    Configure Mapping
                </h1>
                <p className="text-gray-600">
                    Map your {uploadData.sourceVendor || 'source'} zones and interfaces to {uploadData.destVendor || 'target'}
                </p>
            </div>

            <div className="max-w-5xl w-full mx-auto space-y-6">
                {/* Completion Indicator - Removed since mapping is optional */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                    <div className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" >ℹ️</div>
                    <div>
                        <p className="text-sm font-medium text-blue-900">
                            Mapping is optional
                        </p>
                        <p className="text-xs text-blue-700 mt-1">
                            You can skip this step and configure mappings later if preferred.
                        </p>
                    </div>
                </div>

                {/* Zone Mapping */}
                <div className="bg-white rounded-xl shadow-lg p-8">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <Network className="w-6 h-6 text-brand-600" />
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Zone Mapping</h2>
                                <p className="text-sm text-gray-600">
                                    Map source security zones to target zones
                                </p>
                            </div>
                        </div>
                        {hasUnsavedChanges && (
                            <button
                                onClick={handleSaveTemplate}
                                className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-brand-500 text-brand-600 rounded-lg hover:bg-brand-50 transition-colors font-medium"
                            >
                                <Save className="w-4 h-4" />
                                Save Template
                            </button>
                        )}
                    </div>

                    {sourceZones.length > 0 ? (
                        <div className="space-y-3">
                            {sourceZones.map((sourceZone) => (
                                <MappingCombobox
                                    key={sourceZone}
                                    sourceItem={sourceZone}
                                    value={mappingData.zones[sourceZone] || ''}
                                    onChange={(value) => handleZoneChange(sourceZone, value)}
                                    presetOptions={presetZones}
                                    placeholder="Select or type zone name..."
                                    allowCustom={true}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-500 italic">
                            No zones found in the uploaded configuration.
                        </div>
                    )}
                </div>

                {/* Interface Mapping */}
                <div className="bg-white rounded-xl shadow-lg p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <Network className="w-6 h-6 text-brand-600" />
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Interface Mapping</h2>
                            <p className="text-sm text-gray-600">
                                Map source physical interfaces to target interfaces
                            </p>
                        </div>
                    </div>

                    {sourceInterfaces.length > 0 ? (
                        <div className="space-y-3">
                            {sourceInterfaces.map((sourceInterface) => (
                                <MappingCombobox
                                    key={sourceInterface}
                                    sourceItem={sourceInterface}
                                    value={mappingData.interfaces[sourceInterface] || ''}
                                    onChange={(value) => handleInterfaceChange(sourceInterface, value)}
                                    presetOptions={presetInterfaces}
                                    placeholder="Select or type interface name..."
                                    allowCustom={true}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-500 italic">
                            No interfaces found in the uploaded configuration.
                        </div>
                    )}
                </div>

                {/* Security Profile Defaults - Conditional Rendering */}
                {['fortinet', 'palo_alto', 'paloalto'].includes(uploadData.destVendor) && (
                    <SecurityProfileSettings
                        destVendor={uploadData.destVendor}
                        options={mappingData.generatorOptions || {}}
                        onChange={handleOptionChange}
                    />
                )}

                {/* Tips Card */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                    <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                        <Settings className="w-5 h-5" />
                        Mapping Tips
                    </h3>
                    <ul className="text-sm text-blue-800 space-y-2">
                        <li>• <strong>Preset zones:</strong> Select from common target zones</li>
                        <li>• <strong>Custom zones:</strong> Type any custom zone name and press Enter</li>
                        <li>• <strong>Templates:</strong> Save your mapping configuration for reuse</li>
                        <li>• <strong>Validation:</strong> All mappings must be completed to proceed</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default WizardStep2_Configure;
