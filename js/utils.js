// ========================================
// Utility functions
// ========================================

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DIAS_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function formatFecha(fechaStr) {
  const [y, m, d] = fechaStr.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  return `${DIAS_SEMANA[fecha.getDay()]} ${d} de ${MESES[fecha.getMonth()]}`;
}

function formatFechaCorta(fechaStr) {
  const [y, m, d] = fechaStr.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  return `${DIAS_CORTO[fecha.getDay()]} ${d}`;
}

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function getWeekDates(isoWeek) {
  const [yearStr, weekStr] = isoWeek.split('-W');
  const year = parseInt(yearStr);
  const week = parseInt(weekStr);
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const mondayOfWeek1 = new Date(jan4);
  mondayOfWeek1.setDate(jan4.getDate() - dayOfWeek + 1);
  const monday = new Date(mondayOfWeek1);
  monday.setDate(mondayOfWeek1.getDate() + (week - 1) * 7);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    // Use local date formatting to avoid UTC timezone shift
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    dates.push(`${yy}-${mm}-${dd}`);
  }
  return dates;
}

function getCurrentWeek() {
  return getISOWeek(new Date());
}

function offsetWeek(isoWeek, offset) {
  const dates = getWeekDates(isoWeek);
  const [y, m, d] = dates[0].split('-').map(Number);
  const monday = new Date(y, m - 1, d);
  monday.setDate(monday.getDate() + offset * 7);
  return getISOWeek(monday);
}

function weekLabel(isoWeek) {
  const dates = getWeekDates(isoWeek);
  const [sy, sm, sd] = dates[0].split('-').map(Number);
  const [ey, em, ed] = dates[6].split('-').map(Number);
  const startMonth = MESES[sm - 1];
  const endMonth = MESES[em - 1];

  if (sm === em) {
    return `${DIAS_CORTO[new Date(sy, sm-1, sd).getDay()]} ${sd} - ${DIAS_CORTO[new Date(ey, em-1, ed).getDay()]} ${ed} ${startMonth} ${sy}`;
  }
  return `${DIAS_CORTO[new Date(sy, sm-1, sd).getDay()]} ${sd} ${startMonth} - ${DIAS_CORTO[new Date(ey, em-1, ed).getDay()]} ${ed} ${endMonth} ${ey}`;
}

function estadoLabel(estado) {
  const labels = {
    'sin_cubrir': 'Sin cubrir',
    'pendiente': 'Pendiente',
    'confirmado': 'Confirmado'
  };
  return labels[estado] || estado;
}

function categoriaClass(categoria) {
  const map = {
    'Niños': 'cat-ninos',
    'Perrita': 'cat-perrita',
    'Hogar': 'cat-hogar'
  };
  return map[categoria] || '';
}

function generateId() {
  return 'blk-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
}

function showToast(message, duration = 3000) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}
