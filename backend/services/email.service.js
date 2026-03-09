const nodemailer = require('nodemailer');

const getTransport = () => {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    return null;
  }
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true';
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
};

const getFrom = () => {
  return process.env.MAIL_FROM || process.env.SMTP_USER || 'noreply@localhost';
};

/**
 * Gửi email. to có thể là string (1 email) hoặc mảng (nhiều email).
 * @returns {Promise<{ success: boolean, message?: string, error?: string }>}
 */
const sendMail = async ({ to, subject, text, html }) => {
  const transport = getTransport();
  if (!transport) {
    console.warn('[EmailService] Thiếu SMTP_USER/SMTP_PASS, bỏ qua gửi mail.');
    return { success: false, error: 'SMTP not configured' };
  }
  const toList = Array.isArray(to) ? to : [to].filter(Boolean);
  if (toList.length === 0) {
    return { success: false, error: 'No recipients' };
  }
  try {
    await transport.sendMail({
      from: getFrom(),
      to: toList.join(', '),
      subject: subject || '(No subject)',
      text: text || '',
      html: html || text || '',
    });
    return { success: true, message: 'Sent' };
  } catch (err) {
    console.error('[EmailService] sendMail error:', err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Thông báo: súng đang Occupied/Charging nhưng không có phiên sạc tương ứng.
 * recipientEmails: mảng email nhận (từ DB, cấu hình trên FE).
 */
const notifyConnectorOccupiedNoSession = async ({
  chargePointId,
  connectorId,
  connectorName,
  stationName,
  recipientEmails,
}) => {
  const subject = `[SolarEV] Súng hiển thị đang sạc nhưng không có phiên sạc - ${chargePointId}/${connectorId}`;
  const lines = [
    'Phát hiện bất thường: connector hiển thị trạng thái đang sạc (Occupied/Charging) nhưng không có phiên sạc (transaction) tương ứng.',
    '',
    `Trụ: ${chargePointId || '—'}`,
    `Súng: ${connectorName || connectorId || '—'}`,
    `Trạm: ${stationName || '—'}`,
    '',
    `Thời gian: ${new Date().toISOString()}`,
  ];
  const text = lines.join('\n');
  const html = `<pre>${lines.map((l) => (l ? l : '<br/>')).join('\n')}</pre>`;
  return sendMail({
    to: recipientEmails,
    subject,
    text,
    html,
  });
};

module.exports = {
  sendMail,
  notifyConnectorOccupiedNoSession,
  getFrom,
  getTransport,
};
