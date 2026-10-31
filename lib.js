// Utilidades compartidas por la vista del alumnado y la del profesorado

export const TIPOS = {
  slide: 'Diapositiva',
  quiz: 'Test',
  short: 'Respuesta abierta',
  number: 'Respuesta numérica',
  draw: 'Dibujo',
  gaps: 'Rellenar huecos',
  match: 'Unir parejas',
  order: 'Ordenar',
  table: 'Rellenar tabla',
  photo: 'Subir imagen',
  wall: 'Muro colaborativo',
  label: 'Identificar en imagen',
  memory: 'Memory',
  search: 'Sopa de letras',
  link: 'Enlace'
};

export const nombreTipo = it => (it?.type === 'quiz' && it.poll) ? 'Encuesta' : (TIPOS[it?.type] || '');
// Las diapositivas y los enlaces no recogen respuestas
export const esActividad = it => !!it && it.type !== 'slide' && it.type !== 'link';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Lo que ve el alumnado mientras la actividad está abierta: sin soluciones
export function itemPublico(it) {
  if (!it) return null;
  const c = { ...it };
  delete c.correct; delete c.accepted; delete c.answer; delete c.formula; delete c.tolerance;
  if (c.type === 'number' && c.unitMode === 'ask') delete c.unit;
  if (c.type === 'gaps') c.text = sinSoluciones(c.text);
  if (c.type === 'table') c.table = sinSoluciones(c.table);
  if (c.type === 'match') { c.left = (c.pairs || []).map(p => p[0]); c.right = barajar((c.pairs || []).map(p => p[1])); delete c.pairs; }
  if (c.type === 'order') { c.shuffled = barajar(c.steps || [], true); delete c.steps; }
  if (c.type === 'label') {
    c.marks = (c.points || []).map(p => ({ x: p.x, y: p.y }));
    if (!c.write) c.labels = barajar([...new Set((c.points || []).map(p => alternativas(p.t)[0]))]);
    delete c.points;
  }
  if (c.type === 'memory') { c.cards = barajar((c.pairs || []).flatMap((p, k) => [{ k, t: p[0] }, { k, t: p[1] }])); delete c.pairs; }
  if (c.type === 'search') {
    if ((c.clues || []).some(Boolean)) { c.h = (c.words || []).map(hashPalabra); c.lens = (c.words || []).map(w => normSopa(w).length); delete c.words; }
    delete c.placed;
  }
  return c;
}

// Acepta 1,5 · 1.5 · 3e4 · 3·10^4 · 3x10^4 · 3×10^-4
export function parseNum(s) {
  const t = String(s ?? '').trim().replace(/\s+/g, '').replace(/,/g, '.').replace(/−/g, '-');
  const m = t.match(/^([+-]?(?:\d+\.?\d*|\.\d+))(?:[x×·*]10\^?([+-]?\d+)|[eE]([+-]?\d+))?$/);
  if (!m) return NaN;
  const base = parseFloat(m[1]);
  const exp = m[2] ?? m[3];
  return exp != null ? base * 10 ** Number(exp) : base;
}

export function normUnidad(u) {
  return String(u ?? '').trim().replace(/\s+/g, '')
    .replace(/²/g, '^2').replace(/³/g, '^3').replace(/·/g, '*').replace(/º/g, '°');
}

function normTexto(s) {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim().replace(/[.!¡?¿]+$/, '');
}

export function esCorregible(it) {
  if (!it) return false;
  if (it.type === 'quiz') return !it.poll;
  if (it.type === 'number') return true;
  if (it.type === 'short') return String(it.accepted || '').split(';').some(x => x.trim());
  return ['gaps', 'match', 'order', 'table', 'label', 'search', 'memory'].includes(it.type);
}

// true / false / null (no se corrige automáticamente)
export function comprobar(it, v, uid) {
  if (!esCorregible(it) || v == null) return null;
  if (it.type === 'quiz') return Number(v) === Number(it.correct);
  if (it.type === 'short') {
    const validas = String(it.accepted || '').split(';').map(normTexto).filter(Boolean);
    return validas.includes(normTexto(v));
  }
  if (it.type === 'memory') return !!v?.hecho;
  if (['gaps', 'match', 'order', 'table', 'label', 'search'].includes(it.type)) {
    const r = aciertosPorParte(it, v);
    return r.length > 0 && r.every(Boolean);
  }
  if (it.type === 'number') {
    const x = parseNum(v?.n);
    const a = solucion(it, uid);
    if (Number.isNaN(x) || Number.isNaN(a)) return false;
    const tol = Math.abs(a) * (Number(it.tolerance) || 0) / 100;
    const numOk = Math.abs(x - a) <= tol + 1e-12 * Math.max(1, Math.abs(a));
    const unidadOk = it.unitMode !== 'ask' || !it.unit || normUnidad(v?.u) === normUnidad(it.unit);
    return numOk && unidadOk;
  }
  return null;
}

export function textoRespuesta(it, v) {
  if (v == null) return '';
  if (it.type === 'quiz') return it.options?.[Number(v)] ?? '';
  if (it.type === 'number') {
    const u = v.u ? ' ' + v.u : (it.unitMode !== 'ask' && it.unit ? ' ' + it.unit : '');
    return `${v.n ?? ''}${u}`;
  }
  if (it.type === 'draw') return 'Dibujo entregado';
  if (it.type === 'photo') return `Imagen entregada${v.t ? ': ' + v.t : ''}`;
  if (it.type === 'memory') return v.hecho ? `Completado en ${v.intentos} intentos${v.seg ? ` (${v.seg} s)` : ''}` : 'Sin terminar';
  if (it.type === 'search') { const n = (it.words || it.h || []).length; return `${lista(v).length} de ${n} palabras`; }
  if (it.type === 'label') return lista(v).map((x, i) => `${i + 1}: ${sencillo(x || '—')}`).join(' · ');
  if (it.type === 'wall') return lista(v).map(p => (p.t || '') + (p.img ? ' [imagen]' : '')).join(' | ');
  if (it.type === 'match') return (it.pairs ? it.pairs.map(p => p[0]) : it.left || []).map((l, i) => `${sencillo(l)} → ${sencillo(lista(v)[i] ?? '')}`).join('; ');
  if (Array.isArray(v) || typeof v === 'object') return lista(v).map(x => sencillo(x ?? '')).join(it.type === 'order' ? ' → ' : ' · ');
  return String(v);
}

// Respuesta lista para pintar en HTML (las opciones de un test pueden llevar fórmulas)
export const respuestaHTML = (it, v) => it?.type === 'quiz' ? rico(textoRespuesta(it, v)) : esc(textoRespuesta(it, v));

export function solucionTexto(it, uid) {
  if (tieneVariantes(it) && uid == null) return `${it.formula}${it.unit ? ' ' + it.unit : ''} (cada alumno con sus datos)`;
  return `${fmtNum(solucion(it, uid))}${it.unit ? ' ' + it.unit : ''}`;
}

export function generarCodigo() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const r = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(r, b => abc[b % abc.length]).join('');
}

export const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const fecha = ts => ts ? new Date(ts).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) : '';

// ── Fórmulas: $…$ en línea, $$…$$ en bloque, \ce{…} para química ─
// Se escribe el texto tal cual; lo que va entre dólares se dibuja con KaTeX.
const trozosMath = s => {
  const out = [];
  const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|(\\ce\{(?:[^{}]|\{[^{}]*\})*\})/g;
  let i = 0, m;
  while ((m = re.exec(s))) {
    if (m.index > i) out.push({ t: s.slice(i, m.index) });
    out.push({ m: m[1] ?? m[2] ?? m[3], bloque: m[1] != null, ce: m[3] != null });
    i = re.lastIndex;
  }
  if (i < s.length) out.push({ t: s.slice(i) });
  return out;
};

export function rico(s) {
  const k = globalThis.katex;
  return trozosMath(String(s ?? '')).map(p => {
    if (p.t != null) return esc(p.t);
    if (!k) return esc(p.bloque ? `$$${p.m}$$` : `$${p.m}$`);
    try { return k.renderToString(p.m, { displayMode: p.bloque, throwOnError: false, strict: false, output: 'html' }); }
    catch { return esc(p.m); }
  }).join('');
}

// ── Números con formato español ──────────────────────────────────
export function fmtNum(x, cifras = 4) {
  if (!Number.isFinite(x)) return '';
  if (x === 0) return '0';
  const ax = Math.abs(x);
  if (ax >= 1e5 || ax < 1e-3) {
    const [m, e] = x.toExponential(cifras - 1).split('e');
    return `${String(Number(m)).replace('.', ',')}·10^${Number(e)}`;
  }
  return String(Number(x.toPrecision(cifras))).replace('.', ',');
}
// Igual, pero en LaTeX (para meterlo dentro de una fórmula)
const latexNum = x => fmtNum(x).replace(',', '{,}').replace(/·10\^(-?\d+)/, '\\cdot 10^{$1}');

// ── Evaluador de expresiones (sin eval) ──────────────────────────
// Admite + - * / ^, paréntesis, coma decimal, 3e4, pi, e y funciones:
// sqrt raiz log (base 10) ln exp sin cos tan abs
const FUN = { sqrt: Math.sqrt, raiz: Math.sqrt, log: Math.log10, ln: Math.log, exp: Math.exp, sin: Math.sin, cos: Math.cos, tan: Math.tan, abs: Math.abs };
export function evaluar(expr, vars = {}) {
  const src = String(expr ?? '').replace(/(\d),(\d)/g, '$1.$2').replace(/[·×]/g, '*').replace(/−/g, '-');
  const tk = src.match(/\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?|[A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ_0-9]*|\*\*|[-+*/^()]|\S/g) || [];
  let i = 0;
  const ver = () => tk[i], tomar = () => tk[i++];
  const error = m => { throw new Error(m); };
  function primario() {
    const t = tomar();
    if (t == null) error('La fórmula está incompleta.');
    if (t === '(') { const v = suma(); if (tomar() !== ')') error('Falta cerrar un paréntesis.'); return v; }
    if (t === '-') return -potencia();
    if (t === '+') return potencia();
    if (/^[\d.]/.test(t)) return parseFloat(t);
    if (FUN[t] && ver() === '(') { tomar(); const v = suma(); if (tomar() !== ')') error('Falta cerrar un paréntesis.'); return FUN[t](v); }
    if (t in vars) return Number(vars[t]);
    if (t === 'pi') return Math.PI;
    if (t === 'e') return Math.E;
    error(`No conozco «${t}». Revisa que esté definido como dato.`);
  }
  function potencia() { const b = primario(); if (ver() === '^' || ver() === '**') { tomar(); return b ** factorSigno(); } return b; }
  function factorSigno() { if (ver() === '-') { tomar(); return -factorSigno(); } return potencia(); }
  function producto() { let v = factorSigno(); while (ver() === '*' || ver() === '/') v = tomar() === '*' ? v * factorSigno() : v / factorSigno(); return v; }
  function suma() { let v = producto(); while (ver() === '+' || ver() === '-') v = tomar() === '+' ? v + producto() : v - producto(); return v; }
  const v = suma();
  if (i < tk.length) error(`Sobra «${tk[i]}» en la fórmula.`);
  return v;
}

// ── Variantes numéricas: cada alumno recibe sus propios datos ────
// it.vars = [{ name, min, max, step }]; it.formula = 'm*9,8'
export const tieneVariantes = it => it?.type === 'number' && Array.isArray(it.vars) && it.vars.length > 0;

function semilla(str) {
  let h = 2166136261;
  for (const c of String(str)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}

export function valores(it, uid) {
  if (!tieneVariantes(it)) return {};
  const r = semilla(`${uid ?? ''}|${it.id}`);
  const out = {};
  for (const v of it.vars) {
    const min = Number(v.min), max = Number(v.max), paso = Number(v.step) || 0;
    let x;
    if (paso > 0) { const n = Math.floor((max - min) / paso + 1e-9); x = min + Math.floor(r() * (n + 1)) * paso; x = Number(x.toPrecision(12)); }
    else x = Number((min + r() * (max - min)).toPrecision(3));
    out[v.name] = x;
  }
  return out;
}

export function solucion(it, uid) {
  if (tieneVariantes(it)) { try { return evaluar(it.formula, valores(it, uid)); } catch { return NaN; } }
  return Number(it.answer);
}

// Sustituye {{dato}} en el texto: f(nombre) devuelve el LaTeX que va en su lugar
function sustituir(texto, f) {
  const poner = (s, enMath) => s.replace(/\{\{\s*([A-Za-z_][A-Za-z_0-9]*)\s*\}\}/g, (all, n) => {
    const x = f(n); return x == null ? all : enMath ? x : `$${x}$`;
  });
  return trozosMath(String(texto ?? '')).map(p => p.t != null ? poner(p.t, false)
    : p.ce ? p.m : p.bloque ? `$$${poner(p.m, true)}$$` : `$${poner(p.m, true)}$`).join('');
}

// Enunciado con los datos de un alumno
export function conDatos(texto, it, uid) {
  if (!tieneVariantes(it)) return texto;
  const vals = valores(it, uid);
  return sustituir(texto, n => n in vals ? latexNum(vals[n]) : null);
}

// Enunciado para el proyector: el nombre del dato en lugar del valor
export const conNombres = (texto, it) => tieneVariantes(it)
  ? sustituir(texto, n => it.vars.some(v => v.name === n) ? `\\boxed{${n}}` : null) : texto;

// Datos de un alumno en texto plano (para el informe)
export const datosTexto = (it, uid) => Object.entries(valores(it, uid)).map(([k, v]) => `${k} = ${fmtNum(v)}`).join(', ');

// ── Enlaces: actividades externas dentro de la clase ─────────────
// Devuelve el nombre del sitio y, si se puede, la dirección para verlo dentro de la clase
export function infoEnlace(url) {
  let u;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) && !/^https?:/i.test(url)) return null;
  try { u = new URL(/^https?:\/\//i.test(url) ? url : 'https://' + url); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const h = u.hostname.replace(/^www\./, '').toLowerCase();
  const href = u.href;
  const sitio = (nombre, embed = null) => ({ url: href, nombre, embed });
  if (h === 'youtu.be' || h.endsWith('youtube.com')) {
    const id = h === 'youtu.be' ? u.pathname.slice(1) : (u.searchParams.get('v') || (u.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]+)/) || [])[1]);
    return sitio('YouTube', id ? `https://www.youtube-nocookie.com/embed/${id}` : null);
  }
  if (h.endsWith('genial.ly') || h.endsWith('genially.com')) return sitio('Genially', h.startsWith('view.') ? href : null);
  if (h.endsWith('geogebra.org')) {
    const id = (u.pathname.match(/^\/(?:m|classic|calculator|graphing|geometry|3d)\/(\w+)/) || [])[1];
    return sitio('GeoGebra', id ? `https://www.geogebra.org/material/iframe/id/${id}` : null);
  }
  if (h === 'phet.colorado.edu') {
    if (/\/sims\/html\//.test(u.pathname)) return sitio('PhET', href);
    const sim = (u.pathname.match(/\/simulations?\/([\w-]+)/) || [])[1];
    return sitio('PhET', sim ? `https://phet.colorado.edu/sims/html/${sim}/latest/${sim}_es.html` : null);
  }
  if (h === 'docs.google.com') {
    if (/\/forms\//.test(u.pathname)) return sitio('Formulario de Google', href.replace(/\/viewform.*$|\/edit.*$/, '/viewform') + '?embedded=true');
    if (/\/presentation\//.test(u.pathname)) return sitio('Presentación de Google', href.replace(/\/(edit|pub|present).*$/, '/embed'));
    return sitio('Documento de Google', href.replace(/\/edit.*$/, '/preview'));
  }
  if (h.endsWith('wordwall.net')) return sitio('Wordwall');
  if (h.endsWith('educaplay.com')) return sitio('Educaplay');
  if (h.endsWith('kahoot.it') || h.endsWith('kahoot.com')) return sitio('Kahoot');
  if (h.endsWith('quizizz.com') || h.endsWith('wayground.com')) return sitio('Quizizz');
  if (h.endsWith('liveworksheets.com')) return sitio('Liveworksheets');
  if (h.endsWith('padlet.com')) return sitio('Padlet', href);
  if (h.endsWith('canva.com') && /\/view/.test(u.pathname)) return sitio('Canva', href.replace(/\?.*$/, '') + '?embed');
  return sitio(h);
}

// Busca direcciones escritas en un texto (también sin http, como wordwall.net/...)
export function buscarEnlaces(texto) {
  const re = /\b(?:https?:\/\/|www\.)[^\s<>"'«»]+|\b(?:[a-z0-9-]+\.)+(?:com|net|org|es|ly|edu|it|io|app)\/[^\s<>"'«»]+/gi;
  return [...new Set((String(texto).match(re) || []).map(x => x.replace(/[.,;:)\]]+$/, '')))];
}

// ── Actividades que se corrigen por partes ───────────────────────
// Huecos: «El agua hierve a [[100]] °C», varias válidas con |: [[evaporación|vaporización]]
const RE_HUECO = /\[\[(.*?)\]\]/g;
export const lista = v => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.keys(v).sort((a, b) => a - b).map(k => v[k]) : []);
export const sinSoluciones = t => String(t ?? '').replace(RE_HUECO, '[[]]');
export const solucionesHuecos = t => [...String(t ?? '').matchAll(RE_HUECO)].map(m => m[1].split('|').map(x => x.trim()).filter(Boolean));
// Trozos de texto entre huecos: n huecos → n + 1 trozos
export const trozosHuecos = t => String(t ?? '').split(/\[\[.*?\]\]/);
export const filasTabla = t => String(t ?? '').split('\n').map(l => l.trim()).filter(Boolean).map(l => l.replace(/^\||\|$/g, '').split('|').map(c => c.trim()));

export function barajar(a, distinto = false) {
  const b = [...a];
  for (let k = 0; k < 6; k++) {
    for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
    if (!distinto || b.length < 2 || b.some((x, i) => x !== a[i])) break;
  }
  return b;
}

const normHueco = (s, mayus) => mayus ? String(s ?? '').replace(/\s+/g, ' ').trim() : normTexto(s);

// Lista de true/false, una por hueco, pareja o posición
export function aciertosPorParte(it, v) {
  const r = lista(v);
  if (it.type === 'gaps' || it.type === 'table') {
    return solucionesHuecos(it.type === 'gaps' ? it.text : it.table)
      .map((alts, i) => alts.some(a => normHueco(a, it.caseSensitive) === normHueco(r[i], it.caseSensitive)));
  }
  if (it.type === 'match') return (it.pairs || []).map((p, i) => r[i] === p[1]);
  if (it.type === 'order') return (it.steps || []).map((x, i) => r[i] === x);
  if (it.type === 'label') return (it.points || []).map((p, i) => alternativas(p.t).some(a => normHueco(a, it.caseSensitive) === normHueco(r[i], it.caseSensitive)));
  if (it.type === 'search') return (it.words || it.h || []).map((_, i) => r.some(x => x?.i === i));
  return [];
}

// Fórmulas en texto plano (para listas desplegables y el CSV): $\ce{H2SO4}$ → H₂SO₄
const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' };
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻' };
export function sencillo(s) {
  return String(s ?? '')
    .replace(/\\ce\{((?:[^{}]|\{[^{}]*\})*)\}/g, (_, f) => f
      .replace(/\^\{?([0-9]*[+-])\}?/g, (m, c) => [...c].map(x => SUP[x] || x).join(''))
      .replace(/([A-Za-z)\]])(\d+)/g, (m, a, n) => a + [...n].map(x => SUB[x]).join(''))
      .replace(/<=>/g, '⇌').replace(/->/g, '→'))
    .replace(/\^\{?(-?\d+)\}?/g, (m, n) => [...n].map(x => SUP[x] || x).join(''))
    .replace(/_\{?(\d+)\}?/g, (m, n) => [...n].map(x => SUB[x]).join(''))
    .replace(/\\cdot/g, '·').replace(/\\times/g, '×').replace(/\\,/g, ' ').replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1/$2')
    .replace(/\\text\{([^{}]*)\}/g, '$1').replace(/\$/g, '').replace(/\{,\}/g, ',').trim();
}

export const POR_PARTES = ['gaps', 'match', 'order', 'table', 'label'];
export const alternativas = t => String(t ?? '').split('|').map(x => x.trim()).filter(Boolean);

// HTML de una actividad por partes. editable: con casillas; si no, la respuesta corregida
export function pintarPartes(it, v, { editable = false } = {}) {
  const r = lista(v);
  const ok = editable ? [] : aciertosPorParte(it, v);
  const sols = it.type === 'gaps' ? solucionesHuecos(it.text) : it.type === 'table' ? solucionesHuecos(it.table) : [];
  let n = 0;
  const hueco = () => {
    const i = n++;
    if (editable) return `<input class="hueco" data-i="${i}" value="${esc(r[i] ?? '')}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Hueco ${i + 1}" size="${Math.max(6, String(r[i] ?? '').length + 2)}">`;
    const bien = ok[i];
    return `<span class="hueco-res ${bien ? 'ok' : 'mal'}">${esc(r[i] || '—')}</span>${!bien && sols[i]?.length ? `<span class="hueco-sol">${esc(sols[i][0])}</span>` : ''}`;
  };
  const conHuecos = t => { const tr = trozosHuecos(t); return tr.map((x, k) => rico(x) + (k < tr.length - 1 ? hueco() : '')).join(''); };

  if (it.type === 'gaps') return `<div class="texto-huecos">${conHuecos(it.text)}</div>`;
  if (it.type === 'table') {
    const filas = filasTabla(it.table);
    return `<div class="tabla-scroll"><table class="tabla tabla-act">${filas.map((f, k) => `<tr>${f.map(c => k === 0 ? `<th scope="col">${conHuecos(c)}</th>` : `<td>${conHuecos(c)}</td>`).join('')}</tr>`).join('')}</table></div>`;
  }
  if (it.type === 'match') {
    const izq = it.pairs ? it.pairs.map(p => p[0]) : it.left || [];
    const der = it.right || (it.pairs || []).map(p => p[1]);
    return `<ul class="parejas">${izq.map((l, i) => `<li><span class="pareja-izq">${rico(l)}</span><span class="pareja-flecha" aria-hidden="true">→</span>${editable
      ? `<select data-i="${i}" aria-label="Pareja de ${esc(sencillo(l))}"><option value="">Elige…</option>${der.map(d => `<option ${r[i] === d ? 'selected' : ''}>${esc(sencillo(d))}</option>`).join('')}</select>`
      : `<span class="hueco-res ${ok[i] ? 'ok' : 'mal'}">${rico(r[i] || '—')}</span>${ok[i] ? '' : `<span class="hueco-sol">${rico(it.pairs[i][1])}</span>`}`}</li>`).join('')}</ul>`;
  }
  if (it.type === 'label') {
    const marcas = it.points ? it.points.map(p => ({ x: p.x, y: p.y })) : it.marks || [];
    const etiquetas = it.labels || [];
    const imagen = `<div class="img-etiquetas"><img src="${esc(it.image || '')}" alt="Imagen para identificar">${marcas.map((m, i) =>
      `<span class="marca-img ${editable ? '' : ok[i] ? 'ok' : 'mal'}" style="left:${Number(m.x)}%;top:${Number(m.y)}%">${i + 1}</span>`).join('')}</div>`;
    const campo = i => it.write
      ? `<input class="hueco" data-i="${i}" value="${esc(r[i] ?? '')}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Nombre de la parte ${i + 1}">`
      : `<select data-i="${i}" aria-label="Nombre de la parte ${i + 1}"><option value="">Elige…</option>${etiquetas.map(e => `<option ${r[i] === e ? 'selected' : ''}>${esc(sencillo(e))}</option>`).join('')}</select>`;
    return imagen + `<ol class="lista-etiquetas">${marcas.map((m, i) => `<li><span class="marca-num">${i + 1}</span>${editable ? campo(i)
      : `<span class="hueco-res ${ok[i] ? 'ok' : 'mal'}">${rico(r[i] || '—')}</span>${ok[i] || !it.points ? '' : `<span class="hueco-sol">${rico(alternativas(it.points[i].t)[0])}</span>`}`}</li>`).join('')}</ol>`;
  }
  if (it.type === 'order') {
    if (editable) {
      const base = it.shuffled || [];
      const actual = r.length === base.length && r.every(x => base.includes(x)) ? r : base;
      return `<ol class="ordenar">${actual.map((x, i) => `<li data-k="${base.indexOf(x)}"><span class="ordenar-txt">${rico(x)}</span>
        <button type="button" class="btn-ico" data-mover="-1" aria-label="Subir" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" class="btn-ico" data-mover="1" aria-label="Bajar" ${i === actual.length - 1 ? 'disabled' : ''}>↓</button></li>`).join('')}</ol>`;
    }
    return `<ol class="ordenar">${(it.steps || []).map((x, i) => `<li><span class="hueco-res ${ok[i] ? 'ok' : 'mal'}">${rico(r[i] || '—')}</span>${ok[i] ? '' : `<span class="hueco-sol">${rico(x)}</span>`}</li>`).join('')}</ol>`;
  }
  return '';
}

// Lee lo que ha puesto el alumno en una actividad por partes
export function leerPartes(el, it) {
  if (it.type === 'order') return [...el.querySelectorAll('.ordenar li')].map(li => it.shuffled[Number(li.dataset.k)]);
  if (it.type === 'match' || (it.type === 'label' && !it.write)) {
    const der = (it.type === 'match' ? it.right : it.labels) || [];
    return [...el.querySelectorAll('select[data-i]')].map(s => s.selectedIndex > 0 ? der[s.selectedIndex - 1] : '');
  }
  return [...el.querySelectorAll('input.hueco')].sort((a, b) => a.dataset.i - b.dataset.i).map(i => i.value.trim());
}

// Mueve un elemento en «Ordenar» (botones ↑ ↓)
export function moverOrden(boton) {
  const li = boton.closest('li'), d = Number(boton.dataset.mover);
  const otro = d < 0 ? li.previousElementSibling : li.nextElementSibling;
  if (!otro) return;
  d < 0 ? otro.before(li) : otro.after(li);
  const lis = [...li.parentElement.children];
  lis.forEach((x, i) => { x.querySelector('[data-mover="-1"]').disabled = i === 0; x.querySelector('[data-mover="1"]').disabled = i === lis.length - 1; });
  boton.focus();
}

// ── Muro: cada alumno publica hasta MAX_MURO aportaciones (texto y, si se permite, una imagen) ──
export const MAX_MURO = 5;
// Aportaciones visibles del muro: [{ id, uid, alias, t, img, at }]
export function postsMuro(resp, ocultas = {}) {
  const out = [];
  for (const [u, r] of Object.entries(resp || {})) lista(r.value).forEach((p, i) => {
    const id = `${u}_${i}`;
    if (p && !ocultas[id]) out.push({ id, uid: u, alias: r.alias, t: p.t || '', img: p.img || '', at: p.at || r.at || 0 });
  });
  return out.sort((a, b) => a.at - b.at);
}

// ── Sopa de letras ───────────────────────────────────────────────
// Mayúsculas sin tildes (se conserva la Ñ), sin espacios ni signos
export const normSopa = w => String(w ?? '').toUpperCase().replace(/Ñ/g, '\u0001').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\u0001/g, 'Ñ').replace(/[^A-ZÑ0-9]/g, '');
// Huella de una palabra, para comprobarla sin enviarla al alumnado (modo pistas)
export function hashPalabra(w) {
  let h = 5381;
  for (const ch of normSopa(w)) h = (Math.imul(h, 33) ^ ch.codePointAt(0)) >>> 0;
  return h.toString(36);
}
const RELLENO = 'AAAAABBCCCDDDEEEEEEFGGHIIIIJLLLMMNNNÑOOOOOPPQRRRRSSSSTTTUUUVZ';
export function generarSopa(palabras, { inversas = false } = {}) {
  const ws = palabras.map(normSopa);
  const largo = Math.max(...ws.map(w => w.length));
  let n = Math.max(10, largo + 1, Math.ceil(Math.sqrt(ws.join('').length * 2.2)));
  const dirs = [[0, 1], [1, 0], [1, 1], [-1, 1]];
  if (inversas) dirs.push([0, -1], [-1, 0], [-1, -1], [1, -1]);
  const azar = k => Math.floor(Math.random() * k);
  const orden = ws.map((w, i) => i).sort((a, b) => ws[b].length - ws[a].length);
  for (let intento = 0; intento < 80; intento++) {
    if (intento && intento % 15 === 0) n++;
    const g = Array.from({ length: n }, () => Array(n).fill(''));
    const placed = [];
    let ok = true;
    for (const i of orden) {
      const w = [...ws[i]];
      let puesto = false;
      for (let k = 0; k < 400 && !puesto; k++) {
        const [dr, dc] = dirs[azar(dirs.length)], r = azar(n), c = azar(n);
        const r2 = r + dr * (w.length - 1), c2 = c + dc * (w.length - 1);
        if (r2 < 0 || r2 >= n || c2 < 0 || c2 >= n) continue;
        if (w.every((ch, j) => { const x = g[r + dr * j][c + dc * j]; return !x || x === ch; })) {
          w.forEach((ch, j) => { g[r + dr * j][c + dc * j] = ch; });
          placed[i] = { r, c, dr, dc, n: w.length };
          puesto = true;
        }
      }
      if (!puesto) { ok = false; break; }
    }
    if (ok) return { grid: g.map(f => f.map(x => x || RELLENO[azar(RELLENO.length)]).join('')), placed };
  }
  return null;
}
// Casillas de la línea entre dos casillas, o null si no están en línea recta
export function lineaSopa(r1, c1, r2, c2) {
  const dr = Math.sign(r2 - r1), dc = Math.sign(c2 - c1);
  const len = Math.max(Math.abs(r2 - r1), Math.abs(c2 - c1)) + 1;
  if (r1 !== r2 && c1 !== c2 && Math.abs(r2 - r1) !== Math.abs(c2 - c1)) return null;
  return Array.from({ length: len }, (_, j) => [r1 + dr * j, c1 + dc * j]);
}
const filasSopa = it => (it.grid || []).map(f => [...f]);
// Índice de la palabra que forman esas casillas (en cualquier sentido), o -1
export function palabraSopa(it, celdas) {
  const g = filasSopa(it);
  const s = celdas.map(([r, c]) => g[r]?.[c] || '').join('');
  const inv = [...s].reverse().join('');
  if (it.words) return it.words.findIndex(w => { const x = normSopa(w); return x === s || x === inv; });
  return (it.h || []).findIndex(h => h === hashPalabra(s) || h === hashPalabra(inv));
}
// HTML de la sopa. halladas: [{ i, r1, c1, r2, c2 }]. conSolucion: marca también las no encontradas
export function pintarSopa(it, halladas = [], { editable = false, conSolucion = false } = {}) {
  const g = filasSopa(it), n = g.length;
  const marca = {};
  for (const h of lista(halladas)) for (const [r, c] of lineaSopa(h.r1, h.c1, h.r2, h.c2) || []) marca[`${r},${c}`] = 'hallada';
  if (conSolucion) (it.placed || []).forEach((p, i) => {
    if (!p || lista(halladas).some(h => h.i === i)) return;
    for (let j = 0; j < p.n; j++) marca[`${p.r + p.dr * j},${p.c + p.dc * j}`] ||= 'pendiente';
  });
  const celda = (ch, r, c) => editable
    ? `<button type="button" class="celda ${marca[`${r},${c}`] || ''}" data-r="${r}" data-c="${c}" aria-label="Fila ${r + 1}, columna ${c + 1}: ${ch}">${ch}</button>`
    : `<span class="celda ${marca[`${r},${c}`] || ''}">${ch}</span>`;
  const total = (it.words || it.h || []).length;
  const textoHallada = i => { const h = lista(halladas).find(x => x.i === i); return h ? (lineaSopa(h.r1, h.c1, h.r2, h.c2) || []).map(([r, c]) => g[r]?.[c]).join('') : ''; };
  const items = Array.from({ length: total }, (_, i) => {
    const hallada = lista(halladas).some(h => h.i === i);
    const pista = it.clues?.[i];
    if (it.clues?.some(Boolean)) {
      const pal = hallada ? textoHallada(i) : conSolucion && it.words ? normSopa(it.words[i]) : '';
      return `<li class="${hallada ? 'hallada' : ''}">${pista ? rico(pista) : 'Palabra'} <span class="meta">(${it.lens?.[i] ?? normSopa(it.words?.[i]).length} letras)</span>${pal ? ` <strong>${esc(pal)}</strong>` : ''}</li>`;
    }
    return `<li class="${hallada ? 'hallada' : ''}">${esc(it.words?.[i] ?? '')}</li>`;
  });
  return `<div class="sopa-caja"><div class="sopa ${editable ? 'editable' : ''}" style="--n:${n}">${g.map((f, r) => f.map((ch, c) => celda(ch, r, c)).join('')).join('')}</div>
    <ol class="sopa-palabras ${it.clues?.some(Boolean) ? 'con-pistas' : ''}">${items.join('')}</ol></div>`;
}

// Reduce la foto antes de guardarla: el plan gratuito de Firebase tiene poco espacio
export async function reducirImagen(file, max, calidad) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', calidad);
  } finally { URL.revokeObjectURL(url); }
}

