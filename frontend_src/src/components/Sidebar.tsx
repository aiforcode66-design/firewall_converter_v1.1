import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileCode,
  Settings,
  FileText,
  History,
  LucideIcon
} from 'lucide-react';

interface NavItem {
  name: string;
  path: string;
  icon: LucideIcon;
  end?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

interface SidebarProps {
  onReset?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onReset }) => {
  const navItems: NavSection[] = [
    {
      label: 'Project Navigation',
      items: [
        {
          name: 'Dashboard',
          path: '/',
          icon: LayoutDashboard,
          end: true,
          onClick: onReset
        },
        { name: 'Source Config', path: '/source-config', icon: FileCode },
        { name: 'History', path: '/history', icon: History },
      ]
    },
    {
      label: 'System',
      items: [
        { name: 'Settings', path: '/settings', icon: Settings, disabled: true },
        { name: 'Logs', path: '/results/logs', icon: FileText },
      ]
    }
  ];

  return (
    <aside className="w-64 bg-white/80 backdrop-blur-xl border-r border-brand-100 flex flex-col h-full shrink-0 shadow-soft z-30">
      <div className="p-6">
        <h2 className="text-xs font-bold text-brand-500/50 uppercase tracking-widest mb-4 pl-3 font-sans">
          Project Navigation
        </h2>
        <nav className="space-y-2">
          {navItems[0].items.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              end={item.end}
              onClick={item.onClick}
              className={({ isActive }) => `
                flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 group
                ${isActive
                  ? 'bg-gradient-to-r from-brand-50 to-white text-brand-700 shadow-sm border border-brand-200'
                  : 'text-gray-600 hover:bg-white hover:text-gray-900 hover:shadow-sm'
                }
              `}
            >
              <item.icon className="w-4 h-4 transition-colors" />
              <span className="font-sans tracking-wide">{item.name}</span>
            </NavLink>
          ))}
        </nav>

        <h2 className="text-xs font-bold text-brand-500/50 uppercase tracking-widest mt-10 mb-4 pl-3 font-sans">
          System
        </h2>
        <nav className="space-y-2">
          {navItems[1].items.map((item) => (
            <div key={item.name}>
              {item.disabled ? (
                <div className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl text-gray-400 cursor-not-allowed">
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </div>
              ) : (
                <NavLink
                  to={item.path}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 group
                    ${isActive
                      ? 'bg-gradient-to-r from-brand-50 to-white text-brand-700 shadow-sm border border-brand-200'
                      : 'text-gray-600 hover:bg-white hover:text-gray-900 hover:shadow-sm'
                    }
                  `}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="font-sans tracking-wide">{item.name}</span>
                </NavLink>
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* Status indicator at bottom */}
      <div className="mt-auto p-6">
        <div className="bg-gradient-to-br from-brand-50 to-orange-50 rounded-2xl p-4 border border-brand-100 shadow-sm">
          <p className="text-xs font-medium text-gray-700 mb-1">Status: Stable</p>
          <div className="w-full bg-brand-100 rounded-full h-1.5 overflow-hidden">
            <div className="bg-brand-500 h-full rounded-full w-full animate-pulse"></div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
