// ========================================
// Vista Helper - bloques filtrados + auto-asignación
// ========================================

(async function () {
  let helperData = null;
  let actividadesData = null;
  let helpersData = null;
  let agendasData = {};
  let activeTab = 'disponible';
  let activeFilter = null; // null = show all, 'sin_cubrir', 'pendiente', 'confirmado', 'urgente'

  // ---- Init ----
  async function init() {
    const params = new URLSearchParams(location.search);
    const codigo = params.get('id');

    if (!codigo) {
      showError();
      return;
    }

    try {
      actividadesData = await DataService.getActividades();
      helpersData = await DataService.getHelpers();
      helperData = await DataService.getHelper(codigo);

      if (!helperData) {
        showError();
        return;
      }

      renderWelcome();
      bindEvents();
      await loadAgendas();
    } catch (err) {
      document.getElementById('main-content').innerHTML = `
        <div class="empty-state">
          <div class="icon">&#9888;</div>
          <p>Error cargando datos</p>
          <p style="font-size:0.85rem;margin-top:8px">${err.message}</p>
        </div>`;
    }
  }

  function showError() {
    document.getElementById('main-content').style.display = 'none';
    document.getElementById('error-no-helper').style.display = 'block';
    document.querySelector('.tab-bar').style.display = 'none';
    document.getElementById('helper-greeting').textContent = '';
  }

  function renderWelcome() {
    document.getElementById('helper-greeting').textContent = `Hola, ${helperData.nombre}`;
    document.getElementById('welcome-name').textContent = helperData.nombre;

    const skills = helperData.actividades.map(id => {
      const act = actividadesData.find(a => a.id === id);
      return act ? `<span class="actividad-tag ${categoriaClass(act.categoria)}">${act.nombre}</span>` : '';
    }).join('');
    document.getElementById('welcome-skills').innerHTML = skills;

    document.getElementById('helper-welcome').style.display = 'block';
  }

  // ---- Helpers for block data ----
  function getBlockHelpers(bloque) {
    if (bloque.helpers_asignados) return bloque.helpers_asignados;
    if (bloque.helper_asignado) return [bloque.helper_asignado];
    return [];
  }

  function isAssignedToBlock(bloque) {
    return getBlockHelpers(bloque).includes(helperData.id);
  }

  function blockNeedsMoreHelpers(bloque) {
    const personas = bloque.personas_necesarias || 1;
    return getBlockHelpers(bloque).length < personas;
  }

  // ---- Load Agendas ----
  async function loadAgendas() {
    document.getElementById('main-content').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    agendasData = await DataService.getAgendasVisibles();
    renderBlocks();
  }

  // ---- Render ----
  function getFilteredBlocks() {
    const allBlocks = getAllBlocks();

    let filtered;
    if (activeTab === 'disponible') {
      filtered = allBlocks.filter(b => {
        const canDo = canDoBlock(b.bloque);
        const alreadyAssigned = isAssignedToBlock(b.bloque);
        const needsPeople = b.bloque.estado === 'sin_cubrir' || blockNeedsMoreHelpers(b.bloque);
        return canDo && !alreadyAssigned && needsPeople;
      });
    } else {
      filtered = allBlocks.filter(b => isAssignedToBlock(b.bloque));
    }
    return filtered;
  }

  function renderSummary(filtered) {
    const bar = document.getElementById('summary-bar');
    if (!filtered || filtered.length === 0) {
      bar.innerHTML = '';
      return;
    }

    const counts = { sin_cubrir: 0, pendiente: 0, confirmado: 0 };
    let urgentes = 0;
    filtered.forEach(b => {
      counts[b.bloque.estado] = (counts[b.bloque.estado] || 0) + 1;
      if (b.bloque.importante) urgentes++;
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
        renderBlocks();
      });
    });
  }

  function renderBlocks() {
    const main = document.getElementById('main-content');
    const filtered = getFilteredBlocks();

    renderSummary(filtered);

    // Apply active filter
    let displayed = filtered;
    if (activeFilter) {
      if (activeFilter === 'urgente') {
        displayed = filtered.filter(b => b.bloque.importante);
      } else {
        displayed = filtered.filter(b => b.bloque.estado === activeFilter);
      }
    }

    if (displayed.length === 0) {
      const msg = activeFilter
        ? 'No hay bloques con ese filtro'
        : (activeTab === 'disponible'
          ? 'No hay bloques disponibles para ti en este momento'
          : 'No tienes turnos asignados');
      main.innerHTML = `
        <div class="empty-state">
          <div class="icon">${activeTab === 'disponible' ? '&#9996;' : '&#128197;'}</div>
          <p>${msg}</p>
        </div>`;
      return;
    }

    // Sort: important first, then by date
    displayed.sort((a, b) => {
      if (a.bloque.importante && !b.bloque.importante) return -1;
      if (!a.bloque.importante && b.bloque.importante) return 1;
      const dateComp = a.bloque.fecha.localeCompare(b.bloque.fecha);
      if (dateComp !== 0) return dateComp;
      return a.bloque.horario.localeCompare(b.bloque.horario);
    });

    // Group by date
    const byDate = {};
    displayed.forEach(item => {
      if (!byDate[item.bloque.fecha]) byDate[item.bloque.fecha] = [];
      byDate[item.bloque.fecha].push(item);
    });

    let html = '';
    const sortedDates = Object.keys(byDate).sort();

    for (const fecha of sortedDates) {
      html += `<div class="day-section">`;
      html += `<div class="day-header"><span class="day-date">${formatFecha(fecha)}</span></div>`;

      for (const item of byDate[fecha]) {
        html += renderBloqueHelper(item);
      }
      html += `</div>`;
    }

    main.innerHTML = html;
    bindBlockEvents();
  }

  function renderBloqueHelper(item) {
    const bloque = item.bloque;
    const importanteClass = bloque.importante ? ' importante' : '';

    const acts = bloque.actividades
      .filter(id => helperData.actividades.includes(id))
      .map(id => {
        const act = actividadesData.find(a => a.id === id);
        return act ? `<span class="actividad-tag ${categoriaClass(act.categoria)}">${act.nombre}</span>` : '';
      }).join('');

    const otherActs = bloque.actividades
      .filter(id => !helperData.actividades.includes(id))
      .map(id => {
        const act = actividadesData.find(a => a.id === id);
        return act ? `<span class="actividad-tag" style="opacity:0.5">${act.nombre}</span>` : '';
      }).join('');

    // Show other assigned helpers
    const assignedHelpers = getBlockHelpers(bloque);
    const otherHelpers = assignedHelpers
      .filter(hId => hId !== helperData.id)
      .map(hId => {
        const h = helpersData.find(x => x.id === hId);
        return h ? h.nombre : '?';
      });

    let personasInfo = '';
    const personas = bloque.personas_necesarias || 1;
    if (personas > 1) {
      const assigned = assignedHelpers.length;
      personasInfo = `<div style="padding:4px 14px"><span class="personas-badge ${assigned < personas ? 'needs-more' : ''}">${assigned}/${personas} personas</span></div>`;
    }

    let otherHelpersHtml = '';
    if (otherHelpers.length > 0) {
      otherHelpersHtml = `<div style="padding:4px 14px;font-size:0.8rem;color:var(--color-text-light)">Ya apuntados: ${otherHelpers.join(', ')}</div>`;
    }

    let actionHtml = '';
    if (activeTab === 'disponible' && !isAssignedToBlock(bloque)) {
      actionHtml = `<button class="btn-asignarme" data-week="${item.week}" data-id="${bloque.id}">Me apunto</button>`;
    } else if (isAssignedToBlock(bloque) && bloque.estado === 'pendiente') {
      actionHtml = `<div style="padding:8px 14px;font-size:0.85rem;color:var(--color-pendiente);font-weight:600">Esperando confirmación de los papás</div>`;
    } else if (isAssignedToBlock(bloque) && bloque.estado === 'confirmado') {
      actionHtml = `<div style="padding:8px 14px;font-size:0.85rem;color:var(--color-confirmado);font-weight:600">Confirmado</div>`;
    }

    const urgenteBanner = bloque.importante ? '<div class="urgente-banner">PRIORITARIO</div>' : '';

    return `
      <div class="block-card ${bloque.estado}${importanteClass}" data-week="${item.week}" data-block-id="${bloque.id}">
        ${urgenteBanner}
        <div class="block-top">
          <span class="block-horario">${bloque.horario}</span>
          <span class="block-estado ${bloque.estado}">${estadoLabel(bloque.estado)}</span>
        </div>
        <div class="block-actividades">
          ${acts}
          ${otherActs}
        </div>
        ${bloque.notas ? `<div class="block-notas">${bloque.notas}</div>` : ''}
        ${personasInfo}
        ${otherHelpersHtml}
        ${actionHtml}
      </div>`;
  }

  // ---- Helpers ----
  function getAllBlocks() {
    const blocks = [];
    for (const [week, agenda] of Object.entries(agendasData)) {
      if (!agenda || !agenda.bloques) continue;
      for (const bloque of agenda.bloques) {
        blocks.push({ week, bloque });
      }
    }
    return blocks.sort((a, b) => {
      const dateComp = a.bloque.fecha.localeCompare(b.bloque.fecha);
      if (dateComp !== 0) return dateComp;
      return a.bloque.horario.localeCompare(b.bloque.horario);
    });
  }

  function canDoBlock(bloque) {
    return bloque.actividades.some(actId => helperData.actividades.includes(actId));
  }

  // ---- Events ----
  function bindEvents() {
    document.getElementById('tab-disponible').addEventListener('click', () => {
      activeTab = 'disponible';
      activeFilter = null;
      updateTabs();
      renderBlocks();
    });

    document.getElementById('tab-mis-turnos').addEventListener('click', () => {
      activeTab = 'mis-turnos';
      activeFilter = null;
      updateTabs();
      renderBlocks();
    });

    document.getElementById('modal-detalle-close').addEventListener('click', () => {
      document.getElementById('modal-detalle').classList.remove('active');
    });
    document.getElementById('modal-detalle').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) e.currentTarget.classList.remove('active');
    });
  }

  function bindBlockEvents() {
    // "Me apunto" buttons
    document.querySelectorAll('.btn-asignarme').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleAsignarme(btn.dataset.week, btn.dataset.id);
      });
    });

    // Click on block to see instructions
    document.querySelectorAll('.block-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-asignarme')) return;
        showDetalle(card.dataset.week, card.dataset.blockId);
      });
    });
  }

  function updateTabs() {
    document.getElementById('tab-disponible').classList.toggle('active', activeTab === 'disponible');
    document.getElementById('tab-mis-turnos').classList.toggle('active', activeTab === 'mis-turnos');
  }

  // ---- Self-assign ----
  async function handleAsignarme(week, blockId) {
    const agenda = agendasData[week];
    if (!agenda) return;

    const bloque = agenda.bloques.find(b => b.id === blockId);
    if (!bloque) return;

    if (!confirm(`¿Te apuntas para ${bloque.horario} el ${formatFecha(bloque.fecha)}?`)) return;

    // Add to helpers array
    if (!bloque.helpers_asignados) bloque.helpers_asignados = [];
    bloque.helpers_asignados.push(helperData.id);
    bloque.estado = 'pendiente';

    try {
      await DataService.writeAgenda(week, agenda);
      showToast('Te apuntaste. Los papás confirmarán pronto.');
      renderBlocks();
    } catch (err) {
      showToast('Error: ' + err.message);
      bloque.helpers_asignados = bloque.helpers_asignados.filter(id => id !== helperData.id);
      if (bloque.helpers_asignados.length === 0) bloque.estado = 'sin_cubrir';
    }
  }

  // ---- Detail modal ----
  function showDetalle(week, blockId) {
    const agenda = agendasData[week];
    if (!agenda) return;
    const bloque = agenda.bloques.find(b => b.id === blockId);
    if (!bloque) return;

    document.getElementById('detalle-title').textContent = `${formatFecha(bloque.fecha)} - ${bloque.horario}`;

    let html = '';

    if (bloque.importante) {
      html += `<div style="background:var(--color-urgente);color:white;padding:8px 12px;border-radius:8px;font-weight:700;margin-bottom:12px;text-align:center;letter-spacing:1px">PRIORITARIO</div>`;
    }

    for (const actId of bloque.actividades) {
      const act = actividadesData.find(a => a.id === actId);
      if (!act) continue;
      const canDo = helperData.actividades.includes(actId);
      const personasInfo = act.personas_requeridas > 1 ? ` (${act.personas_requeridas} personas)` : '';
      html += `
        <div class="instrucciones-panel" style="margin-bottom:10px;${!canDo ? 'opacity:0.5' : ''}">
          <strong>${act.nombre} (${act.categoria})${personasInfo}${!canDo ? ' - No asignada a ti' : ''}</strong>
          ${act.instrucciones}
        </div>`;
    }

    if (bloque.notas) {
      html += `<div class="block-notas" style="margin-top:12px"><strong>Nota:</strong> ${bloque.notas}</div>`;
    }

    document.getElementById('detalle-content').innerHTML = html;
    document.getElementById('modal-detalle').classList.add('active');
  }

  // ---- Start ----
  init();
})();
