// Utilidades compartidas por la vista del alumnado y la del profesorado

export const TIPOS = {
  slide: 'Diapositiva',
  quiz: 'Test',
  short: 'Respuesta abierta',
  number: 'Respuesta numérica',
  draw: 'Dibujo',
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
  return false;
}

// true / false / null (no se corrige automáticamente)
export function comprobar(it, v, uid) {
  if (!esCorregible(it) || v == null) return null;
  if (it.type === 'quiz') return Number(v) === Number(it.correct);
  if (it.type === 'short') {
    const validas = String(it.accepted || '').split(';').map(normTexto).filter(Boolean);
    return validas.includes(normTexto(v));
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
