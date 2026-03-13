import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import { Progress } from '../../components/ui/progress';
import { Building2, User, Shield, Users, Battery, Activity, AlertCircle, Loader2 } from 'lucide-react';
import api from '../../services/api';
import Loading from '../../components/common/Loading';

// Helpers for formatting values on the dashboard
function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount || 0);
}

function formatEnergy(kWh) {
  return `${Number(kWh || 0).toFixed(1)} kWh`;
}

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalStations: 0,
    activeStations: 0,
    totalChargePoints: 0,
    availableChargePoints: 0,
    chargingChargePoints: 0,
    offlineChargePoints: 0,
    activeTransactions: 0,
    totalUsers: 0,
  });
  const [stations, setStations] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = !user?.Owner;
  const role = isAdmin ? 'Admin hệ thống' : 'Chủ đầu tư';

  useEffect(() => {
    fetchDashboardData();
    
    // Set up auto-refresh every 2 hours (2 * 60 * 60 * 1000 ms = 7,200,000 ms)
    const intervalId = setInterval(() => {
      fetchDashboardData();
    }, 2 * 60 * 60 * 1000); // 2 hours in milliseconds
    
    // Cleanup interval on component unmount
    return () => {
      clearInterval(intervalId);
    };
  }, []); // Empty dependency array - fetchDashboardData is stable

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [
        statsResponse,
        chargePointsResponse,
        transactionsResponse
      ] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/dashboard/stations/recent'),
        api.get('/dashboard/transactions')
      ]);

      if (statsResponse.data.success) {
        setStats(statsResponse.data.data);
      }
      if (chargePointsResponse.data.success) {
        setStations(chargePointsResponse.data.data);
      }
      if (transactionsResponse.data.success) {
        setTransactions(transactionsResponse.data.data);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
          {/* Stats Cards Row 1 */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tổng trạm sạc</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalStations}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.activeStations} đang hoạt động
              </p>
              <Progress value={stats.totalStations > 0 ? (stats.activeStations / stats.totalStations) * 100 : 0} className="mt-3" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tổng trụ sạc (ChargePoint)</CardTitle>
              <Battery className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalChargePoints}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.availableChargePoints} sẵn sàng • {stats.chargingChargePoints} đang sạc
              </p>
              <div className="flex gap-2 mt-3">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-xs">{stats.availableChargePoints}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-xs">{stats.chargingChargePoints}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                  <span className="text-xs">{stats.offlineChargePoints}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Giao dịch đang thực hiện</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeTransactions}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Đang sạc trên hệ thống
              </p>
              <Progress value={stats.totalChargePoints > 0 ? (stats.activeTransactions / stats.totalChargePoints) * 100 : 0} className="mt-3" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Người dùng</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Tổng số người dùng
              </p>
            </CardContent>
          </Card>
        </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Station Status */}
          <Card>
            <CardHeader>
              <CardTitle>Trạng thái trạm sạc</CardTitle>
              <CardDescription>Tình trạng thời gian thực của các trạm sạc</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : stations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Không có dữ liệu trạm sạc</p>
              ) : (
                <div className="space-y-3">
                  {stations.map((cp) => {
                    const statusLabel = cp.StationStatus === 1 ? 'Hoạt động' : 'Không hoạt động';
                    const statusClass = cp.StationStatus === 1 
                      ? 'bg-green-100 text-green-800 border-green-200' 
                      : 'bg-gray-100 text-gray-800 border-gray-200';
                    
                    return (
                      <div key={cp.ChargePointId} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                        <div className="flex-1 min-w-0 mr-3">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate flex-1" title={cp.StationName || 'N/A'}>
                              {cp.StationName || 'N/A'}
                            </p>
                            <Badge className={`${statusClass} shrink-0`}>{statusLabel}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {cp.Name || cp.ChargePointId} • {cp.OwnerName || 'N/A'}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-medium text-blue-600">
                            {cp.ChargePointState === 'Charging' ? 'Đang sạc' : 'Sẵn sàng'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {cp.chargerPower || 0}kW
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card>
            <CardHeader>
              <CardTitle>Giao dịch gần đây</CardTitle>
              <CardDescription>Các phiên sạc mới nhất</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Không có giao dịch gần đây</p>
              ) : (
                <div className="space-y-3">
                  {transactions.map((transaction) => {
                    const statusLabel = transaction.Status === 'active' ? 'Hoạt động' : 'Hoàn thành';
                    const statusClass = transaction.Status === 'active'
                      ? 'bg-green-100 text-green-800 border-green-200'
                      : 'bg-blue-100 text-blue-800 border-blue-200';
                    
                    return (
                      <div key={transaction.TransactionId} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                        <div className="flex-1 min-w-0 mr-3">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate flex-1" title={transaction.StationName || 'N/A'}>
                              {transaction.StationName || 'N/A'}
                            </p>
                            <Badge className={`${statusClass} shrink-0`}>{statusLabel}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {transaction.UserName || transaction.StartTagId || 'N/A'} • {transaction.ChargePointId || 'N/A'}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-medium text-blue-600">
                            {formatEnergy(transaction.EnergyUsed || 0)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(transaction.Cost || 0)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

          {/* OCPP Status Alert */}
          {stats.offlineChargePoints > 0 && (
            <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-600" />
                <CardTitle className="text-orange-900">Cảnh báo hệ thống</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-orange-800">
                Có {stats.offlineChargePoints} trụ sạc (ChargePoint) đang ngoại tuyến / không khả dụng. Vui lòng kiểm tra kết nối OCPP và trạng thái mạng.
              </p>
            </CardContent>
          </Card>
        )}

    </div>
  );
};

export default Dashboard;
