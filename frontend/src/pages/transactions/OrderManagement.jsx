import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Search, Loader2, Receipt, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../services/api';

const formatDateTime = (value) => {
  if (value == null || value === '') return '—';
  const d = new Date(value);
  return isNaN(d.getTime()) ? value : d.toLocaleString('vi-VN');
};

const formatNumber = (value) => {
  if (value == null || value === '') return '—';
  const n = Number(value);
  return isNaN(n) ? value : n.toLocaleString('vi-VN');
};

const OrderManagement = () => {
  const [orders, setOrders] = useState([]);
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

  const fetchOrders = async (params) => {
    const { page: p = page, limit: l = limit, search: s, dateFrom: df, dateTo: dt } = params || {};
    try {
      setLoading(true);
      const requestParams = { page: p, limit: l };
      if (s !== undefined && s !== '') requestParams.search = s;
      if (df) requestParams.dateFrom = df;
      if (dt) requestParams.dateTo = dt;
      const res = await api.get('/dashboard/orders', { params: requestParams });
      if (res.data.success) {
        setOrders(res.data.data || []);
        setTotal(res.data.total ?? 0);
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders({
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
    fetchOrders({
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
    fetchOrders({ page: 1, limit });
  };

  const hasActiveFilter = searchApplied || dateFromApplied || dateToApplied;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Quản lý đơn sạc
          </CardTitle>
          <CardDescription>Theo dõi các đơn sạc (WalletTransaction) trong hệ thống</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Tìm theo ID đơn, ID người dùng, ID phiên..."
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
          ) : orders.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              {hasActiveFilter ? 'Không tìm thấy đơn sạc nào' : 'Chưa có đơn sạc nào'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left font-medium p-3 whitespace-nowrap">ID đơn sạc</th>
                      <th className="text-left font-medium p-3 whitespace-nowrap">ID người dùng</th>
                      <th className="text-left font-medium p-3 whitespace-nowrap">ID phiên sạc</th>
                      <th className="text-left font-medium p-3 whitespace-nowrap">Số lượng điện</th>
                      <th className="text-left font-medium p-3 whitespace-nowrap">Ngày giờ đơn sạc</th>
                      <th className="text-left font-medium p-3 whitespace-nowrap">Giá trị meter</th>
                      <th className="text-left font-medium p-3 whitespace-nowrap">Giá tiền đơn sạc</th>
                      <th className="text-left font-medium p-3 whitespace-nowrap">Phương pháp dừng</th>
                      <th className="text-left font-medium p-3 whitespace-nowrap">Số dư hiện tại</th>
                      <th className="text-left font-medium p-3 whitespace-nowrap">Số dư mới</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.WalletTransactionId ?? Math.random()} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="p-3">{o.WalletTransactionId ?? '—'}</td>
                        <td className="p-3">{o.UserAppId ?? '—'}</td>
                        <td className="p-3">{o.TransactionId ?? '—'}</td>
                        <td className="p-3">{o.EnergyUsed != null ? formatNumber(o.EnergyUsed) : '—'}</td>
                        <td className="p-3">{formatDateTime(o.DateCreate)}</td>
                        <td className="p-3">{o.meterValue != null ? formatNumber(o.meterValue) : '—'}</td>
                        <td className="p-3">{o.Amount != null ? formatNumber(o.Amount) : '—'}</td>
                        <td className="p-3">{o.stopMethod ?? '—'}</td>
                        <td className="p-3">{o.currentBalance != null ? formatNumber(o.currentBalance) : '—'}</td>
                        <td className="p-3">{o.newBalance != null ? formatNumber(o.newBalance) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Trang {page} / {totalPages} • Tổng {total} đơn
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

export default OrderManagement;
