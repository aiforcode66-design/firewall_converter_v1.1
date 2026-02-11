import React, { useCallback, useState } from 'react';
import { Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

interface DragDropZoneProps {
    onFileSelect: (file: File) => void;
    accept?: string;
    maxSize?: number; // in MB
    selectedFile?: File | null;
}

const DragDropZone: React.FC<DragDropZoneProps> = ({
    onFileSelect,
    accept = '.txt,.conf,.cfg',
    maxSize = 10,
    selectedFile = null,
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const validateFile = (file: File): string | null => {
        // Check file size
        const fileSizeMB = file.size / (1024 * 1024);
        if (fileSizeMB > maxSize) {
            return `File too large. Maximum size is ${maxSize}MB`;
        }

        // Check file extension
        const fileName = file.name.toLowerCase();
        const acceptedExtensions = accept.split(',').map(ext => ext.trim());
        const hasValidExtension = acceptedExtensions.some(ext =>
            fileName.endsWith(ext.replace('*', ''))
        );

        if (!hasValidExtension) {
            return `Invalid file type. Accepted: ${accept}`;
        }

        return null;
    };

    const handleFile = useCallback((file: File) => {
        const validationError = validateFile(file);
        if (validationError) {
            setError(validationError);
            return;
        }

        setError(null);
        onFileSelect(file);
    }, [onFileSelect, maxSize, accept]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            handleFile(files[0]);
        }
    }, [handleFile]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleFile(files[0]);
        }
    }, [handleFile]);

    const handleRemoveFile = useCallback(() => {
        setError(null);
        onFileSelect(null as any);
    }, [onFileSelect]);

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return (
        <div className="w-full">
            {!selectedFile ? (
                <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className={clsx(
                        'relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 cursor-pointer',
                        isDragging
                            ? 'border-brand-500 bg-brand-50 scale-[1.02]'
                            : 'border-gray-300 hover:border-brand-400 hover:bg-brand-50/30'
                    )}
                >
                    <input
                        type="file"
                        id="file-upload"
                        className="hidden"
                        accept={accept}
                        onChange={handleFileInput}
                    />

                    <label htmlFor="file-upload" className="cursor-pointer">
                        <div className="flex flex-col items-center">
                            <div
                                className={clsx(
                                    'w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-all',
                                    isDragging ? 'bg-brand-500' : 'bg-gray-100'
                                )}
                            >
                                <Upload
                                    className={clsx(
                                        'w-10 h-10 transition-colors',
                                        isDragging ? 'text-white' : 'text-gray-400'
                                    )}
                                />
                            </div>

                            <p className="text-lg font-semibold text-gray-700 mb-2">
                                {isDragging ? 'Drop your file here' : 'Drag and drop your configuration file'}
                            </p>
                            <p className="text-sm text-gray-500 mb-4">
                                or click to browse
                            </p>

                            <button
                                type="button"
                                className="px-6 py-3 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors font-medium shadow-lg shadow-brand-200"
                            >
                                Choose File
                            </button>

                            <p className="text-xs text-gray-400 mt-4">
                                Accepted: {accept} • Max size: {maxSize}MB
                            </p>
                        </div>
                    </label>
                </div>
            ) : (
                <div className="border-2 border-brand-500 bg-brand-50 rounded-2xl p-8">
                    <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                            <div className="w-14 h-14 bg-brand-500 rounded-lg flex items-center justify-center">
                                <FileText className="w-7 h-7 text-white" />
                            </div>
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-gray-900 truncate">
                                        {selectedFile.name}
                                    </p>
                                    <p className="text-sm text-gray-600 mt-1">
                                        {formatFileSize(selectedFile.size)}
                                    </p>
                                </div>

                                <button
                                    onClick={handleRemoveFile}
                                    className="flex-shrink-0 p-2 hover:bg-red-100 rounded-lg transition-colors group"
                                    title="Remove file"
                                >
                                    <X className="w-5 h-5 text-gray-400 group-hover:text-red-600" />
                                </button>
                            </div>

                            <div className="flex items-center gap-2 mt-3">
                                <CheckCircle className="w-4 h-4 text-green-600" />
                                <span className="text-sm font-medium text-green-700">
                                    File uploaded successfully
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-red-800">Upload Error</p>
                        <p className="text-sm text-red-700 mt-1">{error}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DragDropZone;
