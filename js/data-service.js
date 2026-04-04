// ========================================
// Data Service - reads from GitHub Pages, writes to localStorage
// ========================================

const DataService = (() => {
  let config = null;
  let actividades = null;
  let helpers = null;

  async function fetchJSON(path) {
    const resp = await fetch(path);
    if (!resp.ok) throw new Error(`Error cargando ${path}: ${resp.status}`);
    return resp.json();
  }

  async function getConfig() {
    if (!config) config = await fetchJSON('./data/config.json');
    return config;
  }

  // Network-first: try server, save to localStorage, fallback to localStorage
  async function getActividades(forceRefresh = false) {
    if (actividades && !forceRefresh) return actividades;
    try {
      actividades = await fetchJSON('./data/actividades.json');
      localStorage.setItem('actividades', JSON.stringify(actividades));
    } catch {
      const local = localStorage.getItem('actividades');
      if (local) {
        try { actividades = JSON.parse(local); } catch { actividades = []; }
      } else {
        actividades = [];
      }
    }
    return actividades;
  }

  async function writeActividades(data) {
    actividades = data;
    localStorage.setItem('actividades', JSON.stringify(data));
  }

  // Network-first: try server, save to localStorage, fallback to localStorage
  async function getHelpers(forceRefresh = false) {
    if (helpers && !forceRefresh) return helpers;
    try {
      helpers = await fetchJSON('./data/helpers.json');
      localStorage.setItem('helpers', JSON.stringify(helpers));
    } catch {
      const local = localStorage.getItem('helpers');
      if (local) {
        try { helpers = JSON.parse(local); } catch { helpers = []; }
      } else {
        helpers = [];
      }
    }
    return helpers;
  }

  async function writeHelpers(data) {
    helpers = data;
    localStorage.setItem('helpers', JSON.stringify(data));
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
    // Check localStorage first (has latest edits)
    const local = localStorage.getItem(`agenda_${isoWeek}`);
    if (local) {
      try { return JSON.parse(local); } catch { /* fall through */ }
    }
    // Fallback to static file on server
    try {
      return await fetchJSON(`./data/agenda/${isoWeek}.json`);
    } catch {
      return null;
    }
  }

  // Write agenda to localStorage (and optionally GitHub API)
  async function writeAgenda(isoWeek, agendaData) {
    const cfg = await getConfig();
    const path = `data/agenda/${isoWeek}.json`;
    const token = localStorage.getItem('github_token');

    // Always save to localStorage for immediate reads
    localStorage.setItem(`agenda_${isoWeek}`, JSON.stringify(agendaData));

    if (!token) {
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
    writeActividades,
    getHelpers,
    writeHelpers,
    getHelper,
    getHelperById,
    getActividad,
    getAgenda,
    writeAgenda,
    getVisibleWeeks,
    getAgendasVisibles
  };
})();
