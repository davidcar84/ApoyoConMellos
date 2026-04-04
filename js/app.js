// ========================================
// Vista Padres - Agenda semanal
// ========================================

(async function () {
  let currentWeek = getCurrentWeek();
  let agendaData = null;
  let actividadesData = null;
  let helpersData = null;
  let configData = null;
  let activeFilter = null; // null = all, 'sin_cubrir', 'pendiente', 'confirmado', 'urgente'

  // ---- Init ----
  async function init() {
    configData = await DataService.getConfig();
    actividadesData = await DataService.getActividades();
    helpersData = await DataService.getHelpers();
    setupHorarioOptions();
    setupActividadesCheckboxes();
    setupHelpersCheckboxes();
    bindEvents();
    await loadWeek();

    // Request notification permission after UI is ready (non-blocking)
    setTimeout(async () => {
      const granted = await Notifier.requestPermission();
      if (granted) Notifier.checkPriorityAlerts();
    }, 2000);
  }

  // ---- Load & Render Week ----
  async function loadWeek() {
    activeFilter = null;
    document.getElementById('week-label').textContent = weekLabel(currentWeek);
    document.getElementById('main-content').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    agendaData = await DataService.getAgenda(currentWeek);
    cleanBrokenRefs();
    renderSummary();
    renderAgenda();
  }

  // Remove references to deleted helpers/actividades and fix estado
  function cleanBrokenRefs() {
    if (!agendaData || !agendaData.bloques) return;
    const helperIds = new Set(helpersData.map(h => h.id));
    const actIds = new Set(actividadesData.map(a => a.id));
    let changed = false;

    for (const bloque of agendaData.bloques) {
      // Clean deleted helpers
      if (bloque.helpers_asignados) {
        const before = bloque.helpers_asignados.length;
        bloque.helpers_asignados = bloque.helpers_asignados.filter(id => helperIds.has(id));
        if (bloque.helpers_asignados.length !== before) changed = true;
      }
      // Clean deleted actividades
      const beforeActs = bloque.actividades.length;
      bloque.actividades = bloque.actividades.filter(id => actIds.has(id));
      if (bloque.actividades.length !== beforeActs) changed = true;

      // Recalc estado if helpers changed
      if (changed) {
        const assigned = (bloque.helpers_asignados || []).length;
        const needed = bloque.personas_necesarias || 1;
        if (assigned === 0) bloque.estado = 'sin_cubrir';
        else if (assigned < needed) bloque.estado = 'pendiente';
      }
    }

    // Remove blocks with no actividades left
    const beforeLen = agendaData.bloques.length;
    agendaData.bloques = agendaData.bloques.filter(b => b.actividades.length > 0);
    if (agendaData.bloques.length !== beforeLen) changed = true;

    if (changed) {
      DataService.writeAgenda(currentWeek, agendaData);
    }
  }

  // Helper: get helpers array from block (supports old and new format)
  function getBlockHelpers(bloque) {
    if (bloque.helpers_asignados) return bloque.helpers_asignados;
    if (bloque.helper_asignado) return [bloque.helper_asignado];
    return [];
  }

  function renderAgenda() {
    const main = document.getElementById('main-content');
    const dates = getWeekDates(currentWeek);

    if (!agendaData || !agendaData.bloques || agendaData.bloques.length === 0) {
      let html = renderNotaSemana();
      html += `
        <div class="empty-state">
          <div class="icon">&#128197;</div>
          <p>No hay bloques para esta semana</p>
          <p style="margin-top:8px;font-size:0.85rem">Presiona + para agregar bloques</p>
        </div>`;
      html += `<div style="padding:0 16px"><button class="btn-copy-week" id="btn-copy-week">Copiar plantilla de semana anterior</button></div>`;
      main.innerHTML = html;
      bindNotaSemanaEvents();
      document.getElementById('btn-copy-week').addEventListener('click', handleCopyWeek);
      return;
    }

    // Apply filter
    let bloquesToShow = agendaData.bloques;
    if (activeFilter) {
      if (activeFilter === 'urgente') {
        bloquesToShow = bloquesToShow.filter(b => b.importante);
      } else {
        bloquesToShow = bloquesToShow.filter(b => b.estado === activeFilter);
      }
    }

    let html = renderNotaSemana();

    if (bloquesToShow.length === 0 && activeFilter) {
      html += `<div class="empty-state"><p>No hay bloques con el filtro "${activeFilter === 'urgente' ? 'Prioritario' : estadoLabel(activeFilter)}"</p></div>`;
    } else {
      for (const fecha of dates) {
        const bloques = bloquesToShow
          .filter(b => b.fecha === fecha)
          .sort((a, b) => {
            const order = configData.bloques_horarios;
            return order.indexOf(a.horario) - order.indexOf(b.horario);
          });

        if (bloques.length === 0) continue;

        html += `<div class="day-section">`;
        html += `<div class="day-header"><span class="day-date">${formatFecha(fecha)}</span></div>`;

        for (const bloque of bloques) {
          html += renderBloque(bloque);
        }
        html += `</div>`;
      }
    }

    html += `<div style="padding:0 16px 80px"><button class="btn-copy-week" id="btn-copy-week">Copiar plantilla de semana anterior</button></div>`;

    main.innerHTML = html;
    bindBlockEvents();
    bindNotaSemanaEvents();
    document.getElementById('btn-copy-week').addEventListener('click', handleCopyWeek);
  }

  function renderNotaSemana() {
    const nota = agendaData && agendaData.notas_semana ? agendaData.notas_semana : '';
    return `
      <div class="nota-semana-container" style="margin:12px;cursor:pointer" id="nota-semana-display" title="Clic para editar">
        ${nota
          ? `<div class="instrucciones-panel"><strong>Nota de la semana:</strong> ${nota} <small style="color:var(--color-primary)">(editar)</small></div>`
          : `<div class="instrucciones-panel" style="border-left-color:var(--color-border);color:var(--color-text-light)">Agregar nota de la semana... <small style="color:var(--color-primary)">(clic)</small></div>`
        }
      </div>`;
  }

  function bindNotaSemanaEvents() {
    const display = document.getElementById('nota-semana-display');
    if (display) {
      display.addEventListener('click', openNotaSemanaEditor);
    }
  }

  function openNotaSemanaEditor() {
    const current = agendaData && agendaData.notas_semana ? agendaData.notas_semana : '';
    const newNota = prompt('Nota de la semana:', current);
    if (newNota === null) return; // cancelled

    if (!agendaData) {
      const dates = getWeekDates(currentWeek);
      agendaData = {
        semana: currentWeek,
        fecha_inicio: dates[0],
        notas_semana: '',
        bloques: []
      };
    }
    agendaData.notas_semana = newNota;
    saveAgenda();
    renderAgenda();
    showToast('Nota de la semana actualizada');
  }

  function renderBloque(bloque) {
    const acts = bloque.actividades.map(id => {
      const act = actividadesData.find(a => a.id === id);
      if (!act) return '';
      const personasTag = act.personas_requeridas > 1
        ? `<small style="font-size:0.7rem"> (${act.personas_requeridas}p)</small>` : '';
      return `<span class="actividad-tag ${categoriaClass(act.categoria)}">${act.nombre}${personasTag}</span>`;
    }).join('');

    const assignedHelpers = getBlockHelpers(bloque);
    const personas = bloque.personas_necesarias || 1;
    const assigned = assignedHelpers.length;

    let helpersHtml = '';
    if (assigned > 0) {
      const names = assignedHelpers.map(hId => {
        const h = helpersData.find(x => x.id === hId);
        return h ? h.nombre : '?';
      });
      helpersHtml = `<span class="block-helper">${names.join(', ')}</span>`;
    } else {
      helpersHtml = `<span style="color:var(--color-sin-cubrir)">Sin asignar</span>`;
    }

    // Personas badge
    let personasBadge = '';
    if (personas > 1) {
      const needsMore = assigned < personas;
      personasBadge = `<span class="personas-badge ${needsMore ? 'needs-more' : ''}">${assigned}/${personas} personas</span>`;
    }

    let actionsHtml = '';
    if (bloque.estado === 'pendiente') {
      actionsHtml = `
        <div class="block-actions">
          <button class="btn btn-success btn-sm" data-action="confirmar" data-id="${bloque.id}">Confirmar</button>
          <button class="btn btn-outline btn-sm" data-action="rechazar" data-id="${bloque.id}">Rechazar</button>
        </div>`;
    }

    const importanteClass = bloque.importante ? ' importante' : '';

    const urgenteBanner = bloque.importante ? '<div class="urgente-banner">PRIORITARIO</div>' : '';

    return `
      <div class="block-card ${bloque.estado}${importanteClass}" data-block-id="${bloque.id}">
        ${urgenteBanner}
        <div class="block-top">
          <span class="block-horario">${bloque.horario}</span>
          <span class="block-estado ${bloque.estado}">${estadoLabel(bloque.estado)}</span>
        </div>
        <div class="block-actividades">${acts}</div>
        ${bloque.notas ? `<div class="block-notas">${bloque.notas}</div>` : ''}
        <div class="block-footer">
          ${helpersHtml}
          ${personasBadge}
        </div>
        ${actionsHtml}
      </div>`;
  }

  function renderSummary() {
    const bar = document.getElementById('summary-bar');
    if (!agendaData || !agendaData.bloques || agendaData.bloques.length === 0) {
      bar.innerHTML = '';
      return;
    }
    const counts = { sin_cubrir: 0, pendiente: 0, confirmado: 0 };
    let urgentes = 0;
    agendaData.bloques.forEach(b => {
      counts[b.estado] = (counts[b.estado] || 0) + 1;
      if (b.importante) urgentes++;
    });

    const chipClass = (type) => activeFilter === type ? 'active' : '';

    let html = '';
    if (counts.sin_cubrir > 0) {
      html += `<div class="summary-chip sin-cubrir ${chipClass('sin_cubrir')}" data-filter="sin_cubrir"><span class="count">${counts.sin_cubrir}</span> Sin cubrir</div>`;
    }
    if (counts.pendiente > 0) {
      html += `<div class="summary-chip pendiente ${chipClass('pendiente')}" data-filter="pendiente"><span class="count">${counts.pendiente}</span> Pendiente</div>`;
    }
    if (counts.confirmado > 0) {
      html += `<div class="summary-chip confirmado ${chipClass('confirmado')}" data-filter="confirmado"><span class="count">${counts.confirmado}</span> Confirmado</div>`;
    }
    if (urgentes > 0) {
      html += `<div class="summary-chip urgente ${chipClass('urgente')}" data-filter="urgente"><span class="count">${urgentes}</span> Prioritario</div>`;
    }
    bar.innerHTML = html;

    // Bind filter clicks
    bar.querySelectorAll('.summary-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const filter = chip.dataset.filter;
        activeFilter = activeFilter === filter ? null : filter;
        renderSummary();
        renderAgenda();
      });
    });
  }

  // ---- Block form setup ----
  function setupHorarioOptions() {
    const sel = document.getElementById('block-horario');
    sel.innerHTML = configData.bloques_horarios.map(h =>
      `<option value="${h}">${h}</option>`
    ).join('');
  }

  function setupActividadesCheckboxes() {
    const container = document.getElementById('block-actividades');
    container.innerHTML = actividadesData.map(act => {
      const personasLabel = act.personas_requeridas > 1
        ? ` - ${act.personas_requeridas} personas` : '';
      return `
        <div class="checkbox-item">
          <input type="checkbox" id="act-${act.id}" value="${act.id}">
          <label for="act-${act.id}">${act.nombre} <small style="color:var(--color-text-light)">(${act.categoria}${personasLabel})</small></label>
        </div>`;
    }).join('');
  }

  function setupHelpersCheckboxes() {
    const container = document.getElementById('block-helpers');
    container.innerHTML = helpersData.map(h => {
      const acts = h.actividades.map(id => {
        const act = actividadesData.find(a => a.id === id);
        return act ? act.nombre : '';
      }).filter(Boolean).join(', ');
      return `
        <div class="checkbox-item">
          <input type="checkbox" id="helper-${h.id}" value="${h.id}">
          <label for="helper-${h.id}">${h.nombre} <small style="color:var(--color-text-light)">(${acts})</small></label>
        </div>`;
    }).join('');
  }

  // ---- Events ----
  function bindEvents() {
    document.getElementById('btn-prev-week').addEventListener('click', () => {
      currentWeek = offsetWeek(currentWeek, -1);
      loadWeek();
    });

    document.getElementById('btn-next-week').addEventListener('click', () => {
      currentWeek = offsetWeek(currentWeek, 1);
      loadWeek();
    });

    document.getElementById('fab-add').addEventListener('click', () => openBlockModal());

    document.getElementById('modal-block-close').addEventListener('click', closeBlockModal);
    document.getElementById('modal-block').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeBlockModal();
    });

    document.getElementById('form-block').addEventListener('submit', handleSaveBlock);
    document.getElementById('btn-delete-block').addEventListener('click', handleDeleteBlock);

    // Nav buttons
    document.getElementById('btn-helpers').addEventListener('click', showHelpers);
    document.getElementById('modal-helpers-close').addEventListener('click', () => {
      document.getElementById('modal-helpers').classList.remove('active');
    });
    document.getElementById('modal-helpers').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) e.currentTarget.classList.remove('active');
    });

    document.getElementById('btn-actividades').addEventListener('click', showActividades);
    document.getElementById('modal-actividades-close').addEventListener('click', () => {
      document.getElementById('modal-actividades').classList.remove('active');
    });
    document.getElementById('modal-actividades').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) e.currentTarget.classList.remove('active');
    });

    // Helper CRUD
    document.getElementById('btn-add-helper').addEventListener('click', () => openHelperForm());
    document.getElementById('form-helper').addEventListener('submit', handleSaveHelper);
    document.getElementById('btn-delete-helper').addEventListener('click', handleDeleteHelper);
    document.getElementById('modal-helper-form-close').addEventListener('click', () => {
      document.getElementById('modal-helper-form').classList.remove('active');
    });
    document.getElementById('modal-helper-form').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) e.currentTarget.classList.remove('active');
    });

    // Actividad CRUD
    document.getElementById('btn-add-actividad').addEventListener('click', () => openActividadForm());
    document.getElementById('form-actividad').addEventListener('submit', handleSaveActividad);
    document.getElementById('btn-delete-actividad').addEventListener('click', handleDeleteActividad);
    document.getElementById('modal-actividad-form-close').addEventListener('click', () => {
      document.getElementById('modal-actividad-form').classList.remove('active');
    });
    document.getElementById('modal-actividad-form').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) e.currentTarget.classList.remove('active');
    });

    // Config
    document.getElementById('btn-config').addEventListener('click', openConfig);
    document.getElementById('modal-config-close').addEventListener('click', () => {
      document.getElementById('modal-config').classList.remove('active');
    });
    document.getElementById('modal-config').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) e.currentTarget.classList.remove('active');
    });
    document.getElementById('form-config').addEventListener('submit', handleSaveConfig);
    document.getElementById('btn-force-sync').addEventListener('click', handleForceSync);
  }

  function bindBlockEvents() {
    // Click on block card to edit
    document.querySelectorAll('.block-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const blockId = card.dataset.blockId;
        const bloque = agendaData.bloques.find(b => b.id === blockId);
        if (bloque) openBlockModal(bloque);
      });
    });

    // Confirm/reject actions
    document.querySelectorAll('[data-action="confirmar"]').forEach(btn => {
      btn.addEventListener('click', () => updateEstado(btn.dataset.id, 'confirmado'));
    });
    document.querySelectorAll('[data-action="rechazar"]').forEach(btn => {
      btn.addEventListener('click', () => updateEstado(btn.dataset.id, 'sin_cubrir', true));
    });
  }

  // ---- Block Modal ----
  function getUsedSlots(excludeBlockId) {
    if (!agendaData || !agendaData.bloques) return new Set();
    return new Set(
      agendaData.bloques
        .filter(b => b.id !== excludeBlockId)
        .map(b => `${b.fecha}|${b.horario}`)
    );
  }

  function updateAvailableHorarios(selectedFecha, excludeBlockId) {
    const sel = document.getElementById('block-horario');
    const usedSlots = getUsedSlots(excludeBlockId);
    const currentVal = sel.value;

    sel.innerHTML = configData.bloques_horarios.map(h => {
      const taken = usedSlots.has(`${selectedFecha}|${h}`);
      return `<option value="${h}" ${taken ? 'disabled' : ''}>${h}${taken ? ' (ya creado)' : ''}</option>`;
    }).join('');

    // Try to keep current selection, otherwise pick first available
    const currentOption = sel.querySelector(`option[value="${currentVal}"]:not([disabled])`);
    if (currentOption) {
      sel.value = currentVal;
    } else {
      const firstAvailable = sel.querySelector('option:not([disabled])');
      if (firstAvailable) sel.value = firstAvailable.value;
    }
  }

  function getTodayOrWeekDate() {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const dates = getWeekDates(currentWeek);
    // If today is within the current week, use today; otherwise use first day
    return dates.includes(todayStr) ? todayStr : dates[0];
  }

  function openBlockModal(bloque = null) {
    const modal = document.getElementById('modal-block');
    const title = document.getElementById('modal-block-title');
    const deleteBtn = document.getElementById('btn-delete-block');
    const fechaInput = document.getElementById('block-fecha');

    // Remove old listener if any, then add new one
    const newFechaInput = fechaInput.cloneNode(true);
    fechaInput.parentNode.replaceChild(newFechaInput, fechaInput);

    if (bloque) {
      title.textContent = 'Editar bloque';
      document.getElementById('block-id').value = bloque.id;
      newFechaInput.value = bloque.fecha;
      document.getElementById('block-notas').value = bloque.notas || '';
      document.getElementById('block-importante').checked = bloque.importante || false;
      document.getElementById('block-personas').value = bloque.personas_necesarias || 1;
      document.querySelectorAll('#block-actividades input').forEach(cb => {
        cb.checked = bloque.actividades.includes(cb.value);
      });
      const assigned = getBlockHelpers(bloque);
      document.querySelectorAll('#block-helpers input').forEach(cb => {
        cb.checked = assigned.includes(cb.value);
      });
      updateAvailableHorarios(bloque.fecha, bloque.id);
      document.getElementById('block-horario').value = bloque.horario;
      deleteBtn.style.display = 'block';
    } else {
      title.textContent = 'Nuevo bloque';
      document.getElementById('block-id').value = '';
      document.getElementById('form-block').reset();
      document.getElementById('block-personas').value = 1;
      document.querySelectorAll('#block-helpers input').forEach(cb => {
        cb.checked = false;
      });
      const defaultDate = getTodayOrWeekDate();
      newFechaInput.value = defaultDate;
      updateAvailableHorarios(defaultDate, null);
      deleteBtn.style.display = 'none';
    }

    // Update horarios when date changes
    newFechaInput.addEventListener('change', () => {
      const blockId = document.getElementById('block-id').value || null;
      updateAvailableHorarios(newFechaInput.value, blockId);
    });

    document.getElementById('block-week').value = currentWeek;
    modal.classList.add('active');
  }

  function closeBlockModal() {
    document.getElementById('modal-block').classList.remove('active');
  }

  async function handleSaveBlock(e) {
    e.preventDefault();
    const blockId = document.getElementById('block-id').value;
    const fecha = document.getElementById('block-fecha').value;
    const horario = document.getElementById('block-horario').value;
    const notas = document.getElementById('block-notas').value;
    const importante = document.getElementById('block-importante').checked;
    const personas = parseInt(document.getElementById('block-personas').value) || 1;
    const selectedActs = Array.from(document.querySelectorAll('#block-actividades input:checked'))
      .map(cb => cb.value);
    const selectedHelpers = Array.from(document.querySelectorAll('#block-helpers input:checked'))
      .map(cb => cb.value);

    if (selectedActs.length === 0) {
      showToast('Selecciona al menos una actividad');
      return;
    }

    // Auto-determine estado based on helpers
    function calcEstado(helpers) {
      if (helpers.length === 0) return 'sin_cubrir';
      if (helpers.length >= personas) return 'confirmado';
      return 'pendiente';
    }

    // Initialize agenda if needed
    if (!agendaData) {
      const dates = getWeekDates(currentWeek);
      agendaData = {
        semana: currentWeek,
        fecha_inicio: dates[0],
        notas_semana: '',
        bloques: []
      };
    }

    if (blockId) {
      // Edit existing
      const idx = agendaData.bloques.findIndex(b => b.id === blockId);
      if (idx >= 0) {
        agendaData.bloques[idx].fecha = fecha;
        agendaData.bloques[idx].horario = horario;
        agendaData.bloques[idx].actividades = selectedActs;
        agendaData.bloques[idx].helpers_asignados = selectedHelpers;
        agendaData.bloques[idx].notas = notas;
        agendaData.bloques[idx].importante = importante;
        agendaData.bloques[idx].personas_necesarias = personas;
        agendaData.bloques[idx].estado = calcEstado(selectedHelpers);
      }
    } else {
      // New block
      agendaData.bloques.push({
        id: generateId(),
        fecha,
        horario,
        actividades: selectedActs,
        helpers_asignados: selectedHelpers,
        personas_necesarias: personas,
        estado: calcEstado(selectedHelpers),
        importante,
        notas
      });
    }

    await saveAgenda();
    closeBlockModal();
    renderSummary();
    renderAgenda();
    showToast(blockId ? 'Bloque actualizado' : 'Bloque creado');
  }

  async function handleDeleteBlock() {
    const blockId = document.getElementById('block-id').value;
    if (!blockId) return;
    if (!confirm('¿Eliminar este bloque?')) return;
    agendaData.bloques = agendaData.bloques.filter(b => b.id !== blockId);
    await saveAgenda();
    closeBlockModal();
    renderAgenda();
    renderSummary();
    showToast('Bloque eliminado');
  }

  async function updateEstado(blockId, estado, clearHelpers = false) {
    const bloque = agendaData.bloques.find(b => b.id === blockId);
    if (!bloque) return;
    bloque.estado = estado;
    if (clearHelpers) {
      bloque.helpers_asignados = [];
      bloque.helper_asignado = null;
    }
    await saveAgenda();
    renderAgenda();
    renderSummary();
    showToast(`Bloque ${estadoLabel(estado).toLowerCase()}`);
  }

  async function saveAgenda() {
    try {
      await DataService.writeAgenda(currentWeek, agendaData);
    } catch (err) {
      showToast('Error guardando: ' + err.message);
    }
  }

  // ---- Copy Previous Week ----
  async function handleCopyWeek() {
    const prevWeek = offsetWeek(currentWeek, -1);
    const prevAgenda = await DataService.getAgenda(prevWeek);

    if (!prevAgenda || !prevAgenda.bloques || prevAgenda.bloques.length === 0) {
      showToast('No hay datos en la semana anterior para copiar');
      return;
    }

    if (!confirm('¿Copiar la plantilla de la semana anterior? Se copiarán los horarios y actividades, pero sin helpers asignados.')) return;

    // Calculate day offset between weeks
    const prevDates = getWeekDates(prevWeek);
    const currDates = getWeekDates(currentWeek);
    const dayOffset = (new Date(currDates[0]) - new Date(prevDates[0])) / 86400000;

    const newBloques = prevAgenda.bloques.map(b => {
      const [y, m, d] = b.fecha.split('-').map(Number);
      const oldDate = new Date(y, m - 1, d);
      oldDate.setDate(oldDate.getDate() + dayOffset);
      const newFecha = `${oldDate.getFullYear()}-${String(oldDate.getMonth() + 1).padStart(2, '0')}-${String(oldDate.getDate()).padStart(2, '0')}`;

      return {
        id: generateId(),
        fecha: newFecha,
        horario: b.horario,
        actividades: [...b.actividades],
        helpers_asignados: [],
        personas_necesarias: b.personas_necesarias || 1,
        estado: 'sin_cubrir',
        importante: false,
        notas: ''
      };
    });

    agendaData = {
      semana: currentWeek,
      fecha_inicio: currDates[0],
      notas_semana: '',
      bloques: newBloques
    };

    await saveAgenda();
    renderAgenda();
    renderSummary();
    showToast(`${newBloques.length} bloques copiados de la semana anterior`);
  }

  // ---- Helpers CRUD ----
  function showHelpers() {
    renderHelpersList();
    document.getElementById('modal-helpers').classList.add('active');
  }

  function renderHelpersList() {
    const container = document.getElementById('helpers-list');
    if (helpersData.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No hay helpers registrados</p></div>';
      return;
    }

    container.innerHTML = helpersData.map(h => {
      const acts = h.actividades.map(id => {
        const act = actividadesData.find(a => a.id === id);
        return act ? `<span class="actividad-tag ${categoriaClass(act.categoria)}">${act.nombre}</span>` : '';
      }).join('');

      const linkBase = location.origin + location.pathname.replace('index.html', '') + 'helper.html';
      const link = `${linkBase}?id=${h.codigo}`;

      return `
        <div class="block-card helper-card" style="border-left-color:var(--color-primary);margin-bottom:12px;cursor:pointer" data-helper-id="${h.id}">
          <div class="block-top">
            <span class="block-horario">${h.nombre}</span>
            <button class="btn btn-outline btn-sm btn-edit-helper" data-helper-id="${h.id}" style="font-size:0.75rem;padding:2px 8px">Editar</button>
          </div>
          <div class="block-actividades">${acts}</div>
          ${h.telefono ? `<div style="padding:2px 14px;font-size:0.8rem;color:var(--color-text-light)">Tel: ${h.telefono}</div>` : ''}
          <div class="block-footer">
            <span>${h.disponibilidad.join(', ')}</span>
          </div>
          <div style="padding:0 14px 12px">
            <div style="font-size:0.75rem;color:var(--color-text-light)">Link: <a href="${link}" style="word-break:break-all" onclick="event.stopPropagation()">${link}</a></div>
          </div>
          ${h.notas ? `<div class="block-notas">${h.notas}</div>` : ''}
        </div>`;
    }).join('');

    // Bind edit buttons
    container.querySelectorAll('.btn-edit-helper').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const helper = helpersData.find(h => h.id === btn.dataset.helperId);
        if (helper) openHelperForm(helper);
      });
    });
  }

  function openHelperForm(helper = null) {
    const modal = document.getElementById('modal-helper-form');
    const title = document.getElementById('modal-helper-title');
    const deleteBtn = document.getElementById('btn-delete-helper');

    // Populate actividades checkboxes
    const actContainer = document.getElementById('helper-actividades-list');
    actContainer.innerHTML = actividadesData.map(act =>
      `<div class="checkbox-item">
        <input type="checkbox" id="hact-${act.id}" value="${act.id}">
        <label for="hact-${act.id}">${act.nombre} <small style="color:var(--color-text-light)">(${act.categoria})</small></label>
      </div>`
    ).join('');

    // Populate disponibilidad checkboxes
    const dispContainer = document.getElementById('helper-disponibilidad-list');
    const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    dispContainer.innerHTML = dias.map(d =>
      `<div class="checkbox-item">
        <input type="checkbox" id="hdisp-${d}" value="${d}">
        <label for="hdisp-${d}">${d}</label>
      </div>`
    ).join('');

    if (helper) {
      title.textContent = 'Editar helper';
      document.getElementById('helper-edit-id').value = helper.id;
      document.getElementById('helper-nombre').value = helper.nombre;
      document.getElementById('helper-telefono').value = helper.telefono || '';
      document.getElementById('helper-notas').value = helper.notas || '';
      actContainer.querySelectorAll('input').forEach(cb => {
        cb.checked = helper.actividades.includes(cb.value);
      });
      dispContainer.querySelectorAll('input').forEach(cb => {
        cb.checked = helper.disponibilidad.includes(cb.value);
      });
      deleteBtn.style.display = 'block';
    } else {
      title.textContent = 'Nuevo helper';
      document.getElementById('helper-edit-id').value = '';
      document.getElementById('form-helper').reset();
      deleteBtn.style.display = 'none';
    }

    modal.classList.add('active');
  }

  async function handleSaveHelper(e) {
    e.preventDefault();
    const id = document.getElementById('helper-edit-id').value;
    const nombre = document.getElementById('helper-nombre').value.trim();
    const telefono = document.getElementById('helper-telefono').value.trim();
    const notas = document.getElementById('helper-notas').value.trim();
    const actividades = Array.from(document.querySelectorAll('#helper-actividades-list input:checked')).map(cb => cb.value);
    const disponibilidad = Array.from(document.querySelectorAll('#helper-disponibilidad-list input:checked')).map(cb => cb.value);

    if (!nombre) { showToast('El nombre es obligatorio'); return; }

    if (id) {
      const idx = helpersData.findIndex(h => h.id === id);
      if (idx >= 0) {
        helpersData[idx].nombre = nombre;
        helpersData[idx].telefono = telefono;
        helpersData[idx].notas = notas;
        helpersData[idx].actividades = actividades;
        helpersData[idx].disponibilidad = disponibilidad;
      }
    } else {
      const codigo = nombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Math.random().toString(36).substr(2, 4);
      helpersData.push({
        id: 'hlp-' + Date.now().toString(36),
        codigo,
        nombre,
        telefono,
        actividades,
        disponibilidad,
        notas
      });
    }

    await DataService.writeHelpers(helpersData);
    setupHelpersCheckboxes();
    setupActividadesCheckboxes();
    document.getElementById('modal-helper-form').classList.remove('active');
    renderHelpersList();
    showToast(id ? 'Helper actualizado' : 'Helper creado');
  }

  async function handleDeleteHelper() {
    const id = document.getElementById('helper-edit-id').value;
    if (!id) return;
    if (!confirm('¿Eliminar este helper?')) return;
    helpersData = helpersData.filter(h => h.id !== id);
    await DataService.writeHelpers(helpersData);
    setupHelpersCheckboxes();
    document.getElementById('modal-helper-form').classList.remove('active');
    renderHelpersList();
    showToast('Helper eliminado');
  }

  // ---- Actividades CRUD ----
  function showActividades() {
    renderActividadesList();
    document.getElementById('modal-actividades').classList.add('active');
  }

  function renderActividadesList() {
    const container = document.getElementById('actividades-list');
    if (actividadesData.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No hay actividades registradas</p></div>';
      return;
    }

    const grouped = {};
    actividadesData.forEach(act => {
      if (!grouped[act.categoria]) grouped[act.categoria] = [];
      grouped[act.categoria].push(act);
    });

    let html = '';
    for (const [cat, acts] of Object.entries(grouped)) {
      html += `<h3 style="margin:16px 0 8px;color:var(--color-text-light)">${cat}</h3>`;
      for (const act of acts) {
        const personasInfo = act.personas_requeridas > 1
          ? `<span class="personas-badge" style="margin-left:8px">${act.personas_requeridas} personas</span>` : '';
        const catColor = cat === 'Niños' ? 'ninos' : cat === 'Perrita' ? 'perrita' : 'hogar';
        html += `
          <div class="block-card" style="border-left-color:var(--color-${catColor});margin-bottom:8px;cursor:pointer" data-act-id="${act.id}">
            <div class="block-top">
              <span class="block-horario" style="font-size:0.95rem">${act.nombre}</span>
              <button class="btn btn-outline btn-sm btn-edit-actividad" data-act-id="${act.id}" style="font-size:0.75rem;padding:2px 8px">Editar</button>
            </div>
            ${personasInfo ? `<div style="padding:4px 14px">${personasInfo}</div>` : ''}
            ${act.requiere_experiencia ? '<div style="padding:2px 14px;font-size:0.8rem;color:var(--color-pendiente)">Requiere experiencia</div>' : ''}
            ${act.instrucciones ? `<div class="instrucciones-panel"><strong>Instrucciones:</strong> ${act.instrucciones}</div>` : ''}
          </div>`;
      }
    }

    container.innerHTML = html;

    // Bind edit buttons
    container.querySelectorAll('.btn-edit-actividad').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const act = actividadesData.find(a => a.id === btn.dataset.actId);
        if (act) openActividadForm(act);
      });
    });
  }

  function openActividadForm(actividad = null) {
    const modal = document.getElementById('modal-actividad-form');
    const title = document.getElementById('modal-actividad-title');
    const deleteBtn = document.getElementById('btn-delete-actividad');

    // Populate categorias
    const catSel = document.getElementById('actividad-categoria');
    catSel.innerHTML = configData.categorias.map(c =>
      `<option value="${c}">${c}</option>`
    ).join('');

    if (actividad) {
      title.textContent = 'Editar actividad';
      document.getElementById('actividad-edit-id').value = actividad.id;
      document.getElementById('actividad-nombre').value = actividad.nombre;
      catSel.value = actividad.categoria;
      document.getElementById('actividad-personas').value = actividad.personas_requeridas || 1;
      document.getElementById('actividad-experiencia').checked = actividad.requiere_experiencia || false;
      document.getElementById('actividad-instrucciones').value = actividad.instrucciones || '';
      deleteBtn.style.display = 'block';
    } else {
      title.textContent = 'Nueva actividad';
      document.getElementById('actividad-edit-id').value = '';
      document.getElementById('form-actividad').reset();
      deleteBtn.style.display = 'none';
    }

    modal.classList.add('active');
  }

  async function handleSaveActividad(e) {
    e.preventDefault();
    const id = document.getElementById('actividad-edit-id').value;
    const nombre = document.getElementById('actividad-nombre').value.trim();
    const categoria = document.getElementById('actividad-categoria').value;
    const personas = parseInt(document.getElementById('actividad-personas').value) || 1;
    const experiencia = document.getElementById('actividad-experiencia').checked;
    const instrucciones = document.getElementById('actividad-instrucciones').value.trim();

    if (!nombre) { showToast('El nombre es obligatorio'); return; }

    if (id) {
      const idx = actividadesData.findIndex(a => a.id === id);
      if (idx >= 0) {
        actividadesData[idx].nombre = nombre;
        actividadesData[idx].categoria = categoria;
        actividadesData[idx].personas_requeridas = personas;
        actividadesData[idx].requiere_experiencia = experiencia;
        actividadesData[idx].instrucciones = instrucciones;
      }
    } else {
      actividadesData.push({
        id: 'act-' + Date.now().toString(36),
        nombre,
        categoria,
        personas_requeridas: personas,
        requiere_experiencia: experiencia,
        instrucciones
      });
    }

    await DataService.writeActividades(actividadesData);
    setupActividadesCheckboxes();
    setupHelpersCheckboxes();
    document.getElementById('modal-actividad-form').classList.remove('active');
    renderActividadesList();
    showToast(id ? 'Actividad actualizada' : 'Actividad creada');
  }

  async function handleDeleteActividad() {
    const id = document.getElementById('actividad-edit-id').value;
    if (!id) return;
    if (!confirm('¿Eliminar esta actividad?')) return;
    actividadesData = actividadesData.filter(a => a.id !== id);
    await DataService.writeActividades(actividadesData);
    setupActividadesCheckboxes();
    document.getElementById('modal-actividad-form').classList.remove('active');
    renderActividadesList();
    showToast('Actividad eliminada');
  }

  // ---- Config ----
  function openConfig() {
    document.getElementById('config-token').value = DataService.getToken();
    const status = document.getElementById('config-sync-status');
    status.innerHTML = DataService.getToken()
      ? '<span style="color:var(--color-confirmado);font-size:0.85rem">Token configurado - cambios se sincronizan a GitHub</span>'
      : '<span style="color:var(--color-pendiente);font-size:0.85rem">Sin token - cambios solo se guardan en este dispositivo</span>';
    document.getElementById('modal-config').classList.add('active');
  }

  function handleSaveConfig(e) {
    e.preventDefault();
    const token = document.getElementById('config-token').value.trim();
    DataService.setToken(token);
    document.getElementById('modal-config').classList.remove('active');
    showToast(token ? 'Token guardado. Los cambios se sincronizarán.' : 'Token eliminado.');
  }

  async function handleForceSync() {
    if (!confirm('Esto descargará los datos del servidor y reemplazará los datos locales. ¿Continuar?')) return;
    localStorage.removeItem('actividades');
    localStorage.removeItem('helpers');
    const keys = Object.keys(localStorage).filter(k => k.startsWith('agenda_'));
    keys.forEach(k => localStorage.removeItem(k));
    actividades = null;
    helpers = null;
    agendaData = null;
    actividadesData = await DataService.getActividades();
    helpersData = await DataService.getHelpers();
    setupActividadesCheckboxes();
    setupHelpersCheckboxes();
    await loadWeek();
    document.getElementById('modal-config').classList.remove('active');
    showToast('Datos sincronizados desde el servidor');
  }

  // ---- Start ----
  init().catch(err => {
    document.getElementById('main-content').innerHTML = `
      <div class="empty-state">
        <div class="icon">&#9888;</div>
        <p>Error cargando datos</p>
        <p style="font-size:0.85rem;margin-top:8px">${err.message}</p>
      </div>`;
  });
})();
