// ========================================
// Data Service - localStorage + GitHub API sync
// ========================================

const DataService = (() => {
  const DATA_VERSION = '3';
  let config = null;
  let actividades = null;
  let helpers = null;

  // Version check: wipe old localStorage on version change
  (function checkVersion() {
    const stored = localStorage.getItem('data_version');
    if (stored !== DATA_VERSION) {
      localStorage.removeItem('actividades');
      localStorage.removeItem('helpers');
      const keys = Object.keys(localStorage).filter(k => k.startsWith('agenda_'));
      keys.forEach(k => localStorage.removeItem(k));
      localStorage.setItem('data_version', DATA_VERSION);
    }
  })();

  async function fetchJSON(path) {
    const resp = await fetch(path);
    if (!resp.ok) throw new Error(`Error cargando ${path}: ${resp.status}`);
    return resp.json();
  }

  // ---- GitHub API write ----
  async function writeToGitHub(filePath, data) {
    const token = localStorage.getItem('github_token');
    if (!token) return;

    const cfg = await getConfig();
    const apiBase = `https://api.github.com/repos/${cfg.github_owner}/${cfg.github_repo}/contents/${filePath}`;
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json'
    };

    // Get current file SHA
    let sha = null;
    try {
      const existing = await fetch(apiBase, { headers });
      if (existing.ok) {
        const info = await existing.json();
        sha = info.sha;
      }
    } catch { /* file may not exist */ }

    const body = {
      message: `Actualizar ${filePath}`,
      content: btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2)))),
      branch: cfg.github_branch
    };
    if (sha) body.sha = sha;

    const resp = await fetch(apiBase, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const err = await resp.json();
      console.error(`GitHub write error (${filePath}):`, err.message);
    }
  }

  // ---- Config ----
  async function getConfig() {
    if (!config) config = await fetchJSON('./data/config.json');
    return config;
  }

  // ---- Actividades ----
  async function getActividades() {
    if (actividades) return actividades;
    const local = localStorage.getItem('actividades');
    if (local) {
      try { actividades = JSON.parse(local); return actividades; } catch { /* fall through */ }
    }
    actividades = await fetchJSON('./data/actividades.json');
    localStorage.setItem('actividades', JSON.stringify(actividades));
    return actividades;
  }

  async function writeActividades(data) {
    actividades = data;
    localStorage.setItem('actividades', JSON.stringify(data));
    writeToGitHub('data/actividades.json', data);
  }

  // ---- Helpers ----
  async function getHelpers() {
    if (helpers) return helpers;
    const local = localStorage.getItem('helpers');
    if (local) {
      try { helpers = JSON.parse(local); return helpers; } catch { /* fall through */ }
    }
    helpers = await fetchJSON('./data/helpers.json');
    localStorage.setItem('helpers', JSON.stringify(helpers));
    return helpers;
  }

  async function writeHelpers(data) {
    helpers = data;
    localStorage.setItem('helpers', JSON.stringify(data));
    writeToGitHub('data/helpers.json', data);
  }

  async function getHelper(codigo) {
    const all = await getHelpers();
    return all.find(h => h.codigo === codigo);
  }

  async function getHelperById(id) {
    const all = await getHelpers();
    return all.find(h => h.id === id);
  }

  async function getActividad(id) {
    const all = await getActividades();
    return all.find(a => a.id === id);
  }

  // ---- Agendas ----
  async function getAgenda(isoWeek) {
    const local = localStorage.getItem(`agenda_${isoWeek}`);
    if (local) {
      try { return JSON.parse(local); } catch { /* fall through */ }
    }
    try {
      return await fetchJSON(`./data/agenda/${isoWeek}.json`);
    } catch {
      return null;
    }
  }

  async function writeAgenda(isoWeek, agendaData) {
    localStorage.setItem(`agenda_${isoWeek}`, JSON.stringify(agendaData));
    writeToGitHub(`data/agenda/${isoWeek}.json`, agendaData);
  }

  // ---- Weeks ----
  async function getVisibleWeeks() {
    const cfg = await getConfig();
    const currentWeek = getCurrentWeek();
    const weeks = [currentWeek];
    for (let i = 1; i < cfg.ventana_semanas; i++) {
      weeks.push(offsetWeek(currentWeek, i));
    }
    return weeks;
  }

  async function getAgendasVisibles() {
    const weeks = await getVisibleWeeks();
    const agendas = {};
    for (const week of weeks) {
      const agenda = await getAgenda(week);
      if (agenda) agendas[week] = agenda;
    }
    return agendas;
  }

  // ---- Token management ----
  function getToken() {
    return localStorage.getItem('github_token') || '';
  }

  function setToken(token) {
    if (token) {
      localStorage.setItem('github_token', token.trim());
    } else {
      localStorage.removeItem('github_token');
    }
  }

  return {
    getConfig,
    getActividades,
    writeActividades,
    getHelpers,
    writeHelpers,
    getHelper,
    getHelperById,
    getActividad,
    getAgenda,
    writeAgenda,
    getVisibleWeeks,
    getAgendasVisibles,
    getToken,
    setToken
  };
})();
