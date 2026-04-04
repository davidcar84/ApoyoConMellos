// ========================================
// Data Service - GitHub API as real-time backend
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
      Object.keys(localStorage).filter(k => k.startsWith('agenda_')).forEach(k => localStorage.removeItem(k));
      localStorage.setItem('data_version', DATA_VERSION);
    }
  })();

  function getToken() {
    return localStorage.getItem('github_token') || '';
  }

  function setToken(token) {
    if (token) localStorage.setItem('github_token', token.trim());
    else localStorage.removeItem('github_token');
  }

  // ---- Fetch helpers ----
  async function fetchJSON(path) {
    const resp = await fetch(path);
    if (!resp.ok) throw new Error(`Error cargando ${path}: ${resp.status}`);
    return resp.json();
  }

  function githubHeaders() {
    return {
      'Authorization': `Bearer ${getToken()}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };
  }

  // Read a file directly from GitHub API (bypasses Pages CDN cache)
  async function readFromGitHub(filePath) {
    const cfg = await getConfig();
    const url = `https://api.github.com/repos/${cfg.github_owner}/${cfg.github_repo}/contents/${filePath}?ref=${cfg.github_branch}&t=${Date.now()}`;
    const resp = await fetch(url, { headers: githubHeaders() });
    if (!resp.ok) return null;
    const info = await resp.json();
    return JSON.parse(decodeURIComponent(escape(atob(info.content))));
  }

  // Write a file to GitHub API
  async function writeToGitHub(filePath, data) {
    if (!getToken()) return;
    const cfg = await getConfig();
    const apiBase = `https://api.github.com/repos/${cfg.github_owner}/${cfg.github_repo}/contents/${filePath}`;

    // Get current SHA
    let sha = null;
    try {
      const existing = await fetch(apiBase, { headers: githubHeaders() });
      if (existing.ok) sha = (await existing.json()).sha;
    } catch { /* file may not exist */ }

    const body = {
      message: `Actualizar ${filePath}`,
      content: btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2)))),
      branch: cfg.github_branch
    };
    if (sha) body.sha = sha;

    const resp = await fetch(apiBase, {
      method: 'PUT',
      headers: githubHeaders(),
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

  // ---- Generic getter: GitHub API first, then localStorage, then static file ----
  async function getData(key, staticPath) {
    // If token exists, read fresh from GitHub API
    if (getToken()) {
      try {
        const data = await readFromGitHub(staticPath);
        if (data) {
          localStorage.setItem(key, JSON.stringify(data));
          return data;
        }
      } catch (e) {
        console.warn(`GitHub API read failed for ${staticPath}, falling back`, e);
      }
    }

    // Fallback: localStorage
    const local = localStorage.getItem(key);
    if (local) {
      try { return JSON.parse(local); } catch { /* fall through */ }
    }

    // Last resort: static file from Pages
    const data = await fetchJSON('./' + staticPath);
    localStorage.setItem(key, JSON.stringify(data));
    return data;
  }

  // ---- Actividades ----
  async function getActividades() {
    if (actividades) return actividades;
    actividades = await getData('actividades', 'data/actividades.json');
    return actividades;
  }

  async function writeActividades(data) {
    actividades = data;
    localStorage.setItem('actividades', JSON.stringify(data));
    await writeToGitHub('data/actividades.json', data);
  }

  // ---- Helpers ----
  async function getHelpers() {
    if (helpers) return helpers;
    helpers = await getData('helpers', 'data/helpers.json');
    return helpers;
  }

  async function writeHelpers(data) {
    helpers = data;
    localStorage.setItem('helpers', JSON.stringify(data));
    await writeToGitHub('data/helpers.json', data);
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
    // If token exists, try GitHub API first for fresh data
    if (getToken()) {
      try {
        const data = await readFromGitHub(`data/agenda/${isoWeek}.json`);
        if (data) {
          localStorage.setItem(`agenda_${isoWeek}`, JSON.stringify(data));
          return data;
        }
      } catch { /* fall through */ }
    }

    // Fallback: localStorage
    const local = localStorage.getItem(`agenda_${isoWeek}`);
    if (local) {
      try { return JSON.parse(local); } catch { /* fall through */ }
    }

    // Last resort: static file
    try {
      return await fetchJSON(`./data/agenda/${isoWeek}.json`);
    } catch {
      return null;
    }
  }

  async function writeAgenda(isoWeek, agendaData) {
    localStorage.setItem(`agenda_${isoWeek}`, JSON.stringify(agendaData));
    await writeToGitHub(`data/agenda/${isoWeek}.json`, agendaData);
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

  return {
    getConfig,
    getActividades, writeActividades,
    getHelpers, writeHelpers,
    getHelper, getHelperById, getActividad,
    getAgenda, writeAgenda,
    getVisibleWeeks, getAgendasVisibles,
    getToken, setToken
  };
})();
