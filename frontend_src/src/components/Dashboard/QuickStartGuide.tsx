import React from 'react';
import { Upload, Code, Play, LucideIcon } from 'lucide-react';

interface Step {
  id: number;
  title: string;
  desc: string;
  icon: LucideIcon;
  color: string;
}

const QuickStartGuide: React.FC = () => {
  const steps: Step[] = [
    {
      id: 1,
      title: 'Upload Configuration',
      desc: 'Upload your source firewall config file',
      icon: Upload,
      color: 'bg-brand-500'
    },
    {
      id: 2,
      title: 'Map Interfaces & Zones',
      desc: 'Review and customize interface/zone mappings',
      icon: Code,
      color: 'bg-orange-500'
    },
    {
      id: 3,
      title: 'Review & Download',
      desc: 'Download converted configuration and CLI script',
      icon: Play,
      color: 'bg-amber-600'
    },
  ];

  return (
    <div className="bg-white rounded-3xl border border-brand-100 shadow-card p-6 flex flex-col h-full">
      <h3 className="font-bold text-gray-900 text-lg mb-6">Quick Start Guide</h3>

      <div className="space-y-4">
        {steps.map((step) => (
          <div key={step.id} className="flex gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors group cursor-default">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm text-white font-bold text-sm ${step.color}`}>
              {step.id}
            </div>
            <div>
              <h4 className="font-bold text-gray-900 text-sm group-hover:text-brand-600 transition-colors">{step.title}</h4>
              <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuickStartGuide;
