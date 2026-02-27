import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Building2, Activity, Zap, Receipt, Clock, Users } from 'lucide-react';
import { cn } from '../ui/utils';
import { useAuth } from '../../context/AuthContext';

const stationsSidebarItems = [
  { label: 'Danh sách chủ đầu tư', path: '/stations/owners', icon: Building2 },
  { label: 'Danh sách trạm', path: '/stations', icon: Activity },
  { label: 'Danh sách trụ', path: '/stations/chargepoints', icon: Zap },
];

const transactionsSidebarItems = [
  { label: 'Quản lý đơn sạc', path: '/transactions/orders', icon: Receipt },
  { label: 'Quản lý phiên sạc', path: '/transactions/sessions', icon: Clock },
];

const usersSidebarItems = [{ label: 'Quản lý người dùng', path: '/users', icon: Users }];

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOwner = !!user?.ownerId;
  const stationsItems = isOwner ? stationsSidebarItems.filter((item) => item.path !== '/stations/owners') : stationsSidebarItems;
  const isStationsSection = location.pathname.startsWith('/stations');
  const isTransactionsSection = location.pathname.startsWith('/transactions');
  const isUsersSection = location.pathname.startsWith('/users');

  return (
    <aside className="w-64 bg-white border-r border-slate-200 fixed left-0 top-[73px] h-[calc(100vh-73px)] flex-shrink-0 z-[1]">
      {isStationsSection && (
        <nav className="p-4 space-y-1">
          <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Quản lý trạm sạc
          </p>
          {stationsItems.map((item) => {
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
      {isTransactionsSection && (
        <nav className="p-4 space-y-1">
          <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Giao dịch
          </p>
          {transactionsSidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
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
      {isUsersSection && (
        <nav className="p-4 space-y-1">
          <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Người dùng
          </p>
          {usersSidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
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
