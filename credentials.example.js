// ╔══════════════════════════════════════════════════════════════════╗
// ║  credentials.example.js — PLANTILLA                            ║
// ║                                                                 ║
// ║  1. Copia este archivo y renómbralo a  credentials.js          ║
// ║  2. credentials.js está en .gitignore — nunca se sube a GitHub ║
// ║  3. Las contraseñas van como hash SHA-256, nunca en texto plano ║
// ║                                                                 ║
// ║  Cómo obtener el hash de una contraseña:                       ║
// ║    Abre la consola del navegador (F12 → Consola) y ejecuta:    ║
// ║    crypto.subtle.digest('SHA-256',                             ║
// ║      new TextEncoder().encode('TuContraseña'))                 ║
// ║      .then(b => console.log(                                   ║
// ║        [...new Uint8Array(b)]                                  ║
// ║          .map(x=>x.toString(16).padStart(2,'0')).join('')))    ║
// ╚══════════════════════════════════════════════════════════════════╝

const CREDENTIALS = {
  "usuario_ejemplo_1": "hash_sha256_de_contraseña_1",
  "usuario_ejemplo_2": "hash_sha256_de_contraseña_2"
};
