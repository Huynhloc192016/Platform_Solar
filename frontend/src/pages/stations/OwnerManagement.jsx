import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import {
  Search,
  Building2,
  Loader2,
  MapPin,
  ExternalLink,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  KeyRound,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
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

const OwnerManagement = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = !user?.ownerId;
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ Name: '', Address: '', Phone: '', Email: '' });
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [ownerToEdit, setOwnerToEdit] = useState(null);
  const [editFormData, setEditFormData] = useState({ Name: '', Address: '', Phone: '', Email: '' });
  const [editError, setEditError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [accountActionId, setAccountActionId] = useState(null);

  useEffect(() => {
    fetchOwners();
  }, []);

  const fetchOwners = async () => {
    try {
      setLoading(true);
      const response = await api.get('/dashboard/owners');
      if (response.data.success) {
        setOwners(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching owners:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredOwners = owners.filter(
    (owner) =>
      (owner.Name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (owner.OwnerId || '').toString().includes(searchTerm)
  );

  const handleAddOwner = async (e) => {
    e.preventDefault();
    setAddError('');
    setSubmitting(true);
    try {
      const res = await api.post('/dashboard/owners', {
        Name: formData.Name.trim(),
        Address: formData.Address.trim() || undefined,
        Phone: formData.Phone.trim() || undefined,
        Email: formData.Email.trim() || undefined,
      });
      if (res.data.success) {
        setAddDialogOpen(false);
        setFormData({ Name: '', Address: '', Phone: '', Email: '' });
        fetchOwners();
      } else {
        setAddError(res.data.message || 'Không thể thêm chủ đầu tư');
      }
    } catch (err) {
      setAddError(err.response?.data?.message || 'Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = async (owner) => {
    setOwnerToEdit(owner);
    setEditError('');
    setEditFormData({ Name: owner.Name || '', Address: '', Phone: '', Email: '' });
    try {
      const res = await api.get(`/dashboard/owners/${owner.OwnerId}`);
      if (res.data.success && res.data.data) {
        const o = res.data.data;
        setEditFormData({
          Name: o.Name || '',
          Address: o.Address || '',
          Phone: o.Phone || '',
          Email: o.Email || '',
        });
      }
    } catch (err) {
      setEditError(err.response?.data?.message || 'Không thể tải thông tin chủ đầu tư');
    }
    setEditDialogOpen(true);
  };

  const handleEditOwner = async (e) => {
    e.preventDefault();
    if (!ownerToEdit) return;
    setEditError('');
    setSubmitting(true);
    try {
      const res = await api.put(`/dashboard/owners/${ownerToEdit.OwnerId}`, {
        Name: editFormData.Name.trim(),
        Address: editFormData.Address.trim() || undefined,
        Phone: editFormData.Phone.trim() || undefined,
        Email: editFormData.Email.trim() || undefined,
      });
      if (res.data.success) {
        setEditDialogOpen(false);
        setOwnerToEdit(null);
        fetchOwners();
      } else {
        setEditError(res.data.message || 'Không thể cập nhật chủ đầu tư');
      }
    } catch (err) {
      setEditError(err.response?.data?.message || 'Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOwner = async (owner) => {
    if (!window.confirm(`Bạn có chắc muốn xóa "${owner.Name || 'N/A'}"? Hành động này không thể hoàn tác.`)) return;
    setDeletingId(owner.OwnerId);
    try {
      const res = await api.delete(`/dashboard/owners/${owner.OwnerId}`);
      if (res.data.success) {
        fetchOwners();
      } else {
        alert(res.data.message || 'Không thể xóa chủ đầu tư');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleOwnerAccountAction = async (owner) => {
    const hasAccount = !!owner.LoginUserName;
    const usernameLabel = owner.LoginUserName || '(sẽ tạo tự động)';
    const confirmMessage = hasAccount
      ? `Reset mật khẩu về "Admin@2026" cho tài khoản "${owner.LoginUserName}"?`
      : `Tạo tài khoản đăng nhập cho chủ đầu tư "${owner.Name || 'N/A'}" với mật khẩu mặc định "Admin@2026"?\n\nTên đăng nhập: ${usernameLabel}`;

    if (!window.confirm(confirmMessage)) return;

    setAccountActionId(owner.OwnerId);
    try {
      const res = await api.post(`/dashboard/owners/${owner.OwnerId}/account`);
      if (res.data?.success) {
        const action = res.data.data?.action;
        const username = res.data.data?.username || owner.LoginUserName;
        if (action === 'created') {
          alert(
            `Đã tạo tài khoản đăng nhập cho chủ đầu tư.\n\nTên đăng nhập: ${username}\nMật khẩu mặc định: Admin@2026`
          );
        } else if (action === 'reset') {
          alert(
            `Đã reset mật khẩu cho tài khoản "${username}".\n\nMật khẩu mới: Admin@2026`
          );
        } else {
          alert('Thao tác tài khoản đã hoàn tất.');
        }
        fetchOwners();
      } else {
        alert(res.data?.message || 'Không thể thao tác tài khoản cho chủ đầu tư');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setAccountActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Danh sách chủ đầu tư</CardTitle>
          <CardDescription>Quản lý thông tin các chủ đầu tư trong hệ thống</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Tìm kiếm theo tên hoặc ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {isAdmin && (
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Thêm chủ đầu tư
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredOwners.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {searchTerm ? 'Không tìm thấy chủ đầu tư nào' : 'Chưa có chủ đầu tư nào'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredOwners.map((owner) => (
            <Card key={owner.OwnerId} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Building2 className="w-5 h-5" />
                      {owner.Name || `Chủ đầu tư #${owner.OwnerId}`}
                    </CardTitle>
                    <CardDescription className="space-y-0.5">
                      <div>ID: {owner.OwnerId}</div>
                      <div>
                        Tài khoản đăng nhập:{' '}
                        {owner.LoginUserName ? (
                          <span className="font-medium text-foreground">{owner.LoginUserName}</span>
                        ) : (
                          <span className="text-muted-foreground italic">Chưa có</span>
                        )}
                      </div>
                    </CardDescription>
                  </div>
                  {isAdmin && (
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Hành động</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleOwnerAccountAction(owner)}
                          disabled={accountActionId === owner.OwnerId}
                        >
                          {accountActionId === owner.OwnerId ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <KeyRound className="w-4 h-4 mr-2" />
                          )}
                          {owner.LoginUserName ? 'Reset mật khẩu' : 'Tạo tài khoản'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openEditDialog(owner)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Sửa
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteOwner(owner)}
                          disabled={deletingId === owner.OwnerId}
                          className="text-destructive focus:text-destructive"
                        >
                          {deletingId === owner.OwnerId ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4 mr-2" />
                          )}
                          Xóa
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span>{owner.StationCount ?? 0} trạm</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => navigate('/stations', { state: { ownerId: owner.OwnerId } })}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Xem danh sách trạm
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Owner Dialog */}
      <Dialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          setAddDialogOpen(open);
          if (!open) {
            setFormData({ Name: '', Address: '', Phone: '', Email: '' });
            setAddError('');
          }
        }}
      >
        <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Thêm chủ đầu tư
          </DialogTitle>
          <DialogDescription>Nhập thông tin chủ đầu tư mới</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleAddOwner} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="add-owner-name">Tên chủ đầu tư *</Label>
            <Input
              id="add-owner-name"
              value={formData.Name}
              onChange={(e) => setFormData({ ...formData, Name: e.target.value })}
              placeholder="VD: Công ty ABC"
              required
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-owner-address">Địa chỉ</Label>
            <Input
              id="add-owner-address"
              value={formData.Address}
              onChange={(e) => setFormData({ ...formData, Address: e.target.value })}
              placeholder="VD: 123 Đường XYZ, Quận 1"
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-owner-phone">Số điện thoại</Label>
            <Input
              id="add-owner-phone"
              value={formData.Phone}
              onChange={(e) => setFormData({ ...formData, Phone: e.target.value })}
              placeholder="VD: 0901234567"
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-owner-email">Email</Label>
            <Input
              id="add-owner-email"
              type="email"
              value={formData.Email}
              onChange={(e) => setFormData({ ...formData, Email: e.target.value })}
              placeholder="VD: contact@example.com"
              disabled={submitting}
            />
          </div>
          {addError && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">{addError}</p>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Đang thêm...
                </>
              ) : (
                'Thêm chủ đầu tư'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
              disabled={submitting}
            >
              Hủy
            </Button>
          </div>
        </form>
        </DialogContent>
      </Dialog>

      {/* Edit Owner Dialog */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setOwnerToEdit(null);
            setEditFormData({ Name: '', Address: '', Phone: '', Email: '' });
            setEditError('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              Sửa chủ đầu tư
            </DialogTitle>
            <DialogDescription>Cập nhật thông tin chủ đầu tư</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditOwner} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-owner-name">Tên chủ đầu tư *</Label>
              <Input
                id="edit-owner-name"
                value={editFormData.Name}
                onChange={(e) => setEditFormData({ ...editFormData, Name: e.target.value })}
                placeholder="VD: Công ty ABC"
                required
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-owner-address">Địa chỉ</Label>
              <Input
                id="edit-owner-address"
                value={editFormData.Address}
                onChange={(e) => setEditFormData({ ...editFormData, Address: e.target.value })}
                placeholder="VD: 123 Đường XYZ, Quận 1"
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-owner-phone">Số điện thoại</Label>
              <Input
                id="edit-owner-phone"
                value={editFormData.Phone}
                onChange={(e) => setEditFormData({ ...editFormData, Phone: e.target.value })}
                placeholder="VD: 0901234567"
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-owner-email">Email</Label>
              <Input
                id="edit-owner-email"
                type="email"
                value={editFormData.Email}
                onChange={(e) => setEditFormData({ ...editFormData, Email: e.target.value })}
                placeholder="VD: contact@example.com"
                disabled={submitting}
              />
            </div>
            {editError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive">{editError}</p>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Đang cập nhật...
                  </>
                ) : (
                  'Cập nhật'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                disabled={submitting}
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

export default OwnerManagement;
