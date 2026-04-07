// ============================================================
// tournament-live.js - Live scoring màn hình giải đấu
// Poll every 15 giây khi đang ở trang này
// ============================================================

let liveState = {
  matchId: null,
  eventId: null,
  match: null,
  events: [],
  teams: [],
  pollTimer: null,
  matchTimer: null,
  elapsedSeconds: 0
};

// ============================================================
// MAIN RENDER
// ============================================================

async function renderTournamentLive(container, params = {}) {
  // Nhận params từ router hoặc window._liveParams
  const matchId = params.event_match_id || window._liveTournamentMatchId;
  const eventId = params.event_id || window._liveTournamentEventId;

  if (!matchId && !eventId) {
    container.innerHTML = `<div class="card">${emptyState('❌', 'Không tìm thấy trận đấu', 'Vào từ trang Lịch thi đấu')}</div>`;
    return;
  }

  liveState.matchId = matchId;
  liveState.eventId = eventId;
  _stopLivePoll();

  await _loadLiveData(container);
}

async function _loadLiveData(container) {
  try {
    const res = await API.call('getLiveMatch', {
      event_match_id: liveState.matchId,
      event_id: liveState.eventId
    });
    if (!res.success || !res.match) {
      container.innerHTML = `<div class="card">${emptyState('📺', 'Không có trận nào đang diễn ra')}</div>`;
      return;
    }
    liveState.match = res.match;
    liveState.events = res.events || [];

    // Lấy danh sách đội của event để hiển thị tên
    const detailRes = await API.call('getEventDetail', { event_id: liveState.match.event_id });
    if (detailRes.success) liveState.teams = detailRes.teams || [];

    _renderLiveScreen(container);
    _startLivePoll(container);
  } catch (e) {
    container.innerHTML = `<div class="card">${emptyState('❌', 'Lỗi tải dữ liệu live')}</div>`;
  }
}

// ============================================================
// RENDER SCREEN
// ============================================================

function _renderLiveScreen(container) {
  const { match, events, teams } = liveState;
  const user = getStoredUser();
  const isAdmin = user?.is_admin;

  const teamMap = {};
  teams.forEach(t => { teamMap[t.event_team_id] = t; });

  const homeTeam = teamMap[match.team_home_id] || { team_name: 'Home', team_color: '#EF4444' };
  const awayTeam = teamMap[match.team_away_id] || { team_name: 'Away', team_color: '#3B82F6' };
  const scoreHome = Number(match.score_home) || 0;
  const scoreAway = Number(match.score_away) || 0;

  const isOngoing = match.status === 'ongoing';
  const isDone = match.status === 'completed';

  // Back button target
  const backTarget = `tournament`;
  const backParams = `{event_id:'${match.event_id}',tab:'schedule'}`;

  container.innerHTML = `
    <div class="space-y-4">
      <!-- Header -->
      <div class="flex items-center gap-2">
        <button onclick="navigateTo('${backTarget}', ${backParams})" class="text-gray-400 hover:text-white transition">
          <i class="fas fa-arrow-left"></i>
        </button>
        <div class="flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-sm font-medium ${isOngoing ? 'text-green-400' : isDone ? 'text-blue-400' : 'text-gray-400'}">
              ${isOngoing ? '🟢 ĐANG DIỄN RA' : isDone ? '✅ KẾT THÚC' : '📅 SẮP DIỄN RA'}
            </span>
            ${match.venue ? `<span class="text-gray-500 text-xs">📍 ${match.venue}</span>` : ''}
          </div>
        </div>
        ${isOngoing ? `<div id="live-clock" class="text-green-400 font-mono text-sm font-bold">0'</div>` : ''}
      </div>

      <!-- Scoreboard -->
      <div class="card bg-gradient-to-b from-gray-800 to-gray-900 border-gray-700">
        <div class="flex items-center gap-2 py-2">
          <!-- Home team -->
          <div class="flex-1 text-center">
            <div class="w-4 h-4 rounded-full mx-auto mb-1" style="background:${homeTeam.team_color}"></div>
            <div class="font-bold text-white text-sm leading-tight">${homeTeam.team_name}</div>
            ${isAdmin && isOngoing ? `
              <div class="flex justify-center gap-2 mt-2">
                <button onclick="quickAdjustScore('${match.event_match_id}', ${scoreHome - 1}, ${scoreAway}, 'home')"
                  class="w-9 h-9 rounded-full bg-gray-700 hover:bg-red-800 text-white font-bold text-lg transition">−</button>
                <button onclick="quickAdjustScore('${match.event_match_id}', ${scoreHome + 1}, ${scoreAway}, 'home')"
                  class="w-9 h-9 rounded-full bg-green-700 hover:bg-green-600 text-white font-bold text-lg transition">+</button>
              </div>` : ''}
          </div>

          <!-- Score -->
          <div class="text-center px-2">
            <div class="text-5xl font-black text-white tracking-wide">${scoreHome} <span class="text-gray-500">–</span> ${scoreAway}</div>
          </div>

          <!-- Away team -->
          <div class="flex-1 text-center">
            <div class="w-4 h-4 rounded-full mx-auto mb-1" style="background:${awayTeam.team_color}"></div>
            <div class="font-bold text-white text-sm leading-tight">${awayTeam.team_name}</div>
            ${isAdmin && isOngoing ? `
              <div class="flex justify-center gap-2 mt-2">
                <button onclick="quickAdjustScore('${match.event_match_id}', ${scoreHome}, ${scoreAway - 1}, 'away')"
                  class="w-9 h-9 rounded-full bg-gray-700 hover:bg-red-800 text-white font-bold text-lg transition">−</button>
                <button onclick="quickAdjustScore('${match.event_match_id}', ${scoreHome}, ${scoreAway + 1}, 'away')"
                  class="w-9 h-9 rounded-full bg-green-700 hover:bg-green-600 text-white font-bold text-lg transition">+</button>
              </div>` : ''}
          </div>
        </div>
      </div>

      <!-- Timeline -->
      <div class="card">
        <h3 class="font-bold text-white mb-3">📋 Diễn biến</h3>
        ${events.length === 0
          ? `<p class="text-gray-500 text-sm text-center py-4">Chưa có sự kiện nào</p>`
          : `<div class="space-y-2" id="events-timeline">
              ${events.map(ev => _renderEventRow(ev, homeTeam, awayTeam)).join('')}
            </div>`
        }
      </div>

      <!-- Admin: Add Event Form -->
      ${isAdmin && isOngoing ? `
        <div class="card">
          <h3 class="font-bold text-white mb-3"><i class="fas fa-plus-circle text-green-400 mr-1"></i> Thêm sự kiện</h3>
          <div class="space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-gray-400 mb-1">Phút</label>
                <input id="live-minute" type="number" min="1" max="120" placeholder="45" class="form-input" />
              </div>
              <div>
                <label class="block text-xs text-gray-400 mb-1">Đội</label>
                <select id="live-team" class="form-input">
                  <option value="${match.team_home_id}">${homeTeam.team_name}</option>
                  <option value="${match.team_away_id}">${awayTeam.team_name}</option>
                </select>
              </div>
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1">Loại sự kiện</label>
              <div class="grid grid-cols-4 gap-2">
                ${Object.entries(CONFIG.EVENT_TYPE_LABEL).map(([k, v]) => `
                  <label class="cursor-pointer">
                    <input type="radio" name="live-etype" value="${k}" class="hidden" ${k === 'goal' ? 'checked' : ''} />
                    <span id="etype-${k}" class="block text-center py-2 rounded-lg border text-xs font-medium transition
                      ${k === 'goal' ? 'border-green-500 bg-green-900/30 text-green-400' : 'border-gray-600 text-gray-400'}
                      hover:border-gray-400 cursor-pointer"
                      onclick="selectEventType('${k}')">
                      ${v.icon} ${v.label}
                    </span>
                  </label>`).join('')}
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-gray-400 mb-1">Tên cầu thủ</label>
                <input id="live-player" type="text" placeholder="Nguyễn Văn A" class="form-input" />
              </div>
              <div>
                <label class="block text-xs text-gray-400 mb-1">Số áo</label>
                <input id="live-jersey" type="number" min="1" max="99" placeholder="10" class="form-input" />
              </div>
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1">Kiến tạo (tùy chọn)</label>
              <input id="live-assist" type="text" placeholder="Tên người kiến tạo" class="form-input" />
            </div>
            <button onclick="submitAddMatchEvent('${match.event_match_id}')" class="btn btn-primary w-full">
              <i class="fas fa-plus mr-1"></i> Thêm sự kiện
            </button>
          </div>
        </div>

        <!-- Admin controls -->
        <div class="flex gap-2">
          ${events.length > 0 ? `
            <button onclick="confirmRemoveLastEvent('${match.event_match_id}')" class="btn btn-secondary flex-1 text-red-400 border-red-800">
              <i class="fas fa-undo mr-1"></i> Xóa sự kiện cuối
            </button>` : ''}
          <button onclick="confirmFinishMatch('${match.event_match_id}')" class="btn flex-1 bg-blue-700 hover:bg-blue-600 text-white">
            <i class="fas fa-flag-checkered mr-1"></i> Kết thúc trận
          </button>
        </div>
      ` : ''}

      <!-- Auto-refresh indicator -->
      ${isOngoing ? `
        <div class="text-center text-gray-600 text-xs">
          <i class="fas fa-sync-alt mr-1 animate-spin"></i> Tự động cập nhật mỗi 15 giây
        </div>` : ''}
    </div>
  `;

  // Start elapsed timer if ongoing
  if (isOngoing) _startMatchTimer();
}

function _renderEventRow(ev, homeTeam, awayTeam) {
  const cfg = CONFIG.EVENT_TYPE_LABEL[ev.event_type] || { icon: '•', label: ev.event_type };
  const isHome = ev.team_id === homeTeam.event_team_id;
  const teamName = isHome ? homeTeam.team_name : awayTeam.team_name;

  return `
    <div class="flex items-center gap-2 py-1.5 border-b border-gray-700/50 text-sm">
      <span class="text-gray-500 font-mono w-8 text-right flex-shrink-0">${ev.minute}'</span>
      <span class="text-lg">${cfg.icon}</span>
      <div class="flex-1">
        <span class="text-white font-medium">${ev.player_name || '?'}</span>
        ${ev.jersey_number ? `<span class="text-gray-500 text-xs ml-1">#${ev.jersey_number}</span>` : ''}
        ${ev.assist_name ? `<span class="text-gray-500 text-xs ml-1">(kiến: ${ev.assist_name})</span>` : ''}
      </div>
      <div class="flex items-center gap-1 flex-shrink-0">
        <div class="w-2 h-2 rounded-full" style="background:${isHome ? homeTeam.team_color : awayTeam.team_color}"></div>
        <span class="text-gray-400 text-xs">${teamName}</span>
      </div>
    </div>
  `;
}

// ============================================================
// ADMIN ACTIONS
// ============================================================

function selectEventType(type) {
  Object.keys(CONFIG.EVENT_TYPE_LABEL).forEach(k => {
    const el = document.getElementById('etype-' + k);
    if (!el) return;
    el.className = el.className.replace(/border-green-500 bg-green-900\/30 text-green-400/, '')
                               .replace(/border-gray-600 text-gray-400/, '').trim();
    if (k === type) {
      el.classList.add('border-green-500', 'bg-green-900/30', 'text-green-400');
    } else {
      el.classList.add('border-gray-600', 'text-gray-400');
    }
    const radio = el.previousElementSibling;
    if (radio) radio.checked = (k === type);
  });
}

async function quickAdjustScore(matchId, newHome, newAway, side) {
  if (newHome < 0 || newAway < 0) return;
  try {
    const res = await API.call('updateEventScore', {
      event_match_id: matchId,
      score_home: newHome,
      score_away: newAway
    });
    if (res.success) {
      liveState.match.score_home = newHome;
      liveState.match.score_away = newAway;
      _renderLiveScreen(document.getElementById('page-content'));
    } else showToast(res.error, 'error');
  } catch (e) { showToast('Lỗi cập nhật tỉ số', 'error'); }
}

async function submitAddMatchEvent(matchId) {
  const minute = document.getElementById('live-minute').value;
  const teamId = document.getElementById('live-team').value;
  const eventType = document.querySelector('input[name="live-etype"]:checked')?.value || 'goal';
  const playerName = document.getElementById('live-player').value.trim();
  const jerseyNumber = document.getElementById('live-jersey').value;
  const assistName = document.getElementById('live-assist').value.trim();

  if (!playerName && eventType !== 'yellow_card' && eventType !== 'red_card') {
    showToast('Nhập tên cầu thủ', 'warning');
    return;
  }

  showLoading(true);
  try {
    const res = await API.call('addMatchEvent', {
      event_match_id: matchId,
      minute: Number(minute) || 1,
      team_id: teamId,
      event_type: eventType,
      player_name: playerName,
      jersey_number: Number(jerseyNumber) || null,
      assist_name: assistName
    });
    if (res.success) {
      showToast('Đã thêm sự kiện', 'success');
      // Reload live data
      await _reloadLive();
    } else showToast(res.error, 'error');
  } finally { showLoading(false); }
}

async function _reloadLive() {
  try {
    const res = await API.call('getLiveMatch', {
      event_match_id: liveState.matchId,
      event_id: liveState.eventId
    });
    if (res.success && res.match) {
      liveState.match = res.match;
      liveState.events = res.events || [];
      _renderLiveScreen(document.getElementById('page-content'));
    }
  } catch (e) {}
}

function confirmRemoveLastEvent(matchId) {
  const lastEvent = liveState.events[liveState.events.length - 1];
  if (!lastEvent) return;
  confirmDialog(
    `Xóa sự kiện: ${CONFIG.EVENT_TYPE_LABEL[lastEvent.event_type]?.icon} phút ${lastEvent.minute}' — ${lastEvent.player_name}?`,
    async () => {
      showLoading(true);
      try {
        const res = await API.call('removeMatchEvent', {
          event_id_row: lastEvent.event_id_row,
          undo_score: true
        });
        if (res.success) {
          showToast('Đã xóa sự kiện', 'success');
          await _reloadLive();
        } else showToast(res.error, 'error');
      } finally { showLoading(false); }
    }
  );
}

function confirmFinishMatch(matchId) {
  confirmDialog(
    'Kết thúc trận? Hệ thống sẽ tự động tính bảng xếp hạng.',
    async () => {
      showLoading(true);
      try {
        const res = await API.call('finishEventMatch', { event_match_id: matchId });
        if (res.success) {
          _stopLivePoll();
          showToast('Kết thúc trận thành công!', 'success');
          await _reloadLive();
        } else showToast(res.error, 'error');
      } finally { showLoading(false); }
    }
  );
}

// ============================================================
// POLLING & TIMER
// ============================================================

function _startLivePoll(container) {
  _stopLivePoll();
  liveState.pollTimer = setInterval(async () => {
    // Chỉ poll nếu vẫn đang ở trang này
    if (document.getElementById('live-clock') === null && liveState.match?.status === 'ongoing') return;
    await _reloadLive();
  }, 15000);
}

function _stopLivePoll() {
  if (liveState.pollTimer) {
    clearInterval(liveState.pollTimer);
    liveState.pollTimer = null;
  }
  if (liveState.matchTimer) {
    clearInterval(liveState.matchTimer);
    liveState.matchTimer = null;
  }
}

function _startMatchTimer() {
  _stopMatchTimer();
  liveState.elapsedSeconds = 0;
  liveState.matchTimer = setInterval(() => {
    liveState.elapsedSeconds++;
    const el = document.getElementById('live-clock');
    if (el) {
      const mins = Math.floor(liveState.elapsedSeconds / 60);
      el.textContent = `${mins}'`;
    }
  }, 1000);
}

function _stopMatchTimer() {
  if (liveState.matchTimer) {
    clearInterval(liveState.matchTimer);
    liveState.matchTimer = null;
  }
}

// Cleanup khi rời trang (được gọi từ router nếu cần)
function cleanupTournamentLive() {
  _stopLivePoll();
}
