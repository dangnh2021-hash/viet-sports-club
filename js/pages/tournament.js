// ============================================================
// tournament.js - Giải đấu: danh sách, chi tiết, standings, lịch, top scorer, knockout
// ============================================================

// ---- State ----
let tournamentState = {
  currentEventId: null,
  activeTab: 'standings',  // standings | schedule | scorers | knockout
  eventData: null,
  groups: [],
  teams: [],
  standings: [],
  matches: [],
  scorers: [],
  knockoutSlots: []
};

// ============================================================
// MAIN RENDER
// ============================================================

async function renderTournament(container, params = {}) {
  if (params.event_id) {
    await renderEventDetail(container, params.event_id, params.tab || 'standings');
  } else {
    await renderEventList(container);
  }
}

// ============================================================
// EVENT LIST
// ============================================================

async function renderEventList(container) {
  showLoading(true);
  let events = [];
  try {
    const res = await API.call('getEvents', {});
    if (res.success) events = res.events || [];
  } catch (e) {
    showToast('Lỗi tải giải đấu', 'error');
  } finally {
    showLoading(false);
  }

  const user = getStoredUser();

  container.innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-white">🏆 Giải đấu</h1>
        ${user?.is_admin ? `
          <button onclick="openCreateEventModal()" class="btn btn-primary btn-sm">
            <i class="fas fa-plus mr-1"></i> Tạo giải
          </button>` : ''}
      </div>

      ${events.length === 0 ? `
        <div class="card">${emptyState('🏆', 'Chưa có giải đấu nào', 'Admin hãy tạo giải đấu đầu tiên')}</div>
      ` : events.map(ev => renderEventCard(ev)).join('')}
    </div>
  `;
}

function renderEventCard(ev) {
  const st = CONFIG.EVENT_STATUS[ev.status] || { label: ev.status, icon: '•', class: 'text-gray-400' };
  const dates = [ev.start_date, ev.end_date].filter(Boolean).map(d => formatDateShort(d)).join(' – ');
  return `
    <div class="card cursor-pointer hover:border-amber-500 transition" onclick="navigateTo('tournament', {event_id:'${ev.event_id}'})">
      <div class="flex items-start gap-3">
        <div class="text-3xl">${ev.logo_url ? `<img src="${ev.logo_url}" class="w-10 h-10 rounded-full object-cover">` : '🏆'}</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <h2 class="font-bold text-white text-lg">${ev.event_name}</h2>
            <span class="${st.class} text-sm">${st.icon} ${st.label}</span>
          </div>
          ${ev.description ? `<p class="text-gray-400 text-sm mt-0.5">${ev.description}</p>` : ''}
          <div class="flex gap-4 mt-1 text-gray-500 text-xs flex-wrap">
            ${dates ? `<span>📅 ${dates}</span>` : ''}
            ${ev.venue_name ? `<span>📍 ${ev.venue_name}</span>` : ''}
          </div>
        </div>
        <i class="fas fa-chevron-right text-gray-600 mt-1"></i>
      </div>
    </div>
  `;
}

// ============================================================
// EVENT DETAIL
// ============================================================

async function renderEventDetail(container, eventId, tab = 'standings') {
  tournamentState.currentEventId = eventId;
  tournamentState.activeTab = tab;

  showLoading(true);
  try {
    const [detailRes, schedRes] = await Promise.all([
      API.call('getEventDetail', { event_id: eventId }),
      API.call('getEventSchedule', { event_id: eventId })
    ]);
    if (detailRes.success) {
      tournamentState.eventData = detailRes.event;
      tournamentState.groups = detailRes.groups || [];
      tournamentState.teams = detailRes.teams || [];
      tournamentState.standings = detailRes.standings || [];
    }
    if (schedRes.success) {
      tournamentState.matches = schedRes.matches || [];
    }
  } catch (e) {
    showToast('Lỗi tải dữ liệu giải đấu', 'error');
  } finally {
    showLoading(false);
  }

  _renderEventDetailLayout(container);
}

function _renderEventDetailLayout(container) {
  const ev = tournamentState.eventData;
  if (!ev) { container.innerHTML = `<div class="card">${emptyState('❌', 'Không tìm thấy giải đấu')}</div>`; return; }

  const st = CONFIG.EVENT_STATUS[ev.status] || { label: ev.status, icon: '•', class: 'text-gray-400' };
  const user = getStoredUser();

  container.innerHTML = `
    <div class="space-y-4">
      <!-- Header -->
      <div class="flex items-center gap-2">
        <button onclick="navigateTo('tournament')" class="text-gray-400 hover:text-white transition">
          <i class="fas fa-arrow-left"></i>
        </button>
        <div class="flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <h1 class="text-xl font-bold text-white">${ev.event_name}</h1>
            <span class="${st.class} text-sm">${st.icon} ${st.label}</span>
          </div>
          <div class="text-gray-500 text-xs mt-0.5 flex gap-3 flex-wrap">
            ${ev.venue_name ? `<span>📍 ${ev.venue_name}</span>` : ''}
            ${ev.start_date ? `<span>📅 ${formatDateShort(ev.start_date)} – ${formatDateShort(ev.end_date)}</span>` : ''}
          </div>
        </div>
        ${user?.is_admin ? `
          <button onclick="openManageEventModal('${ev.event_id}')" class="btn btn-secondary btn-sm">
            <i class="fas fa-cog"></i>
          </button>` : ''}
      </div>

      <!-- Tabs -->
      <div class="flex gap-1 bg-gray-800 p-1 rounded-xl overflow-x-auto">
        ${[
          { key: 'standings', icon: '📊', label: 'Bảng đấu' },
          { key: 'schedule',  icon: '📅', label: 'Lịch thi đấu' },
          { key: 'scorers',   icon: '🏅', label: 'Vua phá lưới' },
          { key: 'knockout',  icon: '🎯', label: 'Knockout' }
        ].map(t => `
          <button onclick="switchTournamentTab('${t.key}')" id="ttab-${t.key}"
            class="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition whitespace-nowrap ${
              tournamentState.activeTab === t.key ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-white'
            }">
            ${t.icon} ${t.label}
          </button>
        `).join('')}
      </div>

      <!-- Tab content -->
      <div id="tournament-tab-content"></div>
    </div>
  `;

  _renderActiveTab();
}

function switchTournamentTab(tab) {
  tournamentState.activeTab = tab;
  document.querySelectorAll('[id^="ttab-"]').forEach(btn => {
    const key = btn.id.replace('ttab-', '');
    btn.className = `flex-1 py-2 px-3 rounded-lg text-sm font-medium transition whitespace-nowrap ${
      key === tab ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-white'
    }`;
  });
  _renderActiveTab();
}

async function _renderActiveTab() {
  const content = document.getElementById('tournament-tab-content');
  if (!content) return;

  switch (tournamentState.activeTab) {
    case 'standings': content.innerHTML = _buildStandingsTab(); break;
    case 'schedule':  content.innerHTML = _buildScheduleTab(); break;
    case 'scorers':   await _loadAndBuildScorers(content); break;
    case 'knockout':  await _loadAndBuildKnockout(content); break;
  }
}

// ---- STANDINGS TAB ----

function _buildStandingsTab() {
  const { groups, teams, standings } = tournamentState;
  const user = getStoredUser();
  const teamMap = {};
  teams.forEach(t => { teamMap[t.event_team_id] = t; });

  if (groups.length === 0) {
    return `<div class="card">${emptyState('📊', 'Chưa có bảng đấu nào', 'Admin cần cấu hình bảng đấu')}</div>`;
  }

  return groups.map(g => {
    const groupStandings = standings
      .filter(s => s.group_id === g.group_id)
      .sort((a, b) => Number(a.rank) - Number(b.rank));

    const groupTeams = teams.filter(t => t.group_id === g.group_id);

    return `
      <div class="card mb-3">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-bold text-white text-base">${g.group_name}</h3>
          ${user?.is_admin ? `
            <button onclick="openAddTeamModal('${tournamentState.currentEventId}', '${g.group_id}')" class="text-xs text-amber-400 hover:text-amber-300">
              <i class="fas fa-plus-circle mr-1"></i>Thêm đội
            </button>` : ''}
        </div>
        ${groupTeams.length === 0
          ? `<p class="text-gray-500 text-sm text-center py-2">Chưa có đội nào</p>`
          : `<div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-gray-500 text-xs border-b border-gray-700">
                  <th class="text-left pb-2 pr-2">#</th>
                  <th class="text-left pb-2">Đội</th>
                  <th class="text-center pb-2 px-1">Đ</th>
                  <th class="text-center pb-2 px-1">T</th>
                  <th class="text-center pb-2 px-1">H</th>
                  <th class="text-center pb-2 px-1">B</th>
                  <th class="text-center pb-2 px-1">BT</th>
                  <th class="text-center pb-2 px-1">BA</th>
                  <th class="text-center pb-2 px-1">ĐS</th>
                  <th class="text-center pb-2 font-bold text-amber-400">Điểm</th>
                </tr>
              </thead>
              <tbody>
                ${groupTeams.map((team, idx) => {
                  const s = groupStandings.find(st => st.event_team_id === team.event_team_id);
                  const rank = s ? Number(s.rank) : idx + 1;
                  const adv = tournamentState.eventData ? Number(tournamentState.eventData.advance_per_group) || 2 : 2;
                  const rowBg = rank <= adv ? 'bg-green-900/20' : '';
                  return `
                    <tr class="border-b border-gray-700/50 ${rowBg}">
                      <td class="py-2 pr-2 text-gray-400 font-medium">${rank}</td>
                      <td class="py-2">
                        <div class="flex items-center gap-2">
                          <div class="w-3 h-3 rounded-full flex-shrink-0" style="background:${team.team_color || '#6B7280'}"></div>
                          <span class="text-white font-medium truncate max-w-24">${team.team_name}</span>
                        </div>
                      </td>
                      <td class="text-center py-2 px-1 text-gray-300">${s?.played || 0}</td>
                      <td class="text-center py-2 px-1 text-green-400">${s?.wins || 0}</td>
                      <td class="text-center py-2 px-1 text-gray-300">${s?.draws || 0}</td>
                      <td class="text-center py-2 px-1 text-red-400">${s?.losses || 0}</td>
                      <td class="text-center py-2 px-1 text-gray-300">${s?.goals_for || 0}</td>
                      <td class="text-center py-2 px-1 text-gray-300">${s?.goals_against || 0}</td>
                      <td class="text-center py-2 px-1 ${Number(s?.goal_diff) >= 0 ? 'text-green-400' : 'text-red-400'}">${s ? (Number(s.goal_diff) >= 0 ? '+' : '') + s.goal_diff : '-'}</td>
                      <td class="text-center py-2 font-bold text-amber-400">${s?.points || 0}</td>
                    </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>`
        }
        ${user?.is_admin ? `
          <div class="mt-3 flex gap-2 flex-wrap">
            <button onclick="openGenerateScheduleModal('${tournamentState.currentEventId}', '${g.group_id}', '${g.group_name}')"
              class="btn btn-secondary btn-sm text-xs">
              <i class="fas fa-calendar-plus mr-1"></i> Tạo lịch bảng này
            </button>
          </div>` : ''}
      </div>
    `;
  }).join('');
}

// ---- SCHEDULE TAB ----

function _buildScheduleTab() {
  const { matches, teams, groups } = tournamentState;
  const teamMap = {};
  teams.forEach(t => { teamMap[t.event_team_id] = t; });
  const groupMap = {};
  groups.forEach(g => { groupMap[g.group_id] = g; });

  if (matches.length === 0) {
    return `<div class="card">${emptyState('📅', 'Chưa có lịch thi đấu', 'Admin cần tạo lịch bảng đấu')}</div>`;
  }

  // Group by round_number
  const byRound = {};
  matches.forEach(m => {
    const key = m.stage === 'group' ? `round_${m.round_number}` : m.stage;
    if (!byRound[key]) byRound[key] = { label: '', matches: [] };
    if (m.stage === 'group') byRound[key].label = `Lượt ${m.round_number}`;
    else byRound[key].label = CONFIG.KNOCKOUT_STAGE_LABEL[m.stage] || m.stage;
    byRound[key].matches.push(m);
  });

  const user = getStoredUser();

  return Object.entries(byRound).map(([key, round]) => `
    <div class="card mb-3">
      <h3 class="font-bold text-white mb-3">${round.label}</h3>
      <div class="space-y-2">
        ${round.matches.map(m => {
          const home = teamMap[m.team_home_id] || { team_name: m.team_home_id, team_color: '#6B7280' };
          const away = teamMap[m.team_away_id] || { team_name: m.team_away_id, team_color: '#6B7280' };
          const isLive = m.status === 'ongoing';
          const isDone = m.status === 'completed';
          const group = m.group_id ? groupMap[m.group_id] : null;

          return `
            <div class="bg-gray-700/50 rounded-xl p-3 ${isLive ? 'border border-green-400' : ''}">
              <div class="flex items-center gap-2 text-xs text-gray-500 mb-2">
                ${group ? `<span class="text-amber-400 font-medium">[${group.group_name}]</span>` : ''}
                ${m.match_date ? `<span>📅 ${formatDateShort(m.match_date)}</span>` : ''}
                ${m.start_time ? `<span>⏰ ${formatTime(m.start_time)}</span>` : ''}
                ${m.venue ? `<span>📍 ${m.venue}</span>` : ''}
                ${isLive ? `<span class="text-green-400 font-semibold animate-pulse">🟢 LIVE</span>` : ''}
              </div>
              <div class="flex items-center gap-2">
                <div class="flex-1 flex items-center gap-2 justify-end">
                  <span class="font-semibold text-white text-sm truncate">${home.team_name}</span>
                  <div class="w-3 h-3 rounded-full flex-shrink-0" style="background:${home.team_color}"></div>
                </div>
                <div class="text-center w-16 flex-shrink-0">
                  ${isDone || isLive
                    ? `<span class="text-xl font-bold text-white">${m.score_home ?? 0} – ${m.score_away ?? 0}</span>`
                    : `<span class="text-gray-500 text-sm">vs</span>`
                  }
                </div>
                <div class="flex-1 flex items-center gap-2">
                  <div class="w-3 h-3 rounded-full flex-shrink-0" style="background:${away.team_color}"></div>
                  <span class="font-semibold text-white text-sm truncate">${away.team_name}</span>
                </div>
              </div>
              <!-- Admin controls -->
              ${user?.is_admin ? `
                <div class="flex gap-2 mt-2 pt-2 border-t border-gray-600/50 flex-wrap">
                  ${m.status === 'scheduled' ? `
                    <button onclick="startEventMatch('${m.event_match_id}')" class="btn btn-sm text-xs bg-green-700 hover:bg-green-600 text-white px-2 py-1">
                      🟢 Bắt đầu
                    </button>` : ''}
                  ${isLive ? `
                    <button onclick="navigateTo('tournament-live', {event_match_id:'${m.event_match_id}',event_id:'${m.event_id}'})" class="btn btn-sm text-xs bg-green-600 hover:bg-green-500 text-white px-2 py-1">
                      📺 Live scoring
                    </button>` : ''}
                  ${isDone ? `<span class="text-green-400 text-xs">✅ Hoàn thành</span>` : ''}
                </div>` : `
              ${isLive ? `
                <div class="mt-2">
                  <button onclick="navigateTo('tournament-live', {event_match_id:'${m.event_match_id}',event_id:'${m.event_id}'})" class="btn btn-sm text-xs text-green-400 border border-green-600 px-2 py-1 rounded-lg">
                    📺 Xem live
                  </button>
                </div>` : ''}
              `}
            </div>`;
        }).join('')}
      </div>
    </div>
  `).join('');
}

// ---- SCORERS TAB ----

async function _loadAndBuildScorers(container) {
  container.innerHTML = '<div class="text-center py-8 text-gray-400">Đang tải...</div>';
  try {
    const res = await API.call('getTopScorers', { event_id: tournamentState.currentEventId });
    if (res.success) {
      tournamentState.scorers = res.scorers || [];
      container.innerHTML = _buildScorersTab();
    }
  } catch (e) {
    container.innerHTML = `<div class="card">${emptyState('❌', 'Lỗi tải dữ liệu')}</div>`;
  }
}

function _buildScorersTab() {
  const { scorers } = tournamentState;
  if (scorers.length === 0) {
    return `<div class="card">${emptyState('🏅', 'Chưa có bàn thắng nào được ghi nhận')}</div>`;
  }

  const medals = ['🥇', '🥈', '🥉'];
  return `
    <div class="card">
      <h3 class="font-bold text-white mb-3">⚽ Bảng vua phá lưới</h3>
      <div class="space-y-2">
        ${scorers.map((s, idx) => `
          <div class="flex items-center gap-3 py-2 border-b border-gray-700/50">
            <div class="w-7 text-center font-bold ${idx < 3 ? 'text-xl' : 'text-gray-400 text-sm'}">
              ${idx < 3 ? medals[idx] : idx + 1}
            </div>
            <div class="flex-1">
              <div class="text-white font-semibold">${s.jersey_number ? `#${s.jersey_number} ` : ''}${s.player_name}</div>
              <div class="text-gray-500 text-xs">${s.team_name}</div>
            </div>
            <div class="text-amber-400 font-bold text-lg">${s.goals} <span class="text-xs text-gray-400">bàn</span></div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ---- KNOCKOUT TAB ----

async function _loadAndBuildKnockout(container) {
  container.innerHTML = '<div class="text-center py-8 text-gray-400">Đang tải...</div>';
  try {
    const res = await API.call('getKnockoutBracket', { event_id: tournamentState.currentEventId });
    if (res.success) {
      tournamentState.knockoutSlots = res.slots || [];
      tournamentState.knockoutMatches = res.matches || [];
      tournamentState.knockoutTeams = res.teams || [];
      container.innerHTML = _buildKnockoutTab();
    }
  } catch (e) {
    container.innerHTML = `<div class="card">${emptyState('❌', 'Lỗi tải dữ liệu')}</div>`;
  }
}

function _buildKnockoutTab() {
  const { knockoutSlots, knockoutTeams, knockoutMatches } = tournamentState;
  const user = getStoredUser();

  if (!knockoutSlots || knockoutSlots.length === 0) {
    return `
      <div class="card">
        ${emptyState('🎯', 'Chưa có bracket knockout', 'Admin cần advance vòng bảng trước')}
        ${user?.is_admin ? `
          <div class="text-center mt-4">
            <button onclick="adminAdvanceToKnockout('${tournamentState.currentEventId}')" class="btn btn-primary btn-sm">
              <i class="fas fa-arrow-right mr-1"></i> Advance to Knockout
            </button>
          </div>` : ''}
      </div>`;
  }

  const teamMap = {};
  (knockoutTeams || tournamentState.teams).forEach(t => { teamMap[t.event_team_id] = t; });

  // Group slots by stage
  const byStage = {};
  knockoutSlots.forEach(s => {
    if (!byStage[s.stage]) byStage[s.stage] = [];
    byStage[s.stage].push(s);
  });

  const stageOrder = ['r16', 'qf', 'sf', 'third_place', 'final'];

  return `
    <div class="space-y-4">
      ${stageOrder.filter(s => byStage[s]).map(stage => `
        <div class="card">
          <h3 class="font-bold text-white mb-3">${CONFIG.KNOCKOUT_STAGE_LABEL[stage] || stage}</h3>
          <div class="space-y-3">
            ${byStage[stage].sort((a, b) => Number(a.match_slot) - Number(b.match_slot)).map(slot => {
              const homeTeam = slot.team_home_id ? teamMap[slot.team_home_id] : null;
              const awayTeam = slot.team_away_id ? teamMap[slot.team_away_id] : null;
              // Find match for this slot
              const match = knockoutMatches ? knockoutMatches.find(m => m.event_match_id === slot.event_match_id) : null;

              return `
                <div class="bg-gray-700/50 rounded-xl p-3">
                  <div class="flex items-center gap-2">
                    <div class="flex-1 flex items-center gap-2 justify-end">
                      ${homeTeam ? `<div class="w-3 h-3 rounded-full" style="background:${homeTeam.team_color}"></div>` : ''}
                      <span class="font-semibold text-sm ${homeTeam ? 'text-white' : 'text-gray-500'}">
                        ${homeTeam ? homeTeam.team_name : slot.slot_label_home || 'TBD'}
                      </span>
                    </div>
                    <div class="text-center w-16 flex-shrink-0">
                      ${match && (match.status === 'completed' || match.status === 'ongoing')
                        ? `<span class="text-xl font-bold ${match.status === 'ongoing' ? 'text-green-400' : 'text-white'}">${match.score_home ?? 0}–${match.score_away ?? 0}</span>`
                        : `<span class="text-gray-500 text-sm">vs</span>`}
                    </div>
                    <div class="flex-1 flex items-center gap-2">
                      ${awayTeam ? `<div class="w-3 h-3 rounded-full" style="background:${awayTeam.team_color}"></div>` : ''}
                      <span class="font-semibold text-sm ${awayTeam ? 'text-white' : 'text-gray-500'}">
                        ${awayTeam ? awayTeam.team_name : slot.slot_label_away || 'TBD'}
                      </span>
                    </div>
                  </div>
                  ${slot.winner_team_id ? `
                    <div class="text-center mt-1 text-xs text-amber-400">
                      🏆 ${teamMap[slot.winner_team_id]?.team_name || slot.winner_team_id}
                    </div>` : ''}
                  ${user?.is_admin && match?.status === 'ongoing' ? `
                    <div class="text-center mt-2">
                      <button onclick="navigateTo('tournament-live', {event_match_id:'${match.event_match_id}',event_id:'${match.event_id}'})"
                        class="btn btn-sm text-xs bg-green-600 text-white px-3 py-1 rounded-lg">📺 Live scoring</button>
                    </div>` : ''}
                </div>`;
            }).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ============================================================
// ADMIN ACTIONS (modals & quick ops)
// ============================================================

function openCreateEventModal() {
  openModal(`
    <div class="p-5">
      <h3 class="text-white font-bold text-lg mb-4">🏆 Tạo giải đấu mới</h3>
      <div class="space-y-3">
        <div>
          <label class="block text-sm text-gray-400 mb-1">Tên giải *</label>
          <input id="ev-name" type="text" placeholder="Viet Sports Club Cup 2026" class="form-input" />
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-1">Mô tả</label>
          <input id="ev-desc" type="text" placeholder="Giải mini football nội bộ..." class="form-input" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm text-gray-400 mb-1">Ngày bắt đầu</label>
            <input id="ev-start" type="date" class="form-input" />
          </div>
          <div>
            <label class="block text-sm text-gray-400 mb-1">Ngày kết thúc</label>
            <input id="ev-end" type="date" class="form-input" />
          </div>
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-1">Tên sân</label>
          <input id="ev-venue" type="text" placeholder="Sân ABC" class="form-input" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm text-gray-400 mb-1">Số đội / bảng</label>
            <select id="ev-tpg" class="form-input">
              <option value="3">3 đội</option>
              <option value="4" selected>4 đội</option>
              <option value="5">5 đội</option>
            </select>
          </div>
          <div>
            <label class="block text-sm text-gray-400 mb-1">Đội đi tiếp / bảng</label>
            <select id="ev-apg" class="form-input">
              <option value="1">1 đội (Nhất)</option>
              <option value="2" selected>2 đội (Nhất + Nhì)</option>
            </select>
          </div>
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-1">Tên bảng đấu (mỗi dòng 1 bảng)</label>
          <textarea id="ev-groups" rows="3" placeholder="Bảng A&#10;Bảng B&#10;Bảng C" class="form-input"></textarea>
        </div>
      </div>
      <div class="flex gap-2 mt-4">
        <button onclick="closeModal()" class="btn btn-secondary flex-1">Hủy</button>
        <button onclick="submitCreateEvent()" class="btn btn-primary flex-1">Tạo giải đấu</button>
      </div>
    </div>
  `);
}

async function submitCreateEvent() {
  const name = document.getElementById('ev-name').value.trim();
  if (!name) { showToast('Nhập tên giải đấu', 'error'); return; }

  const groupsRaw = document.getElementById('ev-groups').value.trim();
  const groupNames = groupsRaw ? groupsRaw.split('\n').map(s => s.trim()).filter(Boolean) : [];

  showLoading(true);
  try {
    const res = await API.call('createEvent', {
      event_name: name,
      description: document.getElementById('ev-desc').value.trim(),
      start_date: document.getElementById('ev-start').value,
      end_date: document.getElementById('ev-end').value,
      venue_name: document.getElementById('ev-venue').value.trim(),
      teams_per_group: Number(document.getElementById('ev-tpg').value),
      advance_per_group: Number(document.getElementById('ev-apg').value)
    });

    if (!res.success) { showToast(res.error, 'error'); return; }

    const eventId = res.event_id;

    // Auto-tạo groups nếu có
    if (groupNames.length > 0) {
      await API.call('createGroups', { event_id: eventId, group_names: groupNames });
    }

    closeModal();
    showToast('Tạo giải đấu thành công!', 'success');
    await renderEventList(document.getElementById('page-content'));
  } catch (e) {
    showToast('Lỗi tạo giải đấu', 'error');
  } finally {
    showLoading(false);
  }
}

function openManageEventModal(eventId) {
  const ev = tournamentState.eventData;
  openModal(`
    <div class="p-5">
      <h3 class="text-white font-bold text-lg mb-4">⚙️ Quản lý giải: ${ev?.event_name}</h3>
      <div class="space-y-2">
        <button onclick="closeModal(); openAddGroupModal('${eventId}')" class="w-full btn btn-secondary text-left">
          <i class="fas fa-plus-circle text-amber-400 mr-2"></i> Thêm bảng đấu
        </button>
        <button onclick="closeModal(); openCreateGuestAccountModal('${eventId}')" class="w-full btn btn-secondary text-left">
          <i class="fas fa-user-plus text-blue-400 mr-2"></i> Tạo tài khoản đội khách
        </button>
        <button onclick="closeModal(); adminAdvanceToKnockout('${eventId}')" class="w-full btn btn-secondary text-left">
          <i class="fas fa-arrow-right text-green-400 mr-2"></i> Advance to Knockout
        </button>
        <div class="border-t border-gray-700 pt-2">
          <p class="text-xs text-gray-500 mb-2">Cập nhật trạng thái giải:</p>
          ${['draft','group_stage','knockout','completed'].map(s => `
            <button onclick="adminUpdateEventStatus('${eventId}','${s}')"
              class="btn btn-sm btn-secondary mr-1 mb-1 text-xs ${ev?.status === s ? 'border-amber-500 text-amber-400' : ''}">
              ${CONFIG.EVENT_STATUS[s]?.icon} ${CONFIG.EVENT_STATUS[s]?.label}
            </button>`).join('')}
        </div>
      </div>
      <button onclick="closeModal()" class="w-full btn btn-secondary mt-3">Đóng</button>
    </div>
  `);
}

function openAddGroupModal(eventId) {
  openModal(`
    <div class="p-5">
      <h3 class="text-white font-bold text-lg mb-4">➕ Thêm bảng đấu</h3>
      <label class="block text-sm text-gray-400 mb-1">Tên bảng (mỗi dòng 1 bảng)</label>
      <textarea id="new-groups" rows="4" placeholder="Bảng A&#10;Bảng B" class="form-input mb-4"></textarea>
      <div class="flex gap-2">
        <button onclick="closeModal()" class="btn btn-secondary flex-1">Hủy</button>
        <button onclick="submitAddGroups('${eventId}')" class="btn btn-primary flex-1">Thêm</button>
      </div>
    </div>
  `);
}

async function submitAddGroups(eventId) {
  const raw = document.getElementById('new-groups').value.trim();
  const names = raw.split('\n').map(s => s.trim()).filter(Boolean);
  if (!names.length) { showToast('Nhập tên bảng', 'error'); return; }
  showLoading(true);
  try {
    const res = await API.call('createGroups', { event_id: eventId, group_names: names });
    if (res.success) {
      closeModal();
      showToast(`Đã tạo ${names.length} bảng`, 'success');
      await renderEventDetail(document.getElementById('page-content'), eventId, tournamentState.activeTab);
    } else showToast(res.error, 'error');
  } finally { showLoading(false); }
}

function openAddTeamModal(eventId, groupId) {
  openModal(`
    <div class="p-5">
      <h3 class="text-white font-bold text-lg mb-4">➕ Thêm đội vào bảng</h3>
      <div class="space-y-3">
        <div>
          <label class="block text-sm text-gray-400 mb-1">Tên đội *</label>
          <input id="at-name" type="text" placeholder="FC Example" class="form-input" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm text-gray-400 mb-1">Màu đội</label>
            <input id="at-color" type="color" value="#EF4444" class="w-full h-10 rounded-lg cursor-pointer bg-transparent border border-gray-600" />
          </div>
          <div>
            <label class="block text-sm text-gray-400 mb-1">Loại</label>
            <select id="at-type" class="form-input">
              <option value="guest">Đội khách</option>
              <option value="internal">Đội nội bộ</option>
            </select>
          </div>
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-1">Tên liên hệ</label>
          <input id="at-contact" type="text" placeholder="Nguyễn Văn A" class="form-input" />
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-1">SĐT liên hệ</label>
          <input id="at-phone" type="text" placeholder="0912..." class="form-input" />
        </div>
      </div>
      <div class="flex gap-2 mt-4">
        <button onclick="closeModal()" class="btn btn-secondary flex-1">Hủy</button>
        <button onclick="submitAddTeam('${eventId}', '${groupId}')" class="btn btn-primary flex-1">Thêm đội</button>
      </div>
    </div>
  `);
}

async function submitAddTeam(eventId, groupId) {
  const name = document.getElementById('at-name').value.trim();
  if (!name) { showToast('Nhập tên đội', 'error'); return; }
  showLoading(true);
  try {
    const res = await API.call('addEventTeam', {
      event_id: eventId,
      group_id: groupId,
      team_name: name,
      team_color: document.getElementById('at-color').value,
      team_type: document.getElementById('at-type').value,
      contact_name: document.getElementById('at-contact').value.trim(),
      contact_phone: document.getElementById('at-phone').value.trim()
    });
    if (res.success) {
      closeModal();
      showToast(`Đã thêm đội ${name}`, 'success');
      await renderEventDetail(document.getElementById('page-content'), eventId, tournamentState.activeTab);
    } else showToast(res.error, 'error');
  } finally { showLoading(false); }
}

function openGenerateScheduleModal(eventId, groupId, groupName) {
  openModal(`
    <div class="p-5">
      <h3 class="text-white font-bold text-lg mb-3">📅 Tạo lịch ${groupName}</h3>
      <p class="text-gray-400 text-sm mb-4">
        Hệ thống sẽ tự động tạo lịch vòng tròn (round-robin) cho tất cả đội trong bảng này.
        Các trận đã tồn tại sẽ không bị xóa.
      </p>
      <div class="flex gap-2">
        <button onclick="closeModal()" class="btn btn-secondary flex-1">Hủy</button>
        <button onclick="submitGenerateSchedule('${eventId}', '${groupId}')" class="btn btn-primary flex-1">
          <i class="fas fa-magic mr-1"></i> Tạo lịch
        </button>
      </div>
    </div>
  `);
}

async function submitGenerateSchedule(eventId, groupId) {
  showLoading(true);
  try {
    const res = await API.call('generateGroupSchedule', { event_id: eventId, group_id: groupId });
    if (res.success) {
      closeModal();
      showToast(`Đã tạo ${res.matches_created} trận`, 'success');
      await renderEventDetail(document.getElementById('page-content'), eventId, 'schedule');
    } else showToast(res.error, 'error');
  } finally { showLoading(false); }
}

function openCreateGuestAccountModal(eventId) {
  openModal(`
    <div class="p-5">
      <h3 class="text-white font-bold text-lg mb-4">👥 Tạo tài khoản đội khách</h3>
      <p class="text-gray-400 text-sm mb-3">Hệ thống sẽ tạo username/password để đội khách đăng nhập xem giải đấu.</p>
      <div>
        <label class="block text-sm text-gray-400 mb-1">Tên đội *</label>
        <input id="ga-teamname" type="text" placeholder="FC Example" class="form-input" />
      </div>
      <div id="ga-result" class="hidden mt-3 bg-gray-700 rounded-xl p-4 text-sm">
        <p class="text-gray-400 mb-2">Thông tin đăng nhập (gửi cho đội):</p>
        <div class="font-mono text-white" id="ga-info"></div>
      </div>
      <div class="flex gap-2 mt-4">
        <button onclick="closeModal()" class="btn btn-secondary flex-1">Đóng</button>
        <button onclick="submitCreateGuestAccount()" class="btn btn-primary flex-1" id="ga-btn">Tạo tài khoản</button>
      </div>
    </div>
  `);
}

async function submitCreateGuestAccount() {
  const name = document.getElementById('ga-teamname').value.trim();
  if (!name) { showToast('Nhập tên đội', 'error'); return; }
  document.getElementById('ga-btn').disabled = true;
  showLoading(true);
  try {
    const res = await API.call('createGuestUserAccount', { team_name: name });
    if (res.success) {
      document.getElementById('ga-result').classList.remove('hidden');
      document.getElementById('ga-info').innerHTML = `
        Username: <span class="text-green-400">${res.username}</span><br>
        Password: <span class="text-green-400">${res.password}</span>
      `;
      showToast('Tạo tài khoản thành công', 'success');
    } else showToast(res.error, 'error');
  } finally {
    showLoading(false);
    document.getElementById('ga-btn').disabled = false;
  }
}

async function startEventMatch(matchId) {
  showLoading(true);
  try {
    const res = await API.call('startEventMatch', { event_match_id: matchId });
    if (res.success) {
      showToast('Trận đã bắt đầu', 'success');
      await renderEventDetail(document.getElementById('page-content'), tournamentState.currentEventId, 'schedule');
    } else showToast(res.error, 'error');
  } finally { showLoading(false); }
}

async function adminUpdateEventStatus(eventId, status) {
  showLoading(true);
  try {
    const res = await API.call('updateEvent', { event_id: eventId, updates: { status } });
    if (res.success) {
      closeModal();
      showToast(`Trạng thái → ${CONFIG.EVENT_STATUS[status]?.label}`, 'success');
      await renderEventDetail(document.getElementById('page-content'), eventId, tournamentState.activeTab);
    } else showToast(res.error, 'error');
  } finally { showLoading(false); }
}

async function adminAdvanceToKnockout(eventId) {
  showLoading(true);
  try {
    const res = await API.call('advanceToKnockout', { event_id: eventId });
    if (res.success) {
      showToast(`${res.message} — Xem tab Knockout để confirm`, 'success');
      await renderEventDetail(document.getElementById('page-content'), eventId, 'knockout');
    } else showToast(res.error, 'error');
  } finally { showLoading(false); }
}
