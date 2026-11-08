import { auth, db, configurado, enApp } from './firebase.js';
import { NOMBRE_APP, DOMINIO_ALUMNADO } from './config.js';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, signInAnonymously, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { ref, get, set, update, onValue, onDisconnect, serverTimestamp, runTransaction } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import { esc, rico, conDatos, esActividad, infoEnlace, lista, MAX_MURO, POR_PARTES, pintarPartes, leerPartes, moverOrden, aciertosPorParte, reducirImagen, colorCurso, pintarSopa, jugarMemory, jugarSopa, lineaSopa, palabraSopa, nombreTipo, comprobar, respuestaHTML, solucionTexto, esCorregible } from './lib.js';

const app = document.getElementById('app');
const S = { code: null, alias: '', uid: null, session: null, slides: {}, resp: null, respItem: null, respUnsub: null, key: '', invitado: false };

const dominioOk = u => !!u && !u.isAnonymous && u.emailVerified && String(u.email || '').toLowerCase().endsWith('@' + DOMINIO_ALUMNADO);
const nombreVisible = u => (u.displayName || u.email.split('@')[0]).slice(0, 60);

async function iniciarSesion() {
  const prov = new GoogleAuthProvider();
  // Muestra directamente las cuentas del colegio en el selector de Google
  prov.setCustomParameters({ hd: DOMINIO_ALUMNADO, prompt: 'select_account' });
  if (enApp) await signInWithRedirect(auth, prov);
  else await signInWithPopup(auth, prov);
}

// ── Pantalla de entrada ─────────────────────────────────────────
function pantallaEntrada(msg = '') {
  const code = (new URLSearchParams(location.search).get('c') || S.code || '').toUpperCase();
  const u = auth.currentUser;
  const conectado = dominioOk(u);
  app.innerHTML = `
  <div class="mcr-acceso"><section class="entrada mcr-acceso__tarjeta">
    <img class="logo-claro" src="logo.svg" alt="mariancr">
    <p class="marca-texto">${esc(NOMBRE_APP)}</p>
    <h1>Entra en la clase</h1>
    ${conectado ? `
    <form id="f" class="formulario" autocomplete="off">
      <p class="cuenta">Has entrado como <strong>${esc(nombreVisible(u))}</strong><br><span class="meta">${esc(u.email)}</span>
        <button type="button" class="btn peq" id="otra">No soy yo</button></p>
      <label>Código de la clase
        <input id="code" class="codigo-input" maxlength="6" required value="${esc(code)}" autocapitalize="characters" spellcheck="false">
      </label>
      <p class="aviso" role="alert">${esc(msg)}</p>
      <button class="mcr-btn mcr-btn--prim mcr-btn--ancho" type="submit">Entrar en la clase</button>
    </form>` : `
    <p>Inicia sesión con tu cuenta del colegio (<strong>@${esc(DOMINIO_ALUMNADO)}</strong>).</p>
    <p class="aviso" role="alert">${esc(msg)}</p>
    <button class="mcr-btn mcr-btn--prim mcr-btn--ancho" id="google">Entrar con la cuenta del colegio</button>
    <p class="sin-cuenta"><button type="button" class="enlace-btn" id="invitado">Entrar sin cuenta</button><br><span class="meta">Solo si tu profesor/a lo ha permitido en esta clase.</span></p>`}
    <p class="mcr-acceso__docente acceso-docente"><a href="profesor.html">Acceso docente</a></p>
  </section></div>`;

  if (!conectado) {
    app.querySelector('#invitado').onclick = () => pantallaInvitado(code);
    app.querySelector('#google').onclick = async e => {
      e.target.disabled = true; e.target.textContent = 'Abriendo Google…';
      try { await iniciarSesion(); }
      catch (err) {
        console.error(err);
        const m = err.code === 'auth/popup-blocked' ? 'El navegador ha bloqueado la ventana de Google. Permite las ventanas emergentes para esta web y vuelve a intentarlo.'
          : err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request' ? ''
          : 'No se ha podido iniciar sesión. Si el error se repite, avisa a tu profesor/a.';
        pantallaEntrada(m);
      }
    };
    return;
  }
  const f = app.querySelector('#f');
  const ci = f.querySelector('#code');
  ci.addEventListener('input', () => { ci.value = ci.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  f.querySelector('#otra').onclick = () => signOut(auth);
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = f.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Entrando…';
    try { await entrar(ci.value); }
    catch (err) { console.error(err); pantallaEntrada('No se ha podido entrar. Comprueba tu conexión e inténtalo de nuevo.'); }
  });
}

// ── Entrar sin cuenta (solo si la docente lo permite en esa clase) ──
function pantallaInvitado(code = '', msg = '', nombre = '') {
  app.innerHTML = `
  <div class="mcr-acceso"><section class="entrada mcr-acceso__tarjeta">
    <img class="logo-claro" src="logo.svg" alt="mariancr">
    <p class="marca-texto">${esc(NOMBRE_APP)}</p>
    <h1>Entrar sin cuenta</h1>
    <form id="f" class="formulario" autocomplete="off">
      <label>Código de la clase
        <input id="code" class="codigo-input" maxlength="6" required value="${esc(code)}" autocapitalize="characters" spellcheck="false">
      </label>
      <label>Tu nombre y apellidos
        <input id="nombre" required maxlength="60" value="${esc(nombre)}" autocomplete="name">
      </label>
      <p class="aviso" role="alert">${esc(msg)}</p>
      <button class="mcr-btn mcr-btn--prim mcr-btn--ancho" type="submit">Entrar en la clase</button>
      <p class="sin-cuenta"><button type="button" class="enlace-btn" id="volver">Entrar con la cuenta del colegio</button></p>
    </form>
  </section></div>`;
  const f = app.querySelector('#f');
  const ci = f.querySelector('#code');
  ci.addEventListener('input', () => { ci.value = ci.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  f.querySelector('#volver').onclick = () => pantallaEntrada();
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const c = ci.value.trim().toUpperCase(), n = f.querySelector('#nombre').value.trim().replace(/\s+/g, ' ');
    if (n.length < 3) return pantallaInvitado(c, 'Escribe tu nombre y apellidos para que tu profesor/a sepa quién eres.', n);
    const btn = f.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Entrando…';
    S.invitado = true;
    try {
      if (!auth.currentUser?.isAnonymous) await signInAnonymously(auth);
      let ok = false;
      try { ok = (await get(ref(db, `sessions/${c}/guests`))).val() === true; } catch { ok = false; }
      if (!ok) { S.invitado = false; await signOut(auth); return pantallaInvitado(c, 'Esta clase no admite entrar sin cuenta, o el código no es correcto. Entra con la cuenta del colegio.', n); }
      await entrar(c, n);
    } catch (err) {
      console.error(err); S.invitado = false;
      pantallaInvitado(c, err.code === 'auth/operation-not-allowed' || err.code === 'auth/admin-restricted-operation'
        ? 'La entrada sin cuenta no está activada en esta web. Avisa a tu profesor/a.' : 'No se ha podido entrar. Comprueba tu conexión e inténtalo de nuevo.', n);
    }
  });
}

async function entrar(code, nombreInvitado = null) {
  code = code.trim().toUpperCase();
  if (!code) return pantallaEntrada('Escribe el código de la clase.');
  const u = auth.currentUser;
  S.uid = u.uid;

  const snap = await get(ref(db, `sessions/${code}`));
  if (!snap.exists()) return pantallaEntrada('No hay ninguna clase con ese código. Revísalo en la pizarra.');
  if (snap.val().endedAt) return pantallaEntrada('Esa clase ya ha terminado.');

  S.code = code; S.alias = nombreInvitado ? nombreInvitado.slice(0, 60) : nombreVisible(u);
  const rRef = ref(db, `roster/${code}/${S.uid}`);
  const prev = await get(rRef);
  await update(rRef, {
    alias: S.alias, email: nombreInvitado ? '' : u.email.toLowerCase(), online: true, away: false, lastSeen: serverTimestamp(),
    ...(prev.exists() ? {} : { joinedAt: serverTimestamp(), awayCount: 0 })
  });
  history.replaceState(null, '', `?c=${code}`);
  presencia(rRef);
  onValue(ref(db, `sessions/${code}`), s => { S.session = s.val(); cambioSesion(); });
}

// ── Presencia y trazabilidad ─────────────────────────────────────
function presencia(rRef) {
  onValue(ref(db, '.info/connected'), s => {
    if (s.val() !== true || S.session?.endedAt) return;
    onDisconnect(rRef).update({ online: false, lastSeen: serverTimestamp() });
    update(rRef, { online: true, lastSeen: serverTimestamp() }).catch(() => {});
  });
  document.addEventListener('visibilitychange', () => {
    if (!S.code || S.session?.endedAt) return;
    const away = document.hidden;
    update(rRef, { away, lastSeen: serverTimestamp() }).catch(() => {});
    if (away) runTransaction(ref(db, `roster/${S.code}/${S.uid}/awayCount`), n => (n || 0) + 1).catch(() => {});
  });
}

function cambioSesion() {
  const it = S.session?.state?.item;
  const id = esActividad(it) ? it.id : null;
  if (id !== S.respItem) {
    if (S.respUnsub) S.respUnsub();
    S.respUnsub = null; S.resp = null; S.respItem = id; S.rehacer = false;
    if (id) S.respUnsub = onValue(ref(db, `responses/${S.code}/${id}/${S.uid}`), s => { S.resp = s.val(); pintar(); });
  }
  pintar();
}

async function diapo(page) {
  if (S.slides[page]) return S.slides[page];
  const s = await get(ref(db, `slides/${S.session.owner}/${S.session.lessonId}/${page}`));
  return (S.slides[page] = s.val());
}

// ── Pantalla completa ────────────────────────────────────────────
// Donde el navegador no la permite (iPhone), se amplía dentro de la página
const ICO_PC = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICO_SALIR_PC = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const elPC = () => document.fullscreenElement || document.webkitFullscreenElement;
const enPantallaCompleta = () => !!elPC() || document.body.classList.contains('modo-amplio');
async function alternarPantallaCompleta() {
  const raiz = document.documentElement;
  const pedir = raiz.requestFullscreen || raiz.webkitRequestFullscreen;
  if (elPC()) await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  else if (document.body.classList.contains('modo-amplio')) document.body.classList.remove('modo-amplio');
  else if (pedir) { try { await pedir.call(raiz); } catch { document.body.classList.add('modo-amplio'); } }
  else document.body.classList.add('modo-amplio');
  try { await screen.orientation?.lock?.('landscape'); } catch {}
  S.key = ''; pintar();
}
const alCambiarPC = () => { document.body.classList.toggle('pantalla-completa', !!elPC()); S.key = ''; pintar(); };
document.addEventListener('fullscreenchange', alCambiarPC);
document.addEventListener('webkitfullscreenchange', alCambiarPC);
app.addEventListener('click', e => { if (e.target.closest('#pc-alumno')) alternarPantallaCompleta(); });

// ── Vista en directo ─────────────────────────────────────────────
function pintar() {
  const ses = S.session;
  if (!ses || ses.endedAt) {
    if (S.key === 'fin') return; S.key = 'fin';
    app.innerHTML = `<div class="mcr-acceso"><section class="entrada mcr-acceso__tarjeta"><h1>La clase ha terminado</h1><p>Gracias, ${esc(S.alias)}. Ya puedes cerrar esta página.</p></section></div>`;
    return;
  }
  colorCurso(ses.curso);
  const st = ses.state || {};
  const it = st.item;
  const key = [it?.id, st.open, st.reveal, JSON.stringify(S.resp?.value ?? null), JSON.stringify(st.results ?? null)].join('|');
  if (key === S.key) return;
  S.key = key;

  app.innerHTML = `
  <header class="barra-alumno">
    <span class="codigo-mini">${esc(S.code)}</span>
    <span class="yo">${esc(S.alias)}</span>
    <span class="pos">${it ? `${(st.index ?? 0) + 1} / ${st.total ?? ''}` : ''}</span>
    <button type="button" class="btn-ico btn-pc" id="pc-alumno" aria-label="${enPantallaCompleta() ? 'Salir de pantalla completa' : 'Pantalla completa'}" title="${enPantallaCompleta() ? 'Salir de pantalla completa' : 'Pantalla completa'}">${enPantallaCompleta() ? ICO_SALIR_PC : ICO_PC}</button>
  </header>
  <div class="escenario" id="esc"></div>`;
  const esc_ = app.querySelector('#esc');

  if (!it) { esc_.innerHTML = `<p class="espera">Esperando a que empiece la clase…</p>`; return; }
  if (it.type === 'slide') {
    esc_.innerHTML = `<img class="diapo" alt="Diapositiva ${it.page}">`;
    diapo(it.page).then(src => { const img = esc_.querySelector('img'); if (img && src) img.src = src; });
    return;
  }
  if (it.type === 'link') return pintarEnlace(esc_, it);
  pintarActividad(esc_, it, st);
}

function pintarEnlace(el, it) {
  const nombre = infoEnlace(it.url)?.nombre || 'enlace';
  el.innerHTML = `<article class="actividad actividad-enlace">
    <p class="tipo">Enlace</p><h2 class="enunciado">${rico(it.prompt)}</h2>
    ${it.embed ? `<iframe class="marco-enlace" src="${esc(it.embed)}" title="${esc(it.prompt)}" allow="fullscreen; autoplay; clipboard-write"></iframe>` : ''}
    <a class="btn ${it.embed ? '' : 'primario grande'}" href="${esc(it.url)}" target="_blank" rel="noopener">${it.embed ? 'Abrir en otra pestaña' : `Abrir la actividad en ${esc(nombre)}`}</a>
    <p class="ayuda">${it.embed ? 'Si no se ve bien aquí, ábrela en otra pestaña.' : 'Se abrirá en otra pestaña.'} Cuando termines, vuelve a esta pestaña para seguir la clase.</p>
  </article>`;
}

function pintarActividad(el, it, st) {
  const mia = S.resp?.value;
  const tieneMia = S.resp != null;
  let cuerpo = '';

  if (st.reveal) cuerpo = resultadoAlumno(it, st, mia, tieneMia);
  else if (!st.open) cuerpo = `<p class="estado-act">Las respuestas están cerradas.${tieneMia && !POR_PARTES.includes(it.type) && it.type !== 'wall' && it.type !== 'photo' ? ` Tu respuesta: <strong>${respuestaHTML(it, mia)}</strong>` : tieneMia ? ' Tu respuesta está enviada.' : ''}</p>`;
  else cuerpo = formulario(it, mia, tieneMia);

  el.innerHTML = `<article class="actividad"><p class="tipo">${nombreTipo(it)}</p><h2 class="enunciado">${rico(conDatos(it.prompt, it, S.uid))}</h2>${cuerpo}</article>`;
  if (!st.reveal && st.open) activarFormulario(el, it, mia);
}

function formulario(it, mia, tieneMia) {
  const nota = tieneMia ? `<p class="estado-act ok">Respuesta enviada. Puedes cambiarla mientras siga abierta.</p>` : '';
  if (it.type === 'quiz') {
    return `<div class="opciones-alumno" role="radiogroup">${(it.options || []).map((o, i) =>
      `<button type="button" class="op-alumno ${Number(mia) === i && tieneMia ? 'elegida' : ''}" data-op="${i}" role="radio" aria-checked="${Number(mia) === i && tieneMia}">${rico(o)}</button>`).join('')}</div>${nota}`;
  }
  if (it.type === 'short') {
    return `<form class="form-resp"><textarea id="txt" rows="4" maxlength="1000" required placeholder="Escribe tu respuesta">${esc(mia ?? '')}</textarea><button class="btn primario grande">Enviar respuesta</button></form>${nota}`;
  }
  if (it.type === 'number') {
    const pedir = it.unitMode === 'ask';
    return `<form class="form-resp">
      <div class="fila-num">
        <input id="num" inputmode="decimal" required placeholder="Valor" value="${esc(mia?.n ?? '')}" aria-label="Valor numérico">
        ${pedir ? `<input id="uni" required placeholder="Unidad" value="${esc(mia?.u ?? '')}" aria-label="Unidad" class="uni">` : (it.unit ? `<span class="uni-fija">${esc(it.unit)}</span>` : '')}
      </div>
      <p class="ayuda">Puedes escribir decimales con coma y potencias así: 3,2·10^4 o 3,2e4.</p>
      <button class="btn primario grande">Enviar respuesta</button></form>${nota}`;
  }
  if (it.type === 'photo') {
    if (tieneMia && !S.rehacer) {
      return `<img class="dibujo-enviado" src="${esc(mia.img)}" alt="Tu imagen">${mia.t ? `<p>${esc(mia.t)}</p>` : ''}${nota}<button type="button" class="btn" id="rehacer">Cambiar la imagen</button>`;
    }
    return `<form class="form-resp form-foto">
      <label class="btn grande elegir-foto"><span id="foto-txt">Hacer una foto o elegir una imagen</span><input type="file" id="foto" accept="image/*" hidden></label>
      <img class="dibujo-enviado" id="foto-prev" alt="Vista previa" hidden>
      <textarea id="txt" rows="2" maxlength="500" placeholder="Comentario (opcional)"></textarea>
      <p class="aviso" role="alert"></p>
      <button class="btn primario grande">Enviar imagen</button></form>${nota}`;
  }
  if (it.type === 'wall') {
    const mios = lista(mia);
    return `${mios.length ? `<p class="tipo">Tus aportaciones</p><div class="muro muro-mio">${mios.map((p, i) => `<figure class="nota">${p.img ? `<img src="${esc(p.img)}" alt="Tu imagen">` : ''}${p.t ? `<p>${rico(p.t)}</p>` : ''}<button type="button" class="btn peq" data-borrar-nota="${i}">Quitar</button></figure>`).join('')}</div>` : ''}
      ${mios.length < MAX_MURO ? `<form class="form-resp form-muro">
        <textarea id="txt" rows="3" maxlength="600" placeholder="Escribe tu aportación"></textarea>
        ${it.images !== false ? `<label class="btn elegir-foto"><span id="foto-txt">Añadir una imagen</span><input type="file" id="foto" accept="image/*" hidden></label><img class="dibujo-enviado" id="foto-prev" alt="Vista previa" hidden>` : ''}
        <p class="aviso" role="alert"></p>
        <button class="btn primario grande">Publicar en el muro</button></form>` : `<p class="estado-act">Has llegado al máximo de ${MAX_MURO} aportaciones. Quita alguna si quieres publicar otra.</p>`}
      <p class="ayuda">${it.names ? 'Tu nombre aparecerá junto a lo que publiques.' : 'El resto de la clase no verá tu nombre, pero tu profesor/a sí.'}</p>`;
  }
  if (it.type === 'memory') {
    if (mia?.hecho && !S.rehacer) return `<p class="tu-resp ok">¡Completado en <strong>${mia.intentos} intentos</strong>!</p><button type="button" class="btn" id="rehacer">Jugar otra vez</button>`;
    return `<p class="marcador-memory" id="marcador">Parejas: 0 de ${(it.cards || []).length / 2} · Intentos: 0</p>
      <div class="memory">${(it.cards || []).map((c, j) => `<button type="button" class="carta" data-j="${j}" aria-label="Carta ${j + 1}"><span class="carta-dorso" aria-hidden="true"></span><span class="carta-cara">${rico(c.t)}</span></button>`).join('')}</div>`;
  }
  if (it.type === 'search') {
    const n = (it.words || it.h || []).length, h = lista(mia).length;
    return `${pintarSopa(it, mia, { editable: true })}
      <p class="estado-act ${h === n ? 'ok' : ''}" id="estado-sopa" aria-live="polite">${h === n ? '¡Has encontrado todas las palabras!' : `Has encontrado ${h} de ${n}. Pulsa la primera letra y después la última (o arrastra).`}</p>`;
  }
  if (POR_PARTES.includes(it.type)) {
    return `<form class="form-resp form-partes">${pintarPartes(it, mia, { editable: true })}
      <p class="aviso" role="alert"></p>
      <button class="btn primario grande">${tieneMia ? 'Volver a enviar' : 'Enviar respuesta'}</button></form>${nota}`;
  }
  if (it.type === 'draw') {
    if (tieneMia && !S.rehacer) {
      return `<img class="dibujo-enviado" src="${esc(mia)}" alt="Tu dibujo">${nota}<button type="button" class="btn" id="rehacer">Volver a dibujar</button>`;
    }
    return `<div class="herramientas" id="herr">
        ${['#1E293B', '#2563EB', '#E11D48', '#10B981', '#F97316'].map((c, i) => `<button type="button" class="color ${i === 0 ? 'activo' : ''}" data-color="${c}" style="--c:${c}" aria-label="Color ${i + 1}"></button>`).join('')}
        <button type="button" class="btn peq" data-grosor="3">Fino</button>
        <button type="button" class="btn peq" data-grosor="8">Grueso</button>
        <button type="button" class="btn peq" id="deshacer">Deshacer</button>
        <button type="button" class="btn peq" id="borrar">Borrar todo</button>
      </div>
      <div class="caja-lienzo" id="caja"></div>
      <button class="mcr-btn mcr-btn--prim mcr-btn--ancho" id="enviar-dibujo">Enviar dibujo</button>${nota}
      <p class="aviso" id="aviso-d" role="alert"></p>`;
  }
  return '';
}

function activarFormulario(el, it, mia) {
  const enviar = async valor => {
    try {
      await set(ref(db, `responses/${S.code}/${it.id}/${S.uid}`), { value: valor, at: serverTimestamp(), alias: S.alias });
    } catch (e) {
      console.error(e);
      const p = el.querySelector('.aviso') || el.appendChild(Object.assign(document.createElement('p'), { className: 'aviso' }));
      p.textContent = 'No se ha podido enviar: puede que la actividad ya esté cerrada.';
    }
  };
  if (it.type === 'quiz') el.querySelectorAll('[data-op]').forEach(b => b.onclick = () => enviar(Number(b.dataset.op)));
  if (it.type === 'short') el.querySelector('form').onsubmit = e => { e.preventDefault(); const v = el.querySelector('#txt').value.trim(); if (v) enviar(v); };
  if (it.type === 'number') el.querySelector('form').onsubmit = e => {
    e.preventDefault();
    const v = { n: el.querySelector('#num').value.trim() };
    const u = el.querySelector('#uni'); if (u) v.u = u.value.trim();
    if (v.n) enviar(v);
  };
  if (it.type === 'photo' || it.type === 'wall') {
    const re = el.querySelector('#rehacer');
    if (re) { re.onclick = () => { S.rehacer = true; S.key = ''; pintar(); }; return; }
    el.querySelectorAll('[data-borrar-nota]').forEach(b => b.onclick = () => {
      const resto = lista(mia).filter((_, i) => i !== Number(b.dataset.borrarNota));
      resto.length ? enviar(resto) : set(ref(db, `responses/${S.code}/${it.id}/${S.uid}`), null);
    });
    const f = el.querySelector('form'); if (!f) return;
    let img = '';
    const fi = f.querySelector('#foto');
    if (fi) fi.onchange = async () => {
      const file = fi.files[0]; if (!file) return;
      f.querySelector('#foto-txt').textContent = 'Preparando la imagen…';
      try {
        img = await reducirImagen(file, it.type === 'wall' ? 800 : 1280, it.type === 'wall' ? 0.65 : 0.72);
        const pv = f.querySelector('#foto-prev'); pv.src = img; pv.hidden = false;
        f.querySelector('#foto-txt').textContent = 'Cambiar la imagen';
      } catch (e) { console.error(e); f.querySelector('.aviso').textContent = 'No se ha podido leer esa imagen. Prueba con otra.'; f.querySelector('#foto-txt').textContent = 'Elegir otra imagen'; }
    };
    f.onsubmit = e => {
      e.preventDefault();
      const t = f.querySelector('#txt').value.trim();
      if (it.type === 'photo') {
        if (!img) { f.querySelector('.aviso').textContent = 'Elige primero una imagen.'; return; }
        S.rehacer = false;
        return enviar(t ? { img, t } : { img });
      }
      if (!t && !img) { f.querySelector('.aviso').textContent = 'Escribe algo o añade una imagen.'; return; }
      const nueva = { at: Date.now() }; if (t) nueva.t = t; if (img) nueva.img = img;
      enviar([...lista(mia), nueva]);
    };
    return;
  }
  if (it.type === 'memory') {
    const re = el.querySelector('#rehacer');
    if (re) { re.onclick = () => { S.rehacer = true; S.key = ''; pintar(); }; return; }
    jugarMemory(el, it, v => { S.rehacer = false; enviar(v); });
    return;
  }
  if (it.type === 'search') { jugarSopa(el, it, mia, enviar); return; }
  if (POR_PARTES.includes(it.type)) {
    const f = el.querySelector('form');
    f.onclick = e => { const b = e.target.closest('[data-mover]'); if (b) moverOrden(b); };
    f.onsubmit = e => {
      e.preventDefault();
      const v = leerPartes(el, it);
      if (it.type !== 'order' && v.some(x => !x)) { f.querySelector('.aviso').textContent = it.type === 'match' ? 'Elige una pareja para cada elemento.' : it.type === 'label' ? 'Pon un nombre a cada número.' : 'Rellena todos los huecos.'; return; }
      enviar(v);
    };
  }
  if (it.type === 'draw') {
    const re = el.querySelector('#rehacer');
    if (re) { re.onclick = () => { S.rehacer = true; S.key = ''; pintar(); }; return; }
    const caja = el.querySelector('#caja');
    const lz = crearLienzo(caja);
    if (it.background) diapo(it.background).then(src => src && lz.fondo(src));
    el.querySelector('#herr').onclick = e => {
      const c = e.target.closest('[data-color]');
      if (c) { lz.color = c.dataset.color; el.querySelectorAll('.color').forEach(x => x.classList.toggle('activo', x === c)); }
      const g = e.target.closest('[data-grosor]'); if (g) lz.grosor = Number(g.dataset.grosor);
      if (e.target.closest('#deshacer')) lz.deshacer();
      if (e.target.closest('#borrar')) lz.borrar();
    };
    el.querySelector('#enviar-dibujo').onclick = () => {
      if (lz.vacio()) { el.querySelector('#aviso-d').textContent = 'Dibuja algo antes de enviarlo.'; return; }
      S.rehacer = false;
      enviar(lz.exportar());
    };
  }
}

function resultadoAlumno(it, st, mia, tieneMia) {
  let html = '';
  if (it.type === 'quiz') {
    const counts = st.results?.counts || [];
    const total = counts.reduce((a, b) => a + b, 0);
    html += `<ul class="barras">${(it.options || []).map((o, i) => {
      const p = total ? Math.round((counts[i] || 0) * 100 / total) : 0;
      const ok = !it.poll && i === Number(it.correct);
      const yo = tieneMia && Number(mia) === i;
      return `<li class="barra-op ${ok ? 'correcta' : ''} ${yo ? 'mia' : ''}"><span class="op-texto">${rico(o)}${ok ? ' <span class="marca-ok">correcta</span>' : ''}${yo ? ' <span class="marca-yo">tu respuesta</span>' : ''}</span><span class="op-n">${p}%</span><span class="op-barra"><span style="width:${p}%"></span></span></li>`;
    }).join('')}</ul>`;
  } else if (it.type === 'number') {
    html += `<p class="solucion">Solución: <strong>${esc(solucionTexto(it, S.uid))}</strong></p>`;
  } else if (it.type === 'short' && esCorregible(it)) {
    html += `<p class="solucion">Respuestas válidas: <strong>${esc(String(it.accepted).split(';').map(s => s.trim()).filter(Boolean).join(', '))}</strong></p>`;
  } else if (it.type === 'draw') {
    html += `<p class="estado-act">Tu profesor/a está comentando los dibujos en la pizarra.</p>`;
  } else if (it.type === 'photo') {
    return tieneMia ? `<img class="dibujo-enviado" src="${esc(mia.img)}" alt="Tu imagen"><p class="estado-act">Tu profesor/a está comentando las imágenes en la pizarra.</p>` : `<p class="estado-act">No enviaste imagen.</p>`;
  } else if (it.type === 'wall') {
    const posts = st.results?.posts || [];
    return `<p class="estado-act">El muro de la clase${posts.length ? '' : ' aún está vacío'}. Las imágenes se ven en la pizarra.</p>
      <div class="muro">${posts.map(p => `<figure class="nota"><p>${rico(p.t)}</p>${p.a ? `<figcaption>${esc(p.a)}</figcaption>` : ''}</figure>`).join('')}</div>`;
  } else if (it.type === 'memory') {
    return `${tieneMia && mia?.hecho ? `<p class="tu-resp ok">Lo completaste en <strong>${mia.intentos} intentos</strong>.</p>` : `<p class="estado-act">No llegaste a completarlo.</p>`}
      <p class="tipo">Las parejas</p><ul class="parejas">${(it.pairs || []).map(p => `<li><span class="pareja-izq">${rico(p[0])}</span><span class="pareja-flecha" aria-hidden="true">→</span><span>${rico(p[1])}</span></li>`).join('')}</ul>`;
  } else if (it.type === 'search') {
    const n = (it.words || []).length, h = lista(mia).length;
    return pintarSopa(it, mia, { conSolucion: true }) + `<p class="tu-resp ${h === n ? 'ok' : 'mal'}"><strong>${h} de ${n}</strong> palabras encontradas.${h < n ? ' Las que te faltaban están marcadas con borde.' : ' ¡Muy bien!'}</p>`;
  } else if (POR_PARTES.includes(it.type)) {
    if (!tieneMia) return `<p class="estado-act">No enviaste respuesta.</p>`;
    const ok = aciertosPorParte(it, mia), n = ok.filter(Boolean).length;
    return pintarPartes(it, mia) + `<p class="tu-resp ${n === ok.length ? 'ok' : 'mal'}"><strong>${n} de ${ok.length}</strong> ${n === ok.length ? 'correctas. ¡Muy bien!' : 'correctas. Debajo de cada fallo tienes la respuesta buena.'}</p>`;
  }
  if (it.type !== 'quiz' && it.type !== 'draw') {
    if (tieneMia) {
      const ok = comprobar(it, mia, S.uid);
      html += `<p class="tu-resp ${ok === true ? 'ok' : ok === false ? 'mal' : ''}">Tu respuesta: <strong>${respuestaHTML(it, mia)}</strong>${ok === true ? '. Correcta.' : ok === false ? '. Revísala con la solución.' : ''}</p>`;
    } else html += `<p class="estado-act">No enviaste respuesta.</p>`;
  }
  return html;
}

// ── Lienzo de dibujo ─────────────────────────────────────────────
function crearLienzo(caja) {
  const cv = document.createElement('canvas');
  cv.className = 'lienzo';
  caja.appendChild(cv);
  const ctx = cv.getContext('2d');
  const trazos = [];
  let actual = null, img = null, ratio = 4 / 3, ancho = 0;
  const api = { color: '#1E293B', grosor: 3 };

  function dibujar(c = ctx, W = cv.clientWidth, H = cv.clientHeight) {
    c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
    if (img) c.drawImage(img, 0, 0, W, H);
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const t of trazos) {
      c.strokeStyle = t.c; c.lineWidth = t.g * W / 600;
      c.beginPath();
      t.p.forEach(([x, y], i) => i ? c.lineTo(x * W, y * H) : c.moveTo(x * W, y * H));
      if (t.p.length === 1) c.lineTo(t.p[0][0] * W + 0.5, t.p[0][1] * H);
      c.stroke();
    }
  }
  function medir() {
    const w = caja.clientWidth;
    if (!w) return;
    ancho = w;
    const h = w / ratio, dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dibujar();
  }
  const punto = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); actual = { c: api.color, g: api.grosor, p: [punto(e)] }; trazos.push(actual); dibujar(); });
  cv.addEventListener('pointermove', e => { if (!actual) return; actual.p.push(punto(e)); dibujar(); });
  const fin = () => { actual = null; };
  cv.addEventListener('pointerup', fin); cv.addEventListener('pointercancel', fin);
  new ResizeObserver(() => { if (caja.clientWidth !== ancho) medir(); }).observe(caja);
  medir();

  return Object.assign(api, {
    fondo(src) { img = new Image(); img.onload = () => { ratio = img.naturalWidth / img.naturalHeight; medir(); }; img.src = src; },
    deshacer() { trazos.pop(); dibujar(); },
    borrar() { trazos.length = 0; dibujar(); },
    vacio: () => trazos.length === 0,
    exportar() {
      const W = 900, H = Math.round(900 / ratio);
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      dibujar(c.getContext('2d'), W, H);
      return c.toDataURL('image/jpeg', 0.72);
    }
  });
}

// ── Arranque ─────────────────────────────────────────────────────
if (!configurado) {
  app.innerHTML = `<div class="mcr-acceso"><section class="entrada mcr-acceso__tarjeta"><h1>Falta configurar la aplicación</h1><p>Tu profesor/a todavía no ha conectado esta web con su base de datos.</p></section></div>`;
} else {
  onAuthStateChanged(auth, async u => {
    if (S.code || S.invitado) return; // ya está dentro de una clase o entrando sin cuenta
    if (u?.isAnonymous) return pantallaEntrada();
    if (u && !dominioOk(u)) {
      await signOut(auth);
      return pantallaEntrada(`Esa cuenta no es del colegio. Entra con tu cuenta @${DOMINIO_ALUMNADO}.`);
    }
    pantallaEntrada();
  });
}
