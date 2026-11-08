import { firebaseConfig } from './config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

export const configurado = !String(firebaseConfig.apiKey || '').startsWith('PEGA_AQUI');

// App instalada (PWA en pantalla de inicio): en iPad la ventana emergente de Google
// no funciona, así que se entra con redirección y por el propio dominio (vercel.json
// reenvía /__/auth a Firebase). En el navegador normal todo sigue igual.
export const enApp = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
const mismoDominio = enApp && /(^|\.)mariancr\.es$/.test(location.hostname);

export let auth = null;
export let db = null;
if (configurado) {
  const app = initializeApp(mismoDominio ? { ...firebaseConfig, authDomain: location.host } : firebaseConfig);
  auth = getAuth(app);
  db = getDatabase(app);
}
