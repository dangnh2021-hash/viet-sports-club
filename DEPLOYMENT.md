# Hướng dẫn Deploy Viet Sports Club App

## Tổng quan

```
Frontend (GitHub Pages) ←→ Google Apps Script (API) ←→ Google Sheets (Database)
```

---

## BƯỚC 1: Tạo Google Sheets Database

1. Truy cập [Google Sheets](https://sheets.google.com)
2. Tạo một spreadsheet mới, đặt tên: **"Viet Sports Club Database"**
3. Ghi lại URL của spreadsheet (sẽ cần ở bước sau)

---

## BƯỚC 2: Tạo Google Apps Script

1. Trong spreadsheet vừa tạo, vào menu **Extensions → Apps Script**
2. Xóa code mặc định trong `Code.gs`
3. Tạo các file mới bằng cách nhấn **"+"** (New script file) và đặt tên:
   - `Code` → copy nội dung từ `apps-script/Code.gs`
   - `Utils` → copy nội dung từ `apps-script/Utils.gs`
   - `Setup` → copy nội dung từ `apps-script/Setup.gs`
   - `Auth` → copy nội dung từ `apps-script/Auth.gs`
   - `Matches` → copy nội dung từ `apps-script/Matches.gs`
   - `Teams` → copy nội dung từ `apps-script/Teams.gs`
   - `Ratings` → copy nội dung từ `apps-script/Ratings.gs`
   - `Tournament` → copy nội dung từ `apps-script/Tournament.gs` ← **MỚI**

4. Nhấn **Save** (Ctrl+S)

---

## BƯỚC 3: Khởi tạo Database

1. Trong Apps Script Editor, chọn hàm `setupSpreadsheet` từ dropdown
2. Nhấn **Run ▶️**
3. Lần đầu sẽ yêu cầu cấp quyền → nhấn **Review permissions** → chọn tài khoản Google → nhấn **Allow**
4. Chạy lại `setupSpreadsheet` một lần nữa
5. Kiểm tra trong Google Sheets: sẽ thấy **15 sheets** được tạo tự động (8 cũ + 7 tournament)
6. Sheet `USERS` sẽ có sẵn 1 dòng admin: `admin / admin123`

> **Nếu đã có DB cũ (chỉ có 8 sheets):**
> - Chạy `setupTournamentSheets()` để thêm 7 sheets tournament mới
> - Chạy `migrateAddUserType()` để thêm cột `user_type` và backfill `'internal'` cho users cũ

---

## BƯỚC 4: Deploy Apps Script thành Web App

1. Trong Apps Script Editor, nhấn **Deploy → New deployment**
2. Chọn type: **Web app**
3. Cấu hình:
   - **Description**: Viet Sports Club API v1.0
   - **Execute as**: Me (your Google account)
   - **Who has access**: Anyone
4. Nhấn **Deploy**
5. Cho phép quyền truy cập nếu được yêu cầu
6. **Copy URL** của Web App (dạng: `https://script.google.com/macros/s/XXXXXX/exec`)

> ⚠️ **Quan trọng**: Mỗi lần chỉnh sửa code Apps Script, bạn phải deploy lại version mới:
> Deploy → Manage deployments → Edit → New version → Deploy

---

## BƯỚC 5: Cấu hình Frontend

1. Mở file `js/config.js`
2. Thay `YOUR_APPS_SCRIPT_URL_HERE` bằng URL vừa copy ở Bước 4:

```javascript
const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbxXXXXXXXX/exec',
  // ...
};
```

---

## BƯỚC 6: Deploy lên GitHub Pages

### Cách 1: GitHub Desktop (dễ nhất)
1. Tải [GitHub Desktop](https://desktop.github.com/)
2. Tạo repository mới trên [GitHub](https://github.com/new), đặt tên: `viet-sports-club`
3. Trong GitHub Desktop: **Add local repository** → chọn thư mục dự án
4. Commit all files với message: "Initial commit: Viet Sports Club App"
5. Push to GitHub
6. Vào repository trên GitHub.com → **Settings → Pages**
7. Source: **Deploy from a branch** → Branch: **main** → Folder: **/(root)** → Save
8. Sau ~2 phút: app sẽ chạy tại `https://[username].github.io/viet-sports-club/`

### Cách 2: Git command line
```bash
cd "C:/Users/user/Documents/Claude/Projects/Đầu tư/Viet Sports Club"
git init
git add .
git commit -m "Initial commit: Viet Sports Club App"
git branch -M main
git remote add origin https://github.com/[username]/viet-sports-club.git
git push -u origin main
```
Sau đó bật GitHub Pages trong Settings.

---

## BƯỚC 7: Test App

1. Mở URL GitHub Pages
2. Đăng nhập với: `admin` / `admin123`
3. Thử tạo lịch thi đấu
4. Đăng ký thêm tài khoản test

---

## Cấu trúc file dự án

```
Viet Sports Club/
├── index.html              ← SPA chính
├── css/
│   └── style.css           ← Custom styles
├── js/
│   ├── config.js           ← ⚠️ Cần thay API_URL
│   ├── api.js              ← API wrapper
│   ├── auth.js             ← Auth state + handlers
│   ├── app.js              ← Router + UI helpers
│   └── pages/
│       ├── dashboard.js    ← Trang chủ
│       ├── matches.js      ← Lịch thi đấu
│       ├── formation.js    ← Xếp đội (drag & drop)
│       ├── leaderboard.js  ← Bảng xếp hạng
│       ├── admin.js        ← Admin panel
│       └── profile.js      ← Hồ sơ cầu thủ
├── apps-script/
│   ├── Code.gs             ← API router
│   ├── Utils.gs            ← Helper functions
│   ├── Setup.gs            ← Database setup
│   ├── Auth.gs             ← Authentication
│   ├── Matches.gs          ← Match management
│   ├── Teams.gs            ← Team formation
│   └── Ratings.gs         ← ELO rating system
├── DATABASE_SCHEMA.md      ← Thiết kế DB
└── DEPLOYMENT.md           ← File này
```

---

## Troubleshooting

### Lỗi "API is not set" / CORS error
- Kiểm tra `CONFIG.API_URL` trong `js/config.js` đúng chưa
- Đảm bảo Apps Script đã được deploy với **"Who has access: Anyone"**
- Thử reload trang sau khi đổi config

### Lỗi "Unauthorized"
- Token hết hạn sau 24h → đăng xuất và đăng nhập lại

### Lỗi "Sheet not found"
- Chạy lại `setupSpreadsheet()` trong Apps Script Editor

### Dữ liệu không cập nhật sau khi thay đổi code
- Apps Script cần deploy phiên bản mới: **Deploy → Manage deployments → Edit → New version → Deploy**

### App chậm khi gọi API lần đầu
- Bình thường - Google Apps Script cần "warm up" khoảng 2-3 giây lần đầu
- Những lần sau nhanh hơn

---

## Tài khoản mặc định

| Username | Password | Quyền |
|----------|----------|-------|
| admin | admin123 | Admin |

> ⚠️ Đổi password admin sau khi deploy bằng cách chỉnh trực tiếp trong Google Sheets hoặc thêm chức năng đổi password trong app.

---

## Cập nhật App

Mỗi khi sửa code frontend:
```bash
git add .
git commit -m "Update: [mô tả thay đổi]"
git push
```
GitHub Pages tự động cập nhật sau ~2 phút.

Mỗi khi sửa Apps Script:
1. Lưu code trong Apps Script Editor
2. **Deploy → Manage deployments → Edit → New version → Deploy**
