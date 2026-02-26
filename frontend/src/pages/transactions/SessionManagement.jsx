import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Search, Loader2, Clock, ChevronLeft, ChevronRight, MoreVertical, Pencil, Trash2 } from 'lucide-react';
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

const formatDateTime = (value) => {
  if (value == null || value === '') return '—';
  const d = new Date(value);
  return isNaN(d.getTime()) ? value : d.toLocaleString('vi-VN');
};

// Parse pasted date/time (vi-VN style or ISO) to datetime-local value (yyyy-MM-ddThh:mm)
const parsePastedDateTime = (pastedText) => {
  const s = (pastedText || '').trim();
  if (!s) return null;
  // Already datetime-local format
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : s.slice(0, 16);
  }
  // vi-VN: dd/MM/yyyy HH:mm SA/CH hoặc dd/MM/yyyy HH:mm
  const viMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?:\s*(SA|CH|AM|PM))?/i);
  if (viMatch) {
    const [, day, month, year, hour, min, ampm] = viMatch;
    let h = parseInt(hour, 10);
    if (ampm) {
      const isPM = /^(CH|PM)$/i.test(ampm.trim());
      if (isPM && h < 12) h += 12;
      if (!isPM && h === 12) h = 0;
    }
    const d = new Date(Number(year), Number(month) - 1, Number(day), h, Number(min), 0);
    if (isNaN(d.getTime())) return null;
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + 'T' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  // Fallback: try Date parse
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + 'T' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
};

// Format date/time for display in text field (dd/MM/yyyy HH:mm SA|CH) — có thể chọn full và copy/paste
const formatToDisplay = (value) => {
  if (value == null || value === '') return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h < 12 ? 'SA' : 'CH';
  return `${day}/${month}/${year} ${String(hour12).padStart(2, '0')}:${m} ${ampm}`;
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

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [sessionToEdit, setSessionToEdit] = useState(null);
  const [editFormData, setEditFormData] = useState({
    StartTime: '',
    StopTime: '',
    MeterStart: '',
    MeterStop: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [editError, setEditError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

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

  const openEditDialog = (s) => {
    setSessionToEdit(s);
    setEditFormData({
      StartTime: s.StartTime ? formatToDisplay(s.StartTime) : '',
      StopTime: s.StopTime ? formatToDisplay(s.StopTime) : '',
      MeterStart: s.MeterStart != null ? String(s.MeterStart) : '',
      MeterStop: s.MeterStop != null ? String(s.MeterStop) : '',
    });
    setEditError('');
    setEditDialogOpen(true);
  };

  const handleEditSession = async (e) => {
    e.preventDefault();
    if (!sessionToEdit) return;
    setEditError('');
    setSubmitting(true);
    try {
      const payload = {};
      if (editFormData.StartTime) {
        const parsedStart = parsePastedDateTime(editFormData.StartTime);
        if (!parsedStart) {
          setEditError('Thời gian bắt đầu không đúng định dạng (vd: 23/02/2026 01:01 SA).');
          setSubmitting(false);
          return;
        }
        payload.StartTime = new Date(parsedStart).toISOString().slice(0, 19).replace('T', ' ');
      }
      if (editFormData.StopTime) {
        const parsedStop = parsePastedDateTime(editFormData.StopTime);
        if (!parsedStop) {
          setEditError('Thời gian kết thúc không đúng định dạng (vd: 23/02/2026 01:55 CH).');
          setSubmitting(false);
          return;
        }
        payload.StopTime = new Date(parsedStop).toISOString().slice(0, 19).replace('T', ' ');
      }
      if (editFormData.MeterStart !== '') payload.MeterStart = parseFloat(editFormData.MeterStart);
      if (editFormData.MeterStop !== '') payload.MeterStop = parseFloat(editFormData.MeterStop);
      const res = await api.put(`/dashboard/sessions/${sessionToEdit.TransactionId}`, payload);
      if (res.data.success) {
        setEditDialogOpen(false);
        setSessionToEdit(null);
        fetchSessions({ page, limit, search: searchApplied || undefined, dateFrom: dateFromApplied || undefined, dateTo: dateToApplied || undefined });
      } else {
        setEditError(res.data.message || 'Không thể cập nhật.');
      }
    } catch (err) {
      setEditError(err.response?.data?.message || 'Đã xảy ra lỗi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSession = async (s) => {
    if (!window.confirm(`Bạn có chắc muốn xóa phiên sạc #${s.TransactionId}?`)) return;
    setDeletingId(s.TransactionId);
    try {
      const res = await api.delete(`/dashboard/sessions/${s.TransactionId}`);
      if (res.data.success) {
        fetchSessions({ page, limit, search: searchApplied || undefined, dateFrom: dateFromApplied || undefined, dateTo: dateToApplied || undefined });
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
                      <th className="text-left font-medium p-3 whitespace-nowrap">ID thẻ kết thúc</th>
                      <th className="text-left font-medium p-3 whitespace-nowrap">Thời gian kết thúc</th>
                      <th className="text-left font-medium p-3 whitespace-nowrap">Thời gian đồng hồ kết thúc</th>
                      <th className="text-left font-medium p-3 whitespace-nowrap w-[80px]">Hành động</th>
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
                        <td className="p-3">{s.StopTagId ?? s.StartTagId ?? '—'}</td>
                        <td className="p-3">{formatDateTime(s.StopTime)}</td>
                        <td className="p-3">{s.MeterStop != null ? s.MeterStop : '—'}</td>
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
                              <DropdownMenuItem onClick={() => openEditDialog(s)}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Sửa
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteSession(s)}
                                disabled={deletingId === (s.TransactionId ?? s.Uid)}
                                className="text-destructive focus:text-destructive"
                              >
                                {deletingId === (s.TransactionId ?? s.Uid) ? (
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

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sửa phiên sạc</DialogTitle>
            <DialogDescription>Cập nhật thời gian và đồng hồ (meter) cho phiên #{sessionToEdit?.TransactionId}</DialogDescription>
          </DialogHeader>
          {sessionToEdit && (
            <form onSubmit={handleEditSession} className="space-y-4">
              <div className="space-y-2">
                <Label>Thời gian bắt đầu</Label>
                <p className="text-xs text-muted-foreground">Có thể chọn toàn bộ (Ctrl+A) và dán. Định dạng: 23/02/2026 01:01 SA</p>
                <Input
                  type="text"
                  value={editFormData.StartTime}
                  onChange={(e) => setEditFormData((f) => ({ ...f, StartTime: e.target.value }))}
                  placeholder="23/02/2026 01:01 SA"
                  onPaste={(e) => {
                    const text = e.clipboardData?.getData('text') || '';
                    const parsed = parsePastedDateTime(text);
                    if (parsed) {
                      e.preventDefault();
                      setEditFormData((f) => ({ ...f, StartTime: formatToDisplay(parsed) }));
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Thời gian kết thúc</Label>
                <p className="text-xs text-muted-foreground">Có thể chọn toàn bộ (Ctrl+A) và dán. Định dạng: 23/02/2026 01:55 CH</p>
                <Input
                  type="text"
                  value={editFormData.StopTime}
                  onChange={(e) => setEditFormData((f) => ({ ...f, StopTime: e.target.value }))}
                  placeholder="23/02/2026 01:55 CH"
                  onPaste={(e) => {
                    const text = e.clipboardData?.getData('text') || '';
                    const parsed = parsePastedDateTime(text);
                    if (parsed) {
                      e.preventDefault();
                      setEditFormData((f) => ({ ...f, StopTime: formatToDisplay(parsed) }));
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Thời gian đồng hồ bắt đầu (MeterStart)</Label>
                <Input
                  type="number"
                  step="any"
                  value={editFormData.MeterStart}
                  onChange={(e) => setEditFormData((f) => ({ ...f, MeterStart: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Thời gian đồng hồ kết thúc (MeterStop)</Label>
                <Input
                  type="number"
                  step="any"
                  value={editFormData.MeterStop}
                  onChange={(e) => setEditFormData((f) => ({ ...f, MeterStop: e.target.value }))}
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

export default SessionManagement;
