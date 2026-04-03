// ========================================
// Notifications - Browser Notification API
// ========================================

const Notifier = (() => {
  let permission = 'default';

  async function requestPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') {
      permission = 'granted';
      return true;
    }
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    permission = result;
    return result === 'granted';
  }

  function isEnabled() {
    return 'Notification' in window && Notification.permission === 'granted';
  }

  function send(title, body, tag, onClick) {
    if (!isEnabled()) return;
    const notif = new Notification(title, {
      body,
      tag,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      requireInteraction: true
    });
    if (onClick) {
      notif.addEventListener('click', () => {
        window.focus();
        onClick();
        notif.close();
      });
    }
  }

  // Check for tomorrow's blocks and notify helper
  async function checkHelperReminders(helperData) {
    if (!isEnabled() || !helperData) return;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

    const agendas = await DataService.getAgendasVisibles();
    let myBlocks = [];
    for (const [week, agenda] of Object.entries(agendas)) {
      if (!agenda || !agenda.bloques) continue;
      for (const bloque of agenda.bloques) {
        if (bloque.fecha !== tomorrowStr) continue;
        const helpers = bloque.helpers_asignados || (bloque.helper_asignado ? [bloque.helper_asignado] : []);
        if (helpers.includes(helperData.id) && bloque.estado === 'confirmado') {
          myBlocks.push(bloque);
        }
      }
    }

    if (myBlocks.length > 0) {
      const lastReminder = localStorage.getItem(`reminder_${tomorrowStr}_${helperData.id}`);
      if (lastReminder) return; // Already reminded today

      const blocksText = myBlocks.map(b => b.horario).join(', ');
      send(
        'Recordatorio para mañana',
        `Tienes ${myBlocks.length} turno(s) mañana: ${blocksText}`,
        `reminder-${tomorrowStr}`
      );
      localStorage.setItem(`reminder_${tomorrowStr}_${helperData.id}`, 'true');
    }
  }

  // Notify parents when a helper signs up
  function notifyHelperAssigned(helperName, bloque) {
    send(
      'Nuevo helper apuntado',
      `${helperName} se apuntó para ${bloque.horario} el ${bloque.fecha}`,
      `assigned-${bloque.id}`
    );
  }

  // Notify about uncovered priority blocks
  async function checkPriorityAlerts() {
    if (!isEnabled()) return;
    const agendas = await DataService.getAgendasVisibles();
    let priorityUncovered = 0;
    for (const [week, agenda] of Object.entries(agendas)) {
      if (!agenda || !agenda.bloques) continue;
      for (const bloque of agenda.bloques) {
        if (bloque.importante && bloque.estado === 'sin_cubrir') {
          priorityUncovered++;
        }
      }
    }
    if (priorityUncovered > 0) {
      const lastAlert = sessionStorage.getItem('priority_alert');
      if (lastAlert) return;
      send(
        'Bloques prioritarios sin cubrir',
        `Hay ${priorityUncovered} bloque(s) prioritario(s) que necesitan helper`,
        'priority-alert'
      );
      sessionStorage.setItem('priority_alert', 'true');
    }
  }

  return {
    requestPermission,
    isEnabled,
    send,
    checkHelperReminders,
    notifyHelperAssigned,
    checkPriorityAlerts
  };
})();
