import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import api from '../../services/api';
import { BarChart3, Loader2 } from 'lucide-react';

const formatNumber = (value) => {
  if (value == null || value === '') return '—';
  const n = Number(value);
  return isNaN(n) ? value : n.toLocaleString('vi-VN');
};

const TransactionSummary = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get('/dashboard/transactions/summary');
        if (res.data?.success && Array.isArray(res.data.data)) {
          setData(res.data.data);
        } else {
          setData([]);
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Không tải được dữ liệu tổng hợp.');
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <BarChart3 className="w-6 h-6" />
          Tổng hợp sạc và tiêu thụ
        </h1>
        <p className="text-muted-foreground">
          Tổng lượt sạc và lượt sạc thẻ từ theo từng trạm
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Theo trạm sạc</CardTitle>
          <CardDescription>
            Tên trạm, tổng lượt sạc, tổng lượt sạc thẻ từ, tổng kWh tiêu thụ, tổng tiền
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive py-6 text-center">{error}</p>
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Chưa có dữ liệu tổng hợp
            </p>
          ) : (
            <>
              <div className="hidden lg:block overflow-x-auto rounded-md border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left font-medium p-3 whitespace-nowrap">
                        Tên trạm sạc
                      </th>
                      <th className="text-right font-medium p-3 whitespace-nowrap">
                        Tổng lượt sạc
                      </th>
                      <th className="text-right font-medium p-3 whitespace-nowrap">
                        Tổng lượt sạc thẻ từ
                      </th>
                      <th className="text-right font-medium p-3 whitespace-nowrap">
                        Tổng kWh tiêu thụ
                      </th>
                      <th className="text-right font-medium p-3 whitespace-nowrap">
                        Tổng tiền
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row) => (
                      <tr
                        key={row.chargeStationId ?? row.stationName}
                        className="border-b border-slate-100 hover:bg-slate-50/50"
                      >
                        <td className="p-3 font-medium">
                          {row.stationName ?? '—'}
                        </td>
                        <td className="p-3 text-right">
                          {row.totalSessions ?? 0}
                        </td>
                        <td className="p-3 text-right">
                          {row.cardSessions ?? 0}
                        </td>
                        <td className="p-3 text-right">
                          {formatNumber(row.totalKwh)}
                        </td>
                        <td className="p-3 text-right">
                          {formatNumber(row.totalAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="lg:hidden space-y-3">
                {data.map((row) => (
                  <Card key={row.chargeStationId ?? row.stationName}>
                    <CardContent className="p-4">
                      <p className="font-medium text-slate-900 mb-2">
                        {row.stationName ?? '—'}
                      </p>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Tổng lượt sạc</span>
                        <span className="font-medium text-slate-900">
                          {row.totalSessions ?? 0}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground mt-1">
                        <span>Tổng lượt sạc thẻ từ</span>
                        <span className="font-medium text-slate-900">
                          {row.cardSessions ?? 0}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground mt-1">
                        <span>Tổng kWh tiêu thụ</span>
                        <span className="font-medium text-slate-900">
                          {formatNumber(row.totalKwh)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground mt-1">
                        <span>Tổng tiền</span>
                        <span className="font-medium text-slate-900">
                          {formatNumber(row.totalAmount)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TransactionSummary;
