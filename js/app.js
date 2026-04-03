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
    bindEvents();
    await loadWeek();
  }

  // ---- Load & Render Week ----
  async function loadWeek() {
    activeFilter = null;
    document.getElementById('week-label').textContent = weekLabel(currentWeek);
    document.getElementById('main-content').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    agendaData = await DataService.getAgenda(currentWeek);
    renderSummary();
    renderAgenda();
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
      updateAvailableHorarios(bloque.fecha, bloque.id);
      document.getElementById('block-horario').value = bloque.horario;
      deleteBtn.style.display = 'block';
    } else {
      title.textContent = 'Nuevo bloque';
      document.getElementById('block-id').value = '';
      document.getElementById('form-block').reset();
      document.getElementById('block-personas').value = 1;
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

    if (selectedActs.length === 0) {
      showToast('Selecciona al menos una actividad');
      return;
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
        agendaData.bloques[idx].notas = notas;
        agendaData.bloques[idx].importante = importante;
        agendaData.bloques[idx].personas_necesarias = personas;
      }
    } else {
      // New block
      agendaData.bloques.push({
        id: generateId(),
        fecha,
        horario,
        actividades: selectedActs,
        helpers_asignados: [],
        personas_necesarias: personas,
        estado: 'sin_cubrir',
        importante,
        notas
      });
    }

    await saveAgenda();
    closeBlockModal();
    renderAgenda();
    renderSummary();
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

  // ---- Helpers List ----
  function showHelpers() {
    const container = document.getElementById('helpers-list');
    container.innerHTML = helpersData.map(h => {
      const acts = h.actividades.map(id => {
        const act = actividadesData.find(a => a.id === id);
        return act ? `<span class="actividad-tag ${categoriaClass(act.categoria)}">${act.nombre}</span>` : '';
      }).join('');

      const linkBase = location.origin + location.pathname.replace('index.html', '') + 'helper.html';
      const link = `${linkBase}?id=${h.codigo}`;

      return `
        <div class="block-card" style="border-left-color:var(--color-primary);margin-bottom:12px">
          <div class="block-top">
            <span class="block-horario">${h.nombre}</span>
          </div>
          <div class="block-actividades">${acts}</div>
          <div class="block-footer">
            <span>${h.disponibilidad.join(', ')}</span>
          </div>
          <div style="padding:0 14px 12px">
            <div style="font-size:0.8rem;color:var(--color-text-light)">Link: <a href="${link}" style="word-break:break-all">${link}</a></div>
          </div>
          ${h.notas ? `<div class="block-notas">${h.notas}</div>` : ''}
        </div>`;
    }).join('');

    document.getElementById('modal-helpers').classList.add('active');
  }

  // ---- Actividades List ----
  function showActividades() {
    const container = document.getElementById('actividades-list');
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
        html += `
          <div class="block-card" style="border-left-color:var(--color-${cat === 'Niños' ? 'ninos' : cat === 'Perrita' ? 'perrita' : 'hogar'});margin-bottom:8px">
            <div class="block-top">
              <span class="block-horario" style="font-size:0.95rem">${act.nombre}</span>
              ${act.requiere_experiencia ? '<span class="block-estado pendiente" style="font-size:0.7rem">Requiere exp.</span>' : ''}
            </div>
            ${personasInfo ? `<div style="padding:4px 14px">${personasInfo}</div>` : ''}
            ${act.instrucciones ? `<div class="instrucciones-panel"><strong>Instrucciones:</strong> ${act.instrucciones}</div>` : ''}
          </div>`;
      }
    }

    container.innerHTML = html;
    document.getElementById('modal-actividades').classList.add('active');
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
