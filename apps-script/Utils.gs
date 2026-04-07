// ============================================================
// Utils.gs - Helper functions dùng chung
// ============================================================

// ---- Sheet Access ----

function getSheet(sheetName) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
}

function getSheetData(sheetName) {
  const sheet = getSheet(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  return data.slice(1)
    .filter(row => row[0] !== '' && row[0] !== null && row[0] !== undefined)
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = serializeValue(row[i], h); });
      return obj;
    });
}

// Chuyển đổi giá trị từ Sheets sang JSON-safe string
function serializeValue(val, header) {
  if (val === null || val === undefined || val === '') return '';
  if (val instanceof Date) {
    // Cột thời gian (start_time, end_time) → "HH:MM"
    const timeHeaders = ['start_time', 'end_time'];
    if (timeHeaders.includes(header)) {
      const h = val.getHours().toString().padStart(2, '0');
      const m = val.getMinutes().toString().padStart(2, '0');
      return `${h}:${m}`;
    }
    // Cột ngày (match_date) → "YYYY-MM-DD"
    const dateHeaders = ['match_date', 'voting_deadline', 'created_at', 'voted_at', 'updated_at', 'last_login', 'token_expiry', 'started_at', 'ended_at'];
    if (dateHeaders.includes(header)) {
      return Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
    }
    return val.toISOString();
  }
  return val;
}

function findRowByValue(sheetName, colIndex, value) {
  const sheet = getSheet(sheetName);
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][colIndex]) === String(value)) {
      return { rowNum: i + 1, data: data[i], headers: data[0] };
    }
  }
  return null;
}

function updateCellByRow(sheetName, rowNum, colIndex, value) {
  const sheet = getSheet(sheetName);
  sheet.getRange(rowNum, colIndex + 1).setValue(value);
}

function updateRowObject(sheetName, rowNum, obj) {
  const sheet = getSheet(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  headers.forEach((h, i) => {
    if (obj.hasOwnProperty(h)) {
      sheet.getRange(rowNum, i + 1).setValue(obj[h]);
    }
  });
}

// ---- ID Generation ----

function generateId(prefix) {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substr(2, 6).toUpperCase();
  return `${prefix}_${ts}${rand}`;
}

// ---- Password ----

function hashPassword(password) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  return bytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

// ---- Token Auth ----

function generateToken() {
  return Utilities.getUuid();
}

function validateToken(token) {
  if (!token) return null;
  const sheet = getSheet('USERS');
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const tokenCol = headers.indexOf('session_token');
  const expiryCol = headers.indexOf('token_expiry');
  const now = new Date();

  for (let i = 1; i < data.length; i++) {
    const raw = String(data[i][tokenCol] || '');
    if (!raw) continue;

    // Parse sessions array; fall back to legacy single-token format
    let sessions = [];
    try {
      const parsed = JSON.parse(raw);
      sessions = Array.isArray(parsed) ? parsed : [{ t: raw, e: data[i][expiryCol] }];
    } catch (e) {
      sessions = [{ t: raw, e: data[i][expiryCol] }];
    }

    const match = sessions.find(s => s.t === token && s.e && new Date(s.e) > now);
    if (match) {
      const userIdCol = headers.indexOf('user_id');
      const usernameCol = headers.indexOf('username');
      const fullNameCol = headers.indexOf('full_name');
      const isAdminCol = headers.indexOf('is_admin');
      const positionsCol = headers.indexOf('positions');
      return {
        user_id: data[i][userIdCol],
        username: data[i][usernameCol],
        full_name: data[i][fullNameCol],
        is_admin: data[i][isAdminCol] === true || data[i][isAdminCol] === 'true',
        positions: data[i][positionsCol],
        rowNum: i + 1
      };
    }
  }
  return null;
}

function requireAuth(data) {
  const user = validateToken(data.token);
  if (!user) throw new Error('Unauthorized: Token không hợp lệ hoặc đã hết hạn');
  return user;
}

function requireAdmin(data) {
  const user = requireAuth(data);
  if (!user.is_admin) throw new Error('Forbidden: Chỉ admin mới có quyền thực hiện');
  return user;
}

// ---- Overall Rating Calculation ----

function calcOverall(stats, positions) {
  const posArr = String(positions).split(',').map(p => p.trim().toUpperCase());
  const pac = Number(stats.pace) || 50;
  const sho = Number(stats.shooting) || 50;
  const pas = Number(stats.passing) || 50;
  const dri = Number(stats.dribbling) || 50;
  const def = Number(stats.defending) || 50;
  const phy = Number(stats.physical) || 50;
  const gkDiv = Number(stats.gk_diving) || 50;
  const gkHan = Number(stats.gk_handling) || 50;
  const gkRef = Number(stats.gk_reflexes) || 50;

  const formulas = {
    'FW': sho * 0.30 + dri * 0.25 + pac * 0.20 + pas * 0.15 + phy * 0.10,
    'MF': pas * 0.30 + dri * 0.20 + phy * 0.15 + pac * 0.15 + sho * 0.10 + def * 0.10,
    'DF': def * 0.35 + phy * 0.25 + pas * 0.15 + pac * 0.15 + dri * 0.10,
    'GK': gkRef * 0.35 + gkDiv * 0.30 + gkHan * 0.25 + pac * 0.10
  };

  let best = 0;
  posArr.forEach(pos => {
    if (formulas[pos] && formulas[pos] > best) best = formulas[pos];
  });
  return Math.round(best);
}

// ---- Datetime ----

function nowISO() {
  return new Date().toISOString();
}

// ---- Response helpers ----

function success(data) {
  return { success: true, ...data };
}

function error(message) {
  return { success: false, error: message };
}
