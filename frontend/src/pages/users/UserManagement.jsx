import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ChevronLeft, ChevronRight, Loader2, Search, Users, MoreVertical, KeyRound, Lock, Unlock, Trash2, Coins, SlidersHorizontal } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
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
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';

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

const UserManagement = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [searchInput, setSearchInput] = useState('');
  const [searchApplied, setSearchApplied] = useState('');
  const [resettingId, setResettingId] = useState(null);
  const [lockingId, setLockingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [balanceDialogOpen, setBalanceDialogOpen] = useState(false);
  const [balanceMode, setBalanceMode] = useState('add'); // 'add' | 'set'
  const [balanceUser, setBalanceUser] = useState(null);
  const [balanceValue, setBalanceValue] = useState('');
  const [balanceError, setBalanceError] = useState('');
  const [balancingId, setBalancingId] = useState(null);

  const fetchUsers = async (params) => {
    const { page: p = page, limit: l = limit, search: s } = params || {};
    try {
      setLoading(true);
      const requestParams = { page: p, limit: l };
      if (s !== undefined && s !== '') requestParams.search = s;
      const res = await api.get('/dashboard/users', { params: requestParams });
      if (res.data?.success) {
        setUsers(res.data.data || []);
        setTotal(res.data.total ?? 0);
      } else {
        setUsers([]);
        setTotal(0);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setUsers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers({ page, limit, search: searchApplied || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleSearch = () => {
    const q = searchInput.trim();
    setSearchApplied(q);
    setPage(1);
    fetchUsers({ page: 1, limit, search: q || undefined });
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchApplied('');
    setPage(1);
    fetchUsers({ page: 1, limit });
  };

  const hasActiveFilter = !!searchApplied;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handleResetPassword = (u) => {
    if (!u?.userId) return;
    confirm({
      title: 'Reset mật khẩu',
      message: `Reset mật khẩu người dùng #${u.userId} về mặc định?`,
      confirmLabel: 'Reset',
      onConfirm: async () => {
        setResettingId(u.userId);
        try {
          const res = await api.put(`/dashboard/users/${u.userId}/reset-password`);
          if (res.data?.success) {
            toast.success(res.data?.message || 'Đã reset mật khẩu.');
          } else {
            toast.error(res.data?.message || 'Không thể reset mật khẩu.');
          }
        } catch (err) {
          toast.error(err.response?.data?.message || 'Đã xảy ra lỗi.');
        } finally {
          setResettingId(null);
        }
      },
    });
  };

  const handleToggleLock = (u) => {
    if (!u?.userId) return;
    const currentLocked = !!u.isLocked;
    const nextLocked = !currentLocked;
    const label = nextLocked ? 'khóa' : 'mở khóa';
    confirm({
      title: 'Xác nhận',
      message: `Bạn có chắc muốn ${label} người dùng #${u.userId}?`,
      confirmLabel: 'Xác nhận',
      onConfirm: async () => {
        setLockingId(u.userId);
        try {
          const res = await api.put(`/dashboard/users/${u.userId}/lock`, { locked: nextLocked });
          if (res.data?.success) {
            fetchUsers({ page, limit, search: searchApplied || undefined });
          } else {
            toast.error(res.data?.message || 'Không thể cập nhật trạng thái.');
          }
        } catch (err) {
          toast.error(err.response?.data?.message || 'Đã xảy ra lỗi.');
        } finally {
          setLockingId(null);
        }
      },
    });
  };

  const handleDeleteUser = (u) => {
    if (!u?.userId) return;
    confirm({
      title: 'Xác nhận xóa',
      message: `Bạn có chắc muốn xóa người dùng #${u.userId}?`,
      confirmLabel: 'Xóa',
      variant: 'destructive',
      onConfirm: async () => {
        setDeletingId(u.userId);
        try {
          const res = await api.delete(`/dashboard/users/${u.userId}`);
          if (res.data?.success) {
            fetchUsers({ page: 1, limit, search: searchApplied || undefined });
            setPage(1);
          } else {
            toast.error(res.data?.message || 'Không thể xóa người dùng.');
          }
        } catch (err) {
          toast.error(err.response?.data?.message || 'Đã xảy ra lỗi.');
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  const openBalanceDialog = (u, mode) => {
    if (!u?.userId) return;
    setBalanceUser(u);
    setBalanceMode(mode);
    setBalanceValue('');
    setBalanceError('');
    setBalanceDialogOpen(true);
  };

  const handleSubmitBalance = async (e) => {
    e.preventDefault();
    if (!balanceUser?.userId) return;

    setBalanceError('');
    const v = Number(String(balanceValue).trim());
    if (!Number.isFinite(v)) {
      setBalanceError('Giá trị không hợp lệ.');
      return;
    }
    if (balanceMode === 'add' && v <= 0) {
      setBalanceError('Số tiền nạp phải > 0.');
      return;
    }
    if (balanceMode === 'set' && v < 0) {
      setBalanceError('Số dư phải >= 0.');
      return;
    }

    setBalancingId(balanceUser.userId);
    try {
      const userId = encodeURIComponent(balanceUser.userId);
      const url =
        balanceMode === 'add'
          ? `/dashboard/users/${userId}/balance/add`
          : `/dashboard/users/${userId}/balance/set`;
      const payload = balanceMode === 'add' ? { amount: v } : { balance: v };

      const res = await api.post(url, payload);
      if (res.data?.success) {
        setBalanceDialogOpen(false);
        fetchUsers({ page, limit, search: searchApplied || undefined });
        toast.success(res.data?.message || 'Thành công.');
      } else {
        setBalanceError(res.data?.message || 'Thao tác thất bại.');
      }
    } catch (err) {
      setBalanceError(err.response?.data?.message || 'Đã xảy ra lỗi.');
    } finally {
      setBalancingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Quản lý người dùng
          </CardTitle>
          <CardDescription>
            Danh sách người dùng (UserApp) và số dư hiện tại trong ví
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Tìm theo ID, username, họ tên, email, SĐT..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
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
          ) : users.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              {hasActiveFilter ? 'Không tìm thấy người dùng nào' : 'Chưa có người dùng nào'}
            </div>
          ) : (
            <>
              {/* Desktop: Table */}
              <div className="hidden lg:block overflow-x-auto rounded-md border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left font-medium p-3 whitespace-nowrap">ID người dùng</th>
                      <th className="text-left font-medium p-3 whitespace-nowrap">User name</th>
                      <th className="text-left font-medium p-3 whitespace-nowrap">Full name</th>
                      <th className="text-left font-medium p-3 whitespace-nowrap">Email</th>
                      <th className="text-left font-medium p-3 whitespace-nowrap">Số điện thoại</th>
                      <th className="text-left font-medium p-3 whitespace-nowrap">Số dư còn lại</th>
                      <th className="text-left font-medium p-3 whitespace-nowrap">Ngày tạo tài khoản</th>
                      <th className="text-left font-medium p-3 whitespace-nowrap w-[80px]">Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr
                        key={u.userId ?? Math.random()}
                        className="border-b border-slate-100 hover:bg-slate-50/50"
                      >
                        <td className="p-3">{u.userId ?? '—'}</td>
                        <td className="p-3">{u.userName ?? '—'}</td>
                        <td className="p-3">{u.fullName ?? '—'}</td>
                        <td className="p-3">{u.email ?? '—'}</td>
                        <td className="p-3">{u.phone ?? '—'}</td>
                        <td className="p-3">{u.balance != null ? formatNumber(u.balance) : '—'}</td>
                        <td className="p-3">{formatDateTime(u.createdAt)}</td>
                        <td className="p-3">
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Hành động</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleResetPassword(u)}
                                disabled={resettingId === u.userId || lockingId === u.userId || deletingId === u.userId}
                              >
                                {resettingId === u.userId ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <KeyRound className="w-4 h-4 mr-2" />
                                )}
                                Reset mật khẩu
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleToggleLock(u)}
                                disabled={resettingId === u.userId || lockingId === u.userId || deletingId === u.userId || balancingId === u.userId}
                              >
                                {lockingId === u.userId ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : u.isLocked ? (
                                  <Unlock className="w-4 h-4 mr-2" />
                                ) : (
                                  <Lock className="w-4 h-4 mr-2" />
                                )}
                                {u.isLocked ? 'Mở khóa' : 'Khóa'}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => openBalanceDialog(u, 'add')}
                                disabled={resettingId === u.userId || lockingId === u.userId || deletingId === u.userId || balancingId === u.userId}
                              >
                                <Coins className="w-4 h-4 mr-2" />
                                Nạp tiền
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => openBalanceDialog(u, 'set')}
                                disabled={resettingId === u.userId || lockingId === u.userId || deletingId === u.userId || balancingId === u.userId}
                              >
                                <SlidersHorizontal className="w-4 h-4 mr-2" />
                                Set số dư
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDeleteUser(u)}
                                disabled={resettingId === u.userId || lockingId === u.userId || deletingId === u.userId || balancingId === u.userId}
                                className="text-destructive focus:text-destructive"
                              >
                                {deletingId === u.userId ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4 mr-2" />
                                )}
                                Xóa
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: Cards */}
              <div className="lg:hidden space-y-4">
                {users.map((u) => (
                  <Card key={u.userId ?? Math.random()}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <p className="text-sm font-medium">{(u.fullName || u.userName || u.userId) ?? '—'}</p>
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleResetPassword(u)} disabled={resettingId === u.userId || lockingId === u.userId || deletingId === u.userId}>
                              {resettingId === u.userId ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
                              Reset mật khẩu
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleLock(u)} disabled={resettingId === u.userId || lockingId === u.userId || deletingId === u.userId || balancingId === u.userId}>
                              {lockingId === u.userId ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : u.isLocked ? <Unlock className="w-4 h-4 mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                              {u.isLocked ? 'Mở khóa' : 'Khóa'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openBalanceDialog(u, 'add')} disabled={resettingId === u.userId || lockingId === u.userId || deletingId === u.userId || balancingId === u.userId}>
                              <Coins className="w-4 h-4 mr-2" />
                              Nạp tiền
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openBalanceDialog(u, 'set')} disabled={resettingId === u.userId || lockingId === u.userId || deletingId === u.userId || balancingId === u.userId}>
                              <SlidersHorizontal className="w-4 h-4 mr-2" />
                              Set số dư
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDeleteUser(u)} disabled={resettingId === u.userId || lockingId === u.userId || deletingId === u.userId || balancingId === u.userId} className="text-destructive focus:text-destructive">
                              {deletingId === u.userId ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                              Xóa
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <p className="text-xs text-muted-foreground">{u.email ?? '—'} • {u.phone ?? '—'}</p>
                      <p className="text-sm">Số dư: {u.balance != null ? formatNumber(u.balance) : '—'}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(u.createdAt)}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Trang {page} / {totalPages} • Tổng {total} người dùng
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

      <Dialog
        open={balanceDialogOpen}
        onOpenChange={(open) => {
          setBalanceDialogOpen(open);
          if (!open) {
            setBalanceUser(null);
            setBalanceValue('');
            setBalanceError('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{balanceMode === 'add' ? 'Nạp tiền' : 'Set số dư'}</DialogTitle>
            <DialogDescription>
              {balanceUser?.userId ? `Người dùng #${balanceUser.userId}` : 'Chọn người dùng để thao tác'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitBalance} className="space-y-4">
            <div className="space-y-2">
              <Label>{balanceMode === 'add' ? 'Số tiền nạp' : 'Số dư muốn set'}</Label>
              <Input
                type="number"
                step="any"
                value={balanceValue}
                onChange={(e) => setBalanceValue(e.target.value)}
                placeholder={balanceMode === 'add' ? 'VD: 50000' : 'VD: 150000'}
              />
            </div>

            {balanceError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive">{balanceError}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button type="submit" disabled={!balanceUser?.userId || balancingId === balanceUser?.userId}>
                {balancingId === balanceUser?.userId ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Xác nhận
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setBalanceDialogOpen(false)}
                disabled={balancingId === balanceUser?.userId}
              >
                Hủy
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;

