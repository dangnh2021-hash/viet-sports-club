# 🏆 World Cup 2026 Prediction Feature — Implementation Plan
**App: Toneri FC | Stack: GAS + Google Sheets + Static HTML/JS**

---

## 1. Executive Summary

Thêm module **Dự đoán World Cup 2026** vào app Toneri FC hiện tại. User xem lịch thi đấu, dự đoán kết quả từng trận **1 lần duy nhất trước giờ đá**, hệ thống tự tính điểm và xếp hạng. Không thay đổi schema hiện tại — chỉ thêm mới.

---

## 2. Kiến trúc tổng thể (không thay đổi)

```
GitHub Pages (Static HTML/JS)
        ↕ fetch / doPost
Google Apps Script Web App (Backend API)
        ↕ SpreadsheetApp
Google Sheets (Database)
```

**Thay đổi theo tầng:**
| Tầng | Việc cần làm | Ghi chú |
|------|-------------|---------|
| Google Sheets | Thêm 3 sheet mới | Không sửa sheet cũ |
| GAS (Backend) | Thêm `WorldCup.gs` + đăng ký actions vào `Code.gs` | Không sửa `.gs` cũ |
| Frontend JS | Thêm `js/pages/worldcup.js` | File mới |
| Frontend HTML | Thêm 1 section `#page-worldcup` vào `index.html` | Thêm, không xóa |
| Config | Thêm constants WC vào `config.js` | Thêm cuối file |

---

## 3. Data Source — Lịch thi đấu World Cup 2026

### Lựa chọn API

| Option | API | Ưu | Nhược |
|--------|-----|----|----|
| **A (Recommended)** | `football-data.org` (free tier) | Free, có WC2026, GAS support | Cần API key, limit 10 req/min |
| B | `api-football.com` (free tier) | Phong phú | Limit 100 req/ngày |
| C | Static data (seed vào Sheet) | Không phụ thuộc API | Phải update thủ công khi có kết quả |

### Quyết định: **Hybrid approach**
- **Master data** (đội, bảng, lịch đấu) → **seed tĩnh vào GAS** lúc setup — vì schedule WC2026 đã biết trước
- **Kết quả trận đấu** → Admin nhập tay HOẶC trigger `fetchWCResults` từ API sau mỗi trận
- GAS dùng `UrlFetchApp` để gọi `football-data.org` khi admin bấm "Cập nhật kết quả"

---

## 4. Database — Google Sheets mới (3 sheets)

### Sheet 9: `WC_MATCHES` — Lịch thi đấu World Cup

| Cột | Tên | Kiểu | Mô tả |
|-----|-----|------|-------|
| A | `wc_match_id` | STRING | e.g. `WCM_001` |
| B | `match_date` | DATE | `YYYY-MM-DD` |
| C | `start_time` | TIME | `HH:MM` (giờ VN, UTC+7) |
| D | `team_home` | STRING | Tên đội (e.g. `Brazil`) |
| E | `team_away` | STRING | Tên đội (e.g. `Argentina`) |
| F | `team_home_code` | STRING | ISO code (e.g. `BRA`) |
| G | `team_away_code` | STRING | ISO code (e.g. `ARG`) |
| H | `group_id` | STRING | `A`, `B`, ..., `L` hoặc `R16`, `QF`, `SF`, `F` |
| I | `stage` | STRING | `group` / `r16` / `qf` / `sf` / `final` |
| J | `venue` | STRING | Tên sân + thành phố |
| K | `status` | STRING | `scheduled` / `ongoing` / `completed` |
| L | `score_home` | INTEGER | NULL nếu chưa đá |
| M | `score_away` | INTEGER | NULL nếu chưa đá |
| N | `result` | STRING | `H` (home win) / `D` (draw) / `A` (away win) / NULL |

> **Note:** Seed ~104 trận WC2026 vào sheet này khi setup. Chỉ cột L, M, N thay đổi sau mỗi trận.

---

### Sheet 10: `WC_PREDICTIONS` — Dự đoán của user

| Cột | Tên | Kiểu | Mô tả |
|-----|-----|------|-------|
| A | `prediction_id` | STRING | `WCP_001` |
| B | `wc_match_id` | STRING | FK → WC_MATCHES |
| C | `user_id` | STRING | FK → USERS |
| D | `predicted_outcome` | STRING | `H` / `D` / `A` |
| E | `predicted_score_home` | INTEGER | Tỉ số dự đoán đội nhà |
| F | `predicted_score_away` | INTEGER | Tỉ số dự đoán đội khách |
| G | `submitted_at` | DATETIME | Thời điểm submit |
| H | `points_outcome` | INTEGER | 0 hoặc 1 (tính sau trận) |
| I | `points_score` | INTEGER | 0 hoặc 3 (tính sau trận) |
| J | `total_points` | INTEGER | points_outcome + points_score |
| K | `calculated_at` | DATETIME | Thời điểm tính điểm |

> **Unique constraint:** `(wc_match_id, user_id)` — enforce tại GAS layer.

---

### Sheet 11: `WC_LEADERBOARD_CACHE` — Cache bảng xếp hạng

| Cột | Tên | Kiểu | Mô tả |
|-----|-----|------|-------|
| A | `user_id` | STRING | FK → USERS |
| B | `username` | STRING | Denormalized |
| C | `full_name` | STRING | Denormalized |
| D | `total_points` | INTEGER | Tổng điểm WC |
| E | `correct_outcomes` | INTEGER | Số lần đoán đúng W/D/L |
| F | `exact_scores` | INTEGER | Số lần đoán đúng tỉ số |
| G | `total_predictions` | INTEGER | Tổng số trận đã đoán |
| H | `rank` | INTEGER | Thứ hạng hiện tại |
| I | `updated_at` | DATETIME | |

> **Pattern:** Tính lại toàn bộ mỗi khi admin trigger `calculateWCScores`.

---

## 5. Backend — Google Apps Script

### File mới: `WorldCup.gs`

```
// ============================================================
// WorldCup.gs — World Cup 2026 Prediction Module
// ============================================================
```

**Các functions cần implement:**

#### 5.1 Read Actions (user gọi)

| Action | Function | Mô tả |
|--------|----------|-------|
| `getWCMatches` | `getWCMatches(data)` | Lấy lịch thi đấu. Params: `filter` (all/upcoming/group), `group_id` |
| `getWCMatchDetail` | `getWCMatchDetail(data)` | Lấy chi tiết 1 trận + dự đoán của user hiện tại |
| `getMyWCPredictions` | `getMyWCPredictions(data)` | Lấy tất cả dự đoán của user đang login |
| `getWCLeaderboard` | `getWCLeaderboard(data)` | Lấy bảng xếp hạng từ cache |

#### 5.2 Write Actions (user gọi)

| Action | Function | Logic |
|--------|----------|-------|
| `submitWCPrediction` | `submitWCPrediction(data)` | Validate → Insert vào WC_PREDICTIONS |

**Logic validate `submitWCPrediction`:**
```
1. Kiểm tra user đã login (token valid)
2. Lấy match từ WC_MATCHES → nếu status = 'completed' → reject
3. Kiểm tra thời gian: now() < match_date + start_time → nếu trễ → reject
4. Kiểm tra đã có prediction (wc_match_id, user_id) → nếu có → reject "Chỉ submit 1 lần"
5. Validate consistency:
   - predicted_outcome = 'H' → predicted_score_home > predicted_score_away
   - predicted_outcome = 'A' → predicted_score_away > predicted_score_home
   - predicted_outcome = 'D' → predicted_score_home === predicted_score_away
6. Insert row vào WC_PREDICTIONS (points = NULL, calculated_at = NULL)
7. Return success
```

#### 5.3 Admin Actions

| Action | Function | Mô tả |
|--------|----------|-------|
| `updateWCMatchResult` | `updateWCMatchResult(data)` | Admin nhập score_home, score_away → cập nhật WC_MATCHES |
| `calculateWCScores` | `calculateWCScores(data)` | Tính điểm tất cả predictions của trận → cập nhật WC_PREDICTIONS + WC_LEADERBOARD_CACHE |
| `fetchWCResultsFromAPI` | `fetchWCResultsFromAPI(data)` | (Optional) Gọi football-data.org lấy kết quả tự động |
| `seedWCData` | `seedWCData(data)` | Admin seed lịch WC2026 vào sheet (chạy 1 lần) |

**Logic `calculateWCScores`:**
```
1. Lấy match result từ WC_MATCHES (score_home, score_away, result)
2. Lấy tất cả predictions cho wc_match_id
3. Với mỗi prediction:
   a. points_outcome = (predicted_outcome === result) ? 1 : 0
   b. exact_match = (predicted_score_home === score_home && predicted_score_away === score_away)
   c. points_score = exact_match ? 3 : 0
   d. total_points = points_outcome + points_score
      → Nếu exact score đúng: total = 0+3 = 3 (outcome đúng tự nhiên, nhưng points riêng)
      → Nếu chỉ outcome đúng: total = 1+0 = 1
   e. Update row trong WC_PREDICTIONS
4. Recalculate WC_LEADERBOARD_CACHE (aggregate từ toàn bộ WC_PREDICTIONS)
5. Update WC_MATCHES.status = 'completed'
```

> **Scoring rule rõ ràng:**
> - Đúng outcome (W/D/L): **+1 điểm**
> - Đúng tỉ số chính xác: **+3 điểm** (cộng thêm, không thay thế outcome point)
> - Max per match = **4 điểm**

### Đăng ký vào `Code.gs`

Thêm vào switch-case trong `doPost()`:
```javascript
// ---- World Cup 2026 ----
case 'getWCMatches':           result = getWCMatches(data); break;
case 'getWCMatchDetail':       result = getWCMatchDetail(data); break;
case 'getMyWCPredictions':     result = getMyWCPredictions(data); break;
case 'getWCLeaderboard':       result = getWCLeaderboard(data); break;
case 'submitWCPrediction':     result = submitWCPrediction(data); break;
case 'updateWCMatchResult':    result = updateWCMatchResult(data); break;
case 'calculateWCScores':      result = calculateWCScores(data); break;
case 'fetchWCResultsFromAPI':  result = fetchWCResultsFromAPI(data); break;
case 'seedWCData':             result = seedWCData(data); break;
```

---

## 6. Frontend

### 6.1 Navigation — `index.html`

Thêm 1 nav item vào bottom navigation bar hiện tại:
```html
<!-- Thêm vào bottom nav -->
<button onclick="navigate('worldcup')" id="nav-worldcup" class="nav-item">
  <i class="fas fa-trophy text-xl"></i>
  <span class="text-xs mt-1">World Cup</span>
</button>
```

Thêm 1 page section mới (cùng pattern với `#page-dashboard`, `#page-matches`...):
```html
<div id="page-worldcup" class="page hidden">
  <!-- Content injected by worldcup.js -->
</div>
```

---

### 6.2 File mới: `js/pages/worldcup.js`

**Cấu trúc giao diện (render bằng JS, không template riêng):**

#### Landing section (khi vào trang WC):
```
┌─────────────────────────────────────────┐
│ 🏆 WORLD CUP 2026                       │
│ USA · Canada · Mexico                   │
├─────────────────────────────────────────┤
│ [Tất cả] [Sắp diễn ra] [Đã xong]       │ ← Filter tabs
│ [Bảng A] [Bảng B] ... [Bảng L]         │ ← Group filter
├─────────────────────────────────────────┤
│ 📅 CÁC TRẬN SẮP DIỄN RA                │
│ ┌─────────────────────────────────────┐ │
│ │ [BRA] Brazil  vs  Argentina [ARG]   │ │
│ │ Bảng C | 22/06 21:00 | Sân MetLife │ │
│ │ [Dự đoán ngay →]                   │ │
│ └─────────────────────────────────────┘ │
│ (more cards...)                         │
├─────────────────────────────────────────┤
│ 📊 BẢNG XẾP HẠNG DỰ ĐOÁN (WC)         │
│ 1. Dang Nguyen    ████ 42 pts          │
│ 2. Minh Tran      ████ 38 pts          │
│ ...                                     │
└─────────────────────────────────────────┘
```

#### Match card click → Prediction Modal:
```
┌─────────────────────────────────────────┐
│ Brazil 🇧🇷  vs  🇦🇷 Argentina           │
│ Bảng C | Thứ Hai 22/06 | 21:00         │
│ ⏰ Còn 2 ngày 14 giờ để dự đoán        │
├─────────────────────────────────────────┤
│ 1️⃣ DỰ ĐOÁN KẾT QUẢ                     │
│ ○ Brazil thắng  ○ Hòa  ○ Argentina thắng│
├─────────────────────────────────────────┤
│ 2️⃣ DỰ ĐOÁN TỈ SỐ (tùy chọn)           │
│    Brazil  [ 2 ]  :  [ 1 ]  Argentina  │
│                                         │
│ ✅ Tỉ số hợp lệ (Brazil thắng)         │
│ ⚠️  [Validation message nếu sai]       │
├─────────────────────────────────────────┤
│ [HỦY]           [🚀 GỬI DỰ ĐOÁN]      │
└─────────────────────────────────────────┘
```

**Nếu đã submit:**
```
┌─────────────────────────────────────────┐
│ ✅ Bạn đã dự đoán trận này              │
│ Kết quả: Brazil thắng (2-1)            │
│ Điểm: Đang chờ kết quả                 │
└─────────────────────────────────────────┘
```

---

### 6.3 Validation Logic (Frontend)

```javascript
function validatePrediction(outcome, scoreHome, scoreAway) {
  // Bắt buộc chọn outcome
  if (!outcome) return { valid: false, msg: 'Vui lòng chọn kết quả' };

  // Nếu có nhập tỉ số thì validate consistency
  if (scoreHome !== '' && scoreAway !== '') {
    const h = parseInt(scoreHome), a = parseInt(scoreAway);
    if (outcome === 'H' && h <= a)
      return { valid: false, msg: '⚠️ Tỉ số phải là đội nhà thắng' };
    if (outcome === 'A' && a <= h)
      return { valid: false, msg: '⚠️ Tỉ số phải là đội khách thắng' };
    if (outcome === 'D' && h !== a)
      return { valid: false, msg: '⚠️ Tỉ số phải bằng nhau khi hòa' };
  }

  return { valid: true };
}
```

> **Tỉ số là optional** — user có thể chỉ chọn outcome. Nếu tỉ số trống → chỉ tính điểm outcome.

---

### 6.4 Thêm vào `config.js`

```javascript
// World Cup 2026
WC: {
  EDITION: 'World Cup 2026',
  HOST: 'USA · Canada · Mexico',
  START_DATE: '2026-06-11',
  END_DATE: '2026-07-19',
  GROUPS: ['A','B','C','D','E','F','G','H','I','J','K','L'],
  STAGES: {
    group: 'Vòng Bảng',
    r16: 'Vòng 1/8',
    qf: 'Tứ kết',
    sf: 'Bán kết',
    final: 'Chung kết'
  },
  SCORING: {
    CORRECT_OUTCOME: 1,
    EXACT_SCORE: 3
  }
}
```

---

## 7. Luồng dữ liệu đầy đủ

```
[Admin seed WC_MATCHES — 104 trận]
           ↓
[User vào tab "World Cup"]
           ↓
[getWCMatches → hiển thị lịch + trận sắp đá nổi bật]
           ↓
[User click vào trận → getWCMatchDetail]
           ↓
[Hiển thị modal dự đoán]
           ↓
[User chọn outcome + tỉ số → validate frontend]
           ↓
[submitWCPrediction → GAS validate:
  - Chưa quá giờ đá?
  - Chưa submit lần nào?
  - Tỉ số consistent với outcome?]
           ↓
[Insert vào WC_PREDICTIONS (points = NULL)]
           ↓
[Sau trận: Admin nhập kết quả hoặc API tự fetch]
           ↓
[Admin trigger calculateWCScores]
           ↓
[Update WC_PREDICTIONS.points cho từng user]
[Recalculate WC_LEADERBOARD_CACHE]
           ↓
[User xem leaderboard WC]
```

---

## 8. Phân rã công việc (Task Breakdown)

### Phase 1: Database Setup (30 phút)
- [ ] Tạo 3 sheet mới trong Google Sheets: `WC_MATCHES`, `WC_PREDICTIONS`, `WC_LEADERBOARD_CACHE`
- [ ] Đặt header theo schema trên

### Phase 2: Backend — `WorldCup.gs` (3–4 giờ)
- [ ] `seedWCData()` — hardcode 104 trận WC2026 vào sheet
- [ ] `getWCMatches()` — với filter logic
- [ ] `getWCMatchDetail()` — trả về match + prediction của user
- [ ] `submitWCPrediction()` — full validation + insert
- [ ] `getMyWCPredictions()` — lịch sử dự đoán
- [ ] `updateWCMatchResult()` — admin cập nhật kết quả
- [ ] `calculateWCScores()` — tính điểm + rebuild leaderboard cache
- [ ] `getWCLeaderboard()` — đọc từ cache
- [ ] Đăng ký tất cả action vào `Code.gs`

### Phase 3: Frontend (4–5 giờ)
- [ ] Thêm nav item "World Cup" vào `index.html`
- [ ] Thêm `#page-worldcup` section vào `index.html`
- [ ] Tạo `js/pages/worldcup.js`:
  - [ ] `renderWorldCupPage()` — layout chính
  - [ ] `renderMatchList()` — danh sách trận có filter
  - [ ] `renderMatchCard()` — card mỗi trận
  - [ ] `openPredictionModal()` — modal dự đoán
  - [ ] `validatePrediction()` — real-time validation
  - [ ] `submitPrediction()` — gọi API + xử lý response
  - [ ] `renderWCLeaderboard()` — bảng xếp hạng WC
- [ ] Thêm WC constants vào `config.js`
- [ ] Load `worldcup.js` vào `index.html`

### Phase 4: Admin Panel (1 giờ)
- [ ] Thêm section WC vào `js/pages/admin.js`:
  - [ ] Button "Seed WC Data"
  - [ ] Nhập kết quả trận (input score_home, score_away + select match)
  - [ ] Button "Tính điểm" (trigger calculateWCScores)

### Phase 5: Test & Deploy (1 giờ)
- [ ] Test submit prediction trước/sau giờ đá
- [ ] Test validate tỉ số
- [ ] Test duplicate prevention
- [ ] Test tính điểm
- [ ] Test leaderboard
- [ ] Deploy GAS (new version) → update `API_URL` nếu cần
- [ ] Push frontend lên GitHub Pages

---

## 9. Các điểm cần lưu ý khi implement

### 9.1 Timezone
World Cup 2026 dùng giờ US (EDT/CDT). Hiển thị cho user ở **Nhật Bản cần convert sang UTC+9 (JST)**. Recommend lưu vào sheet theo giờ JST (UTC+9) để đơn giản — không cần xử lý convert thêm phía backend.

> Ví dụ: Trận đá lúc 15:00 EDT (New York) = 04:00 JST hôm sau. Seed trực tiếp giờ JST vào `WC_MATCHES.start_time`.

### 9.2 GAS Time Comparison
```javascript
// GAS — so sánh theo JST (UTC+9)
const now = new Date();
const matchTime = new Date(matchRow[1] + 'T' + matchRow[2] + ':00+09:00');
if (now >= matchTime) throw new Error('Đã quá giờ đăng ký dự đoán');
```

### 9.3 Unique Check trong GAS
```javascript
// Tìm existing prediction
const existing = sheet.createTextFinder(wcMatchId).findAll()
  .find(cell => cell.getColumn() === 1 && sheet.getRange(cell.getRow(), 3).getValue() === userId);
if (existing) throw new Error('Bạn đã dự đoán trận này rồi');
```

### 9.4 Flag icons
Dùng emoji flag (ISO country code → emoji): `BRA` = 🇧🇷, không cần external assets.

### 9.5 Khi chưa có dữ liệu WC chính thức
WC2026 chưa có lịch đầy đủ cho tất cả 104 trận (do chưa xong vòng loại). Seed các trận vòng bảng đã biết trước, các trận knockout sẽ update sau.

---

## 10. Prompt để implement từng phần

Sau khi xem plan này, bạn có thể yêu cầu tôi implement từng phase:

1. **"Tạo WorldCup.gs với đầy đủ functions"**
2. **"Seed 104 trận WC2026 vào seedWCData()"**
3. **"Tạo js/pages/worldcup.js với UI đầy đủ"**
4. **"Thêm WC section vào admin.js"**
5. **"Thêm nav item và page section vào index.html"**

---

*Plan version 1.0 | 2026-04-06*
