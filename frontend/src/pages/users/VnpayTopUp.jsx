import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Search, Loader2, CreditCard, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../services/api';

const formatDateTime = (value) => {
  if (value == null || value === '') return '—';
  const d = new Date(value);
  return isNaN(d.getTime()) ? String(value) : d.toLocaleString('vi-VN');
};

const formatNumber = (value) => {
  if (value == null || value === '') return '—';
  const n = Number(value);
  return isNaN(n) ? String(value) : n.toLocaleString('vi-VN');
};

const getStatusBadge = (status) => {
  if (status == null || status === '') return <span className="text-muted-foreground">—</span>;
  const s = String(status).toLowerCase();
  if (s === '00' || s === 'success' || s === 'thanh công') {
    return <Badge variant="default" className="bg-emerald-600">Thành công</Badge>;
  }
  if (s === '07' || s === 'fail' || s === 'thất bại' || s === 'failed') {
    return <Badge variant="destructive">Thất bại</Badge>;
  }
  if (s === '02' || s === 'pending' || s === 'đang xử lý') {
    return <Badge variant="secondary">Đang xử lý</Badge>;
  }
  return <Badge variant="outline">{status}</Badge>;
};

const VnpayTopUp = () => {
  const [list, setList] = useState([]);
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

  const fetchList = async (params) => {
    const { page: p = page, limit: l = limit, search: s, dateFrom: df, dateTo: dt } = params || {};
    try {
      setLoading(true);
      const requestParams = { page: p, limit: l };
      if (s !== undefined && s !== '') requestParams.search = s;
      if (df) requestParams.dateFrom = df;
      if (dt) requestParams.dateTo = dt;
      const res = await api.get('/dashboard/vnpay-transactions', { params: requestParams });
      if (res.data?.success) {
        setList(res.data.data || []);
        setTotal(res.data.total ?? 0);
      } else {
        setList([]);
        setTotal(0);
      }
    } catch (err) {
      console.error('Error fetching VNPay transactions:', err);
      setList([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList({
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
    fetchList({
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
    fetchList({ page: 1, limit });
  };

  const hasActiveFilter = searchApplied || dateFromApplied || dateToApplied;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Danh sách giao dịch nạp tiền VNPay
          </CardTitle>
          <CardDescription>
            UserAppID, Họ tên, Số điện thoại, Mã giao dịch, Số tiền nạp, Ngày nạp, Bank code, Trạng thái
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Tìm theo UserAppID, mã GD, bank code, SĐT..."
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
          ) : list.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              {hasActiveFilter ? 'Không tìm thấy giao dịch nào' : 'Chưa có giao dịch nạp tiền VNPay nào'}
            </div>
          ) : (
            <>
              <div className="hidden lg:block overflow-x-auto rounded-md border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left font-medium p-3 whitespace-nowrap">UserAppID</th>
                      <th className="text-left font-medium p-3 whitespace-nowrap">Họ Tên</th>
                      <th className="text-left font-medium p-3 whitespace-nowrap">Số điện thoại</th>
                      <th className="text-left font-medium p-3 whitespace-nowrap">Mã giao dịch</th>
                      <th className="text-left font-medium p-3 whitespace-nowrap">Số tiền nạp</th>
                      <th className="text-left font-medium p-3 whitespace-nowrap">Ngày nạp</th>
                      <th className="text-left font-medium p-3 whitespace-nowrap">Bank code</th>
                      <th className="text-left font-medium p-3 whitespace-nowrap">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((row, idx) => (
                      <tr
                        key={row.transactionCode ?? row.userAppId ?? idx}
                        className="border-b border-slate-100 hover:bg-slate-50/50"
                      >
                        <td className="p-3">{row.userAppId ?? '—'}</td>
                        <td className="p-3">{row.fullName ?? '—'}</td>
                        <td className="p-3">{row.phone ?? '—'}</td>
                        <td className="p-3">{row.transactionCode ?? '—'}</td>
                        <td className="p-3">{row.amount != null ? formatNumber(row.amount) : '—'}</td>
                        <td className="p-3">{formatDateTime(row.dateCreate)}</td>
                        <td className="p-3">{row.bankCode ?? '—'}</td>
                        <td className="p-3">{getStatusBadge(row.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="lg:hidden space-y-4">
                {list.map((row, idx) => (
                  <Card key={row.transactionCode ?? row.userAppId ?? idx}>
                    <CardContent className="p-4 space-y-2">
                      <p className="text-sm font-medium">{row.fullName || row.userAppId || '—'}</p>
                      <p className="text-xs text-muted-foreground">
                        UserAppID: {row.userAppId ?? '—'} • SĐT: {row.phone ?? '—'}
                      </p>
                      <p className="text-sm">
                        Mã GD: {row.transactionCode ?? '—'} • Số tiền: {row.amount != null ? formatNumber(row.amount) : '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Ngày nạp: {formatDateTime(row.dateCreate)} • Bank: {row.bankCode ?? '—'}
                      </p>
                      <div>{getStatusBadge(row.status)}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Trang {page} / {totalPages} • Tổng {total} giao dịch
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

export default VnpayTopUp;
