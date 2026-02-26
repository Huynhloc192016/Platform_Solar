import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Search, Loader2, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../services/api';

const formatDateTime = (value) => {
  if (value == null || value === '') return '—';
  const d = new Date(value);
  return isNaN(d.getTime()) ? value : d.toLocaleString('vi-VN');
};

const SessionManagement = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [searchInput, setSearchInput] = useState('');
  const [searchApplied, setSearchApplied] = useState('');
  const [dateFromInput, setDateFromInput] = useState('');
  const [dateToInput, setDateToInput] = useState('');
  const [dateFromApplied, setDateFromApplied] = useState('');
  const [dateToApplied, setDateToApplied] = useState('');

  const fetchSessions = async (params) => {
    const { page: p = page, limit: l = limit, search: s, dateFrom: df, dateTo: dt } = params || {};
    try {
      setLoading(true);
      const requestParams = { page: p, limit: l };
      if (s !== undefined && s !== '') requestParams.search = s;
      if (df) requestParams.dateFrom = df;
      if (dt) requestParams.dateTo = dt;
      const res = await api.get('/dashboard/sessions', { params: requestParams });
      if (res.data.success) {
        setSessions(res.data.data || []);
        setTotal(res.data.total ?? 0);
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions({
      page,
      limit,
      search: searchApplied || undefined,
      dateFrom: dateFromApplied || undefined,
      dateTo: dateToApplied || undefined,
    });
  }, [page]);

  const handleSearch = () => {
    const q = searchInput.trim();
    setSearchApplied(q);
    setDateFromApplied(dateFromInput);
    setDateToApplied(dateToInput);
    setPage(1);
    fetchSessions({
      page: 1,
      limit,
      search: q || undefined,
      dateFrom: dateFromInput || undefined,
      dateTo: dateToInput || undefined,
    });
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchApplied('');
    setDateFromInput('');
    setDateToInput('');
    setDateFromApplied('');
    setDateToApplied('');
    setPage(1);
    fetchSessions({ page: 1, limit });
  };

  const hasActiveFilter = searchApplied || dateFromApplied || dateToApplied;

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Quản lý phiên sạc
          </CardTitle>
          <CardDescription>Theo dõi các phiên sạc (Transactions) trong hệ thống</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Tìm theo ID phiên, trụ, thẻ, trạm..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Từ ngày</label>
                <Input
                  type="date"
                  value={dateFromInput}
                  onChange={(e) => setDateFromInput(e.target.value)}
                  className="w-[140px]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Đến ngày</label>
                <Input
                  type="date"
                  value={dateToInput}
                  onChange={(e) => setDateToInput(e.target.value)}
                  className="w-[140px]"
                />
              </div>
            </div>
            <Button onClick={handleSearch}>Tìm kiếm</Button>
            {hasActiveFilter && (
              <Button variant="outline" onClick={handleClearSearch}>
                Xóa lọc
              </Button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              {hasActiveFilter ? 'Không tìm thấy phiên sạc nào' : 'Chưa có phiên sạc nào'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left font-medium p-3 whitespace-nowrap">ID phiên sạc</th>
                      <th className="text-left font-medium p-3 whitespace-nowrap">ID điểm thu phí</th>
                      <th className="text-left font-medium p-3 whitespace-nowrap">ID thẻ bắt đầu</th>
                      <th className="text-left font-medium p-3 whitespace-nowrap">Thời gian bắt đầu</th>
                      <th className="text-left font-medium p-3 whitespace-nowrap">Thời gian đồng hồ bắt đầu</th>
                      <th className="text-left font-medium p-3 whitespace-nowrap">Bắt đầu kết nối</th>
                      <th className="text-left font-medium p-3 whitespace-nowrap">ID thẻ kết thúc</th>
                      <th className="text-left font-medium p-3 whitespace-nowrap">Thời gian kết thúc</th>
                      <th className="text-left font-medium p-3 whitespace-nowrap">Thời gian đồng hồ kết thúc</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.TransactionId ?? s.Uid ?? Math.random()} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="p-3">{s.TransactionId ?? s.Uid ?? '—'}</td>
                        <td className="p-3">{s.ChargePointId ?? '—'}</td>
                        <td className="p-3">{s.StartTagId ?? '—'}</td>
                        <td className="p-3">{formatDateTime(s.StartTime)}</td>
                        <td className="p-3">{s.MeterStart != null ? s.MeterStart : '—'}</td>
                        <td className="p-3">
                          {s.ConnectionStatus === 'Kết nối thành công' ? (
                            <Badge className="bg-green-100 text-green-800 border-green-200">Kết nối thành công</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800 border-red-200">Kết nối thất bại</Badge>
                          )}
                        </td>
                        <td className="p-3">{s.StopTagId ?? s.StartTagId ?? '—'}</td>
                        <td className="p-3">{formatDateTime(s.StopTime)}</td>
                        <td className="p-3">{s.MeterStop != null ? s.MeterStop : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Trang {page} / {totalPages} • Tổng {total} phiên
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SessionManagement;
