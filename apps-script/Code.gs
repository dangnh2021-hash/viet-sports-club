// ============================================================
// Code.gs - Main Router: doGet / doPost
// ============================================================

function doGet(e) {
  return ContentService.createTextOutput(
    JSON.stringify({ status: 'ok', message: 'Viet Sports Club API is running 🟢' })
  ).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const raw = e.postData ? e.postData.contents : '{}';
    const data = JSON.parse(raw);
    const action = data.action;

    if (!action) {
      return respond(error('Missing action'));
    }

    let result;

    switch (action) {
      // ---- Auth ----
      case 'login':           result = login(data); break;
      case 'register':        result = register(data); break;
      case 'logout':          result = logout(data); break;
      case 'getProfile':      result = getProfile(data); break;
      case 'updateProfile':   result = updateProfile(data); break;
      case 'updateUserStats': result = updateUserStats(data); break;
      case 'getUsers':        result = getUsers(data); break;
      case 'adminUpdateUser': result = adminUpdateUser(data); break;

      // ---- Matches ----
      case 'createMatch':     result = createMatch(data); break;
      case 'getMatches':      result = getMatches(data); break;
      case 'getUpcomingMatches': result = getUpcomingMatches(data); break;
      case 'updateMatch':     result = updateMatch(data); break;
      case 'deleteMatch':     result = deleteMatch(data); break;
      case 'getMatchDetail':  result = getMatchDetail(data); break;

      // ---- Attendance ----
      case 'vote':            result = vote(data); break;
      case 'getAttendance':   result = getAttendance(data); break;
      case 'getMyVote':       result = getMyVote(data); break;

      // ---- Guest Teams ----
      case 'addGuestTeam':    result = addGuestTeam(data); break;
      case 'getGuestTeams':   result = getGuestTeams(data); break;
      case 'deleteGuestTeam': result = deleteGuestTeam(data); break;

      // ---- Team Formation ----
      case 'suggestTeams':    result = suggestTeams(data); break;
      case 'saveTeams':       result = saveTeams(data); break;
      case 'getTeams':        result = getTeams(data); break;

      // ---- Results ----
      case 'saveMatchResult': result = saveMatchResult(data); break;
      case 'getResults':      result = getResults(data); break;
      case 'generateSchedule': result = generateRoundRobinSchedule(data); break;
      case 'addMatchResult':  result = addMatchResult(data); break;
      case 'deleteMatchResults': result = deleteMatchResults(data); break;
      case 'deleteMatchResult': result = deleteMatchResult(data); break;

      // ---- Ratings ----
      case 'getLeaderboard':  result = getLeaderboard(data); break;
      case 'getRatingHistory': result = getRatingHistory(data); break;
      case 'awardMVP':        result = awardMVP(data); break;
      case 'adminAdjustRating': result = adminAdjustRating(data); break;

      // ---- Tournament ----
      case 'createEvent':             result = createEvent(data); break;
      case 'updateEvent':             result = updateEvent(data); break;
      case 'createGroups':            result = createGroups(data); break;
      case 'addEventTeam':            result = addEventTeam(data); break;
      case 'removeEventTeam':         result = removeEventTeam(data); break;
      case 'generateGroupSchedule':   result = generateGroupSchedule(data); break;
      case 'updateEventMatch':        result = updateEventMatch(data); break;
      case 'createGuestUserAccount':  result = createGuestUserAccount(data); break;
      case 'startEventMatch':         result = startEventMatch(data); break;
      case 'updateEventScore':        result = updateEventScore(data); break;
      case 'addMatchEvent':           result = addMatchEvent(data); break;
      case 'removeMatchEvent':        result = removeMatchEvent(data); break;
      case 'finishEventMatch':        result = finishEventMatch(data); break;
      case 'advanceToKnockout':       result = advanceToKnockout(data); break;
      case 'confirmKnockoutBracket':  result = confirmKnockoutBracket(data); break;
      case 'advanceKnockoutWinner':   result = advanceKnockoutWinner(data); break;
      case 'getEvents':               result = getEvents(data); break;
      case 'getEventDetail':          result = getEventDetail(data); break;
      case 'getGroupStandings':       result = getGroupStandings(data); break;
      case 'getEventSchedule':        result = getEventSchedule(data); break;
      case 'getEventMatchDetail':     result = getEventMatchDetail(data); break;
      case 'getTopScorers':           result = getTopScorers(data); break;
      case 'getKnockoutBracket':      result = getKnockoutBracket(data); break;
      case 'getLiveMatch':            result = getLiveMatch(data); break;

      default:
        result = error(`Unknown action: ${action}`);
    }

    return respond(result);

  } catch (err) {
    Logger.log('Error in doPost: ' + err.message + '\n' + err.stack);
    return respond(error(err.message));
  }
}

function respond(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
