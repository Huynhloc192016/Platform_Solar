import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Building2, Activity, Zap } from 'lucide-react';
import { cn } from '../ui/utils';

const stationsSidebarItems = [
  { label: 'Danh sách chủ đầu tư', path: '/stations/owners', icon: Building2 },
  { label: 'Danh sách trạm', path: '/stations', icon: Activity },
  { label: 'Danh sách trụ', path: '/stations/chargepoints', icon: Zap },
];

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isStationsSection = location.pathname.startsWith('/stations');

  return (
    <aside className="w-64 bg-white border-r border-slate-200 min-h-[calc(100vh-73px)] sticky top-[73px] flex-shrink-0">
      {isStationsSection && (
        <nav className="p-4 space-y-1">
          <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Quản lý trạm sạc
          </p>
          {stationsSidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.path === '/stations'
                ? location.pathname === '/stations'
                : location.pathname.startsWith(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>
      )}
    </aside>
  );
};

export default Sidebar;
