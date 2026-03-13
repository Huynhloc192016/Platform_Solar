import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Label } from '../../components/ui/label';
import { Calendar, CalendarDays, Wallet, Loader2 } from 'lucide-react';
import api from '../../services/api';

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatVND = (n) => {
  if (n == null || Number.isNaN(Number(n))) return '0 VNĐ';
  return `${Number(n).toLocaleString('vi-VN')} VNĐ`;
};

const MODE_DAILY = 'daily';
const MODE_MONTHLY = 'monthly';

const RevenueByPeriod = () => {
  const now = new Date();
  const [mode, setMode] = useState(MODE_DAILY);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        if (mode === MODE_DAILY) {
          const res = await api.get('/dashboard/revenue/daily', { params: { month, year } });
          if (!cancelled) {
            setData(res.data?.success ? res.data.data || [] : []);
          }
        } else {
          const res = await api.get('/dashboard/revenue/monthly', { params: { year } });
          if (!cancelled) {
            setData(res.data?.success ? res.data.data || [] : []);
          }
        }
      } catch (err) {
        console.error('Error fetching revenue:', err);
        if (!cancelled) {
          setData([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [mode, month, year]);

  const handleModeChange = (newMode) => {
    setMode(newMode);
  };

  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);

  const noDataMessage =
    mode === MODE_DAILY
      ? 'Không có doanh thu trong tháng/năm đã chọn.'
      : 'Không có doanh thu trong năm đã chọn.';

  return (
    <div className="space-y-6">
      

      <Card>
        <CardContent className="pt-6">
        <div>
        <h1 className="text-2xl font-semibold text-slate-900">Doanh thu ngày tháng năm</h1>
        <p className="text-slate-500 mt-1">
          Doanh thu theo ngày trong tháng hoặc theo từng tháng trong năm

         </p>
      </div>
          <form className="flex flex-wrap items-end gap-4 mb-6">
          

            <div className="flex flex-col gap-2">
            <br />
              <Label className="text-sm font-medium">Xem theo</Label>
              <select
                value={mode}
                onChange={(e) => handleModeChange(e.target.value)}
                className="h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm min-w-[160px]"
              >
                <option value={MODE_DAILY}>Theo ngày (trong tháng)</option>
                <option value={MODE_MONTHLY}>Theo tháng (trong năm)</option>
              </select>
            </div>

            {mode === MODE_DAILY && (
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium">Tháng</Label>
                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm min-w-[100px]"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Năm</Label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm min-w-[100px]"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </form>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : data.length === 0 ? (
            <p className="text-center py-12 text-slate-500">{noDataMessage}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {mode === MODE_DAILY
                ? data.map((item) => (
                    <Card key={item.date} className="overflow-hidden border-slate-200">
                      <div className="bg-emerald-600 text-white px-4 py-3 flex items-center gap-2">
                        <Calendar className="w-4 h-4 shrink-0" />
                        <span className="font-medium text-sm">{formatDate(item.date)}</span>
                      </div>
                      <CardContent className="p-4 flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-slate-500 shrink-0" />
                        <span className="font-semibold text-slate-900">{formatVND(item.amount)}</span>
                      </CardContent>
                    </Card>
                  ))
                : data.map((item) => (
                    <Card key={item.month} className="overflow-hidden border-slate-200">
                      <div className="bg-emerald-600 text-white px-4 py-3 flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 shrink-0" />
                        <span className="font-medium text-sm">{item.monthName}</span>
                      </div>
                      <CardContent className="p-4 flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-slate-500 shrink-0" />
                        <span className="font-semibold text-slate-900">{formatVND(item.amount)}</span>
                      </CardContent>
                    </Card>
                  ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RevenueByPeriod;
