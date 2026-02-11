import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// Types
export type WizardStep = 1 | 2 | 3 | 4;

export interface UploadData {
    file: File | null;
    checkpointFiles?: Record<string, File | null>;
    sourceVendor: string;
    destVendor: string;
    analysisData?: any;
}

export interface MappingData {
    zones: Record<string, string>;
    interfaces: Record<string, string>;
    templateId?: string;
    generatorOptions?: Record<string, any>;
}

export interface ProcessingData {
    progress: number;
    logs: string[];
    sessionId: string;
}

export interface WizardState {
    currentStep: WizardStep;
    uploadData: UploadData;
    mappingData: MappingData;
    processingData: ProcessingData;
    resultsData: any | null;
}

interface WizardContextType {
    state: WizardState;
    currentStep: WizardStep;
    uploadData: UploadData;
    mappingData: MappingData;
    processingData: ProcessingData;
    resultsData: any | null;
    setCurrentStep: (step: WizardStep) => void;
    setUploadData: (data: Partial<UploadData>) => void;
    setMappingData: (data: Partial<MappingData>) => void;
    setProcessingData: (data: Partial<ProcessingData>) => void;
    setResultsData: (data: any) => void;
    nextStep: () => void;
    previousStep: () => void;
    resetWizard: () => void;
    canGoNext: boolean;
    canGoBack: boolean;
}

// Constants
const STORAGE_KEY = 'firewall_wizard_state';

const initialState: WizardState = {
    currentStep: 1,
    uploadData: {
        file: null,
        checkpointFiles: {},
        sourceVendor: '',
        destVendor: 'palo_alto',
    },
    mappingData: {
        zones: {},
        interfaces: {},
    },
    processingData: {
        progress: 0,
        logs: [],
        sessionId: '',
    },
    resultsData: null,
};

// Context
const WizardContext = createContext<WizardContextType | undefined>(undefined);

// Provider Component
export const WizardProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, setState] = useState<WizardState>(() => {
        // Try to restore from localStorage
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);

                    // Migration: Fix vendor IDs (paloalto -> palo_alto)
                    let destVendor = parsed.uploadData.destVendor;
                    if (destVendor === 'paloalto') destVendor = 'palo_alto';

                    return {
                        ...parsed,
                        uploadData: {
                            ...parsed.uploadData,
                            destVendor: destVendor,
                            file: null,
                            checkpointFiles: {},
                        },
                    };
                } catch (e) {
                    console.error('Failed to restore wizard state:', e);
                }
            }
        }
        return initialState;
    });

    // Auto-save to localStorage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const toSave = {
                ...state,
                uploadData: {
                    ...state.uploadData,
                    file: null,
                    checkpointFiles: {},
                },
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
        }
    }, [state]);

    const setCurrentStep = useCallback((step: WizardStep) => {
        setState(prev => ({ ...prev, currentStep: step }));
    }, []);

    const setUploadData = useCallback((data: Partial<UploadData>) => {
        setState(prev => ({
            ...prev,
            uploadData: { ...prev.uploadData, ...data },
        }));
    }, []);

    const setMappingData = useCallback((data: Partial<MappingData>) => {
        setState(prev => ({
            ...prev,
            mappingData: { ...prev.mappingData, ...data },
        }));
    }, []);

    const setProcessingData = useCallback((data: Partial<ProcessingData>) => {
        setState(prev => ({
            ...prev,
            processingData: { ...prev.processingData, ...data },
        }));
    }, []);

    const setResultsData = useCallback((data: any) => {
        setState(prev => ({ ...prev, resultsData: data }));
    }, []);

    const nextStep = useCallback(() => {
        setState(prev => ({
            ...prev,
            currentStep: Math.min(4, prev.currentStep + 1) as WizardStep,
        }));
    }, []);

    const previousStep = useCallback(() => {
        setState(prev => ({
            ...prev,
            currentStep: Math.max(1, prev.currentStep - 1) as WizardStep,
        }));
    }, []);

    const resetWizard = useCallback(() => {
        setState(initialState);
        if (typeof window !== 'undefined') {
            localStorage.removeItem(STORAGE_KEY);
        }
    }, []);

    const checkCanGoNext = () => {
        const { currentStep, uploadData } = state;

        switch (currentStep) {
            case 1:
                if (uploadData.sourceVendor === 'checkpoint') {
                    const checkpointFiles = uploadData.checkpointFiles || {};
                    const hasObjects = !!checkpointFiles['objects_5_0'];
                    const hasPolicy = !!checkpointFiles['policy'];
                    return !!uploadData.sourceVendor && hasObjects && hasPolicy;
                }
                return !!uploadData.file && !!uploadData.sourceVendor;
            case 2:
                // Mapping is now optional
                return true;
            case 3:
                return false;
            case 4:
                return false;
            default:
                return false;
        }
    };

    const checkCanGoBack = () => {
        return state.currentStep > 1 && state.currentStep !== 3;
    };

    const value: WizardContextType = {
        state,
        currentStep: state.currentStep,
        uploadData: state.uploadData,
        mappingData: state.mappingData,
        processingData: state.processingData,
        resultsData: state.resultsData,
        setCurrentStep,
        setUploadData,
        setMappingData,
        setProcessingData,
        setResultsData,
        nextStep,
        previousStep,
        resetWizard,
        canGoNext: checkCanGoNext(),
        canGoBack: checkCanGoBack(),
    };

    return (
        <WizardContext.Provider value={value}>
            {children}
        </WizardContext.Provider>
    );
};

// Hook to use the context
export function useWizardState() {
    const context = useContext(WizardContext);
    if (context === undefined) {
        throw new Error('useWizardState must be used within a WizardProvider');
    }
    return context;
}
