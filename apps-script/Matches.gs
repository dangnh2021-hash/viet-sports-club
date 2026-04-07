// ============================================================
// Matches.gs - Quản lý lịch thi đấu, vote tham gia, đội khách
// ============================================================

// ---- MATCHES CRUD ----

function createMatch(data) {
  const admin = requireAdmin(data);
  const { match_date, start_time, end_time, venue_name, venue_address,
          num_players_per_team, num_teams, notes, voting_deadline } = data;

  if (!match_date || !start_time || !venue_name) return error('Thiếu thông tin bắt buộc');

  const numPPT = Number(num_players_per_team) || 5;
  const numTeams = Number(num_teams) || 2;
  const format = `${numPPT}v${numPPT}`;

  const matchId = generateId('MTH');
  const row = [
    matchId,
    match_date,
    start_time,
    end_time || '',
    venue_name,
    venue_address || '',
    numPPT,
    numTeams,
    format,
    'scheduled',
    notes || '',
    admin.user_id,
    nowISO(),
    voting_deadline || ''
  ];

  getSheet('MATCHES').appendRow(row);
  return success({ match_id: matchId, message: 'Tạo lịch thi đấu thành công' });
}

function getMatches(data) {
  requireAuth(data);
  const matches = getSheetData('MATCHES');

  // Sắp xếp theo ngày mới nhất
  matches.sort((a, b) => new Date(b.match_date) - new Date(a.match_date));
  return success({ matches });
}

function getUpcomingMatches(data) {
  requireAuth(data);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const matches = getSheetData('MATCHES')
    .filter(m => new Date(m.match_date) >= today && m.status !== 'cancelled')
    .sort((a, b) => new Date(a.match_date) - new Date(b.match_date));

  return success({ matches });
}

function updateMatch(data) {
  const admin = requireAdmin(data);
  const { match_id, updates } = data;
  if (!match_id) return error('Thiếu match_id');

  const row = findRowByValue('MATCHES', 0, match_id);
  if (!row) return error('Không tìm thấy trận đấu');

  const sheet = getSheet('MATCHES');
  const headers = row.headers;
  const allowedFields = ['match_date', 'start_time', 'end_time', 'venue_name', 'venue_address',
                          'num_players_per_team', 'num_teams', 'match_format', 'status',
                          'notes', 'voting_deadline'];

  allowedFields.forEach(field => {
    if (updates[field] !== undefined) {
      sheet.getRange(row.rowNum, headers.indexOf(field) + 1).setValue(updates[field]);
    }
  });

  return success({ message: 'Cập nhật trận đấu thành công' });
}

function deleteMatch(data) {
  requireAdmin(data);
  const { match_id } = data;
  const row = findRowByValue('MATCHES', 0, match_id);
  if (!row) return error('Không tìm thấy trận đấu');

  getSheet('MATCHES').deleteRow(row.rowNum);
  return success({ message: 'Đã xóa trận đấu' });
}

function getMatchDetail(data) {
  requireAuth(data);
  const { match_id } = data;
  if (!match_id) return error('Thiếu match_id');

  const row = findRowByValue('MATCHES', 0, match_id);
  if (!row) return error('Không tìm thấy trận đấu');

  const matchObj = {};
  row.headers.forEach((h, i) => { matchObj[h] = serializeValue(row.data[i], h); });

  // Lấy thêm attendance + enrich với thông tin user
  const rawAttendance = getSheetData('MATCH_ATTENDANCE')
    .filter(a => a.match_id === match_id);

  const users = getSheetData('USERS');
  const userMap = {};
  users.forEach(u => { userMap[u.user_id] = u; });

  const attendance = rawAttendance.map(a => {
    const u = userMap[a.user_id] || {};
    return {
      ...a,
      full_name: u.full_name || u.username || 'Ẩn danh',
      positions: u.positions || '',
      overall_rating: u.overall_rating || 0
    };
  });

  // Lấy thêm teams
  const teams = getSheetData('MATCH_TEAMS')
    .filter(t => t.match_id === match_id);

  // Lấy đội khách
  const guestTeams = getSheetData('GUEST_TEAMS')
    .filter(g => g.match_id === match_id);

  // Lấy kết quả
  const results = getSheetData('MATCH_RESULTS')
    .filter(r => r.match_id === match_id)
    .sort((a, b) => a.round_number - b.round_number);

  return success({ match: matchObj, attendance, teams, guestTeams, results });
}

// ---- ATTENDANCE / VOTE ----

function vote(data) {
  const user = requireAuth(data);
  const { match_id, vote_status, note } = data;

  if (!match_id || !vote_status) return error('Thiếu thông tin vote');
  if (!['YES', 'NO', 'MAYBE'].includes(vote_status)) return error('Vote không hợp lệ (YES/NO/MAYBE)');

  // Kiểm tra trận tồn tại
  const matchRow = findRowByValue('MATCHES', 0, match_id);
  if (!matchRow) return error('Không tìm thấy trận đấu');

  const sheet = getSheet('MATCH_ATTENDANCE');
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const matchIdCol = headers.indexOf('match_id');
  const userIdCol = headers.indexOf('user_id');

  // Tìm vote cũ
  for (let i = 1; i < allData.length; i++) {
    if (allData[i][matchIdCol] === match_id && allData[i][userIdCol] === user.user_id) {
      // Cập nhật vote cũ
      sheet.getRange(i + 1, headers.indexOf('vote_status') + 1).setValue(vote_status);
      sheet.getRange(i + 1, headers.indexOf('note') + 1).setValue(note || '');
      sheet.getRange(i + 1, headers.indexOf('updated_at') + 1).setValue(nowISO());
      return success({ message: `Đã cập nhật vote: ${vote_status}` });
    }
  }

  // Tạo vote mới
  const attId = generateId('ATT');
  sheet.appendRow([
    attId, match_id, user.user_id, vote_status,
    note || '', nowISO(), nowISO()
  ]);
  return success({ message: `Đã vote: ${vote_status}`, attendance_id: attId });
}

function getAttendance(data) {
  requireAuth(data);
  const { match_id } = data;
  if (!match_id) return error('Thiếu match_id');

  const attendance = getSheetData('MATCH_ATTENDANCE')
    .filter(a => a.match_id === match_id);

  // Enrich với thông tin user
  const users = getSheetData('USERS');
  const userMap = {};
  users.forEach(u => { userMap[u.user_id] = u; });

  const enriched = attendance.map(a => {
    const u = userMap[a.user_id] || {};
    return {
      ...a,
      full_name: u.full_name || u.username || 'Ẩn danh',
      positions: u.positions || '',
      overall_rating: u.overall_rating || 0,
      rating_points: u.rating_points || 1000
    };
  });

  const summary = {
    yes: enriched.filter(a => a.vote_status === 'YES').length,
    no: enriched.filter(a => a.vote_status === 'NO').length,
    maybe: enriched.filter(a => a.vote_status === 'MAYBE').length
  };

  return success({ attendance: enriched, summary });
}

function getMyVote(data) {
  const user = requireAuth(data);
  const { match_id } = data;

  const att = getSheetData('MATCH_ATTENDANCE')
    .find(a => a.match_id === match_id && a.user_id === user.user_id);

  return success({ vote: att || null });
}

// ---- GUEST TEAMS ----

function addGuestTeam(data) {
  requireAdmin(data);
  const { team_name, representative_name, contact_phone, match_id, notes } = data;
  if (!team_name) return error('Thiếu tên đội');

  const guestId = generateId('GST');
  getSheet('GUEST_TEAMS').appendRow([
    guestId, team_name, representative_name || '', contact_phone || '',
    match_id || '', notes || '', nowISO()
  ]);

  // Tự động thêm vào MATCH_TEAMS để xuất hiện trong formation + live + vòng tròn
  let teamId = null;
  if (match_id) {
    teamId = generateId('TMT');
    const existingTeams = getSheetData('MATCH_TEAMS').filter(t => t.match_id === match_id);
    const GUEST_COLORS = ['#8B5CF6', '#EC4899', '#10B981', '#F97316', '#06B6D4'];
    const color = GUEST_COLORS[existingTeams.length % GUEST_COLORS.length];
    getSheet('MATCH_TEAMS').appendRow([
      teamId, match_id, team_name, color, 'guest', guestId, '', 0, 0, 0, 0, nowISO()
    ]);
  }

  return success({ guest_team_id: guestId, team_id: teamId, message: 'Đã thêm đội khách mời' });
}

function getGuestTeams(data) {
  requireAuth(data);
  const { match_id } = data;
  let teams = getSheetData('GUEST_TEAMS');
  if (match_id) teams = teams.filter(t => t.match_id === match_id);
  return success({ guest_teams: teams });
}

function deleteGuestTeam(data) {
  requireAdmin(data);
  const { guest_team_id } = data;
  const row = findRowByValue('GUEST_TEAMS', 0, guest_team_id);
  if (!row) return error('Không tìm thấy đội khách');

  // Xóa MATCH_TEAMS entry tương ứng
  const matchTeams = getSheetData('MATCH_TEAMS');
  matchTeams.forEach(t => {
    if (String(t.guest_team_id) === String(guest_team_id)) {
      const tRow = findRowByValue('MATCH_TEAMS', 0, t.team_id);
      if (tRow) getSheet('MATCH_TEAMS').deleteRow(tRow.rowNum);
    }
  });

  getSheet('GUEST_TEAMS').deleteRow(row.rowNum);
  return success({ message: 'Đã xóa đội khách' });
}
