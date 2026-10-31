import { auth, db, configurado } from './firebase.js';
import { NOMBRE_APP } from './config.js';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { ref, get, set, update, remove, onValue, serverTimestamp, query, orderByChild, limitToLast } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import { esc, rico, conDatos, conNombres, TIPOS, nombreTipo, esActividad, esCorregible, itemPublico, comprobar, textoRespuesta, solucionTexto, generarCodigo, nuevoId, parseNum, fecha, evaluar, tieneVariantes, valores, datosTexto, fmtNum, infoEnlace, buscarEnlaces } from './lib.js';

const app = document.getElementById('app');
const dlg = document.getElementById('dlg');
const $ = s => app.querySelector(s);
let U = null;
let limpiar = [];
const alSalir = f => limpiar.push(f);
const sinMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;

const ICO = {
  arriba: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  abajo: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

function reset() {
  limpiar.forEach(f => { try { f(); } catch {} });
  limpiar = [];
  document.onkeydown = null;
  document.body.classList.remove('modo-proyector');
  if (dlg.open) dlg.close();
}

function marco(html) {
  return `<header class="barra">
    <a class="marca" href="#/"><img class="logo-claro" src="logo.svg" alt="mariancr"><span class="marca-nombre">${esc(NOMBRE_APP)}</span></a>
    <div class="usuario"><span>${esc(U?.displayName || U?.email || '')}</span><button class="btn peq" id="salir">Salir</button></div>
  </header><main class="contenido">${html}</main>`;
}

function enlaceAlumno(code) {
  const u = new URL('index.html', location.href);
  u.search = `?c=${code}`;
  u.hash = '';
  return u;
}
const enlaceCorto = u => (u.host + u.pathname).replace(/index\.html$/, '');

function estado(items, i) {
  const it = items[i];
  return { index: i, total: items.length, item: itemPublico(it), open: esActividad(it), reveal: false, updatedAt: serverTimestamp() };
}

// ── Acceso ───────────────────────────────────────────────────────
function pantallaLogin() {
  reset();
  app.innerHTML = `<section class="acceso">
    <img class="logo-entrada logo-claro" src="logo.svg" alt="mariancr">
    <h1>${esc(NOMBRE_APP)}</h1>
    <p>Prepara tus lecciones y dirige la clase desde aquí. El alumnado entra con su cuenta del colegio y el código de la clase.</p>
    <button class="btn primario grande" id="google">Entrar con Google</button>
    <p class="aviso" id="err" role="alert"></p></section>`;
  $('#google').onclick = async () => {
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch (e) { $('#err').textContent = `No se ha podido iniciar sesión (${e.code || e.message}). Si usas GitHub Pages, revisa que su dominio esté en los dominios autorizados de Firebase.`; }
  };
}

function pantallaSinPermiso(user) {
  reset();
  app.innerHTML = `<section class="acceso">
    <h1>Falta un paso</h1>
    <p>Has entrado como ${esc(user.email)}, pero esta cuenta aún no está autorizada como docente.</p>
    <p>En la consola de Firebase, abre Realtime Database, crea dentro de <code>teachers</code> una clave con este identificador y ponle el valor <code>true</code>:</p>
    <p class="uid"><code>${esc(user.uid)}</code> <button class="btn peq" id="copiar">Copiar</button></p>
    <p>Después, recarga esta página.</p>
    <button class="btn" id="salir">Usar otra cuenta</button></section>`;
  $('#copiar').onclick = () => navigator.clipboard?.writeText(user.uid).then(() => { $('#copiar').textContent = 'Copiado'; });
}

app.addEventListener('click', e => { if (e.target.closest('#salir')) signOut(auth); });

if (!configurado) {
  app.innerHTML = `<section class="acceso"><h1>Falta conectar Firebase</h1><p>Abre <code>config.js</code> y pega la configuración de tu proyecto de Firebase. En el archivo <code>LEEME.md</code> tienes los pasos.</p></section>`;
} else {
  onAuthStateChanged(auth, async user => {
    if (!user || user.isAnonymous) { U = null; return pantallaLogin(); }
    const t = await get(ref(db, `teachers/${user.uid}`)).catch(() => null);
    if (!t || t.val() !== true) return pantallaSinPermiso(user);
    U = user;
    router();
  });
  window.addEventListener('hashchange', () => { if (U) router(); });
}

function router() {
  reset();
  const [, ruta, id] = location.hash.split('/');
  if (ruta === 'leccion' && id) return vistaEditor(id);
  if (ruta === 'directo' && id) return vistaDirecto(id);
  if (ruta === 'proyectar' && id) return vistaProyector(id);
  if (ruta === 'informe' && id) return vistaInforme(id);
  if (ruta === 'banco') return vistaBanco();
  return vistaInicio();
}

// ── Inicio: lecciones y clases recientes ─────────────────────────
function vistaInicio() {
  app.innerHTML = marco(`
  <section class="bloque">
    <div class="cab-bloque"><h1>Tus lecciones</h1><div class="acciones"><a class="btn" href="#/banco">Banco de preguntas</a><button class="btn primario" id="nueva">Nueva lección</button></div></div>
    <ul class="lista" id="lecciones"><li class="vacio">Cargando…</li></ul>
  </section>
  <section class="bloque">
    <h2>Clases recientes</h2>
    <ul class="lista" id="sesiones"><li class="vacio">Cargando…</li></ul>
  </section>`);

  $('#nueva').onclick = async () => {
    const id = nuevoId();
    await set(ref(db, `lessons/${U.uid}/${id}`), { title: 'Lección sin título', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    location.hash = `#/leccion/${id}`;
  };

  alSalir(onValue(ref(db, `lessons/${U.uid}`), snap => {
    const ul = $('#lecciones'); if (!ul) return;
    const ls = Object.entries(snap.val() || {}).sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));
    ul.innerHTML = ls.length ? ls.map(([id, l]) => {
      const its = l.items || [];
      const nd = its.filter(i => i.type === 'slide').length, na = its.length - nd;
      return `<li class="fila">
        <div class="fila-info"><a class="fila-titulo" href="#/leccion/${id}">${esc(l.title)}</a>
          <span class="meta">${nd} ${nd === 1 ? 'diapositiva' : 'diapositivas'} y ${na} ${na === 1 ? 'actividad' : 'actividades'}</span></div>
        <div class="fila-acc">
          <a class="btn peq" href="#/leccion/${id}">Editar</a>
          <button class="btn peq primario" data-empezar="${id}" ${its.length ? '' : 'disabled'}>Empezar clase</button>
          <button class="btn peq peligro" data-borrar="${id}">Eliminar</button>
        </div></li>`;
    }).join('') : `<li class="vacio">Aún no tienes lecciones. Crea una y sube tu presentación en PDF.</li>`;
  }));

  alSalir(onValue(query(ref(db, `teacherSessions/${U.uid}`), orderByChild('createdAt'), limitToLast(15)), snap => {
    const ul = $('#sesiones'); if (!ul) return;
    const ss = [];
    snap.forEach(c => { ss.push([c.key, c.val()]); });
    ss.reverse();
    ul.innerHTML = ss.length ? ss.map(([code, s]) => `<li class="fila">
      <div class="fila-info"><span class="fila-titulo">${esc(s.lessonTitle)}</span>
        <span class="meta">${fecha(s.createdAt)}, código ${code}${s.endedAt ? '' : ', <strong class="en-curso">en curso</strong>'}</span></div>
      <div class="fila-acc">
        ${s.endedAt ? '' : `<a class="btn peq primario" href="#/directo/${code}">Volver al directo</a>`}
        <a class="btn peq" href="#/informe/${code}">Informe</a>
      </div></li>`).join('') : `<li class="vacio">Cuando des tu primera clase, aparecerá aquí con su informe.</li>`;
  }));

  $('.contenido') && (app.querySelector('.contenido').onclick = async e => {
    const emp = e.target.closest('[data-empezar]');
    if (emp) { emp.disabled = true; emp.textContent = 'Preparando…'; return empezarClase(emp.dataset.empezar); }
    const bor = e.target.closest('[data-borrar]');
    if (bor && confirm('¿Eliminar esta lección y sus diapositivas? Los informes de las clases ya dadas se conservan.')) {
      await remove(ref(db, `slides/${U.uid}/${bor.dataset.borrar}`));
      await remove(ref(db, `lessons/${U.uid}/${bor.dataset.borrar}`));
    }
  });
}

async function empezarClase(lessonId) {
  const l = (await get(ref(db, `lessons/${U.uid}/${lessonId}`))).val();
  const items = l?.items || [];
  if (!items.length) return alert('Esta lección aún no tiene diapositivas ni actividades.');
  let code;
  for (let i = 0; i < 10; i++) {
    code = generarCodigo();
    if (!(await get(ref(db, `sessions/${code}`))).exists()) break;
  }
  await set(ref(db, `teacherSessions/${U.uid}/${code}`), { lessonId, lessonTitle: l.title, createdAt: serverTimestamp(), items });
  await set(ref(db, `sessions/${code}`), { owner: U.uid, lessonId, lessonTitle: l.title, createdAt: serverTimestamp(), showCode: true, state: estado(items, 0) });
  location.hash = `#/directo/${code}`;
}

// ── Editor de lección ────────────────────────────────────────────
async function vistaEditor(id) {
  app.innerHTML = marco(`<p class="vacio">Cargando lección…</p>`);
  const lRef = ref(db, `lessons/${U.uid}/${id}`);
  const L = (await get(lRef)).val();
  if (!L) { app.innerHTML = marco(`<p class="vacio">Esa lección no existe. <a href="#/">Volver a tus lecciones</a></p>`); return; }
  let items = L.items || [];
  const diapos = (await get(ref(db, `slides/${U.uid}/${id}`))).val() || {};
  const guardar = () => update(lRef, { items, updatedAt: serverTimestamp() });

  function fila(it, i) {
    const mini = it.type === 'slide'
      ? (diapos[it.page] ? `<img src="${diapos[it.page]}" alt="">` : '')
      : `<span class="mini-act">${nombreTipo(it)}</span>`;
    let meta = '';
    if (it.type === 'quiz') meta = `${it.options.length} opciones`;
    if (it.type === 'number') meta = tieneVariantes(it) ? `Con datos distintos para cada alumno: ${it.formula}, tolerancia ${it.tolerance}%` : `Solución ${solucionTexto(it)}, tolerancia ${it.tolerance}%`;
    if (it.type === 'link') meta = `${it.url}${it.embed ? ' · se ve dentro de la clase' : ' · se abre en otra pestaña'}`;
    if (it.type === 'short') meta = esCorregible(it) ? 'Se corrige sola' : 'Corrección manual';
    if (it.type === 'draw') meta = it.background ? `Sobre la diapositiva ${it.background}` : 'Lienzo en blanco';
    return `<li class="item ${it.type === 'slide' ? 'es-diapo' : it.type === 'link' ? 'es-act es-enlace' : 'es-act'}">
      <div class="miniatura">${mini}</div>
      <div class="info"><strong>${it.type === 'slide' ? `Diapositiva ${it.page}` : rico(conNombres(it.prompt, it))}</strong>${meta ? `<span class="meta">${esc(meta)}</span>` : ''}</div>
      <div class="botones">
        <button class="btn-ico" data-up="${i}" aria-label="Subir" ${i === 0 ? 'disabled' : ''}>${ICO.arriba}</button>
        <button class="btn-ico" data-down="${i}" aria-label="Bajar" ${i === items.length - 1 ? 'disabled' : ''}>${ICO.abajo}</button>
        ${it.type !== 'slide' ? `<button class="btn peq" data-edit="${i}">Editar</button>` : ''}
        <button class="btn peq" data-add="${i}">Añadir actividad debajo</button>
        <button class="btn peq peligro" data-del="${i}">Quitar</button>
      </div></li>`;
  }

  function pintar() {
    app.innerHTML = marco(`
    <section class="editor">
      <div class="cab-editor">
        <input id="titulo" class="titulo-input" value="${esc(L.title)}" aria-label="Título de la lección" maxlength="120">
        <div class="acciones">
          <label class="btn">${Object.keys(diapos).length ? 'Reemplazar PDF' : 'Subir PDF'}<input type="file" id="pdf" accept="application/pdf" hidden></label>
          <button class="btn primario" id="empezar" ${items.length ? '' : 'disabled'}>Empezar clase</button>
        </div>
      </div>
      <p class="ayuda" id="progreso" aria-live="polite">${items.length ? 'Ordena las diapositivas y añade actividades donde quieras que la clase participe.' : 'Sube tu presentación en PDF. Si la tienes en PowerPoint o Google Slides, expórtala antes como PDF.'}</p>
      <ol class="items" id="items">${items.map(fila).join('')}</ol>
      <button class="btn" data-add="${items.length - 1}">Añadir actividad al final</button>
    </section>`);

    $('#titulo').onchange = e => { L.title = e.target.value.trim() || 'Lección sin título'; update(lRef, { title: L.title, updatedAt: serverTimestamp() }); };
    $('#pdf').onchange = e => { const f = e.target.files[0]; if (f) procesarPDF(f); };
    $('#empezar').onclick = e => { e.target.disabled = true; empezarClase(id); };
    app.querySelector('.editor').onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      const d = b.dataset;
      if (d.up) { const i = +d.up; [items[i - 1], items[i]] = [items[i], items[i - 1]]; guardar(); pintar(); }
      if (d.down) { const i = +d.down; [items[i + 1], items[i]] = [items[i], items[i + 1]]; guardar(); pintar(); }
      if (d.del) {
        const i = +d.del;
        const msg = items[i].type === 'slide' ? '¿Quitar esta diapositiva de la lección?' : '¿Eliminar esta actividad?';
        if (confirm(msg)) { items.splice(i, 1); guardar(); pintar(); }
      }
      if (d.edit) { const i = +d.edit; dialogoActividad(items[i], paginas(), nuevo => { items[i] = nuevo; guardar(); pintar(); }); }
      if (d.add !== undefined) { const i = +d.add; dialogoActividad(null, paginas(), (...nuevos) => { items.splice(i + 1, 0, ...nuevos); guardar(); pintar(); }); }
    };
  }

  const paginas = () => Object.keys(diapos).filter(k => diapos[k]).map(Number).sort((a, b) => a - b);

  async function procesarPDF(file) {
    const hayDiapos = items.some(i => i.type === 'slide');
    if (hayDiapos && !confirm('Se reemplazarán las imágenes de las diapositivas. Tus actividades se mantienen donde están. ¿Continuar?')) return;
    const prog = $('#progreso');
    const botones = app.querySelectorAll('button, input');
    botones.forEach(b => b.disabled = true);
    try {
      const pdfjs = window.pdfjsLib;
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      const n = pdf.numPages;
      const encontrados = [];
      for (let p = 1; p <= n; p++) {
        prog.textContent = `Procesando página ${p} de ${n}…`;
        const page = await pdf.getPage(p);
        const v1 = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: Math.min(2.5, 1600 / v1.width) });
        const c = document.createElement('canvas');
        c.width = Math.round(vp.width); c.height = Math.round(vp.height);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        const url = c.toDataURL('image/jpeg', 0.75);
        await set(ref(db, `slides/${U.uid}/${id}/${p}`), url);
        diapos[p] = url;
        encontrados.push(...await enlacesDePagina(page, p));
      }
      for (const k of Object.keys(diapos)) if (Number(k) > n) { await remove(ref(db, `slides/${U.uid}/${id}/${k}`)); delete diapos[k]; }
      const existentes = new Set(items.filter(i => i.type === 'slide').map(i => i.page));
      items = items.filter(it => it.type !== 'slide' || it.page <= n);
      for (let p = 1; p <= n; p++) if (!existentes.has(p)) items.push({ id: nuevoId(), type: 'slide', page: p });
      await update(lRef, { pageCount: n });
      await guardar();
      pintar();
      $('#progreso').textContent = `Listo: ${n} ${n === 1 ? 'página cargada' : 'páginas cargadas'}. Ahora puedes añadir actividades.`;
      const yaEstan = new Set(items.filter(i => i.type === 'link').map(i => i.url));
      const nuevos = encontrados.filter(e => !yaEstan.has(e.info.url));
      if (nuevos.length) dialogoEnlacesPDF(nuevos, sel => {
        // De la última a la primera para que las posiciones no se muevan
        for (const e of [...sel].reverse()) {
          const k = items.findIndex(i => i.type === 'slide' && i.page === e.page);
          const it = { id: nuevoId(), type: 'link', url: e.info.url, prompt: tituloEnlace(e.info) };
          if (e.info.embed) it.embed = e.info.embed;
          items.splice(k + 1, 0, it);
        }
        guardar(); pintar();
        if (sel.length) $('#progreso').textContent = `Añadidos ${sel.length} ${sel.length === 1 ? 'enlace' : 'enlaces'} después de sus diapositivas.`;
      });
    } catch (e) {
      console.error(e);
      pintar();
      $('#progreso').textContent = 'No se ha podido procesar el PDF. Comprueba que no esté protegido con contraseña e inténtalo de nuevo.';
    }
  }

  pintar();
}

// Enlaces de una página del PDF: los vínculos y las direcciones escritas en el texto
async function enlacesDePagina(page, p) {
  const urls = [];
  try {
    for (const a of await page.getAnnotations()) if (a.subtype === 'Link' && a.url) urls.push(a.url);
    const tc = await page.getTextContent();
    urls.push(...buscarEnlaces(tc.items.map(t => t.str + (t.hasEOL ? '\n' : '')).join('')));
  } catch (e) { console.warn('No se han podido leer los enlaces de la página', p, e); }
  const vistos = new Set(), out = [];
  for (const u of urls) {
    const info = infoEnlace(u);
    const clave = info?.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
    if (!info || vistos.has(clave)) continue;
    vistos.add(clave);
    out.push({ page: p, info });
  }
  return out;
}

// ── Diálogo de actividad ─────────────────────────────────────────
const DESCRIPCION = {
  quiz: 'Varias opciones, con o sin respuesta correcta',
  short: 'El alumnado escribe un texto breve',
  number: 'Un valor numérico, con unidad y tolerancia. Puede llevar datos distintos para cada alumno',
  draw: 'Dibujan en blanco o sobre una diapositiva'
};

// Atajos para escribir fórmulas. ‸ marca dónde queda el cursor
const ATAJOS = [
  ['Fórmula', '$‸$'], ['Química', '$\\ce{‸}$'], ['Fracción', '$\\frac{‸}{}$'], ['Potencia', '$x^{‸}$'],
  ['Subíndice', '$x_{‸}$'], ['·10ⁿ', '$\\cdot 10^{‸}$'], ['Reacción', '$\\ce{‸ -> }$'], ['Equilibrio', '$\\ce{‸ <=> }$']
];
const AYUDA_FORMULAS = 'Escribe las fórmulas entre dólares: <code>$v = \\frac{d}{t}$</code>. Para química: <code>$\\ce{H2SO4}$</code>, <code>$\\ce{Fe^3+}$</code>, <code>$\\ce{N2 + 3H2 &lt;=&gt; 2NH3}$</code>. Debajo ves cómo queda.';

// opciones.banco: el diálogo se usa desde el banco (sin «guardar también en el banco» ni fondos)
function dialogoActividad(item, paginas, alGuardar, opciones = {}) {
  const enBanco = !!opciones.banco;
  let ultimoCampo = null;

  function elegirTipo() {
    dlg.innerHTML = `<form method="dialog" class="dlg">
      <h2>Nueva actividad</h2>
      <div class="tipos">${['quiz', 'short', 'number', 'draw'].map(t => `<button type="button" class="tipo-btn" data-t="${t}"><strong>${TIPOS[t]}</strong><span>${DESCRIPCION[t]}</span></button>`).join('')}
        ${enBanco ? '' : `<button type="button" class="tipo-btn" id="enlace"><strong>Enlace</strong><span>Una actividad de otra web: Wordwall, Genially, YouTube, GeoGebra…</span></button>
        <button type="button" class="tipo-btn tipo-banco" id="desde-banco"><strong>Desde el banco</strong><span>Reutiliza preguntas que ya tienes guardadas</span></button>`}</div>
      <div class="pie"><button class="btn" value="cancel">Cancelar</button></div></form>`;
    dlg.querySelectorAll('[data-t]').forEach(b => b.onclick = () => formularioTipo({ type: b.dataset.t }));
    const db_ = dlg.querySelector('#desde-banco');
    if (db_) db_.onclick = () => elegirDelBanco(alGuardar);
    const en = dlg.querySelector('#enlace');
    if (en) en.onclick = () => dialogoEnlace(null, alGuardar);
  }

  function filaOp(texto, i, marcada) {
    return `<div class="op"><input type="radio" name="correcta" ${marcada ? 'checked' : ''} aria-label="Marcar como correcta">
      <input class="op-txt" value="${esc(texto)}" placeholder="Opción ${i + 1}" maxlength="300">
      <button type="button" class="btn-ico" data-quitar aria-label="Quitar opción">×</button></div>`;
  }

  function filaDato(v = {}) {
    return `<div class="dato">
      <input class="d-nom" value="${esc(v.name || '')}" placeholder="m" aria-label="Nombre del dato" maxlength="12" spellcheck="false">
      <input class="d-min" value="${esc(v.min != null ? fmtNum(Number(v.min), 6) : '')}" placeholder="mín." aria-label="Valor mínimo" inputmode="decimal">
      <input class="d-max" value="${esc(v.max != null ? fmtNum(Number(v.max), 6) : '')}" placeholder="máx." aria-label="Valor máximo" inputmode="decimal">
      <input class="d-paso" value="${esc(v.step ? fmtNum(Number(v.step), 6) : '')}" placeholder="paso" aria-label="Paso entre valores" inputmode="decimal">
      <button type="button" class="btn-ico" data-quitar-dato aria-label="Quitar dato">×</button></div>`;
  }

  function formularioTipo(base) {
    const t = base.type;
    let campos = '';
    if (t === 'quiz') {
      const ops = base.options?.length ? base.options : ['', ''];
      campos = `<fieldset class="opciones"><legend>Opciones (marca la correcta)</legend>
        <div id="ops">${ops.map((o, i) => filaOp(o, i, !base.poll && Number(base.correct) === i)).join('')}</div>
        <button type="button" class="btn peq" id="addop">Añadir opción</button></fieldset>
        <label class="check"><input type="checkbox" id="encuesta" ${base.poll ? 'checked' : ''}> Es una encuesta: no hay respuesta correcta</label>`;
    }
    if (t === 'short') {
      campos = `<label>Respuestas válidas (opcional)
        <input id="aceptadas" value="${esc(base.accepted || '')}" placeholder="Por ejemplo: evaporación; vaporización">
        <span class="ayuda">Sepáralas con punto y coma. Si las indicas, se corrige sola sin tener en cuenta mayúsculas ni tildes.</span></label>`;
    }
    if (t === 'number') {
      const vars = base.vars || [];
      campos = `<fieldset class="opciones"><legend>Datos distintos para cada alumno (opcional)</legend>
        <p class="ayuda">Cada alumno recibe sus propios valores. Escribe <code>{{m}}</code> en el enunciado donde quieras que aparezca el dato <code>m</code>, y usa <code>m</code> en la fórmula de la solución.</p>
        <div class="dato dato-cab" ${vars.length ? '' : 'hidden'} aria-hidden="true"><span>Nombre</span><span>Mínimo</span><span>Máximo</span><span>Paso</span><span></span></div>
        <div id="datos">${vars.map(filaDato).join('')}</div>
        <button type="button" class="btn peq" id="adddato">Añadir dato</button></fieldset>
        <div class="rejilla-3">
        <label>Solución<input id="sol" value="${esc(base.formula ?? (base.answer != null ? fmtNum(Number(base.answer), 10) : ''))}" placeholder="9,8 o m*9,8" spellcheck="false"></label>
        <label>Tolerancia (%)<input id="tol" type="number" min="0" max="100" step="0.1" value="${esc(base.tolerance ?? 2)}"></label>
        <label>Unidad<input id="uni" value="${esc(base.unit || '')}" placeholder="m/s^2"></label></div>
        <span class="ayuda ayuda-sol">Con datos, la solución es una fórmula: <code>c*V/1000</code>, <code>sqrt(2*g*h)</code>, <code>-log(c)</code> (log en base 10, ln natural).</span>
        <label class="check"><input type="checkbox" id="pedir" ${base.unitMode === 'ask' ? 'checked' : ''}> El alumnado debe escribir la unidad (si no, la ve junto a la casilla)</label>`;
    }
    if (t === 'draw' && !enBanco) {
      campos = `<label>Fondo<select id="fondo"><option value="">Lienzo en blanco</option>${paginas.map(p => `<option value="${p}" ${Number(base.background) === p ? 'selected' : ''}>Diapositiva ${p}</option>`).join('')}</select></label>`;
    }
    const desdeBanco = !!base.bankId;
    const guardarEnBanco = enBanco ? '' : `<div class="guardar-banco">
        <label class="check"><input type="checkbox" id="al-banco" ${desdeBanco ? 'checked' : ''}> ${desdeBanco ? 'Actualizar también la pregunta del banco' : 'Guardar también en el banco de preguntas'}</label>
        <label class="tema-banco" ${desdeBanco ? '' : 'hidden'}>Tema o etiqueta<input id="tema" value="${esc(base.tema || '')}" placeholder="Q2B T1 Carbono" list="temas-banco" maxlength="60"></label></div>`;
    const temaBanco = enBanco ? `<label>Tema o etiqueta<input id="tema" value="${esc(base.tema || '')}" placeholder="Q2B T1 Carbono" list="temas-banco" maxlength="60"></label>` : '';

    dlg.innerHTML = `<form method="dialog" class="dlg">
      <h2>${item ? 'Editar' : 'Nueva'} ${enBanco ? 'pregunta' : 'actividad'}: ${TIPOS[t]}</h2>
      <label for="enun">Enunciado</label>
      <div class="atajos" role="toolbar" aria-label="Insertar fórmulas">${ATAJOS.map(([n, x]) => `<button type="button" class="btn peq" data-atajo="${esc(x)}">${esc(n)}</button>`).join('')}
        ${t === 'number' ? '<button type="button" class="btn peq" data-atajo="{{‸}}">Dato</button>' : ''}</div>
      <textarea id="enun" rows="3" maxlength="1000" required>${esc(base.prompt || '')}</textarea>
      <span class="ayuda">${AYUDA_FORMULAS}</span>
      <div class="vista-previa" id="vista" aria-live="polite"></div>
      ${campos}${temaBanco}${guardarEnBanco}
      <datalist id="temas-banco"></datalist>
      <p class="aviso" id="err" role="alert"></p>
      <div class="pie"><button class="btn" value="cancel">Cancelar</button><button type="button" class="btn primario" id="ok">Guardar ${enBanco ? 'pregunta' : 'actividad'}</button></div></form>`;

    const q = s => dlg.querySelector(s);
    ultimoCampo = q('#enun');
    dlg.querySelector('form').addEventListener('focusin', e => { if (e.target.matches('#enun, .op-txt')) ultimoCampo = e.target; });
    q('.atajos').onclick = e => {
      const b = e.target.closest('[data-atajo]'); if (!b) return;
      const c = ultimoCampo || q('#enun');
      const [antes, despues] = b.dataset.atajo.split('‸');
      const i = c.selectionStart ?? c.value.length, j = c.selectionEnd ?? i;
      c.value = c.value.slice(0, i) + antes + c.value.slice(i, j) + despues + c.value.slice(j);
      c.focus();
      c.setSelectionRange(i + antes.length, j + antes.length);
      vistaPrevia();
    };

    if (t === 'quiz') {
      q('#addop').onclick = () => {
        const n = q('#ops').children.length;
        if (n >= 6) return;
        q('#ops').insertAdjacentHTML('beforeend', filaOp('', n, false));
      };
      q('#ops').onclick = e => { if (e.target.closest('[data-quitar]') && q('#ops').children.length > 2) { e.target.closest('.op').remove(); vistaPrevia(); } };
    }
    if (t === 'number') {
      q('#adddato').onclick = () => {
        if (q('#datos').children.length >= 6) return;
        q('#datos').insertAdjacentHTML('beforeend', filaDato());
        q('.dato-cab').hidden = false;
        q('#datos').lastElementChild.querySelector('.d-nom').focus();
      };
      q('#datos').onclick = e => {
        if (!e.target.closest('[data-quitar-dato]')) return;
        e.target.closest('.dato').remove();
        q('.dato-cab').hidden = !q('#datos').children.length;
        vistaPrevia();
      };
    }
    const chk = q('#al-banco');
    if (chk) chk.onchange = () => { q('.tema-banco').hidden = !chk.checked; };
    temasBanco().then(ts => { const dl = q('#temas-banco'); if (dl) dl.innerHTML = ts.map(x => `<option value="${esc(x)}">`).join(''); });

    // Lee el formulario. Devuelve { out } o { error }
    function leer() {
      const prompt = q('#enun').value.trim();
      if (!prompt) return { error: 'Escribe el enunciado.' };
      const out = { id: base.id || nuevoId(), type: t, prompt };
      if (base.bankId) out.bankId = base.bankId;
      if (t === 'quiz') {
        const filas = [...q('#ops').children];
        out.options = filas.map(f => f.querySelector('.op-txt').value.trim());
        if (out.options.some(o => !o)) return { out, error: 'Rellena todas las opciones o quita las que sobren.' };
        out.poll = q('#encuesta').checked;
        if (!out.poll) {
          const c = filas.findIndex(f => f.querySelector('[type=radio]').checked);
          if (c < 0) return { out, error: 'Marca la opción correcta, o indica que es una encuesta.' };
          out.correct = c;
        }
      }
      if (t === 'short') { const a = q('#aceptadas').value.trim(); if (a) out.accepted = a; }
      if (t === 'number') {
        out.tolerance = Math.max(0, Number(q('#tol').value) || 0);
        const u = q('#uni').value.trim(); if (u) out.unit = u;
        out.unitMode = q('#pedir').checked && u ? 'ask' : 'show';
        const vars = [];
        for (const f of q('#datos').children) {
          const name = f.querySelector('.d-nom').value.trim();
          const [min, max, step] = ['.d-min', '.d-max', '.d-paso'].map(c => f.querySelector(c).value.trim());
          if (!name && !min && !max) continue;
          if (!/^[A-Za-z_][A-Za-z_0-9]*$/.test(name)) return { out, error: `El nombre del dato «${name}» solo puede llevar letras sin tilde, números y _, y empezar por letra.` };
          if (['pi', 'e', 'sqrt', 'raiz', 'log', 'ln', 'exp', 'sin', 'cos', 'tan', 'abs'].includes(name)) return { out, error: `«${name}» está reservado; usa otro nombre para el dato.` };
          if (vars.some(v => v.name === name)) return { out, error: `El dato «${name}» está repetido.` };
          const v = { name, min: parseNum(min), max: parseNum(max) };
          if (Number.isNaN(v.min) || Number.isNaN(v.max)) return { out, error: `Indica el mínimo y el máximo del dato «${name}» como números.` };
          if (v.min > v.max) [v.min, v.max] = [v.max, v.min];
          if (step) { v.step = parseNum(step); if (!(v.step > 0)) return { out, error: `El paso del dato «${name}» debe ser un número positivo.` }; }
          vars.push(v);
        }
        const sol = q('#sol').value.trim();
        if (!sol) return { out, error: 'Escribe la solución.' };
        if (vars.length) {
          out.vars = vars; out.formula = sol;
          try {
            const x = evaluar(sol, valores(out, 'prueba'));
            if (!Number.isFinite(x)) return { out, error: 'Con estos datos la fórmula no da un número (¿división por cero o raíz de un negativo?).' };
          } catch (e) { return { out, error: e.message }; }
          const sinUsar = vars.filter(v => !new RegExp(`\\{\\{\\s*${v.name}\\s*\\}\\}`).test(prompt));
          if (sinUsar.length) out.aviso = `El enunciado no muestra ${sinUsar.map(v => `{{${v.name}}}`).join(', ')}: el alumnado no verá ese dato.`;
        } else {
          let x = parseNum(sol);
          if (Number.isNaN(x)) { try { x = evaluar(sol); } catch { x = NaN; } }
          if (!Number.isFinite(x)) return { out, error: 'La solución debe ser un número (puedes usar coma decimal y 3e4 o 3·10^4). Para usar una fórmula, añade antes los datos.' };
          out.answer = x;
        }
      }
      if (t === 'draw' && !enBanco) { const f = q('#fondo').value; if (f) out.background = Number(f); }
      const tema = q('#tema')?.value.trim(); if (tema) out.tema = tema;
      return { out };
    }

    function vistaPrevia() {
      const { out, error } = leer();
      const el = q('#vista');
      if (!out) { el.innerHTML = ''; return; }
      let html = `<p class="tipo">Así lo verá un alumno${tieneVariantes(out) ? ' (ejemplo con datos al azar)' : ''}</p><p class="enunciado-previa">${rico(conDatos(out.prompt, out, 'ejemplo'))}</p>`;
      if (t === 'quiz') html += `<ol class="ops-previa">${out.options.map((o, i) => `<li class="${!out.poll && out.correct === i ? 'correcta' : ''}">${rico(o) || '…'}</li>`).join('')}</ol>`;
      if (t === 'number' && !error) {
        html += `<p class="meta">Solución${tieneVariantes(out) ? ' para este alumno' : ''}: <strong>${esc(solucionTexto(out, 'ejemplo'))}</strong></p>`;
        if (out.aviso) html += `<p class="aviso">${esc(out.aviso)}</p>`;
      }
      el.innerHTML = html;
    }
    let temporizador = null;
    dlg.querySelector('form').addEventListener('input', () => { clearTimeout(temporizador); temporizador = setTimeout(vistaPrevia, 150); });
    vistaPrevia();

    q('#ok').onclick = async () => {
      const { out, error } = leer();
      if (error) { q('#err').textContent = error; return; }
      delete out.aviso;
      if (enBanco || q('#al-banco')?.checked) {
        const bid = enBanco ? out.id : (out.bankId || nuevoId());
        const copia = { ...out, id: bid, updatedAt: serverTimestamp() };
        delete copia.bankId; delete copia.background;
        try { await set(ref(db, `bank/${U.uid}/${bid}`), copia); }
        catch (e) { console.error(e); q('#err').textContent = 'No se ha podido guardar en el banco. ¿Has pegado las reglas nuevas de database.rules.json en Firebase?'; return; }
        if (!enBanco) out.bankId = bid;
      }
      dlg.close();
      alGuardar(out);
    };
    if (!dlg.open) dlg.showModal();
  }

  if (item?.type === 'link') return dialogoEnlace(item, alGuardar);
  if (item) formularioTipo(item); else elegirTipo();
  if (!dlg.open) dlg.showModal();
}

async function leerBanco() {
  try { return Object.entries((await get(ref(db, `bank/${U.uid}`))).val() || {}).map(([id, p]) => ({ ...p, id })); }
  catch (e) { console.error(e); return null; }
}
async function temasBanco() {
  const b = await leerBanco() || [];
  return [...new Set(b.map(p => p.tema).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
}

const metaPregunta = p => [nombreTipo(p), p.tema, tieneVariantes(p) ? 'con datos por alumno' : ''].filter(Boolean).join(' · ');

// Elegir una o varias preguntas del banco para la lección
async function elegirDelBanco(alGuardar) {
  dlg.innerHTML = `<form method="dialog" class="dlg dlg-ancho"><h2>Añadir desde el banco</h2><p class="vacio">Cargando…</p></form>`;
  const banco = await leerBanco();
  if (!banco) { dlg.innerHTML = `<form method="dialog" class="dlg"><h2>Banco de preguntas</h2><p class="aviso">No se ha podido abrir el banco. Pega en Firebase las reglas nuevas de <code>database.rules.json</code>.</p><div class="pie"><button class="btn">Cerrar</button></div></form>`; return; }
  const temas = [...new Set(banco.map(p => p.tema).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
  dlg.innerHTML = `<form method="dialog" class="dlg dlg-ancho">
    <h2>Añadir desde el banco</h2>
    ${banco.length ? `<div class="filtros"><input id="buscar" type="search" placeholder="Buscar en el enunciado" aria-label="Buscar">
      <select id="ftema" aria-label="Tema"><option value="">Todos los temas</option>${temas.map(x => `<option>${esc(x)}</option>`).join('')}</select></div>
      <ul class="lista lista-banco" id="lista"></ul>` : `<p class="vacio">Tu banco está vacío. Marca «Guardar también en el banco» al crear una actividad, o crea preguntas desde Banco de preguntas.</p>`}
    <div class="pie"><button class="btn" value="cancel">Cancelar</button><button type="button" class="btn primario" id="ok" disabled>Añadir</button></div></form>`;
  if (!banco.length) return;
  const q = s => dlg.querySelector(s);
  const elegidas = new Set();
  const pintarLista = () => {
    const txt = q('#buscar').value.trim().toLowerCase(), tema = q('#ftema').value;
    const vis = banco.filter(p => (!tema || p.tema === tema) && (!txt || String(p.prompt).toLowerCase().includes(txt)))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    q('#lista').innerHTML = vis.map(p => `<li class="fila"><label class="check fila-elegir"><input type="checkbox" data-id="${p.id}" ${elegidas.has(p.id) ? 'checked' : ''}>
      <span class="fila-info"><span>${rico(conNombres(p.prompt, p))}</span><span class="meta">${esc(metaPregunta(p))}</span></span></label></li>`).join('') || `<li class="vacio">Ninguna pregunta coincide.</li>`;
  };
  q('#buscar').oninput = pintarLista; q('#ftema').onchange = pintarLista;
  q('#lista').onchange = e => {
    const c = e.target.closest('[data-id]'); if (!c) return;
    c.checked ? elegidas.add(c.dataset.id) : elegidas.delete(c.dataset.id);
    q('#ok').disabled = !elegidas.size;
    q('#ok').textContent = elegidas.size ? `Añadir ${elegidas.size} ${elegidas.size === 1 ? 'pregunta' : 'preguntas'}` : 'Añadir';
  };
  q('#ok').onclick = () => {
    // Copias con id nuevo: cada uso en una lección es independiente (y las variantes cambian)
    const nuevas = banco.filter(p => elegidas.has(p.id)).map(p => {
      const c = { ...p, id: nuevoId(), bankId: p.id };
      delete c.updatedAt;
      return c;
    });
    dlg.close();
    alGuardar(...nuevas);
  };
  pintarLista();
}

// ── Enlace: actividad externa (Wordwall, Genially, YouTube…) ─────
function dialogoEnlace(item, alGuardar) {
  const base = item || {};
  dlg.innerHTML = `<form method="dialog" class="dlg">
    <h2>${item ? 'Editar' : 'Nuevo'} enlace</h2>
    <label>Dirección<input id="url" value="${esc(base.url || '')}" placeholder="https://wordwall.net/…" inputmode="url" spellcheck="false"></label>
    <label>Título que verá el alumnado<input id="tit" value="${esc(base.prompt || '')}" placeholder="Actividad en Wordwall" maxlength="200"></label>
    <label class="check"><input type="checkbox" id="dentro" ${base.embed ? 'checked' : ''}> Mostrarlo dentro de la clase</label>
    <span class="ayuda" id="ayuda-dentro"></span>
    <p class="aviso" id="err" role="alert"></p>
    <div class="pie"><button class="btn" value="cancel">Cancelar</button><button type="button" class="btn primario" id="ok">Guardar enlace</button></div></form>`;
  const q = s => dlg.querySelector(s);
  let info = base.url ? infoEnlace(base.url) : null;
  const revisar = (inicial = false) => {
    info = infoEnlace(q('#url').value.trim());
    const puede = !!info?.embed;
    if (!inicial) q('#dentro').checked = puede;
    q('#ayuda-dentro').textContent = !info ? '' : puede
      ? `${info.nombre} se puede ver dentro de la clase. Siempre tendrán también un botón para abrirlo en otra pestaña.`
      : `${info.nombre} no suele dejarse ver dentro de otra web, así que el alumnado tendrá un botón para abrirlo en otra pestaña. Puedes probar a marcarlo igualmente.`;
    if (!q('#tit').value.trim() && info) q('#tit').placeholder = tituloEnlace(info);
  };
  q('#url').oninput = () => revisar();
  if (base.url) revisar(true);
  q('#ok').onclick = () => {
    if (!info) { q('#err').textContent = 'Escribe una dirección web válida.'; return; }
    const out = { id: base.id || nuevoId(), type: 'link', url: info.url, prompt: q('#tit').value.trim() || tituloEnlace(info) };
    if (q('#dentro').checked) out.embed = info.embed || info.url;
    dlg.close();
    alGuardar(out);
  };
  if (!dlg.open) dlg.showModal();
}

const TITULOS_ENLACE = { YouTube: 'Vídeo de YouTube', PhET: 'Simulación de PhET', GeoGebra: 'Actividad de GeoGebra' };
const tituloEnlace = info => TITULOS_ENLACE[info.nombre] || (/\./.test(info.nombre) ? 'Actividad en la web' : `Actividad en ${info.nombre}`);

// Tras subir el PDF: proponer los enlaces encontrados como pasos de la lección
function dialogoEnlacesPDF(encontrados, alAceptar) {
  dlg.innerHTML = `<form method="dialog" class="dlg dlg-ancho">
    <h2>Enlaces encontrados en el PDF</h2>
    <p>Marca los que quieras convertir en un paso de la clase. Se colocan justo después de su diapositiva y luego puedes moverlos o editarlos.</p>
    <ul class="lista lista-banco">${encontrados.map((e, i) => `<li class="fila"><label class="check fila-elegir"><input type="checkbox" data-i="${i}" checked>
      <span class="fila-info"><span class="fila-titulo">${esc(tituloEnlace(e.info))}</span><span class="meta">Diapositiva ${e.page} · ${esc(e.info.url)}${e.info.embed ? ' · se verá dentro de la clase' : ''}</span></span></label></li>`).join('')}</ul>
    <div class="pie"><button class="btn" value="cancel">No añadir ninguno</button><button type="button" class="btn primario" id="ok">Añadir los marcados</button></div></form>`;
  dlg.querySelector('#ok').onclick = () => {
    const sel = [...dlg.querySelectorAll('[data-i]:checked')].map(c => encontrados[+c.dataset.i]);
    dlg.close();
    alAceptar(sel);
  };
  dlg.showModal();
}

// ── Resultados (compartido por control y proyector) ──────────────
function agregados(it, resp) {
  const rs = Object.entries(resp || {});
  if (it.type === 'quiz') return { counts: it.options.map((_, i) => rs.filter(([, r]) => Number(r.value) === i).length) };
  return { total: rs.length, ok: rs.filter(([u, r]) => comprobar(it, r.value, u) === true).length };
}

function resultadosHTML(it, resp, { vista, revelado = false }) {
  const entradas = Object.entries(resp || {}).sort((a, b) => (a[1].at || 0) - (b[1].at || 0));
  const n = entradas.length;
  const cab = `<p class="recuento"><strong>${n}</strong> ${n === 1 ? 'respuesta' : 'respuestas'}</p>`;
  const detalle = vista === 'profesor' || revelado;
  const conNombre = vista === 'profesor';

  if (it.type === 'quiz') {
    const counts = agregados(it, resp).counts;
    return cab + `<ul class="barras">${it.options.map((o, i) => {
      const p = n ? Math.round(counts[i] * 100 / n) : 0;
      const ok = !it.poll && detalle && i === Number(it.correct);
      return `<li class="barra-op ${ok ? 'correcta' : ''}"><span class="op-texto">${rico(o)}${ok ? ' <span class="marca-ok">correcta</span>' : ''}</span>
        ${detalle ? `<span class="op-n">${counts[i]}</span><span class="op-barra"><span style="width:${p}%"></span></span>` : ''}</li>`;
    }).join('')}</ul>`;
  }
  if (!detalle) return cab;
  if (it.type === 'draw') {
    return cab + `<div class="galeria">${entradas.map(([, r]) => `<figure><button type="button" class="ver-dibujo" data-src="${esc(r.value)}"><img src="${esc(r.value)}" alt="Dibujo${conNombre ? ' de ' + esc(r.alias) : ''}" loading="lazy"></button>${conNombre ? `<figcaption>${esc(r.alias)}</figcaption>` : ''}</figure>`).join('')}</div>`;
  }
  const ag = agregados(it, resp);
  const resumen = esCorregible(it)
    ? `<p class="resumen-ok">${ag.ok} de ${n} ${n === 1 ? 'correcta' : 'correctas'}${it.type === 'number' ? `. Solución: ${esc(solucionTexto(it))}` : ''}</p>` : '';
  const variantes = tieneVariantes(it);
  return cab + resumen + `<ul class="respuestas">${entradas.map(([u, r]) => {
    const ok = comprobar(it, r.value, u);
    const sol = variantes && conNombre ? ` <span class="meta">(${esc(datosTexto(it, u))}; solución ${esc(solucionTexto(it, u))})</span>` : '';
    return `<li class="${ok === true ? 'ok' : ok === false ? 'mal' : ''}">${conNombre ? `<span class="quien">${esc(r.alias)}</span>` : ''}<span class="que">${esc(textoRespuesta(it, r.value))}${sol}</span></li>`;
  }).join('')}</ul>`;
}

function verDibujo(src) {
  dlg.innerHTML = `<form method="dialog" class="dlg dlg-ancho"><img class="dibujo-grande" src="${esc(src)}" alt="Dibujo ampliado"><div class="pie"><button class="btn">Cerrar</button></div></form>`;
  dlg.showModal();
}

// Lógica de navegación común a control y proyector
function controlSesion(code, items, alCambiar) {
  let ses = null, resp = {}, itemSub = null, itemId = null;
  const idx = () => ses?.state?.index ?? 0;
  const ir = i => {
    if (!ses || ses.endedAt || i < 0 || i >= items.length) return;
    set(ref(db, `sessions/${code}/state`), estado(items, i));
  };
  const sincronizar = () => {
    const st = ses?.state; if (!st?.reveal) return;
    const it = items[idx()]; if (!esActividad(it)) return;
    const ag = agregados(it, resp);
    if (JSON.stringify(ag) !== JSON.stringify(st.results || null)) set(ref(db, `sessions/${code}/state/results`), ag);
  };
  alSalir(onValue(ref(db, `sessions/${code}`), s => {
    ses = s.val(); if (!ses) return;
    const it = items[idx()];
    const nid = esActividad(it) ? it.id : null;
    if (nid !== itemId) {
      itemId = nid;
      if (itemSub) itemSub();
      itemSub = null; resp = {};
      if (nid) itemSub = onValue(ref(db, `responses/${code}/${nid}`), r => { resp = r.val() || {}; sincronizar(); alCambiar('resp'); });
    }
    alCambiar('sesion');
  }));
  alSalir(() => itemSub && itemSub());
  document.onkeydown = e => {
    if (e.target.closest('input, textarea, select') || dlg.open) return;
    if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); ir(idx() + 1); }
    if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); ir(idx() - 1); }
  };
  return {
    get ses() { return ses; }, get resp() { return resp; }, idx, ir,
    abrir: () => update(ref(db, `sessions/${code}/state`), { open: !ses.state.open }),
    revelar: () => {
      const it = items[idx()];
      if (ses.state.reveal) update(ref(db, `sessions/${code}/state`), { reveal: false, item: itemPublico(it), results: null });
      else update(ref(db, `sessions/${code}/state`), { reveal: true, item: it, results: agregados(it, resp) });
    }
  };
}

// ── Control en directo ───────────────────────────────────────────
async function vistaDirecto(code) {
  app.innerHTML = marco(`<p class="vacio">Cargando clase…</p>`);
  const priv = (await get(ref(db, `teacherSessions/${U.uid}/${code}`))).val();
  if (!priv) { app.innerHTML = marco(`<p class="vacio">No encuentro esa clase. <a href="#/">Volver</a></p>`); return; }
  const items = priv.items || [];
  const diapos = (await get(ref(db, `slides/${U.uid}/${priv.lessonId}`))).val() || {};
  const enlace = enlaceAlumno(code);
  let roster = {};

  app.innerHTML = marco(`
  <section class="directo">
    <div class="cab-directo">
      <div class="cab-titulo"><h1>${esc(priv.lessonTitle)}</h1>
        <p class="meta">El alumnado entra en <a href="${enlace}" target="_blank" rel="noopener">${esc(enlaceCorto(enlace))}</a> con el código</p></div>
      <div class="codigo-grande" aria-label="Código de la clase">${code}</div>
      <div class="acciones">
        <button class="btn" id="vercodigo">Código en el proyector</button>
        <button class="btn" id="invitados" aria-pressed="false">Permitir entrar sin cuenta</button>
        <a class="btn" href="#/proyectar/${code}" target="_blank" rel="noopener">Abrir vista para proyectar</a>
        <a class="btn" href="#/informe/${code}">Informe</a>
        <button class="btn peligro" id="finalizar">Finalizar clase</button>
      </div>
    </div>
    <div class="directo-cuerpo">
      <div class="principal">
        <div class="vista-actual" id="actual"></div>
        <div class="controles" id="controles"></div>
      </div>
      <aside class="alumnado"><h2 id="cont-alumnos">Alumnado</h2><ul id="roster" class="roster"></ul></aside>
    </div>
    <ol class="tira" id="tira" aria-label="Recorrido de la lección"></ol>
  </section>`);

  const C = controlSesion(code, items, motivo => {
    if (motivo === 'sesion') { pintarControles(); pintarTira(); }
    pintarActual(); pintarRoster();
  });

  function pintarActual() {
    const el = $('#actual'); if (!el || !C.ses) return;
    const it = items[C.idx()]; if (!it) return;
    if (it.type === 'slide') {
      if (el.dataset.k === it.id) return;
      el.dataset.k = it.id;
      el.innerHTML = diapos[it.page] ? `<img class="diapo" src="${diapos[it.page]}" alt="Diapositiva ${it.page}">` : `<p class="vacio">La diapositiva ${it.page} no tiene imagen.</p>`;
      return;
    }
    if (it.type === 'link') {
      if (el.dataset.k === it.id) return;
      el.dataset.k = it.id;
      el.innerHTML = `<div class="act-prof"><p class="tipo">Enlace${it.embed ? ' <span class="etiqueta">se ve dentro de la clase</span>' : ''}</p>
        <h2 class="enunciado">${rico(it.prompt)}</h2><p><a class="btn" href="${esc(it.url)}" target="_blank" rel="noopener">Abrir ${esc(infoEnlace(it.url)?.nombre || 'enlace')}</a></p>
        <p class="meta">Si lo abren en otra pestaña, cuenta como salida de la pestaña en el informe.</p></div>`;
      return;
    }
    el.dataset.k = '';
    const st = C.ses.state || {};
    el.innerHTML = `<div class="act-prof">
      <p class="tipo">${nombreTipo(it)}${st.open ? ' <span class="etiqueta abierta">abierta</span>' : ' <span class="etiqueta">cerrada</span>'}${st.reveal ? ' <span class="etiqueta">resultados visibles</span>' : ''}</p>
      <h2 class="enunciado">${rico(conNombres(it.prompt, it))}</h2>${resultadosHTML(it, C.resp, { vista: 'profesor' })}</div>`;
  }

  function pintarControles() {
    const el = $('#controles'); if (!el || !C.ses) return;
    const i = C.idx(), it = items[i], st = C.ses.state || {}, fin = !!C.ses.endedAt;
    el.innerHTML = `
      <button class="btn" data-ir="${i - 1}" ${i === 0 || fin ? 'disabled' : ''}>Anterior</button>
      <span class="posicion">${i + 1} de ${items.length}</span>
      <button class="btn primario" data-ir="${i + 1}" ${i >= items.length - 1 || fin ? 'disabled' : ''}>Siguiente</button>
      ${esActividad(it) && !fin ? `<span class="sep" aria-hidden="true"></span>
        <button class="btn" id="abrir">${st.open ? 'Cerrar respuestas' : 'Abrir respuestas'}</button>
        <button class="btn" id="revelar">${st.reveal ? 'Ocultar resultados' : 'Mostrar resultados a la clase'}</button>` : ''}
      ${fin ? '<span class="etiqueta">Clase finalizada</span>' : ''}`;
    $('#vercodigo').textContent = C.ses.showCode ? 'Ocultar código en el proyector' : 'Mostrar código en el proyector';
    const inv = $('#invitados');
    inv.textContent = C.ses.guests ? 'Entrar sin cuenta: permitido' : 'Permitir entrar sin cuenta';
    inv.classList.toggle('activo-invitados', !!C.ses.guests);
    inv.setAttribute('aria-pressed', String(!!C.ses.guests));
    inv.disabled = fin;
  }

  function pintarRoster() {
    const ul = $('#roster'); if (!ul) return;
    const it = items[C.idx()], act = esActividad(it);
    const lista = Object.entries(roster).sort((a, b) => String(a[1].alias).localeCompare(String(b[1].alias), 'es'));
    const on = lista.filter(([, r]) => r.online).length;
    const nr = act ? Object.keys(C.resp).length : 0;
    $('#cont-alumnos').textContent = act ? `${on} ${on === 1 ? 'conectado' : 'conectados'}, ${nr} ${nr === 1 ? 'ha respondido' : 'han respondido'}` : `${on} ${on === 1 ? 'conectado' : 'conectados'}`;
    ul.innerHTML = lista.length ? lista.map(([u, r]) => {
      const est = !r.online ? 'fuera' : (r.away ? 'distraido' : 'dentro');
      const txt = { fuera: 'Desconectado', distraido: 'Ha salido de la pestaña', dentro: 'Conectado' }[est];
      return `<li class="alumno ${est}"><span class="punto" title="${txt}"></span><span class="sr">${txt}: </span>
        <span class="alias" title="${esc(r.email || 'Sin cuenta')}">${esc(r.alias)}</span>${r.email ? '' : '<span class="sin-cuenta-tag">sin cuenta</span>'}
        ${act && C.resp[u] ? '<span class="respondido">Respondido</span>' : ''}
        ${r.awayCount ? `<span class="salidas" title="Veces que ha salido de la pestaña">${r.awayCount}</span>` : ''}</li>`;
    }).join('') : `<li class="vacio">Nadie ha entrado todavía. Proyecta el código para que se unan.</li>`;
  }

  function pintarTira() {
    const el = $('#tira'); if (!el) return;
    const i = C.idx();
    if (!el.dataset.hecha) {
      el.dataset.hecha = '1';
      el.innerHTML = items.map((it, k) => `<li><button type="button" data-ir="${k}" aria-label="Ir al paso ${k + 1}">
        ${it.type === 'slide' ? (diapos[it.page] ? `<img src="${diapos[it.page]}" alt="">` : '') : `<span class="tira-act">${nombreTipo(it)}</span>`}
        <span class="tira-n">${k + 1}</span></button></li>`).join('');
    }
    [...el.children].forEach((li, k) => li.classList.toggle('actual', k === i));
    el.children[i]?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: sinMovimiento ? 'auto' : 'smooth' });
  }

  alSalir(onValue(ref(db, `roster/${code}`), s => { roster = s.val() || {}; pintarRoster(); }));

  app.querySelector('.directo').onclick = async e => {
    const irB = e.target.closest('[data-ir]'); if (irB) return C.ir(Number(irB.dataset.ir));
    if (e.target.closest('#abrir')) return C.abrir();
    if (e.target.closest('#revelar')) return C.revelar();
    const vd = e.target.closest('.ver-dibujo'); if (vd) return verDibujo(vd.dataset.src);
    if (e.target.closest('#vercodigo')) return update(ref(db, `sessions/${code}`), { showCode: !C.ses.showCode });
    if (e.target.closest('#invitados')) return permitirInvitados(code, priv.lessonId, !C.ses.guests);
    if (e.target.closest('#finalizar')) {
      if (!confirm('¿Finalizar la clase? El alumnado verá que ha terminado y ya no podrá responder.')) return;
      await update(ref(db, `sessions/${code}`), { endedAt: serverTimestamp(), 'state/open': false });
      if (C.ses.guests) await permitirInvitados(code, priv.lessonId, false);
      await update(ref(db, `teacherSessions/${U.uid}/${code}`), { endedAt: serverTimestamp() });
      location.hash = `#/informe/${code}`;
    }
  };
}

// Entrar sin cuenta: lo activa la docente en cada clase. guestLessons deja leer las diapositivas
// de esa lección a quien entra sin cuenta mientras dure la clase.
async function permitirInvitados(code, lessonId, si) {
  if (si && !confirm('Quien tenga el código podrá entrar escribiendo solo su nombre, sin cuenta del colegio. No se comprueba quién es. ¿Permitirlo en esta clase?')) return;
  try {
    if (si) await set(ref(db, `guestLessons/${U.uid}/${lessonId}`), true);
    await update(ref(db, `sessions/${code}`), { guests: si });
    if (!si) await remove(ref(db, `guestLessons/${U.uid}/${lessonId}`));
  } catch (e) {
    console.error(e);
    alert('No se ha podido cambiar. Comprueba que has publicado en Firebase las reglas nuevas de database.rules.json.');
  }
}

// ── Vista para proyectar ─────────────────────────────────────────
async function vistaProyector(code) {
  document.body.classList.add('modo-proyector');
  app.innerHTML = `<p class="vacio">Cargando…</p>`;
  const priv = (await get(ref(db, `teacherSessions/${U.uid}/${code}`))).val();
  if (!priv) { app.innerHTML = `<p class="vacio">No encuentro esa clase.</p>`; return; }
  const items = priv.items || [];
  const diapos = (await get(ref(db, `slides/${U.uid}/${priv.lessonId}`))).val() || {};
  const enlace = enlaceAlumno(code);

  app.innerHTML = `<div class="proyector">
    <div class="proy-escena" id="escena"></div>
    <div class="proy-banda" id="banda" hidden>
      <div class="proy-qr" id="qr" aria-hidden="true"></div>
      <div class="proy-texto">Entra en <strong>${esc(enlaceCorto(enlace))}</strong><br>con el código</div>
      <div class="proy-codigo">${code}</div>
    </div>
    <button class="proy-pc btn peq" id="pc">Pantalla completa</button>
  </div>`;
  if (window.QRCode) new window.QRCode($('#qr'), { text: String(enlace), width: 132, height: 132, colorDark: '#1E293B', colorLight: '#ffffff' });
  $('#pc').onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
  app.querySelector('.proyector').onclick = e => { const vd = e.target.closest('.ver-dibujo'); if (vd) verDibujo(vd.dataset.src); };

  const C = controlSesion(code, items, () => pintar());
  function pintar() {
    const ses = C.ses; if (!ses) return;
    $('#banda').hidden = !ses.showCode || !!ses.endedAt;
    const el = $('#escena');
    if (ses.endedAt) { el.dataset.k = 'fin'; el.innerHTML = `<p class="proy-fin">Clase finalizada</p>`; return; }
    const it = items[C.idx()]; if (!it) return;
    if (it.type === 'slide') {
      if (el.dataset.k === it.id) return;
      el.dataset.k = it.id;
      el.innerHTML = diapos[it.page] ? `<img src="${diapos[it.page]}" alt="Diapositiva ${it.page}">` : '';
      return;
    }
    if (it.type === 'link') {
      if (el.dataset.k === it.id) return;
      el.dataset.k = it.id;
      el.innerHTML = it.embed ? `<iframe class="proy-marco" src="${esc(it.embed)}" title="${esc(it.prompt)}" allow="fullscreen; autoplay; clipboard-write"></iframe>`
        : `<div class="proy-act"><h2>${rico(it.prompt)}</h2><p class="proy-url">Ábrelo en tu dispositivo: ya tienes el botón en la pantalla.</p></div>`;
      return;
    }
    el.dataset.k = '';
    el.innerHTML = `<div class="proy-act"><h2>${rico(conNombres(it.prompt, it))}</h2>${resultadosHTML(it, C.resp, { vista: 'proyector', revelado: !!ses.state?.reveal })}</div>`;
  }
}

// ── Informe ──────────────────────────────────────────────────────
async function vistaInforme(code) {
  app.innerHTML = marco(`<p class="vacio">Cargando informe…</p>`);
  const [pS, rS, qS] = await Promise.all([
    get(ref(db, `teacherSessions/${U.uid}/${code}`)), get(ref(db, `roster/${code}`)), get(ref(db, `responses/${code}`))
  ]);
  const priv = pS.val();
  if (!priv) { app.innerHTML = marco(`<p class="vacio">No encuentro esa clase. <a href="#/">Volver</a></p>`); return; }
  const roster = rS.val() || {}, resp = qS.val() || {};
  const acts = (priv.items || []).filter(esActividad);
  const nCorr = acts.filter(esCorregible).length;

  const filas = Object.entries(roster)
    .sort((a, b) => String(a[1].alias).localeCompare(String(b[1].alias), 'es'))
    .map(([u, r]) => {
      let ok = 0;
      const celdas = acts.map(it => {
        const x = resp[it.id]?.[u];
        if (!x) return null;
        const c = comprobar(it, x.value, u);
        if (c === true) ok++;
        return { c, t: textoRespuesta(it, x.value), dibujo: it.type === 'draw' ? x.value : null, datos: tieneVariantes(it) ? `${datosTexto(it, u)}; solución ${solucionTexto(it, u)}` : '' };
      });
      return { r, celdas, ok };
    });
  const participacion = acts.map(it => Object.keys(resp[it.id] || {}).length);

  app.innerHTML = marco(`
  <section class="informe">
    <div class="cab-bloque">
      <div><h1>${esc(priv.lessonTitle)}</h1><p class="meta">${fecha(priv.createdAt)}, código ${code}, ${filas.length} ${filas.length === 1 ? 'alumno' : 'alumnos'}${priv.endedAt ? '' : ', <strong class="en-curso">en curso</strong>'}</p></div>
      <div class="acciones">
        ${priv.endedAt ? '' : `<a class="btn primario" href="#/directo/${code}">Volver al directo</a>`}
        <button class="btn" id="csv">Descargar CSV</button>
        <button class="btn" id="imprimir">Imprimir</button>
        <button class="btn peligro" id="borrar">Eliminar datos de esta clase</button>
      </div>
    </div>
    ${acts.length ? `<ol class="leyenda">${acts.map((it, k) => `<li><strong>A${k + 1}</strong> ${nombreTipo(it)}: ${rico(conNombres(it.prompt, it))}</li>`).join('')}</ol>` : ''}
    <div class="tabla-scroll"><table class="tabla">
      <thead><tr><th scope="col">Alumno</th><th scope="col">Correo</th><th scope="col">Entrada</th><th scope="col" title="Veces que salió de la pestaña durante la clase">Salidas</th>
        ${acts.map((it, k) => `<th scope="col" title="${esc(it.prompt)}">A${k + 1}</th>`).join('')}
        ${nCorr ? '<th scope="col">Aciertos</th>' : ''}</tr></thead>
      <tbody>${filas.map(f => `<tr>
        <th scope="row">${esc(f.r.alias)}</th><td>${f.r.email ? esc(f.r.email) : '<span class="sin">Sin cuenta</span>'}</td><td>${fecha(f.r.joinedAt)}</td><td class="num">${f.r.awayCount || 0}</td>
        ${f.celdas.map(c => !c ? '<td class="sin">Sin respuesta</td>'
          : c.dibujo ? `<td><button class="btn peq ver-dibujo" data-src="${esc(c.dibujo)}">Ver dibujo</button></td>`
          : `<td class="${c.c === true ? 'ok' : c.c === false ? 'mal' : ''}"${c.datos ? ` title="${esc(c.datos)}"` : ''}>${esc(c.t)}</td>`).join('')}
        ${nCorr ? `<td class="num"><strong>${f.ok}</strong> de ${nCorr}</td>` : ''}</tr>`).join('')
        || `<tr><td colspan="${5 + acts.length}" class="vacio">Nadie entró en esta clase.</td></tr>`}</tbody>
      ${filas.length && acts.length ? `<tfoot><tr><th scope="row">Han respondido</th><td></td><td></td><td></td>${participacion.map(n => `<td class="num">${n} de ${filas.length}</td>`).join('')}${nCorr ? '<td></td>' : ''}</tr></tfoot>` : ''}
    </table></div>
  </section>`);

  const sec = app.querySelector('.informe');
  sec.onclick = async e => {
    const vd = e.target.closest('.ver-dibujo'); if (vd) return verDibujo(vd.dataset.src);
    if (e.target.closest('#imprimir')) return window.print();
    if (e.target.closest('#csv')) return descargarCSV();
    if (e.target.closest('#borrar')) {
      if (!confirm('Se borrarán para siempre las respuestas, el registro de conexión y el informe de esta clase. La lección no se toca. ¿Continuar?')) return;
      await remove(ref(db, `roster/${code}`));
      await remove(ref(db, `responses/${code}`));
      await remove(ref(db, `sessions/${code}`));
      await remove(ref(db, `teacherSessions/${U.uid}/${code}`));
      location.hash = '#/';
    }
  };

  function descargarCSV() {
    // Evita que un alias como "=..." se interprete como fórmula en Excel
    const celda = v => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
    const cab = ['Alumno', 'Correo', 'Entrada', 'Salidas de la pestaña', ...acts.map((it, k) => `A${k + 1} ${nombreTipo(it)}: ${it.prompt}`), ...(nCorr ? [`Aciertos (de ${nCorr})`] : [])];
    const lineas = filas.map(f => [
      f.r.alias, f.r.email || 'Sin cuenta', fecha(f.r.joinedAt), f.r.awayCount || 0,
      ...f.celdas.map(c => !c ? '' : (c.c === true ? `${c.t} (bien)` : c.c === false ? `${c.t} (mal)` : c.t) + (c.datos ? ` [${c.datos}]` : '')),
      ...(nCorr ? [f.ok] : [])
    ]);
    const csv = '\ufeff' + [cab, ...lineas].map(l => l.map(celda).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `informe-${code}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
}

// ── Banco de preguntas ───────────────────────────────────────────
async function vistaBanco() {
  app.innerHTML = marco(`
  <section class="bloque">
    <div class="cab-bloque">
      <div><h1>Banco de preguntas</h1><p class="meta">Guarda aquí las preguntas que quieras reutilizar. Al añadirlas a una lección se copian, así que puedes retocarlas allí sin cambiar el banco.</p></div>
      <div class="acciones">
        <label class="btn">Importar<input type="file" id="importar" accept="application/json,.json" hidden></label>
        <button class="btn" id="exportar">Exportar</button>
        <button class="btn primario" id="nueva">Nueva pregunta</button>
      </div>
    </div>
    <div class="filtros"><input id="buscar" type="search" placeholder="Buscar en el enunciado" aria-label="Buscar">
      <select id="ftema" aria-label="Tema"><option value="">Todos los temas</option></select></div>
    <p class="aviso" id="err" role="alert"></p>
    <ul class="lista lista-banco" id="lista"><li class="vacio">Cargando…</li></ul>
  </section>`);

  let banco = [];
  const bRef = ref(db, `bank/${U.uid}`);
  const pintarLista = () => {
    const ul = $('#lista'); if (!ul) return;
    const sel = $('#ftema'), tema = sel.value;
    const temas = [...new Set(banco.map(p => p.tema).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
    sel.innerHTML = `<option value="">Todos los temas</option>${temas.map(x => `<option ${x === tema ? 'selected' : ''}>${esc(x)}</option>`).join('')}`;
    const txt = $('#buscar').value.trim().toLowerCase();
    const vis = banco.filter(p => (!tema || p.tema === tema) && (!txt || String(p.prompt).toLowerCase().includes(txt)))
      .sort((a, b) => String(a.tema || '').localeCompare(String(b.tema || ''), 'es', { numeric: true }) || (b.updatedAt || 0) - (a.updatedAt || 0));
    ul.innerHTML = vis.map(p => `<li class="fila">
      <div class="fila-info"><span class="fila-titulo">${rico(conNombres(p.prompt, p))}</span><span class="meta">${esc(metaPregunta(p))}</span></div>
      <div class="fila-acc"><button class="btn peq" data-edit="${p.id}">Editar</button><button class="btn peq" data-dup="${p.id}">Duplicar</button><button class="btn peq peligro" data-del="${p.id}">Eliminar</button></div></li>`).join('')
      || `<li class="vacio">${banco.length ? 'Ninguna pregunta coincide.' : 'Aún no tienes preguntas. Crea una aquí o marca «Guardar también en el banco» al crear una actividad en una lección.'}</li>`;
  };
  alSalir(onValue(bRef, s => { banco = Object.entries(s.val() || {}).map(([id, p]) => ({ ...p, id })); pintarLista(); },
    e => { console.error(e); $('#err').textContent = 'No se puede leer el banco. Pega en Firebase las reglas nuevas de database.rules.json.'; }));
  $('#buscar').oninput = pintarLista;
  $('#ftema').onchange = pintarLista;
  $('#nueva').onclick = () => dialogoActividad(null, [], () => {}, { banco: true });

  app.querySelector('.bloque').onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    const p = banco.find(x => x.id === (b.dataset.edit || b.dataset.dup || b.dataset.del));
    if (b.dataset.edit && p) dialogoActividad(p, [], () => {}, { banco: true });
    if (b.dataset.dup && p) { const id = nuevoId(); await set(ref(db, `bank/${U.uid}/${id}`), { ...p, id, prompt: p.prompt, updatedAt: serverTimestamp() }); }
    if (b.dataset.del && p && confirm('¿Eliminar esta pregunta del banco? Las lecciones donde ya la usaste no cambian.')) await remove(ref(db, `bank/${U.uid}/${p.id}`));
  };

  $('#exportar').onclick = () => {
    const datos = banco.map(p => { const c = { ...p }; delete c.updatedAt; return c; });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ app: 'clase-en-directo', version: 1, preguntas: datos }, null, 2)], { type: 'application/json' }));
    a.download = `banco-preguntas-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  $('#importar').onchange = async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      const lista = (Array.isArray(j) ? j : j.preguntas || []).filter(p => p && TIPOS[p.type] && p.type !== 'slide' && p.prompt);
      if (!lista.length) { $('#err').textContent = 'El archivo no tiene preguntas válidas.'; return; }
      if (!confirm(`Se añadirán ${lista.length} ${lista.length === 1 ? 'pregunta' : 'preguntas'} al banco. ¿Continuar?`)) return;
      const cambios = {};
      for (const p of lista) { const id = nuevoId(); cambios[id] = { ...p, id, updatedAt: serverTimestamp() }; }
      await update(bRef, cambios);
      $('#err').textContent = '';
    } catch (err) { console.error(err); $('#err').textContent = 'No se ha podido leer el archivo. Debe ser un JSON exportado desde aquí.'; }
  };
}
