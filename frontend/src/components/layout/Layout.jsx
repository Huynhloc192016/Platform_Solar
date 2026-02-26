import React from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { LayoutDashboard, Activity, History, Users, Shield } from 'lucide-react';
import Dashboard from '../../pages/dashboard/Dashboard';
import StationManagement from '../../pages/stations/StationManagement';
import OwnerManagement from '../../pages/stations/OwnerManagement';
import ChargePointManagement from '../../pages/stations/ChargePointManagement';
import { useLocation, useNavigate } from 'react-router-dom';

const tabConfigs = [
  { value: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard, path: '/dashboard' },
  { value: 'stations', label: 'Trạm sạc', icon: Activity, path: '/stations' },
  { value: 'transactions', label: 'Giao dịch', icon: History, path: '/transactions' },
  { value: 'users', label: 'Người dùng', icon: Users, path: '/users' },
  { value: 'accounts', label: 'Tài khoản', icon: Shield, path: '/accounts' },
];

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const activeTab =
    tabConfigs.find((tab) => tab.path === location.pathname)?.value ||
    (location.pathname.startsWith('/stations') ? 'stations' : 'dashboard');

  const handleTabChange = (value) => {
    const tab = tabConfigs.find((t) => t.value === value);
    if (tab) {
      navigate(tab.path);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8 ml-64">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <div className="overflow-x-auto mb-8">
              <TabsList className="inline-flex w-auto min-w-full">
                {tabConfigs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="flex items-center gap-2"
                    >
                      <Icon className="w-4 h-4" />
                      <span>{tab.label}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            <TabsContent value="dashboard" className="mt-0">
              <Dashboard />
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
            <TabsContent value="transactions" className="mt-0">
              <div className="text-center py-8 text-muted-foreground">
                Giao dịch - Đang phát triển
              </div>
            </TabsContent>
            <TabsContent value="users" className="mt-0">
              <div className="text-center py-8 text-muted-foreground">
                Người dùng - Đang phát triển
              </div>
            </TabsContent>
            <TabsContent value="accounts" className="mt-0">
              <div className="text-center py-8 text-muted-foreground">
                Tài khoản - Đang phát triển
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default Layout;
