import React from 'react';
import { Sparkles, ArrowRight, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const WelcomeHero = () => {
  const navigate = useNavigate();

  return (
    <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-brand-500/20 group">
      {/* Background with Gradient and Abstract Shapes */}
      <div className="absolute inset-0 bg-gradient-to-r from-brand-900 via-orange-900 to-brand-950">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-white/10 transition-all duration-700"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4"></div>
      </div>

      <div className="relative z-10 px-10 py-12 flex flex-col md:flex-row items-center justify-between gap-8 text-white">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 mb-3 animate-fade-in">
            <span className="text-2xl">👋</span>
            <h2 className="text-3xl font-serif font-bold tracking-tight">Good Morning!</h2>
          </div>
          <p className="text-brand-100 text-lg mb-8 font-medium leading-relaxed">
            Ready to convert your firewall configurations? The new engine is optimized for high-performance processing.
          </p>

          <button
            onClick={() => navigate('/source-config')}
            className="group flex items-center gap-3 bg-white text-brand-900 px-6 py-3.5 rounded-xl font-bold hover:bg-brand-50 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-brand-900/20"
          >
            <Zap className="w-5 h-5 text-brand-600 fill-brand-600 group-hover:text-brand-500" />
            <span>Start New Conversion</span>
            <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Decorative Icon */}
        <div className="hidden md:flex items-center justify-center w-24 h-24 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner hover:scale-105 transition-transform duration-500">
          <Sparkles className="w-10 h-10 text-yellow-300 drop-shadow-md" />
        </div>
      </div>
    </div>
  );
};

export default WelcomeHero;
