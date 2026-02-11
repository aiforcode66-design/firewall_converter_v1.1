import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { useWizardState } from '../../hooks/useWizardState';
import { analyzeConfig } from '../../api/client';
import ProgressBar from './ProgressBar.tsx';

interface WizardContainerProps {
    children: React.ReactNode;
}

const WizardContainer: React.FC<WizardContainerProps> = ({ children }) => {
    const {
        currentStep,
        nextStep,
        previousStep,
        canGoNext,
        canGoBack,
        uploadData,
        setUploadData,
        setMappingData,
    } = useWizardState();

    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getStepLabel = () => {
        switch (currentStep) {
            case 1: return { next: 'Analyze & Configure', back: null };
            case 2: return { next: 'Start Conversion', back: 'Back to Upload' };
            case 3: return { next: null, back: null }; // Processing - no manual navigation
            case 4: return { next: null, back: 'Back to Configure' };
            default: return { next: 'Next', back: 'Back' };
        }
    };

    const handleNext = async () => {
        setError(null);

        // Step 1 -> 2: Run Analysis
        if (currentStep === 1) {
            setIsProcessing(true);
            try {
                const formData = new FormData();
                formData.append('source_vendor', uploadData.sourceVendor);

                if (uploadData.sourceVendor === 'checkpoint') {
                    const files = uploadData.checkpointFiles || {};
                    if (files['objects_5_0']) formData.append('checkpoint_objects', files['objects_5_0']);
                    if (files['policy']) formData.append('checkpoint_policy', files['policy']);
                    if (files['nat']) formData.append('checkpoint_nat', files['nat']);
                    if (files['show_config']) formData.append('checkpoint_config', files['show_config']);
                    if (files['objects_zip']) formData.append('checkpoint_csv_zip', files['objects_zip']); // Note: API expects checkpoint_csv_zip for zip? Or objects_zip?
                    // Legacy Step2_Mapping uses 'checkpoint_csv_zip' for the zip file.
                    // Legacy Step1_Upload defined key as 'objects_zip' in fileConfig but assumed same key?
                    // Let's use 'checkpoint_csv_zip' to match Step2_Mapping logic.
                } else if (uploadData.file) {
                    formData.append('config_file', uploadData.file);
                }

                const data = await analyzeConfig(formData);
                console.log('[WizardContainer] Analysis complete:', data);

                // Save analysis data to context
                setUploadData({ analysisData: data });

                // Reset mappings to ensure Step 2 populates with new data
                setMappingData({ zones: {}, interfaces: {} });

                // Proceed
                nextStep();
            } catch (err: any) {
                console.error('Analysis failed:', err);
                setError(err.message || 'Analysis failed. Please check your files.');
            } finally {
                setIsProcessing(false);
            }
        }
        // Step 2 -> 3: Just proceed, Step 3 will handle conversion
        else {
            nextStep();
        }
    };

    const labels = getStepLabel();

    return (
        <div className="min-h-screen bg-gradient-brand-subtle flex items-center justify-center p-4 font-sans">
            {/* Floating Card Container */}
            <div
                className={clsx(
                    "w-full bg-white/90 backdrop-blur-xl rounded-2xl shadow-brand-lg flex flex-col overflow-hidden border border-white/50 relative transition-all duration-500 ease-in-out",
                    currentStep === 4 ? "max-w-[95vw] h-[90vh]" : "max-w-5xl h-[85vh]"
                )}
            >

                {/* Header (Pinned inside card) */}
                <div className="z-30 bg-white/50 backdrop-blur-md border-b border-gray-100">
                    <ProgressBar currentStep={currentStep} />
                </div>

                {/* Error Banner (Absolute, over content) */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="absolute top-[80px] left-0 right-0 z-20 px-6"
                        >
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 shadow-sm">
                                <span className="font-bold flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Error:
                                </span>
                                {error}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar relative bg-white/40">
                    <div className="max-w-4xl mx-auto px-8 py-8 min-h-full flex flex-col">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentStep}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3, ease: "easeOut" }}
                                className="flex-1 flex flex-col"
                            >
                                {children}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>

                {/* Footer (Pinned inside card) */}
                {currentStep !== 3 && (
                    <div className="z-30 bg-white/80 backdrop-blur-md border-t border-gray-100 p-6 flex justify-between items-center">
                        {/* Back Button */}
                        {canGoBack && labels.back ? (
                            <button
                                onClick={previousStep}
                                disabled={isProcessing}
                                className={clsx(
                                    'flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200',
                                    'text-gray-500 hover:text-gray-800 hover:bg-gray-100/50',
                                    'focus:outline-none disabled:opacity-30'
                                )}
                            >
                                <ArrowLeft className="w-4 h-4" />
                                {labels.back}
                            </button>
                        ) : (
                            <div />
                        )}

                        {/* Next Button */}
                        {labels.next && (
                            <button
                                onClick={handleNext}
                                disabled={!canGoNext || isProcessing}
                                className={clsx(
                                    'flex items-center gap-2 px-8 py-3 rounded-xl font-bold tracking-wide transition-all duration-300 transform',
                                    (canGoNext && !isProcessing)
                                        ? 'bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-brand hover:shadow-brand-lg hover:-translate-y-0.5'
                                        : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-100',
                                )}
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Processing...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>{labels.next}</span>
                                        <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default WizardContainer;
