import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';

const safeParseJson = (s) => {
  if (!s || typeof s !== 'string') return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

const prettyJson = (s) => {
  const parsed = safeParseJson(s);
  if (parsed == null) return s || '—';
  try {
    return JSON.stringify(parsed, null, 2);
  } catch {
    return s || '—';
  }
};

const formatDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleString('vi-VN');
};

const ActivityHistoryPage = () => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const limit = 20;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const params = useMemo(() => {
    const p = { page: 1, limit };
    if (from.trim()) p.from = from.trim();
    if (to.trim()) p.to = to.trim();
    return p;
  }, [limit, from, to]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/dashboard/activity-logs', { params });
      if (res.data?.success) {
        setRows(res.data.data || []);
      } else {
        setRows([]);
        setError(res.data?.message || 'Không tải được lịch sử hoạt động.');
      }
    } catch (err) {
      setRows([]);
      setError(err.response?.data?.message || 'Không tải được lịch sử hoạt động.');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const openDetail = (row) => {
    setSelected(row);
    setOpen(true);
  };

  const resetFilters = () => {
    setFrom('');
    setTo('');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="text-lg font-semibold">Lịch sử hoạt động</div>
              <p className="text-sm text-muted-foreground mt-1">
                Ghi nhận thay đổi dữ liệu (before/after) cho Người dùng và Giao dịch.
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={resetFilters} disabled={loading}>
                Xóa lọc
              </Button>
              <Button type="button" onClick={() => fetchLogs()} disabled={loading}>
                Làm mới
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1 w-[170px]">
              <Label className="text-xs">Từ ngày</Label>
              <Input className="h-9 px-2" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1 w-[170px]">
              <Label className="text-xs">Đến ngày</Label>
              <Input className="h-9 px-2" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground">Đang tải...</div>
          ) : error ? (
            <div className="text-sm text-destructive">{error}</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">Chưa có bản ghi.</div>
          ) : (
            <>
              {/* Desktop/tablet: bảng đầy đủ cột */}
              <div className="hidden md:block">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-1.5 sm:p-2 font-medium">Thời gian</th>
                      <th className="text-left p-1.5 sm:p-2 font-medium">Module</th>
                      <th className="text-left p-1.5 sm:p-2 font-medium">Action</th>
                      <th className="text-left p-1.5 sm:p-2 font-medium">ActionName</th>
                      <th className="text-left p-1.5 sm:p-2 font-medium">Entity</th>
                      <th className="text-left p-1.5 sm:p-2 font-medium">EntityId</th>
                      <th className="text-left p-1.5 sm:p-2 font-medium">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.Id} className="border-b border-slate-100">
                        <td className="p-1.5 sm:p-2">{formatDate(r.CreatedAt)}</td>
                        <td className="p-1.5 sm:p-2">{r.Module || '—'}</td>
                        <td className="p-1.5 sm:p-2">{r.Action || '—'}</td>
                        <td className="p-1.5 sm:p-2">{r.ActionName || '—'}</td>
                        <td className="p-1.5 sm:p-2">{r.Entity || '—'}</td>
                        <td className="p-1.5 sm:p-2">{r.EntityId || '—'}</td>
                        <td className="p-1.5 sm:p-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => openDetail(r)}>
                            <span className="sm:hidden">Xem</span>
                            <span className="hidden sm:inline">Xem before/after</span>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: hiển thị dạng thẻ, đầy đủ thông tin, không cần kéo ngang */}
              <div className="md:hidden space-y-3">
                {rows.map((r) => (
                  <div
                    key={r.Id}
                    className="border border-slate-200 rounded-md p-3 text-xs space-y-1 bg-white"
                  >
                    <div>
                      <span className="font-semibold">Thời gian: </span>
                      {formatDate(r.CreatedAt)}
                    </div>
                    <div>
                      <span className="font-semibold">Module: </span>
                      {r.Module || '—'}
                    </div>
                    <div>
                      <span className="font-semibold">Action: </span>
                      {r.Action || '—'}
                    </div>
                    <div>
                      <span className="font-semibold">ActionName: </span>
                      {r.ActionName || '—'}
                    </div>
                    <div>
                      <span className="font-semibold">Entity: </span>
                      {r.Entity || '—'}
                    </div>
                    <div>
                      <span className="font-semibold">EntityId: </span>
                      {r.EntityId || '—'}
                    </div>
                    <div className="pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openDetail(r)}
                      >
                        Xem before/after
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Before / After</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {selected ? (
                <>
                  <div><span className="font-medium">ActionName:</span> {selected.ActionName || '—'}</div>
                  <div><span className="font-medium">Entity:</span> {selected.Entity || '—'} / {selected.EntityId || '—'}</div>
                </>
              ) : null}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="text-sm font-medium">Before</div>
                <pre className="text-xs whitespace-pre-wrap break-words rounded-md border bg-slate-50 p-3 max-h-[60vh] overflow-auto">
                  {prettyJson(selected?.BeforeJson)}
                </pre>
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium">After</div>
                <pre className="text-xs whitespace-pre-wrap break-words rounded-md border bg-slate-50 p-3 max-h-[60vh] overflow-auto">
                  {prettyJson(selected?.AfterJson)}
                </pre>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ActivityHistoryPage;

