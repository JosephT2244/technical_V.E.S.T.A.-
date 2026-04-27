'use strict';

// ── Credenciales ────────────────────────────────────────────────────────────
// Las contraseñas están como hashes SHA-256: no se puede obtener el texto
// original a partir de estos valores. Para agregar o cambiar usuarios edita
// este bloque. Ver credentials.example.js para instrucciones de hash.
const CREDENTIALS = {
  // ── Usuarios nombrados ──────────────────────────────────────────────────
  "JosephUbaldoTrejoHernandez":  "9b982d884d83c6f648bdf8c966acfd280e9ae4fa91b46fd7c72e31b3e8b5d39c",
  "ChristianYaelAngelesCruz":    "488a52d8033cbd1dbf26f729a4ff971f498c6b551d666440626814fede073935",
  "AxelHernandezHernandez":      "54837d7500a32237e036d983d919357240789c0c16fd34083f7bbcfea65e24cc",
  "MarcoAntonioCalderonPerez":   "0237efe4b52c6b853c71e9602c8ad3471d2bf25a18e44de317af9c4c944647b6",
  "ClodoaldoSalasAngeles":       "1bfc740b14609f8522ad0a41b31762086c0b26d727d4d36914a91a5015922d1d",
  // ── Usuarios numéricos ──────────────────────────────────────────────────
  "2026100011": "9bbada3e979c5e3fb114e31a09aece06744b584d4435f9a40005bc6a43134769",
  "2026200022": "ee8a20328e9d68c64554f7d500871e8f305c9cd824b6771acaedc4d7ed906d1f",
  "2026300033": "e1fc4f31607a422dcd74353db56981b941b65f3c781f926d611d59e6236b059b",
  "2026400044": "4112e5290fe0e2e92c076bfed45841e9f8fdee374ae5cd8a95f8b79abf38a32d",
  "2026500055": "298202ce0acf52c5c04eb70aa4d783e3fc900783634f2885dfd28c6f802a277d",
  "2026600066": "8ff6875f1a00cbe6cbe3753f5231557f406d4ca281be57c8b30898d01b90b682",
  "2026700077": "2818598fe50aa79075806ccd8e7d56fa42a0c0ffa357c60736b5bcbd7a8bc935",
  "2026800088": "0a401708ad6cd5ca07744df6a9d3d6265a7b9dd4056a7dab078a21e479c97887",
  "2026900099": "cc8bea2ee3e419e2e00a18c203a89ec17e5bbd3dacc76a55df1ce79df541c13a",
  "2026010101": "bf6320f658b999d8d4019d0425cba6de5a02881c0b04e89f9e58f6aa7e87f4e9",
  "2026121212": "87a3797b7d0afa4c4385c93a0bc438317f0a7c900c7f93c92572048bc617df50",
  "2026232323": "f9baae70373662a727d5f63ed17adfb0795743a4d2bdda09f60438e2a701c57e",
  "2026343434": "1db30abf6dccaf08802f44f88039aa3ce1ed96bbae26b3fa95b4df6f80297142",
  "2026454545": "8d2608900cce2d7035d25e35d68df6a4ff13310b74fd948fdfdab61a8a7c57b6",
  "2026565656": "2c4a7b1a644ed4ed927b14c7ae693544a5501bfa6b79ab8c22e92a9f5fe5b830",
  "2026676767": "4d16f9812cd56b7d06fa676a675a897c8dad73056bcc899913c41d3d17fd276b",
  "2026787878": "0bd3054f16df1ca7f97d589ca235992b53ecda2e7cc7eedff084f8dd05f755c0",
  "2026898989": "ef60c2e4c5aafa03af031f21978d03a85161f0f30ddf7af0b9934a484c683c95",
  "2026909090": "65d89efaa25a19e1bf94b11b63ddf85664d53306861e3bb03c32ecd7ea9ddcbd",
  "2026111213": "9e73a3185f628716130dbc2790d36503b9e634adefd845b24a02e5765d27cc75",
  "2026222324": "e7afb1405a14c4e3ec6560dcf6e5c53cbd75e4b64ec8de6017dec965f1404905",
  "2026333435": "3c17b3af60a0766ed01d1196ba1eea2306b39922b9b3535a3c7937d0d215fbb6",
  "2026444546": "1ee7e9c6aa8719b4957eb8a1e7758ccc61a86e65de79d5fd7294476d50f3571a",
  "2026555657": "368d2b6b21b00445da3d35081754d56b160760e76b80354a32e0823ee5a9399c",
  "2026666768": "ff843cec27e7d3e3462418687750f32ed835cecac7e1351498363a6c86787866",
  "2026777879": "e495d300152086ac2415bd07b91d291acf82053bd8c1dbc5619d804502d605f7",
  "2026888980": "12b1ef816a0a4d9665023793a569936338d64b816d3e0c5e5b6e8110da63abf2",
  "2026999091": "1a6775a1c67d99bf2ac7afd46d3a1e14379691453f57b935d02551a41d73be5f",
  "2026000102": "b7073cc310b7fd46aff105c86bb54f876e9b06af552166bb3dabb5948e7db93f",
  "2026111314": "3c0508ecc5c004f4a172e10d1589f924813a718b84fe1f431850ddb64b5fb760",
  "2026135246": "6068c34c308ae59a7f796257a3fe4afa8d8a007ab4e46a4fb1b8260cd166e529",
  "2026246357": "d8134464bb341377e0875ff16052d4930fd4e110b80395998cb2a0de0fb38537",
  "2026357468": "7a15fab84ce2b5db7d0e5fe46ad825eedd4e6fd9a9a39cb6dfe74ac5be7c9867",
  "2026468579": "9e7f7ef3a24be7312f5e76246c62fa303f2f83de3126ab233dba06a04735c4c1",
  "2026579680": "05e538715ffa019133b9d19516c552b9eebba449340e24629ae27d49933ba5b7",
  "2026680791": "a01e110e33a8a68fe61c91bb31bc2aadf19bba35c10e5fcbee68b5762d35a044",
  "2026791802": "09d1b66e27cb1a5f9bd3c4513d98c47188ed98c1c6057a1c01e2d614ae7afa05",
  "2026802913": "3cfa7e4d11667e9ae6fbb4d2da2fc511924bd04d9ba9aa6b62b1f39bc3da54c3",
  "2026913024": "8dc671c4b1b23a0a32ce624818f446ae20863af39f1228229d958859d96709b9",
  "2026024135": "36953493a4412103950cee366a289a754acd9a4a04f24b5d6bf9e1d2a0fb6824",
  "2026135792": "a8910f4a5c9f658970197d0f13d912ae7e920a2db50346f67dce19802ae8d8b1",
  "2026246803": "138b14bddb1fe0e235221f41eca4f2fb056046fff06a0d7fb56083d86b7243ea",
  "2026357914": "cfc364e208a59b633528798c3508902d705268695287c4e4dc7b2184f1c7e109",
  "2026468025": "cb1ff33593c2c2233a19dcd6de5abecae91698300b7f27ed26798ad837fc1d1a",
  "2026579136": "171ebc58612a083bc819a6a33b2deff12f6b37017c33325e067368dcdcf59131"
};

// ── Configuración de seguridad ──────────────────────────────────────────────
const SEC = Object.freeze({
  MAX_ATTEMPTS:    5,
  LOCKOUT_MS:      15 * 60 * 1000,
  MIN_RESPONSE_MS: 400,
  KEY_LOCKOUT:     '_vl',
  KEY_ATTEMPTS:    '_va',
  KEY_SESSION:     '_vs',
  REDIRECT:        'technical_V.E.S.T.A..html'
});

// ── SHA-256 via Web Crypto ──────────────────────────────────────────────────
async function sha256(str) {
  const buf = await crypto.subtle.digest(
    'SHA-256', new TextEncoder().encode(str)
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Token de sesión ─────────────────────────────────────────────────────────
function generateToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Gestión de intentos / bloqueo ───────────────────────────────────────────
function getLockout() {
  try {
    const raw = localStorage.getItem(SEC.KEY_LOCKOUT);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() >= data.until) {
      localStorage.removeItem(SEC.KEY_LOCKOUT);
      localStorage.removeItem(SEC.KEY_ATTEMPTS);
      return null;
    }
    return data;
  } catch { return null; }
}

function getAttempts() {
  return parseInt(localStorage.getItem(SEC.KEY_ATTEMPTS) || '0', 10);
}

function recordFailure() {
  const attempts = getAttempts() + 1;
  localStorage.setItem(SEC.KEY_ATTEMPTS, String(attempts));
  if (attempts >= SEC.MAX_ATTEMPTS) {
    const until = Date.now() + SEC.LOCKOUT_MS;
    localStorage.setItem(SEC.KEY_LOCKOUT, JSON.stringify({ until }));
    localStorage.removeItem(SEC.KEY_ATTEMPTS);
    return { locked: true, until };
  }
  return { locked: false, remaining: SEC.MAX_ATTEMPTS - attempts };
}

function clearAttempts() {
  localStorage.removeItem(SEC.KEY_ATTEMPTS);
  localStorage.removeItem(SEC.KEY_LOCKOUT);
}

// ── UI helpers ───────────────────────────────────────────────────────────────
function showError(msg) {
  const el = document.getElementById('errMsg');
  el.textContent = msg;
  el.style.display = 'block';
  const card = document.querySelector('.card');
  card.classList.remove('shake');
  void card.offsetWidth;
  card.classList.add('shake');
}

function hideError() {
  document.getElementById('errMsg').style.display = 'none';
}

function setLoading(on) {
  const btn = document.getElementById('loginBtn');
  btn.disabled = on;
  btn.textContent = on ? 'Verificando…' : 'Ingresar';
}

function updateDots(used) {
  document.querySelectorAll('.dot').forEach((d, i) => {
    d.classList.toggle('used', i < used);
  });
}

function updateLockoutUI(lockout) {
  const bar  = document.getElementById('lockoutBar');
  const fill = document.getElementById('lockoutFill');
  if (!lockout) { bar.style.display = 'none'; return; }
  bar.style.display = 'block';
  const left = lockout.until - Date.now();
  fill.style.width = Math.max(0, (left / SEC.LOCKOUT_MS) * 100) + '%';
}

// ── Login con usuario/contraseña ─────────────────────────────────────────────
async function doLogin(event) {
  event.preventDefault();

  const lockout = getLockout();
  if (lockout) {
    const mins = Math.ceil((lockout.until - Date.now()) / 60000);
    showError(`Acceso bloqueado. Intenta en ${mins} min.`);
    return;
  }

  setLoading(true);
  hideError();

  const username = document.getElementById('uInput').value.trim();
  const password = document.getElementById('pInput').value;

  if (!username || !password || username.length > 64 || password.length > 64) {
    await new Promise(r => setTimeout(r, SEC.MIN_RESPONSE_MS));
    showError('Usuario o contraseña incorrectos.');
    setLoading(false);
    return;
  }

  const t0 = Date.now();

  try {
    const hash       = await sha256(password);
    const storedHash = Object.prototype.hasOwnProperty.call(CREDENTIALS, username)
                       ? CREDENTIALS[username] : null;

    const elapsed = Date.now() - t0;
    if (elapsed < SEC.MIN_RESPONSE_MS) {
      await new Promise(r => setTimeout(r, SEC.MIN_RESPONSE_MS - elapsed));
    }

    const match = storedHash !== null &&
                  storedHash.length === hash.length &&
                  storedHash === hash;

    if (match) {
      clearAttempts();
      sessionStorage.setItem(SEC.KEY_SESSION, generateToken());
      window.location.replace(SEC.REDIRECT);
    } else {
      const result = recordFailure();
      updateDots(getAttempts() || SEC.MAX_ATTEMPTS);
      if (result.locked) {
        showError('Demasiados intentos fallidos. Acceso bloqueado por 15 minutos.');
        updateLockoutUI(getLockout());
        startLockoutTimer();
      } else {
        showError(`Credenciales incorrectas. Intentos restantes: ${result.remaining}`);
      }
      document.getElementById('pInput').value = '';
      setLoading(false);
    }
  } catch {
    showError('Error interno. Intenta de nuevo.');
    setLoading(false);
  }
}

// ── Login como invitado ──────────────────────────────────────────────────────
function doGuestLogin() {
  sessionStorage.setItem(SEC.KEY_SESSION, generateToken());
  window.location.replace(SEC.REDIRECT);
}

// ── Temporizador de bloqueo ──────────────────────────────────────────────────
function startLockoutTimer() {
  const btn = document.getElementById('loginBtn');
  btn.disabled = true;

  const tick = () => {
    const lock = getLockout();
    if (!lock) {
      btn.disabled = false;
      hideError();
      updateLockoutUI(null);
      updateDots(0);
      return;
    }
    const left = lock.until - Date.now();
    document.getElementById('lockoutFill').style.width =
      Math.max(0, (left / SEC.LOCKOUT_MS) * 100) + '%';
    showError(`Acceso bloqueado. Intenta en ${Math.ceil(left / 60000)} min.`);
    setTimeout(tick, 1000);
  };
  tick();
}

// ── Inicialización ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem(SEC.KEY_SESSION)) {
    window.location.replace(SEC.REDIRECT);
    return;
  }

  const lock = getLockout();
  if (lock) {
    updateLockoutUI(lock);
    startLockoutTimer();
    updateDots(SEC.MAX_ATTEMPTS);
  }

  document.getElementById('loginForm').addEventListener('submit', doLogin);
  document.getElementById('guestBtn').addEventListener('click', doGuestLogin);

  ['uInput', 'pInput'].forEach(id => {
    document.getElementById(id).addEventListener('input', hideError);
  });

  document.getElementById('pInput').addEventListener('paste', e => {
    e.preventDefault();
  });
});
