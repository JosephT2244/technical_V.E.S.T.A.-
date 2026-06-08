// Comentarios de programador: identifican proposito de bloques, datos y flujo sin alterar la logica.
// Archivo        | login.js: autenticacion local, bloqueo por intentos y sesion del tecnico.

'use strict';                                                                         // Modo estricto de JavaScript para evitar coerciones implicitas.

// Las credenciales reales viven en credentials.js, archivo local ignorado por Git.
// Para repos publicos se publica solo credentials.example.js con el formato esperado.
function resolveCredentials() {                                                       // Funcion resolveCredentials: obtiene credenciales locales sin publicarlas.
  if (typeof window !== 'undefined' &&                                                // Condicion: valida que el navegador haya cargado credenciales locales.
      window.VESTA_CREDENTIALS &&
      typeof window.VESTA_CREDENTIALS === 'object') {
    return Object.freeze({ ...window.VESTA_CREDENTIALS });                            // Retorno: clona y congela credenciales locales.
  }

  if (typeof CREDENTIALS !== 'undefined' &&                                           // Compatibilidad: acepta credentials.js antiguo con const CREDENTIALS.
      CREDENTIALS &&
      typeof CREDENTIALS === 'object') {
    return Object.freeze({ ...CREDENTIALS });                                         // Retorno: clona y congela credenciales heredadas.
  }

  return Object.freeze({});                                                           // Retorno: sin archivo privado, solo queda acceso invitado.
}

const ACTIVE_CREDENTIALS = resolveCredentials();                                      // Constante ACTIVE_CREDENTIALS: credenciales disponibles para login.

// ── Configuración de seguridad ──────────────────────────────────────────────
const SEC = Object.freeze({                                                           // Constante SEC: parametros de seguridad del login y la sesion.
  MAX_ATTEMPTS:    5,                                                                 // Campo MAX_ATTEMPTS: campo de datos para max attempts.
  LOCKOUT_MS:      15 * 60 * 1000,                                                    // Campo LOCKOUT_MS: campo de datos para autenticacion local.
  MIN_RESPONSE_MS: 400,                                                               // Campo MIN_RESPONSE_MS: campo de datos para min response ms.
  KEY_LOCKOUT:     '_vl',                                                             // Campo KEY_LOCKOUT: campo de datos para autenticacion local.
  KEY_ATTEMPTS:    '_va',                                                             // Campo KEY_ATTEMPTS: campo de datos para key attempts.
  KEY_SESSION:     '_vs',                                                             // Campo KEY_SESSION: campo de datos para autenticacion local.
  REDIRECT:        'technical_V.E.S.T.A..html'                                        // Campo REDIRECT: campo de datos para redirect.
});

// ── SHA-256 via Web Crypto ──────────────────────────────────────────────────
async function sha256(str) {                                                          // Funcion sha256: calcula hashes SHA-256 con Web Crypto.
  const buf = await crypto.subtle.digest(                                             // Constante buf: constante usada en buf.
    'SHA-256', new TextEncoder().encode(str)
  );
  return Array.from(new Uint8Array(buf))                                              // Retorno: entrega el resultado al llamador.
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Token de sesión ─────────────────────────────────────────────────────────
function generateToken() {                                                            // Funcion generateToken: crea tokens aleatorios para la sesion local.
  const arr = new Uint8Array(32);                                                     // Constante arr: constante usada en arr.
  crypto.getRandomValues(arr);                                                        // Llamada: ejecuta una accion del modulo actual.
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');          // Retorno: entrega el resultado al llamador.
}

// ── Gestión de intentos / bloqueo ───────────────────────────────────────────
function getLockout() {                                                               // Funcion getLockout: lee el bloqueo de login vigente si existe.
  try {                                                                               // Bloque try: ejecuta una operacion que puede fallar.
    const raw = localStorage.getItem(SEC.KEY_LOCKOUT);                                // Constante raw: constante usada en raw.
    if (!raw) return null;                                                            // Condicion: valida estado antes de continuar el flujo.
    const data = JSON.parse(raw);                                                     // Constante data: constante usada en data.
    if (Date.now() >= data.until) {                                                   // Condicion: valida estado antes de continuar el flujo.
      localStorage.removeItem(SEC.KEY_LOCKOUT);                                       // Llamada: ejecuta una accion del modulo actual.
      localStorage.removeItem(SEC.KEY_ATTEMPTS);                                      // Llamada: ejecuta una accion del modulo actual.
      return null;                                                                    // Retorno: entrega el resultado al llamador.
    }
    return data;                                                                      // Retorno: entrega el resultado al llamador.
  } catch { return null; }
}

function getAttempts() {                                                              // Funcion getAttempts: lee el contador de intentos fallidos.
  return parseInt(localStorage.getItem(SEC.KEY_ATTEMPTS) || '0', 10);                 // Retorno: entrega el resultado al llamador.
}

function recordFailure() {                                                            // Funcion recordFailure: registra un intento fallido y aplica bloqueo si corresponde.
  const attempts = getAttempts() + 1;                                                 // Constante attempts: constante usada en attempts.
  localStorage.setItem(SEC.KEY_ATTEMPTS, String(attempts));                           // Llamada: ejecuta una accion del modulo actual.
  if (attempts >= SEC.MAX_ATTEMPTS) {                                                 // Condicion: valida estado antes de continuar el flujo.
    const until = Date.now() + SEC.LOCKOUT_MS;                                        // Constante until: constante usada en until.
    localStorage.setItem(SEC.KEY_LOCKOUT, JSON.stringify({ until }));                 // Llamada: ejecuta una accion del modulo actual.
    localStorage.removeItem(SEC.KEY_ATTEMPTS);                                        // Llamada: ejecuta una accion del modulo actual.
    return { locked: true, until };                                                   // Retorno: entrega el resultado al llamador.
  }
  return { locked: false, remaining: SEC.MAX_ATTEMPTS - attempts };                   // Retorno: entrega el resultado al llamador.
}

function clearAttempts() {                                                            // Funcion clearAttempts: limpia intentos y bloqueo de autenticacion.
  localStorage.removeItem(SEC.KEY_ATTEMPTS);                                          // Llamada: ejecuta una accion del modulo actual.
  localStorage.removeItem(SEC.KEY_LOCKOUT);                                           // Llamada: ejecuta una accion del modulo actual.
}

// ── UI helpers ───────────────────────────────────────────────────────────────
function showError(msg) {                                                             // Funcion showError: muestra errores de login en la tarjeta.
  const el = document.getElementById('errMsg');                                       // Referencia el: nodo o coleccion DOM usada por la UI.
  el.textContent = msg;                                                               // Asignacion: actualiza estado o salida calculada.
  el.style.display = 'block';                                                         // Asignacion: actualiza estado o salida calculada.
  const card = document.querySelector('.card');                                       // Referencia card: nodo o coleccion DOM usada por la UI.
  card.classList.remove('shake');                                                     // Llamada: ejecuta una accion del modulo actual.
  void card.offsetWidth;
  card.classList.add('shake');                                                        // Llamada: ejecuta una accion del modulo actual.
}

function hideError() {                                                                // Funcion hideError: oculta el mensaje de error de login.
  document.getElementById('errMsg').style.display = 'none';                           // Llamada: ejecuta una accion del modulo actual.
}

function setLoading(on) {                                                             // Funcion setLoading: activa o desactiva el estado de verificacion.
  const btn = document.getElementById('loginBtn');                                    // Referencia btn: nodo o coleccion DOM usada por la UI.
  btn.disabled = on;                                                                  // Asignacion: actualiza estado o salida calculada.
  btn.textContent = on ? 'Verificando…' : 'Ingresar';                                 // Asignacion: actualiza estado o salida calculada.
}

function updateDots(used) {                                                           // Funcion updateDots: marca los indicadores de intentos consumidos.
  document.querySelectorAll('.dot').forEach((d, i) => {                               // Llamada: ejecuta una accion del modulo actual.
    d.classList.toggle('used', i < used);                                             // Llamada: ejecuta una accion del modulo actual.
  });
}

function updateLockoutUI(lockout) {                                                   // Funcion updateLockoutUI: refresca la barra visual de bloqueo.
  const bar  = document.getElementById('lockoutBar');                                 // Referencia bar: nodo o coleccion DOM usada por la UI.
  const fill = document.getElementById('lockoutFill');                                // Referencia fill: nodo o coleccion DOM usada por la UI.
  if (!lockout) { bar.style.display = 'none'; return; }                               // Condicion: valida estado antes de continuar el flujo.
  bar.style.display = 'block';                                                        // Asignacion: actualiza estado o salida calculada.
  const left = lockout.until - Date.now();                                            // Constante left: constante usada en left.
  fill.style.width = Math.max(0, (left / SEC.LOCKOUT_MS) * 100) + '%';                // Asignacion: actualiza estado o salida calculada.
}

// ── Login con usuario/contraseña ─────────────────────────────────────────────
async function doLogin(event) {                                                       // Funcion doLogin: valida credenciales y abre la sesion tecnica.
  event.preventDefault();                                                             // Llamada: ejecuta una accion del modulo actual.

  const lockout = getLockout();                                                       // Constante lockout: constante usada en autenticacion local.
  if (lockout) {                                                                      // Condicion: valida estado antes de continuar el flujo.
    const mins = Math.ceil((lockout.until - Date.now()) / 60000);                     // Constante mins: constante usada en mins.
    // Llamada: ejecuta una accion del modulo actual.
    showError(`Acceso bloqueado. Intenta en ${mins} min.`);
    return;                                                                           // Retorno: entrega el resultado al llamador.
  }

  setLoading(true);                                                                   // Llamada: ejecuta una accion del modulo actual.
  hideError();                                                                        // Llamada: ejecuta una accion del modulo actual.

  const username = document.getElementById('uInput').value.trim();                    // Referencia username: nodo o coleccion DOM usada por la UI.
  const password = document.getElementById('pInput').value;                           // Referencia password: nodo o coleccion DOM usada por la UI.

  if (!username || !password || username.length > 64 || password.length > 64) {       // Condicion: valida estado antes de continuar el flujo.
    await new Promise(r => setTimeout(r, SEC.MIN_RESPONSE_MS));                       // Espera asincrona: coordina una operacion externa.
    showError('Usuario o contraseña incorrectos.');                                   // Llamada: ejecuta una accion del modulo actual.
    setLoading(false);                                                                // Llamada: ejecuta una accion del modulo actual.
    return;                                                                           // Retorno: entrega el resultado al llamador.
  }

  const t0 = Date.now();                                                              // Constante t0: constante usada en t0.

  try {                                                                               // Bloque try: ejecuta una operacion que puede fallar.
    const hash       = await sha256(password);                                        // Constante hash: constante usada en hash.
    const storedHash = Object.prototype.hasOwnProperty.call(ACTIVE_CREDENTIALS, username) // Constante storedHash: constante usada en stored hash.
                       ? ACTIVE_CREDENTIALS[username] : null;

    const elapsed = Date.now() - t0;                                                  // Constante elapsed: constante usada en elapsed.
    if (elapsed < SEC.MIN_RESPONSE_MS) {                                              // Condicion: valida estado antes de continuar el flujo.
      await new Promise(r => setTimeout(r, SEC.MIN_RESPONSE_MS - elapsed));           // Espera asincrona: coordina una operacion externa.
    }

    const match = storedHash !== null &&                                              // Constante match: constante usada en match.
                  storedHash.length === hash.length &&                                // Asignacion: actualiza estado o salida calculada.
                  storedHash === hash;                                                // Asignacion: actualiza estado o salida calculada.

    if (match) {                                                                      // Condicion: valida estado antes de continuar el flujo.
      clearAttempts();                                                                // Llamada: ejecuta una accion del modulo actual.
      sessionStorage.setItem(SEC.KEY_SESSION, generateToken());                       // Llamada: ejecuta una accion del modulo actual.
      window.location.replace(SEC.REDIRECT);                                          // Llamada: ejecuta una accion del modulo actual.
    } else {
      const result = recordFailure();                                                 // Constante result: constante usada en result.
      updateDots(getAttempts() || SEC.MAX_ATTEMPTS);                                  // Llamada: ejecuta una accion del modulo actual.
      if (result.locked) {                                                            // Condicion: valida estado antes de continuar el flujo.
        showError('Demasiados intentos fallidos. Acceso bloqueado por 15 minutos.');  // Llamada: ejecuta una accion del modulo actual.
        updateLockoutUI(getLockout());                                                // Llamada: ejecuta una accion del modulo actual.
        startLockoutTimer();                                                          // Llamada: ejecuta una accion del modulo actual.
      } else {
        // Llamada: ejecuta una accion del modulo actual.
        showError(`Credenciales incorrectas. Intentos restantes: ${result.remaining}`);
      }
      document.getElementById('pInput').value = '';                                   // Llamada: ejecuta una accion del modulo actual.
      setLoading(false);                                                              // Llamada: ejecuta una accion del modulo actual.
    }
  } catch {
    showError('Error interno. Intenta de nuevo.');                                    // Llamada: ejecuta una accion del modulo actual.
    setLoading(false);                                                                // Llamada: ejecuta una accion del modulo actual.
  }
}

// ── Login como invitado ──────────────────────────────────────────────────────
function doGuestLogin() {                                                             // Funcion doGuestLogin: crea una sesion temporal de invitado.
  sessionStorage.setItem(SEC.KEY_SESSION, generateToken());                           // Llamada: ejecuta una accion del modulo actual.
  window.location.replace(SEC.REDIRECT);                                              // Llamada: ejecuta una accion del modulo actual.
}

// ── Temporizador de bloqueo ──────────────────────────────────────────────────
function startLockoutTimer() {                                                        // Funcion startLockoutTimer: mantiene actualizada la cuenta regresiva de bloqueo.
  const btn = document.getElementById('loginBtn');                                    // Referencia btn: nodo o coleccion DOM usada por la UI.
  btn.disabled = true;                                                                // Asignacion: actualiza estado o salida calculada.

  const tick = () => {                                                                // Funcion flecha tick: encapsula la logica de tick.
    const lock = getLockout();                                                        // Constante lock: constante usada en lock.
    if (!lock) {                                                                      // Condicion: valida estado antes de continuar el flujo.
      btn.disabled = false;                                                           // Asignacion: actualiza estado o salida calculada.
      hideError();                                                                    // Llamada: ejecuta una accion del modulo actual.
      updateLockoutUI(null);                                                          // Llamada: ejecuta una accion del modulo actual.
      updateDots(0);                                                                  // Llamada: ejecuta una accion del modulo actual.
      return;                                                                         // Retorno: entrega el resultado al llamador.
    }
    const left = lock.until - Date.now();                                             // Constante left: constante usada en left.
    document.getElementById('lockoutFill').style.width =                              // Llamada: ejecuta una accion del modulo actual.
      Math.max(0, (left / SEC.LOCKOUT_MS) * 100) + '%';                               // Llamada: ejecuta una accion del modulo actual.
    // Llamada: ejecuta una accion del modulo actual.
    showError(`Acceso bloqueado. Intenta en ${Math.ceil(left / 60000)} min.`);
    setTimeout(tick, 1000);                                                           // Llamada: ejecuta una accion del modulo actual.
  };
  tick();                                                                             // Llamada: ejecuta una accion del modulo actual.
}

// ── Inicialización ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {                                 // Llamada: ejecuta una accion del modulo actual.
  if (sessionStorage.getItem(SEC.KEY_SESSION)) {                                      // Condicion: valida estado antes de continuar el flujo.
    window.location.replace(SEC.REDIRECT);                                            // Llamada: ejecuta una accion del modulo actual.
    return;                                                                           // Retorno: entrega el resultado al llamador.
  }

  const lock = getLockout();                                                          // Constante lock: constante usada en lock.
  if (lock) {                                                                         // Condicion: valida estado antes de continuar el flujo.
    updateLockoutUI(lock);                                                            // Llamada: ejecuta una accion del modulo actual.
    startLockoutTimer();                                                              // Llamada: ejecuta una accion del modulo actual.
    updateDots(SEC.MAX_ATTEMPTS);                                                     // Llamada: ejecuta una accion del modulo actual.
  }

  document.getElementById('loginForm').addEventListener('submit', doLogin);           // Llamada: ejecuta una accion del modulo actual.
  document.getElementById('guestBtn').addEventListener('click', doGuestLogin);        // Llamada: ejecuta una accion del modulo actual.

  ['uInput', 'pInput'].forEach(id => {
    document.getElementById(id).addEventListener('input', hideError);                 // Llamada: ejecuta una accion del modulo actual.
  });

  document.getElementById('pInput').addEventListener('paste', e => {                  // Llamada: ejecuta una accion del modulo actual.
    e.preventDefault();                                                               // Llamada: ejecuta una accion del modulo actual.
  });
});
