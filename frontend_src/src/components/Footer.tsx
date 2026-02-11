import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-brand-100 h-8 flex items-center justify-between px-4 text-[10px] text-gray-500 font-mono">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
          Ready
        </span>
        <span className="text-gray-300">|</span>
        <span>Last saved: Today, {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>

      <div className="flex items-center gap-4">
        <span>Memory: 45MB</span>
        <span className="text-gray-300">|</span>
        <span>v2.0.0-stable</span>
      </div>
    </footer>
  );
};

export default Footer;
