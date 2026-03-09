# Hướng dẫn Deploy Platform Solar (trừ FocusEV.OCPP.Server)

Tài liệu này áp dụng cho **backend** và **frontend** của Platform Solar. Thư mục `FocusEV.OCPP.Server` không nằm trong phạm vi deploy này.

---

## 1. Yêu cầu môi trường

- **Node.js** (LTS, khuyến nghị 18+)
- **MSSQL Server** (DB đã có sẵn schema/models qua Sequelize)
- **Nginx** hoặc reverse proxy (tùy chọn, để serve frontend + proxy `/api`)

---

## 2. Backend

### 2.1 Biến môi trường

- Copy `backend/.env.example` thành `backend/.env`.
- Điền đầy đủ giá trị, **bắt buộc** khi deploy production:
  - `NODE_ENV=production`
  - `JWT_SECRET`: chuỗi bí mật mạnh, không dùng giá trị mặc định.
  - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`: kết nối MSSQL.
  - `CORS_ORIGIN`: URL gốc của frontend (VD: `https://your-domain.com`).
- Tùy chọn:
  - `OCPP_SERVER_URL`: URL FocusEV OCPP Server (RemoteStopTransaction).
  - `SMTP_*`, `MAIL_FROM`, `MAIL_CRON_*`: nếu dùng tính năng mail.
  - `LEGACY_PASSWORD_KEY`: chỉ khi cần tương thích mật khẩu cũ.

### 2.2 Database

- Đảm bảo MSSQL chạy và cho phép kết nối từ máy deploy.
- Chạy các script SQL trong `backend/scripts/` nếu chưa chạy:
  - `create-mail-log-table.sql`
  - `create-notification-setting-table.sql`
  - `add-chargestation-type-lat-long.sql`
  - `add-chargepoint-ocpp-isactive.sql`

### 2.3 Cài đặt và chạy

```bash
cd backend
npm ci
npm start
```

- Server mặc định chạy tại `PORT` (env) hoặc 5000.
- Nếu DB lỗi, server sẽ không start (`process.exit(1)`).
- Health check: `GET /health` → `{ "status": "OK" }`.

### 2.4 Chạy production (gợi ý)

- Dùng **PM2**: `pm2 start server.js --name solarev-api`.
- Hoặc systemd / Docker; đảm bảo `NODE_ENV=production` và không commit file `.env`.

---

## 3. Frontend

### 3.1 Biến môi trường

- Copy `frontend/.env.example` thành `frontend/.env`.
- **Production**: đặt `VITE_API_URL` bằng URL API thật (VD: `https://api.your-domain.com/api`).
- Giá trị này được nhúng vào lúc build; sau khi build xong đổi `.env` không có tác dụng.

### 3.2 Build

```bash
cd frontend
npm ci
npm run build
```

- Output nằm trong `frontend/dist/`.

### 3.3 Serve frontend (production)

- Serve thư mục `dist/` bằng Nginx/Apache hoặc bất kỳ static server nào.
- **Quan trọng**: SPA dùng React Router; cấu hình server trả về `index.html` cho mọi route (fallback to index).
- Nếu API và frontend cùng domain: cấu hình reverse proxy `/api` → backend (VD: `http://127.0.0.1:5000`).

---

## 4. Checklist trước khi deploy

- [ ] Backend `.env` đã copy từ `.env.example`, không commit `.env` lên git.
- [ ] `NODE_ENV=production` và `JWT_SECRET` đã đổi (không dùng secret mặc định).
- [ ] `CORS_ORIGIN` trùng với domain frontend thật.
- [ ] MSSQL kết nối được từ máy deploy; đã chạy đủ script SQL cần thiết.
- [ ] Frontend `VITE_API_URL` trỏ đúng API production; đã chạy `npm run build`.
- [ ] Serve `dist/` với fallback `index.html` cho SPA.
- [ ] (Tùy chọn) OCPP Server đã deploy và `OCPP_SERVER_URL` đúng nếu dùng RemoteStopTransaction.
- [ ] (Tùy chọn) SMTP và cron mail đã cấu hình nếu dùng tính năng thông báo mail.

---

## 5. Cấu trúc tham chiếu

```
Platform_Solar/
├── backend/           # API Express
│   ├── .env           # (không commit, copy từ .env.example)
│   ├── .env.example
│   ├── server.js
│   ├── config/
│   ├── routes/
│   ├── controllers/
│   ├── services/
│   └── scripts/      # SQL migrations / tiện ích
├── frontend/         # React + Vite
│   ├── .env          # (không commit, copy từ .env.example)
│   ├── .env.example
│   ├── dist/         # sau npm run build
│   └── src/
└── DEPLOY.md         # file này
```

*(Thư mục FocusEV.OCPP.Server không nằm trong phạm vi deploy của tài liệu này.)*

---

## 6. Deploy tự động (Windows → Windows Server)

Có sẵn script deploy qua share (ổ C$):

1. **Cấu hình**: Copy `.env.deploy.example` thành `.env.deploy`, điền:
   - `DEPLOY_HOST`: IP server (vd: 103.56.162.55)
   - `DEPLOY_USER`: User đăng nhập (vd: Administrator)
   - `DEPLOY_PASSWORD`: Mật khẩu
   - `DEPLOY_PATH`: Đường dẫn thư mục app trên server (vd: `C:\app\Platform_Solar`)

2. **Chạy deploy** (chọn một trong ba):
   - **Deploy cả FE + BE**: `deploy.bat` hoặc `.\deploy.ps1`  
     → Build frontend, copy backend và frontend/dist lên server.
   - **Chỉ deploy Frontend**: `deploy-fe.bat` hoặc `.\deploy-fe.ps1`  
     → Build frontend, copy `frontend/dist` lên server (dùng khi chỉ sửa giao diện).
   - **Chỉ deploy Backend**: `deploy-be.bat` hoặc `.\deploy-be.ps1`  
     → Copy backend (trừ node_modules, .env, logs) lên server (dùng khi chỉ sửa API).

3. **Trên server** (làm một lần hoặc sau mỗi lần deploy):
   - Đảm bảo `backend\.env` tồn tại (copy từ `.env.example` nếu chưa có).
   - Trong `backend`: `npm ci` rồi `npm start` (hoặc `pm2 restart` nếu dùng PM2).
   - Serve thư mục `frontend\dist` (IIS, Nginx, hoặc static server).

**Lưu ý**: Trên Windows Server cần bật **File and Printer Sharing** (firewall) và user có quyền truy cập ổ C$ (admin share). Nếu không dùng được C$, tạo một share (vd: `D:\Deploy`) và đổi `DEPLOY_PATH` thành đường dẫn tương ứng (vd: `D:\Deploy\Platform_Solar`); khi đó cần chỉnh script để dùng `\\host\Deploy` thay cho `\\host\C$`.
