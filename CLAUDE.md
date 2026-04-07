# Project: Viet Sports Club

App quản lý đội bóng phủi cuối tuần của nhóm bạn. Dùng thực tế, không phải demo.

---

## Stack

| Layer | Công nghệ |
|-------|-----------|
| Frontend | Static HTML/CSS/JS – deploy trên **GitHub Pages** |
| Backend API | **Google Apps Script** (Web App, doPost) |
| Database | **Google Sheets** (8 sheets) |
| CSS framework | Tailwind CDN + custom `css/style.css` |
| Drag & drop | SortableJS CDN |

---

## Cấu trúc thư mục

```
/
├── index.html              # Single-page app shell + auth screen
├── css/style.css           # Custom styles (Tailwind utilities + components)
├── js/
│   ├── config.js           # API URL, constants, POSITIONS, MATCH_STATUS
│   ├── api.js              # API wrapper (API.call → Google Apps Script)
│   ├── auth.js             # Login, register, session management
│   ├── app.js              # Router (PAGES), UI helpers, formatters
│   └── pages/
│       ├── dashboard.js       # Trang chủ
│       ├── matches.js         # Lịch thi đấu + vote tham gia
│       ├── formation.js       # Xếp đội hình + vòng tròn kết quả
│       ├── live.js            # Live record tỉ số trực tiếp trên sân
│       ├── leaderboard.js     # Bảng xếp hạng ELO
│       ├── tournament.js      # Giải đấu: danh sách, chi tiết, standings, lịch, knockout
│       ├── tournament-live.js # Live scoring giải đấu (poll 15s)
│       ├── profile.js         # Hồ sơ cầu thủ
│       └── admin.js           # Quản lý user (chỉ admin)
└── apps-script/            # Backend GAS code (copy vào Apps Script Editor)
    ├── Code.gs             # Router doPost – action switch
    ├── Auth.gs             # login, register, logout, profile
    ├── Matches.gs          # CRUD trận đấu + vote + guest teams
    ├── Teams.gs            # suggestTeams, saveTeams, saveMatchResult, generateRoundRobinSchedule
    ├── Ratings.gs          # ELO calculation, leaderboard
    ├── Tournament.gs       # Quản lý giải đấu (Events, Groups, Teams, Matches, Standings, Knockout)
    ├── Utils.gs            # getSheet, getSheetData, generateId, nowISO, success/error helpers
    ├── Setup.gs            # Khởi tạo sheet structure + admin user + migration helpers
    └── TestData.gs         # Tạo dữ liệu test (không dùng trong production)
```

---

## Database (Google Sheets – 15 sheets)

Schema chi tiết xem `DATABASE_SCHEMA.md`. Tóm tắt:

| Sheet | Mục đích |
|-------|----------|
| USERS | Thành viên + chỉ số FIFA-style + ELO rating + `user_type` |
| MATCHES | Lịch thi đấu nội bộ |
| MATCH_ATTENDANCE | Vote YES/NO của từng user |
| GUEST_TEAMS | Đội khách mời (đá 1 lần, không có tài khoản) |
| MATCH_TEAMS | Đội hình trong từng trận (Đội Đỏ, Đội Xanh…) |
| TEAM_PLAYERS | Cầu thủ trong từng đội + bàn thắng/kiến tạo |
| MATCH_RESULTS | Kết quả từng cặp đấu vòng tròn |
| RATING_HISTORY | Lịch sử thay đổi ELO |
| EVENTS | Thông tin giải đấu |
| EVENT_GROUPS | Bảng đấu (Bảng A, B, C…) |
| EVENT_TEAMS | Đội tham gia giải |
| EVENT_MATCHES | Lịch thi đấu trong giải |
| EVENT_MATCH_EVENTS | Sự kiện trong trận (bàn thắng, thẻ phạt) |
| EVENT_STANDINGS | Bảng xếp hạng (cache, rebuild sau mỗi trận) |
| EVENT_KNOCKOUT | Cây vòng loại trực tiếp |

**Quan trọng:** `round_number` trong MATCH_RESULTS = số lượt (1=lượt đi, 2=lượt về, 3=lượt 3).

---

## Quy tắc vote tham gia

- Chỉ có **YES** và **NO** – đã xóa MAYBE
- Đội hình (suggestTeams) **chỉ lấy từ người vote YES**
- Backend filter: `vote_status === 'YES'`

---

## Luồng chính

```
Admin tạo trận → User vote YES/NO → Admin Auto xếp đội (Snake Draft)
→ Admin kéo thả điều chỉnh → Lưu đội hình
→ Tạo lịch vòng tròn (1/2/3 lượt) → Live thi đấu (ghi bàn trực tiếp)
→ Xong trận → ELO tự cập nhật → Leaderboard
```

---

## API pattern

Tất cả calls đều qua `API.call(action, data)` → POST tới Google Apps Script URL.

```javascript
// Frontend
API.call('generateSchedule', { match_id: 'MTH_001', num_rounds: 2 })

// Backend Code.gs router
case 'generateSchedule': result = generateRoundRobinSchedule(data); break;
```

Response format: `{ success: true, ...data }` hoặc `{ success: false, error: 'message' }`.

---

## Coding rules

- **Minimal changes** – chỉ sửa những gì cần thiết, không refactor phần không liên quan
- **Root cause** – tìm nguyên nhân thật, không dùng workaround tạm
- **No side effects** – sửa bug A không được tạo bug B
- **No speculative code** – không thêm tính năng chưa được yêu cầu
- **State là nguồn sự thật** – UI luôn render từ `formationState` / `liveState`, không đọc DOM làm nguồn data chính
- **Khi sửa backend GAS**: nhớ redeploy Web App với version mới ("New deployment" hoặc "Manage deployments → Update")

---

## Git workflow

```
feat: thêm tính năng mới
fix: sửa bug
refactor: cải thiện code không thay đổi hành vi
style: chỉ thay đổi CSS/format
chore: cập nhật config, dependency
```

Ví dụ: `fix: guest teams không hiển thị sau khi thêm`

Không cần chạy tests (project chưa có test suite) – kiểm tra thủ công trên browser trước khi commit.

---

## Những điều cần biết khi làm việc với project này

### GAS deployment
- Mỗi khi sửa `apps-script/*.gs` → phải **redeploy** Google Apps Script Web App để có hiệu lực
- URL API nằm ở `js/config.js` → `CONFIG.API_URL`
- Xem `DEPLOYMENT.md` để biết cách deploy step-by-step

### ELO system
- K=30, base=1000
- Bonus: bàn thắng +3, kiến tạo +2, clean sheet +5, MVP +10
- Chỉ trigger khi `saveMatchResult` với `status: 'completed'`
- `status: 'update_scorers'` chỉ cập nhật ghi bàn, không tính ELO lại

### Vòng tròn kết quả
- `round_number` = lượt (1, 2, 3), không phải số thứ tự trận
- Tìm result để update: dùng `result_id` (không dùng combo round+team như code cũ đã bị bug)
- UI nhóm kết quả theo lượt: "Lượt đi / Lượt về / Lượt 3"

### Live match screen
- Vào từ: Formation page → nút "🔴 Live thi đấu"
- Lưu `window._liveMatchId` để truyền match_id sang page
- +/- goal → cập nhật local state ngay, chọn scorer (optional)
- "Xong trận này" → gọi `saveMatchResult` với `status: 'completed'`

### Admin credentials mặc định
- username: `admin` / password: `admin123`

---

### Tournament / Event system
- **Luồng:** `createEvent` → `createGroups` → `addEventTeam` → `generateGroupSchedule` → `startEventMatch` → `addMatchEvent` / `updateEventScore` → `finishEventMatch` → `advanceToKnockout` → `confirmKnockoutBracket`
- `finishEventMatch` tự động rebuild `EVENT_STANDINGS` cho bảng đó
- `user_type = 'event_guest'` → chỉ thấy nav "Giải đấu", bị ẩn toàn bộ nav khác
- Tạo sheets mới cho DB đã có: chạy `setupTournamentSheets()` trong GAS
- Migration user_type cho users cũ: chạy `migrateAddUserType()` trong GAS
- Live scoring poll 15s: `getLiveMatch` action, cleanup khi rời trang

---

## Các lỗi thường gặp

| Lỗi | Nguyên nhân | Fix |
|-----|-------------|-----|
| API trả về lỗi CORS | GAS chưa deploy đúng | Redeploy với "Anyone" access |
| Guest teams không hiển thị | Cần gọi `API.getGuestTeams()` sau khi thêm để reload state | Xem `submitAddGuest()` trong formation.js |
| Kết quả không lưu được | Thiếu `result_id` trong payload | Truyền `result_id` từ `formationState.results` |
| Đội hình chỉ 1 người | User khác chưa vote YES (chỉ lấy YES) | Kiểm tra MATCH_ATTENDANCE |
| Tournament sheets không tồn tại | DB cũ chưa có sheets mới | Chạy `setupTournamentSheets()` trong GAS |
| user_type undefined | User cũ chưa có cột | Chạy `migrateAddUserType()` trong GAS |
