import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { 
  Search, 
  MapPin, 
  Map,
  MoreVertical,
  Eye,
  Building2,
  Zap,
  Loader2,
  Plus,
  Pencil,
  Trash2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../services/api';

const StationManagement = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const openStationId = location.state?.stationId;
  const filterOwnerId = location.state?.ownerId;
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStation, setSelectedStation] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [owners, setOwners] = useState([]);
  const [formData, setFormData] = useState({
    Name: '',
    Address: '',
    OwnerId: '',
    Status: 1,
    Type: 'Public',
    Latitude: '',
    Longitude: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [stationToEdit, setStationToEdit] = useState(null);
  const [editError, setEditError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    fetchStations();
  }, []);

  // Mở chi tiết trạm khi điều hướng từ danh sách trụ
  useEffect(() => {
    if (!loading && openStationId && stations.length > 0) {
      const station = stations.find((s) => s.ChargeStationId === openStationId);
      if (station) {
        setSelectedStation(station);
        setDetailsOpen(true);
        navigate(location.pathname, { replace: true, state: filterOwnerId != null ? { ownerId: filterOwnerId } : {} });
      }
    }
  }, [loading, openStationId, stations, navigate, location.pathname, filterOwnerId]);

  useEffect(() => {
    if (addDialogOpen || editDialogOpen) {
      setAddError('');
      setEditError('');
      api.get('/dashboard/owners')
        .then((res) => {
          if (res.data.success) setOwners(res.data.data || []);
        })
        .catch(() => setOwners([]));
    }
  }, [addDialogOpen, editDialogOpen]);

  const fetchStations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/dashboard/stations');
      if (response.data.success) {
        setStations(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching stations:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredStations = stations.filter((station) => {
    if (filterOwnerId != null && station.OwnerId !== filterOwnerId) return false;
    const matchesSearch =
      (station.Name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (station.Address || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (station.ChargeStationId || '').toString().includes(searchTerm);
    return matchesSearch;
  });

  const getStatusBadge = (status) => {
    const statusNum = status === 1 || status === '1' || status === 'active';
    if (statusNum) {
      return <Badge className="bg-green-100 text-green-800 border-green-200">Hoạt động</Badge>;
    }
    return <Badge className="bg-gray-100 text-gray-800 border-gray-200">Không hoạt động</Badge>;
  };

  const openStationDetails = (station) => {
    setSelectedStation(station);
    setDetailsOpen(true);
  };

  const handleAddStation = async (e) => {
    e.preventDefault();
    setAddError('');
    setSubmitting(true);
    try {
      const payload = {
        Name: formData.Name.trim(),
        Address: formData.Address.trim(),
        Status: formData.Status !== undefined && formData.Status !== '' ? Number(formData.Status) : 1,
        Type: formData.Type || null,
        Latitude: formData.Latitude !== '' ? parseFloat(formData.Latitude) : null,
        Longitude: formData.Longitude !== '' ? parseFloat(formData.Longitude) : null,
      };
      if (formData.OwnerId) payload.OwnerId = parseInt(formData.OwnerId, 10);
      const res = await api.post('/dashboard/stations', payload);
      if (res.data.success) {
        setAddDialogOpen(false);
        setFormData({ Name: '', Address: '', OwnerId: '', Status: 1, Type: 'Public', Latitude: '', Longitude: '' });
        fetchStations();
      } else {
        setAddError(res.data.message || 'Không thể thêm trạm sạc');
      }
    } catch (err) {
      setAddError(err.response?.data?.message || 'Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = (station) => {
    setStationToEdit(station);
    setFormData({
      Name: station.Name || '',
      Address: station.Address || '',
      OwnerId: station.OwnerId ? String(station.OwnerId) : '',
      Status: station.Status !== undefined && station.Status !== null ? Number(station.Status) : 1,
      Type: station.Type || 'Public',
      Latitude: station.Latitude != null && station.Latitude !== '' ? String(station.Latitude) : '',
      Longitude: station.Longitude != null && station.Longitude !== '' ? String(station.Longitude) : '',
    });
    setEditDialogOpen(true);
  };

  const handleEditStation = async (e) => {
    e.preventDefault();
    if (!stationToEdit) return;
    setEditError('');
    setSubmitting(true);
    try {
      const payload = {
        Name: formData.Name.trim(),
        Address: formData.Address.trim(),
        Status: formData.Status !== undefined && formData.Status !== '' ? Number(formData.Status) : 1,
        Type: formData.Type || null,
        Latitude: formData.Latitude !== '' ? parseFloat(formData.Latitude) : null,
        Longitude: formData.Longitude !== '' ? parseFloat(formData.Longitude) : null,
      };
      if (formData.OwnerId) payload.OwnerId = parseInt(formData.OwnerId, 10);
      const res = await api.put(`/dashboard/stations/${stationToEdit.ChargeStationId}`, payload);
      if (res.data.success) {
        setEditDialogOpen(false);
        setStationToEdit(null);
        setFormData({ Name: '', Address: '', OwnerId: '', Status: 1, Type: 'Public', Latitude: '', Longitude: '' });
        fetchStations();
      } else {
        setEditError(res.data.message || 'Không thể cập nhật trạm sạc');
      }
    } catch (err) {
      setEditError(err.response?.data?.message || 'Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStation = async (station) => {
    if (!window.confirm(`Bạn có chắc muốn xóa trạm "${station.Name || 'N/A'}"? Hành động này không thể hoàn tác.`)) {
      return;
    }
    setDeletingId(station.ChargeStationId);
    try {
      const res = await api.delete(`/dashboard/stations/${station.ChargeStationId}`);
      if (res.data.success) {
        fetchStations();
      } else {
        alert(res.data.message || 'Không thể xóa trạm sạc');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setDeletingId(null);
    }
  };

  const openStationOnGoogleMaps = (station) => {
    const lat = station?.Latitude ?? station?.Lat;
    const lng = station?.Longitude ?? station?.Long;
    if (lat != null && lng != null && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng))) {
      const url = `https://www.google.com/maps?q=${Number(lat)},${Number(lng)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      alert('Trạm này chưa có tọa độ. Vui lòng cập nhật Lat/Long trong phần Sửa.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle>Quản lý trạm sạc</CardTitle>
          <CardDescription>Theo dõi và quản lý các ChargeStation trong hệ thống</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Tìm kiếm theo tên, địa chỉ hoặc ID trạm..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Thêm trạm sạc
            </Button>
          </div>
        </CardContent>
      </Card>

      {filterOwnerId != null && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-2">
          <span className="text-sm">
            Đang xem trạm của chủ đầu tư:{' '}
            {stations.find((s) => s.OwnerId == filterOwnerId)?.OwnerName || `#${filterOwnerId}`}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/stations', { replace: true, state: {} })}
          >
            Xem tất cả trạm
          </Button>
        </div>
      )}

      {/* Stations Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredStations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {searchTerm
              ? 'Không tìm thấy trạm sạc nào'
              : filterOwnerId != null
                ? 'Chủ đầu tư này chưa có trạm sạc nào'
                : 'Chưa có trạm sạc nào'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredStations.map((station) => (
            <Card key={station.ChargeStationId} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Building2 className="w-5 h-5 shrink-0" />
                      <span className="truncate" title={station.Name || 'N/A'}>
                        {station.Name || 'N/A'}
                      </span>
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate" title={station.Address || 'N/A'}>
                        {station.Address || 'N/A'}
                      </span>
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Hành động</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => openStationDetails(station)}>
                        <Eye className="w-4 h-4 mr-2" />
                        Xem chi tiết
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEditDialog(station)}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Sửa
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDeleteStation(station)}
                        disabled={deletingId === station.ChargeStationId}
                        className="text-destructive focus:text-destructive"
                      >
                        {deletingId === station.ChargeStationId ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 mr-2" />
                        )}
                        Xóa
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => openStationOnGoogleMaps(station)}
                        disabled={station.Latitude == null && station.Longitude == null}
                      >
                        <Map className="w-4 h-4 mr-2" />
                        Xem bản đồ
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Trạng thái</span>
                  {getStatusBadge(station.Status)}
                </div>

                {/* Station Info */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Loại</p>
                    <p className="text-sm font-medium">{station.Type || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tọa độ</p>
                    <p className="text-sm font-medium truncate" title={station.Latitude != null && station.Longitude != null ? `${station.Latitude}, ${station.Longitude}` : 'Chưa cập nhật'}>
                      {station.Latitude != null && station.Longitude != null
                        ? `${Number(station.Latitude).toFixed(5)}, ${Number(station.Longitude).toFixed(5)}`
                        : 'Chưa cập nhật'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Chủ sở hữu</p>
                    {station.OwnerId ? (
                      <button
                        type="button"
                        onClick={() => navigate('/stations')}
                        className="text-sm font-medium text-primary hover:underline text-left"
                      >
                        {station.OwnerName || 'N/A'}
                      </button>
                    ) : (
                      <p className="text-sm font-medium">{station.OwnerName || 'N/A'}</p>
                    )}
                  </div>
                </div>

                {/* ChargePoints */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <p className="text-sm font-medium flex items-center gap-1">
                    <Zap className="w-4 h-4" />
                    ChargePoints ({station.ChargePoints?.length || station.QtyChargePoint || 0})
                  </p>
                  {station.ActiveTransactions > 0 && (
                    <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                      {station.ActiveTransactions} đang sạc
                    </Badge>
                  )}
                </div>

                {/* Actions */}
                <Button 
                  onClick={() => openStationDetails(station)}
                  className="w-full" 
                  variant="outline"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Xem chi tiết
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Station Dialog */}
      <Dialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          setAddDialogOpen(open);
          if (!open) {
            setFormData({ Name: '', Address: '', OwnerId: '', Status: 1, Type: 'Public', Latitude: '', Longitude: '' });
            setAddError('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Thêm trạm sạc
            </DialogTitle>
            <DialogDescription>Nhập thông tin trạm sạc mới</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddStation} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="add-name">Tên trạm *</Label>
              <Input
                id="add-name"
                value={formData.Name}
                onChange={(e) => setFormData({ ...formData, Name: e.target.value })}
                placeholder="VD: Trạm sạc ABC"
                required
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-address">Địa chỉ *</Label>
              <Input
                id="add-address"
                value={formData.Address}
                onChange={(e) => setFormData({ ...formData, Address: e.target.value })}
                placeholder="VD: 123 Đường XYZ, Quận 1"
                required
                disabled={submitting}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="add-status">Trạng thái</Label>
                <select
                  id="add-status"
                  value={formData.Status}
                  onChange={(e) => setFormData({ ...formData, Status: e.target.value })}
                  disabled={submitting}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value={1}>Hoạt động</option>
                  <option value={0}>Không hoạt động</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-type">Loại trạm</Label>
                <select
                  id="add-type"
                  value={formData.Type}
                  onChange={(e) => setFormData({ ...formData, Type: e.target.value })}
                  disabled={submitting}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="Public">Public</option>
                  <option value="Private">Private</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="add-lat">Vĩ độ (Lat)</Label>
                <Input
                  id="add-lat"
                  type="number"
                  step="any"
                  placeholder="VD: 10.762622"
                  value={formData.Latitude}
                  onChange={(e) => setFormData({ ...formData, Latitude: e.target.value })}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-long">Kinh độ (Long)</Label>
                <Input
                  id="add-long"
                  type="number"
                  step="any"
                  placeholder="VD: 106.660172"
                  value={formData.Longitude}
                  onChange={(e) => setFormData({ ...formData, Longitude: e.target.value })}
                  disabled={submitting}
                />
              </div>
            </div>
            {owners.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="add-owner">Chủ sở hữu</Label>
                <select
                  id="add-owner"
                  value={formData.OwnerId}
                  onChange={(e) => setFormData({ ...formData, OwnerId: e.target.value })}
                  disabled={submitting}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">-- Chọn chủ sở hữu --</option>
                  {owners.map((o) => (
                    <option key={o.OwnerId} value={o.OwnerId}>
                      {o.Name || `Owner #${o.OwnerId}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
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
                  'Thêm trạm sạc'
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

      {/* Edit Station Dialog */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setStationToEdit(null);
            setFormData({ Name: '', Address: '', OwnerId: '', Status: 1, Type: 'Public', Latitude: '', Longitude: '' });
            setEditError('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              Sửa trạm sạc
            </DialogTitle>
            <DialogDescription>Cập nhật thông tin trạm sạc</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditStation} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Tên trạm *</Label>
              <Input
                id="edit-name"
                value={formData.Name}
                onChange={(e) => setFormData({ ...formData, Name: e.target.value })}
                placeholder="VD: Trạm sạc ABC"
                required
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-address">Địa chỉ *</Label>
              <Input
                id="edit-address"
                value={formData.Address}
                onChange={(e) => setFormData({ ...formData, Address: e.target.value })}
                placeholder="VD: 123 Đường XYZ, Quận 1"
                required
                disabled={submitting}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-status">Trạng thái</Label>
                <select
                  id="edit-status"
                  value={formData.Status}
                  onChange={(e) => setFormData({ ...formData, Status: e.target.value })}
                  disabled={submitting}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value={1}>Hoạt động</option>
                  <option value={0}>Không hoạt động</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-type">Loại trạm</Label>
                <select
                  id="edit-type"
                  value={formData.Type}
                  onChange={(e) => setFormData({ ...formData, Type: e.target.value })}
                  disabled={submitting}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="Public">Public</option>
                  <option value="Private">Private</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-lat">Vĩ độ (Lat)</Label>
                <Input
                  id="edit-lat"
                  type="number"
                  step="any"
                  placeholder="VD: 10.762622"
                  value={formData.Latitude}
                  onChange={(e) => setFormData({ ...formData, Latitude: e.target.value })}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-long">Kinh độ (Long)</Label>
                <Input
                  id="edit-long"
                  type="number"
                  step="any"
                  placeholder="VD: 106.660172"
                  value={formData.Longitude}
                  onChange={(e) => setFormData({ ...formData, Longitude: e.target.value })}
                  disabled={submitting}
                />
              </div>
            </div>
            {owners.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="edit-owner">Chủ sở hữu</Label>
                <select
                  id="edit-owner"
                  value={formData.OwnerId}
                  onChange={(e) => setFormData({ ...formData, OwnerId: e.target.value })}
                  disabled={submitting}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">-- Chọn chủ sở hữu --</option>
                  {owners.map((o) => (
                    <option key={o.OwnerId} value={o.OwnerId}>
                      {o.Name || `Owner #${o.OwnerId}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
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
                    Đang lưu...
                  </>
                ) : (
                  'Lưu thay đổi'
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

      {/* Station Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  {selectedStation?.Name || 'N/A'}
                </DialogTitle>
                <DialogDescription>{selectedStation?.Address || 'N/A'}</DialogDescription>
              </div>
              {selectedStation && (
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDetailsOpen(false);
                      openEditDialog(selectedStation);
                    }}
                  >
                    <Pencil className="w-4 h-4 mr-1" />
                    Sửa
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      setDetailsOpen(false);
                      handleDeleteStation(selectedStation);
                    }}
                    disabled={deletingId === selectedStation.ChargeStationId}
                  >
                    {deletingId === selectedStation.ChargeStationId ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 mr-1" />
                    )}
                    Xóa
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>
          
          {selectedStation && (
            <div className="space-y-6">
              {/* Status Overview */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Trạng thái</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {getStatusBadge(selectedStation.Status)}
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Giao dịch đang diễn ra</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{selectedStation.ActiveTransactions || 0}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Station Information */}
              <div>
                <h3 className="font-semibold mb-3">Thông tin trạm</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Chủ sở hữu</p>
                    <p className="font-medium">{selectedStation.OwnerName || 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Loại trạm</p>
                    <p className="font-medium">{selectedStation.Type || 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Tọa độ (Lat, Long)</p>
                    <p className="font-medium">
                      {selectedStation.Latitude != null && selectedStation.Longitude != null
                        ? `${Number(selectedStation.Latitude).toFixed(6)}, ${Number(selectedStation.Longitude).toFixed(6)}`
                        : 'Chưa cập nhật'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Số lượng ChargePoint</p>
                    <p className="font-medium">{selectedStation.ChargePoints?.length || selectedStation.QtyChargePoint || 0}</p>
                  </div>
                </div>
              </div>

              {/* ChargePoints */}
              {selectedStation.ChargePoints && selectedStation.ChargePoints.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">ChargePoints</h3>
                  <div className="space-y-3">
                    {selectedStation.ChargePoints.map((cp) => {
                      const getChargePointStatusBadge = (status) => {
                        const statusMap = {
                          'Available': 'bg-green-100 text-green-800 border-green-200',
                          'Charging': 'bg-blue-100 text-blue-800 border-blue-200',
                          'Unavailable': 'bg-gray-100 text-gray-800 border-gray-200',
                          'Faulted': 'bg-red-100 text-red-800 border-red-200',
                          'Preparing': 'bg-yellow-100 text-yellow-800 border-yellow-200',
                          'Finishing': 'bg-blue-100 text-blue-800 border-blue-200'
                        };
                        const statusClass = statusMap[status] || statusMap['Unavailable'];
                        return <Badge className={statusClass}>{status || 'Unavailable'}</Badge>;
                      };

                      return (
                        <Card key={cp.ChargePointId}>
                          <CardContent className="pt-6">
                            <div className="space-y-3">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h4 className="font-semibold">{cp.Name || cp.ChargePointId}</h4>
                                  <p className="text-sm text-muted-foreground">{cp.ChargePointId}</p>
                                </div>
                                {getChargePointStatusBadge(cp.ChargePointState)}
                              </div>
                              
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t">
                                <div>
                                  <p className="text-xs text-muted-foreground">Model</p>
                                  <p className="text-sm font-medium">{cp.ChargePointModel || 'N/A'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Công suất</p>
                                  <p className="text-sm font-medium">{cp.chargerPower || 0}kW</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Loại đầu ra</p>
                                  <p className="text-sm font-medium">{cp.outputType || 'N/A'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Connector</p>
                                  <p className="text-sm font-medium">{cp.connectorType || 'N/A'}</p>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StationManagement;
