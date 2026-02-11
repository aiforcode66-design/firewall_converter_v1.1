import React from 'react';
import { Cpu } from 'lucide-react';

interface LoadingOverlayProps {
  isVisible: boolean;
  text?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isVisible, text = 'Processing...' }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/90 backdrop-blur-md flex flex-col items-center justify-center z-[100] transition-opacity duration-300 animate-fade-in">
      <div className="relative">
        <div className="w-20 h-20 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <Cpu className="text-brand-500 w-8 h-8 animate-pulse" />
        </div>
      </div>
      <h3 className="mt-8 text-2xl font-bold text-white tracking-wide">Processing</h3>
      <p className="text-gray-400 text-sm mt-2 font-mono">{text}</p>
    </div>
  );
};

export default LoadingOverlay;
