import React from 'react';
import { CheckCircle, AlertTriangle, XCircle, TrendingUp, LucideIcon } from 'lucide-react';
import FindingsDetail from './FindingsDetail';

interface Score {
  overall: number;
  security: number;
  optimization: number;
  complexity: number;
}

interface Statistics {
  total_objects: number;
  total_rules: number;
  total_nat_rules: number;
}

interface AnalysisData {
  scores: Score;
  findings: {
    duplicates?: any[];
    overlaps?: any[];
    risks?: any[];
    unused?: string[];
  };
  recommendations?: string[];
  statistics: Statistics;
}

interface AnalysisReportProps {
  analysis?: AnalysisData;
}

interface ScoreCardProps {
  title: string;
  score: number;
  icon: React.ReactNode;
  primary?: boolean;
}

interface StatCardProps {
  label: string;
  value: number;
}

const AnalysisReport: React.FC<AnalysisReportProps> = ({ analysis }) => {
  if (!analysis) return null;

  const { scores, findings, recommendations, statistics } = analysis;

  return (
    <div className="space-y-6 mb-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-bold text-brand-950">Pre-Migration Analysis</h2>
          <p className="text-sm text-brand-800/60 mt-1 font-medium">
            Configuration Health Scoring & Optimization Recommendations
          </p>
        </div>
        <div className="px-4 py-1.5 bg-brand-50 border border-brand-200 rounded-full text-brand-600 text-xs font-bold tracking-wide uppercase flex items-center gap-2 shadow-sm">
          <TrendingUp className="w-3.5 h-3.5" /> AI-Powered Analysis
        </div>
      </div>

      {/* Score Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ScoreCard
          title="Overall Health"
          score={scores.overall}
          icon={<TrendingUp className="w-5 h-5" />}
          primary
        />
        <ScoreCard
          title="Security"
          score={scores.security}
          icon={<AlertTriangle className="w-5 h-5" />}
        />
        <ScoreCard
          title="Optimization"
          score={scores.optimization}
          icon={<CheckCircle className="w-5 h-5" />}
        />
        <ScoreCard
          title="Complexity"
          score={scores.complexity}
          icon={<XCircle className="w-5 h-5" />}
        />
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Objects" value={statistics.total_objects} />
        <StatCard label="Security Rules" value={statistics.total_rules} />
        <StatCard label="NAT Rules" value={statistics.total_nat_rules} />
      </div>

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-5 shadow-sm backdrop-blur-sm">
          <h3 className="text-sm font-bold text-amber-900 mb-3 flex items-center gap-2 uppercase tracking-wide">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Recommendations
          </h3>
          <div className="space-y-2.5">
            {recommendations.map((rec, idx) => (
              <div key={idx} className="text-sm text-brand-900/80 flex items-start gap-2.5">
                <span className="text-amber-400 mt-1.5">â€¢</span>
                <span className="leading-relaxed">{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Findings Tabs */}
      <FindingsDetail findings={findings} />
    </div>
  );
};

const ScoreCard: React.FC<ScoreCardProps> = ({ title, score, icon, primary = false }) => {
  const getColorClasses = (score: number) => {
    if (score >= 80) return { text: 'text-brand-500', bg: 'bg-brand-500', badge: 'bg-brand-50 text-brand-700' };
    if (score >= 60) return { text: 'text-amber-500', bg: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700' };
    return { text: 'text-rose-500', bg: 'bg-rose-500', badge: 'bg-rose-50 text-rose-700' };
  };

  const colors = getColorClasses(score);

  return (
    <div className={`bg-white/70 backdrop-blur-md border border-brand-100 rounded-2xl p-5 transition-all hover:shadow-lg hover:-translate-y-1 group duration-300 shadow-sm`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-brand-900/50 text-xs font-bold uppercase tracking-wider">{title}</span>
        <span className={`${colors.text} bg-white rounded-full p-1 shadow-sm opacity-80 group-hover:opacity-100 transition-opacity`}>{icon}</span>
      </div>
      <div className={`text-4xl font-serif font-bold ${colors.text} flex items-baseline gap-1`}>
        {score}
        <span className="text-sm font-sans font-medium text-brand-900/30">/100</span>
      </div>
      <div className="mt-3 bg-brand-100/50 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full ${colors.bg} transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(0,0,0,0.1)]`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
};

const StatCard: React.FC<StatCardProps> = ({ label, value }) => {
  return (
    <div className="bg-brand-50/50 border border-brand-100 rounded-xl p-4 flex flex-col gap-1 hover:bg-brand-50/80 transition-colors">
      <div className="text-xs font-medium text-brand-700/60 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold text-brand-950 font-serif">{value.toLocaleString()}</div>
    </div>
  );
};

export default AnalysisReport;
