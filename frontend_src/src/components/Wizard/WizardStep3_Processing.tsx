import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Zap, CheckCircle, FileText, Settings, Network } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWizardState } from '../../hooks/useWizardState';
import { convertConfig } from '../../api/client';

const processingSteps = [
    { id: 1, label: 'Initializing conversion engine', icon: FileText },
    { id: 2, label: 'Uploading configuration & mappings', icon: Network },
    { id: 3, label: 'Analyzing security policies', icon: Settings },
    { id: 4, label: 'Generating target configuration', icon: Zap },
    { id: 5, label: 'Finalizing output', icon: CheckCircle },
];

const WizardStep3_Processing: React.FC = () => {
    const { setProcessingData, nextStep, uploadData, mappingData, setResultsData } = useWizardState();
    const [progress, setProgress] = useState(0);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [logs, setLogs] = useState<{ time: string; message: string }[]>([]);
    const [isComplete, setIsComplete] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Ref to prevent double-execution in Strict Mode
    const processingStarted = useRef(false);

    const addLog = (message: string) => {
        const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLogs(prev => [...prev, { time, message }]);
    };

    useEffect(() => {
        if (processingStarted.current) return;
        processingStarted.current = true;

        const startConversion = async () => {
            try {
                addLog('Initializing conversion process...');
                setCurrentStepIndex(0);
                setProgress(10);

                // Build FormData
                const formData = new FormData();
                formData.append('source_vendor', uploadData.sourceVendor);
                formData.append('destination_vendor', uploadData.destVendor);

                // Files
                addLog(`Preparing files for ${uploadData.sourceVendor}...`);
                if (uploadData.sourceVendor === 'checkpoint') {
                    const files = uploadData.checkpointFiles || {};
                    if (files['objects_5_0']) formData.append('checkpoint_objects', files['objects_5_0']);
                    formData.append('checkpoint_policy', files['policy'] as File); // Required
                    if (files['nat']) formData.append('checkpoint_nat', files['nat']);
                    if (files['show_config']) formData.append('checkpoint_config', files['show_config']);
                    if (files['objects_zip']) formData.append('checkpoint_csv_zip', files['objects_zip']);
                } else if (uploadData.file) {
                    formData.append('config_file', uploadData.file);
                }

                // Mapping
                addLog('Attaching zone and interface mappings...');
                setCurrentStepIndex(1);
                setProgress(30);
                formData.append('interface_mapping_data', JSON.stringify(mappingData.interfaces));
                formData.append('zone_mapping_data', JSON.stringify(mappingData.zones));
                // Note: Legacy used 'interface_mapping_data' with full mappingData object?
                // Checking Step2_Mapping legacy: 
                // formData.append('interface_mapping_data', JSON.stringify(mappingData)); 
                // Wait, if mappingData contains BOTH zones and interfaces??
                // useWizardState defines mappingData as { zones: {}, interfaces: {} }.
                // Let's send the whole object as mappingData? Or specific keys?
                // Legacy Step2_Mapping line 84: formData.append('interface_mapping_data', JSON.stringify(mappingData));
                // It sends the WHOLE mappingData object under 'interface_mapping_data' key. 
                // This seems like a naming quirk of the backend. I MUST follow it.
                // Re-doing the append to match legacy EXACTLY.
            } catch (err: any) {
                console.error('Preparation failed:', err);
                setError(err.message);
                return;
            }

            // Correction: Re-implementing the API call with correct payload structure
            const realFormData = new FormData();
            realFormData.append('source_vendor', uploadData.sourceVendor);
            realFormData.append('destination_vendor', uploadData.destVendor);

            if (uploadData.sourceVendor === 'checkpoint') {
                const files = uploadData.checkpointFiles || {};
                if (files['objects_5_0']) realFormData.append('checkpoint_objects', files['objects_5_0']);
                if (files['policy']) realFormData.append('checkpoint_policy', files['policy']);
                if (files['nat']) realFormData.append('checkpoint_nat', files['nat']);
                if (files['show_config']) realFormData.append('checkpoint_config', files['show_config']);
                if (files['objects_zip']) realFormData.append('checkpoint_csv_zip', files['objects_zip']);
            } else if (uploadData.file) {
                realFormData.append('config_file', uploadData.file);
            }

            // Mapping Data - sending the whole object as 'interface_mapping_data' per legacy code
            // Mapping Data
            realFormData.append('interface_mapping_data', JSON.stringify(mappingData));
            realFormData.append('target_layout_data', '[]'); // Default empty array

            // Generator Options (Security Profiles)
            if (mappingData.generatorOptions) {
                realFormData.append('generator_options', JSON.stringify(mappingData.generatorOptions));
            }

            // Options (defaults)
            // realFormData.append('exclude_unused', 'false'); // Optional

            try {
                addLog('Uploading data to conversion engine...');
                setCurrentStepIndex(2);
                setProgress(50);

                // Start a fake progress interval while waiting
                const interval = setInterval(() => {
                    setProgress(prev => Math.min(prev + 5, 90));
                }, 1000);

                addLog('Analyzing and converting rules...');
                const result = await convertConfig(realFormData);

                clearInterval(interval);
                setProgress(100);
                setCurrentStepIndex(4);
                addLog('Conversion successful!');
                setIsComplete(true);

                setResultsData(result);
                setProcessingData({ progress: 100, sessionId: result.config_id || 'session-new' });

                setTimeout(() => {
                    nextStep();
                }, 1000);

            } catch (err: any) {
                console.error('Conversion failed:', err);
                setError(err.message || 'Conversion failed. Please try again.');
                addLog(`Error: ${err.message}`);
                // Do not advance
            }
        };

        startConversion();
    }, [uploadData, mappingData, nextStep, setResultsData, setProcessingData]);

    return (
        <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-full max-w-3xl">
                {/* Main Animation */}
                <div className="text-center mb-12">
                    <motion.div
                        animate={isComplete ? { scale: [1, 1.2, 1] } : { rotate: 360 }}
                        transition={
                            isComplete
                                ? { duration: 0.5 }
                                : { duration: 2, repeat: Infinity, ease: 'linear' }
                        }
                        className="inline-flex items-center justify-center w-24 h-24 bg-brand-100 rounded-full mb-6"
                    >
                        {isComplete ? (
                            <CheckCircle className="w-12 h-12 text-green-600" />
                        ) : error ? (
                            <div className="text-red-600 font-bold text-4xl">!</div>
                        ) : (
                            <Loader2 className="w-12 h-12 text-brand-600" />
                        )}
                    </motion.div>

                    <h1 className="text-4xl font-bold text-gray-900 mb-3">
                        {error ? 'Conversion Failed' : isComplete ? 'Conversion Complete!' : 'Converting Configuration'}
                    </h1>
                    <p className="text-lg text-gray-600">
                        {error
                            ? 'An error occurred during processing.'
                            : isComplete
                                ? 'Your firewall configuration has been successfully converted'
                                : 'Please wait while we process your configuration...'}
                    </p>
                </div>

                {/* Progress Bar */}
                <div className="mb-12">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-semibold text-gray-700">Progress</span>
                        <span className="text-sm font-bold text-brand-600">
                            {Math.round(progress)}%
                        </span>
                    </div>
                    <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
                        <motion.div
                            className={`absolute inset-y-0 left-0 rounded-full ${error ? 'bg-red-500' : 'bg-gradient-to-r from-brand-500 to-brand-600'}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                        />
                        {!error && !isComplete && (
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                        )}
                    </div>
                </div>

                {/* Processing Steps */}
                <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Processing Steps</h2>
                    <div className="space-y-3">
                        {processingSteps.map((step, index) => {
                            const isActive = index === currentStepIndex && !error && !isComplete;
                            const isCompleted = index < currentStepIndex || isComplete;
                            const Icon = step.icon;

                            return (
                                <motion.div
                                    key={step.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${isActive ? 'bg-brand-50' : isCompleted ? 'bg-green-50' : 'bg-gray-50'
                                        }`}
                                >
                                    <div
                                        className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${isCompleted
                                            ? 'bg-green-500 text-white'
                                            : isActive
                                                ? 'bg-brand-500 text-white'
                                                : 'bg-gray-300 text-gray-500'
                                            }`}
                                    >
                                        {isCompleted ? (
                                            <CheckCircle className="w-5 h-5" />
                                        ) : (
                                            <Icon className={`w-5 h-5 ${isActive ? 'animate-pulse' : ''}`} />
                                        )}
                                    </div>
                                    <span
                                        className={`font-medium ${isActive
                                            ? 'text-brand-700'
                                            : isCompleted
                                                ? 'text-green-700'
                                                : 'text-gray-500'
                                            }`}
                                    >
                                        {step.label}
                                    </span>
                                    {isActive && (
                                        <Loader2 className="w-4 h-4 text-brand-500 animate-spin ml-auto" />
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>
                </div>

                {/* Live Logs */}
                <div className="bg-gray-900 rounded-xl shadow-lg p-6 font-mono text-sm max-h-64 overflow-y-auto">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500" />
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span className="text-gray-400 text-xs ml-2">Processing Logs</span>
                    </div>
                    <AnimatePresence>
                        {logs.map((log, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2 }}
                                className="text-green-400 mb-1"
                            >
                                <span className="text-gray-500">[{log.time}]</span> {log.message}
                            </motion.div>
                        ))}
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-red-400 mb-1"
                            >
                                <span className="text-gray-500">[{new Date().toLocaleTimeString('en-US', { hour12: false })}]</span> CRITICAL: Process failed.
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default WizardStep3_Processing;
