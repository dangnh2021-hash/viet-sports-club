// ============================================================
// config.js - Cấu hình App
// ⚠️ Thay YOUR_APPS_SCRIPT_URL bằng URL thực sau khi deploy
// ============================================================

const CONFIG = {
  // Paste URL Google Apps Script Web App của bạn vào đây
  API_URL: 'https://script.google.com/macros/s/AKfycbzTVLutLM5x2H0X_s_MYnbnubLjOHhHh57enDweuWrmvnvTYtcaGteZ2sVG8UAHCImaZA/exec',

  APP_NAME: 'Viet Sports Club',
  VERSION: '1.0.0',

  // Token storage key
  TOKEN_KEY: 'vsc_token',
  USER_KEY: 'vsc_user',

  // Positions
  POSITIONS: {
    FW: { label: 'FW', name: 'Tiền đạo', color: 'pos-fw', icon: '⚡' },
    MF: { label: 'MF', name: 'Tiền vệ', color: 'pos-mf', icon: '🔄' },
    DF: { label: 'DF', name: 'Hậu vệ', color: 'pos-df', icon: '🛡️' },
    GK: { label: 'GK', name: 'Thủ môn', color: 'pos-gk', icon: '🧤' }
  },

  // Team colors
  TEAM_COLORS: ['#EF4444', '#3B82F6', '#F59E0B', '#6B7280'],
  TEAM_NAMES: ['Đội Đỏ', 'Đội Xanh', 'Đội Vàng', 'Đội Trắng'],

  // Match status labels
  MATCH_STATUS: {
    scheduled: { label: 'Sắp diễn ra', class: 'badge-scheduled', icon: '📅' },
    ongoing: { label: 'Đang diễn ra', class: 'badge-ongoing', icon: '🟢' },
    completed: { label: 'Đã kết thúc', class: 'badge-completed', icon: '✅' },
    cancelled: { label: 'Đã hủy', class: 'badge-cancelled', icon: '❌' }
  },

  // Tournament / Event constants
  EVENT_STATUS: {
    draft:        { label: 'Bản nháp',       icon: '✏️',  class: 'text-gray-400' },
    group_stage:  { label: 'Vòng bảng',      icon: '🟢',  class: 'text-green-400' },
    knockout:     { label: 'Vòng loại trực tiếp', icon: '⚡', class: 'text-amber-400' },
    completed:    { label: 'Đã kết thúc',    icon: '🏆',  class: 'text-blue-400' }
  },

  KNOCKOUT_STAGE_LABEL: {
    r16:         '🔶 Vòng 16 đội',
    qf:          '⚡ Tứ kết',
    sf:          '🔥 Bán kết',
    third_place: '🥉 Tranh hạng 3',
    final:       '🏆 Chung kết'
  },

  EVENT_TYPE_LABEL: {
    goal:        { icon: '⚽', label: 'Bàn thắng' },
    own_goal:    { icon: '⚽', label: 'Phản lưới' },
    yellow_card: { icon: '🟡', label: 'Thẻ vàng' },
    red_card:    { icon: '🔴', label: 'Thẻ đỏ' }
  }
};
