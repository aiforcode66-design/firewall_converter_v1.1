import React from 'react';
import WelcomeHero from './WelcomeHero';
import QuickStats from './QuickStats';
import RecentConversions from './RecentConversions';
import QuickStartGuide from './QuickStartGuide';
import SystemHealth from './SystemHealth';

const Dashboard: React.FC = () => {
  return (
    <div className="flex flex-col gap-6 p-6 bg-gradient-brand-subtle min-h-screen">
      {/* Welcome Hero Section */}
      <WelcomeHero />

      {/* Quick Stats Row */}
      <QuickStats />

      {/* Recent Conversions Table */}
      <RecentConversions />

      {/* Bottom Section: Quick Start Guide + System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QuickStartGuide />
        <SystemHealth />
      </div>
    </div>
  );
};

export default Dashboard;
