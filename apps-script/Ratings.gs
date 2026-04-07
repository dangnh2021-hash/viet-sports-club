// ============================================================
// Ratings.gs - Hệ thống ELO Rating và cập nhật chỉ số
// ============================================================

// K-factor cho ELO
const K_FACTOR = 30;

// Điểm thưởng cố định
const BONUS = {
  goal: 3,
  assist: 2,
  clean_sheet: 5,
  mvp: 10
};

// ---- ELO Calculation ----

/**
 * Tính điểm kỳ vọng của team A vs team B
 * rA, rB: avg rating của 2 đội
 */
function expectedScore(rA, rB) {
  return 1 / (1 + Math.pow(10, (rB - rA) / 400));
}

/**
 * Cập nhật ELO sau kết quả 1 trận cụ thể
 * homeScore > awayScore → home win
 */
function updatePlayerELO(match_id, homeTeamId, awayTeamId, homeScore, awayScore) {
  const players = getSheetData('TEAM_PLAYERS').filter(p => p.match_id === match_id);
  const users = getSheetData('USERS');
  const userMap = {};
  users.forEach(u => { userMap[u.user_id] = u; });

  const homePlayers = players.filter(p => p.team_id === homeTeamId && p.user_id);
  const awayPlayers = players.filter(p => p.team_id === awayTeamId && p.user_id);

  if (homePlayers.length === 0 && awayPlayers.length === 0) return;

  // Tính avg rating của 2 đội
  const homeAvg = homePlayers.length > 0 ?
    homePlayers.reduce((s, p) => s + (Number(userMap[p.user_id]?.rating_points) || 1000), 0) / homePlayers.length : 1000;
  const awayAvg = awayPlayers.length > 0 ?
    awayPlayers.reduce((s, p) => s + (Number(userMap[p.user_id]?.rating_points) || 1000), 0) / awayPlayers.length : 1000;

  const homeExpected = expectedScore(homeAvg, awayAvg);
  const awayExpected = 1 - homeExpected;

  // Xác định kết quả thực tế
  const hs = Number(homeScore) || 0;
  const as_ = Number(awayScore) || 0;
  let homeActual, awayActual;

  if (hs > as_) {
    homeActual = 1;   // home win
    awayActual = 0;
  } else if (hs < as_) {
    homeActual = 0;   // away win
    awayActual = 1;
  } else {
    homeActual = 0.5; // draw
    awayActual = 0.5;
  }

  // Xác định loại thay đổi
  const homeChangeType = homeActual === 1 ? 'match_win' : homeActual === 0 ? 'match_loss' : 'match_draw';
  const awayChangeType = awayActual === 1 ? 'match_win' : awayActual === 0 ? 'match_loss' : 'match_draw';

  // Cập nhật cho từng cầu thủ đội nhà
  homePlayers.forEach(p => {
    const u = userMap[p.user_id];
    if (!u) return;
    const oldRating = Number(u.rating_points) || 1000;
    const eloChange = Math.round(K_FACTOR * (homeActual - homeExpected));
    applyRatingChange(p.user_id, match_id, '', homeChangeType, eloChange, oldRating);

    // Bonus bàn thắng, kiến tạo
    applyGoalAssistBonus(p, match_id);

    // Cập nhật thống kê trận
    updateMatchStats(p.user_id, homeActual);
  });

  // Cập nhật cho từng cầu thủ đội khách
  awayPlayers.forEach(p => {
    const u = userMap[p.user_id];
    if (!u) return;
    const oldRating = Number(u.rating_points) || 1000;
    const eloChange = Math.round(K_FACTOR * (awayActual - awayExpected));
    applyRatingChange(p.user_id, match_id, '', awayChangeType, eloChange, oldRating);

    applyGoalAssistBonus(p, match_id);
    updateMatchStats(p.user_id, awayActual);
  });

  // Clean sheet bonus (GK và DF bên nào không thủng lưới)
  if (hs === 0) {
    // Away team không bị thủng lưới
    awayPlayers
      .filter(p => p.position_played === 'GK' || p.position_played === 'DF')
      .forEach(p => {
        const u = userMap[p.user_id];
        if (!u) return;
        const oldRating = Number(u.rating_points) || 1000;
        applyRatingChange(p.user_id, match_id, '', 'clean_sheet', BONUS.clean_sheet, oldRating + BONUS.clean_sheet);
      });
  }
  if (as_ === 0) {
    // Home team không bị thủng lưới
    homePlayers
      .filter(p => p.position_played === 'GK' || p.position_played === 'DF')
      .forEach(p => {
        const u = userMap[p.user_id];
        if (!u) return;
        const oldRating = Number(u.rating_points) || 1000;
        applyRatingChange(p.user_id, match_id, '', 'clean_sheet', BONUS.clean_sheet, oldRating + BONUS.clean_sheet);
      });
  }
}

function applyGoalAssistBonus(player, match_id) {
  const goals = Number(player.goals_scored) || 0;
  const assists = Number(player.assists) || 0;
  if (goals === 0 && assists === 0) return;

  const u = getSheetData('USERS').find(u => u.user_id === player.user_id);
  if (!u) return;

  const oldRating = Number(u.rating_points) || 1000;
  const bonus = goals * BONUS.goal + assists * BONUS.assist;
  if (bonus > 0) {
    applyRatingChange(player.user_id, match_id, '', 'goal_assist_bonus', bonus, oldRating);
  }
}

/**
 * Áp dụng thay đổi rating và ghi lịch sử
 */
function applyRatingChange(userId, matchId, resultId, changeType, pointsChange, ratingBefore) {
  // Lấy rating hiện tại
  const userRow = findRowByValue('USERS', 0, userId);
  if (!userRow) return;

  const currentRating = Number(userRow.data[userRow.headers.indexOf('rating_points')]) || 1000;
  const ratingAfter = Math.max(0, currentRating + pointsChange);

  // Cập nhật rating trong USERS
  const sheet = getSheet('USERS');
  sheet.getRange(userRow.rowNum, userRow.headers.indexOf('rating_points') + 1).setValue(ratingAfter);

  // Ghi lịch sử
  const historyId = generateId('HIS');
  const desc = buildChangeDescription(changeType, pointsChange);
  getSheet('RATING_HISTORY').appendRow([
    historyId, userId, matchId, resultId,
    changeType, pointsChange, currentRating, ratingAfter,
    desc, nowISO()
  ]);
}

function buildChangeDescription(type, points) {
  const sign = points >= 0 ? '+' : '';
  const map = {
    'match_win': `Thắng trận (${sign}${points})`,
    'match_loss': `Thua trận (${sign}${points})`,
    'match_draw': `Hòa (${sign}${points})`,
    'goal_assist_bonus': `Bàn thắng/Kiến tạo (+${points})`,
    'clean_sheet': `Không thủng lưới (+${points})`,
    'mvp': `Cầu thủ xuất sắc (+${points})`,
    'admin_adjust': `Admin điều chỉnh (${sign}${points})`
  };
  return map[type] || `${type} (${sign}${points})`;
}

function updateMatchStats(userId, result) {
  const row = findRowByValue('USERS', 0, userId);
  if (!row) return;

  const sheet = getSheet('USERS');
  const headers = row.headers;

  const matchesCol = headers.indexOf('total_matches');
  const winsCol = headers.indexOf('total_wins');
  const lossesCol = headers.indexOf('total_losses');
  const drawsCol = headers.indexOf('total_draws');

  sheet.getRange(row.rowNum, matchesCol + 1).setValue((row.data[matchesCol] || 0) + 1);
  if (result === 1) sheet.getRange(row.rowNum, winsCol + 1).setValue((row.data[winsCol] || 0) + 1);
  else if (result === 0) sheet.getRange(row.rowNum, lossesCol + 1).setValue((row.data[lossesCol] || 0) + 1);
  else sheet.getRange(row.rowNum, drawsCol + 1).setValue((row.data[drawsCol] || 0) + 1);
}

function updateUserGoalStats(userId, goals, assists) {
  const row = findRowByValue('USERS', 0, userId);
  if (!row) return;

  const sheet = getSheet('USERS');
  const headers = row.headers;
  const goalsCol = headers.indexOf('total_goals');
  const assistsCol = headers.indexOf('total_assists');

  sheet.getRange(row.rowNum, goalsCol + 1).setValue((row.data[goalsCol] || 0) + Number(goals));
  sheet.getRange(row.rowNum, assistsCol + 1).setValue((row.data[assistsCol] || 0) + Number(assists));
}

// ---- MVP Award ----

function awardMVP(data) {
  const admin = requireAdmin(data);
  const { user_id, match_id } = data;
  if (!user_id || !match_id) return error('Thiếu thông tin');

  const u = getSheetData('USERS').find(u => u.user_id === user_id);
  if (!u) return error('Không tìm thấy user');

  applyRatingChange(user_id, match_id, '', 'mvp', BONUS.mvp, Number(u.rating_points));
  return success({ message: `Đã trao MVP cho ${u.full_name} (+${BONUS.mvp} điểm)` });
}

// ---- Admin manual adjust ----

function adminAdjustRating(data) {
  const admin = requireAdmin(data);
  const { user_id, points_change, reason } = data;
  if (!user_id || points_change === undefined) return error('Thiếu thông tin');

  const u = getSheetData('USERS').find(u => u.user_id === user_id);
  if (!u) return error('Không tìm thấy user');

  applyRatingChange(user_id, '', '', 'admin_adjust', Number(points_change), Number(u.rating_points));
  return success({ message: `Đã điều chỉnh ${points_change > 0 ? '+' : ''}${points_change} điểm` });
}

// ---- Leaderboard ----

function getLeaderboard(data) {
  requireAuth(data);
  const users = getSheetData('USERS')
    .filter(u => u.status === 'active')
    .map(u => ({
      user_id: u.user_id,
      full_name: u.full_name,
      positions: u.positions,
      overall_rating: u.overall_rating,
      rating_points: u.rating_points,
      total_matches: u.total_matches,
      total_wins: u.total_wins,
      total_losses: u.total_losses,
      total_draws: u.total_draws,
      total_goals: u.total_goals,
      total_assists: u.total_assists,
      avatar_url: u.avatar_url,
      win_rate: u.total_matches > 0 ?
        Math.round((u.total_wins / u.total_matches) * 100) : 0
    }))
    .sort((a, b) => b.rating_points - a.rating_points);

  return success({ leaderboard: users });
}

function getRatingHistory(data) {
  requireAuth(data);
  const { user_id, limit } = data;
  const targetId = user_id || requireAuth(data).user_id;

  let history = getSheetData('RATING_HISTORY')
    .filter(h => h.user_id === targetId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (limit) history = history.slice(0, Number(limit));
  return success({ history });
}
