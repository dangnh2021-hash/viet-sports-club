// ============================================================
// Teams.gs - Thuật toán xếp đội, lưu/lấy đội hình, kết quả
// ============================================================

// ---- TEAM SUGGESTION ALGORITHM ----

function suggestTeams(data) {
  const admin = requireAdmin(data);
  const { match_id } = data;
  if (!match_id) return error('Thiếu match_id');

  // Lấy match info
  const matchRow = findRowByValue('MATCHES', 0, match_id);
  if (!matchRow) return error('Không tìm thấy trận đấu');
  const matchObj = {};
  matchRow.headers.forEach((h, i) => { matchObj[h] = matchRow.data[i]; });

  const numTeams = Number(matchObj.num_teams) || 2;
  const numPPT = Number(matchObj.num_players_per_team) || 5;

  // Lấy danh sách user vote YES
  const attendance = getSheetData('MATCH_ATTENDANCE')
    .filter(a => a.match_id === match_id && a.vote_status === 'YES');

  if (attendance.length < 2) return error('Cần ít nhất 2 người vote YES');

  // Lấy thông tin từng user
  const users = getSheetData('USERS');
  const userMap = {};
  users.forEach(u => { userMap[u.user_id] = u; });

  let players = attendance.map(a => {
    const u = userMap[a.user_id];
    if (!u) return null;
    const positions = String(u.positions || 'FW').split(',').map(p => p.trim());
    const primaryPos = positions[0] || 'MF';
    const overall = Number(u.overall_rating) || 50;

    return {
      user_id: u.user_id,
      full_name: u.full_name,
      positions,
      primary_position: primaryPos,
      overall_rating: overall,
      rating_points: Number(u.rating_points) || 1000
    };
  }).filter(Boolean);

  // Tách GK ra trước nếu có
  const gkPlayers = players.filter(p => p.positions.includes('GK'));
  const fieldPlayers = players.filter(p => !p.positions.includes('GK') || p.positions.length > 1);

  // Sort theo overall_rating giảm dần
  fieldPlayers.sort((a, b) => b.overall_rating - a.overall_rating);
  gkPlayers.sort((a, b) => b.overall_rating - a.overall_rating);

  const TEAM_NAMES = ['Đội Đỏ', 'Đội Xanh', 'Đội Vàng', 'Đội Trắng'];
  const TEAM_COLORS = ['#EF4444', '#3B82F6', '#F59E0B', '#6B7280'];

  const teams = Array.from({ length: numTeams }, (_, i) => ({
    name: TEAM_NAMES[i],
    color: TEAM_COLORS[i],
    players: [],
    totalRating: 0
  }));

  // Bước 1: Phân bổ GK (1 GK cho mỗi đội nếu có)
  gkPlayers.forEach((gk, i) => {
    if (i < numTeams) {
      teams[i].players.push({ ...gk, assigned_position: 'GK' });
      teams[i].totalRating += gk.overall_rating;
    } else {
      // GK thừa thêm vào như field player
      fieldPlayers.push(gk);
    }
  });

  // Bước 2: Snake Draft cho field players
  fieldPlayers.sort((a, b) => b.overall_rating - a.overall_rating);
  fieldPlayers.forEach((player, i) => {
    const round = Math.floor(i / numTeams);
    const posInRound = i % numTeams;
    const teamIdx = round % 2 === 0 ? posInRound : (numTeams - 1 - posInRound);
    const assignedPos = player.positions.find(p => p !== 'GK') || player.primary_position;
    teams[teamIdx].players.push({ ...player, assigned_position: assignedPos });
    teams[teamIdx].totalRating += player.overall_rating;
  });

  // Bước 3: Tối ưu hóa nếu chênh lệch > 5 điểm (chỉ áp dụng cho 2 đội)
  if (numTeams === 2) {
    teams[0].avgRating = teams[0].players.length > 0 ?
      teams[0].totalRating / teams[0].players.length : 0;
    teams[1].avgRating = teams[1].players.length > 0 ?
      teams[1].totalRating / teams[1].players.length : 0;

    let diff = Math.abs(teams[0].avgRating - teams[1].avgRating);
    let iterations = 0;

    while (diff > 5 && iterations < 20) {
      let bestSwap = null;
      let bestDiff = diff;

      for (let p1 = 0; p1 < teams[0].players.length; p1++) {
        for (let p2 = 0; p2 < teams[1].players.length; p2++) {
          const a1 = teams[0].players[p1];
          const a2 = teams[1].players[p2];
          if (!a1 || !a2) continue;

          const newTotal0 = teams[0].totalRating - a1.overall_rating + a2.overall_rating;
          const newTotal1 = teams[1].totalRating - a2.overall_rating + a1.overall_rating;
          const newAvg0 = newTotal0 / teams[0].players.length;
          const newAvg1 = newTotal1 / teams[1].players.length;
          const newDiff = Math.abs(newAvg0 - newAvg1);

          if (newDiff < bestDiff) {
            bestDiff = newDiff;
            bestSwap = { p1, p2 };
          }
        }
      }

      if (bestSwap) {
        const tmp = teams[0].players[bestSwap.p1];
        teams[0].players[bestSwap.p1] = teams[1].players[bestSwap.p2];
        teams[1].players[bestSwap.p2] = tmp;

        teams[0].totalRating = teams[0].players.reduce((s, p) => s + p.overall_rating, 0);
        teams[1].totalRating = teams[1].players.reduce((s, p) => s + p.overall_rating, 0);
        teams[0].avgRating = teams[0].totalRating / teams[0].players.length;
        teams[1].avgRating = teams[1].totalRating / teams[1].players.length;
        diff = bestDiff;
      } else {
        break;
      }
      iterations++;
    }
  }

  // Tính avgRating cho tất cả teams
  teams.forEach(t => {
    t.avgRating = t.players.length > 0 ?
      Math.round(t.totalRating / t.players.length) : 0;
    t.playerCount = t.players.length;
  });

  return success({
    teams,
    totalPlayers: players.length,
    numTeams,
    numPPT,
    balanceScore: numTeams === 2 ?
      Math.abs(teams[0].avgRating - (teams[1] ? teams[1].avgRating : 0)) : null
  });
}

// ---- SAVE TEAMS ----

function saveTeams(data) {
  const admin = requireAdmin(data);
  const { match_id, teams } = data;
  if (!match_id || !teams) return error('Thiếu dữ liệu');

  const teamsSheet = getSheet('MATCH_TEAMS');
  const playersSheet = getSheet('TEAM_PLAYERS');

  // Xóa đội hình cũ của trận này
  deleteTeamsOfMatch(match_id);

  const savedTeamIds = [];

  teams.forEach(team => {
    const teamId = generateId('TMT');
    savedTeamIds.push(teamId);

    teamsSheet.appendRow([
      teamId,
      match_id,
      team.name || 'Đội',
      team.color || '#666666',
      team.team_type || 'internal',
      team.guest_team_id || '',
      team.formation || '',
      0, 0, 0, 0,
      nowISO()
    ]);

    // Lưu danh sách cầu thủ
    (team.players || []).forEach((player, idx) => {
      const playerId = generateId('TMP');
      playersSheet.appendRow([
        playerId,
        teamId,
        match_id,
        player.user_id || '',
        player.guest_player_name || '',
        player.assigned_position || player.position_played || 'MF',
        idx + 1,        // jersey_number
        idx === 0,      // is_captain (đầu tiên = đội trưởng)
        0, 0, 0, 0, 0  // goals, assists, cards, rating
      ]);
    });
  });

  return success({ message: 'Đã lưu đội hình', team_ids: savedTeamIds });
}

function deleteTeamsOfMatch(match_id) {
  // Xóa MATCH_TEAMS — chỉ xóa internal teams, giữ lại guest teams
  const teamsSheet = getSheet('MATCH_TEAMS');
  const teamsData = teamsSheet.getDataRange().getValues();
  const headers = teamsData[0];
  const tMatchCol = headers.indexOf('match_id');
  const tTypeCol = headers.indexOf('team_type');

  const deletedTeamIds = [];
  for (let i = teamsData.length - 1; i >= 1; i--) {
    if (teamsData[i][tMatchCol] === match_id && teamsData[i][tTypeCol] !== 'guest') {
      deletedTeamIds.push(teamsData[i][0]);
      teamsSheet.deleteRow(i + 1);
    }
  }

  // Xóa TEAM_PLAYERS chỉ cho các internal team đã xóa
  const playersSheet = getSheet('TEAM_PLAYERS');
  const playersData = playersSheet.getDataRange().getValues();
  const pMatchCol = playersData[0].indexOf('match_id');
  const pTeamCol = playersData[0].indexOf('team_id');

  for (let i = playersData.length - 1; i >= 1; i--) {
    if (playersData[i][pMatchCol] === match_id &&
        deletedTeamIds.includes(String(playersData[i][pTeamCol]))) {
      playersSheet.deleteRow(i + 1);
    }
  }
}

function getTeams(data) {
  requireAuth(data);
  const { match_id } = data;
  if (!match_id) return error('Thiếu match_id');

  const teams = getSheetData('MATCH_TEAMS').filter(t => t.match_id === match_id);
  const players = getSheetData('TEAM_PLAYERS').filter(p => p.match_id === match_id);

  // Enrich players với user info
  const users = getSheetData('USERS');
  const userMap = {};
  users.forEach(u => { userMap[u.user_id] = u; });

  const enrichedTeams = teams.map(team => {
    const teamPlayers = players
      .filter(p => p.team_id === team.team_id)
      .map(p => {
        const u = userMap[p.user_id] || {};
        return {
          ...p,
          full_name: u.full_name || p.guest_player_name || 'Unknown',
          overall_rating: u.overall_rating || 0,
          positions: u.positions || '',
          avatar_url: u.avatar_url || ''
        };
      });
    return { ...team, players: teamPlayers };
  });

  return success({ teams: enrichedTeams });
}

// ---- MATCH RESULTS ----

function saveMatchResult(data) {
  const admin = requireAdmin(data);
  const { match_id, result_id, round_number, team_home_id, team_away_id, score_home, score_away,
          scorers, status } = data;

  if (!match_id) return error('Thiếu match_id');

  const sheet = getSheet('MATCH_RESULTS');
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const resultIdCol = headers.indexOf('result_id');

  // Tìm theo result_id (ưu tiên) hoặc theo cặp đội
  let foundRow = -1;
  if (result_id) {
    for (let i = 1; i < allData.length; i++) {
      if (String(allData[i][resultIdCol]) === String(result_id)) {
        foundRow = i;
        break;
      }
    }
  }

  if (foundRow > 0) {
    // Chỉ update scorers, không update score/status
    if (status === 'update_scorers') {
      updateScorers(match_id, scorers || []);
      return success({ message: 'Đã cập nhật thống kê', result_id });
    }

    // Cập nhật kết quả
    sheet.getRange(foundRow + 1, headers.indexOf('score_home') + 1).setValue(Number(score_home) || 0);
    sheet.getRange(foundRow + 1, headers.indexOf('score_away') + 1).setValue(Number(score_away) || 0);
    sheet.getRange(foundRow + 1, headers.indexOf('status') + 1).setValue(status || 'completed');
    sheet.getRange(foundRow + 1, headers.indexOf('ended_at') + 1).setValue(nowISO());

    const actualHomeId = team_home_id || String(allData[foundRow][headers.indexOf('team_home_id')]);
    const actualAwayId = team_away_id || String(allData[foundRow][headers.indexOf('team_away_id')]);

    if (status === 'completed') {
      updateScorers(match_id, scorers || []);
      updateTeamScores(match_id, actualHomeId, actualAwayId, score_home, score_away);
      updatePlayerELO(match_id, actualHomeId, actualAwayId, score_home, score_away);
    }

    return success({ message: 'Đã cập nhật kết quả', result_id });
  }

  // Chỉ update scorers cho match không có result_id cụ thể
  if (status === 'update_scorers') {
    updateScorers(match_id, scorers || []);
    return success({ message: 'Đã cập nhật thống kê' });
  }

  // Tạo mới nếu không tìm thấy
  if (!team_home_id || !team_away_id) return error('Thiếu thông tin đội');

  const newResultId = generateId('RES');
  sheet.appendRow([
    newResultId, match_id, round_number || 1,
    team_home_id, team_away_id,
    Number(score_home) || 0, Number(score_away) || 0,
    status || 'completed',
    nowISO(), '', ''
  ]);

  if ((status || 'completed') === 'completed') {
    updateScorers(match_id, scorers || []);
    updateTeamScores(match_id, team_home_id, team_away_id, score_home, score_away);
    updatePlayerELO(match_id, team_home_id, team_away_id, score_home, score_away);
  }

  return success({ message: 'Đã lưu kết quả', result_id: newResultId });
}

function updateScorers(match_id, scorers) {
  // scorers: [{user_id, goals, assists}]
  const sheet = getSheet('TEAM_PLAYERS');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const matchCol = headers.indexOf('match_id');
  const userCol = headers.indexOf('user_id');
  const goalsCol = headers.indexOf('goals_scored');
  const assistsCol = headers.indexOf('assists');

  scorers.forEach(scorer => {
    for (let i = 1; i < data.length; i++) {
      if (data[i][matchCol] === match_id && data[i][userCol] === scorer.user_id) {
        if (scorer.goals !== undefined) {
          sheet.getRange(i + 1, goalsCol + 1).setValue(Number(scorer.goals) || 0);
        }
        if (scorer.assists !== undefined) {
          sheet.getRange(i + 1, assistsCol + 1).setValue(Number(scorer.assists) || 0);
        }
        // Cập nhật thống kê cầu thủ
        updateUserGoalStats(scorer.user_id, scorer.goals || 0, scorer.assists || 0);
        break;
      }
    }
  });
}

function updateTeamScores(match_id, homeId, awayId, homeScore, awayScore) {
  const sheet = getSheet('MATCH_TEAMS');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const teamIdCol = headers.indexOf('team_id');
  const totalScoreCol = headers.indexOf('total_score');
  const winsCol = headers.indexOf('total_wins');
  const lossesCol = headers.indexOf('total_losses');
  const drawsCol = headers.indexOf('total_draws');

  const homeScore_ = Number(homeScore) || 0;
  const awayScore_ = Number(awayScore) || 0;

  for (let i = 1; i < data.length; i++) {
    if (data[i][teamIdCol] === homeId) {
      sheet.getRange(i + 1, totalScoreCol + 1).setValue((data[i][totalScoreCol] || 0) + homeScore_);
      if (homeScore_ > awayScore_) sheet.getRange(i + 1, winsCol + 1).setValue((data[i][winsCol] || 0) + 1);
      else if (homeScore_ < awayScore_) sheet.getRange(i + 1, lossesCol + 1).setValue((data[i][lossesCol] || 0) + 1);
      else sheet.getRange(i + 1, drawsCol + 1).setValue((data[i][drawsCol] || 0) + 1);
    }
    if (data[i][teamIdCol] === awayId) {
      sheet.getRange(i + 1, totalScoreCol + 1).setValue((data[i][totalScoreCol] || 0) + awayScore_);
      if (awayScore_ > homeScore_) sheet.getRange(i + 1, winsCol + 1).setValue((data[i][winsCol] || 0) + 1);
      else if (awayScore_ < homeScore_) sheet.getRange(i + 1, lossesCol + 1).setValue((data[i][lossesCol] || 0) + 1);
      else sheet.getRange(i + 1, drawsCol + 1).setValue((data[i][drawsCol] || 0) + 1);
    }
  }
}

function getResults(data) {
  requireAuth(data);
  const { match_id } = data;
  let results = getSheetData('MATCH_RESULTS');
  if (match_id) results = results.filter(r => r.match_id === match_id);
  results.sort((a, b) => a.round_number - b.round_number);
  return success({ results });
}

function generateRoundRobinSchedule(data) {
  const admin = requireAdmin(data);
  const { match_id, num_rounds, reset_all } = data;
  const numRounds = Math.max(1, Math.min(5, Number(num_rounds) || 1));

  const teams = getSheetData('MATCH_TEAMS').filter(t => t.match_id === match_id);
  if (teams.length < 2) return error('Cần ít nhất 2 đội');

  const sheet = getSheet('MATCH_RESULTS');

  // Xóa kết quả cũ: đọc 1 lần, xóa từ dưới lên để tránh lệch chỉ số hàng
  const allResultData = sheet.getDataRange().getValues();
  const rHeaders = allResultData[0];
  const rMatchCol = rHeaders.indexOf('match_id');
  const rStatusCol = rHeaders.indexOf('status');
  for (let i = allResultData.length - 1; i >= 1; i--) {
    if (String(allResultData[i][rMatchCol]) !== String(match_id)) continue;
    const rowStatus = allResultData[i][rStatusCol];
    if (reset_all || rowStatus === 'pending' || rowStatus === 'live') {
      sheet.deleteRow(i + 1);
    }
  }

  const teamIds = teams.map(t => t.team_id);
  const results = [];

  // Mỗi lượt = 1 leg (round_number = leg number)
  for (let leg = 1; leg <= numRounds; leg++) {
    for (let i = 0; i < teamIds.length; i++) {
      for (let j = i + 1; j < teamIds.length; j++) {
        const resultId = generateId('RES');
        sheet.appendRow([
          resultId, match_id, leg,
          teamIds[i], teamIds[j],
          0, 0, 'pending',
          '', '', ''
        ]);
        results.push({
          result_id: resultId,
          home: teams[i].team_name,
          away: teams[j].team_name,
          leg
        });
      }
    }
  }

  const legLabel = numRounds === 1 ? '1 lượt' : `${numRounds} lượt`;
  return success({ message: `Đã tạo ${results.length} trận (${legLabel})`, schedule: results });
}

function addMatchResult(data) {
  requireAdmin(data);
  const { match_id, team_home_id, team_away_id, round_number } = data;
  if (!match_id || !team_home_id || !team_away_id) return error('Thiếu thông tin');
  if (team_home_id === team_away_id) return error('Hai đội phải khác nhau');

  const resultId = generateId('RES');
  getSheet('MATCH_RESULTS').appendRow([
    resultId, match_id, Number(round_number) || 1,
    team_home_id, team_away_id, 0, 0, 'pending', '', '', ''
  ]);
  return success({ result_id: resultId, message: 'Đã thêm trận đấu' });
}

function deleteMatchResults(data) {
  requireAdmin(data);
  const { match_id, status_filter } = data;
  if (!match_id) return error('Thiếu match_id');

  const sheet = getSheet('MATCH_RESULTS');
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const matchIdCol = headers.indexOf('match_id');
  const statusCol = headers.indexOf('status');

  let deletedCount = 0;
  for (let i = allData.length - 1; i >= 1; i--) {
    if (String(allData[i][matchIdCol]) !== String(match_id)) continue;
    const rowStatus = allData[i][statusCol];
    if (!status_filter || rowStatus === status_filter) {
      sheet.deleteRow(i + 1);
      deletedCount++;
    }
  }
  return success({ message: `Đã xóa ${deletedCount} kết quả`, deleted: deletedCount });
}

function deleteMatchResult(data) {
  requireAdmin(data);
  const { result_id } = data;
  if (!result_id) return error('Thiếu result_id');

  const sheet = getSheet('MATCH_RESULTS');
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const resultIdCol = headers.indexOf('result_id');

  for (let i = allData.length - 1; i >= 1; i--) {
    if (String(allData[i][resultIdCol]) === String(result_id)) {
      sheet.deleteRow(i + 1);
      return success({ deleted: 1 });
    }
  }
  return error('Không tìm thấy kết quả');
}
