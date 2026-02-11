import React from 'react';
import { useWizardState, WizardProvider } from '../hooks/useWizardState';
import WizardContainer from '../components/Wizard/WizardContainer.tsx';
import WizardStep1_Upload from '../components/Wizard/WizardStep1_Upload.tsx';
import WizardStep2_Configure from '../components/Wizard/WizardStep2_Configure.tsx';
import WizardStep3_Processing from '../components/Wizard/WizardStep3_Processing.tsx';
import WizardStep4_Results from '../components/Wizard/WizardStep4_Results.tsx';

const WizardPageContent: React.FC = () => {
    const { currentStep } = useWizardState();

    const renderStep = () => {
        switch (currentStep) {
            case 1:
                return <WizardStep1_Upload />;
            case 2:
                return <WizardStep2_Configure />;
            case 3:
                return <WizardStep3_Processing />;
            case 4:
                return <WizardStep4_Results />;
            default:
                return <WizardStep1_Upload />;
        }
    };

    return (
        <WizardContainer>
            {renderStep()}
        </WizardContainer>
    );
};

const WizardPage: React.FC = () => {
    return (
        <WizardProvider>
            <WizardPageContent />
        </WizardProvider>
    );
};

export default WizardPage;
