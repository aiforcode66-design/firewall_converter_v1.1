import React, { useState } from 'react';
import { Shield, Bell } from 'lucide-react';

interface Notification {
  id: number;
  title: string;
  desc: string;
  time: string;
  active: boolean;
}

const Header: React.FC = () => {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const [notifications, setNotifications] = useState<Notification[]>([
    { id: 1, title: 'Analysis Complete', desc: 'Cisco ASA config analysis finished successfully', time: '2m ago', active: true },
    { id: 2, title: 'System Update', desc: 'Converter v2.0 is now live with new migration engine', time: '1h ago', active: false },
    { id: 3, title: 'Welcome', desc: 'Welcome to the new Firewall Converter', time: '1d ago', active: false },
  ]);

  const unreadCount = notifications.filter(n => n.active).length;

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, active: false })));
  };

  return (
    <header className="h-20 bg-white/80 backdrop-blur-xl border-b border-brand-100 flex items-center justify-between px-8 shrink-0 z-20 shadow-sm transition-all duration-300">
      {/* Left: Brand & Title */}
      <div className="flex items-center gap-12">
        {/* Logo Area */}
        <div className="flex items-center gap-4 group cursor-pointer">
          <div className="bg-gradient-to-br from-brand-400 to-brand-600 w-10 h-10 rounded-xl flex items-center justify-center shadow-brand text-white transform group-hover:rotate-6 transition-transform duration-300">
            <Shield className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-brand-600 leading-none tracking-tight">Converter.Pro</h1>
            <span className="text-[10px] font-bold text-brand-500/60 uppercase tracking-[0.15em] mt-1 pl-0.5">Enterprise Edition</span>
          </div>
        </div>

        {/* Breadcrumbs */}
        <div className="hidden md:flex items-center gap-2 text-sm text-gray-600 font-medium">
          <span className="hover:text-gray-900 cursor-pointer transition-colors">Projects</span>
          <span className="text-gray-300">/</span>
          <span className="hover:text-gray-900 cursor-pointer transition-colors">Migration</span>
          <span className="text-gray-300">/</span>
          <span className="flex items-center gap-2 text-gray-900 font-bold bg-white px-3 py-1 rounded-full border border-brand-100 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse"></span>
            Firewall Converter
          </span>
        </div>
      </div>

      {/* Right: Status & Actions */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 px-4 py-1.5 bg-brand-50 border border-brand-100 rounded-full backdrop-blur-sm">
          <div className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse"></div>
          <span className="text-xs font-bold text-brand-700 tracking-wide">SYS_ONLINE</span>
        </div>

        <div className="relative">
          <button
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="relative p-2.5 text-gray-600 hover:text-brand-600 hover:bg-white transition-all outline-none focus:ring-2 focus:ring-brand-200 rounded-xl"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2.5 w-2 h-2 bg-rose-500 rounded-full border border-white shadow-sm"></span>
            )}
          </button>

          {/* Notification Dropdown */}
          {isNotificationsOpen && (
            <div className="absolute right-0 mt-4 w-96 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl shadow-gray-900/10 border border-brand-100 py-2 z-50 animate-fade-in origin-top-right">
              <div className="px-5 py-3 border-b border-brand-100 flex justify-between items-center">
                <h3 className="font-bold text-gray-900 text-base">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="text-[10px] text-white font-bold bg-brand-500 px-2 py-0.5 rounded-full shadow-sm">{unreadCount} New</span>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto custom-scrollbar">
                {notifications.map((notif) => (
                  <div key={notif.id} className={`px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-100 last:border-0 ${notif.active ? 'bg-brand-50/50' : ''}`}>
                    <div className="flex justify-between items-start mb-1.5">
                      <p className={`text-sm font-semibold ${notif.active ? 'text-brand-600' : 'text-gray-700'}`}>{notif.title}</p>
                      <span className="text-[10px] text-gray-400 font-mono">{notif.time}</span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed font-medium">{notif.desc}</p>
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 border-t border-brand-100 bg-brand-50/30 text-center rounded-b-2xl">
                <button
                  onClick={markAllAsRead}
                  className={`text-xs font-bold uppercase tracking-wider ${unreadCount > 0 ? 'text-brand-600 hover:text-brand-700' : 'text-gray-400 cursor-default'}`}
                  disabled={unreadCount === 0}
                >
                  Mark all as read
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </header>
  );
};

export default Header;
