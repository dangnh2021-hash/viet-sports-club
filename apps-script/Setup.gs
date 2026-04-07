// ============================================================
// Setup.gs - Khởi tạo Google Sheets và dữ liệu mặc định
// Chạy hàm setupSpreadsheet() một lần duy nhất để tạo DB
// ============================================================

function setupSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheetsConfig = {
    'USERS': [
      'user_id', 'username', 'password_hash', 'full_name', 'email', 'phone',
      'is_admin', 'positions', 'avatar_url',
      'pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical',
      'gk_diving', 'gk_handling', 'gk_reflexes',
      'overall_rating', 'rating_points',
      'total_matches', 'total_wins', 'total_losses', 'total_draws',
      'total_goals', 'total_assists',
      'status', 'created_at', 'last_login', 'session_token', 'token_expiry',
      'user_type'   // 'internal' | 'event_guest'
    ],
    'MATCHES': [
      'match_id', 'match_date', 'start_time', 'end_time',
      'venue_name', 'venue_address',
      'num_players_per_team', 'num_teams', 'match_format',
      'status', 'notes', 'created_by', 'created_at', 'voting_deadline'
    ],
    'MATCH_ATTENDANCE': [
      'attendance_id', 'match_id', 'user_id', 'vote_status', 'note', 'voted_at', 'updated_at'
    ],
    'GUEST_TEAMS': [
      'guest_team_id', 'team_name', 'representative_name', 'contact_phone',
      'match_id', 'notes', 'created_at'
    ],
    'MATCH_TEAMS': [
      'team_id', 'match_id', 'team_name', 'team_color', 'team_type',
      'guest_team_id', 'formation', 'total_score', 'total_wins', 'total_losses', 'total_draws', 'created_at'
    ],
    'TEAM_PLAYERS': [
      'id', 'team_id', 'match_id', 'user_id', 'guest_player_name',
      'position_played', 'jersey_number', 'is_captain',
      'goals_scored', 'assists', 'yellow_cards', 'red_cards', 'rating_in_match'
    ],
    'MATCH_RESULTS': [
      'result_id', 'match_id', 'round_number', 'team_home_id', 'team_away_id',
      'score_home', 'score_away', 'status', 'started_at', 'ended_at', 'notes'
    ],
    'RATING_HISTORY': [
      'history_id', 'user_id', 'match_id', 'result_id', 'change_type',
      'points_change', 'rating_before', 'rating_after', 'description', 'created_at'
    ],

    // ---- Tournament / Event sheets (Sheet 9–14) ----
    'EVENTS': [
      'event_id', 'event_name', 'description', 'start_date', 'end_date',
      'venue_name', 'venue_address', 'status', 'teams_per_group', 'advance_per_group',
      'logo_url', 'created_by', 'created_at'
    ],
    'EVENT_GROUPS': [
      'group_id', 'event_id', 'group_name', 'group_order', 'venue_name', 'notes'
    ],
    'EVENT_TEAMS': [
      'event_team_id', 'event_id', 'group_id', 'team_name', 'team_color',
      'team_type', 'manager_user_id', 'seed', 'logo_url',
      'contact_name', 'contact_phone', 'notes', 'created_at'
    ],
    'EVENT_MATCHES': [
      'event_match_id', 'event_id', 'group_id', 'stage', 'round_number',
      'match_number', 'team_home_id', 'team_away_id', 'match_date', 'start_time',
      'venue', 'status', 'score_home', 'score_away', 'result', 'notes'
    ],
    'EVENT_MATCH_EVENTS': [
      'event_id_row', 'event_match_id', 'minute', 'team_id', 'event_type',
      'player_name', 'jersey_number', 'assist_name', 'created_at'
    ],
    'EVENT_STANDINGS': [
      'standing_id', 'event_id', 'group_id', 'event_team_id', 'rank',
      'played', 'wins', 'draws', 'losses', 'goals_for', 'goals_against',
      'goal_diff', 'points', 'updated_at'
    ],
    'EVENT_KNOCKOUT': [
      'knockout_id', 'event_id', 'stage', 'match_slot',
      'team_home_id', 'team_away_id', 'slot_label_home', 'slot_label_away',
      'event_match_id', 'winner_team_id', 'next_knockout_id'
    ]
  };

  const existingNames = ss.getSheets().map(s => s.getName());

  Object.entries(sheetsConfig).forEach(([name, headers]) => {
    let sheet;
    if (existingNames.includes(name)) {
      sheet = ss.getSheetByName(name);
    } else {
      sheet = ss.insertSheet(name);
    }
    // Chỉ ghi header nếu sheet trống
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
    }
    // Format header
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#166534');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 150);
  });

  // Xóa Sheet1 mặc định nếu còn tồn tại
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch(e) {}
  }

  // Tạo admin mặc định
  createDefaultAdmin();

  const result = { success: true, message: 'Setup hoàn tất!', spreadsheetId: ss.getId() };
  Logger.log(JSON.stringify(result));
  return result;
}

function createDefaultAdmin() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('USERS');
  const data = sheet.getDataRange().getValues();

  // Kiểm tra admin đã tồn tại chưa
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === 'admin') {
      Logger.log('Admin đã tồn tại');
      return;
    }
  }

  const adminRow = [
    'USR_ADMIN_001',
    'admin',
    hashPassword('admin123'),
    'Administrator',
    'admin@vietsportsclub.com',
    '',
    true,            // is_admin
    'FW,MF,DF,GK',  // positions
    '',              // avatar_url
    70, 70, 70, 70, 70, 70,  // PAC, SHO, PAS, DRI, DEF, PHY
    70, 70, 70,               // GK_DIV, GK_HAN, GK_REF
    70,              // overall_rating
    1000,            // rating_points
    0, 0, 0, 0,      // total_matches, wins, losses, draws
    0, 0,            // total_goals, assists
    'active',
    new Date().toISOString(),
    '',              // last_login
    '',              // session_token
    '',              // token_expiry
    'internal'       // user_type
  ];

  sheet.appendRow(adminRow);
  Logger.log('Admin user đã được tạo: admin / admin123');
}

/**
 * Migration: Chạy 1 lần để thêm cột user_type vào USERS sheet hiện có.
 * Backfill tất cả row hiện tại với giá trị 'internal'.
 */
function migrateAddUserType() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('USERS');
  if (!sheet) { Logger.log('Sheet USERS không tồn tại'); return; }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (headers.includes('user_type')) {
    Logger.log('Cột user_type đã tồn tại, bỏ qua.');
    return;
  }

  // Thêm header
  const newCol = sheet.getLastColumn() + 1;
  sheet.getRange(1, newCol).setValue('user_type');
  sheet.getRange(1, newCol).setBackground('#166534').setFontColor('#ffffff').setFontWeight('bold');

  // Backfill tất cả user cũ → 'internal'
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, newCol, lastRow - 1, 1).setValue('internal');
  }
  Logger.log('Migration user_type hoàn tất. Tổng ' + (lastRow - 1) + ' user đã backfill.');
}

/**
 * Tạo các tournament sheets nếu chưa có (chạy sau khi đã có DB cũ).
 */
function setupTournamentSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tournamentSheets = {
    'EVENTS': ['event_id','event_name','description','start_date','end_date','venue_name','venue_address','status','teams_per_group','advance_per_group','logo_url','created_by','created_at'],
    'EVENT_GROUPS': ['group_id','event_id','group_name','group_order','venue_name','notes'],
    'EVENT_TEAMS': ['event_team_id','event_id','group_id','team_name','team_color','team_type','manager_user_id','seed','logo_url','contact_name','contact_phone','notes','created_at'],
    'EVENT_MATCHES': ['event_match_id','event_id','group_id','stage','round_number','match_number','team_home_id','team_away_id','match_date','start_time','venue','status','score_home','score_away','result','notes'],
    'EVENT_MATCH_EVENTS': ['event_id_row','event_match_id','minute','team_id','event_type','player_name','jersey_number','assist_name','created_at'],
    'EVENT_STANDINGS': ['standing_id','event_id','group_id','event_team_id','rank','played','wins','draws','losses','goals_for','goals_against','goal_diff','points','updated_at'],
    'EVENT_KNOCKOUT': ['knockout_id','event_id','stage','match_slot','team_home_id','team_away_id','slot_label_home','slot_label_away','event_match_id','winner_team_id','next_knockout_id']
  };

  const existingNames = ss.getSheets().map(s => s.getName());
  Object.entries(tournamentSheets).forEach(([name, headers]) => {
    if (existingNames.includes(name)) { Logger.log(name + ' đã tồn tại, bỏ qua.'); return; }
    const sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#1e3a5f').setFontColor('#ffffff').setFontWeight('bold');
    sheet.setFrozenRows(1);
    Logger.log('Đã tạo sheet: ' + name);
  });
  Logger.log('Tournament sheets setup hoàn tất!');
}
