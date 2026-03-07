import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Zap, Loader2, Power, PowerOff, Clock, CheckCircle2, Plug, AlertCircle, XCircle, Circle, StopCircle, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';

const POLL_INTERVAL_MS = 15000; // 15 giây

const OCPP_STATUS_CONFIG = {
  Available: {
    label: 'Sẵn sàng',
    className: 'bg-green-500 text-white border-green-500',
    badgeIcon: CheckCircle2,
    sectionClass: 'rounded-lg border-2 border-green-500 bg-green-50/50 p-3 space-y-2',
  },
  Charging: {
    label: 'Đang sạc',
    className: 'bg-blue-600 text-white border-blue-600',
    badgeIcon: Zap,
    sectionClass: 'rounded-lg border-2 border-blue-600 bg-blue-50/50 p-3 space-y-2',
  },
  Occupied: {
    label: 'Đang sạc',
    className: 'bg-blue-600 text-white border-blue-600',
    badgeIcon: Zap,
    sectionClass: 'rounded-lg border-2 border-blue-600 bg-blue-50/50 p-3 space-y-2',
  },
  Unavailable: {
    label: 'Không khả dụng',
    className: 'bg-gray-500 text-white border-gray-500',
    badgeIcon: XCircle,
    sectionClass: 'rounded-lg border-2 border-gray-500 bg-gray-50/50 p-3 space-y-2',
  },
  Faulted: {
    label: 'Lỗi',
    className: 'bg-red-500 text-white border-red-500',
    badgeIcon: AlertCircle,
    sectionClass: 'rounded-lg border-2 border-red-500 bg-red-50/50 p-3 space-y-2',
  },
  Preparing: {
    label: 'Chuẩn bị',
    className: 'bg-cyan-500 text-white border-cyan-500',
    badgeIcon: Circle,
    sectionClass: 'rounded-lg border-2 border-cyan-500 bg-cyan-50/50 p-3 space-y-2',
  },
  Finishing: {
    label: 'Hoàn tất',
    className: 'bg-indigo-500 text-white border-indigo-500',
    badgeIcon: Circle,
    sectionClass: 'rounded-lg border-2 border-indigo-500 bg-indigo-50/50 p-3 space-y-2',
  },
};

const getStatusConfig = (status) => {
  const raw = status != null && typeof status === 'string' ? status.trim() : '';
  if (!raw) return OCPP_STATUS_CONFIG.Unavailable;
  const normalized = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  return OCPP_STATUS_CONFIG[normalized] || OCPP_STATUS_CONFIG.Unavailable;
};

const isChargingStatus = (status) => {
  const s = (status ?? '').toString().toLowerCase();
  return s === 'charging' || s === 'occupied';
};

const formatPower = (v) => {
  const num = typeof v === 'number' ? v : parseFloat(String(v || '').replace(/[^\d.-]/g, ''));
  return isNaN(num) ? 0 : num;
};

const formatMeterValue = (v, unit = '') => {
  if (v == null || (typeof v !== 'number' && isNaN(parseFloat(v)))) return '—';
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (!Number.isFinite(n)) return '—';
  return unit ? `${Number(n).toFixed(1)} ${unit}` : Number(n).toFixed(1);
};

const formatTimeAgo = (dateStr) => {
  if (!dateStr) return 'Vừa xong';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return 'Vừa xong';
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return 'Vừa xong';
};

const ONLINE_THRESHOLD_MS = 8 * 60 * 1000; // 8 phút (heartbeat)

const StationLivePage = () => {
  const [chargePoints, setChargePoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stopping, setStopping] = useState(null);
  const [toast, setToast] = useState(null);
  const [pausedChargePointIds, setPausedChargePointIds] = useState(() => new Set());
  const [frozenCards, setFrozenCards] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [stopNotifyModal, setStopNotifyModal] = useState({ open: false, type: 'success', text: '' });
  const pollIntervalRef = useRef(null);

  const fetchData = React.useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    if (!isSilent) setError(null);
    try {
      const response = await api.get('/dashboard/chargepoints');
      if (response.data.success) {
        setChargePoints(response.data.data || []);
        setLastUpdated(new Date());
        setError(null);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Không tải được dữ liệu trụ sạc.';
      if (!isSilent) {
        setError(msg);
        setChargePoints([]);
      } else {
        setToast({ type: 'error', text: 'Cập nhật nền thất bại. ' + msg });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  // Polling: chỉ chạy khi tab đang hiển thị
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') fetchData(true);
    };
    pollIntervalRef.current = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [fetchData]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleStopCharging = async (chargePointId, connectorId) => {
    const key = `${chargePointId}-${connectorId}`;
    setStopping(key);
    setToast(null);
    setStopNotifyModal((m) => ({ ...m, open: false }));
    try {
      const res = await api.post(`/dashboard/chargepoints/${chargePointId}/stop-session`, { connectorId });
      if (res.data?.success) {
        setStopNotifyModal({ open: true, type: 'success', text: res.data?.message || 'Đã gửi lệnh dừng sạc.' });
        await fetchData(true);
      } else {
        setStopNotifyModal({ open: true, type: 'error', text: res.data?.message || 'Không gửi được lệnh.' });
      }
    } catch (err) {
      setStopNotifyModal({
        open: true,
        type: 'error',
        text: err.response?.data?.message || 'Lỗi khi gửi lệnh dừng sạc.',
      });
    } finally {
      setStopping(null);
    }
  };

  const togglePower = (cp) => {
    const id = cp.ChargePointId;
    if (pausedChargePointIds.has(id)) {
      setPausedChargePointIds((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
      setFrozenCards((f) => {
        const next = { ...f };
        delete next[id];
        return next;
      });
    } else {
      setPausedChargePointIds((s) => new Set(s).add(id));
      setFrozenCards((f) => ({ ...f, [id]: { ...cp, connectors: cp.connectors ? [...cp.connectors] : [] } }));
    }
  };

  const displayList = chargePoints
    .map((cp) => (pausedChargePointIds.has(cp.ChargePointId) && frozenCards[cp.ChargePointId] ? frozenCards[cp.ChargePointId] : cp))
    .slice()
    .sort((a, b) => (a.Name || a.ChargePointId || '').localeCompare(b.Name || b.ChargePointId || '', 'vi'));

  const isOnline = (cp) => {
    const lastSeen = cp.LastSeen ?? cp.lastSeen;
    if (lastSeen == null) return false;
    const t = new Date(lastSeen).getTime();
    if (Number.isNaN(t)) return false;
    return Date.now() - t <= ONLINE_THRESHOLD_MS;
  };

  const totalPowerMax = (cp) => {
    return Number(formatPower(cp.chargerPower));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`rounded-lg border px-4 py-2 text-sm ${
            toast.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-destructive/10 border-destructive/30 text-destructive'
          }`}
          role="alert"
        >
          {toast.text}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4 shrink-0" />
          <span>
            {lastUpdated
              ? `Cập nhật lúc ${lastUpdated.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
              : 'Đang tải...'}
          </span>
          {refreshing && <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchData(true)}
          disabled={loading || refreshing}
          className="gap-2"
        >
          {refreshing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Làm mới
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {displayList.map((cp) => {
          const isPaused = pausedChargePointIds.has(cp.ChargePointId);
          const connectors = cp.connectors || [];
          const gun1 = connectors.find((c) => c.ConnectorId === 1) ?? connectors[0];
          const gun2 = connectors.find((c) => c.ConnectorId === 2) ?? connectors[1];
          const readStatus = (conn, fallback) => (conn && (conn.LastStatus ?? conn.lastStatus)) || fallback || 'Unavailable';
          const gun1Status = readStatus(gun1, cp.ChargePointState);
          const gun2Status = readStatus(gun2, connectors.length === 1 ? 'Available' : 'Available');
          const config1 = getStatusConfig(gun1Status);
          const config2 = getStatusConfig(gun2Status);
          const powerMax = Number(formatPower(cp.chargerPower));
          const totalMax = totalPowerMax(cp);
          const online = isOnline(cp);
          const latestStatusTime = gun1?.LastStatusTime ?? gun1?.lastStatusTime ?? gun2?.LastStatusTime ?? gun2?.lastStatusTime;
          const totalCurrentPower =
            (isChargingStatus(gun1Status) ? (Number(gun1?.CurrentChargeKW) || powerMax * 0.8) : 0) +
            (isChargingStatus(gun2Status) ? (Number(gun2?.CurrentChargeKW) || powerMax * 0.8) : 0);
          const showTotalCurrent = totalCurrentPower > 0;
          const BadgeIcon1 = config1.badgeIcon;
          const BadgeIcon2 = config2.badgeIcon;

          return (
            <Card
              key={cp.ChargePointId}
              className={`overflow-hidden bg-white transition-opacity relative border-l-4 ${
                isPaused ? 'border-l-gray-500' : online ? 'border-l-green-500' : 'border-l-red-500 opacity-75'
              }`}
            >
              {isPaused && (
                <div className="absolute inset-0 bg-black/60 pointer-events-none rounded-[inherit]" aria-hidden />
              )}
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-lg font-semibold flex items-center gap-2 flex-wrap">
                      <span className="truncate">{cp.Name || cp.ChargePointId}</span>
                      <div className="flex items-center gap-1">
                        <span
                          className={`inline-block w-2 h-2 shrink-0 rounded-full animate-pulse ${
                            online ? 'bg-green-500' : 'bg-red-500'
                          }`}
                          aria-hidden
                        />
                        <span className="text-sm font-medium text-muted-foreground">
                          {online ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 truncate">{cp.StationName || '—'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => togglePower(cp)}
                    className="shrink-0 p-1 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-300"
                    title={isPaused ? 'Tiếp tục cập nhật' : 'Tạm dừng cập nhật trụ này'}
                    aria-label={isPaused ? 'Tiếp tục cập nhật' : 'Tạm dừng cập nhật'}
                  >
                    {isPaused ? (
                      <PowerOff className="w-5 h-5 text-gray-400" aria-hidden />
                    ) : (
                      <Power className={`w-5 h-5 ${online ? 'text-green-500' : 'text-gray-400'}`} aria-hidden />
                    )}
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                {/* Súng 1 */}
                <div className={config1.sectionClass}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Plug className="w-4 h-4 text-gray-600 shrink-0" />
                      <span className="font-medium text-sm">{gun1?.ConnectorName || 'Súng 1'}</span>
                      <Badge variant="outline" className="text-xs h-5 font-normal border-slate-200">
                        {cp.connectorType || 'CCS2'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`${config1.className} px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1`}>
                        {BadgeIcon1 && <BadgeIcon1 className="h-3 w-3" />}
                        {config1.label}
                      </div>
                      {isChargingStatus(gun1Status) && gun1 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-orange-500 text-orange-600 hover:bg-orange-50"
                          disabled={!!stopping}
                          onClick={() => handleStopCharging(cp.ChargePointId, gun1.ConnectorId ?? 1)}
                        >
                          {stopping === `${cp.ChargePointId}-${gun1.ConnectorId ?? 1}` ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <StopCircle className="h-3 w-3 mr-1" />
                              Dừng sạc
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">Công suất</div>
                      <div className="font-medium">
                        {isChargingStatus(gun1Status)
                          ? `${(Number(gun1?.CurrentChargeKW) || powerMax * 0.8).toFixed(1)}/${powerMax} kW`
                          : `${powerMax} kW`}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Điện áp</div>
                      <div className="font-medium">{formatMeterValue(gun1?.Voltage, 'V')}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Dòng</div>
                      <div className="font-medium">{formatMeterValue(gun1?.Current, 'A')}</div>
                    </div>
                  </div>
                  <div className="pt-1">
                    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          isChargingStatus(gun1Status) ? 'bg-blue-600' : 'bg-gray-300'
                        }`}
                        style={{
                          width: isChargingStatus(gun1Status)
                            ? `${Math.min(100, Math.max(0, Number(gun1?.SoC) || 80))}%`
                            : '0%',
                        }}
                      />
                    </div>
                    {isChargingStatus(gun1Status) && (gun1?.SoC != null && Number.isFinite(Number(gun1.SoC))) && (
                      <div className="text-xs text-muted-foreground mt-0.5">SoC {Number(gun1.SoC).toFixed(0)}%</div>
                    )}
                  </div>
                </div>
                {/* Súng 2 */}
                <div className={config2.sectionClass}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Plug className="w-4 h-4 text-gray-600 shrink-0" />
                      <span className="font-medium text-sm">{gun2?.ConnectorName || 'Súng 2'}</span>
                      <Badge variant="outline" className="text-xs h-5 font-normal border-slate-200">
                        {cp.connectorType || 'CCS2'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`${config2.className} px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1`}>
                        {BadgeIcon2 && <BadgeIcon2 className="h-3 w-3" />}
                        {config2.label}
                      </div>
                      {isChargingStatus(gun2Status) && gun2 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-orange-500 text-orange-600 hover:bg-orange-50"
                          disabled={!!stopping}
                          onClick={() => handleStopCharging(cp.ChargePointId, gun2.ConnectorId ?? 2)}
                        >
                          {stopping === `${cp.ChargePointId}-${gun2.ConnectorId ?? 2}` ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <StopCircle className="h-3 w-3 mr-1" />
                              Dừng sạc
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">Công suất</div>
                      <div className="font-medium">
                        {isChargingStatus(gun2Status)
                          ? `${(Number(gun2?.CurrentChargeKW) || powerMax * 0.8).toFixed(1)}/${powerMax} kW`
                          : `${powerMax} kW`}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Điện áp</div>
                      <div className="font-medium">{formatMeterValue(gun2?.Voltage, 'V')}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Dòng</div>
                      <div className="font-medium">{formatMeterValue(gun2?.Current, 'A')}</div>
                    </div>
                  </div>
                  <div className="pt-1">
                    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          isChargingStatus(gun2Status) ? 'bg-blue-600' : 'bg-gray-300'
                        }`}
                        style={{
                          width: isChargingStatus(gun2Status)
                            ? `${Math.min(100, Math.max(0, Number(gun2?.SoC) || 80))}%`
                            : '0%',
                        }}
                      />
                    </div>
                    {isChargingStatus(gun2Status) && (gun2?.SoC != null && Number.isFinite(Number(gun2.SoC))) && (
                      <div className="text-xs text-muted-foreground mt-0.5">SoC {Number(gun2.SoC).toFixed(0)}%</div>
                    )}
                  </div>
                </div>
                {/* Footer */}
                <div className="pt-2 border-t flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span className="text-xs">{formatTimeAgo(latestStatusTime)}</span>
                  </div>
                  <div className="font-medium flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    {showTotalCurrent ? `${totalCurrentPower.toFixed(1)}/${totalMax} kW` : `${totalMax} kW`}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {displayList.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Chưa có trụ sạc nào để hiển thị.
          </CardContent>
        </Card>
      )}

      <Dialog
        open={stopNotifyModal.open}
        onOpenChange={(open) => {
          if (!open) setStopNotifyModal((m) => ({ ...m, open: false }));
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {stopNotifyModal.type === 'success' ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                  Thông báo
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                  Thông báo
                </>
              )}
            </DialogTitle>
            <DialogDescription
              className={
                stopNotifyModal.type === 'success'
                  ? 'text-green-700 pt-1'
                  : 'text-destructive pt-1'
              }
            >
              {stopNotifyModal.text}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStopNotifyModal((m) => ({ ...m, open: false }))}
            >
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StationLivePage;
