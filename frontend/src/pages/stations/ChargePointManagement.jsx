import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Search, Zap, Loader2, MapPin, Plus, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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

const OUTPUT_TYPES = [
  { value: 'AC', label: 'AC' },
  { value: 'DC', label: 'DC' },
];

const OCPP_VERSIONS = [
  { value: '1.6', label: 'OCPP 1.6' },
  { value: '2.0', label: 'OCPP 2.0' },
];

const OPERATIONAL_STATUS = [
  { value: 1, label: 'Đang vận hành' },
  { value: 0, label: 'Dừng' },
];

const selectInputClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const ChargePointManagement = () => {
  const navigate = useNavigate();
  const [chargePoints, setChargePoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [stations, setStations] = useState([]);
  const [formData, setFormData] = useState({
    ChargePointId: '',
    Name: '',
    ChargeStationId: '',
    ChargePointModel: '',
    chargerPower: '',
    outputType: 'DC',
    connectorType: 'CCS2',
    ocppVersion: '1.6',
    isActive: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [chargePointToEdit, setChargePointToEdit] = useState(null);
  const [editFormData, setEditFormData] = useState({
    Name: '',
    ChargeStationId: '',
    ChargePointModel: '',
    chargerPower: '',
    outputType: '',
    connectorType: '',
    ocppVersion: '1.6',
    isActive: true,
  });
  const [editError, setEditError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    fetchChargePoints();
  }, []);

  useEffect(() => {
    if (addDialogOpen || editDialogOpen) {
      setAddError('');
      setEditError('');
      api
        .get('/dashboard/stations')
        .then((res) => {
          if (res.data.success) setStations(res.data.data || []);
        })
        .catch(() => setStations([]));
    }
  }, [addDialogOpen, editDialogOpen]);

  const fetchChargePoints = async () => {
    try {
      setLoading(true);
      const response = await api.get('/dashboard/chargepoints');
      if (response.data.success) {
        setChargePoints(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching charge points:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      Available: { label: 'Sẵn sàng', className: 'bg-green-100 text-green-800 border-green-200' },
      Charging: { label: 'Đang sạc', className: 'bg-blue-100 text-blue-800 border-blue-200' },
      Unavailable: { label: 'Không khả dụng', className: 'bg-gray-100 text-gray-800 border-gray-200' },
      Faulted: { label: 'Lỗi', className: 'bg-red-100 text-red-800 border-red-200' },
      Preparing: { label: 'Chuẩn bị', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      Finishing: { label: 'Hoàn tất', className: 'bg-slate-100 text-slate-800 border-slate-200' },
    };
    const config = statusMap[status] || statusMap.Unavailable;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const filteredChargePoints = chargePoints.filter(
    (cp) =>
      (cp.Name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cp.ChargePointId || '').toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cp.StationName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cp.OwnerName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddChargePoint = async (e) => {
    e.preventDefault();
    setAddError('');
    setSubmitting(true);
    try {
      const payload = {
        ChargePointId: formData.ChargePointId.trim(),
        Name: formData.Name.trim() || undefined,
        ChargeStationId: formData.ChargeStationId || undefined,
        ChargePointModel: formData.ChargePointModel.trim() || undefined,
        chargerPower: formData.chargerPower ? parseFloat(formData.chargerPower) : 0,
        outputType: formData.outputType.trim() || undefined,
        connectorType: formData.connectorType.trim() || undefined,
        OcppVersion: formData.ocppVersion || undefined,
        IsActive: formData.isActive,
      };
      const res = await api.post('/dashboard/chargepoints', payload);
      if (res.data.success) {
        setAddDialogOpen(false);
        setFormData({
          ChargePointId: '',
          Name: '',
          ChargeStationId: '',
          ChargePointModel: '',
          chargerPower: '',
          outputType: 'DC',
          connectorType: 'CCS2',
          ocppVersion: '1.6',
          isActive: true,
        });
        fetchChargePoints();
      } else {
        setAddError(res.data.message || 'Không thể thêm trụ sạc');
      }
    } catch (err) {
      const errData = err.response?.data;
      const msg =
        Array.isArray(errData?.errors) && errData.errors.length > 0
          ? errData.errors[0]?.msg
          : errData?.message;
      setAddError(msg || 'Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = (cp) => {
    setChargePointToEdit(cp);
    setEditFormData({
      Name: cp.Name || '',
      ChargeStationId: cp.ChargeStationId ? String(cp.ChargeStationId) : '',
      ChargePointModel: cp.ChargePointModel || '',
      chargerPower: cp.chargerPower != null ? String(cp.chargerPower) : '',
      outputType: cp.outputType || 'DC',
      connectorType: cp.connectorType || 'CCS2',
      ocppVersion: cp.OcppVersion || '1.6',
      isActive: cp.IsActive !== false && cp.IsActive !== 0,
    });
    setEditDialogOpen(true);
  };

  const handleEditChargePoint = async (e) => {
    e.preventDefault();
    if (!chargePointToEdit) return;
    setEditError('');
    setSubmitting(true);
    try {
      const payload = {
        Name: editFormData.Name.trim() || undefined,
        ChargeStationId: editFormData.ChargeStationId || undefined,
        ChargePointModel: editFormData.ChargePointModel.trim() || undefined,
        chargerPower: editFormData.chargerPower ? parseFloat(editFormData.chargerPower) : 0,
        outputType: editFormData.outputType.trim() || undefined,
        connectorType: editFormData.connectorType.trim() || undefined,
        OcppVersion: editFormData.ocppVersion || undefined,
        IsActive: editFormData.isActive,
      };
      const res = await api.put(
        `/dashboard/chargepoints/${encodeURIComponent(chargePointToEdit.ChargePointId)}`,
        payload
      );
      if (res.data.success) {
        setEditDialogOpen(false);
        setChargePointToEdit(null);
        fetchChargePoints();
      } else {
        setEditError(res.data.message || 'Không thể cập nhật trụ sạc');
      }
    } catch (err) {
      const errData = err.response?.data;
      const msg =
        Array.isArray(errData?.errors) && errData.errors.length > 0
          ? errData.errors[0]?.msg
          : errData?.message;
      setEditError(msg || 'Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteChargePoint = async (cp) => {
    if (
      !window.confirm(
        `Bạn có chắc muốn xóa trụ "${cp.Name || cp.ChargePointId || 'N/A'}"? Hành động này không thể hoàn tác.`
      )
    ) {
      return;
    }
    setDeletingId(cp.ChargePointId);
    try {
      const res = await api.delete(`/dashboard/chargepoints/${encodeURIComponent(cp.ChargePointId)}`);
      if (res.data.success) {
        fetchChargePoints();
      } else {
        alert(res.data.message || 'Không thể xóa trụ sạc');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setDeletingId(null);
    }
  };

  const formatPower = (v) => {
    const num = typeof v === 'number' ? v : parseFloat(String(v || '').replace(/[^\d.-]/g, ''));
    return `${isNaN(num) ? 0 : num} kW`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Danh sách trụ sạc</CardTitle>
          <CardDescription>Theo dõi và quản lý các trụ sạc (ChargePoint) trong hệ thống</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Tìm kiếm theo tên trụ, trạm, chủ đầu tư..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Thêm trụ sạc
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredChargePoints.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {searchTerm ? 'Không tìm thấy trụ sạc nào' : 'Chưa có trụ sạc nào'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredChargePoints.map((cp) => (
            <Card key={cp.ChargePointId} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Zap className="w-5 h-5 shrink-0" />
                      <span className="truncate">{cp.Name || cp.ChargePointId}</span>
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {getStatusBadge(cp.ChargePointState)}
                    <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="shrink-0">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Hành động</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => openEditDialog(cp)}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Sửa
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDeleteChargePoint(cp)}
                        disabled={deletingId === cp.ChargePointId}
                        className="text-destructive focus:text-destructive"
                      >
                        {deletingId === cp.ChargePointId ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 mr-2" />
                        )}
                        Xóa
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <CardDescription className="flex items-center gap-1 min-w-0">
                  <MapPin className="w-3 h-3 shrink-0" />
                  {cp.ChargeStationId ? (
                    <button
                      type="button"
                      onClick={() => navigate('/stations', { state: { stationId: cp.ChargeStationId } })}
                      className="text-primary hover:underline text-left truncate min-w-0 flex-1"
                      title={cp.StationName || 'N/A'}
                    >
                      {cp.StationName || 'N/A'}
                    </button>
                  ) : (
                    <span className="truncate" title={cp.StationName || 'N/A'}>{cp.StationName || 'N/A'}</span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Model</p>
                    <p className="font-medium">{cp.ChargePointModel || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Công suất (chargePower)</p>
                    <p className="font-medium">{formatPower(cp.chargerPower)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">OCPP</p>
                    <p className="font-medium">{cp.OcppVersion || '—'}</p>
                  </div>
                  <div>
                    
                    <p className="font-medium">
                      {cp.IsActive !== false && cp.IsActive !== 0 ? (
                        <span className="text-green-600">Đang hoạt động</span>
                      ) : (
                        <span className="text-muted-foreground">Không hoạt động</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Chủ đầu tư</p>
                    <p className="font-medium">{cp.OwnerName || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">ID Trụ</p>
                    <p className="font-medium">{cp.ChargePointId}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog thêm trụ sạc */}
      <Dialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          setAddDialogOpen(open);
            if (!open) {
            setFormData({
              ChargePointId: '',
              Name: '',
              ChargeStationId: '',
              ChargePointModel: '',
              chargerPower: '',
              outputType: 'DC',
              connectorType: 'CCS2',
              ocppVersion: '1.6',
              isActive: true,
            });
            setAddError('');
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Thêm trụ sạc
            </DialogTitle>
            <DialogDescription>Nhập thông tin trụ sạc mới để thêm vào hệ thống</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddChargePoint} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="add-cp-id">ID trụ *</Label>
              <Input
                id="add-cp-id"
                value={formData.ChargePointId}
                onChange={(e) => setFormData({ ...formData, ChargePointId: e.target.value })}
                placeholder="VD: CP-001"
                required
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-cp-name">Tên trụ</Label>
              <Input
                id="add-cp-name"
                value={formData.Name}
                onChange={(e) => setFormData({ ...formData, Name: e.target.value })}
                placeholder="VD: Trụ sạc 1"
                disabled={submitting}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="add-station">Trạm sạc *</Label>
              <select
                id="add-station"
                value={formData.ChargeStationId}
                onChange={(e) => setFormData({ ...formData, ChargeStationId: e.target.value })}
                required
                disabled={submitting}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">-- Chọn trạm sạc --</option>
                {stations.map((s) => (
                  <option key={s.ChargeStationId} value={s.ChargeStationId}>
                    {s.Name || `Trạm #${s.ChargeStationId}`} - {s.Address || 'N/A'}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-model">Model</Label>
              <Input
                id="add-model"
                value={formData.ChargePointModel}
                onChange={(e) => setFormData({ ...formData, ChargePointModel: e.target.value })}
                placeholder="VD: ABB Terra AC"
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-power">Công suất (chargePower kW)</Label>
              <Input
                id="add-power"
                type="number"
                min="0"
                step="0.1"
                value={formData.chargerPower}
                onChange={(e) => setFormData({ ...formData, chargerPower: e.target.value })}
                placeholder="VD: 22"
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-ocpp">OCPP</Label>
              <select
                id="add-ocpp"
                value={formData.ocppVersion}
                onChange={(e) => setFormData({ ...formData, ocppVersion: e.target.value })}
                disabled={submitting}
                className={selectInputClass}
              >
                {OCPP_VERSIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-operational">Trạng thái vận hành</Label>
              <select
                id="add-operational"
                value={formData.isActive ? '1' : '0'}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.value === '1' })}
                disabled={submitting}
                className={selectInputClass}
              >
                {OPERATIONAL_STATUS.map((o) => (
                  <option key={o.value} value={String(o.value)}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-output">Loại output</Label>
              <select
                id="add-output"
                value={formData.outputType}
                onChange={(e) => setFormData({ ...formData, outputType: e.target.value })}
                disabled={submitting}
                className={selectInputClass}
              >
                <option value="">-- Chọn loại output --</option>
                {OUTPUT_TYPES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-connector">Loại connector</Label>
              <Input
                id="add-connector"
                value={formData.connectorType}
                onChange={(e) => setFormData({ ...formData, connectorType: e.target.value })}
                placeholder="VD: Type 2, CCS"
                disabled={submitting}
              />
            </div>
            {addError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md sm:col-span-2">
                <p className="text-sm text-destructive">{addError}</p>
              </div>
            )}
            <div className="flex gap-2 pt-2 sm:col-span-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Đang thêm...
                  </>
                ) : (
                  'Thêm trụ sạc'
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

      {/* Dialog sửa trụ sạc */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setChargePointToEdit(null);
            setEditError('');
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              Sửa trụ sạc
            </DialogTitle>
            <DialogDescription>Cập nhật thông tin trụ sạc</DialogDescription>
          </DialogHeader>
          {chargePointToEdit && (
            <form onSubmit={handleEditChargePoint} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ID trụ</Label>
                <Input value={chargePointToEdit.ChargePointId} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-cp-name">Tên trụ</Label>
                <Input
                  id="edit-cp-name"
                  value={editFormData.Name}
                  onChange={(e) => setEditFormData({ ...editFormData, Name: e.target.value })}
                  placeholder="VD: Trụ sạc 1"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="edit-station">Trạm sạc *</Label>
                <select
                  id="edit-station"
                  value={editFormData.ChargeStationId}
                  onChange={(e) => setEditFormData({ ...editFormData, ChargeStationId: e.target.value })}
                  required
                  disabled={submitting}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">-- Chọn trạm sạc --</option>
                  {stations.map((s) => (
                    <option key={s.ChargeStationId} value={s.ChargeStationId}>
                      {s.Name || `Trạm #${s.ChargeStationId}`} - {s.Address || 'N/A'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-model">Model</Label>
                <Input
                  id="edit-model"
                  value={editFormData.ChargePointModel}
                  onChange={(e) => setEditFormData({ ...editFormData, ChargePointModel: e.target.value })}
                  placeholder="VD: ABB Terra AC"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-power">Công suất (chargePower kW)</Label>
                <Input
                  id="edit-power"
                  type="number"
                  min="0"
                  step="0.1"
                  value={editFormData.chargerPower}
                  onChange={(e) => setEditFormData({ ...editFormData, chargerPower: e.target.value })}
                  placeholder="VD: 22"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-ocpp">OCPP</Label>
                <select
                  id="edit-ocpp"
                  value={editFormData.ocppVersion}
                  onChange={(e) => setEditFormData({ ...editFormData, ocppVersion: e.target.value })}
                  disabled={submitting}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {OCPP_VERSIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-operational">Trạng thái vận hành</Label>
                <select
                  id="edit-operational"
                  value={editFormData.isActive ? '1' : '0'}
                  onChange={(e) => setEditFormData({ ...editFormData, isActive: e.target.value === '1' })}
                  disabled={submitting}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {OPERATIONAL_STATUS.map((o) => (
                    <option key={o.value} value={String(o.value)}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-output">Loại output</Label>
                <select
                  id="edit-output"
                  value={editFormData.outputType}
                  onChange={(e) => setEditFormData({ ...editFormData, outputType: e.target.value })}
                  disabled={submitting}
                  className={selectInputClass}
                >
                  <option value="">-- Chọn loại output --</option>
                  {[
                    ...OUTPUT_TYPES,
                    ...(chargePointToEdit?.outputType &&
                    !OUTPUT_TYPES.some((o) => o.value === chargePointToEdit.outputType)
                      ? [{ value: chargePointToEdit.outputType, label: chargePointToEdit.outputType }]
                      : []),
                  ].map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-connector">Loại connector</Label>
                <Input
                  id="edit-connector"
                  value={editFormData.connectorType}
                  onChange={(e) => setEditFormData({ ...editFormData, connectorType: e.target.value })}
                  placeholder="VD: Type 2, CCS"
                  disabled={submitting}
                />
              </div>
              {editError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md sm:col-span-2">
                  <p className="text-sm text-destructive">{editError}</p>
                </div>
              )}
              <div className="flex gap-2 pt-2 sm:col-span-2">
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
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChargePointManagement;
