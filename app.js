'use strict';

// ---------- Datos ----------

const CLAVE_DATOS = 'contador-dinero:datos';
const CLAVE_AJUSTES = 'contador-dinero:ajustes';
const AJUSTES_POR_DEFECTO = { importesRapidos: [50, 100, 150, 200] }; // en céntimos

const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const $ = (id) => document.getElementById(id);

let cobros = cargar(CLAVE_DATOS, []).filter(esCobroValido);
let ajustes = { ...AJUSTES_POR_DEFECTO, ...cargar(CLAVE_AJUSTES, {}) };
let mesVisible = mesDe(hoy());
let idEditando = null;

function cargar(clave, porDefecto) {
  try {
    const texto = localStorage.getItem(clave);
    return texto ? JSON.parse(texto) : porDefecto;
  } catch {
    return porDefecto;
  }
}

function guardarCobros() {
  localStorage.setItem(CLAVE_DATOS, JSON.stringify(cobros));
}

function guardarAjustes() {
  localStorage.setItem(CLAVE_AJUSTES, JSON.stringify(ajustes));
}

function esCobroValido(r) {
  return r && typeof r.id === 'string'
    && typeof r.nombre === 'string' && r.nombre.trim() !== ''
    && typeof r.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.fecha)
    && Number.isInteger(r.centimos) && r.centimos > 0;
}

function nuevoId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ---------- Utilidades de fecha e importe ----------

function pad(n) {
  return String(n).padStart(2, '0');
}

function hoy() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function mesDe(fecha) {
  return fecha.slice(0, 7);
}

function sumarMeses(mes, delta) {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function mayuscula(texto) {
  return texto.charAt(0).toLocaleUpperCase('es') + texto.slice(1);
}

function textoMes(mes) {
  const [a, m] = mes.split('-').map(Number);
  return mayuscula(new Date(a, m - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }));
}

function textoDia(fecha) {
  const [a, m, d] = fecha.split('-').map(Number);
  return mayuscula(new Date(a, m - 1, d).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' }));
}

// Acepta "1,50", "1.5", "2", "2 €"... Devuelve céntimos o null si no es válido.
function aCentimos(texto) {
  const limpio = String(texto).replace(/[\s€]/g, '').replace(',', '.');
  if (!/^(\d+(\.\d{0,2})?|\.\d{1,2})$/.test(limpio)) return null;
  return Math.round(parseFloat(limpio) * 100);
}

function aTextoImporte(centimos) {
  return (centimos / 100).toFixed(2).replace('.', ',');
}

const dinero = (centimos) => euros.format(centimos / 100);
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const clavePersona = (nombre) => nombre.trim().toLocaleLowerCase('es');

function sumar(lista) {
  return lista.reduce((total, r) => total + r.centimos, 0);
}

function ordenarRecientes(lista) {
  return [...lista].sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.creado || 0) - (a.creado || 0));
}

// ---------- Creación de elementos ----------

function crear(etiqueta, propiedades = {}, ...hijos) {
  const el = document.createElement(etiqueta);
  Object.assign(el, propiedades);
  el.append(...hijos);
  return el;
}

function elementoCobro(r) {
  const info = crear('div', { className: 'cobro-info' }, crear('strong', { textContent: r.nombre }));
  if (r.nota) info.append(crear('small', { textContent: r.nota }));

  const editar = crear('button', { type: 'button', textContent: 'Editar' });
  editar.addEventListener('click', () => empezarEdicion(r.id));
  const borrar = crear('button', { type: 'button', className: 'borrar', textContent: 'Borrar' });
  borrar.setAttribute('aria-label', `Borrar cobro de ${r.nombre}`);
  borrar.addEventListener('click', () => borrarCobro(r.id));

  return crear('li', { className: 'cobro' },
    info,
    crear('span', { className: 'cobro-importe', textContent: dinero(r.centimos) }),
    crear('div', { className: 'cobro-acciones' }, editar, borrar));
}

function chip(texto, alPulsar) {
  const b = crear('button', { type: 'button', className: 'chip', textContent: texto });
  b.addEventListener('click', alPulsar);
  return b;
}

// ---------- Pintado ----------

function pintar() {
  pintarHoy();
  pintarMes();
  pintarSugerencias();
}

function pintarHoy() {
  const fechaHoy = hoy();
  const deHoy = ordenarRecientes(cobros.filter((r) => r.fecha === fechaHoy));
  const delMes = cobros.filter((r) => mesDe(r.fecha) === mesDe(fechaHoy));

  $('total-hoy').textContent = dinero(sumar(deHoy));
  $('cabecera-hoy').textContent = dinero(sumar(deHoy));
  $('num-hoy').textContent = plural(deHoy.length, 'cobro', 'cobros');
  $('total-mes-actual').textContent = dinero(sumar(delMes));
  $('num-mes-actual').textContent = plural(delMes.length, 'cobro', 'cobros');

  $('lista-hoy').replaceChildren(...deHoy.map(elementoCobro));
  $('vacio-hoy').hidden = deHoy.length > 0;
}

function pintarMes() {
  const delMes = cobros.filter((r) => mesDe(r.fecha) === mesVisible);
  const total = sumar(delMes);

  $('titulo-mes').textContent = textoMes(mesVisible);
  $('mes-siguiente').disabled = mesVisible >= mesDe(hoy());
  $('total-mes').textContent = dinero(total);
  $('num-mes').textContent = plural(delMes.length, 'cobro', 'cobros');

  // Agrupar por día
  const porDia = new Map();
  for (const r of ordenarRecientes(delMes)) {
    if (!porDia.has(r.fecha)) porDia.set(r.fecha, []);
    porDia.get(r.fecha).push(r);
  }
  $('dias-mes').textContent = porDia.size;
  $('media-mes').textContent = dinero(porDia.size ? Math.round(total / porDia.size) : 0);

  $('por-dia').replaceChildren(...[...porDia].map(([fecha, lista]) => {
    const resumen = crear('summary', {},
      crear('span', { className: 'dia-fecha', textContent: textoDia(fecha) }),
      crear('span', { className: 'dia-num', textContent: plural(lista.length, 'cobro', 'cobros') }),
      crear('span', { className: 'dia-total', textContent: dinero(sumar(lista)) }));
    return crear('details', { className: 'dia' }, resumen,
      crear('ul', { className: 'lista' }, ...lista.map(elementoCobro)));
  }));

  // Agrupar por persona (sin distinguir mayúsculas)
  const porPersona = new Map();
  for (const r of ordenarRecientes(delMes)) {
    const clave = clavePersona(r.nombre);
    const p = porPersona.get(clave) || { nombre: r.nombre, num: 0, total: 0 };
    p.num += 1;
    p.total += r.centimos;
    porPersona.set(clave, p);
  }
  const filas = [...porPersona.values()].sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, 'es'));
  $('por-persona').replaceChildren(...filas.map((p) => crear('tr', {},
    crear('td', { textContent: p.nombre }),
    crear('td', { textContent: p.num }),
    crear('td', { textContent: dinero(p.total) }))));

  $('tabla-personas').hidden = filas.length === 0;
  $('vacio-mes').hidden = filas.length > 0;
  $('btn-csv').disabled = delMes.length === 0;
}

// Personas más frecuentes (últimos 60 días) como botones y todas en el autocompletado
function pintarSugerencias() {
  const limite = new Date();
  limite.setDate(limite.getDate() - 60);
  const desde = `${limite.getFullYear()}-${pad(limite.getMonth() + 1)}-${pad(limite.getDate())}`;

  const todas = new Map();
  const frecuencia = new Map();
  for (const r of ordenarRecientes(cobros)) {
    const clave = clavePersona(r.nombre);
    if (!todas.has(clave)) todas.set(clave, r.nombre);
    if (r.fecha >= desde) frecuencia.set(clave, (frecuencia.get(clave) || 0) + 1);
  }

  $('lista-nombres').replaceChildren(...[...todas.values()].map((n) => crear('option', { value: n })));

  const frecuentes = [...frecuencia].sort((a, b) => b[1] - a[1]).slice(0, 8);
  $('chips-nombres').replaceChildren(...frecuentes.map(([clave]) => chip(todas.get(clave), () => {
    $('nombre').value = todas.get(clave);
    marcarChips();
    $('importe').focus();
  })));

  $('chips-importes').replaceChildren(...ajustes.importesRapidos.map((c) => {
    const b = chip(dinero(c), () => {
      $('importe').value = aTextoImporte(c);
      marcarChips();
    });
    b.dataset.centimos = c;
    return b;
  }));
  marcarChips();
}

function marcarChips() {
  const nombre = clavePersona($('nombre').value);
  for (const b of $('chips-nombres').children) {
    b.setAttribute('aria-pressed', clavePersona(b.textContent) === nombre);
  }
  const centimos = aCentimos($('importe').value);
  for (const b of $('chips-importes').children) {
    b.setAttribute('aria-pressed', Number(b.dataset.centimos) === centimos);
  }
}

// ---------- Formulario de cobro ----------

function mostrarError(texto) {
  $('error-form').textContent = texto;
  $('error-form').hidden = !texto;
}

function limpiarFormulario() {
  idEditando = null;
  $('form-cobro').reset();
  $('fecha').value = hoy();
  $('titulo-form').textContent = 'Nuevo cobro';
  $('btn-guardar').textContent = 'Añadir';
  $('btn-cancelar').hidden = true;
  $('mas-opciones').open = false;
  mostrarError('');
  marcarChips();
}

$('form-cobro').addEventListener('submit', (e) => {
  e.preventDefault();
  let nombre = $('nombre').value.trim().replace(/\s+/g, ' ');
  const centimos = aCentimos($('importe').value);
  const fecha = $('fecha').value || hoy();
  const nota = $('nota').value.trim();

  if (!nombre) {
    mostrarError('Escribe el nombre de la persona.');
    $('nombre').focus();
    return;
  }
  if (centimos === null || centimos <= 0) {
    mostrarError('Escribe un importe válido, por ejemplo 1,50.');
    $('importe').focus();
    return;
  }

  const editando = cobros.find((r) => r.id === idEditando);
  // Mismo nombre con otras mayúsculas: se reutiliza como ya estaba escrito
  const conocido = cobros.find((r) => r.id !== idEditando && clavePersona(r.nombre) === clavePersona(nombre));
  if (conocido && !editando) nombre = conocido.nombre;

  if (editando) {
    Object.assign(editando, { nombre, centimos, fecha, nota });
  } else {
    cobros.push({ id: nuevoId(), fecha, nombre, centimos, nota, creado: Date.now() });
  }
  guardarCobros();
  limpiarFormulario();
  pintar();
  avisar(editando ? 'Cambios guardados' : `+${dinero(centimos)} añadido`);
});

$('btn-cancelar').addEventListener('click', limpiarFormulario);
$('nombre').addEventListener('input', () => { mostrarError(''); marcarChips(); });
$('importe').addEventListener('input', () => { mostrarError(''); marcarChips(); });

function empezarEdicion(id) {
  const r = cobros.find((x) => x.id === id);
  if (!r) return;
  idEditando = id;
  $('nombre').value = r.nombre;
  $('importe').value = aTextoImporte(r.centimos);
  $('fecha').value = r.fecha;
  $('nota').value = r.nota || '';
  $('titulo-form').textContent = 'Editar cobro';
  $('btn-guardar').textContent = 'Guardar cambios';
  $('btn-cancelar').hidden = false;
  $('mas-opciones').open = true;
  mostrarError('');
  marcarChips();
  cambiarVista('hoy');
  $('form-cobro').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function borrarCobro(id) {
  const r = cobros.find((x) => x.id === id);
  if (!r) return;
  if (!confirm(`¿Borrar el cobro de ${r.nombre} (${dinero(r.centimos)})?`)) return;
  cobros = cobros.filter((x) => x.id !== id);
  if (idEditando === id) limpiarFormulario();
  guardarCobros();
  pintar();
  avisar('Cobro borrado');
}

// ---------- Navegación ----------

function cambiarVista(vista) {
  for (const b of document.querySelectorAll('.pestanas button')) {
    if (b.dataset.vista === vista) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  for (const s of document.querySelectorAll('.vista')) {
    s.hidden = s.id !== `vista-${vista}`;
  }
  window.scrollTo(0, 0);
}

for (const b of document.querySelectorAll('.pestanas button')) {
  b.addEventListener('click', () => cambiarVista(b.dataset.vista));
}

$('mes-anterior').addEventListener('click', () => { mesVisible = sumarMeses(mesVisible, -1); pintarMes(); });
$('mes-siguiente').addEventListener('click', () => { mesVisible = sumarMeses(mesVisible, 1); pintarMes(); });

// ---------- Aviso flotante ----------

let temporizadorAviso;
function avisar(texto) {
  $('toast').textContent = texto;
  $('toast').hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => { $('toast').hidden = true; }, 2200);
}

// ---------- Ajustes: importes rápidos ----------

$('form-importes').addEventListener('submit', (e) => {
  e.preventDefault();
  const partes = $('importes-rapidos').value.split(/[\s;]+/).filter(Boolean);
  const valores = partes.map(aCentimos);
  if (valores.some((c) => c === null || c <= 0)) {
    avisar('Hay algún importe no válido');
    return;
  }
  ajustes.importesRapidos = [...new Set(valores)].sort((a, b) => a - b).slice(0, 8);
  guardarAjustes();
  pintarAjustes();
  pintarSugerencias();
  avisar('Importes guardados');
});

function pintarAjustes() {
  $('importes-rapidos').value = ajustes.importesRapidos.map(aTextoImporte).join(' ');
}

// ---------- Exportar / importar ----------

function descargar(nombreArchivo, contenido, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = crear('a', { href: url, download: nombreArchivo });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('btn-exportar').addEventListener('click', () => {
  const copia = { app: 'contador-dinero', formato: 1, exportado: new Date().toISOString(), cobros, ajustes };
  descargar(`cobros-copia-${hoy()}.json`, JSON.stringify(copia, null, 2), 'application/json');
});

$('archivo-importar').addEventListener('change', async (e) => {
  const archivo = e.target.files[0];
  e.target.value = '';
  if (!archivo) return;
  try {
    const copia = JSON.parse(await archivo.text());
    const lista = Array.isArray(copia) ? copia : copia.cobros;
    if (!Array.isArray(lista)) throw new Error('formato');
    const ids = new Set(cobros.map((r) => r.id));
    const nuevos = lista.filter((r) => esCobroValido(r) && !ids.has(r.id));
    cobros.push(...nuevos);
    guardarCobros();
    pintar();
    avisar(`${plural(nuevos.length, 'cobro restaurado', 'cobros restaurados')}`);
  } catch {
    avisar('El archivo no es una copia válida');
  }
});

$('btn-csv').addEventListener('click', () => {
  const campo = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const filas = ordenarRecientes(cobros.filter((r) => mesDe(r.fecha) === mesVisible)).reverse();
  const lineas = [
    'Fecha;Persona;Importe;Nota',
    ...filas.map((r) => [r.fecha, campo(r.nombre), aTextoImporte(r.centimos), campo(r.nota || '')].join(';')),
    `;${campo('TOTAL')};${aTextoImporte(sumar(filas))};`,
  ];
  // BOM para que Excel abra bien las tildes
  descargar(`cobros-${mesVisible}.csv`, '\uFEFF' + lineas.join('\r\n'), 'text/csv;charset=utf-8');
});

// ---------- Actualizaciones (service worker) ----------

let registro = null;
let actualizando = false;

function estadoActualizacion(texto) {
  $('estado-actualizacion').textContent = texto;
}

// Pide la versión a un service worker concreto
function pedirVersion(sw) {
  return new Promise((resolve) => {
    if (!sw) return resolve(null);
    const canal = new MessageChannel();
    canal.port1.onmessage = (e) => resolve(e.data && e.data.version);
    sw.postMessage({ tipo: 'VERSION' }, [canal.port2]);
    setTimeout(() => resolve(null), 3000);
  });
}

async function mostrarAviso(sw) {
  $('aviso-actualizacion').hidden = false;
  estadoActualizacion('Hay una nueva versión lista. Pulsa «Actualizar».');
  const version = await pedirVersion(sw);
  $('aviso-version').textContent = version || '';
}

function vigilarInstalacion(sw) {
  if (!sw) return;
  sw.addEventListener('statechange', () => {
    if (sw.state === 'installed' && navigator.serviceWorker.controller) mostrarAviso(sw);
  });
}

async function iniciarActualizaciones() {
  if (!('serviceWorker' in navigator)) {
    estadoActualizacion('Este navegador no permite actualizar desde la app.');
    $('btn-buscar-actualizacion').disabled = true;
    return;
  }
  try {
    registro = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
  } catch {
    estadoActualizacion('No se pudo activar el modo sin conexión.');
    return;
  }

  if (registro.waiting && navigator.serviceWorker.controller) mostrarAviso(registro.waiting);
  vigilarInstalacion(registro.installing);
  registro.addEventListener('updatefound', () => vigilarInstalacion(registro.installing));

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (actualizando) location.reload();
  });

  await navigator.serviceWorker.ready;
  const version = await pedirVersion(registro.active);
  $('version-instalada').textContent = version || '—';
}

$('btn-buscar-actualizacion').addEventListener('click', async () => {
  if (!registro) return;
  estadoActualizacion('Buscando…');
  try {
    await registro.update();
  } catch {
    estadoActualizacion('Sin conexión. Inténtalo más tarde.');
    return;
  }
  if (registro.waiting) mostrarAviso(registro.waiting);
  else if (registro.installing) estadoActualizacion('Descargando nueva versión…');
  else estadoActualizacion('Ya tienes la última versión.');
});

$('btn-aplicar-actualizacion').addEventListener('click', () => {
  const sw = registro && registro.waiting;
  if (!sw) return;
  actualizando = true;
  sw.postMessage({ tipo: 'SKIP_WAITING' });
});

// Al volver a la app: refrescar el día (puede haber cambiado) y buscar actualizaciones
let ultimoDia = hoy();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (hoy() !== ultimoDia) {
    if (!idEditando && $('fecha').value === ultimoDia) $('fecha').value = hoy();
    ultimoDia = hoy();
    pintar();
  }
  if (registro) registro.update().catch(() => {});
});

// ---------- Inicio ----------

if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
limpiarFormulario();
pintarAjustes();
pintar();
iniciarActualizaciones();
