// ============================================================
// Tournament.gs - Quản lý Giải đấu (Events / Tournament)
// Viet Sports Club
// ============================================================

// ============================================================
// SECTION 1: ADMIN - SETUP & MANAGEMENT
// ============================================================

function createEvent(data) {
  const admin = requireAdmin(data);
  const { event_name, description, start_date, end_date, venue_name, venue_address, teams_per_group, advance_per_group, logo_url } = data;
  if (!event_name) return error('Thiếu tên giải đấu');

  const eventId = generateId('EVT');
  const sheet = getSheet('EVENTS');
  sheet.appendRow([
    eventId,
    event_name,
    description || '',
    start_date || '',
    end_date || '',
    venue_name || '',
    venue_address || '',
    'draft',                    // status
    Number(teams_per_group) || 4,
    Number(advance_per_group) || 2,
    logo_url || '',
    admin.user_id,
    nowISO()
  ]);
  return success({ event_id: eventId, message: 'Tạo giải đấu thành công' });
}

function updateEvent(data) {
  requireAdmin(data);
  const { event_id, updates } = data;
  if (!event_id || !updates) return error('Thiếu dữ liệu');

  const row = findRowByValue('EVENTS', 0, event_id);
  if (!row) return error('Không tìm thấy giải đấu');

  const allowed = ['event_name','description','start_date','end_date','venue_name','venue_address','status','teams_per_group','advance_per_group','logo_url'];
  const sheet = getSheet('EVENTS');
  const headers = row.headers;
  allowed.forEach(f => {
    if (updates[f] !== undefined) {
      const col = headers.indexOf(f);
      if (col >= 0) sheet.getRange(row.rowNum, col + 1).setValue(updates[f]);
    }
  });
  return success({ message: 'Cập nhật giải đấu thành công' });
}

function createGroups(data) {
  requireAdmin(data);
  const { event_id, group_names } = data;
  if (!event_id || !group_names || !group_names.length) return error('Thiếu dữ liệu bảng đấu');

  const sheet = getSheet('EVENT_GROUPS');
  const createdIds = [];
  group_names.forEach((name, idx) => {
    const groupId = generateId('GRP');
    sheet.appendRow([groupId, event_id, name, idx + 1, '', '']);
    createdIds.push(groupId);
  });
  return success({ group_ids: createdIds, message: `Đã tạo ${createdIds.length} bảng đấu` });
}

function addEventTeam(data) {
  requireAdmin(data);
  const { event_id, group_id, team_name, team_color, team_type, manager_user_id, seed, logo_url, contact_name, contact_phone, notes } = data;
  if (!event_id || !team_name) return error('Thiếu event_id hoặc team_name');

  const teamId = generateId('ETM');
  const sheet = getSheet('EVENT_TEAMS');
  sheet.appendRow([
    teamId, event_id, group_id || '', team_name,
    team_color || '#6B7280', team_type || 'guest',
    manager_user_id || '', Number(seed) || 0,
    logo_url || '', contact_name || '', contact_phone || '',
    notes || '', nowISO()
  ]);
  return success({ event_team_id: teamId, message: 'Thêm đội thành công' });
}

function removeEventTeam(data) {
  requireAdmin(data);
  const { event_team_id } = data;
  if (!event_team_id) return error('Thiếu event_team_id');

  const sheet = getSheet('EVENT_TEAMS');
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(event_team_id)) {
      sheet.deleteRow(i + 1);
      return success({ message: 'Đã xóa đội khỏi giải' });
    }
  }
  return error('Không tìm thấy đội');
}

function generateGroupSchedule(data) {
  requireAdmin(data);
  const { event_id, group_id } = data;
  if (!event_id || !group_id) return error('Thiếu event_id hoặc group_id');

  // Lấy danh sách đội trong bảng
  const teams = getSheetData('EVENT_TEAMS').filter(t => t.event_id === event_id && t.group_id === group_id);
  if (teams.length < 2) return error('Cần ít nhất 2 đội để tạo lịch');

  // Round-robin "circle method"
  const schedule = _roundRobin(teams);

  // Lấy match_number hiện tại của event để tiếp tục đánh số
  const existing = getSheetData('EVENT_MATCHES').filter(m => m.event_id === event_id);
  let matchNumber = existing.length + 1;

  const sheet = getSheet('EVENT_MATCHES');
  const created = [];

  schedule.forEach((round, roundIdx) => {
    round.forEach(({ home, away }) => {
      const matchId = generateId('EMT');
      sheet.appendRow([
        matchId, event_id, group_id, 'group',
        roundIdx + 1, matchNumber++,
        home.event_team_id, away.event_team_id,
        '', '', '', 'scheduled',
        null, null, null, ''
      ]);
      created.push(matchId);
    });
  });

  return success({ matches_created: created.length, message: `Đã tạo ${created.length} trận cho bảng` });
}

function _roundRobin(teams) {
  let list = [...teams];
  if (list.length % 2 !== 0) list.push(null); // bye
  const half = list.length / 2;
  const fixed = list[0];
  let rotating = list.slice(1);
  const schedule = [];

  for (let round = 0; round < list.length - 1; round++) {
    const current = [fixed, ...rotating];
    const roundMatches = [];
    for (let i = 0; i < half; i++) {
      const home = current[i];
      const away = current[current.length - 1 - i];
      if (home && away) roundMatches.push({ home, away });
    }
    schedule.push(roundMatches);
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
  }
  return schedule;
}

function updateEventMatch(data) {
  requireAdmin(data);
  const { event_match_id, updates } = data;
  if (!event_match_id || !updates) return error('Thiếu dữ liệu');

  const row = findRowByValue('EVENT_MATCHES', 0, event_match_id);
  if (!row) return error('Không tìm thấy trận đấu');

  const allowed = ['match_date','start_time','venue','round_number','notes'];
  const sheet = getSheet('EVENT_MATCHES');
  const headers = row.headers;
  allowed.forEach(f => {
    if (updates[f] !== undefined) {
      const col = headers.indexOf(f);
      if (col >= 0) sheet.getRange(row.rowNum, col + 1).setValue(updates[f]);
    }
  });
  return success({ message: 'Cập nhật trận thành công' });
}

function createGuestUserAccount(data) {
  const admin = requireAdmin(data);
  const { team_name } = data;
  if (!team_name) return error('Thiếu tên đội');

  const sheet = getSheet('USERS');
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];

  // Auto-gen username từ tên đội
  const slug = team_name.toLowerCase()
    .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
    .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
    .replace(/[ìíịỉĩ]/g, 'i')
    .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
    .replace(/[ùúụủũưừứựửữ]/g, 'u')
    .replace(/[ỳýỵỷỹ]/g, 'y')
    .replace(/[đ]/g, 'd')
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 12);

  const username = 'guest_' + slug + '_' + Math.floor(Math.random() * 1000);
  const password = Math.random().toString(36).substring(2, 10);

  // Kiểm tra username trùng
  const usernameCol = headers.indexOf('username');
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][usernameCol] === username) return error('Username đã tồn tại, thử lại');
  }

  const userId = generateId('USR');
  const newRow = new Array(headers.length).fill('');
  newRow[headers.indexOf('user_id')] = userId;
  newRow[headers.indexOf('username')] = username;
  newRow[headers.indexOf('password_hash')] = hashPassword(password);
  newRow[headers.indexOf('full_name')] = team_name;
  newRow[headers.indexOf('is_admin')] = false;
  newRow[headers.indexOf('status')] = 'active';
  newRow[headers.indexOf('created_at')] = nowISO();
  const utIdx = headers.indexOf('user_type');
  if (utIdx >= 0) newRow[utIdx] = 'event_guest';

  sheet.appendRow(newRow);
  return success({
    user_id: userId,
    username,
    password,
    message: 'Tài khoản khách đã tạo — gửi thông tin này cho đội'
  });
}

// ============================================================
// SECTION 2: ADMIN - LIVE SCORING
// ============================================================

function startEventMatch(data) {
  requireAdmin(data);
  const { event_match_id } = data;
  if (!event_match_id) return error('Thiếu event_match_id');

  const row = findRowByValue('EVENT_MATCHES', 0, event_match_id);
  if (!row) return error('Không tìm thấy trận');

  const sheet = getSheet('EVENT_MATCHES');
  const headers = row.headers;
  sheet.getRange(row.rowNum, headers.indexOf('status') + 1).setValue('ongoing');
  sheet.getRange(row.rowNum, headers.indexOf('score_home') + 1).setValue(0);
  sheet.getRange(row.rowNum, headers.indexOf('score_away') + 1).setValue(0);
  return success({ message: 'Trận đã bắt đầu' });
}

function updateEventScore(data) {
  requireAdmin(data);
  const { event_match_id, score_home, score_away } = data;
  if (!event_match_id) return error('Thiếu event_match_id');

  const row = findRowByValue('EVENT_MATCHES', 0, event_match_id);
  if (!row) return error('Không tìm thấy trận');

  const sheet = getSheet('EVENT_MATCHES');
  const headers = row.headers;
  if (score_home !== undefined) sheet.getRange(row.rowNum, headers.indexOf('score_home') + 1).setValue(Number(score_home));
  if (score_away !== undefined) sheet.getRange(row.rowNum, headers.indexOf('score_away') + 1).setValue(Number(score_away));
  return success({ message: 'Cập nhật tỉ số thành công' });
}

function addMatchEvent(data) {
  requireAdmin(data);
  const { event_match_id, minute, team_id, event_type, player_name, jersey_number, assist_name } = data;
  if (!event_match_id || !event_type) return error('Thiếu dữ liệu sự kiện');

  const eventRowId = generateId('MEV');
  const sheet = getSheet('EVENT_MATCH_EVENTS');
  sheet.appendRow([
    eventRowId, event_match_id,
    Number(minute) || 0,
    team_id || '',
    event_type,
    player_name || '',
    Number(jersey_number) || '',
    assist_name || '',
    nowISO()
  ]);

  // Nếu là bàn thắng hoặc phản lưới → tự động cập nhật tỉ số
  if (event_type === 'goal' || event_type === 'own_goal') {
    const matchRow = findRowByValue('EVENT_MATCHES', 0, event_match_id);
    if (matchRow) {
      const headers = matchRow.headers;
      const matchSheet = getSheet('EVENT_MATCHES');
      const homeTeamId = String(matchRow.data[headers.indexOf('team_home_id')]);
      const awayTeamId = String(matchRow.data[headers.indexOf('team_away_id')]);

      const scoringTeam = String(team_id);
      const isOwnGoal = event_type === 'own_goal';

      // own_goal → điểm cho đội đối lập
      let isHome;
      if (!isOwnGoal) {
        isHome = scoringTeam === homeTeamId;
      } else {
        isHome = scoringTeam === awayTeamId; // own goal by away → home scores
      }

      const scoreCol = isHome ? headers.indexOf('score_home') : headers.indexOf('score_away');
      const currentScore = Number(matchRow.data[scoreCol]) || 0;
      matchSheet.getRange(matchRow.rowNum, scoreCol + 1).setValue(currentScore + 1);
    }
  }

  return success({ event_id_row: eventRowId, message: 'Đã thêm sự kiện' });
}

function removeMatchEvent(data) {
  requireAdmin(data);
  const { event_id_row, undo_score } = data;
  if (!event_id_row) return error('Thiếu event_id_row');

  const sheet = getSheet('EVENT_MATCH_EVENTS');
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(event_id_row)) {
      const eventType = rows[i][headers.indexOf('event_type')];
      const matchId = rows[i][headers.indexOf('event_match_id')];
      const teamId = rows[i][headers.indexOf('team_id')];

      sheet.deleteRow(i + 1);

      // Hoàn tác tỉ số nếu là bàn thắng
      if (undo_score && (eventType === 'goal' || eventType === 'own_goal')) {
        const matchRow = findRowByValue('EVENT_MATCHES', 0, matchId);
        if (matchRow) {
          const mHeaders = matchRow.headers;
          const matchSheet = getSheet('EVENT_MATCHES');
          const homeTeamId = String(matchRow.data[mHeaders.indexOf('team_home_id')]);
          const isOwnGoal = eventType === 'own_goal';
          let isHome;
          if (!isOwnGoal) { isHome = String(teamId) === homeTeamId; }
          else { isHome = String(teamId) !== homeTeamId; }
          const scoreCol = isHome ? mHeaders.indexOf('score_home') : mHeaders.indexOf('score_away');
          const cur = Number(matchRow.data[scoreCol]) || 0;
          matchSheet.getRange(matchRow.rowNum, scoreCol + 1).setValue(Math.max(0, cur - 1));
        }
      }
      return success({ message: 'Đã xóa sự kiện' });
    }
  }
  return error('Không tìm thấy sự kiện');
}

function finishEventMatch(data) {
  requireAdmin(data);
  const { event_match_id } = data;
  if (!event_match_id) return error('Thiếu event_match_id');

  const matchRow = findRowByValue('EVENT_MATCHES', 0, event_match_id);
  if (!matchRow) return error('Không tìm thấy trận');

  const headers = matchRow.headers;
  const sheet = getSheet('EVENT_MATCHES');
  const scoreHome = Number(matchRow.data[headers.indexOf('score_home')]) || 0;
  const scoreAway = Number(matchRow.data[headers.indexOf('score_away')]) || 0;
  const result = scoreHome > scoreAway ? 'H' : scoreAway > scoreHome ? 'A' : 'D';

  sheet.getRange(matchRow.rowNum, headers.indexOf('status') + 1).setValue('completed');
  sheet.getRange(matchRow.rowNum, headers.indexOf('result') + 1).setValue(result);

  // Tự động rebuild standings cho group này
  const eventId = String(matchRow.data[headers.indexOf('event_id')]);
  const groupId = String(matchRow.data[headers.indexOf('group_id')]);
  if (groupId) _rebuildStandings(eventId, groupId);

  return success({ message: 'Kết thúc trận thành công', result });
}

function _rebuildStandings(eventId, groupId) {
  // Lấy tất cả đội trong bảng
  const teams = getSheetData('EVENT_TEAMS').filter(t => t.event_id === eventId && t.group_id === groupId);
  // Lấy tất cả trận đã kết thúc trong bảng
  const matches = getSheetData('EVENT_MATCHES').filter(m =>
    m.event_id === eventId && m.group_id === groupId && m.status === 'completed'
  );

  // Tính stats cho từng đội
  const stats = {};
  teams.forEach(t => {
    stats[t.event_team_id] = { played: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0, goal_diff: 0, points: 0 };
  });

  matches.forEach(m => {
    const h = String(m.team_home_id);
    const a = String(m.team_away_id);
    const sh = Number(m.score_home) || 0;
    const sa = Number(m.score_away) || 0;
    if (!stats[h] || !stats[a]) return;

    stats[h].played++; stats[a].played++;
    stats[h].goals_for += sh; stats[h].goals_against += sa;
    stats[a].goals_for += sa; stats[a].goals_against += sh;
    stats[h].goal_diff = stats[h].goals_for - stats[h].goals_against;
    stats[a].goal_diff = stats[a].goals_for - stats[a].goals_against;

    if (sh > sa) {
      stats[h].wins++; stats[h].points += 3;
      stats[a].losses++;
    } else if (sa > sh) {
      stats[a].wins++; stats[a].points += 3;
      stats[h].losses++;
    } else {
      stats[h].draws++; stats[h].points++;
      stats[a].draws++; stats[a].points++;
    }
  });

  // Sắp xếp theo điểm, hiệu số, bàn thắng
  const sorted = teams.sort((a, b) => {
    const sa2 = stats[a.event_team_id];
    const sb2 = stats[b.event_team_id];
    if (sb2.points !== sa2.points) return sb2.points - sa2.points;
    if (sb2.goal_diff !== sa2.goal_diff) return sb2.goal_diff - sa2.goal_diff;
    return sb2.goals_for - sa2.goals_for;
  });

  // Xóa standings cũ của bảng này
  const standSheet = getSheet('EVENT_STANDINGS');
  const standData = standSheet.getDataRange().getValues();
  const standHeaders = standData[0];
  const eidCol = standHeaders.indexOf('event_id');
  const gidCol = standHeaders.indexOf('group_id');
  const rowsToDelete = [];
  for (let i = 1; i < standData.length; i++) {
    if (String(standData[i][eidCol]) === String(eventId) && String(standData[i][gidCol]) === String(groupId)) {
      rowsToDelete.push(i + 1);
    }
  }
  for (let i = rowsToDelete.length - 1; i >= 0; i--) standSheet.deleteRow(rowsToDelete[i]);

  // Insert standings mới
  const now = nowISO();
  sorted.forEach((team, idx) => {
    const s = stats[team.event_team_id];
    standSheet.appendRow([
      generateId('STD'), eventId, groupId, team.event_team_id,
      idx + 1, s.played, s.wins, s.draws, s.losses,
      s.goals_for, s.goals_against, s.goal_diff, s.points, now
    ]);
  });
}

// ============================================================
// SECTION 3: ADMIN - KNOCKOUT
// ============================================================

function advanceToKnockout(data) {
  requireAdmin(data);
  const { event_id } = data;
  if (!event_id) return error('Thiếu event_id');

  // Lấy event để biết advance_per_group
  const eventRow = findRowByValue('EVENTS', 0, event_id);
  if (!eventRow) return error('Không tìm thấy giải đấu');
  const advancePerGroup = Number(eventRow.data[eventRow.headers.indexOf('advance_per_group')]) || 2;

  // Lấy standings của từng bảng
  const groups = getSheetData('EVENT_GROUPS').filter(g => g.event_id === event_id)
    .sort((a, b) => Number(a.group_order) - Number(b.group_order));
  const standings = getSheetData('EVENT_STANDINGS').filter(s => s.event_id === event_id);

  // Gom standings theo group
  const byGroup = {};
  groups.forEach(g => {
    byGroup[g.group_id] = standings
      .filter(s => s.group_id === g.group_id)
      .sort((a, b) => Number(a.rank) - Number(b.rank))
      .slice(0, advancePerGroup);
  });

  // Suggest cross-pairing: Nhất A vs Nhì B, Nhất B vs Nhì A, ...
  const slots = [];
  const groupList = groups.map(g => ({ ...g, qualifiers: byGroup[g.group_id] || [] }));

  for (let i = 0; i < groupList.length; i += 2) {
    const groupA = groupList[i];
    const groupB = groupList[i + 1];
    if (!groupB) {
      // Số bảng lẻ → slot tự động
      if (groupA.qualifiers[0]) slots.push({ home: groupA.qualifiers[0], away: null, labelHome: `Nhất ${groupA.group_name}`, labelAway: 'TBD' });
      break;
    }
    // Slot 1: Nhất A vs Nhì B
    slots.push({
      home: groupA.qualifiers[0] || null,
      away: groupB.qualifiers[1] || null,
      labelHome: `Nhất ${groupA.group_name}`,
      labelAway: `Nhì ${groupB.group_name}`
    });
    // Slot 2: Nhất B vs Nhì A
    slots.push({
      home: groupB.qualifiers[0] || null,
      away: groupA.qualifiers[1] || null,
      labelHome: `Nhất ${groupB.group_name}`,
      labelAway: `Nhì ${groupA.group_name}`
    });
  }

  // Xác định stage
  const stage = slots.length <= 2 ? 'sf' : slots.length <= 4 ? 'qf' : 'r16';

  // Lưu vào EVENT_KNOCKOUT
  const koSheet = getSheet('EVENT_KNOCKOUT');
  const savedSlots = [];
  slots.forEach((slot, idx) => {
    const koId = generateId('KO');
    koSheet.appendRow([
      koId, event_id, stage, idx + 1,
      slot.home ? slot.home.event_team_id : '',
      slot.away ? slot.away.event_team_id : '',
      slot.labelHome, slot.labelAway,
      '', '', ''
    ]);
    savedSlots.push({ knockout_id: koId, ...slot, stage, slot_number: idx + 1 });
  });

  return success({ slots: savedSlots, stage, message: `Đề xuất ${slots.length} cặp đấu vòng ${stage.toUpperCase()}` });
}

function confirmKnockoutBracket(data) {
  requireAdmin(data);
  const { event_id, slots } = data;
  if (!event_id || !slots) return error('Thiếu dữ liệu');

  const matchSheet = getSheet('EVENT_MATCHES');
  const koSheet = getSheet('EVENT_KNOCKOUT');
  const koData = koSheet.getDataRange().getValues();
  const koHeaders = koData[0];

  const existingMatches = getSheetData('EVENT_MATCHES').filter(m => m.event_id === event_id);
  let matchNumber = existingMatches.length + 1;

  const created = [];
  slots.forEach(slot => {
    if (!slot.team_home_id || !slot.team_away_id) return; // skip incomplete slots
    const matchId = generateId('EMT');
    matchSheet.appendRow([
      matchId, event_id, '', slot.stage || 'qf', 1, matchNumber++,
      slot.team_home_id, slot.team_away_id,
      slot.match_date || '', slot.start_time || '',
      slot.venue || '', 'scheduled', null, null, null, ''
    ]);

    // Update EVENT_KNOCKOUT với event_match_id
    if (slot.knockout_id) {
      for (let i = 1; i < koData.length; i++) {
        if (String(koData[i][0]) === String(slot.knockout_id)) {
          koSheet.getRange(i + 1, koHeaders.indexOf('event_match_id') + 1).setValue(matchId);
          break;
        }
      }
    }
    created.push(matchId);
  });

  // Cập nhật event status
  const eventRow = findRowByValue('EVENTS', 0, event_id);
  if (eventRow) {
    const eSheet = getSheet('EVENTS');
    eSheet.getRange(eventRow.rowNum, eventRow.headers.indexOf('status') + 1).setValue('knockout');
  }

  return success({ matches_created: created, message: `Đã tạo ${created.length} trận knockout` });
}

function advanceKnockoutWinner(data) {
  requireAdmin(data);
  const { knockout_id, winner_team_id } = data;
  if (!knockout_id || !winner_team_id) return error('Thiếu knockout_id hoặc winner_team_id');

  const koSheet = getSheet('EVENT_KNOCKOUT');
  const koData = koSheet.getDataRange().getValues();
  const koHeaders = koData[0];

  let nextKoId = null;
  for (let i = 1; i < koData.length; i++) {
    if (String(koData[i][0]) === String(knockout_id)) {
      koSheet.getRange(i + 1, koHeaders.indexOf('winner_team_id') + 1).setValue(winner_team_id);
      nextKoId = koData[i][koHeaders.indexOf('next_knockout_id')];
      break;
    }
  }

  // Điền đội vào slot tiếp theo
  if (nextKoId) {
    for (let i = 1; i < koData.length; i++) {
      if (String(koData[i][0]) === String(nextKoId)) {
        const homeTeam = koData[i][koHeaders.indexOf('team_home_id')];
        if (!homeTeam) {
          koSheet.getRange(i + 1, koHeaders.indexOf('team_home_id') + 1).setValue(winner_team_id);
        } else {
          koSheet.getRange(i + 1, koHeaders.indexOf('team_away_id') + 1).setValue(winner_team_id);
        }
        break;
      }
    }
  }

  return success({ message: 'Đã cập nhật kết quả knockout', next_knockout_id: nextKoId });
}

// ============================================================
// SECTION 4: PUBLIC - READ
// ============================================================

function getEvents(data) {
  requireAuth(data);
  const { status } = data;
  let events = getSheetData('EVENTS');
  if (status) events = events.filter(e => e.status === status);
  events.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  return success({ events });
}

function getEventDetail(data) {
  requireAuth(data);
  const { event_id } = data;
  if (!event_id) return error('Thiếu event_id');

  const eventRow = findRowByValue('EVENTS', 0, event_id);
  if (!eventRow) return error('Không tìm thấy giải đấu');

  const eventObj = {};
  eventRow.headers.forEach((h, i) => { eventObj[h] = eventRow.data[i]; });

  const groups = getSheetData('EVENT_GROUPS').filter(g => g.event_id === event_id)
    .sort((a, b) => Number(a.group_order) - Number(b.group_order));
  const teams = getSheetData('EVENT_TEAMS').filter(t => t.event_id === event_id);
  const standings = getSheetData('EVENT_STANDINGS').filter(s => s.event_id === event_id);

  return success({ event: eventObj, groups, teams, standings });
}

function getGroupStandings(data) {
  requireAuth(data);
  const { event_id, group_id } = data;
  if (!event_id) return error('Thiếu event_id');

  let standings = getSheetData('EVENT_STANDINGS').filter(s => s.event_id === event_id);
  if (group_id) standings = standings.filter(s => s.group_id === group_id);
  standings.sort((a, b) => Number(a.rank) - Number(b.rank));

  const teams = getSheetData('EVENT_TEAMS').filter(t => t.event_id === event_id);
  return success({ standings, teams });
}

function getEventSchedule(data) {
  requireAuth(data);
  const { event_id, group_id } = data;
  if (!event_id) return error('Thiếu event_id');

  let matches = getSheetData('EVENT_MATCHES').filter(m => m.event_id === event_id);
  if (group_id) matches = matches.filter(m => m.group_id === group_id);
  matches.sort((a, b) => {
    const rd = Number(a.round_number) - Number(b.round_number);
    return rd !== 0 ? rd : Number(a.match_number) - Number(b.match_number);
  });

  const teams = getSheetData('EVENT_TEAMS').filter(t => t.event_id === event_id);
  const groups = getSheetData('EVENT_GROUPS').filter(g => g.event_id === event_id);
  return success({ matches, teams, groups });
}

function getEventMatchDetail(data) {
  requireAuth(data);
  const { event_match_id } = data;
  if (!event_match_id) return error('Thiếu event_match_id');

  const matchRow = findRowByValue('EVENT_MATCHES', 0, event_match_id);
  if (!matchRow) return error('Không tìm thấy trận');

  const match = {};
  matchRow.headers.forEach((h, i) => { match[h] = matchRow.data[i]; });

  const events = getSheetData('EVENT_MATCH_EVENTS')
    .filter(e => e.event_match_id === event_match_id)
    .sort((a, b) => Number(a.minute) - Number(b.minute));

  const teams = getSheetData('EVENT_TEAMS').filter(
    t => t.event_id === match.event_id
  );

  return success({ match, events, teams });
}

function getTopScorers(data) {
  requireAuth(data);
  const { event_id } = data;
  if (!event_id) return error('Thiếu event_id');

  // Lấy tất cả trận của event
  const matchIds = getSheetData('EVENT_MATCHES')
    .filter(m => m.event_id === event_id)
    .map(m => m.event_match_id);

  const teams = getSheetData('EVENT_TEAMS').filter(t => t.event_id === event_id);
  const teamMap = {};
  teams.forEach(t => { teamMap[t.event_team_id] = t.team_name; });

  // Tổng hợp bàn thắng theo tên cầu thủ + đội
  const scorerMap = {};
  getSheetData('EVENT_MATCH_EVENTS')
    .filter(e => matchIds.includes(e.event_match_id) && e.event_type === 'goal')
    .forEach(e => {
      const key = `${e.player_name}||${e.team_id}`;
      if (!scorerMap[key]) scorerMap[key] = { player_name: e.player_name, team_id: e.team_id, team_name: teamMap[e.team_id] || '', goals: 0, jersey_number: e.jersey_number };
      scorerMap[key].goals++;
    });

  const scorers = Object.values(scorerMap).sort((a, b) => b.goals - a.goals);
  return success({ scorers });
}

function getKnockoutBracket(data) {
  requireAuth(data);
  const { event_id } = data;
  if (!event_id) return error('Thiếu event_id');

  const slots = getSheetData('EVENT_KNOCKOUT').filter(k => k.event_id === event_id);
  const teams = getSheetData('EVENT_TEAMS').filter(t => t.event_id === event_id);
  const matches = getSheetData('EVENT_MATCHES').filter(m => m.event_id === event_id && m.stage !== 'group');

  return success({ slots, teams, matches });
}

function getLiveMatch(data) {
  requireAuth(data);
  const { event_id, event_match_id } = data;

  let matches;
  if (event_match_id) {
    matches = getSheetData('EVENT_MATCHES').filter(m => m.event_match_id === event_match_id);
  } else if (event_id) {
    matches = getSheetData('EVENT_MATCHES').filter(m => m.event_id === event_id && m.status === 'ongoing');
  } else {
    return error('Thiếu event_id hoặc event_match_id');
  }

  if (!matches.length) return success({ match: null });
  const match = matches[0];

  const events = getSheetData('EVENT_MATCH_EVENTS')
    .filter(e => e.event_match_id === match.event_match_id)
    .sort((a, b) => Number(a.minute) - Number(b.minute));

  return success({ match, events });
}
