import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Mail, Plus, Trash2, Loader2, RefreshCw, MessageCircle } from 'lucide-react';
import api from '../../services/api';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ServicePage = () => {
  const [mailEnabled, setMailEnabled] = useState(true);
  const [notifyEmails, setNotifyEmails] = useState([]);
  const [zaloEnabled, setZaloEnabled] = useState(false);
  const [zaloRecipientType, setZaloRecipientType] = useState('user_ids');
  const [zaloGroupId, setZaloGroupId] = useState('');
  const [zaloUserIds, setZaloUserIds] = useState(['']);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingZalo, setSavingZalo] = useState(false);
  const [settingsError, setSettingsError] = useState(null);
  const [mails, setMails] = useState([]);
  const [mailsLoading, setMailsLoading] = useState(true);
  const [mailsError, setMailsError] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;
  const [zaloLogs, setZaloLogs] = useState([]);
  const [zaloLogsLoading, setZaloLogsLoading] = useState(true);
  const [zaloLogsError, setZaloLogsError] = useState(null);
  const [zaloTotal, setZaloTotal] = useState(0);
  const [zaloPage, setZaloPage] = useState(1);
  const zaloLimit = 20;
  const [toast, setToast] = useState(null);

  const fetchSettings = useCallback(async () => {
    setSettingsLoading(true);
    setSettingsError(null);
    try {
      const res = await api.get('/dashboard/service/settings');
      const data = res.data?.data;
      if (res.data?.success && data) {
        setMailEnabled(data.mailEnabled !== false);
        if (Array.isArray(data.notifyEmails)) {
          setNotifyEmails(data.notifyEmails.length ? [...data.notifyEmails] : ['']);
        } else {
          setNotifyEmails(['']);
        }
        setZaloEnabled(data.zaloEnabled === true);
        if (data.zaloRecipient && typeof data.zaloRecipient === 'object') {
          if (data.zaloRecipient.type === 'group' && data.zaloRecipient.group_id) {
            setZaloRecipientType('group');
            setZaloGroupId(String(data.zaloRecipient.group_id));
            setZaloUserIds(['']);
          } else if (Array.isArray(data.zaloRecipient.user_ids)) {
            setZaloRecipientType('user_ids');
            setZaloGroupId('');
            setZaloUserIds(
              data.zaloRecipient.user_ids.length
                ? data.zaloRecipient.user_ids.map((id) => String(id))
                : ['']
            );
          } else {
            setZaloRecipientType('user_ids');
            setZaloGroupId('');
            setZaloUserIds(['']);
          }
        } else {
          setZaloRecipientType('user_ids');
          setZaloGroupId('');
          setZaloUserIds(['']);
        }
      } else {
        setMailEnabled(true);
        setNotifyEmails(['']);
        setZaloEnabled(false);
        setZaloRecipientType('user_ids');
        setZaloGroupId('');
        setZaloUserIds(['']);
      }
    } catch (err) {
      setSettingsError(err.response?.data?.message || 'Không tải được cấu hình.');
      setMailEnabled(true);
      setNotifyEmails(['']);
      setZaloEnabled(false);
      setZaloRecipientType('user_ids');
      setZaloGroupId('');
      setZaloUserIds(['']);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  const fetchMails = useCallback(async () => {
    setMailsLoading(true);
    setMailsError(null);
    try {
      const res = await api.get('/dashboard/service/mails', { params: { page, limit } });
      if (res.data?.success) {
        setMails(res.data.data || []);
        setTotal(res.data.total ?? 0);
      } else {
        setMails([]);
      }
    } catch (err) {
      setMailsError(err.response?.data?.message || 'Không tải được danh sách mail.');
      setMails([]);
    } finally {
      setMailsLoading(false);
    }
  }, [page, limit]);

  const fetchZaloLogs = useCallback(async () => {
    setZaloLogsLoading(true);
    setZaloLogsError(null);
    try {
      const res = await api.get('/dashboard/service/zalo-logs', {
        params: { page: zaloPage, limit: zaloLimit },
      });
      if (res.data?.success) {
        setZaloLogs(res.data.data || []);
        setZaloTotal(res.data.total ?? 0);
      } else {
        setZaloLogs([]);
      }
    } catch (err) {
      setZaloLogsError(err.response?.data?.message || 'Không tải được lịch sử Zalo.');
      setZaloLogs([]);
    } finally {
      setZaloLogsLoading(false);
    }
  }, [zaloPage, zaloLimit]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    fetchMails();
  }, [fetchMails]);

  useEffect(() => {
    fetchZaloLogs();
  }, [fetchZaloLogs]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const addEmailRow = () => {
    setNotifyEmails((prev) => [...prev, '']);
  };

  const removeEmailRow = (index) => {
    setNotifyEmails((prev) => prev.filter((_, i) => i !== index));
  };

  const addZaloUserIdRow = () => {
    setZaloUserIds((prev) => [...prev, '']);
  };

  const removeZaloUserIdRow = (index) => {
    setZaloUserIds((prev) => prev.filter((_, i) => i !== index));
  };

  const updateZaloUserIdAt = (index, value) => {
    setZaloUserIds((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const updateEmailAt = (index, value) => {
    setNotifyEmails((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleSaveSettings = async (section) => {
    const valid = notifyEmails
      .map((e) => (typeof e === 'string' ? e.trim() : ''))
      .filter((e) => e.length > 0 && EMAIL_REGEX.test(e));
    if (section === 'email' && mailEnabled && valid.length === 0) {
      setToast({ type: 'error', text: 'Thêm ít nhất một email hợp lệ.' });
      return;
    }
    let zaloRecipient = null;
    if (zaloEnabled) {
      if (zaloRecipientType === 'group') {
        const gid = String(zaloGroupId).trim();
        if (!gid) {
          setToast({ type: 'error', text: 'Khi bật Zalo theo nhóm, cần nhập Group ID.' });
          return;
        }
        zaloRecipient = { type: 'group', group_id: gid };
      } else {
        const userIds = zaloUserIds
          .map((id) => (typeof id === 'string' ? id.trim() : ''))
          .filter((id) => id.length > 0);
        if (userIds.length === 0) {
          setToast({ type: 'error', text: 'Khi bật Zalo theo user, cần ít nhất một User ID Zalo.' });
          return;
        }
        zaloRecipient = { type: 'user_ids', user_ids: userIds };
      }
    }
    if (section === 'zalo' && zaloEnabled && !zaloRecipient) {
      setToast({ type: 'error', text: 'Nhập Group ID hoặc ít nhất một User ID Zalo.' });
      return;
    }
    const validEmailsForPayload =
      section === 'email'
        ? valid
        : notifyEmails
            .map((e) => (typeof e === 'string' ? e.trim() : ''))
            .filter((e) => e.length > 0 && EMAIL_REGEX.test(e));
    const payload = {
      mailEnabled: !!mailEnabled,
      notifyEmails: validEmailsForPayload.length ? validEmailsForPayload : [],
      zaloEnabled: !!zaloEnabled,
      zaloRecipient: zaloRecipient || (zaloEnabled ? { type: 'user_ids', user_ids: [] } : {}),
    };
    if (section === 'email') setSavingEmail(true);
    else setSavingZalo(true);
    setToast(null);
    try {
      const res = await api.put('/dashboard/service/settings', payload);
      if (res.data?.success) {
        setToast({ type: 'success', text: res.data?.message || 'Đã lưu cấu hình.' });
        if (res.data?.data?.mailEnabled !== undefined) setMailEnabled(res.data.data.mailEnabled);
        if (res.data?.data?.notifyEmails?.length != null) setNotifyEmails(res.data.data.notifyEmails.length ? [...res.data.data.notifyEmails] : ['']);
        if (res.data?.data?.zaloEnabled !== undefined) setZaloEnabled(res.data.data.zaloEnabled);
        if (res.data?.data?.zaloRecipient != null) {
          const r = res.data.data.zaloRecipient;
          if (r.type === 'group') {
            setZaloRecipientType('group');
            setZaloGroupId(r.group_id || '');
            setZaloUserIds(['']);
          } else {
            setZaloRecipientType('user_ids');
            setZaloGroupId('');
            setZaloUserIds(Array.isArray(r.user_ids) && r.user_ids.length ? [...r.user_ids] : ['']);
          }
        }
      } else {
        setToast({ type: 'error', text: res.data?.message || 'Lưu thất bại.' });
      }
    } catch (err) {
      setToast({ type: 'error', text: err.response?.data?.message || 'Lỗi khi lưu.' });
    } finally {
      if (section === 'email') setSavingEmail(false);
      else setSavingZalo(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleString('vi-VN');
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const zaloTotalPages = Math.max(1, Math.ceil(zaloTotal / zaloLimit));

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`rounded-lg border px-4 py-2 text-sm ${
            toast.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-destructive/10 border-destructive/30 text-destructive'
          }`}
          role="alert"
        >
          {toast.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            <span className="text-lg font-semibold">Email nhận thông báo</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Thêm email để nhận thông báo khi phát hiện súng hiển thị đang sạc nhưng không có phiên sạc. Không giới hạn số lượng.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {settingsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Đang tải...</span>
            </div>
          ) : settingsError ? (
            <p className="text-sm text-destructive">{settingsError}</p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="mail-enabled"
                  checked={mailEnabled}
                  onChange={(e) => setMailEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="mail-enabled" className="cursor-pointer font-medium">
                  Bật gửi thông báo Email
                </Label>
              </div>
              {mailEnabled && (
                <>
              <div className="space-y-2">
                {notifyEmails.map((email, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <div className="flex-1 min-w-0">
                      <Label htmlFor={`email-${index}`} className="sr-only">
                        Email {index + 1}
                      </Label>
                      <Input
                        id={`email-${index}`}
                        type="email"
                        placeholder="email@example.com"
                        value={email}
                        onChange={(e) => updateEmailAt(index, e.target.value)}
                        className="max-w-md"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeEmailRow(index)}
                      disabled={notifyEmails.length <= 1}
                      title="Xóa"
                      aria-label="Xóa email"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addEmailRow} className="gap-1">
                <Plus className="h-4 w-4" />
                Thêm email
              </Button>
                </>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => handleSaveSettings('email')}
                  disabled={savingEmail}
                  className="gap-1"
                >
                  {savingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Lưu cấu hình
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            <span className="text-lg font-semibold">Zalo OA – Thông báo</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Gửi thông báo Zalo khi phát hiện súng đang sạc nhưng không có phiên. Cấu hình đích: nhóm (Group ID) hoặc danh sách User ID Zalo.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {settingsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Đang tải...</span>
            </div>
          ) : settingsError ? (
            <p className="text-sm text-destructive">{settingsError}</p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="zalo-enabled"
                  checked={zaloEnabled}
                  onChange={(e) => setZaloEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="zalo-enabled" className="cursor-pointer font-medium">
                  Bật gửi thông báo Zalo
                </Label>
              </div>
              {zaloEnabled && (
                <>
                  <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        id="zalo-type-user_ids"
                        name="zalo-recipient-type"
                        checked={zaloRecipientType === 'user_ids'}
                        onChange={() => setZaloRecipientType('user_ids')}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="zalo-type-user_ids" className="cursor-pointer">
                        Gửi cho User ID Zalo
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        id="zalo-type-group"
                        name="zalo-recipient-type"
                        checked={zaloRecipientType === 'group'}
                        onChange={() => setZaloRecipientType('group')}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="zalo-type-group" className="cursor-pointer">
                        Gửi vào nhóm (Group ID)
                      </Label>
                    </div>
                  </div>
                  {zaloRecipientType === 'group' ? (
                    <div className="space-y-1">
                      <Label htmlFor="zalo-group-id">Group ID</Label>
                      <Input
                        id="zalo-group-id"
                        placeholder="ID nhóm Zalo"
                        value={zaloGroupId}
                        onChange={(e) => setZaloGroupId(e.target.value)}
                        className="max-w-md"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>User ID Zalo (mỗi dòng một ID)</Label>
                      {zaloUserIds.map((uid, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <div className="flex-1 min-w-0">
                            <Input
                              placeholder="User ID Zalo"
                              value={uid}
                              onChange={(e) => updateZaloUserIdAt(index, e.target.value)}
                              className="max-w-md"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => removeZaloUserIdRow(index)}
                            disabled={zaloUserIds.length <= 1}
                            title="Xóa"
                            aria-label="Xóa User ID"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button type="button" variant="outline" size="sm" onClick={addZaloUserIdRow} className="gap-1">
                        <Plus className="h-4 w-4" />
                        Thêm User ID
                      </Button>
                    </div>
                  )}
                </>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => handleSaveSettings('zalo')}
                  disabled={savingZalo}
                  className="gap-1"
                >
                  {savingZalo ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Lưu cấu hình
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="text-lg font-semibold">Danh sách mail đã gửi</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fetchMails()}
              disabled={mailsLoading}
              className="gap-1"
            >
              {mailsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Làm mới
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {mailsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : mailsError ? (
            <p className="text-sm text-destructive py-4">{mailsError}</p>
          ) : mails.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Chưa có mail nào.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-medium">Sự kiện</th>
                      <th className="text-left p-2 font-medium">Trụ</th>
                      <th className="text-left p-2 font-medium">Súng</th>
                      <th className="text-left p-2 font-medium">Trạm</th>
                      <th className="text-left p-2 font-medium">Người nhận</th>
                      <th className="text-left p-2 font-medium">Trạng thái</th>
                      <th className="text-left p-2 font-medium">Gửi lúc</th>
                      <th className="text-left p-2 font-medium">Tạo lúc</th>
                      <th className="text-left p-2 font-medium">Lỗi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mails.map((row) => (
                      <tr key={row.Id} className="border-b border-slate-100">
                        <td className="p-2">{row.EventType || '—'}</td>
                        <td className="p-2">{row.ChargePointId || '—'}</td>
                        <td className="p-2">{row.ConnectorId ?? '—'}</td>
                        <td className="p-2">{row.StationName || '—'}</td>
                        <td className="p-2 max-w-[200px] truncate" title={row.ToEmail}>
                          {row.ToEmail || '—'}
                        </td>
                        <td className="p-2">
                          <span
                            className={
                              row.Status === 'sent'
                                ? 'text-green-600'
                                : row.Status === 'failed'
                                  ? 'text-destructive'
                                  : 'text-muted-foreground'
                            }
                          >
                            {row.Status || '—'}
                          </span>
                        </td>
                        <td className="p-2 whitespace-nowrap">{formatDate(row.SentAt)}</td>
                        <td className="p-2 whitespace-nowrap">{formatDate(row.CreatedAt)}</td>
                        <td className="p-2 max-w-[180px] truncate text-destructive" title={row.ErrorMessage}>
                          {row.ErrorMessage || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-xs text-muted-foreground">
                    Trang {page} / {totalPages} (tổng {total} bản ghi)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      Trước
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      Sau
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="text-lg font-semibold">Lịch sử gửi Zalo</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fetchZaloLogs()}
              disabled={zaloLogsLoading}
              className="gap-1"
            >
              {zaloLogsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Làm mới
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {zaloLogsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : zaloLogsError ? (
            <p className="text-sm text-destructive py-4">{zaloLogsError}</p>
          ) : zaloLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Chưa có lịch sử gửi Zalo.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-medium">Sự kiện</th>
                      <th className="text-left p-2 font-medium">Trụ</th>
                      <th className="text-left p-2 font-medium">Súng</th>
                      <th className="text-left p-2 font-medium">Trạm</th>
                      <th className="text-left p-2 font-medium">Đích nhận</th>
                      <th className="text-left p-2 font-medium">Trạng thái</th>
                      <th className="text-left p-2 font-medium">Gửi lúc</th>
                      <th className="text-left p-2 font-medium">Tạo lúc</th>
                      <th className="text-left p-2 font-medium">Lỗi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zaloLogs.map((row) => (
                      <tr key={row.Id} className="border-b border-slate-100">
                        <td className="p-2">{row.EventType || '—'}</td>
                        <td className="p-2">{row.ChargePointId || '—'}</td>
                        <td className="p-2">{row.ConnectorId ?? '—'}</td>
                        <td className="p-2">{row.StationName || '—'}</td>
                        <td className="p-2 max-w-[200px] truncate" title={row.RecipientRef}>
                          {row.RecipientRef || '—'}
                        </td>
                        <td className="p-2">
                          <span
                            className={
                              row.Status === 'sent'
                                ? 'text-green-600'
                                : row.Status === 'failed'
                                  ? 'text-destructive'
                                  : 'text-muted-foreground'
                            }
                          >
                            {row.Status || '—'}
                          </span>
                        </td>
                        <td className="p-2 whitespace-nowrap">{formatDate(row.SentAt)}</td>
                        <td className="p-2 whitespace-nowrap">{formatDate(row.CreatedAt)}</td>
                        <td className="p-2 max-w-[180px] truncate text-destructive" title={row.ErrorMessage}>
                          {row.ErrorMessage || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {zaloTotalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-xs text-muted-foreground">
                    Trang {zaloPage} / {zaloTotalPages} (tổng {zaloTotal} bản ghi)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setZaloPage((p) => Math.max(1, p - 1))}
                      disabled={zaloPage <= 1}
                    >
                      Trước
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setZaloPage((p) => Math.min(zaloTotalPages, p + 1))}
                      disabled={zaloPage >= zaloTotalPages}
                    >
                      Sau
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

export default ServicePage;
