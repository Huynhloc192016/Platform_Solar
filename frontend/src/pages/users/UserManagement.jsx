import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ChevronLeft, ChevronRight, Loader2, Search, Users, MoreVertical, KeyRound, Lock, Unlock, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
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

const UserManagement = () => {
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

  const handleResetPassword = async (u) => {
    if (!u?.userId) return;
    if (!window.confirm(`Reset mật khẩu người dùng #${u.userId} về mặc định?`)) return;
    setResettingId(u.userId);
    try {
      const res = await api.put(`/dashboard/users/${u.userId}/reset-password`);
      if (res.data?.success) {
        alert(res.data?.message || 'Đã reset mật khẩu.');
      } else {
        alert(res.data?.message || 'Không thể reset mật khẩu.');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Đã xảy ra lỗi.');
    } finally {
      setResettingId(null);
    }
  };

  const handleToggleLock = async (u) => {
    if (!u?.userId) return;
    const currentLocked = !!u.isLocked;
    const nextLocked = !currentLocked;
    const label = nextLocked ? 'khóa' : 'mở khóa';
    if (!window.confirm(`Bạn có chắc muốn ${label} người dùng #${u.userId}?`)) return;
    setLockingId(u.userId);
    try {
      const res = await api.put(`/dashboard/users/${u.userId}/lock`, { locked: nextLocked });
      if (res.data?.success) {
        fetchUsers({ page, limit, search: searchApplied || undefined });
      } else {
        alert(res.data?.message || 'Không thể cập nhật trạng thái.');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Đã xảy ra lỗi.');
    } finally {
      setLockingId(null);
    }
  };

  const handleDeleteUser = async (u) => {
    if (!u?.userId) return;
    if (!window.confirm(`Bạn có chắc muốn xóa người dùng #${u.userId}?`)) return;
    setDeletingId(u.userId);
    try {
      const res = await api.delete(`/dashboard/users/${u.userId}`);
      if (res.data?.success) {
        fetchUsers({ page: 1, limit, search: searchApplied || undefined });
        setPage(1);
      } else {
        alert(res.data?.message || 'Không thể xóa người dùng.');
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
              <div className="overflow-x-auto rounded-md border border-slate-200">
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
                                disabled={resettingId === u.userId || lockingId === u.userId || deletingId === u.userId}
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
                                onClick={() => handleDeleteUser(u)}
                                disabled={resettingId === u.userId || lockingId === u.userId || deletingId === u.userId}
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
    </div>
  );
};

export default UserManagement;

