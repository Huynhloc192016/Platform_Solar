import React, { useEffect } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { LayoutDashboard, Activity, History, Users, Shield, Zap } from 'lucide-react';
import Dashboard from '../../pages/dashboard/Dashboard';
import StationManagement from '../../pages/stations/StationManagement';
import OwnerManagement from '../../pages/stations/OwnerManagement';
import ChargePointManagement from '../../pages/stations/ChargePointManagement';
import StationLivePage from '../../pages/stations/StationLivePage';
import ServicePage from '../../pages/live/ServicePage';
import SessionManagement from '../../pages/transactions/SessionManagement';
import OrderManagement from '../../pages/transactions/OrderManagement';
import ExportOrdersPage from '../../pages/transactions/ExportOrdersPage';
import TransactionSummary from '../../pages/transactions/TransactionSummary';
import UserManagement from '../../pages/users/UserManagement';
import VnpayTopUp from '../../pages/users/VnpayTopUp';
import RevenueByPeriod from '../../pages/users/RevenueByPeriod';
import ReportsPage from '../../pages/reports/ReportsPage';
import ActivityHistoryPage from '../../pages/accounts/ActivityHistoryPage';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const tabConfigs = [
  { value: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard, path: '/dashboard' },
  { value: 'stations', label: 'Trạm sạc', icon: Activity, path: '/stations' },
  { value: 'live', label: 'Live', icon: Zap, path: '/live' },
  { value: 'transactions', label: 'Giao dịch', icon: History, path: '/transactions' },
  { value: 'users', label: 'Người dùng', icon: Users, path: '/users' },
  { value: 'accounts', label: 'Tiện Ích', icon: Shield, path: '/accounts' },
];

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const isOwner = !!user?.ownerId;
  const visibleTabs = isOwner ? tabConfigs.filter((t) => ['dashboard', 'stations', 'live', 'transactions'].includes(t.value)) : tabConfigs;

  // Đóng sidebar trên mobile khi chuyển trang
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (isOwner && ['/users', '/accounts', '/stations/owners'].includes(location.pathname)) {
      navigate('/dashboard', { replace: true });
    }
  }, [isOwner, location.pathname, navigate]);

  const activeTab =
    visibleTabs.find((tab) => tab.path === location.pathname)?.value ||
    (location.pathname === '/live' || location.pathname.startsWith('/live/')
      ? 'live'
      : location.pathname.startsWith('/stations')
        ? 'stations'
        : location.pathname.startsWith('/transactions')
          ? 'transactions'
          : location.pathname.startsWith('/users')
            ? 'users'
            : location.pathname.startsWith('/dashboard')
              ? 'dashboard'
              : 'dashboard');

  const handleTabChange = (value) => {
    const tab = visibleTabs.find((t) => t.value === value);
    if (tab) {
      const path =
        tab.value === 'transactions'
          ? '/transactions/orders'
          : tab.value === 'live'
            ? '/live'
            : tab.path;
      navigate(path);
    }
  };

  return (
    <div className="h-screen overflow-y-auto overflow-x-hidden bg-slate-50 max-w-full">
      <Header onMenuClick={() => setSidebarOpen((v) => !v)} />
      <div className="flex min-w-0">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} mainTabs={visibleTabs} />
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-8 lg:ml-64">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full min-w-0">
            <div className="hidden lg:block sticky top-[73px] z-10 bg-slate-50 overflow-x-auto mb-8 -mx-1 px-1 w-full">
              <TabsList className="flex w-full min-w-0">
                {visibleTabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 [&>span]:hidden [&>span]:sm:inline"
                      title={tab.label}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{tab.label}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            <TabsContent value="dashboard" className="mt-0">
              {location.pathname === '/dashboard/reports' ? <ReportsPage /> : <Dashboard />}
            </TabsContent>
            <TabsContent value="stations" className="mt-0">
              {location.pathname === '/stations/owners' ? (
                <OwnerManagement />
              ) : location.pathname === '/stations/chargepoints' ? (
                <ChargePointManagement />
              ) : (
                <StationManagement />
              )}
            </TabsContent>
            <TabsContent value="live" className="mt-0">
              {location.pathname === '/live/service' ? (
                <ServicePage />
              ) : (
                <StationLivePage />
              )}
            </TabsContent>
            <TabsContent value="transactions" className="mt-0">
              {location.pathname === '/transactions/summary' ? (
                <TransactionSummary />
              ) : location.pathname === '/transactions/orders' ? (
                <OrderManagement />
              ) : location.pathname === '/transactions/sessions' ? (
                <SessionManagement />
              ) : location.pathname === '/transactions/export' ? (
                <ExportOrdersPage />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Giao dịch - Đang phát triển
                </div>
              )}
            </TabsContent>
            <TabsContent value="users" className="mt-0">
              {location.pathname === '/users/vnpay' ? (
                <VnpayTopUp />
              ) : location.pathname === '/users/revenue' ? (
                <RevenueByPeriod />
              ) : (
                <UserManagement />
              )}
            </TabsContent>
            <TabsContent value="accounts" className="mt-0">
              <ActivityHistoryPage />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default Layout;
