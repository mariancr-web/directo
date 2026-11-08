import { auth, db, configurado, enApp } from './firebase.js';
import { NOMBRE_APP } from './config.js';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { ref, get, set, update, remove, onValue, serverTimestamp, query, orderByChild, limitToLast } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import { esc, rico, conDatos, conNombres, TIPOS, nombreTipo, esActividad, esCorregible, itemPublico, comprobar, textoRespuesta, solucionTexto, generarCodigo, nuevoId, parseNum, fecha, evaluar, postsMuro, MAX_MURO, POR_PARTES, pintarPartes, solucionesHuecos, filasTabla, tieneVariantes, valores, datosTexto, fmtNum, infoEnlace, buscarEnlaces, CURSOS, CLASES, cursoDe, nombreClase, colorCurso, reducirImagen, alternativas, generarSopa, normSopa, pintarSopa } from './lib.js';
import { crearEditor, tarjetasTipos, ICONOS } from './editor.js';

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
  colorCurso('');
  if (dlg.open) dlg.close();
}

function marco(html) {
  return `<header class="mcr-barra">
    <a class="mcr-barra__marca" href="#/"><img src="logo-negativo.svg" alt="mariancr"><span class="mcr-barra__nombre">${esc(NOMBRE_APP)}</span></a>
    <div class="mcr-barra__usuario"><span>${esc(U?.displayName || U?.email || '')}</span><button class="mcr-btn mcr-btn--peq" id="salir">Salir</button></div>
  </header><main class="contenido">${html}</main>
  <footer class="mcr-pie-app">mariancr · ${esc(NOMBRE_APP)}</footer>`;
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
  app.innerHTML = `<div class="mcr-acceso"><section class="acceso mcr-acceso__tarjeta">
    <img class="logo-claro" src="logo.svg" alt="mariancr">
    <h1>${esc(NOMBRE_APP)}</h1>
    <p>Prepara tus lecciones y dirige la clase desde aquí. El alumnado entra con su cuenta del colegio y el código de la clase.</p>
    <button class="mcr-btn mcr-btn--prim mcr-btn--ancho" id="google">Entrar con Google</button>
    <p class="aviso" id="err" role="alert"></p></section></div>`;
  $('#google').onclick = async () => {
    try { if (enApp) await signInWithRedirect(auth, new GoogleAuthProvider()); else await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch (e) { $('#err').textContent = `No se ha podido iniciar sesión (${e.code || e.message}). Si usas GitHub Pages, revisa que su dominio esté en los dominios autorizados de Firebase.`; }
  };
}

function pantallaSinPermiso(user) {
  reset();
  app.innerHTML = `<div class="mcr-acceso"><section class="acceso mcr-acceso__tarjeta">
    <h1>Falta un paso</h1>
    <p>Has entrado como ${esc(user.email)}, pero esta cuenta aún no está autorizada como docente.</p>
    <p>En la consola de Firebase, abre Realtime Database, crea dentro de <code>teachers</code> una clave con este identificador y ponle el valor <code>true</code>:</p>
    <p class="uid"><code>${esc(user.uid)}</code> <button class="btn peq" id="copiar">Copiar</button></p>
    <p>Después, recarga esta página.</p>
    <button class="btn" id="salir">Usar otra cuenta</button></section></div>`;
  $('#copiar').onclick = () => navigator.clipboard?.writeText(user.uid).then(() => { $('#copiar').textContent = 'Copiado'; });
}

app.addEventListener('click', e => { if (e.target.closest('#salir')) signOut(auth); });

if (!configurado) {
  app.innerHTML = `<div class="mcr-acceso"><section class="acceso mcr-acceso__tarjeta"><h1>Falta conectar Firebase</h1><p>Abre <code>config.js</code> y pega la configuración de tu proyecto de Firebase. En el archivo <code>LEEME.md</code> tienes los pasos.</p></section></div>`;
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

// ── Inicio: lecciones y clases, separadas por curso y grupo ─────
const leerFiltro = () => { try { return localStorage.getItem('cd-clase') || 'todas'; } catch { return 'todas'; } };
const guardarFiltro = v => { try { localStorage.setItem('cd-clase', v); } catch {} };
const chipClase = (curso, grupo) => curso && cursoDe(curso) ? `<span class="chip-clase curso-${curso}">${esc(nombreClase(curso, grupo))}</span>` : '';

function vistaInicio() {
  let filtro = leerFiltro();
  if (filtro !== 'todas' && filtro !== 'sin' && !CLASES.some(c => c.id === filtro)) filtro = 'todas';
  let lecciones = [], sesiones = [], cuantas = 40, cargadas = false;
  app.innerHTML = marco(`
  <div class="hero hero-inicio mcr-hero">
    <nav class="mcr-filtros" id="pestanas" aria-label="Clases"></nav>
    <div class="cab-bloque"><h1 id="tit-lecciones">Tus lecciones</h1><div class="acciones"><a class="mcr-btn mcr-btn--sec" href="#/banco">Banco de preguntas</a><button class="mcr-btn mcr-btn--prim" id="nueva">Nueva lección</button></div></div>
  </div>
  <section class="bloque">
    <h2 class="mcr-seccion" id="tit-lec2">Lecciones</h2>
    <div id="lecciones"><p class="vacio">Cargando…</p></div>
  </section>
  <section class="bloque">
    <h2 class="mcr-seccion" id="tit-sesiones">Clases dadas</h2>
    <div id="sesiones"><p class="vacio">Cargando…</p></div>
    <button class="mcr-btn" id="mas" hidden>Ver clases más antiguas</button>
  </section>`);

  const clase = () => CLASES.find(c => c.id === filtro) || null;
  const cursoLeccion = id => lecciones.find(([k]) => k === id)?.[1].curso || '';
  // Las clases antiguas no guardaban el curso: se toma el de su lección
  const cursoSesion = s => s.curso ?? cursoLeccion(s.lessonId);
  const pasa = (curso, grupo, esSesion) => {
    if (filtro === 'todas') return true;
    if (filtro === 'sin') return !cursoDe(curso);
    const c = clase();
    return curso === c.curso && (!esSesion || (grupo || '') === c.grupo);
  };

  function pintarPestanas() {
    const haySin = lecciones.some(([, l]) => !cursoDe(l.curso));
    const ps = [['todas', 'Todas', 'general'], ...CLASES.map(c => [c.id, c.nombre, c.curso]), ...(haySin ? [['sin', 'Sin curso', 'sin']] : [])];
    $('#pestanas').innerHTML = ps.map(([id, n, curso]) => `<button type="button" class="mcr-filtro curso-${curso}" data-filtro="${id}" aria-pressed="${filtro === id}">${esc(n)}</button>`).join('');
    const c = clase();
    $('#tit-lecciones').textContent = c ? c.nombre : filtro === 'sin' ? 'Sin curso' : 'Tus lecciones';
    $('#tit-lec2').textContent = c ? `Lecciones de ${cursoDe(c.curso).nombre} · ${c.materia}` : 'Lecciones';
    $('#tit-sesiones').textContent = c ? `Clases dadas en ${c.nombre}` : 'Clases dadas';
    colorCurso(c?.curso || '');
  }

  const tarjetaLeccion = ([id, l]) => {
    const its = l.items || [];
    const nd = its.filter(i => i.type === 'slide').length, na = its.length - nd;
    return `<li class="mcr-tarjeta ${cursoDe(l.curso) ? 'curso-' + l.curso : ''}">
      <div class="fila-info"><a class="mcr-tarjeta__titulo" href="#/leccion/${id}">${esc(l.title)}</a>
        <span class="mcr-tarjeta__meta">${nd} ${nd === 1 ? 'diapositiva' : 'diapositivas'} y ${na} ${na === 1 ? 'actividad' : 'actividades'}</span></div>
      <div class="mcr-tarjeta__acc">
        <a class="mcr-btn mcr-btn--peq" href="#/leccion/${id}">Editar</a>
        <button class="mcr-btn mcr-btn--peq mcr-btn--prim" data-empezar="${id}" ${its.length ? '' : 'disabled'}>Empezar clase${clase()?.grupo ? ' con ' + esc(clase().nombre) : ''}</button>
        <button class="mcr-btn mcr-btn--peq mcr-btn--peligro" data-borrar="${id}">Eliminar</button>
      </div></li>`;
  };
  const vacia = (msg, boton = true) => `<div class="mcr-vacio"><span>${msg}</span>${boton ? `<button class="mcr-btn mcr-btn--prim" data-nueva>${lecciones.length ? 'Crear una lección' : 'Crear la primera lección'}</button>` : ''}</div>`;
  const ordenar = ls => ls.sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));


  function pintarLecciones() {
    const el = $('#lecciones'); if (!el) return;
    if (!lecciones.length) { el.innerHTML = vacia('Aún no tienes lecciones. Crea una y sube tu presentación en PDF.'); return; }
    if (filtro !== 'todas') {
      const ls = ordenar(lecciones.filter(([, l]) => pasa(l.curso)));
      el.innerHTML = ls.length ? `<ul class="mcr-lista">${ls.map(tarjetaLeccion).join('')}</ul>` : vacia('No hay lecciones en esta clase todavía.');
      return;
    }
    const grupos = [...CURSOS.map(c => ({ id: c.id, nombre: c.nombre, materia: c.materia, ls: lecciones.filter(([, l]) => l.curso === c.id) })),
      { id: 'sin', nombre: 'Sin curso', materia: 'Elige el curso dentro de cada lección', ls: lecciones.filter(([, l]) => !cursoDe(l.curso)) }].filter(g => g.ls.length);
    el.innerHTML = grupos.map((g, i) => grupoCurso('lec-' + g.id, g.id, g.nombre, g.materia, `${g.ls.length} ${g.ls.length === 1 ? 'lección' : 'lecciones'}`, ordenar(g.ls).map(tarjetaLeccion).join(''), i === 0)).join('');
  }

  // Subtítulo con el color del curso y su lista debajo
  // Desplegable: se recuerda cuáles dejas abiertos (por defecto, el primero de cada bloque)
  const leerAbiertos = () => { try { return JSON.parse(localStorage.getItem('cd-desplegados')) || null; } catch { return null; } };
  const grupoCurso = (clave, curso, nombre, materia, cuenta, lis, primero) => {
    const ab = leerAbiertos();
    const abierto = ab ? ab.includes(clave) : primero;
    return `<details class="grupo-curso curso-${curso}" data-clave="${esc(clave)}" ${abierto ? 'open' : ''}>
      <summary class="sub-curso"><span class="sub-curso__chip">${esc(nombre)}</span><span class="sub-curso__materia">${esc(materia)}</span><span class="sub-curso__n">${esc(cuenta)}</span></summary>
      <ul class="mcr-lista">${lis}</ul></details>`;
  };
  app.addEventListener('toggle', e => {
    const d = e.target; if (!d.matches?.('details.grupo-curso')) return;
    let ab = leerAbiertos() || [...app.querySelectorAll('details.grupo-curso[open]')].map(x => x.dataset.clave);
    ab = ab.filter(k => k !== d.dataset.clave); if (d.open) ab.push(d.dataset.clave);
    try { localStorage.setItem('cd-desplegados', JSON.stringify(ab)); } catch {}
  }, true);

  function pintarSesiones() {
    const ul = $('#sesiones'); if (!ul) return;
    const ss = sesiones.filter(([, s]) => pasa(cursoSesion(s), s.grupo, true));
    const tarjeta = ([code, s]) => {
      return `<li class="mcr-tarjeta ${s.endedAt ? '' : 'en-curso'}">
      <div class="fila-info"><span class="mcr-tarjeta__titulo">${esc(s.lessonTitle)}</span>
        <span class="mcr-tarjeta__meta">${fecha(s.createdAt)}, código ${code}</span></div>
      <div class="mcr-tarjeta__acc">
        ${s.endedAt ? '' : `<span class="mcr-vivo">En curso</span><a class="mcr-btn mcr-btn--peq mcr-btn--prim" href="#/directo/${code}">Volver al directo</a>`}
        <a class="mcr-btn mcr-btn--peq" href="#/informe/${code}">Informe</a>
      </div></li>`;
    };
    if (!ss.length) ul.innerHTML = `<div class="mcr-vacio"><span>${sesiones.length ? 'Aún no has dado clase con este grupo.' : 'Cuando des tu primera clase, aparecerá aquí con su informe.'}</span></div>`;
    else if (filtro !== 'todas') ul.innerHTML = `<ul class="mcr-lista">${ss.map(tarjeta).join('')}</ul>`;
    else {
      // En «Todas»: un subtítulo por clase (curso y grupo), en el orden de las pestañas
      const claseDe = s => { const cs = cursoSesion(s); return cursoDe(cs) ? CLASES.find(c => c.curso === cs && c.grupo === (s.grupo || '')) || CLASES.find(c => c.curso === cs) : null; };
      const orden = [...CLASES, null];
      let k = 0;
      ul.innerHTML = orden.map(c => {
        const de = ss.filter(([, s]) => claseDe(s) === c); if (!de.length) return '';
        const vivas = de.filter(([, s]) => !s.endedAt).length;
        const n = `${de.length} ${de.length === 1 ? 'clase' : 'clases'}${vivas ? ` · ${vivas} en curso` : ''}`;
        const primero = k++ === 0;
        return c ? grupoCurso('ses-' + c.id, c.curso, c.nombre, c.materia, n, de.map(tarjeta).join(''), primero) : grupoCurso('ses-sin', 'sin', 'Sin curso', '', n, de.map(tarjeta).join(''), primero);
      }).join('');
    }
    $('#mas').hidden = sesiones.length < cuantas;
  }
  const pintarTodo = () => { pintarPestanas(); pintarLecciones(); pintarSesiones(); };

  alSalir(onValue(ref(db, `lessons/${U.uid}`), snap => { lecciones = Object.entries(snap.val() || {}); pintarTodo(); }));
  let quitarSes = null;
  const escucharSesiones = () => {
    quitarSes?.();
    quitarSes = onValue(query(ref(db, `teacherSessions/${U.uid}`), orderByChild('createdAt'), limitToLast(cuantas)), snap => {
      sesiones = []; snap.forEach(c => { const v = c.val(); delete v.items; sesiones.push([c.key, v]); });
      sesiones.reverse();
      if (!cargadas) { cargadas = true; pintarLecciones(); }
      pintarSesiones();
    });
  };
  escucharSesiones();
  alSalir(() => quitarSes?.());
  $('#mas').onclick = () => { cuantas += 60; escucharSesiones(); };

  $('#pestanas').onclick = e => { const b = e.target.closest('[data-filtro]'); if (!b) return; filtro = b.dataset.filtro; guardarFiltro(filtro); pintarTodo(); };

  const nuevaLeccion = async () => {
    const id = nuevoId();
    const l = { title: 'Lección sin título', createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    if (clase()) l.curso = clase().curso;
    await set(ref(db, `lessons/${U.uid}/${id}`), l);
    location.hash = `#/leccion/${id}`;
  };
  $('#nueva').onclick = nuevaLeccion;

  $('.contenido') && (app.querySelector('.contenido').onclick = async e => {
    if (e.target.closest('[data-nueva]')) return nuevaLeccion();
    const emp = e.target.closest('[data-empezar]');
    if (emp) {
      const c = clase();
      const grupo = c ? c.grupo : await elegirGrupo(cursoLeccion(emp.dataset.empezar));
      if (grupo == null) return;
      emp.disabled = true; emp.textContent = 'Preparando…';
      return empezarClase(emp.dataset.empezar, grupo);
    }
    const bor = e.target.closest('[data-borrar]');
    if (bor && confirm('¿Eliminar esta lección y sus diapositivas? Los informes de las clases ya dadas se conservan.')) {
      await remove(ref(db, `slides/${U.uid}/${bor.dataset.borrar}`));
      await remove(ref(db, `lessons/${U.uid}/${bor.dataset.borrar}`));
    }
  });
}

// Si el curso tiene varios grupos (2.º ESO A y B), pregunta con cuál se da la clase. null = cancelar
function elegirGrupo(curso) {
  const c = cursoDe(curso);
  if (!c || c.grupos.length < 2) return Promise.resolve('');
  return new Promise(ok => {
    dlg.innerHTML = `<form method="dialog" class="dlg dlg-estrecho curso-${c.id}"><h2>¿Con qué grupo?</h2>
      <p class="ayuda">La clase y su informe quedarán guardados en ese grupo.</p>
      <div class="grupos">${c.grupos.map(g => `<button class="btn primario grande" value="${esc(g)}">${g.includes(' y ') ? `Todos (${esc(g)})` : `${esc(c.nombre)} ${esc(g)}`}</button>`).join('')}</div>
      <div class="pie"><button class="btn" value="">Cancelar</button></div></form>`;
    dlg.onclose = () => { dlg.onclose = null; ok(dlg.returnValue || null); };
    dlg.returnValue = '';
    dlg.showModal();
  });
}

// Lista pública de clases en curso (el alumnado la ve al entrar). Si las reglas aún no
// la permiten, falla en silencio y todo sigue funcionando con el código.
function publicarEnCurso(code, d) {
  return set(ref(db, `liveSessions/${code}`), { owner: U.uid, lessonTitle: d.lessonTitle || '', curso: d.curso || '', grupo: d.grupo || '', startedAt: serverTimestamp() }).catch(() => {});
}
function quitarEnCurso(code) { return remove(ref(db, `liveSessions/${code}`)).catch(() => {}); }

async function empezarClase(lessonId, grupo = '') {
  const l = (await get(ref(db, `lessons/${U.uid}/${lessonId}`))).val();
  const items = l?.items || [];
  if (!items.length) return alert('Esta lección aún no tiene diapositivas ni actividades.');
  let code;
  for (let i = 0; i < 10; i++) {
    code = generarCodigo();
    if (!(await get(ref(db, `sessions/${code}`))).exists()) break;
  }
  const curso = cursoDe(l.curso) ? l.curso : '';
  await set(ref(db, `teacherSessions/${U.uid}/${code}`), { lessonId, lessonTitle: l.title, curso, grupo: curso ? grupo : '', createdAt: serverTimestamp(), items });
  await set(ref(db, `sessions/${code}`), { owner: U.uid, lessonId, lessonTitle: l.title, curso, createdAt: serverTimestamp(), showCode: true, state: estado(items, 0) });
  publicarEnCurso(code, { lessonTitle: l.title, curso, grupo: curso ? grupo : '' });
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
    if (it.type === 'gaps') meta = `${solucionesHuecos(it.text).length} huecos`;
    if (it.type === 'table') meta = `Tabla de ${filasTabla(it.table).length} filas, ${solucionesHuecos(it.table).length} casillas`;
    if (it.type === 'match') meta = `${(it.pairs || []).length} parejas`;
    if (it.type === 'order') meta = `${(it.steps || []).length} elementos`;
    if (it.type === 'photo') meta = 'Entrega de imagen';
    if (it.type === 'label') meta = `${(it.points || []).length} partes que identificar${it.write ? ', escribiendo el nombre' : ', eligiendo de una lista'}`;
    if (it.type === 'memory') meta = `${(it.pairs || []).length} parejas`;
    if (it.type === 'search') meta = `${(it.words || []).length} palabras${(it.clues || []).some(Boolean) ? ' con pistas' : ''}`;
    if (it.type === 'wall') meta = `Muro${it.images !== false ? ' con imágenes' : ''}${it.names ? ', con nombres' : ', anónimo'}`;
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
    colorCurso(L.curso);
    app.innerHTML = marco(`
    <section class="editor">
      <div class="cab-editor hero">
        <div class="cab-editor-fila">
          <input id="titulo" class="titulo-input" value="${esc(L.title)}" aria-label="Título de la lección" maxlength="120">
          <select id="curso" class="sel-curso" aria-label="Curso de la lección"><option value="">Sin curso</option>${CURSOS.map(c => `<option value="${c.id}" ${L.curso === c.id ? 'selected' : ''}>${esc(c.nombre)} · ${esc(c.materia)}</option>`).join('')}</select>
        </div>
        <div class="acciones">
          <a class="btn" href="#/" title="Volver a todas las lecciones">‹ Lecciones</a>
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
    $('#curso').onchange = e => { L.curso = e.target.value; update(lRef, { curso: L.curso || null, updatedAt: serverTimestamp() }); pintar(); };
    $('#empezar').onclick = async e => { const g = await elegirGrupo(L.curso); if (g == null) return; e.target.disabled = true; empezarClase(id, g); };
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
      if (d.edit) { const i = +d.edit; dialogoActividad(items[i], paginas(), nuevo => { items[i] = nuevo; guardar(); pintar(); }, { diapos }); }
      if (d.add !== undefined) { const i = +d.add; dialogoActividad(null, paginas(), (...nuevos) => { items.splice(i + 1, 0, ...nuevos); guardar(); pintar(); }, { diapos }); }
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
// Editor de actividades a pantalla completa: tipos con tarjetas → formulario a la izquierda y prueba a la derecha (editor.js)
// opciones.banco: se usa desde el banco (sin «guardar también en el banco» ni fondos). opciones.directo: durante la clase
function dialogoActividad(item, paginas, alGuardar, opciones = {}) {
  const enBanco = !!opciones.banco;
  const diapos = opciones.diapos || null;
  const q = s => dlg.querySelector(s);
  dlg.oncancel = e => { if (q('.dlg-editor .ed')) e.preventDefault(); };

  function elegirTipo() {
    const extra = enBanco ? [] : [
      { id: 'enlace', nombre: 'Enlace', descripcion: 'Una actividad de otra web: Wordwall, Genially, YouTube, GeoGebra…', icono: 'link' },
      { id: 'banco', nombre: 'Desde el banco', descripcion: 'Reutiliza preguntas que ya tienes guardadas', icono: 'banco' }];
    dlg.innerHTML = `<div class="dlg-editor">
      <header class="ed-cab"><h2>${enBanco ? 'Nueva pregunta' : 'Nueva actividad'}: elige el tipo</h2>
        <div class="ed-cab-acc"><button type="button" class="btn" id="cancelar">Cancelar</button></div></header>
      <div class="ed-tipos">
        ${opciones.directo ? '<p class="ayuda">Se añade justo después del paso actual, solo en esta clase. Si quieres conservarla, marca «Guardar también en el banco».</p>' : ''}
        ${tarjetasTipos(extra)}</div></div>`;
    q('#cancelar').onclick = () => dlg.close();
    dlg.querySelectorAll('[data-t]').forEach(b => b.onclick = () => formulario({ type: b.dataset.t }, true));
    dlg.querySelector('[data-extra="enlace"]')?.addEventListener('click', () => dialogoEnlace(null, alGuardar));
    dlg.querySelector('[data-extra="banco"]')?.addEventListener('click', () => elegirDelBanco(alGuardar));
  }

  function formulario(base, nuevo) {
    const t = base.type;
    const desdeBanco = !!base.bankId;
    const campoTema = oculto => `<label class="tema-banco" ${oculto ? 'hidden' : ''}>Tema o etiqueta<input id="tema" value="${esc(base.tema || '')}" placeholder="Q2B T1 Carbono" list="temas-banco" maxlength="60"></label>`;
    const extra = `<div class="ed-bloque guardar-banco">${enBanco ? campoTema(false)
      : `<label class="check"><input type="checkbox" id="al-banco" ${desdeBanco ? 'checked' : ''}> ${desdeBanco ? 'Actualizar también la pregunta del banco' : 'Guardar también en el banco de preguntas'}</label>${campoTema(!desdeBanco)}`}
      <datalist id="temas-banco"></datalist></div>`;
    dlg.innerHTML = `<div class="dlg-editor">
      <header class="ed-cab">
        ${nuevo ? '<button type="button" class="btn" id="volver" aria-label="Volver a los tipos">‹ Tipos</button>' : ''}
        <h2><span class="ed-cab-icono">${ICONOS[t] || ''}</span>${item ? 'Editar' : 'Nueva'} ${enBanco ? 'pregunta' : 'actividad'}: ${esc(TIPOS[t])}</h2>
        <div class="ed-cab-acc"><button type="button" class="btn" id="cancelar">Cancelar</button><button type="button" class="btn primario" id="ok">Guardar</button></div>
      </header>
      <div class="ed-pestanas" role="tablist"><button type="button" role="tab" class="activa" data-ver="form">Editar</button><button type="button" role="tab" data-ver="prueba">Probar</button></div>
      <div id="ed-sitio"></div></div>`;
    const ed = crearEditor(q('#ed-sitio'), base, { paginas: enBanco ? [] : paginas, diapos, extra });
    const enlazarExtra = () => {
      const chk = q('#al-banco');
      if (chk) chk.onchange = () => { q('.tema-banco').hidden = !chk.checked; };
      temasBanco().then(ts => { const dl = q('#temas-banco'); if (dl) dl.innerHTML = ts.map(x => `<option value="${esc(x)}">`).join(''); });
    };
    enlazarExtra();
    // «Rellenar con un ejemplo» vuelve a pintar el formulario (y el bloque del banco)
    q('#ed-sitio').addEventListener('click', e => { if (e.target.closest('#ejemplo')) setTimeout(enlazarExtra, 0); }, true);
    // Móvil: pestañas Editar / Probar
    const pest = q('.ed-pestanas');
    pest.onclick = e => {
      const b = e.target.closest('[data-ver]'); if (!b) return;
      pest.querySelectorAll('[data-ver]').forEach(x => x.classList.toggle('activa', x === b));
      q('.dlg-editor').classList.toggle('ver-prueba', b.dataset.ver === 'prueba');
      if (b.dataset.ver === 'prueba') ed.probar();
    };
    if (q('#volver')) q('#volver').onclick = elegirTipo;
    q('#cancelar').onclick = () => dlg.close();
    q('#ok').onclick = async () => {
      const err = q('#ed-err');
      const { out, error } = ed.leer();
      if (error) {
        err.textContent = error;
        if (q('.dlg-editor').classList.contains('ver-prueba')) pest.querySelector('[data-ver="form"]').click();
        err.scrollIntoView({ block: 'nearest' });
        return;
      }
      const tema = q('#tema')?.value.trim();
      if (tema) out.tema = tema; else delete out.tema;
      if (enBanco || q('#al-banco')?.checked) {
        const bid = enBanco ? out.id : (out.bankId || nuevoId());
        const copia = { ...out, id: bid, updatedAt: serverTimestamp() };
        delete copia.bankId; delete copia.background;
        try { await set(ref(db, `bank/${U.uid}/${bid}`), copia); }
        catch (e) { console.error(e); err.textContent = 'No se ha podido guardar en el banco. ¿Has pegado las reglas nuevas de database.rules.json en Firebase?'; return; }
        if (!enBanco) out.bankId = bid;
      }
      dlg.close();
      alGuardar(out);
    };
  }

  if (item?.type === 'link') return dialogoEnlace(item, alGuardar);
  if (item) formulario(item, false); else elegirTipo();
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
function agregados(it, resp, ocultas) {
  const rs = Object.entries(resp || {});
  // El alumnado ve el muro en texto (las imágenes, solo en el proyector)
  if (it.type === 'wall') return { total: rs.length, posts: postsMuro(resp, ocultas).filter(p => p.t).map(p => it.names ? { t: p.t, a: p.alias } : { t: p.t }) };
  if (it.type === 'quiz') return { counts: it.options.map((_, i) => rs.filter(([, r]) => Number(r.value) === i).length) };
  return { total: rs.length, ok: rs.filter(([u, r]) => comprobar(it, r.value, u) === true).length };
}

function muroHTML(it, resp, ocultas, { vista }) {
  const posts = postsMuro(resp, vista === 'profesor' ? {} : ocultas);
  const n = Object.keys(resp || {}).length;
  return `<p class="recuento"><strong>${n}</strong> ${n === 1 ? 'alumno ha participado' : 'alumnos han participado'}</p>
    <div class="muro">${posts.map(p => {
      const oculta = !!ocultas?.[p.id];
      return `<figure class="nota ${oculta ? 'oculta' : ''}">${p.img ? `<button type="button" class="ver-dibujo" data-src="${esc(p.img)}"><img src="${esc(p.img)}" alt="Imagen del muro" loading="lazy"></button>` : ''}
        ${p.t ? `<p>${rico(p.t)}</p>` : ''}
        ${vista === 'profesor' || it.names ? `<figcaption>${esc(p.alias)}</figcaption>` : ''}
        ${vista === 'profesor' ? `<button type="button" class="btn peq" data-ocultar="${esc(p.id)}">${oculta ? 'Mostrar' : 'Ocultar'}</button>` : ''}</figure>`;
    }).join('') || '<p class="vacio">Aún no hay aportaciones.</p>'}</div>`;
}

function resultadosHTML(it, resp, { vista, revelado = false, ocultas = {} }) {
  if (it.type === 'wall') return muroHTML(it, resp, ocultas, { vista });
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
  if (it.type === 'draw' || it.type === 'photo') {
    return cab + `<div class="galeria">${entradas.map(([, r]) => {
      const src = it.type === 'photo' ? r.value?.img : r.value;
      const pie = [conNombre ? esc(r.alias) : '', it.type === 'photo' && r.value?.t ? esc(r.value.t) : ''].filter(Boolean).join('<br>');
      return `<figure><button type="button" class="ver-dibujo" data-src="${esc(src)}"><img src="${esc(src)}" alt="${it.type === 'photo' ? 'Imagen' : 'Dibujo'}${conNombre ? ' de ' + esc(r.alias) : ''}" loading="lazy"></button>${pie ? `<figcaption>${pie}</figcaption>` : ''}</figure>`;
    }).join('')}</div>`;
  }
  const ag = agregados(it, resp);
  const intentos = it.type === 'memory' ? entradas.map(([, r]) => r.value?.intentos).filter(Boolean) : [];
  const resumen = it.type === 'memory'
    ? `<p class="resumen-ok">${ag.ok} de ${n} lo han completado${intentos.length ? `. Media: ${fmtNum(intentos.reduce((a, b) => a + b, 0) / intentos.length, 2)} intentos; mejor: ${Math.min(...intentos)}` : ''}</p>`
    : esCorregible(it)
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
function controlSesion(code, items, alCambiar, { lessonId, diapos } = {}) {
  let ses = null, resp = {}, itemSub = null, itemId = null;
  const idx = () => ses?.state?.index ?? 0;
  const ir = i => {
    if (!ses || ses.endedAt || i < 0 || i >= items.length) return;
    set(ref(db, `sessions/${code}/state`), estado(items, i));
  };
  const sincronizar = () => {
    const st = ses?.state; if (!st?.reveal) return;
    const it = items[idx()]; if (!esActividad(it)) return;
    const ag = agregados(it, resp, ses?.hidden?.[it.id]);
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
  // Las actividades añadidas durante el directo llegan a todas las ventanas (control y proyector)
  alSalir(onValue(ref(db, `teacherSessions/${U.uid}/${code}/items`), s => {
    const nuevos = s.val() || [];
    if (JSON.stringify(nuevos) === JSON.stringify(items)) return;
    items.splice(0, items.length, ...nuevos);
    recargarDiapos().then(() => alCambiar('items'));
  }));
  // Si se ha reemplazado el PDF, las diapositivas cambian
  async function recargarDiapos() {
    if (!diapos || !lessonId) return;
    try {
      const d = (await get(ref(db, `slides/${U.uid}/${lessonId}`))).val() || {};
      for (const k of Object.keys(diapos)) delete diapos[k];
      Object.assign(diapos, d);
    } catch (e) { console.error(e); }
  }
  document.onkeydown = e => {
    if (e.target.closest('input, textarea, select') || dlg.open) return;
    if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); ir(idx() + 1); }
    if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); ir(idx() - 1); }
  };
  return {
    get ses() { return ses; }, get resp() { return resp; }, idx, ir,
    get ocultas() { return ses?.hidden?.[items[idx()]?.id] || {}; },
    ocultar: id => { const it = items[idx()]; const ya = !!ses?.hidden?.[it.id]?.[id]; set(ref(db, `sessions/${code}/hidden/${it.id}/${id}`), ya ? null : true); },
    // Inserta pasos tras el actual, en esta clase, y va al primero
    insertar: async nuevos => {
      const i = idx();
      const lista = [...items.slice(0, i + 1), ...nuevos.map(n => ({ ...n, enDirecto: true })), ...items.slice(i + 1)];
      await set(ref(db, `teacherSessions/${U.uid}/${code}/items`), lista);
      if (JSON.stringify(lista) !== JSON.stringify(items)) { items.splice(0, items.length, ...lista); alCambiar('items'); }
      ir(i + 1);
    },
    // Trae los cambios de la lección. Conserva las actividades añadidas en el directo y el paso actual
    actualizar: async () => {
      const l = (await get(ref(db, `lessons/${U.uid}/${lessonId}`))).val();
      if (!l) throw new Error('La lección ya no existe.');
      const lista = [...(l.items || [])];
      items.forEach((it, k) => {
        if (!it.enDirecto || lista.some(x => x.id === it.id)) return;
        let j = -1;
        for (let m = k - 1; m >= 0 && j < 0; m--) j = lista.findIndex(x => x.id === items[m].id);
        lista.splice(j + 1, 0, it);
      });
      if (!lista.length) throw new Error('La lección está vacía.');
      const i = idx(), actual = items[i];
      let ni = lista.findIndex(x => x.id === actual?.id);
      if (ni < 0) ni = Math.min(i, lista.length - 1);
      const mismo = JSON.stringify(lista[ni]) === JSON.stringify(actual);
      const iguales = JSON.stringify(lista) === JSON.stringify(items);
      await set(ref(db, `teacherSessions/${U.uid}/${code}/items`), lista);
      await update(ref(db, `teacherSessions/${U.uid}/${code}`), { lessonTitle: l.title });
      if (!iguales) { items.splice(0, items.length, ...lista); await recargarDiapos(); alCambiar('items'); }
      if (mismo) await update(ref(db, `sessions/${code}/state`), { index: ni, total: lista.length });
      else await set(ref(db, `sessions/${code}/state`), estado(lista, ni));
      return { iguales, mismo };
    },
    abrir: () => update(ref(db, `sessions/${code}/state`), { open: !ses.state.open }),
    revelar: () => {
      const it = items[idx()];
      if (ses.state.reveal) update(ref(db, `sessions/${code}/state`), { reveal: false, item: itemPublico(it), results: null });
      else update(ref(db, `sessions/${code}/state`), { reveal: true, item: it, results: agregados(it, resp, ses?.hidden?.[it.id]) });
    }
  };
}

// ── Control en directo ───────────────────────────────────────────
async function vistaDirecto(code) {
  app.innerHTML = marco(`<p class="vacio">Cargando clase…</p>`);
  const priv = (await get(ref(db, `teacherSessions/${U.uid}/${code}`))).val();
  if (!priv) { app.innerHTML = marco(`<p class="vacio">No encuentro esa clase. <a href="#/">Volver</a></p>`); return; }
  if (!priv.endedAt) get(ref(db, `liveSessions/${code}`)).then(x => { if (!x.exists()) publicarEnCurso(code, priv); }).catch(() => {});
  const items = priv.items || [];
  const diapos = (await get(ref(db, `slides/${U.uid}/${priv.lessonId}`))).val() || {};
  const enlace = enlaceAlumno(code);
  let roster = {};
  colorCurso(priv.curso);

  app.innerHTML = marco(`
  <section class="directo">
    <div class="cab-directo hero">
      <div class="cab-titulo"><h1>${esc(priv.lessonTitle)}</h1>${chipClase(priv.curso, priv.grupo)}
        <p class="meta">El alumnado entra en <a href="${enlace}" target="_blank" rel="noopener">${esc(enlaceCorto(enlace))}</a> con el código</p></div>
      <div class="codigo-grande" aria-label="Código de la clase">${code}</div>
      <div class="acciones">
        <a class="btn" href="#/" title="Volver a todas las lecciones. La clase sigue en marcha: vuelves con «Volver al directo»">‹ Lecciones</a>
        <details class="mas-opciones">
          <summary class="btn" id="acceso-resumen">Acceso <span aria-hidden="true">▾</span></summary>
          <div class="mas-menu">
            <p class="mas-nota">El alumnado entra siempre con su cuenta del colegio.</p>
            <button class="btn" id="invitados" aria-pressed="false">Permitir entrar sin cuenta</button>
          </div>
        </details>
        <details class="mas-opciones">
          <summary class="btn">Presentar <span aria-hidden="true">▾</span></summary>
          <div class="mas-menu">
            <a class="btn" href="#/proyectar/${code}" target="_blank" rel="noopener">Abrir vista para proyectar</a>
            <button class="btn" id="vercodigo">Código en el proyector</button>
          </div>
        </details>
        <details class="mas-opciones">
          <summary class="btn">Edición <span aria-hidden="true">▾</span></summary>
          <div class="mas-menu">
            <a class="btn" href="#/leccion/${priv.lessonId}">Editar la lección</a>
            <button class="btn" id="actualizar" title="Trae los cambios que hayas hecho en la lección. Se conservan las respuestas y las actividades añadidas en el directo.">Actualizar con la lección</button>
          </div>
        </details>
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

  const menus = [...app.querySelectorAll('.mas-opciones')];
  menus.forEach(m => {
    m.querySelector('.mas-menu').addEventListener('click', e => { if (e.target.closest('.btn')) m.open = false; });
    m.addEventListener('toggle', () => { if (m.open) menus.forEach(o => { if (o !== m) o.open = false; }); });
  });
  const cerrarMas = e => menus.forEach(m => { if (m.open && !m.contains(e.target)) m.open = false; });
  document.addEventListener('click', cerrarMas);
  alSalir(() => document.removeEventListener('click', cerrarMas));
  const C = controlSesion(code, items, motivo => {
    if (motivo === 'items') { const t = $('#tira'); if (t) t.dataset.hecha = ''; const a = $('#actual'); if (a) a.dataset.k = ''; }
    if (motivo === 'sesion' || motivo === 'items') { pintarControles(); pintarTira(); }
    pintarActual(); pintarRoster();
  }, { lessonId: priv.lessonId, diapos });

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
      <h2 class="enunciado">${rico(conNombres(it.prompt, it))}</h2>${resultadosHTML(it, C.resp, { vista: 'profesor', ocultas: C.ocultas })}</div>`;
  }

  function pintarControles() {
    const el = $('#controles'); if (!el || !C.ses) return;
    const i = C.idx(), it = items[i], st = C.ses.state || {}, fin = !!C.ses.endedAt;
    el.innerHTML = `
      <button class="btn" data-ir="${i - 1}" ${i === 0 || fin ? 'disabled' : ''}>Anterior</button>
      <span class="posicion">${i + 1} de ${items.length}</span>
      <button class="btn primario" data-ir="${i + 1}" ${i >= items.length - 1 || fin ? 'disabled' : ''}>Siguiente</button>
      ${fin ? '' : '<button class="btn" id="insertar">Añadir actividad aquí</button>'}
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
    $('#acceso-resumen').innerHTML = `${C.ses.guests ? 'Acceso: con y sin cuenta' : 'Acceso: con cuenta'} <span aria-hidden="true">▾</span>`;
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
    const oc = e.target.closest('[data-ocultar]'); if (oc) return C.ocultar(oc.dataset.ocultar);
    if (e.target.closest('#insertar')) {
      const paginas = Object.keys(diapos).filter(k => diapos[k]).map(Number).sort((a, b) => a - b);
      return dialogoActividad(null, paginas, (...nuevos) => C.insertar(nuevos), { directo: true, diapos });
    }
    if (e.target.closest('#revelar')) return C.revelar();
    const act = e.target.closest('#actualizar');
    if (act) {
      act.disabled = true; act.textContent = 'Actualizando…';
      try { const r = await C.actualizar(); act.textContent = r.iguales ? 'Ya estaba al día' : 'Actualizada'; }
      catch (err) { console.error(err); act.textContent = 'No se ha podido actualizar'; alert(err.message || 'No se ha podido actualizar.'); }
      setTimeout(() => { act.disabled = false; act.textContent = 'Actualizar con la lección'; }, 2500);
      return;
    }
    const vd = e.target.closest('.ver-dibujo'); if (vd) return verDibujo(vd.dataset.src);
    if (e.target.closest('#vercodigo')) return update(ref(db, `sessions/${code}`), { showCode: !C.ses.showCode });
    if (e.target.closest('#invitados')) return permitirInvitados(code, priv.lessonId, !C.ses.guests);
    if (e.target.closest('#finalizar')) {
      if (!confirm('¿Finalizar la clase? El alumnado verá que ha terminado y ya no podrá responder.')) return;
      await update(ref(db, `sessions/${code}`), { endedAt: serverTimestamp(), 'state/open': false });
      if (C.ses.guests) await permitirInvitados(code, priv.lessonId, false);
      await update(ref(db, `teacherSessions/${U.uid}/${code}`), { endedAt: serverTimestamp() });
      await quitarEnCurso(code);
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
  if (!priv.endedAt) get(ref(db, `liveSessions/${code}`)).then(x => { if (!x.exists()) publicarEnCurso(code, priv); }).catch(() => {});
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

  const C = controlSesion(code, items, m => { if (m === 'items') $('#escena').dataset.k = ''; pintar(); }, { lessonId: priv.lessonId, diapos });
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
    el.innerHTML = `<div class="proy-act"><h2>${rico(conNombres(it.prompt, it))}</h2>${resultadosHTML(it, C.resp, { vista: 'proyector', revelado: !!ses.state?.reveal, ocultas: C.ocultas })}</div>`;
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
        return { c, t: textoRespuesta(it, x.value), dibujo: it.type === 'draw' ? x.value : it.type === 'photo' ? x.value?.img : null, verTxt: it.type === 'photo' ? 'Ver imagen' : 'Ver dibujo', datos: tieneVariantes(it) ? `${datosTexto(it, u)}; solución ${solucionTexto(it, u)}` : '' };
      });
      return { r, celdas, ok };
    });
  const participacion = acts.map(it => Object.keys(resp[it.id] || {}).length);

  colorCurso(priv.curso);
  app.innerHTML = marco(`
  <section class="informe">
    <div class="cab-bloque hero">
      <div><h1>${esc(priv.lessonTitle)}</h1>${chipClase(priv.curso, priv.grupo)}<p class="meta">${fecha(priv.createdAt)}, código ${code}, ${filas.length} ${filas.length === 1 ? 'alumno' : 'alumnos'}</p>${priv.endedAt ? '' : '<span class="pildora-en-curso">En curso</span>'}</div>
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
          : c.dibujo ? `<td><button class="btn peq ver-dibujo" data-src="${esc(c.dibujo)}">${c.verTxt}</button></td>`
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
    <div class="cab-bloque hero">
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
