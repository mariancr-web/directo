// Editor visual de actividades (al estilo LearningApps): formulario por tipo a la izquierda
// y, a la derecha, la actividad tal como la ve un alumno, para probarla.
// Solo depende de lib.js: lo usan Clase en directo y el libro de actividades.
import {
  esc, rico, conDatos, TIPOS, nombreTipo, itemPublico, comprobar, esCorregible, solucionTexto, nuevoId, parseNum, evaluar,
  valores, tieneVariantes, fmtNum, POR_PARTES, pintarPartes, leerPartes, moverOrden, aciertosPorParte, solucionesHuecos,
  filasTabla, alternativas, generarSopa, normSopa, pintarSopa, jugarMemory, jugarSopa, reducirImagen, MAX_MURO
} from './lib.js';

export const DESCRIPCION = {
  quiz: 'Eligen una opción. Puede ser una encuesta, sin respuesta correcta',
  short: 'Escriben una respuesta corta',
  number: 'Dan un resultado numérico, con unidad y tolerancia',
  gaps: 'Completan las palabras que faltan en un texto',
  match: 'Unen cada elemento con su pareja',
  order: 'Ponen pasos o elementos en orden',
  table: 'Rellenan las casillas vacías de una tabla',
  label: 'Ponen nombre a las partes numeradas de una imagen',
  memory: 'Dan la vuelta a las cartas hasta encontrar las parejas',
  search: 'Buscan palabras en una sopa de letras',
  draw: 'Dibujan en blanco o sobre una diapositiva',
  photo: 'Suben una foto con un comentario',
  wall: 'Todos publican textos o imágenes en un muro común'
};

export const GRUPOS_TIPOS = [
  ['Preguntas', ['quiz', 'short', 'number']],
  ['Completar y relacionar', ['gaps', 'match', 'order', 'table', 'label']],
  ['Juegos', ['memory', 'search']],
  ['Crear y compartir', ['draw', 'photo', 'wall']]
];

// Iconos sencillos (trazo de 2 px, 24 × 24)
const P = d => `<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const ICONOS = {
  quiz: P('<circle cx="6" cy="6" r="2"/><circle cx="6" cy="12" r="2" fill="currentColor"/><circle cx="6" cy="18" r="2"/><path d="M11 6h9M11 12h9M11 18h9"/>'),
  short: P('<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 12h6"/>'),
  number: P('<path d="M4 9h16M4 15h16M10 4 8 20M16 4l-2 16"/>'),
  gaps: P('<path d="M3 8h5M12 8h9M3 16h9"/><rect x="14" y="13" width="7" height="6" rx="1" stroke-dasharray="2 2"/>'),
  match: P('<circle cx="5" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 6l10 12M7 18 17 6"/>'),
  order: P('<path d="M8 6h12M8 12h12M8 18h12"/><path d="M3 5l1-1v4M3 11h2l-2 3h2M3 17h2v4H3"/>'),
  table: P('<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 10h18M3 15h18M10 4v16"/>'),
  label: P('<rect x="3" y="4" width="18" height="16" rx="1"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>'),
  memory: P('<rect x="3" y="5" width="8" height="14" rx="1"/><rect x="13" y="5" width="8" height="14" rx="1"/><path d="M17 10v4M15 12h4"/>'),
  search: P('<path d="M4 4h16v16H4zM4 9h16M4 14h16M9 4v16M14 4v16"/>'),
  draw: P('<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>'),
  photo: P('<path d="M4 7h3l2-2h6l2 2h3v12H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  wall: P('<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="5" rx="1"/><rect x="13" y="10" width="8" height="11" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/>'),
  link: P('<path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1"/><path d="M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"/>'),
  banco: P('<path d="M4 7h16v13H4zM8 7V4h8v3M9 12h6"/>')
};

// Tarjetas para elegir el tipo. extra: [{ id, nombre, descripcion, icono }] (por ejemplo, Enlace o Desde el banco)
export function tarjetasTipos(extra = []) {
  const tarjeta = (attr, icono, nombre, desc) => `<button type="button" class="tipo-tarjeta" ${attr}><span class="tipo-icono">${icono}</span><strong>${esc(nombre)}</strong><span>${esc(desc)}</span></button>`;
  return GRUPOS_TIPOS.map(([g, ts]) => `<section class="grupo-tipos"><h3>${esc(g)}</h3><div class="tipos-rejilla">${ts.map(t => tarjeta(`data-t="${t}"`, ICONOS[t], TIPOS[t], DESCRIPCION[t])).join('')}</div></section>`).join('')
    + (extra.length ? `<section class="grupo-tipos"><h3>Otras opciones</h3><div class="tipos-rejilla">${extra.map(x => tarjeta(`data-extra="${x.id}"`, ICONOS[x.icono] || '', x.nombre, x.descripcion)).join('')}</div></section>` : '');
}

// Ejemplos para empezar
const ATOMO = 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="#fff"/><ellipse cx="200" cy="150" rx="150" ry="60" fill="none" stroke="#475569" stroke-width="3"/><ellipse cx="200" cy="150" rx="150" ry="60" fill="none" stroke="#475569" stroke-width="3" transform="rotate(60 200 150)"/><ellipse cx="200" cy="150" rx="150" ry="60" fill="none" stroke="#475569" stroke-width="3" transform="rotate(-60 200 150)"/><circle cx="190" cy="145" r="14" fill="#E11D48"/><circle cx="210" cy="145" r="14" fill="#2563EB"/><circle cx="200" cy="162" r="14" fill="#E11D48"/><circle cx="350" cy="150" r="9" fill="#10B981"/><circle cx="125" cy="85" r="9" fill="#10B981"/><circle cx="125" cy="215" r="9" fill="#10B981"/></svg>`);
export const EJEMPLOS = {
  quiz: { prompt: '¿Cuál es la fórmula del metano?', options: ['$\\ce{CH4}$', '$\\ce{C2H6}$', '$\\ce{CO2}$'], correct: 0, poll: false },
  short: { prompt: '¿Cómo se llama el paso de líquido a gas?', accepted: 'vaporización; evaporación; ebullición' },
  number: { prompt: 'Un coche recorre {{d}} m en {{t}} s. ¿Cuál es su velocidad media?', vars: [{ name: 'd', min: 100, max: 500, step: 10 }, { name: 't', min: 10, max: 40, step: 1 }], formula: 'd/t', tolerance: 2, unit: 'm/s', unitMode: 'show' },
  gaps: { prompt: 'Completa el texto.', text: 'El agua hierve a [[100]] °C y se congela a [[0]] °C. El paso de sólido a líquido se llama [[fusión]].', caseSensitive: false },
  match: { prompt: 'Une cada fórmula con su nombre.', pairs: [['$\\ce{CH4}$', 'metano'], ['$\\ce{C2H6}$', 'etano'], ['$\\ce{C2H4}$', 'eteno'], ['$\\ce{C2H2}$', 'etino']] },
  order: { prompt: 'Ordena de menor a mayor tamaño.', steps: ['átomo', 'molécula', 'célula', 'tejido', 'órgano'] },
  table: { prompt: 'Completa la tabla de las partículas del átomo.', table: 'Partícula | Carga | Masa relativa\nProtón | [[+1|positiva]] | 1\nNeutrón | [[0|neutra|sin carga]] | 1\nElectrón | [[-1|negativa]] | casi 0', caseSensitive: false },
  label: { prompt: 'Identifica las partes del átomo.', image: ATOMO, points: [{ x: 50, y: 50, t: 'núcleo' }, { x: 87.5, y: 50, t: 'electrón' }, { x: 69, y: 28, t: 'órbita|corteza' }], write: false },
  memory: { prompt: 'Encuentra cada elemento con su símbolo.', pairs: [['Na', 'sodio'], ['K', 'potasio'], ['Fe', 'hierro'], ['Ca', 'calcio'], ['Cu', 'cobre'], ['Ag', 'plata']] },
  search: { prompt: 'Busca seis elementos químicos.', words: ['carbono', 'hidrógeno', 'oxígeno', 'nitrógeno', 'azufre', 'fósforo'], reverse: false },
  draw: { prompt: 'Dibuja el modelo atómico de Bohr del átomo de litio.' },
  photo: { prompt: 'Fotografía un ejemplo de cambio químico en tu casa y explica por qué lo es.' },
  wall: { prompt: '¿Dónde encuentras la química en tu vida diaria?', images: true, names: false }
};

// Atajos para escribir fórmulas. ‸ marca dónde queda el cursor
const ATAJOS = [
  ['Fórmula', '$‸$'], ['Química', '$\\ce{‸}$'], ['Fracción', '$\\frac{‸}{}$'], ['Potencia', '$x^{‸}$'],
  ['Subíndice', '$x_{‸}$'], ['·10ⁿ', '$\\cdot 10^{‸}$'], ['Reacción', '$\\ce{‸ -> }$'], ['Equilibrio', '$\\ce{‸ <=> }$']
];

// Campos de cada tipo: se rehacen al guardar (el resto, como tema, ancla o bankId, se conservan)
const CAMPOS = ['prompt', 'options', 'correct', 'poll', 'accepted', 'answer', 'formula', 'vars', 'tolerance', 'unit', 'unitMode', 'text', 'table', 'caseSensitive',
  'pairs', 'steps', 'images', 'names', 'background', 'image', 'points', 'write', 'words', 'clues', 'reverse', 'grid', 'placed', 'ancla'];

// ── Listas de filas (parejas, opciones, elementos…) ─────────────
function filaHTML(cols, vals = [], { radio = null, mover = false } = {}) {
  return `<div class="ed-fila">${radio !== null ? `<label class="ed-correcta" title="Respuesta correcta"><input type="radio" name="ed-correcta" ${radio ? 'checked' : ''} aria-label="Marcar como correcta"></label>` : '<span class="ed-num" aria-hidden="true"></span>'}
    ${cols.map((c, k) => `<input class="ed-celda" data-c="${k}" value="${esc(vals[k] ?? '')}" placeholder="${esc(c)}" aria-label="${esc(c)}" spellcheck="false" data-formula>`).join('')}
    ${mover ? '<button type="button" class="btn-ico" data-subir aria-label="Subir">↑</button><button type="button" class="btn-ico" data-bajar aria-label="Bajar">↓</button>' : ''}
    <button type="button" class="btn-ico" data-quitar aria-label="Quitar">×</button></div>`;
}
function listaHTML(id, cols, filas, { anadir, radio = false, correcta = -1, mover = false, flecha = false } = {}) {
  return `<div class="ed-lista ${flecha ? 'con-flecha' : ''}" id="${id}" data-cols="${esc(JSON.stringify(cols))}" data-radio="${radio}" data-mover="${mover}">
    ${filas.map((f, i) => filaHTML(cols, f, { radio: radio ? i === correcta : null, mover })).join('')}</div>
    <button type="button" class="btn peq ed-anadir" data-anadir="${id}">+ ${esc(anadir)}</button>`;
}
const leerLista = (raiz, id) => [...raiz.querySelectorAll(`#${id} .ed-fila`)].map(f => ({
  vals: [...f.querySelectorAll('.ed-celda')].map(i => i.value.trim()),
  marcada: !!f.querySelector('input[type=radio]')?.checked
}));

// ── Tabla editable ──────────────────────────────────────────────
function tablaDesdeTexto(t) {
  const filas = filasTabla(t);
  if (!filas.length) return [['', ''], ['', '']].map(f => f.map(v => ({ v, h: false })));
  const n = Math.max(...filas.map(f => f.length));
  return filas.map(f => Array.from({ length: n }, (_, k) => {
    const c = f[k] ?? '', m = c.match(/^\[\[(.*)\]\]$/);
    return m ? { v: alternativas(m[1]).join('; '), h: true } : { v: c, h: false };
  }));
}
function tablaHTML(celdas) {
  return `<div class="tabla-scroll"><table class="ed-tabla"><tbody>${celdas.map((f, r) => `<tr>${f.map((c, k) => `<td class="${r === 0 ? 'cab' : c.h ? 'hueco-sel' : ''}">
    <input class="ed-tc" data-r="${r}" data-k="${k}" value="${esc(c.v)}" placeholder="${r === 0 ? 'Título' : c.h ? 'Respuesta' : 'Texto'}" spellcheck="false" data-formula>
    ${r === 0 ? '' : `<label class="ed-h" title="La completa el alumnado"><input type="checkbox" data-hr="${r}" data-hk="${k}" ${c.h ? 'checked' : ''}> hueco</label>`}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <div class="ed-tabla-acc"><button type="button" class="btn peq" data-tabla="+f">+ Fila</button><button type="button" class="btn peq" data-tabla="+c">+ Columna</button>
      <button type="button" class="btn peq" data-tabla="-f">− Fila</button><button type="button" class="btn peq" data-tabla="-c">− Columna</button></div>`;
}

// ── Editor ──────────────────────────────────────────────────────
// raiz: elemento donde se pinta. base: actividad ({ type, … }). Devuelve { leer, probar }.
// opciones: paginas (números de diapositiva), diapos ({página: imagen}), extra (HTML al final del formulario), conAncla (casilla «Apartado»)
export function crearEditor(destino, base, opciones = {}) {
  const t = base.type;
  // Contenedor nuevo cada vez, para no acumular escuchadores al rellenar con un ejemplo
  const raiz = document.createElement('div');
  raiz.className = 'ed-raiz';
  destino.replaceChildren(raiz);
  const { paginas = [], diapos = null, extra = '', conAncla = true } = opciones;
  let ultimoCampo = null;
  const q = s => raiz.querySelector(s);
  const vacio = !base.prompt;

  const casillaMayus = `<label class="check"><input type="checkbox" id="mayus" ${base.caseSensitive ? 'checked' : ''}> Distinguir mayúsculas (por ejemplo, en fórmulas: CO no es Co)</label>`;
  let campos = '';
  if (t === 'quiz') {
    const ops = base.options?.length ? base.options : ['', '', ''];
    campos = `<div class="ed-bloque"><p class="ed-titulo">Opciones <span class="meta">(marca la correcta con el círculo)</span></p>
      ${listaHTML('ops', ['Opción'], ops.map(o => [o]), { anadir: 'Añadir opción', radio: true, correcta: base.poll ? -1 : Number(base.correct ?? 0) })}
      <label class="check"><input type="checkbox" id="encuesta" ${base.poll ? 'checked' : ''}> Es una encuesta: no hay respuesta correcta</label></div>`;
  }
  if (t === 'short') {
    const acc = String(base.accepted || '').split(';').map(x => x.trim()).filter(Boolean);
    campos = `<div class="ed-bloque"><p class="ed-titulo">Respuestas que se dan por buenas <span class="meta">(opcional)</span></p>
      ${listaHTML('acc', ['Respuesta válida'], (acc.length ? acc : ['']).map(a => [a]), { anadir: 'Añadir otra respuesta válida' })}
      <p class="ayuda">No se tienen en cuenta mayúsculas ni tildes. Si no pones ninguna, las corriges tú.</p></div>`;
  }
  if (t === 'number') {
    const vars = base.vars || [];
    campos = `<div class="ed-bloque"><p class="ed-titulo">Solución</p>
      <div class="rejilla-3">
        <label>Resultado<input id="sol" value="${esc(base.formula ?? (base.answer != null ? fmtNum(Number(base.answer), 10) : ''))}" placeholder="9,8 o d/t" spellcheck="false"></label>
        <label>Margen de error (%)<input id="tol" type="number" min="0" max="100" step="0.5" value="${esc(base.tolerance ?? 2)}"></label>
        <label>Unidad<input id="uni" value="${esc(base.unit || '')}" placeholder="m/s"></label></div>
      <label class="check"><input type="checkbox" id="pedir" ${base.unitMode === 'ask' ? 'checked' : ''}> Tienen que escribir la unidad (si no, la ven junto a la casilla)</label></div>
      <div class="ed-bloque"><p class="ed-titulo">Datos distintos para cada alumno <span class="meta">(opcional)</span></p>
      <p class="ayuda">Pon <code>{{d}}</code> en el enunciado donde quieras el dato <code>d</code> y usa <code>d</code> en el resultado (por ejemplo, <code>d/t</code>).</p>
      ${listaHTML('datos', ['Nombre', 'Mínimo', 'Máximo', 'Paso'], vars.map(v => [v.name, fmtNum(Number(v.min), 6), fmtNum(Number(v.max), 6), v.step ? fmtNum(Number(v.step), 6) : '']), { anadir: 'Añadir dato' })}</div>`;
  }
  if (t === 'gaps') {
    campos = `<div class="ed-bloque"><p class="ed-titulo">Texto</p>
      <p class="ayuda">Escribe o pega el texto. Después <strong>haz doble clic en una palabra</strong> (o selecciona varias) y pulsa «Hacer hueco».</p>
      <div class="ed-barra"><button type="button" class="btn peq primario" id="hacer-hueco">Hacer hueco</button><button type="button" class="btn peq" id="quitar-hueco">Quitar hueco</button></div>
      <textarea id="texto" rows="6" spellcheck="false" data-formula>${esc(base.text || '')}</textarea>
      <div id="huecos"></div></div>${casillaMayus}`;
  }
  if (t === 'match' || t === 'memory') {
    const pares = base.pairs?.length ? base.pairs : [['', ''], ['', ''], ['', '']];
    campos = `<div class="ed-bloque"><p class="ed-titulo">${t === 'match' ? 'Parejas' : 'Parejas de cartas'} <span class="meta">(${t === 'memory' ? 'de 2 a 10' : 'al alumnado se le desordena la columna derecha'})</span></p>
      ${listaHTML('pares', ['Elemento', 'Su pareja'], pares, { anadir: 'Añadir pareja', flecha: true })}</div>`;
  }
  if (t === 'order') {
    const pasos = base.steps?.length ? base.steps : ['', '', ''];
    campos = `<div class="ed-bloque"><p class="ed-titulo">Elementos en el orden correcto <span class="meta">(se desordenan solos)</span></p>
      ${listaHTML('pasos', ['Elemento'], pasos.map(x => [x]), { anadir: 'Añadir elemento', mover: true })}</div>`;
  }
  if (t === 'table') {
    campos = `<div class="ed-bloque"><p class="ed-titulo">Tabla</p>
      <p class="ayuda">La primera fila son los títulos. Marca «hueco» en las casillas que tiene que completar el alumnado. Si valen varias respuestas, sepáralas con punto y coma.</p>
      <div id="tabla"></div></div>${casillaMayus}`;
  }
  if (t === 'search') {
    const ws = base.words?.length ? base.words.map((w, i) => [w, base.clues?.[i] || '']) : [['', ''], ['', ''], ['', '']];
    campos = `<div class="ed-bloque"><p class="ed-titulo">Palabras <span class="meta">(de 3 a 14 letras; las tildes se quitan)</span></p>
      ${listaHTML('palabras', ['Palabra', 'Pista (opcional)'], ws, { anadir: 'Añadir palabra' })}
      <p class="ayuda">Si escribes pistas, el alumnado ve las pistas en lugar de las palabras.</p>
      <label class="check"><input type="checkbox" id="inversas" ${base.reverse ? 'checked' : ''}> Más difícil: también palabras al revés</label>
      <button type="button" class="btn peq" id="otra-sopa">Colocar las palabras de otra forma</button></div>`;
  }
  if (t === 'label') {
    const pags = diapos ? paginas.filter(p => diapos[p]) : [];
    campos = `<div class="ed-bloque"><p class="ed-titulo">Imagen</p>
      <div class="fila-botones">${pags.length ? `<label>Usar una diapositiva<select id="fondo-et"><option value="">Elige…</option>${pags.map(p => `<option value="${p}">Diapositiva ${p}</option>`).join('')}</select></label>` : ''}
        <label class="btn">Subir una imagen<input type="file" id="img-et" accept="image/*" hidden></label></div>
      <div class="img-etiquetas editor-etiquetas" id="lienzo-et"></div>
      <p class="ayuda" id="ayuda-et"></p>
      <ol class="lista-etiquetas" id="puntos-et"></ol></div>
      <label class="check"><input type="checkbox" id="escribir" ${base.write ? 'checked' : ''}> Que escriban el nombre (si no, lo eligen de una lista)</label>
      <span class="ayuda">Si escriben, puedes aceptar varias respuestas separándolas con punto y coma.</span>${casillaMayus}`;
  }
  if (t === 'wall') {
    campos = `<div class="ed-bloque"><label class="check"><input type="checkbox" id="imgs" ${base.images !== false ? 'checked' : ''}> Pueden añadir una imagen a cada aportación</label>
      <label class="check"><input type="checkbox" id="nombres" ${base.names ? 'checked' : ''}> Mostrar el nombre de cada alumno en el muro (si no, es anónimo para la clase)</label>
      <p class="ayuda">Cada alumno puede publicar hasta ${MAX_MURO} aportaciones. Puedes ocultar cualquiera durante la clase.</p></div>`;
  }
  if (t === 'draw' && paginas.length) {
    campos = `<div class="ed-bloque"><label>Fondo<select id="fondo"><option value="">Lienzo en blanco</option>${paginas.map(p => `<option value="${p}" ${Number(base.background) === p ? 'selected' : ''}>Diapositiva ${p}</option>`).join('')}</select></label></div>`;
  }

  raiz.innerHTML = `<div class="ed">
    <div class="ed-form">
      ${vacio && EJEMPLOS[t] ? `<div class="ed-ejemplo"><span>¿Primera vez con este tipo?</span><button type="button" class="btn peq" id="ejemplo">Rellenar con un ejemplo</button></div>` : ''}
      <div class="ed-bloque"><label class="ed-titulo" for="enun">Enunciado</label>
        <textarea id="enun" rows="2" maxlength="1000" data-formula placeholder="Lo que verá el alumnado arriba de la actividad">${esc(base.prompt || '')}</textarea></div>
      <div class="ed-atajos" role="toolbar" aria-label="Insertar fórmulas"><span class="meta">Insertar:</span>${ATAJOS.map(([n, x]) => `<button type="button" class="btn peq" data-atajo="${esc(x)}">${esc(n)}</button>`).join('')}${t === 'number' ? '<button type="button" class="btn peq" data-atajo="{{‸}}">Dato</button>' : ''}
        <span class="ayuda">Las fórmulas van entre dólares: <code>$\\frac{d}{t}$</code>, <code>$\\ce{H2SO4}$</code>. En la prueba ves cómo quedan.</span></div>
      ${campos}
      ${conAncla ? `<details class="ed-mas" ${base.ancla ? 'open' : ''}><summary>Más opciones</summary>
        <label>Apartado de los apuntes <span class="meta">(opcional, para situarla en el libro)</span><input id="ancla" value="${esc(base.ancla || '')}" placeholder="2.1" maxlength="20"></label></details>` : ''}
      ${extra}
      <p class="aviso" id="ed-err" role="alert"></p>
    </div>
    <aside class="ed-prueba" aria-label="Prueba de la actividad">
      <div class="ed-prueba-cab"><span>Pruébala como un alumno</span><button type="button" class="btn peq" id="reiniciar">Empezar de nuevo</button></div>
      <div class="ed-prueba-cuerpo" id="prueba"></div>
    </aside></div>`;

  // Atajos de fórmulas: se insertan en el último campo usado
  raiz.addEventListener('focusin', e => { if (e.target.matches('[data-formula]')) ultimoCampo = e.target; });
  q('.ed-atajos').onclick = e => {
    const b = e.target.closest('[data-atajo]'); if (!b) return;
    const c = ultimoCampo || q('#enun');
    const [antes, despues] = b.dataset.atajo.split('‸');
    const i = c.selectionStart ?? c.value.length, j = c.selectionEnd ?? i;
    c.value = c.value.slice(0, i) + antes + c.value.slice(i, j) + despues + c.value.slice(j);
    c.focus(); c.setSelectionRange(i + antes.length, j + antes.length);
    c.dispatchEvent(new Event('input', { bubbles: true }));
  };

  // Listas: añadir, quitar, mover; Intro en la última casilla crea otra fila
  const nuevaFila = id => {
    const l = q('#' + id), cols = JSON.parse(l.dataset.cols);
    l.insertAdjacentHTML('beforeend', filaHTML(cols, [], { radio: l.dataset.radio === 'true' ? false : null, mover: l.dataset.mover === 'true' }));
    l.lastElementChild.querySelector('.ed-celda').focus();
    alCambiar();
  };
  raiz.addEventListener('click', e => {
    const an = e.target.closest('[data-anadir]'); if (an) return nuevaFila(an.dataset.anadir);
    const fila = e.target.closest('.ed-fila'); if (!fila) return;
    if (e.target.closest('[data-quitar]')) { if (fila.parentElement.children.length > 1) fila.remove(); else fila.querySelectorAll('.ed-celda').forEach(i => { i.value = ''; }); alCambiar(); }
    if (e.target.closest('[data-subir]') && fila.previousElementSibling) { fila.previousElementSibling.before(fila); alCambiar(); }
    if (e.target.closest('[data-bajar]') && fila.nextElementSibling) { fila.nextElementSibling.after(fila); alCambiar(); }
  });
  raiz.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !e.target.matches('.ed-celda')) return;
    e.preventDefault();
    const fila = e.target.closest('.ed-fila'), celdas = [...fila.querySelectorAll('.ed-celda')], k = celdas.indexOf(e.target);
    if (k < celdas.length - 1) return celdas[k + 1].focus();
    const sig = fila.nextElementSibling;
    if (sig) sig.querySelector('.ed-celda').focus(); else nuevaFila(fila.parentElement.id);
  });

  // Huecos: hacer y quitar huecos sobre la selección
  if (t === 'gaps') {
    const ta = q('#texto');
    const hacer = () => {
      let i = ta.selectionStart, j = ta.selectionEnd;
      const v = ta.value;
      while (i < j && /\s/.test(v[i])) i++;
      while (j > i && /\s|[.,;:!?)]/.test(v[j - 1])) j--;
      if (i === j) { q('#ed-err').textContent = 'Selecciona antes la palabra (doble clic sobre ella).'; return; }
      if (/\[\[|\]\]/.test(v.slice(i, j))) return;
      ta.value = v.slice(0, i) + '[[' + v.slice(i, j) + ']]' + v.slice(j);
      ta.setSelectionRange(j + 4, j + 4); ta.focus();
      q('#ed-err').textContent = '';
      pintarHuecos(); alCambiar();
    };
    q('#hacer-hueco').onclick = hacer;
    ta.addEventListener('dblclick', () => setTimeout(() => { if (ta.selectionEnd > ta.selectionStart && !/\[\[/.test(ta.value.slice(Math.max(0, ta.selectionStart - 2), ta.selectionStart))) hacer(); }, 0));
    q('#quitar-hueco').onclick = () => {
      const v = ta.value, c = ta.selectionStart;
      for (const m of v.matchAll(/\[\[(.*?)\]\]/g)) if (c >= m.index && c <= m.index + m[0].length) {
        const sol = alternativas(m[1])[0] || '';
        ta.value = v.slice(0, m.index) + sol + v.slice(m.index + m[0].length);
        pintarHuecos(); alCambiar(); return;
      }
      q('#ed-err').textContent = 'Pon el cursor dentro del hueco que quieres quitar.';
    };
    ta.addEventListener('input', () => pintarHuecos());
  }
  // Lista de huecos con las respuestas que también valen
  function pintarHuecos() {
    const sols = solucionesHuecos(q('#texto').value);
    q('#huecos').innerHTML = sols.length ? `<p class="ed-titulo">Huecos</p><ol class="ed-huecos">${sols.map((a, i) => `<li><span class="hueco-sol">${esc(a[0] || '—')}</span>
      <input class="ed-alt" data-i="${i}" value="${esc(a.slice(1).join('; '))}" placeholder="También vale… (separa con ;)"></li>`).join('')}</ol>` : '';
  }
  if (t === 'gaps') {
    pintarHuecos();
    q('#huecos').addEventListener('input', e => {
      if (!e.target.matches('.ed-alt')) return;
      const n = Number(e.target.dataset.i); let k = 0;
      const alts = e.target.value.split(';').map(x => x.trim()).filter(Boolean);
      q('#texto').value = q('#texto').value.replace(/\[\[(.*?)\]\]/g, (m, x) => k++ === n ? `[[${[alternativas(x)[0] || '', ...alts].join('|')}]]` : m);
    });
  }

  // Tabla
  let celdas = t === 'table' ? tablaDesdeTexto(base.table) : [];
  const pintarTabla = () => { q('#tabla').innerHTML = tablaHTML(celdas); };
  if (t === 'table') {
    pintarTabla();
    q('#tabla').addEventListener('input', e => { const i = e.target; if (i.matches('.ed-tc')) celdas[i.dataset.r][i.dataset.k].v = i.value; });
    q('#tabla').addEventListener('change', e => { const i = e.target; if (i.dataset.hr) { celdas[i.dataset.hr][i.dataset.hk].h = i.checked; i.closest('td').classList.toggle('hueco-sel', i.checked); i.closest('td').querySelector('.ed-tc').placeholder = i.checked ? 'Respuesta' : 'Texto'; alCambiar(); } });
    q('#tabla').addEventListener('click', e => {
      const b = e.target.closest('[data-tabla]'); if (!b) return;
      const n = celdas[0].length, a = b.dataset.tabla;
      if (a === '+f') celdas.push(Array.from({ length: n }, () => ({ v: '', h: false })));
      if (a === '+c' && n < 8) celdas.forEach(f => f.push({ v: '', h: false }));
      if (a === '-f' && celdas.length > 2) celdas.pop();
      if (a === '-c' && n > 1) celdas.forEach(f => f.pop());
      pintarTabla(); alCambiar();
    });
  }

  // Identificar en imagen: pulsar sobre la imagen para numerar las partes
  let imgEt = base.image || '';
  const puntos = (base.points || []).map(p => ({ ...p, t: alternativas(p.t).join('; ') }));
  const pintarEt = () => {
    q('#lienzo-et').innerHTML = imgEt
      ? `<img src="${esc(imgEt)}" alt="Imagen de la actividad">${puntos.map((p, i) => `<span class="marca-img" style="left:${p.x}%;top:${p.y}%">${i + 1}</span>`).join('')}`
      : '<p class="vacio">Elige una diapositiva o sube una imagen.</p>';
    q('#ayuda-et').textContent = imgEt ? 'Pulsa sobre la imagen en cada parte que deban identificar y escribe debajo su nombre.' : '';
    q('#puntos-et').innerHTML = puntos.map((p, i) => `<li><span class="marca-num">${i + 1}</span><input class="et-txt" data-i="${i}" value="${esc(p.t || '')}" placeholder="Nombre de la parte ${i + 1}" maxlength="120" data-formula><button type="button" class="btn-ico" data-quitar-et="${i}" aria-label="Quitar la parte ${i + 1}">×</button></li>`).join('');
  };
  if (t === 'label') {
    pintarEt();
    q('#lienzo-et').onclick = e => {
      const img = q('#lienzo-et img'); if (!img) return;
      const r = img.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
      if (puntos.length >= 15) { q('#ed-err').textContent = 'Como mucho, 15 partes por imagen.'; return; }
      puntos.push({ x: Math.round((e.clientX - r.left) * 1000 / r.width) / 10, y: Math.round((e.clientY - r.top) * 1000 / r.height) / 10, t: '' });
      pintarEt(); q(`.et-txt[data-i="${puntos.length - 1}"]`).focus(); alCambiar();
    };
    q('#puntos-et').oninput = e => { const i = e.target.dataset.i; if (i != null) puntos[i].t = e.target.value; };
    q('#puntos-et').onclick = e => { const b = e.target.closest('[data-quitar-et]'); if (b) { puntos.splice(Number(b.dataset.quitarEt), 1); pintarEt(); alCambiar(); } };
    const fs = q('#fondo-et');
    if (fs) fs.onchange = () => { if (fs.value) { imgEt = diapos[fs.value]; pintarEt(); alCambiar(); } };
    q('#img-et').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try { imgEt = await reducirImagen(f, 1280, 0.75); if (fs) fs.value = ''; pintarEt(); alCambiar(); }
      catch (err) { console.error(err); q('#ed-err').textContent = 'No se ha podido leer esa imagen.'; }
    };
  }

  // Sopa de letras: se genera cuando cambian las palabras y se conserva
  let sopa = base.grid ? { clave: JSON.stringify([(base.words || []).map(normSopa), !!base.reverse]), grid: base.grid, placed: base.placed } : null;
  if (t === 'search') q('#otra-sopa').onclick = () => { sopa = null; alCambiar(); };

  // Ejemplo
  const ej = q('#ejemplo');
  if (ej) ej.onclick = () => { const c = crearEditor(destino, { ...base, ...EJEMPLOS[t], type: t }, opciones); Object.assign(api, c); };

  // Lee el formulario. Devuelve { out } o { out, error }
  function leer() {
    const prompt = q('#enun').value.trim();
    const out = { ...base };
    for (const k of CAMPOS) delete out[k];
    out.id = base.id || nuevoId(); out.type = t; out.prompt = prompt;
    const ancla = q('#ancla')?.value.trim(); if (ancla) out.ancla = ancla;
    const err = error => ({ out, error });
    if (!prompt) return err('Escribe el enunciado.');
    if (t === 'quiz') {
      const filas = leerLista(raiz, 'ops').filter(f => f.vals[0] || f.marcada);
      out.options = filas.map(f => f.vals[0]);
      out.poll = q('#encuesta').checked;
      if (out.options.length < 2) return err('Escribe al menos dos opciones.');
      if (out.options.length > 8) return err('Como mucho, ocho opciones.');
      if (out.options.some(o => !o)) return err('Hay una opción marcada sin texto.');
      if (!out.poll) {
        const c = filas.findIndex(f => f.marcada);
        if (c < 0) return err('Marca la opción correcta con el círculo, o indica que es una encuesta.');
        out.correct = c;
      }
    }
    if (t === 'short') { const a = leerLista(raiz, 'acc').map(f => f.vals[0]).filter(Boolean); if (a.length) out.accepted = a.join('; '); }
    if (t === 'number') {
      out.tolerance = Math.max(0, Number(q('#tol').value) || 0);
      const u = q('#uni').value.trim(); if (u) out.unit = u;
      out.unitMode = q('#pedir').checked && u ? 'ask' : 'show';
      const vars = [];
      for (const { vals: [name, min, max, step] } of leerLista(raiz, 'datos')) {
        if (!name && !min && !max) continue;
        if (!/^[A-Za-z_][A-Za-z_0-9]*$/.test(name)) return err(`El nombre del dato «${name}» solo puede llevar letras sin tilde, números y _, y empezar por letra.`);
        if (['pi', 'e', 'sqrt', 'raiz', 'log', 'ln', 'exp', 'sin', 'cos', 'tan', 'abs'].includes(name)) return err(`«${name}» está reservado; usa otro nombre para el dato.`);
        if (vars.some(v => v.name === name)) return err(`El dato «${name}» está repetido.`);
        const v = { name, min: parseNum(min), max: parseNum(max) };
        if (Number.isNaN(v.min) || Number.isNaN(v.max)) return err(`Indica el mínimo y el máximo del dato «${name}».`);
        if (v.min > v.max) [v.min, v.max] = [v.max, v.min];
        if (step) { v.step = parseNum(step); if (!(v.step > 0)) return err(`El paso del dato «${name}» debe ser un número positivo.`); }
        vars.push(v);
      }
      const sol = q('#sol').value.trim();
      if (!sol) return err('Escribe el resultado.');
      if (vars.length) {
        out.vars = vars; out.formula = sol;
        try { const x = evaluar(sol, valores(out, 'prueba')); if (!Number.isFinite(x)) return err('Con estos datos el resultado no da un número (¿división por cero?).'); }
        catch (e) { return err(e.message); }
        const sinUsar = vars.filter(v => !new RegExp(`\\{\\{\\s*${v.name}\\s*\\}\\}`).test(prompt));
        if (sinUsar.length) return err(`Pon ${sinUsar.map(v => `{{${v.name}}}`).join(', ')} en el enunciado para que el alumnado vea ese dato.`);
      } else {
        let x = parseNum(sol);
        if (Number.isNaN(x)) { try { x = evaluar(sol); } catch { x = NaN; } }
        if (!Number.isFinite(x)) return err('El resultado debe ser un número (puedes usar coma decimal y 3e4 o 3·10^4). Para usar una fórmula, añade antes los datos.');
        out.answer = x;
      }
    }
    if (t === 'gaps') {
      out.text = q('#texto').value.replace(/\r/g, '').trim();
      out.caseSensitive = q('#mayus').checked;
      const sols = solucionesHuecos(out.text);
      if (!out.text) return err('Escribe el texto.');
      if (!sols.length) return err('Haz al menos un hueco: doble clic en una palabra y «Hacer hueco».');
      if (sols.some(x => !x.length)) return err('Hay un hueco vacío.');
    }
    if (t === 'table') {
      out.table = celdas.map(f => f.map(c => {
        const v = c.v.trim();
        if (!c.h) return v.replace(/\|/g, '/');
        const alts = v.split(';').map(x => x.trim().replace(/\|/g, '/')).filter(Boolean);
        return `[[${alts.join('|')}]]`;
      }).join(' | ')).join('\n');
      out.caseSensitive = q('#mayus').checked;
      const sols = solucionesHuecos(out.table);
      if (!sols.length) return err('Marca «hueco» en al menos una casilla.');
      if (sols.some(x => !x.length)) return err('Hay una casilla marcada como hueco sin respuesta.');
    }
    if (t === 'match' || t === 'memory') {
      const filas = leerLista(raiz, 'pares').map(f => f.vals).filter(([a, b]) => a || b);
      out.pairs = filas.map(([a, b]) => [a, b]);
      if (out.pairs.length < 2) return err('Escribe al menos dos parejas.');
      if (t === 'memory' && out.pairs.length > 10) return err('Como mucho, 10 parejas (20 cartas).');
      if (out.pairs.some(p => !p[0] || !p[1])) return err('Completa las dos partes de cada pareja.');
      if (t === 'match' && new Set(out.pairs.map(p => p[1])).size < out.pairs.length) return err('Dos parejas tienen la misma parte derecha: cámbiala para que no haya dudas.');
    }
    if (t === 'order') {
      out.steps = leerLista(raiz, 'pasos').map(f => f.vals[0]).filter(Boolean);
      if (out.steps.length < 2) return err('Escribe al menos dos elementos.');
      if (new Set(out.steps).size < out.steps.length) return err('Hay dos elementos iguales: el orden no estaría claro.');
    }
    if (t === 'search') {
      const filas = leerLista(raiz, 'palabras').map(f => f.vals).filter(([w]) => w);
      out.words = filas.map(f => f[0]); const clues = filas.map(f => f[1] || '');
      if (clues.some(Boolean)) out.clues = clues;
      out.reverse = q('#inversas').checked;
      const norm = out.words.map(normSopa);
      if (norm.length < 2) return err('Escribe al menos dos palabras.');
      if (norm.length > 15) return err('Como mucho, 15 palabras.');
      const mal = out.words.find((w, i) => norm[i].length < 3 || norm[i].length > 14);
      if (mal != null) return err(`«${mal}» debe tener entre 3 y 14 letras.`);
      if (new Set(norm).size < norm.length) return err('Hay palabras repetidas.');
      const clave = JSON.stringify([norm, out.reverse]);
      if (sopa?.clave !== clave) { const g = generarSopa(out.words, { inversas: out.reverse }); if (!g) return err('No caben todas las palabras: quita alguna o acórtalas.'); sopa = { clave, ...g }; }
      out.grid = sopa.grid; out.placed = sopa.placed;
    }
    if (t === 'label') {
      if (!imgEt) return err('Elige una diapositiva o sube una imagen.');
      out.image = imgEt;
      out.points = puntos.map(p => ({ x: p.x, y: p.y, t: String(p.t || '').split(';').map(x => x.trim()).filter(Boolean).join('|') }));
      out.write = q('#escribir').checked;
      out.caseSensitive = q('#mayus').checked;
      if (!out.points.length) return err('Pulsa sobre la imagen para marcar al menos una parte.');
      if (out.points.some(p => !p.t)) return err('Escribe el nombre de cada parte marcada.');
    }
    if (t === 'wall') { out.images = q('#imgs').checked; out.names = q('#nombres').checked; }
    if (t === 'draw') { const f = q('#fondo')?.value; if (f) out.background = Number(f); else if (base.background && !q('#fondo')) out.background = base.background; }
    return { out };
  }

  // Prueba en vivo
  let temporizador = null, ultimo = '';
  function alCambiar() { clearTimeout(temporizador); temporizador = setTimeout(probar, 250); }
  function probar(forzar = false) {
    const { out, error } = leer();
    const clave = JSON.stringify([out, error]);
    if (!forzar && clave === ultimo) return;
    ultimo = clave;
    const el = q('#prueba');
    if (error) { el.innerHTML = `<p class="tipo">${esc(nombreTipo(out))}</p>${out.prompt ? `<h3 class="enunciado">${rico(conDatos(out.prompt, out, 'ejemplo'))}</h3>` : ''}<p class="ed-falta">${esc(error)}</p>`; return; }
    probarActividad(el, out, { diapos });
  }
  raiz.querySelector('.ed-form').addEventListener('input', alCambiar);
  raiz.querySelector('.ed-form').addEventListener('change', alCambiar);
  q('#reiniciar').onclick = () => probar(true);
  probar(true);

  const api = { leer, probar: () => probar(true) };
  return api;
}

// ── La actividad tal como la ve un alumno, con «Comprobar» ──────
export function probarActividad(el, it, { diapos = null, uid = 'ejemplo' } = {}) {
  const pub = itemPublico(it);
  const cab = `<p class="tipo">${esc(nombreTipo(it))}</p><h3 class="enunciado">${rico(conDatos(it.prompt, it, uid))}</h3>`;
  const otraVez = '<button type="button" class="btn" data-otra>Intentarlo de nuevo</button>';
  const reiniciar = () => probarActividad(el, it, { diapos, uid });
  el.onclick = e => { if (e.target.closest('[data-otra]')) reiniciar(); };
  const t = it.type;

  if (t === 'quiz') {
    el.innerHTML = cab + `<div class="opciones-alumno">${pub.options.map((o, i) => `<button type="button" class="op-alumno" data-op="${i}">${rico(o)}</button>`).join('')}</div><div id="fb"></div>`;
    el.querySelectorAll('[data-op]').forEach(b => b.addEventListener('click', () => {
      const i = Number(b.dataset.op);
      el.querySelectorAll('[data-op]').forEach(x => x.classList.toggle('elegida', x === b));
      const ok = comprobar(it, i, uid);
      el.querySelector('#fb').innerHTML = it.poll ? '<p class="tu-resp">Es una encuesta: en clase verás cuántos eligen cada opción.</p>'
        : `<p class="tu-resp ${ok ? 'ok' : 'mal'}">${ok ? '✓ Correcta.' : `✗ No es correcta. La buena es: ${rico(it.options[it.correct])}`}</p>`;
    }));
    return;
  }
  if (t === 'short' || t === 'number') {
    const pedir = t === 'number' && it.unitMode === 'ask';
    el.innerHTML = cab + `<form class="form-resp">${t === 'short' ? '<textarea id="pr-txt" rows="3" placeholder="Escribe tu respuesta"></textarea>'
      : `<div class="fila-num"><input id="pr-num" inputmode="decimal" placeholder="Valor">${pedir ? '<input id="pr-uni" class="uni" placeholder="Unidad">' : it.unit ? `<span class="uni-fija">${esc(it.unit)}</span>` : ''}</div>`}
      <button class="btn primario grande">Comprobar</button></form><div id="fb"></div>`;
    el.querySelector('form').onsubmit = e => {
      e.preventDefault();
      const v = t === 'short' ? el.querySelector('#pr-txt').value.trim() : { n: el.querySelector('#pr-num').value.trim(), u: el.querySelector('#pr-uni')?.value.trim() };
      const ok = comprobar(it, v, uid);
      el.querySelector('#fb').innerHTML = ok == null ? '<p class="tu-resp">Sin respuestas válidas: esta la corriges tú.</p>'
        : `<p class="tu-resp ${ok ? 'ok' : 'mal'}">${ok ? '✓ Correcta.' : '✗ No es correcta.'}${t === 'number' ? ` Solución: ${esc(solucionTexto(it, uid))}` : ok ? '' : ` Valen: ${esc(it.accepted)}`}</p>`;
    };
    return;
  }
  if (POR_PARTES.includes(t)) {
    el.innerHTML = cab + `<form class="form-resp form-partes">${pintarPartes(pub, [], { editable: true })}<p class="aviso" role="alert"></p><button class="btn primario grande">Comprobar</button></form>`;
    const f = el.querySelector('form');
    f.addEventListener('click', e => { const b = e.target.closest('[data-mover]'); if (b) moverOrden(b); });
    f.onsubmit = e => {
      e.preventDefault();
      const v = leerPartes(f, pub);
      if (t !== 'order' && v.some(x => !x)) { f.querySelector('.aviso').textContent = 'Completa todo antes de comprobar.'; return; }
      const ok = aciertosPorParte(it, v), n = ok.filter(Boolean).length;
      el.innerHTML = cab + pintarPartes(it, v) + `<p class="tu-resp ${n === ok.length ? 'ok' : 'mal'}"><strong>${n} de ${ok.length}</strong> ${n === ok.length ? 'correctas. ¡Muy bien!' : 'correctas.'}</p>` + otraVez;
    };
    return;
  }
  if (t === 'memory') {
    el.innerHTML = cab + `<p class="marcador-memory" id="marcador">Parejas: 0 de ${pub.cards.length / 2} · Intentos: 0</p>
      <div class="memory">${pub.cards.map((c, j) => `<button type="button" class="carta" data-j="${j}" aria-label="Carta ${j + 1}"><span class="carta-dorso" aria-hidden="true"></span><span class="carta-cara">${rico(c.t)}</span></button>`).join('')}</div><div id="fb"></div>`;
    jugarMemory(el, pub, r => { el.querySelector('#fb').innerHTML = `<p class="tu-resp ok">¡Completado en <strong>${r.intentos} intentos</strong>!</p>${otraVez}`; });
    return;
  }
  if (t === 'search') {
    const jugar = halladas => {
      const n = (pub.words || pub.h || []).length;
      el.innerHTML = cab + pintarSopa(pub, halladas, { editable: true }) + `<p class="estado-act ${halladas.length === n ? 'ok' : ''}" id="estado-sopa" aria-live="polite">${halladas.length === n ? '¡Has encontrado todas las palabras!' : `Has encontrado ${halladas.length} de ${n}. Pulsa la primera letra y la última (o arrastra).`}</p>`;
      jugarSopa(el, pub, halladas, h => jugar([...h]));
    };
    jugar([]);
    return;
  }
  const nota = {
    draw: `Cada alumno dibuja ${it.background ? `sobre la diapositiva ${it.background}` : 'en un lienzo en blanco'} con colores y grosores, y te lo envía. En clase ves todos los dibujos en una galería.`,
    photo: 'Cada alumno hace una foto o elige una imagen, añade un comentario y te la envía. En clase las ves en una galería.',
    wall: `Cada alumno publica hasta ${MAX_MURO} aportaciones${it.images !== false ? ' con texto o imagen' : ' de texto'}. El muro se va llenando en el proyector${it.names ? ', con sus nombres' : ', sin nombres'}.`
  }[t] || '';
  el.innerHTML = cab + `<div class="ed-nota">${ICONOS[t] || ''}<p>${esc(nota)}</p></div>`
    + (t === 'draw' && it.background && diapos?.[it.background] ? `<img class="dibujo-enviado" src="${esc(diapos[it.background])}" alt="Fondo del dibujo">` : '');
}
