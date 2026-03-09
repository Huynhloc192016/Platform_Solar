import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Building2, Activity, Zap, Receipt, Clock, Users, BarChart3, LayoutDashboard, FileDown, Radio, X, LogOut, ChevronDown, Shield, Mail, CreditCard, Calendar } from 'lucide-react';
import { cn } from '../ui/utils';
import { useAuth } from '../../context/AuthContext';
import logo from '../../img/logo.png';

const stationsSidebarItems = [
  { label: 'Danh sách chủ đầu tư', path: '/stations/owners', icon: Building2 },
  { label: 'Danh sách trạm', path: '/stations', icon: Activity },
  { label: 'Danh sách trụ', path: '/stations/chargepoints', icon: Zap },
];

const liveSidebarItems = [
  { label: 'Trạng thái trực tuyến', path: '/live', icon: Radio },
  { label: 'Service', path: '/live/service', icon: Mail },
];

const transactionsSidebarItems = [
  { label: 'Tổng hợp sạc và tiêu thụ', path: '/transactions/summary', icon: BarChart3 },
  { label: 'Quản lý đơn sạc', path: '/transactions/orders', icon: Receipt },
  { label: 'Quản lý phiên sạc', path: '/transactions/sessions', icon: Clock },
  { label: 'Báo cáo đơn sạc', path: '/transactions/export', icon: FileDown },
];

const usersSidebarItems = [
  { label: 'Quản lý người dùng', path: '/users', icon: Users },
  { label: 'Thanh toán nạp tiền VNPay', path: '/users/vnpay', icon: CreditCard },
  { label: 'Doanh thu ngày tháng năm', path: '/users/revenue', icon: Calendar },
];

const accountsSidebarItems = [{ label: 'Tài khoản', path: '/accounts', icon: Shield }];

const dashboardSidebarItems = [
  { label: 'Tổng quan', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Báo cáo thống kê', path: '/dashboard/reports', icon: BarChart3 },
];

const getInitials = (name) => {
  if (!name) return 'U';
  const parts = name.split(' ').filter((p) => p.length > 0);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 2);
};

const getTabPath = (tab) => (tab.value === 'transactions' ? '/transactions/orders' : tab.path);

const Sidebar = ({ open = false, onClose, mainTabs = [] }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isOwner = !!user?.ownerId;

  const handleLogout = () => {
    onClose?.();
    logout();
    window.location.href = '/login';
  };
  const stationsItems = isOwner ? stationsSidebarItems.filter((item) => item.path !== '/stations/owners') : stationsSidebarItems;
  const [expandedSection, setExpandedSection] = React.useState(null);

  const getChildrenForTab = (tabValue) => {
    switch (tabValue) {
      case 'dashboard':
        return dashboardSidebarItems;
      case 'stations':
        return stationsItems;
      case 'live':
        return liveSidebarItems;
      case 'transactions':
        return transactionsSidebarItems;
      case 'users':
        return usersSidebarItems;
      case 'accounts':
        return accountsSidebarItems;
      default:
        return [];
    }
  };

  const isDashboardSection = location.pathname.startsWith('/dashboard');
  const isStationsSection = location.pathname.startsWith('/stations');
  const isLiveSection = location.pathname.startsWith('/live');
  const isTransactionsSection = location.pathname.startsWith('/transactions');
  const isUsersSection = location.pathname.startsWith('/users');

  const handleNav = (path) => {
    navigate(path);
    onClose?.();
  };

  return (
    <>
      {/* Overlay mobile: click để đóng sidebar */}
      <div
        role="button"
        tabIndex={0}
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose?.()}
        className={cn(
          'fixed inset-0 bg-black/50 z-40 transition-opacity lg:hidden',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        aria-hidden="true"
      />
      <aside
        className={cn(
          'w-64 bg-white border-r border-slate-200 fixed left-0 flex flex-col flex-shrink-0 z-50 transition-transform duration-200 ease-out',
          'top-0 h-screen lg:top-[73px] lg:h-[calc(100vh-73px)]',
          open ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0 lg:z-[1]'
        )}
      >
        {/* Header tích hợp trong hamburger (chỉ mobile/tablet) */}
        <div className="lg:hidden border-b border-slate-200 p-4 pb-3 shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <img src={logo} alt="SolarEV" className="h-9 w-auto object-contain shrink-0" />
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-slate-900 truncate">SolarEV Platform</h2>
                <p className="text-xs text-slate-500 truncate">Hệ thống quản lý trạm sạc OCPP</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 shrink-0"
              aria-label="Đóng menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {user && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0"
                aria-hidden
              >
                <span className="text-blue-600 font-semibold text-sm">
                  {getInitials(user.fullName || user.username)}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 truncate">{user.fullName || user.username}</p>
                <p className="text-xs text-slate-500 truncate">{user.email || user.username || 'N/A'}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="shrink-0 p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                title="Đăng xuất"
                aria-label="Đăng xuất"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Điều hướng chính (các trang từ Header) - chỉ mobile/tablet, dropdown */}
        {mainTabs && mainTabs.length > 0 && (
          <nav className="lg:hidden border-b border-slate-200 p-4 space-y-0.5 shrink-0">
            <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Trang
            </p>
            {mainTabs.map((tab) => {
              const Icon = tab.icon;
              const path = getTabPath(tab);
              const children = getChildrenForTab(tab.value);
              const isExpanded = expandedSection === tab.value;
              const isParentActive =
                location.pathname === path ||
                (path !== '/live' && location.pathname.startsWith(path + '/'));

              if (children.length === 0) {
                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => handleNav(path)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      isParentActive
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    )}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {tab.label}
                  </button>
                );
              }

              return (
                <div key={tab.value} className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => setExpandedSection((prev) => (prev === tab.value ? null : tab.value))}
                    className={cn(
                      'w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      isParentActive
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    )}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{tab.label}</span>
                    </span>
                    <ChevronDown
                      className={cn('w-4 h-4 flex-shrink-0 transition-transform', isExpanded && 'rotate-180')}
                    />
                  </button>
                  {isExpanded && (
                    <div className="pl-6 pr-2 pb-1 space-y-0.5">
                      {children.map((item) => {
                        const ItemIcon = item.icon;
                        const isChildActive =
                          item.path === '/dashboard'
                            ? location.pathname === '/dashboard'
                            : location.pathname.startsWith(item.path);
                        return (
                          <button
                            key={item.path}
                            type="button"
                            onClick={() => handleNav(item.path)}
                            className={cn(
                              'w-full flex items-center gap-2 py-2 px-2 rounded-md text-xs font-medium transition-colors',
                              isChildActive
                                ? 'bg-slate-100 text-slate-900'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            )}
                          >
                            <ItemIcon className="w-4 h-4 flex-shrink-0" />
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        )}

        <div className="hidden lg:flex flex-1 min-h-0 overflow-y-auto">
      {isDashboardSection && (
        <nav className="p-4 space-y-1">
          <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Tổng quan
          </p>
          {dashboardSidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.path === '/dashboard'
                ? location.pathname === '/dashboard'
                : location.pathname.startsWith(item.path);
            return (
              <button
                key={item.path}
                onClick={() => handleNav(item.path)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 min-h-11 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="text-left leading-tight">{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}
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
                onClick={() => handleNav(item.path)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 min-h-11 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="text-left leading-tight">{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}
      {isLiveSection && (
        <nav className="p-4 space-y-1">
          <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Live
          </p>
          {liveSidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => handleNav(item.path)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 min-h-11 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="text-left leading-tight">{item.label}</span>
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
                onClick={() => handleNav(item.path)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 min-h-11 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="text-left leading-tight">{item.label}</span>
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
                onClick={() => handleNav(item.path)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 min-h-11 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="text-left leading-tight">{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
