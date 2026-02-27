import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Search, Loader2, Receipt, ChevronLeft, ChevronRight, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

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
  const { user } = useAuth();
  const isOwner = !!user?.ownerId;
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

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [orderToEdit, setOrderToEdit] = useState(null);
  const [editFormData, setEditFormData] = useState({
    UserAppId: '',
    Amount: '',
    meterValue: '',
    stopMethod: '',
    currentBalance: '',
    newBalance: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [editError, setEditError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

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

  const openEditDialog = (o) => {
    setOrderToEdit(o);
    setEditFormData({
      UserAppId: o.UserAppId != null ? String(o.UserAppId) : '',
      Amount: o.Amount != null ? String(o.Amount) : '',
      meterValue: o.meterValue != null ? String(o.meterValue) : '',
      stopMethod: o.stopMethod ?? '',
      currentBalance: o.currentBalance != null ? String(o.currentBalance) : '',
      newBalance: o.newBalance != null ? String(o.newBalance) : '',
    });
    setEditError('');
    setEditDialogOpen(true);
  };

  const handleEditOrder = async (e) => {
    e.preventDefault();
    if (!orderToEdit) return;
    setEditError('');
    setSubmitting(true);
    try {
      const payload = {};
      if (editFormData.UserAppId !== '') payload.UserAppId = editFormData.UserAppId;
      if (editFormData.Amount !== '') payload.Amount = parseFloat(editFormData.Amount);
      if (editFormData.meterValue !== '') payload.meterValue = parseFloat(editFormData.meterValue);
      if (editFormData.stopMethod !== undefined) payload.stopMethod = editFormData.stopMethod;
      if (editFormData.currentBalance !== '') payload.currentBalance = parseFloat(editFormData.currentBalance);
      if (editFormData.newBalance !== '') payload.newBalance = parseFloat(editFormData.newBalance);
      const res = await api.put(`/dashboard/orders/${orderToEdit.WalletTransactionId}`, payload);
      if (res.data.success) {
        setEditDialogOpen(false);
        setOrderToEdit(null);
        fetchOrders({ page, limit, search: searchApplied || undefined, dateFrom: dateFromApplied || undefined, dateTo: dateToApplied || undefined });
      } else {
        setEditError(res.data.message || 'Không thể cập nhật.');
      }
    } catch (err) {
      setEditError(err.response?.data?.message || 'Đã xảy ra lỗi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOrder = async (o) => {
    if (!window.confirm(`Bạn có chắc muốn xóa đơn sạc #${o.WalletTransactionId}?`)) return;
    setDeletingId(o.WalletTransactionId);
    try {
      const res = await api.delete(`/dashboard/orders/${o.WalletTransactionId}`);
      if (res.data.success) {
        fetchOrders({ page, limit, search: searchApplied || undefined, dateFrom: dateFromApplied || undefined, dateTo: dateToApplied || undefined });
      } else {
        alert(res.data.message || 'Không thể xóa.');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Đã xảy ra lỗi.');
    } finally {
      setDeletingId(null);
    }
  };

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
                      <th className="text-left font-medium p-3 whitespace-nowrap w-[80px]">Hành động</th>
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
                        <td className="p-3">
                          {isOwner ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Hành động</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openEditDialog(o)}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Sửa
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteOrder(o)}
                                disabled={deletingId === o.WalletTransactionId}
                                className="text-destructive focus:text-destructive"
                              >
                                {deletingId === o.WalletTransactionId ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4 mr-2" />
                                )}
                                Xóa
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          )}
                        </td>
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

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sửa đơn sạc</DialogTitle>
            <DialogDescription>Cập nhật thông tin đơn #{orderToEdit?.WalletTransactionId}.</DialogDescription>
          </DialogHeader>
          {orderToEdit && (
            <form onSubmit={handleEditOrder} className="space-y-4">
              <div className="space-y-2">
                <Label>ID người dùng (UserAppId)</Label>
                <Input
                  value={editFormData.UserAppId}
                  onChange={(e) => setEditFormData((f) => ({ ...f, UserAppId: e.target.value }))}
                  placeholder="ID người dùng"
                />
              </div>
              <div className="space-y-2">
                <Label>Giá tiền đơn sạc (Amount)</Label>
                <Input
                  type="number"
                  step="any"
                  value={editFormData.Amount}
                  onChange={(e) => setEditFormData((f) => ({ ...f, Amount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Giá trị meter (meterValue)</Label>
                <Input
                  type="number"
                  step="any"
                  value={editFormData.meterValue}
                  onChange={(e) => setEditFormData((f) => ({ ...f, meterValue: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Phương pháp dừng (stopMethod)</Label>
                <Input
                  value={editFormData.stopMethod}
                  onChange={(e) => setEditFormData((f) => ({ ...f, stopMethod: e.target.value }))}
                  placeholder="VD: Local, Remote..."
                />
              </div>
              <div className="space-y-2">
                <Label>Số dư hiện tại (currentBalance)</Label>
                <Input
                  type="number"
                  step="any"
                  value={editFormData.currentBalance}
                  onChange={(e) => setEditFormData((f) => ({ ...f, currentBalance: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Số dư mới (newBalance)</Label>
                <Input
                  type="number"
                  step="any"
                  value={editFormData.newBalance}
                  onChange={(e) => setEditFormData((f) => ({ ...f, newBalance: e.target.value }))}
                />
              </div>
              {editError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <p className="text-sm text-destructive">{editError}</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Lưu
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)} disabled={submitting}>
                  Hủy
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrderManagement;
