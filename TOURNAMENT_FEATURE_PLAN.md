# 🏆 Tournament / Event Feature — Implementation Plan
**App: Toneri FC | Stack: GAS + Google Sheets + Static HTML/JS**

---

## 1. Executive Summary

Thêm module **Giải đấu (Tournament Event)** hoàn chỉnh vào Toneri FC. Admin tạo giải, cấu hình bảng đấu động (3–5 đội/bảng, nhiều bảng), hệ thống auto-generate lịch vòng tròn, ghi điểm live, xếp hạng tự động, và tiến sang vòng knockout với bracket suggest. User khách mời có tài khoản riêng, chỉ truy cập được module giải đấu.

---

## 2. Thay đổi theo từng tầng

| Tầng | Thay đổi | Ghi chú |
|------|---------|---------|
| **Google Sheets** | Thêm 6 sheet mới + thêm 1 cột vào USERS | Không sửa data cũ |
| **GAS** | Thêm `Tournament.gs` (file mới) + đăng ký actions vào `Code.gs` | Không sửa `.gs` cũ |
| **Frontend JS** | Thêm `js/pages/tournament.js` + `js/pages/tournament-live.js` | File mới |
| **Frontend HTML** | Thêm 2 sections mới + 1 nav item vào `index.html` | Thêm, không xóa |
| **Config** | Thêm tournament constants vào `config.js` | Thêm cuối file |

---

## 3. Mở rộng User — User Type

### Vấn đề
Hiện tại USERS chỉ có user nội bộ Toneri (có stats, ELO, positions). Event cần user khách mời (1 tài khoản / 1 đội khách) — không cần stats cầu thủ cá nhân.

### Giải pháp: Thêm cột `user_type` vào USERS sheet

| Column | Giá trị | Mô tả |
|--------|---------|-------|
| `user_type` | `'internal'` | User Toneri FC cũ (default — backfill) |
| `user_type` | `'event_guest'` | Tài khoản đại diện 1 đội khách |

**Thêm cột sau `is_admin` (cột G → H mới, shift các cột sau):**
> ⚠️ **Quan trọng:** Phải cập nhật index cột trong tất cả `.gs` files sau khi thêm cột.

**Phương án an toàn hơn:** Thêm cột `user_type` vào **cuối** USERS sheet (cột AD) để không cần reindex.

### Behavior theo user_type

| Tính năng | internal | event_guest |
|-----------|----------|-------------|
| Dashboard, ELO, Formation | ✅ | ❌ (ẩn nav) |
| Vote tham gia trận Toneri | ✅ | ❌ |
| Xem Tournament (read) | ✅ | ✅ |
| Quản lý đội hình đội mình trong tournament | ❌ | ✅ (team captain) |
| Nhập tỉ số live | ❌ | ❌ (chỉ admin) |
| Xem top scorer, standings | ✅ | ✅ |

### Admin tạo guest user
- Admin vào panel → "Tạo tài khoản khách" → nhập `team_name`, hệ thống auto-generate `username = team_slug`, `password` random → trả về thông tin để admin gửi cho đội khách.
- Guest user đăng nhập → chỉ thấy Tournament UI.

---

## 4. Database — 6 Sheet mới

---

### Sheet 9: `EVENTS` — Thông tin giải đấu

| Cột | Tên | Kiểu | Mô tả |
|-----|-----|------|-------|
| A | `event_id` | STRING | `EVT_001` |
| B | `event_name` | STRING | Tên giải (e.g. "Toneri Cup 2026") |
| C | `description` | STRING | Mô tả ngắn |
| D | `start_date` | DATE | Ngày bắt đầu |
| E | `end_date` | DATE | Ngày kết thúc |
| F | `venue_name` | STRING | Tên sân |
| G | `venue_address` | STRING | Địa chỉ sân |
| H | `status` | STRING | `draft` / `group_stage` / `knockout` / `completed` |
| I | `teams_per_group` | INTEGER | 3, 4, hoặc 5 |
| J | `advance_per_group` | INTEGER | Số đội đi tiếp mỗi bảng (1 hoặc 2) |
| K | `logo_url` | STRING | URL logo giải (tùy chọn) |
| L | `created_by` | STRING | FK → USERS.user_id |
| M | `created_at` | DATETIME | |

---

### Sheet 10: `EVENT_GROUPS` — Bảng đấu

| Cột | Tên | Kiểu | Mô tả |
|-----|-----|------|-------|
| A | `group_id` | STRING | `GRP_001` |
| B | `event_id` | STRING | FK → EVENTS |
| C | `group_name` | STRING | `Bảng A`, `Bảng B`, ... |
| D | `group_order` | INTEGER | 1, 2, 3... (để sắp xếp) |
| E | `venue_name` | STRING | Sân riêng của bảng (override event venue nếu có) |
| F | `notes` | STRING | Ghi chú |

---

### Sheet 11: `EVENT_TEAMS` — Đội tham gia giải

| Cột | Tên | Kiểu | Mô tả |
|-----|-----|------|-------|
| A | `event_team_id` | STRING | `ETM_001` |
| B | `event_id` | STRING | FK → EVENTS |
| C | `group_id` | STRING | FK → EVENT_GROUPS |
| D | `team_name` | STRING | Tên đội |
| E | `team_color` | STRING | Hex color |
| F | `team_type` | STRING | `internal` (Toneri) / `guest` |
| G | `manager_user_id` | STRING | FK → USERS (tài khoản quản lý đội) |
| H | `seed` | INTEGER | Hạt giống xếp bảng (1, 2, 3...) |
| I | `logo_url` | STRING | URL logo đội (tùy chọn) |
| J | `contact_name` | STRING | Tên liên hệ (đội khách) |
| K | `contact_phone` | STRING | SĐT liên hệ |
| L | `notes` | STRING | |
| M | `created_at` | DATETIME | |

---

### Sheet 12: `EVENT_MATCHES` — Lịch thi đấu trong giải

| Cột | Tên | Kiểu | Mô tả |
|-----|-----|------|-------|
| A | `event_match_id` | STRING | `EMT_001` |
| B | `event_id` | STRING | FK → EVENTS |
| C | `group_id` | STRING | FK → EVENT_GROUPS (NULL nếu knockout) |
| D | `stage` | STRING | `group` / `r16` / `qf` / `sf` / `final` |
| E | `round_number` | INTEGER | Lượt đấu trong bảng (1, 2, 3...) |
| F | `match_number` | INTEGER | Số thứ tự trận trong giải |
| G | `team_home_id` | STRING | FK → EVENT_TEAMS.event_team_id |
| H | `team_away_id` | STRING | FK → EVENT_TEAMS.event_team_id |
| I | `match_date` | DATE | Ngày thi đấu |
| J | `start_time` | TIME | Giờ bắt đầu (JST UTC+9) |
| K | `venue` | STRING | Sân thi đấu (override) |
| L | `status` | STRING | `scheduled` / `ongoing` / `completed` |
| M | `score_home` | INTEGER | NULL nếu chưa đá |
| N | `score_away` | INTEGER | NULL nếu chưa đá |
| O | `result` | STRING | `H` / `D` / `A` / NULL |
| P | `notes` | STRING | |

---

### Sheet 13: `EVENT_MATCH_EVENTS` — Sự kiện trong trận (bàn thắng, thẻ phạt)

| Cột | Tên | Kiểu | Mô tả |
|-----|-----|------|-------|
| A | `event_id_row` | STRING | `MEV_001` |
| B | `event_match_id` | STRING | FK → EVENT_MATCHES |
| C | `minute` | INTEGER | Phút xảy ra |
| D | `team_id` | STRING | FK → EVENT_TEAMS |
| E | `event_type` | STRING | `goal` / `own_goal` / `yellow_card` / `red_card` |
| F | `player_name` | STRING | Tên cầu thủ (free text) |
| G | `jersey_number` | INTEGER | Số áo |
| H | `assist_name` | STRING | Tên người kiến tạo (nếu có) |
| I | `created_at` | DATETIME | |

---

### Sheet 14: `EVENT_STANDINGS` — Bảng xếp hạng (cache, rebuild sau mỗi trận)

| Cột | Tên | Kiểu | Mô tả |
|-----|-----|------|-------|
| A | `standing_id` | STRING | `STD_001` |
| B | `event_id` | STRING | FK → EVENTS |
| C | `group_id` | STRING | FK → EVENT_GROUPS |
| D | `event_team_id` | STRING | FK → EVENT_TEAMS |
| E | `rank` | INTEGER | Thứ hạng trong bảng |
| F | `played` | INTEGER | Số trận đã đá |
| G | `wins` | INTEGER | Thắng |
| H | `draws` | INTEGER | Hòa |
| I | `losses` | INTEGER | Thua |
| J | `goals_for` | INTEGER | Bàn thắng ghi được |
| K | `goals_against` | INTEGER | Bàn thắng bị thủng lưới |
| L | `goal_diff` | INTEGER | Hiệu số bàn thắng |
| M | `points` | INTEGER | Điểm (W×3 + D×1) |
| N | `updated_at` | DATETIME | |

**Tiebreaker order (rank cùng điểm):**
1. Goal Difference (cao hơn thắng)
2. Goals For (cao hơn thắng)
3. Head-to-head result
4. Rút thăm (admin quyết định)

---

### Sheet 15: `EVENT_KNOCKOUT` — Cây vòng loại trực tiếp

| Cột | Tên | Kiểu | Mô tả |
|-----|-----|------|-------|
| A | `knockout_id` | STRING | `KO_001` |
| B | `event_id` | STRING | FK → EVENTS |
| C | `stage` | STRING | `r16` / `qf` / `sf` / `final` / `third_place` |
| D | `match_slot` | INTEGER | Vị trí slot trong vòng (1, 2, 3...) |
| E | `team_home_id` | STRING | FK → EVENT_TEAMS (NULL nếu chưa xác định) |
| F | `team_away_id` | STRING | FK → EVENT_TEAMS (NULL nếu chưa xác định) |
| G | `slot_label_home` | STRING | Label khi chưa biết đội (e.g. "Nhất Bảng A") |
| H | `slot_label_away` | STRING | Label khi chưa biết đội (e.g. "Nhì Bảng B") |
| I | `event_match_id` | STRING | FK → EVENT_MATCHES (sau khi trận được tạo) |
| J | `winner_team_id` | STRING | Đội thắng (điền sau trận) |
| K | `next_knockout_id` | STRING | FK → EVENT_KNOCKOUT (slot vòng tiếp theo) |

---

## 5. Backend — Google Apps Script

### File mới: `Tournament.gs`

#### 5.1 Admin — Setup & Management

| Action | Function | Logic |
|--------|----------|-------|
| `createEvent` | `createEvent(data)` | Tạo event mới → insert EVENTS |
| `updateEvent` | `updateEvent(data)` | Sửa thông tin event |
| `createGroups` | `createGroups(data)` | Tạo bảng đấu (array group names) → insert EVENT_GROUPS |
| `addEventTeam` | `addEventTeam(data)` | Thêm đội vào bảng → insert EVENT_TEAMS |
| `removeEventTeam` | `removeEventTeam(data)` | Xóa đội khỏi bảng |
| `generateGroupSchedule` | `generateGroupSchedule(data)` | **Auto-generate lịch vòng tròn** cho 1 bảng |
| `updateEventMatch` | `updateEventMatch(data)` | Cập nhật ngày/giờ/sân cho trận |
| `createGuestUserAccount` | `createGuestUserAccount(data)` | Admin tạo tài khoản cho đội khách |

#### 5.2 Admin — Live Scoring

| Action | Function | Logic |
|--------|----------|-------|
| `startEventMatch` | `startEventMatch(data)` | Set status = `ongoing` |
| `updateEventScore` | `updateEventScore(data)` | Cập nhật tỉ số + recalculate standings |
| `addMatchEvent` | `addMatchEvent(data)` | Thêm sự kiện (bàn thắng + tên cầu thủ) |
| `removeMatchEvent` | `removeMatchEvent(data)` | Xóa sự kiện nhầm |
| `finishEventMatch` | `finishEventMatch(data)` | Set status = `completed` → auto rebuild standings |

#### 5.3 Admin — Knockout

| Action | Function | Logic |
|--------|----------|-------|
| `advanceToKnockout` | `advanceToKnockout(data)` | Đọc standings → **suggest bracket** → insert EVENT_KNOCKOUT |
| `confirmKnockoutBracket` | `confirmKnockoutBracket(data)` | Admin confirm/edit bracket → insert EVENT_MATCHES |
| `advanceKnockoutWinner` | `advanceKnockoutWinner(data)` | Sau mỗi trận KO → điền winner vào slot kế tiếp |

#### 5.4 Public — Read (all users)

| Action | Function | Logic |
|--------|----------|-------|
| `getEvents` | `getEvents(data)` | Danh sách giải đấu (status filter) |
| `getEventDetail` | `getEventDetail(data)` | Thông tin giải + groups + standings tổng |
| `getGroupStandings` | `getGroupStandings(data)` | Standings của 1 bảng (từ cache) |
| `getEventSchedule` | `getEventSchedule(data)` | Toàn bộ lịch thi đấu của event |
| `getEventMatchDetail` | `getEventMatchDetail(data)` | Chi tiết 1 trận + events timeline |
| `getTopScorers` | `getTopScorers(data)` | Bảng vua phá lưới của event |
| `getKnockoutBracket` | `getKnockoutBracket(data)` | Cây knockout bracket |
| `getLiveMatch` | `getLiveMatch(data)` | Trận đang diễn ra (polling) |

---

### Thuật toán `generateGroupSchedule` — Round-robin

```javascript
/**
 * Tạo lịch vòng tròn cho N đội trong 1 bảng
 * Thứ tự: với 4 đội → (1v2, 3v4), (1v3, 2v4), (1v4, 2v3)
 * Thuật toán: "circle method" cố định đội 1, xoay vòng các đội còn lại
 */
function generateRoundRobin(teams) {
  // teams = [teamA, teamB, teamC, teamD]
  const n = teams.length;
  const schedule = []; // mảng các "lượt" (round), mỗi lượt có nhiều trận

  let list = [...teams];
  if (n % 2 !== 0) list.push(null); // thêm "bye" nếu lẻ đội

  const half = list.length / 2;
  const fixed = list[0];
  let rotating = list.slice(1);

  for (let round = 0; round < list.length - 1; round++) {
    const roundMatches = [];
    const current = [fixed, ...rotating];

    for (let i = 0; i < half; i++) {
      const home = current[i];
      const away = current[current.length - 1 - i];
      if (home && away) roundMatches.push({ home, away });
    }

    schedule.push(roundMatches);
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)]; // rotate right
  }

  return schedule;
}

/**
 * Kết quả với 4 đội [1,2,3,4]:
 * Round 1: 1v4, 2v3
 * Round 2: 1v3, 4v2
 * Round 3: 1v2, 3v4
 *
 * → Re-order để khớp với yêu cầu (1v2, 3v4 | 1v3, 2v4 | 1v4, 2v3):
 * Admin có thể swap home/away và reorder trong từng round
 */
```

**Số trận theo số đội:**

| Số đội | Số trận | Số lượt |
|--------|---------|---------|
| 3 | 3 | 3 |
| 4 | 6 | 3 |
| 5 | 10 | 5 |

---

### Thuật toán `advanceToKnockout` — Suggest Bracket

```javascript
/**
 * Suggest cây knockout từ standings vòng bảng
 * Mặc định: cross-pairing (Nhất A vs Nhì B, Nhất B vs Nhì A, ...)
 *
 * Ví dụ 4 bảng, top 2 advance:
 * Slot 1: Nhất Bảng A vs Nhì Bảng B
 * Slot 2: Nhất Bảng C vs Nhì Bảng D
 * Slot 3: Nhất Bảng B vs Nhì Bảng A
 * Slot 4: Nhất Bảng D vs Nhì Bảng C
 *
 * Admin xem suggest → drag/swap đội → confirm → tạo EVENT_MATCHES
 */
```

---

### Đăng ký vào `Code.gs`

```javascript
// ---- Tournament ----
case 'createEvent':              result = createEvent(data); break;
case 'updateEvent':              result = updateEvent(data); break;
case 'createGroups':             result = createGroups(data); break;
case 'addEventTeam':             result = addEventTeam(data); break;
case 'removeEventTeam':          result = removeEventTeam(data); break;
case 'generateGroupSchedule':    result = generateGroupSchedule(data); break;
case 'updateEventMatch':         result = updateEventMatch(data); break;
case 'createGuestUserAccount':   result = createGuestUserAccount(data); break;
case 'startEventMatch':          result = startEventMatch(data); break;
case 'updateEventScore':         result = updateEventScore(data); break;
case 'addMatchEvent':            result = addMatchEvent(data); break;
case 'removeMatchEvent':         result = removeMatchEvent(data); break;
case 'finishEventMatch':         result = finishEventMatch(data); break;
case 'advanceToKnockout':        result = advanceToKnockout(data); break;
case 'confirmKnockoutBracket':   result = confirmKnockoutBracket(data); break;
case 'advanceKnockoutWinner':    result = advanceKnockoutWinner(data); break;
case 'getEvents':                result = getEvents(data); break;
case 'getEventDetail':           result = getEventDetail(data); break;
case 'getGroupStandings':        result = getGroupStandings(data); break;
case 'getEventSchedule':         result = getEventSchedule(data); break;
case 'getEventMatchDetail':      result = getEventMatchDetail(data); break;
case 'getTopScorers':            result = getTopScorers(data); break;
case 'getKnockoutBracket':       result = getKnockoutBracket(data); break;
case 'getLiveMatch':             result = getLiveMatch(data); break;
```

---

## 6. Frontend — Các màn hình

### 6.1 Navigation — thêm 1 nav item

```html
<button onclick="navigate('tournament')" id="nav-tournament" class="nav-item">
  <i class="fas fa-trophy text-xl"></i>
  <span class="text-xs mt-1">Giải Đấu</span>
</button>
```

> `event_guest` user → chỉ thấy nav item này (ẩn Dashboard, Lịch, Đội hình, Lịch sử, ELO).

---

### 6.2 Màn hình 1: `#page-tournament` — Danh sách giải đấu

```
┌─────────────────────────────────────────────────┐
│ 🏆 CÁC GIẢI ĐẤU                    [+ Tạo mới] │
├─────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────┐   │
│ │ 🏆 TONERI CUP 2026                        │   │
│ │ 📅 15/07 – 20/07  |  📍 Sân ABC           │   │
│ │ 🟢 Đang diễn ra · Vòng bảng              │   │
│ │                        [Xem chi tiết →]   │   │
│ └───────────────────────────────────────────┘   │
│ ┌───────────────────────────────────────────┐   │
│ │ ⚽ Giải Mini Football Q3/2025             │   │
│ │ 📅 10/09 – 11/09  |  📍 Sân XYZ           │   │
│ │ ✅ Đã kết thúc                            │   │
│ │                        [Xem chi tiết →]   │   │
│ └───────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

---

### 6.3 Màn hình 2: `#page-event-detail` — Chi tiết giải đấu

Tabs chuyển đổi:

```
[📊 Bảng đấu] [📅 Lịch thi đấu] [🏅 Vua phá lưới] [🎯 Knockout]
```

**Tab Bảng đấu:**
```
┌──────────────────── BẢNG A ─────────────────────┐
│  #  Đội          Đ  T  H  B  BT BA ĐS  Điểm    │
│  1  Toneri FC    3  3  0  0  9  2  +7   9  ●    │
│  2  Đội Sao Đỏ  3  2  0  1  5  4  +1   6       │
│  3  FC Hà Nội   3  1  0  2  3  6  -3   3       │
│  4  Team XYZ    3  0  0  3  2  7  -5   0       │
├──────────────────── BẢNG B ─────────────────────┤
│  ...                                            │
└─────────────────────────────────────────────────┘
```

**Tab Lịch thi đấu:**
```
┌── LƯỢT 1 ────────────────────────────────────────┐
│  [BẢNG A] Toneri FC  2–1  Đội Sao Đỏ  ✅        │
│  [BẢNG A] FC Hà Nội  0–3  Team XYZ    ✅        │
│  [BẢNG B] ...                                   │
├── LƯỢT 2 ────────────────────────────────────────┤
│  [BẢNG A] Toneri FC  🟢 vs FC Hà Nội  LIVE      │ ← click → live screen
│  ...                                            │
├── LƯỢT 3 ─────────────────────────── (sắp tới) ─┤
│  [BẢNG A] 📅 20/07 15:00                         │
└─────────────────────────────────────────────────┘
```

**Tab Vua phá lưới:**
```
┌─────────────────────────────────────────────────┐
│ ⚽ BẢNG VUA PHÁ LƯỚI                           │
│  1  #10 Nguyễn Văn A  (Toneri FC)    5 bàn     │
│  2  #9  Trần Văn B    (Đội Sao Đỏ)  4 bàn     │
│  3  #7  Lê Văn C      (FC Hà Nội)   3 bàn     │
└─────────────────────────────────────────────────┘
```

**Tab Knockout Bracket:**
```
┌─────────────────────────────────────────────────┐
│              🏆 TỨ KẾT                          │
│                                                 │
│  Nhất A  ─┐                                     │
│           ├─ SF1 ─┐                             │
│  Nhì B   ─┘       │                             │
│                   ├─ CHUNG KẾT ─ 🏆            │
│  Nhất B  ─┐       │                             │
│           ├─ SF2 ─┘                             │
│  Nhì A   ─┘                                     │
└─────────────────────────────────────────────────┘
```

---

### 6.4 Màn hình 3: `#page-event-live` — Live Scoring

```
┌─────────────────────────────────────────────────┐
│  🟢 ĐANG DIỄN RA · Bảng A · Lượt 2            │
│  ⏱ 47'                      Sân: ABC - Sân 1   │
├────────────────────────────────────────────────┤
│                                                 │
│    TONERI FC       3  –  1    ĐỘI SAO ĐỎ       │
│    [  -  ] [  +  ]          [  -  ] [  +  ]    │ ← admin only
│                                                 │
├──────────────── TIMELINE ──────────────────────┤
│  ⚽ 12'  #10 Văn A  →  TONERI FC  (Kiến: #7)  │
│  ⚽ 23'  #9  Văn B  →  ĐỘI SAO ĐỎ            │
│  ⚽ 34'  #7  Văn C  →  TONERI FC              │
│  ⚽ 41'  #10 Văn A  →  TONERI FC              │
├──────────────── THÊM SỰ KIỆN ─────────────────┤ ← admin only
│  Phút: [47]  Đội: [Toneri FC ▼]               │
│  Loại: ⚽ Bàn thắng  🟡 Thẻ vàng  🔴 Thẻ đỏ  │
│  Cầu thủ: [tên]  Số áo: [số]                  │
│  Kiến tạo: [tên] (tùy chọn)                   │
│                          [➕ Thêm sự kiện]     │
├────────────────────────────────────────────────┤
│  [❌ Hủy sự kiện cuối]      [✅ Kết thúc trận] │
└─────────────────────────────────────────────────┘
```

> **Auto-refresh:** Frontend poll `getLiveMatch` mỗi **15 giây** khi đang ở live screen.

---

### 6.5 Màn hình Admin — Tournament Setup (trong `admin.js`)

Thêm section mới trong trang Admin:

```
[+ Tạo giải đấu]
 ↓
[Step 1: Thông tin giải] → tên, ngày, sân
[Step 2: Cấu hình bảng] → số bảng, số đội/bảng
[Step 3: Thêm đội vào bảng] → kéo thả hoặc chọn
[Step 4: Generate lịch] → xem preview, điều chỉnh giờ
[Step 5: Tạo tài khoản khách] → auto-gen username/password
[Publish giải → visible cho tất cả user]
```

---

### 6.6 File Frontend mới

| File | Nội dung |
|------|---------|
| `js/pages/tournament.js` | List events, event detail, standings, schedule, top scorers, knockout bracket |
| `js/pages/tournament-live.js` | Live scoring screen, polling, add/remove events |

---

## 7. Scoring & Standings Logic

### Tính điểm (rebuild sau mỗi `finishEventMatch`)

```
Thắng  = +3 điểm
Hòa    = +1 điểm
Thua   = 0 điểm
```

### Xếp hạng (tiebreaker theo thứ tự ưu tiên)

```
1. Điểm tích lũy (points)              ← cao hơn xếp trên
2. Hiệu số bàn thắng (goal_diff)        ← cao hơn xếp trên
3. Bàn thắng ghi được (goals_for)       ← cao hơn xếp trên
4. Kết quả đối đầu trực tiếp            ← head-to-head
5. Admin quyết định (rút thăm)
```

---

## 8. Suggest thêm — Tính năng bonus (Quick Wins)

Các tính năng dưới đây dễ implement, giúp tăng giá trị giải đáng kể:

### 8.1 Share / Public Link (không cần login)
- Thêm query param: `index.html?event=EVT_001&public=1`
- Nếu `public=1` → bỏ qua auth, chỉ load read-only tournament view
- Dùng để gửi link cho khán giả, phụ huynh, đội bạn xem

### 8.2 QR Code
- Trên màn hình event detail, admin thấy nút "📲 QR Code" → generate QR link public
- Thư viện: `qrcode.js` (CDN, 2KB)

### 8.3 Match Program Card (Thẻ trận đấu)
- Mỗi trận có button "Chia sẻ" → generate ảnh card đẹp kiểu poster
- Dùng Canvas API hoặc `html2canvas`
- Nội dung: logo 2 đội, giờ, sân, giải đấu

### 8.4 Man of the Match (MVP)
- Sau khi kết thúc trận → admin chọn 1 cầu thủ MVP
- Hiển thị ⭐ trong timeline trận đấu và bảng top scorer

### 8.5 Penalty Shootout Support
- Nếu trận knockout kết thúc hòa → thêm mode "Penalty"
- Nhập kết quả penalty riêng (không tính vào bàn thắng)
- Quyết định đội thắng tiến vào vòng sau

### 8.6 Print / Export
- Button "🖨 In lịch đấu" → `window.print()` với CSS print media query
- Xuất standings ra bảng đẹp

---

## 9. Luồng dữ liệu đầy đủ

```
[Admin tạo EVENT + GROUPS + EVENT_TEAMS]
           ↓
[Admin generateGroupSchedule → tạo EVENT_MATCHES tự động]
           ↓
[Admin set ngày giờ cho từng trận]
           ↓
[User xem tournament: getEventSchedule + getGroupStandings]
           ↓
[Admin startEventMatch → status = ongoing]
           ↓
[Admin cập nhật score + addMatchEvent (tên, số áo)]
           ↓
[Frontend poll getLiveMatch mỗi 15 giây]
           ↓
[Admin finishEventMatch → auto rebuild EVENT_STANDINGS]
           ↓
[Sau khi hết tất cả trận vòng bảng]
           ↓
[Admin advanceToKnockout → system suggest bracket]
           ↓
[Admin xem, chỉnh sửa bracket → confirmKnockoutBracket]
           ↓
[Tạo EVENT_MATCHES cho knockout + lặp lại live scoring]
           ↓
[advanceKnockoutWinner sau mỗi trận KO → fill slot kế]
           ↓
[Final → EVENT.status = completed]
```

---

## 10. Phân rã công việc (Task Breakdown)

### Phase 1: Database Setup (30 phút)
- [ ] Thêm cột `user_type` vào USERS sheet (cột cuối AD)
- [ ] Tạo 6 sheet mới: EVENTS, EVENT_GROUPS, EVENT_TEAMS, EVENT_MATCHES, EVENT_MATCH_EVENTS, EVENT_STANDINGS, EVENT_KNOCKOUT

### Phase 2: Backend GAS (5–6 giờ)
- [ ] `Tournament.gs` — 24 functions theo spec trên
- [ ] Implement `generateRoundRobin()` algorithm
- [ ] Implement `rebuildStandings()` — đọc EVENT_MATCHES, tính điểm từng đội, cập nhật cache
- [ ] Implement `suggestKnockoutBracket()` — cross-pairing từ standings
- [ ] Sửa `Auth.gs`: logic phân biệt `event_guest` khi đăng ký (no positions/stats required)
- [ ] Đăng ký 26 actions mới vào `Code.gs`

### Phase 3: Frontend (6–8 giờ)
- [ ] `tournament.js`: event list, event detail (4 tabs), standings table, schedule, bracket
- [ ] `tournament-live.js`: live screen + polling + add/remove event
- [ ] Admin section trong `admin.js`: create event flow (5 steps)
- [ ] Nav item + page sections trong `index.html`
- [ ] Tournament constants trong `config.js`
- [ ] Routing: `navigate('tournament')`, `navigate('event-detail', {event_id})`, `navigate('event-live', {match_id})`
- [ ] Guest user UX: ẩn nav items không liên quan

### Phase 4: Bonus Features (2–3 giờ, optional)
- [ ] QR Code public link
- [ ] Penalty shootout mode
- [ ] Print/export

### Phase 5: Test & Deploy (1–2 giờ)
- [ ] Test create event → generate schedule → live score → standings
- [ ] Test guest user login → view-only
- [ ] Test knockout bracket suggest + override
- [ ] Deploy GAS + push GitHub Pages

---

## 11. Prompt để implement từng phần

Khi sẵn sàng, yêu cầu từng phase:

1. **"Tạo Tournament.gs với đầy đủ 24 functions"**
2. **"Implement algorithm generateRoundRobin và rebuildStandings"**
3. **"Tạo js/pages/tournament.js với 4 tabs"**
4. **"Tạo js/pages/tournament-live.js với polling"**
5. **"Thêm tournament setup vào admin.js"**
6. **"Thêm guest user flow vào Auth.gs và auth UI"**

---

*Plan version 1.0 | 2026-04-07 | Timezone: JST (UTC+9)*
