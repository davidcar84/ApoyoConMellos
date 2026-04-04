// ========================================
// Data Service - Firebase Realtime Database
// ========================================

const DataService = (() => {
  const FB = 'https://apoyoconmellos-default-rtdb.firebaseio.com';
  let config = null;

  // ---- Firebase helpers ----
  async function fbGet(path) {
    const resp = await fetch(`${FB}/${path}.json`);
    if (!resp.ok) throw new Error(`Firebase read error: ${resp.status}`);
    return resp.json();
  }

  async function fbPut(path, data) {
    const resp = await fetch(`${FB}/${path}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!resp.ok) throw new Error(`Firebase write error: ${resp.status}`);
  }

  // ---- Config (still local, no need to sync) ----
  async function getConfig() {
    if (!config) {
      const resp = await fetch('./data/config.json');
      if (!resp.ok) throw new Error('Error cargando config');
      config = await resp.json();
    }
    return config;
  }

  // ---- Actividades ----
  async function getActividades() {
    const data = await fbGet('actividades');
    return data || [];
  }

  async function writeActividades(data) {
    await fbPut('actividades', data);
  }

  // ---- Helpers ----
  async function getHelpers() {
    const data = await fbGet('helpers');
    return data || [];
  }

  async function writeHelpers(data) {
    await fbPut('helpers', data);
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
    const data = await fbGet(`agendas/${isoWeek}`);
    return data || null;
  }

  async function writeAgenda(isoWeek, agendaData) {
    await fbPut(`agendas/${isoWeek}`, agendaData);
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

  // ---- Events / Notifications ----
  async function addEvent(event) {
    const id = 'evt-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    event.id = id;
    event.timestamp = new Date().toISOString();
    await fbPut(`events/${id}`, event);
  }

  async function getEvents() {
    const data = await fbGet('events');
    if (!data) return [];
    // Convert object to sorted array (newest first)
    return Object.values(data).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  return {
    getConfig,
    getActividades, writeActividades,
    getHelpers, writeHelpers,
    getHelper, getHelperById, getActividad,
    getAgenda, writeAgenda,
    getVisibleWeeks, getAgendasVisibles,
    addEvent, getEvents
  };
})();
