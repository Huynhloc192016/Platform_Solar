import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';
import { CalendarRange, RefreshCw, Zap, TrendingUp, Activity, Building2 } from 'lucide-react';
import api from '../../services/api';

const DEFAULT_DAYS = 30;

const ReportsPage = () => {
  const [filters, setFilters] = useState(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - DEFAULT_DAYS);
    return {
      from: toDateInputValue(from),
      to: toDateInputValue(to),
      stationId: '',
      ownerId: '',
      chargePointId: '',
    };
  });

  // Tắt/mở việc áp dụng bộ lọc (form sẽ ẩn khi tắt)
  const [filtersEnabled, setFiltersEnabled] = useState(() => {
    try {
      const raw = localStorage.getItem('reports.filtersEnabled');
      if (raw === null) return false; // mặc định tắt
      return raw === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('reports.filtersEnabled', filtersEnabled ? '1' : '0');
    } catch {
      // ignore
    }
  }, [filtersEnabled]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [kpi, setKpi] = useState({
    totalEnergy: 0,
    totalRevenue: 0,
    totalSessions: 0,
    activeStations: 0,
  });
  const [energyTrend, setEnergyTrend] = useState([]);
  const [revenueTrend, setRevenueTrend] = useState([]);
  const [topStations, setTopStations] = useState([]);
  const [sessionsByHour, setSessionsByHour] = useState([]);
  const [utilization, setUtilization] = useState([]);

  const queryParams = useMemo(() => {
    if (!filtersEnabled) {
      return {
        from: undefined,
        to: undefined,
        stationId: undefined,
        ownerId: undefined,
        chargePointId: undefined,
      };
    }

    return {
      from: filters.from,
      to: filters.to,
      stationId: filters.stationId || undefined,
      ownerId: filters.ownerId || undefined,
      chargePointId: filters.chargePointId || undefined,
    };
  }, [filters, filtersEnabled]);

  const topStationsClean = useMemo(
    () =>
      Array.isArray(topStations)
        ? topStations.map((s) => ({
            ...s,
            stationShortName: cleanStationName(s.stationName),
          }))
        : [],
    [topStations]
  );

  useEffect(() => {
    let alive = true;
    const fetchReports = async () => {
      try {
        setLoading(true);
        setError('');

        const [
          kpiRes,
          energyRes,
          revenueRes,
          topStationsRes,
          sessionsByHourRes,
          utilizationRes,
        ] = await Promise.all([
          api.get('/reports/kpi', { params: queryParams }),
          api.get('/reports/energy', { params: queryParams }),
          api.get('/reports/revenue', { params: queryParams }),
          api.get('/reports/top-stations', { params: { ...queryParams, limit: 10 } }),
          api.get('/reports/sessions-by-hour', { params: queryParams }),
          api.get('/reports/utilization', { params: queryParams }),
        ]);

        if (!alive) return;

        const getPayload = (response, fallback) =>
          response?.data?.data ?? response?.data ?? fallback;

        setKpi(
          getPayload(kpiRes, {
            totalEnergy: 0,
            totalRevenue: 0,
            totalSessions: 0,
            activeStations: 0,
          })
        );
        setEnergyTrend(getPayload(energyRes, []));
        setRevenueTrend(getPayload(revenueRes, []));
        setTopStations(getPayload(topStationsRes, []));
        setSessionsByHour(getPayload(sessionsByHourRes, []));
        setUtilization(getPayload(utilizationRes, []));
      } catch (err) {
        console.error('Error loading reports:', err);
        if (!alive) return;
        setError(err?.response?.data?.message || err?.message || 'Không thể tải báo cáo');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };

    fetchReports();

    return () => {
      alive = false;
    };
  }, [queryParams]);

  const handleDateRangeChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Báo cáo thống kê</h1>
          <p className="text-muted-foreground mt-1">
            Tổng quan năng lượng, doanh thu, phiên sạc và hiệu suất sử dụng trạm.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {loading && <span className="animate-pulse">Đang tải dữ liệu...</span>}
          {!loading && !error && <span>Dữ liệu đã được cập nhật</span>}
          {error && <span className="text-red-500">Lỗi: {error}</span>}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Bộ lọc báo cáo</CardTitle>
            </div>
            <button
              type="button"
              onClick={() => setFiltersEnabled((v) => !v)}
              className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                filtersEnabled
                  ? 'border-emerald-500 text-emerald-700 bg-emerald-50'
                  : 'border-slate-300 text-slate-600 bg-slate-50'
              }`}
              title={filtersEnabled ? 'Tắt áp dụng bộ lọc' : 'Bật áp dụng bộ lọc'}
            >
              Bộ lọc: {filtersEnabled ? 'Bật' : 'Tắt'}
            </button>
          </div>
          <CardDescription>
            Chọn khoảng thời gian và bộ lọc trạm / chủ đầu tư để xem số liệu tương ứng.
          </CardDescription>
        </CardHeader>
        {filtersEnabled && (
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <FilterField label="Từ ngày">
              <input
                type="date"
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={filters.from}
                onChange={(e) => handleDateRangeChange('from', e.target.value)}
              />
            </FilterField>
            <FilterField label="Đến ngày">
              <input
                type="date"
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={filters.to}
                onChange={(e) => handleDateRangeChange('to', e.target.value)}
              />
            </FilterField>
            <FilterField label="Station ID">
              <input
                type="text"
                placeholder="Tất cả"
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={filters.stationId}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, stationId: e.target.value }))
                }
              />
            </FilterField>
            <FilterField label="Owner ID">
              <input
                type="text"
                placeholder="Tất cả"
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={filters.ownerId}
                onChange={(e) => setFilters((prev) => ({ ...prev, ownerId: e.target.value }))}
              />
            </FilterField>
            <FilterField label="ChargePoint ID">
              <input
                type="text"
                placeholder="Tất cả"
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={filters.chargePointId}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, chargePointId: e.target.value }))
                }
              />
            </FilterField>
            <div className="flex items-end justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => setFilters((prev) => ({ ...prev }))}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Làm mới
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Energy</CardTitle>
            <Zap className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(kpi?.totalEnergy)} <span className="text-sm text-muted-foreground">kWh</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Tổng điện năng trong khoảng thời gian đã chọn.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpi?.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Tổng doanh thu từ các phiên sạc.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <Activity className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatInteger(kpi?.totalSessions)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Tổng số phiên sạc đã ghi nhận.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Stations</CardTitle>
            <Building2 className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatInteger(kpi?.activeStations)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Số trạm có ít nhất một phiên sạc trong khoảng thời gian.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Energy + Revenue trend */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="h-[320px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Energy Trend</CardTitle>
            <CardDescription>Tổng kWh theo ngày trong khoảng thời gian chọn.</CardDescription>
          </CardHeader>
          <CardContent className="h-[260px]">
            {emptySeries(energyTrend, 'energy') ? (
              <EmptyState label="Chưa có dữ liệu năng lượng" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={energyTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={formatShortDate}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) => [`${Number(value).toFixed(1)} kWh`, 'Energy']}
                    labelFormatter={formatFullDate}
                  />
                  <Line
                    type="monotone"
                    dataKey="energy"
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="h-[320px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Revenue Trend</CardTitle>
            <CardDescription>Doanh thu theo ngày trong khoảng thời gian chọn.</CardDescription>
          </CardHeader>
          <CardContent className="h-[260px]">
            {emptySeries(revenueTrend, 'revenue') ? (
              <EmptyState label="Chưa có dữ liệu doanh thu" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={formatShortDate}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) => [formatCurrency(value), 'Revenue']}
                    labelFormatter={formatFullDate}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Top stations + Sessions by hour */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="h-[320px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top Stations (Revenue)</CardTitle>
            <CardDescription>Các trạm có doanh thu cao nhất.</CardDescription>
          </CardHeader>
          <CardContent className="h-[260px]">
            {Array.isArray(topStationsClean) && topStationsClean.length === 0 ? (
              <EmptyState label="Chưa có dữ liệu trạm" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topStationsClean}
                  layout="vertical"
                  // Chừa thêm không gian để luôn hiển thị đủ tick label trên mobile
                  margin={{ left: 70, right: 8, top: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="stationShortName"
                    tick={{ fontSize: 11 }}
                    width={110}
                    interval={0}
                    tickMargin={6}
                    // Giới hạn tối đa 15 ký tự, dài hơn thì hiển thị "..."
                    tickFormatter={(name) =>
                      name && name.length > 15 ? `${name.slice(0, 15)}…` : name
                    }
                  />
                  <Tooltip
                    formatter={(value) => [formatCurrency(value), 'Revenue']}
                    labelFormatter={(label) => label}
                  />
                  <Bar dataKey="revenue" fill="#0ea5e9" radius={[4, 4, 4, 4]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="h-[320px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Charging Sessions theo giờ</CardTitle>
            <CardDescription>Giúp xác định giờ cao điểm sạc.</CardDescription>
          </CardHeader>
          <CardContent className="h-[260px]">
            {emptySeries(sessionsByHour, 'sessions') ? (
              <EmptyState label="Chưa có dữ liệu phiên sạc theo giờ" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sessionsByHour}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis
                    dataKey="hour"
                    tickFormatter={(h) => `${h}h`}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) => [formatInteger(value), 'Sessions']}
                    labelFormatter={(label) => `${label}h`}
                  />
                  <Bar dataKey="sessions" fill="#1f2937" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Utilization */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Station Utilization</CardTitle>
          <CardDescription>
            Hiệu suất sử dụng trụ: ChargingTime / TotalTime cho từng trạm.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {Array.isArray(utilization) && utilization.length === 0 ? (
            <EmptyState label="Chưa có dữ liệu hiệu suất trạm" />
          ) : (
            <div className="min-w-[640px] space-y-3">
              <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground">
                <div className="col-span-3">Station</div>
                <div className="col-span-2 text-right">Sessions</div>
                <div className="col-span-2 text-right">Energy (kWh)</div>
                <div className="col-span-2 text-right">Revenue</div>
                <div className="col-span-3 text-right">Utilization</div>
              </div>
              <div className="space-y-2">
                {utilization.map((row) => {
                  const pct = Number(row.utilizationPct ?? row.utilization ?? 0);
                  const clamped = Math.max(0, Math.min(100, pct));
                  const displayName = cleanStationName(row.stationName);

                  return (
                    <div
                      key={row.stationId || row.stationName}
                      className="grid grid-cols-12 gap-2 items-center"
                    >
                      <div className="col-span-3 truncate font-medium">{displayName}</div>
                      <div className="col-span-2 text-right text-sm">
                        {formatInteger(row.sessions)}
                      </div>
                      <div className="col-span-2 text-right text-sm">
                        {formatNumber(row.energy)}
                      </div>
                      <div className="col-span-2 text-right text-sm">
                        {formatCurrency(row.revenue)}
                      </div>
                      <div className="col-span-3 flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${clamped}%` }}
                          />
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {clamped.toFixed(0)}%
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

function FilterField({ label, children }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function EmptyState({ label }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function toDateInputValue(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatCurrency(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(n);
}

function formatNumber(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 1,
  }).format(n);
}

function formatInteger(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 0,
  }).format(n);
}

function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

function formatFullDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function emptySeries(arr, key) {
  if (!Array.isArray(arr) || arr.length === 0) return true;
  return arr.every((item) => !item || Number(item[key]) === 0);
}

function cleanStationName(name) {
  if (!name) return '';
  return name.replace(/^Trạm\s*sạc\s*(SOLAREV)?\s*/i, '').trim();
}

export default ReportsPage;
