import React from 'react';
import { Upload, FileCode } from 'lucide-react';
import { useWizardState } from '../../hooks/useWizardState';
import DragDropZone from './DragDropZone.tsx';
import MultiFileUpload from './MultiFileUpload.tsx';
import VendorSelector from './VendorSelector.tsx';

const sourceVendors = [
    { id: 'cisco_asa', name: 'Cisco ASA', icon: '🔷' },
    { id: 'fortinet', name: 'FortiGate', icon: '🟩' },
    { id: 'checkpoint', name: 'Check Point', icon: '🔴' },
    { id: 'palo_alto', name: 'Palo Alto', icon: '🔶' },
];

const destVendors = [
    { id: 'palo_alto', name: 'Palo Alto', icon: '🔶' },
    { id: 'fortinet', name: 'FortiGate', icon: '🟩' },
];

// Checkpoint file configuration
const checkpointFileConfig = [
    { key: 'objects_5_0', label: 'objects_5_0.c', required: true, accept: '.c' },
    { key: 'policy', label: 'policy.csv', required: true, accept: '.csv' },
    { key: 'nat', label: 'nat.csv', required: false, accept: '.csv' },
    { key: 'show_config', label: 'show configuration.txt', required: false, accept: '.txt' },
    { key: 'objects_zip', label: 'objects.zip', required: false, accept: '.zip' },
];

const WizardStep1_Upload: React.FC = () => {
    const { uploadData, setUploadData } = useWizardState();
    const isCheckpoint = uploadData.sourceVendor === 'checkpoint';

    const handleFileSelect = (file: File | null) => {
        setUploadData({ file });
    };

    const handleCheckpointFilesChange = (files: Record<string, File | null>) => {
        console.log('[WizardStep1] handleCheckpointFilesChange called with:', files);
        setUploadData({ checkpointFiles: files });
    };

    const handleSourceVendorChange = (vendor: string) => {
        console.log('[WizardStep1] handleSourceVendorChange called with:', vendor, 'current:', uploadData.sourceVendor);
        // Only reset files if actually changing vendor
        if (vendor === uploadData.sourceVendor) {
            console.log('[WizardStep1] Same vendor selected, ignoring');
            return;
        }
        // Reset files when changing vendor
        if (vendor === 'checkpoint') {
            setUploadData({ sourceVendor: vendor, file: null, checkpointFiles: {} });
        } else {
            setUploadData({ sourceVendor: vendor, checkpointFiles: undefined });
        }
    };

    const handleDestVendorChange = (vendor: string) => {
        setUploadData({ destVendor: vendor });
    };

    return (
        <div className="flex-1 flex flex-col">
            {/* Hero Section */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-brand-100 rounded-full mb-6">
                    <Upload className="w-10 h-10 text-brand-600" />
                </div>
                <h1 className="text-4xl font-bold text-gray-900 mb-3">
                    Upload Configuration
                </h1>
                <p className="text-lg text-gray-600">
                    Select your source firewall configuration and target platform
                </p>
            </div>

            <div className="max-w-4xl w-full mx-auto space-y-8">
                {/* Vendor Selection */}
                <div className="bg-white rounded-xl shadow-lg p-8 space-y-6">
                    <div className="flex items-center gap-3 mb-6">
                        <FileCode className="w-6 h-6 text-brand-600" />
                        <h2 className="text-2xl font-bold text-gray-900">
                            Select Vendors
                        </h2>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                        <VendorSelector
                            label="Source Vendor"
                            value={uploadData.sourceVendor}
                            onChange={handleSourceVendorChange}
                            vendors={sourceVendors}
                        />

                        <VendorSelector
                            label="Target Vendor"
                            value={uploadData.destVendor}
                            onChange={handleDestVendorChange}
                            vendors={destVendors}
                        />
                    </div>
                </div>

                {/* File Upload - Conditional based on vendor */}
                <div className="bg-white rounded-xl shadow-lg p-8">
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                            Upload Configuration {isCheckpoint ? 'Files' : 'File'}
                        </h2>
                        <p className="text-gray-600">
                            {isCheckpoint
                                ? 'Upload required Check Point configuration files'
                                : `Upload your ${sourceVendors.find(v => v.id === uploadData.sourceVendor)?.name || 'source'} firewall configuration`}
                        </p>
                    </div>

                    {isCheckpoint ? (
                        <MultiFileUpload
                            fileConfig={checkpointFileConfig}
                            uploadedFiles={uploadData.checkpointFiles || {}}
                            onFilesChange={handleCheckpointFilesChange}
                        />
                    ) : (
                        <DragDropZone
                            onFileSelect={handleFileSelect}
                            selectedFile={uploadData.file}
                            accept=".txt,.conf,.cfg,.xml"
                            maxSize={20}
                        />
                    )}
                </div>

                {/* Info Card */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                    <div className="flex gap-4">
                        <div className="flex-shrink-0">
                            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                                <FileCode className="w-5 h-5 text-white" />
                            </div>
                        </div>
                        <div>
                            <h3 className="font-semibold text-blue-900 mb-2">
                                {isCheckpoint ? 'Check Point Requirements' : 'Supported File Formats'}
                            </h3>
                            {isCheckpoint ? (
                                <ul className="text-sm text-blue-800 space-y-1">
                                    <li>• <strong>Required:</strong> objects_5_0.c, policy.csv</li>
                                    <li>• <strong>Optional:</strong> nat.csv, show configuration.txt, objects.zip</li>
                                    <li>• Maximum file size: 20MB per file</li>
                                </ul>
                            ) : (
                                <ul className="text-sm text-blue-800 space-y-1">
                                    <li>• Configuration files (.txt, .conf, .cfg)</li>
                                    <li>• XML exports (.xml)</li>
                                    <li>• Maximum file size: 20MB</li>
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WizardStep1_Upload;
