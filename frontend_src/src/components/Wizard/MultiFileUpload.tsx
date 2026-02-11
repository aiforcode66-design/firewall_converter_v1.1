import React, { useCallback, useState } from 'react';
import { Upload, FileText, X, CheckCircle, AlertCircle, FileCode, Table, Network, Route, Archive } from 'lucide-react';
import clsx from 'clsx';

interface FileConfig {
    key: string;
    label: string;
    required: boolean;
    accept?: string;
}

interface MultiFileUploadProps {
    onFilesChange: (files: Record<string, File | null>) => void;
    fileConfig: FileConfig[];
    uploadedFiles?: Record<string, File | null>;
}

const MultiFileUpload: React.FC<MultiFileUploadProps> = ({
    onFilesChange,
    fileConfig,
    uploadedFiles = {},
}) => {
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Get icon based on file key or label
    const getFileIcon = (config: FileConfig) => {
        if (config.key === 'objects_5_0' || config.label.includes('.c')) return FileCode;
        if (config.key === 'policy' || config.label.includes('policy.csv')) return Table;
        if (config.key === 'nat' || config.label.includes('nat.csv')) return Network;
        if (config.key === 'show_config' || config.label.includes('configuration.txt')) return Route;
        if (config.key === 'objects_zip' || config.label.includes('.zip')) return Archive;
        return FileText;
    };

    const handleFileSelect = (key: string, file: File | null) => {
        const newFiles = { ...uploadedFiles, [key]: file };
        console.log('[MultiFileUpload] handleFileSelect:', { key, fileName: file?.name, newFiles });
        onFilesChange(newFiles);

        // Clear error for this file
        if (file && errors[key]) {
            const newErrors = { ...errors };
            delete newErrors[key];
            setErrors(newErrors);
        }
    };

    const handleFileInput = (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        handleFileSelect(key, file);
    };

    const handleRemoveFile = (key: string) => {
        handleFileSelect(key, null);
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    // Separate required and optional files
    const requiredFiles = fileConfig.filter(f => f.required);
    const optionalFiles = fileConfig.filter(f => !f.required);

    const renderFileCard = (config: FileConfig) => {
        const file = uploadedFiles[config.key];
        const hasError = !!errors[config.key];
        const Icon = getFileIcon(config);

        return (
            <div key={config.key} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center">
                        <Icon className="w-4 h-4 text-brand-600" />
                    </div>
                    <div className="flex-1">
                        <label className="text-sm font-semibold text-gray-700">
                            {config.label}
                        </label>
                    </div>
                    {config.required ? (
                        <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded">Required</span>
                    ) : (
                        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">Optional</span>
                    )}
                </div>

                {!file ? (
                    <div>
                        <input
                            type="file"
                            id={`file-${config.key}`}
                            className="hidden"
                            accept={config.accept || '*'}
                            onChange={(e) => handleFileInput(config.key, e)}
                        />
                        <label
                            htmlFor={`file-${config.key}`}
                            className={clsx(
                                'flex items-center justify-center gap-3 p-4 border-2 border-dashed rounded-lg cursor-pointer transition-all',
                                hasError
                                    ? 'border-red-300 bg-red-50 hover:border-red-400'
                                    : 'border-gray-300 bg-white hover:border-brand-400 hover:bg-brand-50'
                            )}
                        >
                            <Upload className={clsx('w-5 h-5', hasError ? 'text-red-400' : 'text-gray-400')} />
                            <span className="text-sm text-gray-600">
                                Click to upload {config.label}
                            </span>
                        </label>
                    </div>
                ) : (
                    <div className="flex items-center gap-3 p-3 bg-white border-2 border-brand-500 rounded-lg">
                        <FileText className="w-5 h-5 text-brand-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                            <p className="text-xs text-gray-600">{formatFileSize(file.size)}</p>
                        </div>
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <button
                            onClick={() => handleRemoveFile(config.key)}
                            className="p-1 hover:bg-red-100 rounded transition-colors"
                            title="Remove file"
                        >
                            <X className="w-4 h-4 text-gray-400 hover:text-red-600" />
                        </button>
                    </div>
                )}

                {hasError && (
                    <div className="mt-2 flex items-start gap-2 text-xs text-red-600">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>{errors[config.key]}</span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Required Files Section */}
            {requiredFiles.length > 0 && (
                <div>
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                        Required Files
                    </h3>
                    <div className="space-y-3">
                        {requiredFiles.map(renderFileCard)}
                    </div>
                </div>
            )}

            {/* Optional Files Section */}
            {optionalFiles.length > 0 && (
                <div>
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                        Optional Files
                    </h3>
                    <div className="space-y-3">
                        {optionalFiles.map(renderFileCard)}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MultiFileUpload;
