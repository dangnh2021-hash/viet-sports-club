// ============================================================
// Auth.gs - Đăng nhập, đăng ký, logout
// ============================================================

function login(data) {
  const { username, password_hash } = data;
  if (!username || !password_hash) return error('Thiếu username hoặc password');

  const sheet = getSheet('USERS');
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const usernameCol = headers.indexOf('username');
  const passwordCol = headers.indexOf('password_hash');
  const statusCol = headers.indexOf('status');

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][usernameCol] === username && rows[i][passwordCol] === password_hash) {
      if (rows[i][statusCol] === 'inactive') return error('Tài khoản đã bị vô hiệu hóa');

      const token = generateToken();
      const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 ngày

      // Cập nhật sessions array (hỗ trợ nhiều thiết bị đăng nhập cùng lúc)
      const tokenCol = headers.indexOf('session_token');
      const expiryCol = headers.indexOf('token_expiry');
      const lastLoginCol = headers.indexOf('last_login');

      let sessions = [];
      try {
        const raw = String(rows[i][tokenCol] || '');
        const parsed = raw ? JSON.parse(raw) : [];
        sessions = Array.isArray(parsed) ? parsed : [];
      } catch (e) { sessions = []; }

      // Xóa session đã hết hạn, giữ tối đa 5 sessions
      const now = new Date();
      sessions = sessions.filter(s => s.e && new Date(s.e) > now).slice(-4);
      sessions.push({ t: token, e: expiry });

      sheet.getRange(i + 1, tokenCol + 1).setValue(JSON.stringify(sessions));
      sheet.getRange(i + 1, expiryCol + 1).setValue(expiry);
      sheet.getRange(i + 1, lastLoginCol + 1).setValue(nowISO());

      // Build user object (không trả password)
      const userObj = {};
      headers.forEach((h, idx) => {
        if (h !== 'password_hash' && h !== 'session_token' && h !== 'token_expiry') {
          userObj[h] = rows[i][idx];
        }
      });

      return success({ token, user: userObj });
    }
  }
  return error('Sai username hoặc password');
}

function register(data) {
  const { username, password_hash, full_name, email, phone, positions, stats } = data;
  if (!username || !password_hash || !full_name) return error('Thiếu thông tin bắt buộc');
  if (!positions || positions.length === 0) return error('Phải chọn ít nhất 1 vị trí');

  const sheet = getSheet('USERS');
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const usernameCol = headers.indexOf('username');

  // Kiểm tra username trùng
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][usernameCol] === username) return error('Username đã tồn tại');
  }

  const statsData = stats || {};
  const posStr = Array.isArray(positions) ? positions.join(',') : positions;
  const pace = Math.min(99, Math.max(1, Number(statsData.pace) || 60));
  const shooting = Math.min(99, Math.max(1, Number(statsData.shooting) || 60));
  const passing = Math.min(99, Math.max(1, Number(statsData.passing) || 60));
  const dribbling = Math.min(99, Math.max(1, Number(statsData.dribbling) || 60));
  const defending = Math.min(99, Math.max(1, Number(statsData.defending) || 60));
  const physical = Math.min(99, Math.max(1, Number(statsData.physical) || 60));
  const gkDiving = Math.min(99, Math.max(1, Number(statsData.gk_diving) || 60));
  const gkHandling = Math.min(99, Math.max(1, Number(statsData.gk_handling) || 60));
  const gkReflexes = Math.min(99, Math.max(1, Number(statsData.gk_reflexes) || 60));

  const overall = calcOverall({
    pace, shooting, passing, dribbling, defending, physical,
    gk_diving: gkDiving, gk_handling: gkHandling, gk_reflexes: gkReflexes
  }, posStr);

  const userId = generateId('USR');
  const newRow = [
    userId, username, password_hash, full_name,
    email || '', phone || '',
    false,    // is_admin
    posStr,   // positions
    '',       // avatar_url
    pace, shooting, passing, dribbling, defending, physical,
    gkDiving, gkHandling, gkReflexes,
    overall,
    1000,     // rating_points
    0, 0, 0, 0, 0, 0,   // match stats
    'active',
    nowISO(),
    '', '', ''
  ];

  sheet.appendRow(newRow);
  return success({ message: 'Đăng ký thành công! Hãy đăng nhập.' });
}

function logout(data) {
  const user = validateToken(data.token);
  if (!user) return success({ message: 'Logged out' });

  const sheet = getSheet('USERS');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const tokenCol = headers.indexOf('session_token');

  // Chỉ xóa token của thiết bị hiện tại, không ảnh hưởng thiết bị khác
  const raw = String(sheet.getRange(user.rowNum, tokenCol + 1).getValue() || '');
  let sessions = [];
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    sessions = Array.isArray(parsed) ? parsed : [];
  } catch (e) { sessions = []; }

  sessions = sessions.filter(s => s.t !== data.token);
  sheet.getRange(user.rowNum, tokenCol + 1).setValue(sessions.length ? JSON.stringify(sessions) : '');

  return success({ message: 'Đăng xuất thành công' });
}

function getProfile(data) {
  const user = requireAuth(data);
  const row = findRowByValue('USERS', 0, user.user_id);
  if (!row) return error('Không tìm thấy user');

  const headers = row.headers;
  const userObj = {};
  headers.forEach((h, i) => {
    if (h !== 'password_hash' && h !== 'session_token' && h !== 'token_expiry') {
      userObj[h] = row.data[i];
    }
  });
  return success({ user: userObj });
}

function updateProfile(data) {
  const user = requireAuth(data);
  const { full_name, email, phone, avatar_url } = data;

  const row = findRowByValue('USERS', 0, user.user_id);
  if (!row) return error('Không tìm thấy user');

  const sheet = getSheet('USERS');
  const headers = row.headers;

  if (full_name) sheet.getRange(row.rowNum, headers.indexOf('full_name') + 1).setValue(full_name);
  if (email) sheet.getRange(row.rowNum, headers.indexOf('email') + 1).setValue(email);
  if (phone) sheet.getRange(row.rowNum, headers.indexOf('phone') + 1).setValue(phone);
  if (avatar_url) sheet.getRange(row.rowNum, headers.indexOf('avatar_url') + 1).setValue(avatar_url);

  return success({ message: 'Cập nhật thành công' });
}

function updateUserStats(data) {
  // Cho phép user tự set chỉ số lần đầu, admin có thể set bất kỳ lúc nào
  const authUser = requireAuth(data);
  const targetUserId = data.target_user_id || authUser.user_id;

  // Nếu không phải admin và target khác mình thì từ chối
  if (!authUser.is_admin && targetUserId !== authUser.user_id) {
    return error('Không có quyền chỉnh chỉ số cầu thủ khác');
  }

  const row = findRowByValue('USERS', 0, targetUserId);
  if (!row) return error('Không tìm thấy user');

  const sheet = getSheet('USERS');
  const headers = row.headers;
  const { stats } = data;
  if (!stats) return error('Thiếu dữ liệu chỉ số');

  const statFields = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical',
                      'gk_diving', 'gk_handling', 'gk_reflexes'];

  statFields.forEach(field => {
    if (stats[field] !== undefined) {
      const val = Math.min(99, Math.max(1, Number(stats[field])));
      const col = headers.indexOf(field);
      if (col >= 0) sheet.getRange(row.rowNum, col + 1).setValue(val);
    }
  });

  // Cập nhật positions nếu có
  if (data.positions) {
    const posStr = Array.isArray(data.positions) ? data.positions.join(',') : data.positions;
    sheet.getRange(row.rowNum, headers.indexOf('positions') + 1).setValue(posStr);
  }

  // Recalculate overall
  const updatedRow = sheet.getRange(row.rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
  const updatedStats = {};
  headers.forEach((h, i) => { updatedStats[h] = updatedRow[i]; });

  const posStr = updatedStats.positions || '';
  const overall = calcOverall(updatedStats, posStr);
  sheet.getRange(row.rowNum, headers.indexOf('overall_rating') + 1).setValue(overall);

  return success({ message: 'Cập nhật chỉ số thành công', overall });
}

function getUsers(data) {
  requireAuth(data);
  const users = getSheetData('USERS').map(u => {
    const { password_hash, session_token, token_expiry, ...safe } = u;
    return safe;
  });
  return success({ users });
}

function adminUpdateUser(data) {
  const admin = requireAdmin(data);
  const { target_user_id, updates } = data;
  if (!target_user_id || !updates) return error('Thiếu dữ liệu');

  const row = findRowByValue('USERS', 0, target_user_id);
  if (!row) return error('Không tìm thấy user');

  const sheet = getSheet('USERS');
  const headers = row.headers;

  const allowedFields = ['full_name', 'email', 'phone', 'is_admin', 'status', 'positions',
                          'pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical',
                          'gk_diving', 'gk_handling', 'gk_reflexes', 'rating_points'];

  allowedFields.forEach(field => {
    if (updates[field] !== undefined) {
      const col = headers.indexOf(field);
      if (col >= 0) sheet.getRange(row.rowNum, col + 1).setValue(updates[field]);
    }
  });

  // Recalculate overall if stats changed
  const statFields = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical',
                      'gk_diving', 'gk_handling', 'gk_reflexes', 'positions'];
  const statsUpdated = statFields.some(f => updates[f] !== undefined);
  if (statsUpdated) {
    const updatedRow = sheet.getRange(row.rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
    const updatedStats = {};
    headers.forEach((h, i) => { updatedStats[h] = updatedRow[i]; });
    const overall = calcOverall(updatedStats, updatedStats.positions || '');
    sheet.getRange(row.rowNum, headers.indexOf('overall_rating') + 1).setValue(overall);
  }

  return success({ message: 'Cập nhật user thành công' });
}
