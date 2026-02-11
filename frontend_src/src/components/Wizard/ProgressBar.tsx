import React from 'react';
import { Check } from 'lucide-react';
import clsx from 'clsx';
import { WizardStep } from '../../hooks/useWizardState';

interface Step {
    id: WizardStep;
    label: string;
    description: string;
}

interface ProgressBarProps {
    currentStep: WizardStep;
    onStepClick?: (step: WizardStep) => void;
    allowSkip?: boolean;
}

const steps: Step[] = [
    { id: 1, label: 'Upload', description: 'Select your configuration file' },
    { id: 2, label: 'Configure', description: 'Map zones and interfaces' },
    { id: 3, label: 'Convert', description: 'Processing your configuration' },
    { id: 4, label: 'Results', description: 'View and download results' },
];

const ProgressBar: React.FC<ProgressBarProps> = ({
    currentStep,
    onStepClick,
    allowSkip = false
}) => {
    const handleStepClick = (step: Step) => {
        if (!onStepClick || !allowSkip) return;
        if (step.id <= currentStep) {
            onStepClick(step.id);
        }
    };

    return (
        <div className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
            <div className="max-w-7xl mx-auto px-6 py-6">
                {/* Step indicators */}
                <div className="relative">
                    {/* Progress line */}
                    <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200">
                        <div
                            className="h-full bg-brand-500 transition-all duration-500 ease-out"
                            style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
                        />
                    </div>

                    {/* Steps */}
                    <div className="relative flex justify-between">
                        {steps.map((step) => {
                            const isActive = step.id === currentStep;
                            const isCompleted = step.id < currentStep;
                            const isClickable = allowSkip && step.id <= currentStep;

                            return (
                                <div
                                    key={step.id}
                                    className="flex flex-col items-center flex-1"
                                    onClick={() => handleStepClick(step)}
                                >
                                    {/* Circle indicator */}
                                    <div
                                        className={clsx(
                                            'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 mb-3',
                                            'border-2 font-bold text-sm',
                                            isClickable && 'cursor-pointer hover:scale-110',
                                            isCompleted && 'bg-brand-500 border-brand-500 text-white',
                                            isActive && !isCompleted && 'bg-white border-brand-500 text-brand-500 ring-4 ring-brand-100',
                                            !isActive && !isCompleted && 'bg-white border-gray-300 text-gray-400'
                                        )}
                                    >
                                        {isCompleted ? (
                                            <Check className="w-5 h-5" />
                                        ) : (
                                            step.id
                                        )}
                                    </div>

                                    {/* Label */}
                                    <div className="text-center">
                                        <div
                                            className={clsx(
                                                'text-sm font-bold transition-colors',
                                                isActive && 'text-brand-700',
                                                isCompleted && 'text-brand-600',
                                                !isActive && !isCompleted && 'text-gray-400'
                                            )}
                                        >
                                            {step.label}
                                        </div>
                                        <div
                                            className={clsx(
                                                'text-xs mt-1 transition-colors max-w-[120px]',
                                                isActive && 'text-brand-600',
                                                isCompleted && 'text-gray-500',
                                                !isActive && !isCompleted && 'text-gray-400'
                                            )}
                                        >
                                            {step.description}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProgressBar;
