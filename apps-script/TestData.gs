// ============================================================
// TestData.gs - Tạo dữ liệu mẫu để test
// Chạy hàm: createTestData()
// Xóa dữ liệu test: clearTestData()
// ============================================================

// Prefix để dễ nhận biết và xóa test data
const TEST_PREFIX = 'TEST_';

function createTestData() {
  Logger.log('=== BẮT ĐẦU TẠO TEST DATA ===');
  clearTestData(); // Xóa data test cũ nếu có

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ---- 1. Tạo 10 cầu thủ test ----
  const players = createTestPlayers(ss);
  Logger.log(`✅ Tạo ${players.length} cầu thủ`);

  // ---- 2. Tạo 1 trận đấu upcoming ----
  const match = createTestMatch(ss);
  Logger.log(`✅ Tạo trận đấu: ${match.match_id}`);

  // ---- 3. Tất cả vote YES ----
  createTestAttendance(ss, match.match_id, players);
  Logger.log(`✅ Tạo ${players.length} votes YES`);

  // ---- 4. Xếp 2 đội (5v5) ----
  const teams = createTestTeams(ss, match.match_id, players);
  Logger.log(`✅ Xếp 2 đội: ${teams[0].team_id} vs ${teams[1].team_id}`);

  // ---- 5. Tạo lịch vòng tròn (1 cặp) ----
  const result = createTestResult(ss, match.match_id, teams);
  Logger.log(`✅ Tạo kết quả chờ nhập: ${result.result_id}`);

  Logger.log('=== XONG! ===');
  Logger.log('→ Đăng nhập app với admin/admin123 để test');
  Logger.log('→ Vào Lịch thi đấu → trận "Sân Nishiarai TEST" → Xếp đội');
  Logger.log('→ Nhập tỉ số → ELO tự cập nhật');

  return {
    players: players.length,
    match_id: match.match_id,
    teams: [teams[0].team_name, teams[1].team_name],
    result_id: result.result_id
  };
}

// ============================================================
// 1. TẠO PLAYERS
// ============================================================

function createTestPlayers(ss) {
  const sheet = ss.getSheetByName('USERS');

  // 10 cầu thủ với profile thực tế, chỉ số đa dạng
  const players = [
    {
      id: 'USR_TEST_01', username: 'minhquan', name: 'Nguyễn Minh Quân',
      positions: 'FW',
      pac: 82, sho: 85, pas: 72, dri: 80, def: 40, phy: 75,
      gkDiv: 30, gkHan: 30, gkRef: 30
    },
    {
      id: 'USR_TEST_02', username: 'tuan_mf', name: 'Trần Tuấn Anh',
      positions: 'MF',
      pac: 74, sho: 68, pas: 84, dri: 78, def: 65, phy: 73,
      gkDiv: 30, gkHan: 30, gkRef: 30
    },
    {
      id: 'USR_TEST_03', username: 'duc_anh', name: 'Lê Đức Anh',
      positions: 'DF',
      pac: 70, sho: 45, pas: 68, dri: 60, def: 85, phy: 82,
      gkDiv: 30, gkHan: 30, gkRef: 30
    },
    {
      id: 'USR_TEST_04', username: 'hoang_gk', name: 'Hoàng Minh Tú',
      positions: 'GK',
      pac: 60, sho: 30, pas: 55, dri: 45, def: 60, phy: 70,
      gkDiv: 82, gkHan: 80, gkRef: 85
    },
    {
      id: 'USR_TEST_05', username: 'van_hai', name: 'Đặng Văn Hải',
      positions: 'FW,MF',
      pac: 88, sho: 76, pas: 74, dri: 85, def: 42, phy: 72,
      gkDiv: 30, gkHan: 30, gkRef: 30
    },
    {
      id: 'USR_TEST_06', username: 'thanh_long', name: 'Bùi Thành Long',
      positions: 'MF,DF',
      pac: 72, sho: 60, pas: 80, dri: 72, def: 75, phy: 78,
      gkDiv: 30, gkHan: 30, gkRef: 30
    },
    {
      id: 'USR_TEST_07', username: 'van_nam', name: 'Vũ Văn Nam',
      positions: 'DF',
      pac: 68, sho: 42, pas: 65, dri: 58, def: 82, phy: 86,
      gkDiv: 30, gkHan: 30, gkRef: 30
    },
    {
      id: 'USR_TEST_08', username: 'minh_khai', name: 'Đinh Minh Khải',
      positions: 'GK,DF',
      pac: 65, sho: 35, pas: 60, dri: 50, def: 72, phy: 75,
      gkDiv: 78, gkHan: 76, gkRef: 80
    },
    {
      id: 'USR_TEST_09', username: 'van_khoa', name: 'Ngô Văn Khoa',
      positions: 'FW',
      pac: 85, sho: 80, pas: 65, dri: 82, def: 38, phy: 70,
      gkDiv: 30, gkHan: 30, gkRef: 30
    },
    {
      id: 'USR_TEST_10', username: 'quoc_bao', name: 'Phạm Quốc Bảo',
      positions: 'MF',
      pac: 76, sho: 72, pas: 82, dri: 76, def: 60, phy: 74,
      gkDiv: 30, gkHan: 30, gkRef: 30
    }
  ];

  const pwHash = hashPassword('test123');
  const now = new Date().toISOString();

  players.forEach(p => {
    const overall = calcOverall({
      pace: p.pac, shooting: p.sho, passing: p.pas,
      dribbling: p.dri, defending: p.def, physical: p.phy,
      gk_diving: p.gkDiv, gk_handling: p.gkHan, gk_reflexes: p.gkRef
    }, p.positions);

    sheet.appendRow([
      p.id, p.username, pwHash, p.name,
      `${p.username}@test.com`, '',
      false,           // is_admin
      p.positions,
      '',              // avatar_url
      p.pac, p.sho, p.pas, p.dri, p.def, p.phy,
      p.gkDiv, p.gkHan, p.gkRef,
      overall,
      1000,            // rating_points ban đầu
      0, 0, 0, 0, 0, 0, // match stats
      'active', now, '', '', ''
    ]);
    p.overall = overall;
  });

  return players;
}

// ============================================================
// 2. TẠO MATCH
// ============================================================

function createTestMatch(ss) {
  const sheet = ss.getSheetByName('MATCHES');

  // Trận vào thứ 7 tuần này
  const matchDate = getNextSaturday();
  const matchId = 'MTH_TEST_001';
  const now = new Date().toISOString();

  sheet.appendRow([
    matchId,
    matchDate,         // match_date
    '18:00',           // start_time
    '20:00',           // end_time
    'Sân Nishiarai TEST',
    '123 Đường Test, Quận 1',
    6,                 // num_players_per_team
    2,                 // num_teams
    '6v6',
    'scheduled',
    'Trận test - thứ 7 tuần này ⚽',
    'USR_ADMIN_001',
    now,
    ''
  ]);

  return { match_id: matchId, match_date: matchDate };
}

function getNextSaturday() {
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 6=Sat
  const diff = day === 6 ? 7 : (6 - day);
  d.setDate(d.getDate() + diff);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

// ============================================================
// 3. TẠO ATTENDANCE (tất cả vote YES)
// ============================================================

function createTestAttendance(ss, matchId, players) {
  const sheet = ss.getSheetByName('MATCH_ATTENDANCE');
  const now = new Date().toISOString();

  players.forEach((p, i) => {
    sheet.appendRow([
      `ATT_TEST_${String(i + 1).padStart(2, '0')}`,
      matchId,
      p.id,
      'YES',
      '',
      now, now
    ]);
  });
}

// ============================================================
// 4. XẾP ĐỘI (Snake Draft tự động)
// ============================================================

function createTestTeams(ss, matchId, players) {
  const teamsSheet = ss.getSheetByName('MATCH_TEAMS');
  const playersSheet = ss.getSheetByName('TEAM_PLAYERS');
  const now = new Date().toISOString();

  // Sort by overall giảm dần
  const sorted = [...players].sort((a, b) => b.overall - a.overall);

  const teams = [
    { team_id: 'TMT_TEST_01', name: 'Đội Đỏ', color: '#EF4444', players: [] },
    { team_id: 'TMT_TEST_02', name: 'Đội Xanh', color: '#3B82F6', players: [] }
  ];

  // Tách GK trước
  const gks = sorted.filter(p => p.positions.includes('GK'));
  const fields = sorted.filter(p => !p.positions.includes('GK') || p.positions.split(',').length > 1);

  // Gán 1 GK cho mỗi đội
  gks.forEach((gk, i) => {
    if (i < 2) teams[i].players.push({ ...gk, assignedPos: 'GK' });
    else fields.push(gk);
  });

  // Snake draft field players
  const fieldSorted = fields.sort((a, b) => b.overall - a.overall);
  fieldSorted.forEach((p, i) => {
    const round = Math.floor(i / 2);
    const idx = round % 2 === 0 ? (i % 2) : (1 - i % 2);
    const pos = p.positions.split(',').find(pos => pos !== 'GK') || p.positions.split(',')[0];
    teams[idx].players.push({ ...p, assignedPos: pos.trim() });
  });

  // Ghi vào sheet MATCH_TEAMS
  teams.forEach(team => {
    const avgRating = team.players.length > 0
      ? Math.round(team.players.reduce((s, p) => s + p.overall, 0) / team.players.length) : 0;

    teamsSheet.appendRow([
      team.team_id, matchId, team.name, team.color,
      'internal', '', '', 0, 0, 0, 0, now
    ]);

    // Ghi từng cầu thủ vào TEAM_PLAYERS
    team.players.forEach((p, idx) => {
      playersSheet.appendRow([
        `TMP_${team.team_id}_${String(idx + 1).padStart(2, '0')}`,
        team.team_id,
        matchId,
        p.id,
        '',                        // guest_player_name
        p.assignedPos,
        idx + 1,                   // jersey_number
        idx === 0,                 // is_captain (người đầu = đội trưởng)
        0, 0, 0, 0, 0              // goals, assists, cards, rating
      ]);
    });

    Logger.log(`Đội ${team.name}: ${team.players.map(p => p.name).join(', ')} (avg OVR: ${avgRating})`);
  });

  return teams;
}

// ============================================================
// 5. TẠO KẾT QUẢ PENDING (chờ nhập tỉ số)
// ============================================================

function createTestResult(ss, matchId, teams) {
  const sheet = ss.getSheetByName('MATCH_RESULTS');
  const resultId = 'RES_TEST_001';

  sheet.appendRow([
    resultId,
    matchId,
    1,                       // round_number
    teams[0].team_id,        // team_home
    teams[1].team_id,        // team_away
    0, 0,                    // scores (chưa nhập)
    'pending',
    new Date().toISOString(),
    '', ''
  ]);

  return { result_id: resultId };
}

// ============================================================
// XÓA TEST DATA
// ============================================================

function clearTestData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = [
    'USERS', 'MATCHES', 'MATCH_ATTENDANCE',
    'MATCH_TEAMS', 'TEAM_PLAYERS', 'MATCH_RESULTS', 'RATING_HISTORY'
  ];

  let deleted = 0;
  sheets.forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (!sheet) return;
    const data = sheet.getDataRange().getValues();

    // Xóa từ dưới lên để tránh lệch row index
    for (let i = data.length - 1; i >= 1; i--) {
      const rowId = String(data[i][0]);
      if (rowId.includes('TEST') || rowId.includes('test')) {
        sheet.deleteRow(i + 1);
        deleted++;
      }
    }
  });

  Logger.log(`✅ Đã xóa ${deleted} dòng test data`);
  return { deleted };
}

// ============================================================
// TẠO THÊM: Kịch bản 1 trận ĐÃ HOÀN THÀNH để xem ELO update
// Chạy hàm: createCompletedMatchDemo()
// ============================================================

function createCompletedMatchDemo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Kiểm tra xem test data đã tồn tại chưa
  const matchSheet = ss.getSheetByName('MATCHES');
  const matchData = matchSheet.getDataRange().getValues();
  const hasTest = matchData.some(r => String(r[0]).includes('TEST'));
  if (!hasTest) {
    Logger.log('⚠️ Chưa có test data. Chạy createTestData() trước!');
    return;
  }

  // Tạo 1 trận đã hoàn thành tuần trước
  const lastSaturday = getLastSaturday();
  const pastMatchId = 'MTH_TEST_PAST';
  const now = new Date().toISOString();

  // Kiểm tra trận cũ
  if (matchData.some(r => r[0] === pastMatchId)) {
    Logger.log('Trận demo đã tồn tại rồi');
    return;
  }

  // Tạo trận cũ
  matchSheet.appendRow([
    pastMatchId, lastSaturday, '18:00', '20:00',
    'Sân Test - Tuần trước', '456 Đường Demo, Q.3',
    6, 2, '6v6', 'completed',
    'Trận demo đã kết thúc - xem ELO update',
    'USR_ADMIN_001', now, ''
  ]);

  // Lấy player IDs
  const usersSheet = ss.getSheetByName('USERS');
  const userData = usersSheet.getDataRange().getValues();
  const testPlayers = userData.filter(r => String(r[0]).includes('TEST') && r[0] !== 'USR_ADMIN_001')
    .map(r => ({ id: r[0], name: r[3], overall: Number(r[18]) || 60 }));

  if (testPlayers.length < 4) {
    Logger.log('⚠️ Cần có test players. Chạy createTestData() trước!');
    return;
  }

  // Sắp đội cho trận cũ
  const sorted = testPlayers.sort((a, b) => b.overall - a.overall);
  const teamA = { id: 'TMT_TEST_PAST_A', name: 'Đội Đỏ (Demo)', color: '#EF4444', players: [] };
  const teamB = { id: 'TMT_TEST_PAST_B', name: 'Đội Xanh (Demo)', color: '#3B82F6', players: [] };

  sorted.forEach((p, i) => {
    const round = Math.floor(i / 2);
    if (round % 2 === 0) {
      (i % 2 === 0 ? teamA : teamB).players.push(p);
    } else {
      (i % 2 === 0 ? teamB : teamA).players.push(p);
    }
  });

  const teamsSheet = ss.getSheetByName('MATCH_TEAMS');
  const playersSheet = ss.getSheetByName('TEAM_PLAYERS');

  [teamA, teamB].forEach(team => {
    teamsSheet.appendRow([team.id, pastMatchId, team.name, team.color, 'internal', '', '', 0, 0, 0, 0, now]);
    team.players.forEach((p, idx) => {
      playersSheet.appendRow([
        `TMP_${team.id}_${idx}`, team.id, pastMatchId, p.id,
        '', idx < 2 ? 'FW' : idx < 4 ? 'MF' : 'DF', idx + 1, idx === 0,
        0, 0, 0, 0, 0
      ]);
    });
  });

  // Tạo kết quả: Đội Đỏ thắng 3-1
  const resultId = 'RES_TEST_PAST_001';
  const resultsSheet = ss.getSheetByName('MATCH_RESULTS');
  resultsSheet.appendRow([
    resultId, pastMatchId, 1,
    teamA.id, teamB.id,
    3, 1,             // ← Đội Đỏ thắng 3-1
    'pending',        // Để pending, sau đó chạy updatePlayerELO để test
    now, '', ''
  ]);

  Logger.log('✅ Tạo trận demo xong!');
  Logger.log('→ Vào app: Lịch thi đấu → "Sân Test - Tuần trước" → Xếp đội → Kết quả');
  Logger.log('→ Nhập tỉ số 3-1 rồi nhấn ✓ để xem ELO cập nhật');
  Logger.log(`→ match_id: ${pastMatchId}`);
}

function getLastSaturday() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 6 ? 0 : (day + 1);
  d.setDate(d.getDate() - diff);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

// ============================================================
// KIỂM TRA DỮ LIỆU HIỆN TẠI
// ============================================================

function checkTestData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const result = {};

  ['USERS', 'MATCHES', 'MATCH_ATTENDANCE', 'MATCH_TEAMS', 'TEAM_PLAYERS', 'MATCH_RESULTS'].forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (!sheet) { result[name] = 0; return; }
    const data = sheet.getDataRange().getValues();
    const testRows = data.filter((r, i) => i > 0 && String(r[0]).includes('TEST'));
    result[name] = testRows.length;
  });

  Logger.log('=== TRẠNG THÁI TEST DATA ===');
  Object.entries(result).forEach(([k, v]) => Logger.log(`  ${k}: ${v} dòng`));
  return result;
}
