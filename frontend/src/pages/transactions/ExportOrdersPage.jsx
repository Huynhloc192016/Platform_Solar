import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Download, Loader2 } from 'lucide-react';
import api from '../../services/api';

const ExportOrdersPage = () => {
  const [stations, setStations] = useState([]);
  const [loadingStations, setLoadingStations] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const [stationId, setStationId] = useState('');
  const [chargePointId, setChargePointId] = useState('');
  const [dateFrom, setDateFrom] = useState(() => {
    const n = new Date();
    return n.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => {
    const n = new Date();
    return n.toISOString().slice(0, 10);
  });

  useEffect(() => {
    const fetchStations = async () => {
      try {
        setLoadingStations(true);
        const res = await api.get('/dashboard/stations');
        if (res.data.success && Array.isArray(res.data.data)) {
          setStations(res.data.data);
        }
      } catch (err) {
        console.error('Fetch stations:', err);
        setStations([]);
      } finally {
        setLoadingStations(false);
      }
    };
    fetchStations();
  }, []);

  const selectedStation = stations.find((s) => String(s.ChargeStationId) === String(stationId));
  const chargePoints = selectedStation?.ChargePoints || [];

  useEffect(() => {
    setChargePointId('');
  }, [stationId]);

  const handleExport = async () => {
    if (!stationId) {
      setError('Vui lòng chọn trạm.');
      return;
    }
    if (!dateFrom || !dateTo) {
      setError('Vui lòng chọn từ ngày và đến ngày.');
      return;
    }
    if (dateFrom > dateTo) {
      setError('Từ ngày phải nhỏ hơn hoặc bằng đến ngày.');
      return;
    }
    setError('');
    setExporting(true);
    try {
      const params = { stationId, dateFrom, dateTo };
      if (chargePointId) {
        params.chargePointId = chargePointId;
        const selectedCp = chargePoints.find((cp) => String(cp.ChargePointId) === String(chargePointId));
        params.chargePointName = selectedCp ? (selectedCp.Name || selectedCp.ChargePointId) : chargePointId;
      }
      const res = await api.get('/dashboard/export/orders', {
        params,
        responseType: 'blob',
      });
      const blob = res.data;
      if (res.headers['content-type']?.includes('application/json')) {
        const text = await new Response(blob).text();
        const json = JSON.parse(text);
        setError(json.message || 'Có lỗi xảy ra.');
        setExporting(false);
        return;
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const contentDisposition = res.headers['content-disposition'] || res.headers['Content-Disposition'] || '';
      let downloadName = 'Bao_cao_don_sac.xlsx';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i) || contentDisposition.match(/filename=["']?([^"';]+)["']?/i);
        if (match && match[1]) downloadName = decodeURIComponent(match[1].trim());
      }
      if (downloadName === 'Bao_cao_don_sac.xlsx' && (chargePointId || params.chargePointName)) {
        const truName = params.chargePointName || chargePointId || 'Tat_ca_tru';
        const safe = (s) => (s || '').replace(/[/\\?*:|"]/g, '_').trim() || 'export';
        downloadName = `Bao_cao_don_sac_${safe(truName)}.xlsx`;
      }
      a.download = downloadName;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          setError(json.message || 'Xuất file thất bại.');
        } catch {
          setError('Xuất file thất bại.');
        }
      } else if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError(err.message || 'Xuất file thất bại.');
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Báo cáo đơn sạc</CardTitle>
          <CardDescription>
            Chọn trạm, trụ (hoặc tất cả trụ) và khoảng từ ngày đến ngày. File định dạng .xlsx.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="station">Trạm sạc</Label>
              <select
                id="station"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={stationId}
                onChange={(e) => setStationId(e.target.value)}
                disabled={loadingStations}
              >
                <option value="">-- Chọn trạm --</option>
                {stations.map((s) => (
                  <option key={s.ChargeStationId} value={s.ChargeStationId}>
                    {s.Name || `Trạm ${s.ChargeStationId}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="chargepoint">Trụ sạc</Label>
              <select
                id="chargepoint"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={chargePointId}
                onChange={(e) => setChargePointId(e.target.value)}
                disabled={!stationId || loadingStations}
              >
                <option value="">Tất cả trụ</option>
                {chargePoints.map((cp) => (
                  <option key={cp.ChargePointId} value={cp.ChargePointId}>
                    {cp.Name || cp.ChargePointId}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateFrom">Từ ngày</Label>
              <input
                id="dateFrom"
                type="date"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateTo">Đến ngày</Label>
              <input
                id="dateTo"
                type="date"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          <Button onClick={handleExport} disabled={exporting || !stationId || !dateFrom || !dateTo}>
            {exporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang tạo file…
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Xuất file
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExportOrdersPage;
