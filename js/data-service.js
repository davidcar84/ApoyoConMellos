// ========================================
// Data Service - reads from GitHub Pages, writes via GitHub API
// ========================================

const DataService = (() => {
  let config = null;
  let actividades = null;
  let helpers = null;

  // Base URL: detect GitHub Pages subdirectory or local dev
  function getBaseUrl() {
    const path = location.pathname;
    // GitHub Pages with repo subdirectory: /ApoyoConMellos/
    if (location.hostname.includes('github.io')) {
      const match = path.match(/^\/[^/]+/);
      return match ? match[0] : '';
    }
    return '';
  }

  async function fetchJSON(path) {
    const url = `${getBaseUrl()}${path}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Error cargando ${path}: ${resp.status}`);
    return resp.json();
  }

  async function getConfig() {
    if (!config) config = await fetchJSON('/data/config.json');
    return config;
  }

  async function getActividades() {
    if (!actividades) actividades = await fetchJSON('/data/actividades.json');
    return actividades;
  }

  async function getHelpers() {
    if (!helpers) helpers = await fetchJSON('/data/helpers.json');
    return helpers;
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

  async function getAgenda(isoWeek) {
    try {
      return await fetchJSON(`/data/agenda/${isoWeek}.json`);
    } catch {
      return null;
    }
  }

  // Write via GitHub API (for helper self-assignment)
  async function writeAgenda(isoWeek, agendaData) {
    const cfg = await getConfig();
    const path = `data/agenda/${isoWeek}.json`;
    const token = localStorage.getItem('github_token');

    if (!token) {
      // Fallback: save to localStorage for offline/demo mode
      localStorage.setItem(`agenda_${isoWeek}`, JSON.stringify(agendaData));
      return true;
    }

    // Get current file SHA
    const apiBase = `https://api.github.com/repos/${cfg.github_owner}/${cfg.github_repo}/contents/${path}`;
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json'
    };

    let sha = null;
    try {
      const existing = await fetch(apiBase, { headers });
      if (existing.ok) {
        const data = await existing.json();
        sha = data.sha;
      }
    } catch {
      // File doesn't exist yet
    }

    const body = {
      message: `Actualizar agenda ${isoWeek}`,
      content: btoa(unescape(encodeURIComponent(JSON.stringify(agendaData, null, 2)))),
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
      throw new Error(`Error guardando: ${err.message}`);
    }

    return true;
  }

  // Get visible weeks for helpers based on config
  async function getVisibleWeeks() {
    const cfg = await getConfig();
    const currentWeek = getCurrentWeek();
    const weeks = [currentWeek];
    for (let i = 1; i < cfg.ventana_semanas; i++) {
      weeks.push(offsetWeek(currentWeek, i));
    }
    return weeks;
  }

  // Load all agendas for visible weeks
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
    getActividades,
    getHelpers,
    getHelper,
    getHelperById,
    getActividad,
    getAgenda,
    writeAgenda,
    getVisibleWeeks,
    getAgendasVisibles
  };
})();
