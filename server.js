// Comentarios de programador: identifican proposito de bloques, datos y flujo sin alterar la logica.
// Archivo        | server.js: API local para firmware, puertos seriales, WiFi y camara.

"use strict";                                                                         // Modo estricto de JavaScript para evitar coerciones implicitas.

const fs = require("fs");                                                             // Constante fs: constante usada en fs.
const http = require("http");                                                         // Constante http: constante usada en http.
const https = require("https");                                                       // Constante https: constante usada en https.
const os = require("os");                                                             // Constante os: constante usada en os.
const path = require("path");                                                         // Constante path: constante usada en path.
const { execFile, spawn } = require("child_process");                                 // Importacion execFile, spawn: dependencias Node usadas por el servidor.
const { URL } = require("url");                                                       // Importacion URL: dependencias Node usadas por el servidor.

const root = __dirname;                                                               // Constante root: constante usada en root.
const firstPort = Number(process.argv[2]) || 5177;                                    // Constante firstPort: constante usada en comunicaciones y puertos.

const mime = {                                                                        // Objeto mime: tabla de tipos MIME para servir archivos estaticos.
  ".html": "text/html; charset=utf-8",                                                // Campo .html: campo de datos para .html.
  ".css": "text/css; charset=utf-8",                                                  // Campo .css: campo de datos para .css.
  ".js": "text/javascript; charset=utf-8",                                            // Campo .js: campo de datos para .js.
  ".json": "application/json; charset=utf-8",                                         // Campo .json: campo de datos para .json.
  ".ino": "text/plain; charset=utf-8",                                                // Campo .ino: campo de datos para .ino.
  ".h": "text/plain; charset=utf-8",                                                  // Campo .h: campo de datos para .h.
  ".cpp": "text/plain; charset=utf-8",                                                // Campo .cpp: campo de datos para .cpp.
  ".txt": "text/plain; charset=utf-8",                                                // Campo .txt: campo de datos para .txt.
  ".png": "image/png",                                                                // Campo .png: campo de datos para .png.
  ".jpg": "image/jpeg",                                                               // Campo .jpg: campo de datos para .jpg.
  ".jpeg": "image/jpeg",                                                              // Campo .jpeg: campo de datos para .jpeg.
  ".svg": "image/svg+xml; charset=utf-8",                                             // Campo .svg: campo de datos para .svg.
  ".ico": "image/x-icon"                                                              // Campo .ico: campo de datos para .ico.
};

function resolveArduinoCli() {                                                        // Funcion resolveArduinoCli: localiza el ejecutable de arduino-cli disponible.
  const candidates = [                                                                // Arreglo candidates: arreglo de datos para candidates.
    process.env.ARDUINO_CLI,
    path.join(root, "arduino-cli.exe"),                                               // Llamada: ejecuta una accion del modulo actual.
    path.join(root, "arduino-cli"),                                                   // Llamada: ejecuta una accion del modulo actual.
    "arduino-cli"
  ].filter(Boolean);

  for (const candidate of candidates) {                                               // Bucle: recorre datos o reintenta una operacion controlada.
    if (candidate === "arduino-cli") return candidate;                                // Condicion: valida estado antes de continuar el flujo.
    if (fs.existsSync(candidate)) return candidate;                                   // Condicion: valida estado antes de continuar el flujo.
  }
  return "arduino-cli";                                                               // Retorno: entrega el resultado al llamador.
}

const arduinoCli = resolveArduinoCli();                                               // Constante arduinoCli: constante usada en firmware y compilacion Arduino.
const CAM_AP_SSID = "VESTA-CAM-SETUP";                                                // Constante CAM_AP_SSID: constante usada en camara y video.
const CAM_AP_PASSWORD = "vesta1234";                                                  // Constante CAM_AP_PASSWORD: constante usada en camara y video.
const CAM_USB_STREAM_BAUD = 230400;                                                   // Constante CAM_USB_STREAM_BAUD: constante usada en camara y video.
const CAM_USB_STREAM_BOUNDARY = "123456789000000000000987654321";                     // Constante CAM_USB_STREAM_BOUNDARY: constante usada en camara y video.
const CAM_USB_STREAM_MARKER = "VESTA_USB_MJPEG_BEGIN";                                // Constante CAM_USB_STREAM_MARKER: constante usada en camara y video.
const CAM_USB_MARKER_TIMEOUT_MS = 6500;                                               // Constante CAM_USB_MARKER_TIMEOUT_MS: constante usada en camara y video.
const CAM_USB_FRAME_TIMEOUT_MS = 9000;                                                // Constante CAM_USB_FRAME_TIMEOUT_MS: constante usada en camara y video.
let localServerPort = firstPort;                                                      // Estado localServerPort: estado mutable de comunicaciones y puertos.
let serialBridge = null;                                                              // Estado serialBridge: estado mutable de comunicaciones y puertos.
let wifiBeforeCam = null;                                                             // Estado wifiBeforeCam: estado mutable de camara y video.
let camWifiHoldTimer = null;                                                          // Estado camWifiHoldTimer: estado mutable de camara y video.
const serialClients = new Set();                                                      // Conjunto serialClients: clientes SSE conectados al puente serial.
const PORT_CACHE_MS = 2000;                                                           // Constante PORT_CACHE_MS: constante usada en comunicaciones y puertos.
let portsCache = { at: 0, result: null, inFlight: null };                             // Objeto portsCache: cache temporal para reducir consultas repetidas de puertos.

// COM port watcher: detects newly-attached devices and pushes "port-added"
// events through the SSE channel so the UI can ask the user what to do.
const PORT_WATCH_INTERVAL_MS = 2500;                                                  // Constante PORT_WATCH_INTERVAL_MS: constante usada en comunicaciones y puertos.
let knownPortAddresses = null; // null until first snapshot taken
let portWatcherTimer = null;                                                          // Estado portWatcherTimer: estado mutable de comunicaciones y puertos.
let portWatcherRunning = false;                                                       // Estado portWatcherRunning: estado mutable de comunicaciones y puertos.
const corsHeaders = {                                                                 // Objeto corsHeaders: cabeceras CORS comunes para las respuestas API.
  "Access-Control-Allow-Origin": "*",                                                 // Campo Access-Control-Allow-Origin: campo de datos para access control allow origin.
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",                                 // Campo Access-Control-Allow-Methods: campo de datos para access control allow methods.
  "Access-Control-Allow-Headers": "Content-Type"                                      // Campo Access-Control-Allow-Headers: campo de datos para access control allow headers.
};

const bundledFirmware = {                                                             // Objeto bundledFirmware: rutas del firmware incluido y sus archivos auxiliares.
  s3: {                                                                               // Campo s3: objeto anidado de configuracion.
    sketchName: "esp32_s3_controller",                                                // Campo sketchName: campo de datos para firmware y compilacion Arduino.
    ino: path.join(root, "esp32_s3_controller", "esp32_s3_controller.ino"),           // Campo ino: campo de datos para ino.
    extraFiles: [path.join(root, "esp32_s3_config.h")]                                // Campo extraFiles: arreglo de configuracion.
  },
  cam: {                                                                              // Campo cam: objeto anidado de configuracion.
    sketchName: "esp32_cam_assistant",                                                // Campo sketchName: campo de datos para firmware y compilacion Arduino.
    ino: path.join(root, "esp32_cam_assistant.ino"),                                  // Campo ino: campo de datos para ino.
    extraFiles: [path.join(root, "esp32_cam_config.h")]                               // Campo extraFiles: arreglo de configuracion.
  }
};

const DEFAULT_FQBNS = {                                                               // Objeto DEFAULT_FQBNS: FQBN por defecto para cada placa soportada.
  s3: "esp32:esp32:esp32s3:USBMode=hwcdc,CDCOnBoot=default,FlashSize=16M,PSRAM=opi,PartitionScheme=app3M_fat9M_16MB", // Campo s3: campo de datos para s3.
  cam: "esp32:esp32:esp32cam"                                                         // Campo cam: campo de datos para camara y video.
};
const GENERIC_ESP32_FQBNS = new Set(["esp32:esp32:esp32_family"]);                    // Conjunto GENERIC_ESP32_FQBNS: FQBN genericos que se tratan como no especificos.
const ARDUINO_COMPILE_TIMEOUT_MS = 900000;                                            // Constante ARDUINO_COMPILE_TIMEOUT_MS: constante usada en firmware y compilacion Arduino.
const ARDUINO_UPLOAD_TIMEOUT_MS = 420000;                                             // Constante ARDUINO_UPLOAD_TIMEOUT_MS: constante usada en firmware y compilacion Arduino.
const ARDUINO_BOOT_COUNTDOWN_SECONDS = 8;                                             // Constante ARDUINO_BOOT_COUNTDOWN_SECONDS: margen para presionar BOOT antes de subir.
let lastDetectedUpload = { port: "", board: "", name: "", device: "" };               // Objeto lastDetectedUpload: ultimo objetivo de subida detectado automaticamente.

function run(file, args, options = {}) {                                              // Funcion run: ejecuta un proceso hijo y devuelve salida completa.
  return new Promise((resolve) => {                                                   // Retorno: entrega el resultado al llamador.
    execFile(file, args, { cwd: root, windowsHide: true, timeout: 120000, ...options }, (error, stdout, stderr) => { // Llamada: ejecuta una accion del modulo actual.
      resolve({                                                                       // Llamada: ejecuta una accion del modulo actual.
        ok: !error,                                                                   // Campo ok: campo de datos para ok.
        code: error?.code ?? 0,                                                       // Campo code: campo de datos para code.
        output: [stdout, stderr].filter(Boolean).join("\n").trim(),                   // Campo output: arreglo de configuracion.
        error: error?.message || ""                                                   // Campo error: campo de datos para error.
      });
    });
  });
}

function delay(ms) {                                                                  // Funcion delay: encapsula la logica de delay.
  return new Promise((resolve) => setTimeout(resolve, ms));                           // Retorno: entrega el resultado al llamador.
}

function sendNdjson(res, data) {                                                      // Funcion sendNdjson: envia ndjson.
  // Llamada: ejecuta una accion del modulo actual.
  res.write(`${JSON.stringify(data)}\n`);
}

function runStreaming(file, args, options = {}, onEvent = () => {}) {                 // Funcion runStreaming: ejecuta un proceso hijo enviando eventos incrementales.
  return new Promise((resolve) => {                                                   // Retorno: entrega el resultado al llamador.
    let output = "";                                                                  // Estado output: estado mutable de output.
    let settled = false;                                                              // Estado settled: estado mutable de settled.
    const timeoutMs = options.timeout || 120000;                                      // Constante timeoutMs: constante usada en timeout ms.
    const child = spawn(file, args, {                                                 // Constante child: constante usada en child.
      cwd: root,                                                                      // Campo cwd: campo de datos para cwd.
      windowsHide: true,                                                              // Campo windowsHide: campo de datos para comunicaciones y puertos.
      stdio: ["ignore", "pipe", "pipe"]                                               // Campo stdio: arreglo de configuracion.
    });

    const timer = setTimeout(() => {                                                  // Constante timer: constante usada en timer.
      if (settled) return;                                                            // Condicion: valida estado antes de continuar el flujo.
      output += `\nTiempo agotado despues de ${Math.round(timeoutMs / 1000)}s`;
      // Llamada: ejecuta una accion del modulo actual.
      onEvent({ type: "log", stream: "stderr", text: `\nTiempo agotado despues de ${Math.round(timeoutMs / 1000)}s\n` });
      child.kill();                                                                   // Llamada: ejecuta una accion del modulo actual.
    }, timeoutMs);

    const handleData = (stream, chunk) => {                                           // Funcion flecha handleData: atiende data.
      const text = chunk.toString("utf8");                                            // Constante text: constante usada en text.
      output += text;
      onEvent({ type: "log", stream, text });                                         // Llamada: ejecuta una accion del modulo actual.
    };

    child.stdout.on("data", (chunk) => handleData("stdout", chunk));                  // Llamada: ejecuta una accion del modulo actual.
    child.stderr.on("data", (chunk) => handleData("stderr", chunk));                  // Llamada: ejecuta una accion del modulo actual.
    child.on("error", (error) => {                                                    // Llamada: ejecuta una accion del modulo actual.
      if (settled) return;                                                            // Condicion: valida estado antes de continuar el flujo.
      settled = true;                                                                 // Asignacion: actualiza estado o salida calculada.
      clearTimeout(timer);                                                            // Llamada: ejecuta una accion del modulo actual.
      output += `\n${error.message}`;
      resolve({ ok: false, code: -1, output: output.trim(), error: error.message });  // Llamada: ejecuta una accion del modulo actual.
    });
    child.on("exit", (code) => {                                                      // Llamada: ejecuta una accion del modulo actual.
      if (settled) return;                                                            // Condicion: valida estado antes de continuar el flujo.
      settled = true;                                                                 // Asignacion: actualiza estado o salida calculada.
      clearTimeout(timer);                                                            // Llamada: ejecuta una accion del modulo actual.
      resolve({                                                                       // Llamada: ejecuta una accion del modulo actual.
        ok: code === 0,                                                               // Campo ok: campo de datos para ok.
        code,
        output: output.trim(),                                                        // Campo output: campo de datos para output.
        // Campo error: campo de datos para error.
        error: code === 0 ? "" : `Proceso finalizado con codigo ${code}`
      });
    });
  });
}

function sendJson(res, status, data) {                                                // Funcion sendJson: responde una peticion HTTP con JSON y cabeceras comunes.
  res.writeHead(status, {                                                             // Llamada: ejecuta una accion del modulo actual.
    "Content-Type": "application/json; charset=utf-8",                                // Campo Content-Type: campo de datos para content type.
    "Cache-Control": "no-store",                                                      // Campo Cache-Control: campo de datos para cache control.
    ...corsHeaders
  });
  res.end(JSON.stringify(data));                                                      // Llamada: ejecuta una accion del modulo actual.
}

function sendSse(res, event, data) {                                                  // Funcion sendSse: emite un evento Server-Sent Event a un cliente.
  // Llamada: ejecuta una accion del modulo actual.
  res.write(`event: ${event}\n`);
  // Llamada: ejecuta una accion del modulo actual.
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function broadcastSerial(event, data) {                                               // Funcion broadcastSerial: reenvia un evento a todos los clientes serial via SSE.
  for (const client of serialClients) {                                               // Bucle: recorre datos o reintenta una operacion controlada.
    sendSse(client, event, data);                                                     // Llamada: ejecuta una accion del modulo actual.
  }
}

function readJsonBody(req, limit = 3_000_000) {                                       // Funcion readJsonBody: lee y valida el cuerpo JSON de una peticion HTTP.
  return new Promise((resolve, reject) => {                                           // Retorno: entrega el resultado al llamador.
    let body = "";                                                                    // Estado body: estado mutable de body.
    req.on("data", (chunk) => {                                                       // Llamada: ejecuta una accion del modulo actual.
      body += chunk;
      if (body.length > limit) {                                                      // Condicion: valida estado antes de continuar el flujo.
        reject(new Error("Payload demasiado grande"));                                // Llamada: ejecuta una accion del modulo actual.
        req.destroy();                                                                // Llamada: ejecuta una accion del modulo actual.
      }
    });
    req.on("end", () => {                                                             // Llamada: ejecuta una accion del modulo actual.
      try {                                                                           // Bloque try: ejecuta una operacion que puede fallar.
        resolve(body ? JSON.parse(body) : {});                                        // Llamada: ejecuta una accion del modulo actual.
      } catch {
        reject(new Error("JSON invalido"));                                           // Llamada: ejecuta una accion del modulo actual.
      }
    });
    req.on("error", reject);                                                          // Llamada: ejecuta una accion del modulo actual.
  });
}

function parseBoardList(stdout) {                                                     // Funcion parseBoardList: normaliza la salida JSON de arduino-cli board list.
  try {                                                                               // Bloque try: ejecuta una operacion que puede fallar.
    const data = JSON.parse(stdout);                                                  // Constante data: constante usada en data.
    const rawPorts = Array.isArray(data)                                              // Constante rawPorts: constante usada en comunicaciones y puertos.
      ? data
      : Array.isArray(data.detected_ports)
        ? data.detected_ports
        : Array.isArray(data.ports)
          ? data.ports
          : [];

    return rawPorts.map((entry) => {                                                  // Retorno: entrega el resultado al llamador.
      const portInfo = entry.port || entry;                                           // Constante portInfo: constante usada en comunicaciones y puertos.
      const boards = Array.isArray(entry.matching_boards)                             // Constante boards: constante usada en boards.
        ? entry.matching_boards
        : Array.isArray(entry.boards)
          ? entry.boards
          : [];
      const board = boards[0] || {};                                                  // Constante board: constante usada en board.
      const properties = {                                                            // Objeto properties: objeto de configuracion para properties.
        ...(entry.properties || {}),
        ...(portInfo.properties || {})
      };
      const port = {                                                                  // Objeto port: objeto de configuracion para comunicaciones y puertos.
        address: portInfo.address || entry.address || portInfo.name || "",            // Campo address: campo de datos para address.
        board: board.fqbn || "",                                                      // Campo board: campo de datos para board.
        name: board.name || portInfo.label || entry.label || "",                      // Campo name: campo de datos para name.
        label: portInfo.protocol_label || portInfo.label || entry.protocol_label || portInfo.protocol || entry.protocol || "Serial", // Campo label: campo de datos para label.
        pnpId: portInfo.hardware_id || entry.hardware_id || properties.serialNumber || "", // Campo pnpId: campo de datos para pnp id.
        vendorId: properties.vid || properties.vendorId || "",                        // Campo vendorId: campo de datos para vendor id.
        productId: properties.pid || properties.productId || ""                       // Campo productId: campo de datos para product id.
      };
      port.kind = isBluetoothPort(port) ? "bluetooth" : "serial";                     // Asignacion: actualiza estado o salida calculada.
      port.guess = guessDevice(port);                                                 // Asignacion: actualiza estado o salida calculada.
      return port;                                                                    // Retorno: entrega el resultado al llamador.
    }).filter((item) => item.address);
  } catch {
    return [];                                                                        // Retorno: entrega el resultado al llamador.
  }
}

function isGenericSerialLabel(label) {                                                // Funcion isGenericSerialLabel: evalua generic serial label.
  const value = String(label || "").trim().toLowerCase();                             // Constante value: constante usada en value.
  return !value || value === "serial" || value === "serial port" || value === "serial port (usb)"; // Retorno: entrega el resultado al llamador.
}

function isBluetoothPort(port) {                                                      // Funcion isBluetoothPort: evalua bluetooth port.
  const haystack = [                                                                  // Arreglo haystack: arreglo de datos para haystack.
    port.address,
    port.name,
    port.label,
    port.pnpId
  ].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes("bluetooth") || haystack.includes("bthenum");              // Retorno: entrega el resultado al llamador.
}

function normalizeUsbId(value) {                                                      // Funcion normalizeUsbId: normaliza usb id.
  return String(value || "").trim().toLowerCase().replace(/^0x/, "");                 // Retorno: entrega el resultado al llamador.
}

function guessDevice(port) {                                                          // Funcion guessDevice: encapsula la logica de guess device.
  const haystack = [                                                                  // Arreglo haystack: arreglo de datos para haystack.
    port.address,
    port.board,
    port.name,
    port.label,
    port.pnpId,
    port.vendorId,
    port.productId
  ].filter(Boolean).join(" ").toLowerCase();
  const vendorId = normalizeUsbId(port.vendorId);                                     // Constante vendorId: constante usada en vendor id.
  const productId = normalizeUsbId(port.productId);                                   // Constante productId: constante usada en product id.

  if (isBluetoothPort(port)) {                                                        // Condicion: valida estado antes de continuar el flujo.
    return "";                                                                        // Retorno: entrega el resultado al llamador.
  }
  if (haystack.includes("esp32-cam") || haystack.includes("ai thinker")) {            // Condicion: valida estado antes de continuar el flujo.
    return "cam";                                                                     // Retorno: entrega el resultado al llamador.
  }
  if (haystack.includes("esp32-s3") || haystack.includes("esp32s3") ||                // Condicion: valida estado antes de continuar el flujo.
      haystack.includes("usb jtag") || haystack.includes("jtag/serial") ||            // Llamada: ejecuta una accion del modulo actual.
      (vendorId === "303a" && (productId === "1001" || productId === "1002"))) {
    return "s3";                                                                      // Retorno: entrega el resultado al llamador.
  }
  if (vendorId === "303a" || vendorId === "10c4" || vendorId === "1a86" ||            // Condicion: valida estado antes de continuar el flujo.
      vendorId === "0403" || vendorId === "067b" ||                                   // Asignacion: actualiza estado o salida calculada.
      haystack.includes("espressif") || haystack.includes("esp32") ||                 // Llamada: ejecuta una accion del modulo actual.
      haystack.includes("cp210") || haystack.includes("cp210x") ||                    // Llamada: ejecuta una accion del modulo actual.
      haystack.includes("ch340") || haystack.includes("ch341") ||                     // Llamada: ejecuta una accion del modulo actual.
      haystack.includes("ch343") || haystack.includes("ch910") ||                     // Llamada: ejecuta una accion del modulo actual.
      haystack.includes("wch") || haystack.includes("qinheng") ||                     // Llamada: ejecuta una accion del modulo actual.
      haystack.includes("ftdi") || haystack.includes("ft232") ||                      // Llamada: ejecuta una accion del modulo actual.
      haystack.includes("ft231") || haystack.includes("pl2303") ||                    // Llamada: ejecuta una accion del modulo actual.
      haystack.includes("prolific") || haystack.includes("silicon labs") ||           // Llamada: ejecuta una accion del modulo actual.
      haystack.includes("usb-enhanced-serial")) {                                     // Llamada: ejecuta una accion del modulo actual.
    return "esp32";                                                                   // Retorno: entrega el resultado al llamador.
  }
  return "";                                                                          // Retorno: entrega el resultado al llamador.
}

function portPriority(port) {                                                         // Funcion portPriority: encapsula la logica de comunicaciones y puertos.
  if (port.guess === "s3") return 0;                                                  // Condicion: valida estado antes de continuar el flujo.
  if (port.guess === "cam") return 1;                                                 // Condicion: valida estado antes de continuar el flujo.
  if (port.guess === "esp32") return 2;                                               // Condicion: valida estado antes de continuar el flujo.
  if (isBluetoothPort(port)) return 9;                                                // Condicion: valida estado antes de continuar el flujo.
  return 5;                                                                           // Retorno: entrega el resultado al llamador.
}

async function systemSerialPorts() {                                                  // Funcion systemSerialPorts: encapsula la logica de comunicaciones y puertos.
  if (process.platform !== "win32") return [];                                        // Condicion: valida estado antes de continuar el flujo.
  // Constante script: constante usada en script.
  const script = `
$ErrorActionPreference = "SilentlyContinue"
$portSet = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
$details = @{}

foreach ($p in [System.IO.Ports.SerialPort]::GetPortNames()) {
  if ($p -match '^COM\\d+$') { [void]$portSet.Add($p.ToUpperInvariant()) }
}

try {
  $serialMap = Get-ItemProperty -Path 'HKLM:\\HARDWARE\\DEVICEMAP\\SERIALCOMM'
  foreach ($prop in $serialMap.PSObject.Properties) {
    if ($prop.Name -like 'PS*') { continue }
    $value = [string]$prop.Value
    if ($value -match '^COM\\d+$') { [void]$portSet.Add($value.ToUpperInvariant()) }
  }
} catch {}

$enumRoots = @("USB", "FTDIBUS", "BTHENUM")
foreach ($rootName in $enumRoots) {
  $rootPath = "HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\$rootName"
  if (-not (Test-Path $rootPath)) { continue }
  Get-ChildItem $rootPath -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.PSChildName -eq "Device Parameters" } |
    ForEach-Object {
      $params = Get-ItemProperty -LiteralPath $_.PSPath -ErrorAction SilentlyContinue
      $portName = [string]$params.PortName
      if ($portName -match '^COM\\d+$') {
        $key = $portName.ToUpperInvariant()
        if ($portSet.Contains($key)) {
          $deviceKey = Split-Path -Path $_.PSPath -Parent
          $parentKey = Split-Path -Path $deviceKey -Parent
          $deviceId = $deviceKey -replace '^Microsoft\\.PowerShell\\.Core\\\\Registry::HKEY_LOCAL_MACHINE\\\\SYSTEM\\\\CurrentControlSet\\\\Enum\\\\', ''
          $device = Get-ItemProperty -LiteralPath $deviceKey -ErrorAction SilentlyContinue
          $parent = Get-ItemProperty -LiteralPath $parentKey -ErrorAction SilentlyContinue
          $display = @($device.FriendlyName, $device.DeviceDesc, $parent.DeviceDesc, $device.Mfg, $parent.Mfg) |
            Where-Object { $_ } |
            Select-Object -First 1
          $metadata = @(
            $deviceId,
            $device.FriendlyName,
            $device.DeviceDesc,
            $device.Mfg,
            $device.Service,
            $device.HardwareID,
            $device.CompatibleIDs,
            $parent.DeviceDesc,
            $parent.Mfg
          ) | ForEach-Object {
            if ($_ -is [array]) { $_ -join " " } else { [string]$_ }
          } | Where-Object { $_ }
          $metadataText = $metadata -join " "
          $vid = ""
          $product = ""
          if ($metadataText -match 'VID[_-]?([0-9A-Fa-f]{4})') { $vid = $matches[1] }
          if ($metadataText -match 'PID[_-]?([0-9A-Fa-f]{4})') { $product = $matches[1] }
          if ($metadataText.Length -gt 700) { $metadataText = $metadataText.Substring(0, 700) }
          $details[$key] = [PSCustomObject]@{
            name = if ($display) { [string]$display } else { "" }
            label = if ($display) { [string]$display } else { "Serial" }
            pnpId = $metadataText
            vendorId = $vid
            productId = $product
          }
        }
      }
    }
}

$ports = $portSet | Sort-Object { [int]($_ -replace '\\D', '') }
$out = foreach ($p in $ports) {
  $detail = $details[$p]
  [PSCustomObject]@{
    address = $p
    board = ""
    name = if ($detail) { $detail.name } else { "" }
    label = if ($detail) { $detail.label } else { "Serial" }
    pnpId = if ($detail) { $detail.pnpId } else { "" }
    vendorId = if ($detail) { $detail.vendorId } else { "" }
    productId = if ($detail) { $detail.productId } else { "" }
  }
}
$out | ConvertTo-Json -Compress
`;
  const result = await run("powershell", ["-NoProfile", "-Command", script], { timeout: 6000 }); // Constante result: constante usada en result.
  if (!result.ok || !result.output) return [];                                        // Condicion: valida estado antes de continuar el flujo.
  try {                                                                               // Bloque try: ejecuta una operacion que puede fallar.
    const parsed = JSON.parse(result.output);                                         // Constante parsed: constante usada en parsed.
    return (Array.isArray(parsed) ? parsed : [parsed]).filter(Boolean).map((port) => { // Retorno: entrega el resultado al llamador.
      const normalized = {                                                            // Objeto normalized: objeto de configuracion para normalized.
        address: port.address || "",                                                  // Campo address: campo de datos para address.
        board: port.board || "",                                                      // Campo board: campo de datos para board.
        name: port.name || "",                                                        // Campo name: campo de datos para name.
        label: port.label || "Serial",                                                // Campo label: campo de datos para label.
        pnpId: port.pnpId || "",                                                      // Campo pnpId: campo de datos para pnp id.
        vendorId: port.vendorId || "",                                                // Campo vendorId: campo de datos para vendor id.
        productId: port.productId || ""                                               // Campo productId: campo de datos para product id.
      };
      normalized.kind = isBluetoothPort(normalized) ? "bluetooth" : "serial";         // Asignacion: actualiza estado o salida calculada.
      normalized.guess = guessDevice(normalized);                                     // Asignacion: actualiza estado o salida calculada.
      return normalized;                                                              // Retorno: entrega el resultado al llamador.
    }).filter((port) => port.address);
  } catch {
    return [];                                                                        // Retorno: entrega el resultado al llamador.
  }
}

async function listPorts({ force = false } = {}) {                                    // Funcion listPorts: obtiene puertos seriales con cache y deteccion del sistema.
  const now = Date.now();                                                             // Constante now: constante usada en now.
  if (!force && portsCache.result && now - portsCache.at < PORT_CACHE_MS) {           // Condicion: valida estado antes de continuar el flujo.
    return portsCache.result;                                                         // Retorno: entrega el resultado al llamador.
  }
  if (!force && portsCache.inFlight) return portsCache.inFlight;                      // Condicion: valida estado antes de continuar el flujo.

  portsCache.inFlight = listPortsNow().finally(() => {                                // Asignacion: actualiza estado o salida calculada.
    portsCache.inFlight = null;                                                       // Asignacion: actualiza estado o salida calculada.
  });
  return portsCache.inFlight;                                                         // Retorno: entrega el resultado al llamador.
}

async function listPortsNow() {                                                       // Funcion listPortsNow: encapsula la logica de comunicaciones y puertos.
  const [result, fallbackPorts] = await Promise.all([
    run(arduinoCli, ["board", "list", "--json"], { timeout: 6000 }),                  // Llamada: ejecuta una accion del modulo actual.
    systemSerialPorts()                                                               // Llamada: ejecuta una accion del modulo actual.
  ]);
  const cliPorts = result.ok ? parseBoardList(result.output) : [];                    // Constante cliPorts: constante usada en comunicaciones y puertos.
  const merged = [...cliPorts];                                                       // Arreglo merged: arreglo de datos para merged.
  fallbackPorts.forEach((port) => {                                                   // Llamada: ejecuta una accion del modulo actual.
    const existing = merged.find((item) => item.address === port.address);            // Constante existing: constante usada en existing.
    if (!existing) {                                                                  // Condicion: valida estado antes de continuar el flujo.
      merged.push(port);                                                              // Llamada: ejecuta una accion del modulo actual.
      return;                                                                         // Retorno: entrega el resultado al llamador.
    }
    ["board", "pnpId", "vendorId", "productId"].forEach((key) => {
      if (!existing[key] && port[key]) existing[key] = port[key];                     // Condicion: valida estado antes de continuar el flujo.
    });
    if ((!existing.name || isGenericSerialLabel(existing.name)) && port.name) {       // Condicion: valida estado antes de continuar el flujo.
      existing.name = port.name;                                                      // Asignacion: actualiza estado o salida calculada.
    }
    if (isGenericSerialLabel(existing.label) && port.label) {                         // Condicion: valida estado antes de continuar el flujo.
      existing.label = port.label;                                                    // Asignacion: actualiza estado o salida calculada.
    }
    existing.kind = isBluetoothPort(existing) ? "bluetooth" : "serial";               // Asignacion: actualiza estado o salida calculada.
    existing.guess = guessDevice(existing) || existing.guess || port.guess || "";     // Asignacion: actualiza estado o salida calculada.
  });
  merged.forEach((port) => {                                                          // Llamada: ejecuta una accion del modulo actual.
    port.kind = isBluetoothPort(port) ? "bluetooth" : (port.kind || "serial");        // Asignacion: actualiza estado o salida calculada.
    port.guess = guessDevice(port) || port.guess || "";                               // Asignacion: actualiza estado o salida calculada.
  });
  merged.sort((a, b) => {                                                             // Llamada: ejecuta una accion del modulo actual.
    const priority = portPriority(a) - portPriority(b);                               // Constante priority: constante usada en priority.
    if (priority) return priority;                                                    // Condicion: valida estado antes de continuar el flujo.
    return String(a.address).localeCompare(String(b.address), undefined, { numeric: true, sensitivity: "base" }); // Retorno: entrega el resultado al llamador.
  });
  const data = { ok: result.ok || merged.length > 0, ports: merged, output: result.output || result.error }; // Objeto data: objeto de configuracion para data.
  portsCache = { at: Date.now(), result: data, inFlight: null };                      // Asignacion: actualiza estado o salida calculada.
  return data;                                                                        // Retorno: entrega el resultado al llamador.
}

function serialStatus() {                                                             // Funcion serialStatus: encapsula la logica de comunicaciones y puertos.
  return {                                                                            // Retorno: entrega el resultado al llamador.
    ok: Boolean(serialBridge?.ready),                                                 // Campo ok: campo de datos para ok.
    port: serialBridge?.port || "",                                                   // Campo port: campo de datos para comunicaciones y puertos.
    baud: serialBridge?.baud || 115200                                                // Campo baud: campo de datos para baud.
  };
}

function normalizePortAddress(value) {                                                // Funcion normalizePortAddress: normaliza port address.
  return String(value || "").trim().toUpperCase();                                    // Retorno: entrega el resultado al llamador.
}

function summarizeWatchedPort(port) {                                                 // Funcion summarizeWatchedPort: encapsula la logica de comunicaciones y puertos.
  const address = port.address || port.port || "";                                    // Constante address: constante usada en address.
  const label = port.label || port.name || port.board || "Serial";                    // Constante label: constante usada en label.
  const guess = port.guess || "";                                                     // Constante guess: constante usada en guess.
  const kind = port.kind || "serial";                                                 // Constante kind: constante usada en kind.
  let device = "";                                                                    // Estado device: estado mutable de device.
  if (guess === "s3") device = "s3";                                                  // Condicion: valida estado antes de continuar el flujo.
  else if (guess === "cam") device = "cam";                                           // Condicion alternativa: cubre una variante del flujo.
  else if (guess === "esp32") device = "s3"; // generic ESP32 -> default to S3 firmware/connect
  return {                                                                            // Retorno: entrega el resultado al llamador.
    address,
    label,
    name: port.name || "",                                                            // Campo name: campo de datos para name.
    board: port.board || "",                                                          // Campo board: campo de datos para board.
    guess,
    kind,
    pnpId: port.pnpId || "",                                                          // Campo pnpId: campo de datos para pnp id.
    vendorId: port.vendorId || "",                                                    // Campo vendorId: campo de datos para vendor id.
    productId: port.productId || "",                                                  // Campo productId: campo de datos para product id.
    isEsp: Boolean(guess === "s3" || guess === "cam" || guess === "esp32"),           // Campo isEsp: campo de datos para is esp.
    suggestedDevice: device                                                           // Campo suggestedDevice: campo de datos para suggested device.
  };
}

async function runPortWatcherTick() {                                                 // Funcion runPortWatcherTick: encapsula la logica de comunicaciones y puertos.
  if (portWatcherRunning) return;                                                     // Condicion: valida estado antes de continuar el flujo.
  portWatcherRunning = true;                                                          // Asignacion: actualiza estado o salida calculada.
  try {                                                                               // Bloque try: ejecuta una operacion que puede fallar.
    const result = await listPorts({ force: true });                                  // Constante result: constante usada en result.
    const current = Array.isArray(result?.ports) ? result.ports : [];                 // Constante current: constante usada en current.
    const currentSet = new Set(                                                       // Conjunto currentSet: conjunto de valores para current set.
      current.map((p) => normalizePortAddress(p.address)).filter(Boolean)             // Llamada: ejecuta una accion del modulo actual.
    );

    if (knownPortAddresses === null) {                                                // Condicion: valida estado antes de continuar el flujo.
      // First snapshot — record what's already there, don't alert.
      knownPortAddresses = currentSet;                                                // Asignacion: actualiza estado o salida calculada.
      return;                                                                         // Retorno: entrega el resultado al llamador.
    }

    const added = [];                                                                 // Arreglo added: arreglo de datos para added.
    for (const port of current) {                                                     // Bucle: recorre datos o reintenta una operacion controlada.
      const key = normalizePortAddress(port.address);                                 // Constante key: constante usada en key.
      if (!key) continue;                                                             // Condicion: valida estado antes de continuar el flujo.
      if (!knownPortAddresses.has(key)) added.push(port);                             // Condicion: valida estado antes de continuar el flujo.
    }

    if (added.length && serialClients.size) {                                         // Condicion: valida estado antes de continuar el flujo.
      added.forEach((port) => {                                                       // Llamada: ejecuta una accion del modulo actual.
        const summary = summarizeWatchedPort(port);                                   // Constante summary: constante usada en summary.
        if (!summary.address) return;                                                 // Condicion: valida estado antes de continuar el flujo.
        broadcastSerial("port-added", {                                               // Llamada: ejecuta una accion del modulo actual.
          port: summary,                                                              // Campo port: campo de datos para comunicaciones y puertos.
          ports: current.map(summarizeWatchedPort)                                    // Campo ports: campo de datos para comunicaciones y puertos.
        });
      });
    }

    knownPortAddresses = currentSet;                                                  // Asignacion: actualiza estado o salida calculada.
  } catch (error) {
    // Swallow errors — the watcher must keep running.
    if (process.env.VESTA_DEBUG) {                                                    // Condicion: valida estado antes de continuar el flujo.
      console.error("port watcher tick failed:", error.message);                      // Llamada: ejecuta una accion del modulo actual.
    }
  } finally {
    portWatcherRunning = false;                                                       // Asignacion: actualiza estado o salida calculada.
  }
}

function startPortWatcher() {                                                         // Funcion startPortWatcher: inicia port watcher.
  if (portWatcherTimer) return;                                                       // Condicion: valida estado antes de continuar el flujo.
  // Kick off an immediate snapshot, then poll on an interval.
  runPortWatcherTick().catch(() => {});                                               // Llamada: ejecuta una accion del modulo actual.
  portWatcherTimer = setInterval(() => {                                              // Asignacion: actualiza estado o salida calculada.
    runPortWatcherTick().catch(() => {});                                             // Llamada: ejecuta una accion del modulo actual.
  }, PORT_WATCH_INTERVAL_MS);
  if (typeof portWatcherTimer.unref === "function") portWatcherTimer.unref();         // Condicion: valida estado antes de continuar el flujo.
}

function describePort(port) {                                                         // Funcion describePort: encapsula la logica de comunicaciones y puertos.
  return [port.address, port.label || port.name, port.guess ? port.guess.toUpperCase() : ""] // Retorno: entrega el resultado al llamador.
    .filter(Boolean)
    .join(" - ");
}

function defaultFqbnForDevice(device) {                                               // Funcion defaultFqbnForDevice: encapsula la logica de firmware y compilacion Arduino.
  return DEFAULT_FQBNS[device] || "";                                                 // Retorno: entrega el resultado al llamador.
}

function rememberUploadTarget(info = {}) {                                            // Funcion rememberUploadTarget: encapsula la logica de remember upload target.
  if (info.port) lastDetectedUpload.port = info.port;                                 // Condicion: valida estado antes de continuar el flujo.
  if (info.board) lastDetectedUpload.board = info.board;                              // Condicion: valida estado antes de continuar el flujo.
  if (info.name) lastDetectedUpload.name = info.name;                                 // Condicion: valida estado antes de continuar el flujo.
  if (info.device) lastDetectedUpload.device = info.device;                           // Condicion: valida estado antes de continuar el flujo.
  return { ...lastDetectedUpload };                                                   // Retorno: entrega el resultado al llamador.
}

function isDevicePortGuess(port, device) {                                            // Funcion isDevicePortGuess: evalua device port guess.
  if (!port || isBluetoothPort(port)) return false;                                   // Condicion: valida estado antes de continuar el flujo.
  if (device === "s3") return port.guess === "s3" || port.guess === "esp32";          // Condicion: valida estado antes de continuar el flujo.
  if (device === "cam") return port.guess === "cam" || port.guess === "esp32";        // Condicion: valida estado antes de continuar el flujo.
  return port.kind !== "bluetooth";                                                   // Retorno: entrega el resultado al llamador.
}

function uploadPortScore(port, device, preferredPort = "") {                          // Funcion uploadPortScore: encapsula la logica de comunicaciones y puertos.
  let score = 0;                                                                      // Estado score: estado mutable de score.
  const address = String(port.address || "");                                         // Constante address: constante usada en address.
  if (preferredPort && address.toLowerCase() === preferredPort.toLowerCase()) score += 1000; // Condicion: valida estado antes de continuar el flujo.
  if (lastDetectedUpload.port && address.toLowerCase() === lastDetectedUpload.port.toLowerCase()) score += 350; // Condicion: valida estado antes de continuar el flujo.
  if (isDevicePortGuess(port, device)) score += 220;                                  // Condicion: valida estado antes de continuar el flujo.
  if (port.board) score += 180;                                                       // Condicion: valida estado antes de continuar el flujo.
  if (/^COM\d+$/i.test(address)) score += 100;                                        // Condicion: valida estado antes de continuar el flujo.
  // Condicion: valida estado antes de continuar el flujo.
  if (/serial|usb|cdc|uart|jtag/i.test(`${port.label || ""} ${port.name || ""} ${port.pnpId || ""}`)) score += 50;
  return score;                                                                       // Retorno: entrega el resultado al llamador.
}

async function detectUploadTarget(device, preferredPort = "", requestedFqbn = "") {   // Funcion detectUploadTarget: elige el puerto y placa mas probables para subir firmware.
  const listed = await listPorts({ force: true });                                    // Constante listed: constante usada en listed.
  const ports = Array.isArray(listed.ports)                                           // Constante ports: constante usada en comunicaciones y puertos.
    ? listed.ports.filter((port) => port.address && port.kind !== "bluetooth" && !isBluetoothPort(port))
    : [];
  const preferred = preferredPort                                                     // Constante preferred: constante usada en preferred.
    ? ports.find((port) => String(port.address).toLowerCase() === preferredPort.toLowerCase())
    : null;
  const candidates = preferred                                                        // Constante candidates: constante usada en candidates.
    ? [preferred]
    : (device === "s3" || device === "cam")
      ? (() => {
          const matching = ports.filter((port) => isDevicePortGuess(port, device));   // Constante matching: constante usada en matching.
          return matching.length ? matching : ports.filter((port) => !port.guess);    // Retorno: entrega el resultado al llamador.
        })()
      : ports;
  const chosen = candidates                                                           // Constante chosen: constante usada en chosen.
    .slice()
    .sort((a, b) => {
      const score = uploadPortScore(b, device, preferredPort) - uploadPortScore(a, device, preferredPort); // Constante score: constante usada en score.
      if (score) return score;                                                        // Condicion: valida estado antes de continuar el flujo.
      return String(a.address).localeCompare(String(b.address), undefined, { numeric: true, sensitivity: "base" }); // Retorno: entrega el resultado al llamador.
    })[0] || null;

  const rememberedBoard = lastDetectedUpload.device === device ? lastDetectedUpload.board : ""; // Constante rememberedBoard: constante usada en remembered board.
  const detectedBoard = chosen?.board || "";                                          // Constante detectedBoard: constante usada en detected board.
  const usefulDetectedBoard = GENERIC_ESP32_FQBNS.has(detectedBoard) ? "" : detectedBoard; // Constante usefulDetectedBoard: constante usada en useful detected board.
  const target = {                                                                    // Objeto target: objeto de configuracion para target.
    ok: Boolean(chosen?.address),                                                     // Campo ok: campo de datos para ok.
    port: chosen?.address || preferredPort || "",                                     // Campo port: campo de datos para comunicaciones y puertos.
    board: requestedFqbn || usefulDetectedBoard || rememberedBoard || defaultFqbnForDevice(device), // Campo board: campo de datos para board.
    name: chosen?.name || chosen?.label || "",                                        // Campo name: campo de datos para name.
    guess: chosen?.guess || "",                                                       // Campo guess: campo de datos para guess.
    autoDetected: !preferredPort && Boolean(chosen?.address),                         // Campo autoDetected: campo de datos para auto detected.
    ports,
    output: listed.output || ""                                                       // Campo output: campo de datos para output.
  };
  if (target.port || target.board) rememberUploadTarget({ ...target, device });       // Condicion: valida estado antes de continuar el flujo.
  return target;                                                                      // Retorno: entrega el resultado al llamador.
}

async function validateSerialPort(port) {                                             // Funcion validateSerialPort: encapsula la logica de comunicaciones y puertos.
  let { ports } = await listPorts();
  let selected = ports.find((item) => String(item.address).toLowerCase() === String(port).toLowerCase()); // Estado selected: estado mutable de selected.
  if (!selected) {                                                                    // Condicion: valida estado antes de continuar el flujo.
    ({ ports } = await listPorts({ force: true }));
    selected = ports.find((item) => String(item.address).toLowerCase() === String(port).toLowerCase()); // Asignacion: actualiza estado o salida calculada.
  }
  const espCandidates = ports.filter((item) => item.guess === "s3" || item.guess === "cam" || item.guess === "esp32"); // Constante espCandidates: constante usada en esp candidates.
  if (!selected) {                                                                    // Condicion: valida estado antes de continuar el flujo.
    // Constante hint: constante usada en hint.
    const hint = espCandidates.length ? ` Puerto ESP detectado: ${describePort(espCandidates[0])}.` : "";
    throw new Error(`No encuentro ${port}.${hint}`);
  }
  if (isBluetoothPort(selected) && espCandidates.length) {                            // Condicion: valida estado antes de continuar el flujo.
    throw new Error(`${port} parece ser Bluetooth. Usa ${describePort(espCandidates[0])}.`);
  }
  return selected;                                                                    // Retorno: entrega el resultado al llamador.
}

function stopSerialBridge() {                                                         // Funcion stopSerialBridge: cierra el puente serial activo.
  if (!serialBridge) return;                                                          // Condicion: valida estado antes de continuar el flujo.
  const current = serialBridge;                                                       // Constante current: constante usada en current.
  serialBridge = null;                                                                // Asignacion: actualiza estado o salida calculada.
  try {                                                                               // Bloque try: ejecuta una operacion que puede fallar.
    if (current.child?.stdin?.writable) current.child.stdin.write("__VESTA_CLOSE__\n"); // Condicion: valida estado antes de continuar el flujo.
  } catch {}
  setTimeout(() => {                                                                  // Llamada: ejecuta una accion del modulo actual.
    if (!current.child?.killed) current.child.kill();                                 // Condicion: valida estado antes de continuar el flujo.
  }, 600);
  broadcastSerial("status", { ok: false, port: current.port, message: "Serial desconectado" }); // Llamada: ejecuta una accion del modulo actual.
}

function startSerialBridge(port, baud = 115200) {                                     // Funcion startSerialBridge: abre el puente serial y publica datos por SSE.
  if (!/^(COM\d+|\/dev\/[\w./-]+)$/i.test(port)) {                                    // Condicion: valida estado antes de continuar el flujo.
    throw new Error("Puerto serial invalido");
  }

  stopSerialBridge();                                                                 // Llamada: ejecuta una accion del modulo actual.

  // Constante script: constante usada en script.
  const script = `
param(
  [string]$portName,
  [int]$baudRate
)
$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($portName)) {
  throw "Puerto serial vacio"
}
$serial = [System.IO.Ports.SerialPort]::new($portName, $baudRate, [System.IO.Ports.Parity]::None, 8, [System.IO.Ports.StopBits]::One)
$serial.NewLine = [string][char]10
$serial.ReadTimeout = 100
$serial.WriteTimeout = 1000
$serial.Encoding = [System.Text.Encoding]::UTF8
$serial.DtrEnable = $false
$serial.RtsEnable = $false
Register-ObjectEvent -InputObject $serial -EventName DataReceived -Action {
  try {
    $text = $Event.Sender.ReadExisting()
    if ($text) {
      [Console]::Out.Write($text)
      [Console]::Out.Flush()
    }
  } catch {
    [Console]::Error.WriteLine("SERIAL_READ_ERROR:" + $_.Exception.Message)
  }
} | Out-Null
$serial.Open()
[Console]::Error.WriteLine("SERIAL_READY")
try {
  while (($line = [Console]::In.ReadLine()) -ne $null) {
    if ($line -eq "__VESTA_CLOSE__") { break }
    if ($serial.IsOpen) { $serial.WriteLine($line) }
  }
} finally {
  if ($serial.IsOpen) { $serial.Close() }
}
`;
  // Constante scriptPath: constante usada en script path.
  const scriptPath = path.join(os.tmpdir(), `vesta-serial-${process.pid}-${Date.now()}.ps1`);
  fs.writeFileSync(scriptPath, script, "utf8");                                       // Llamada: ejecuta una accion del modulo actual.

  let resolveStartup;
  let rejectStartup;
  const startup = new Promise((resolve, reject) => {                                  // Constante startup: constante usada en startup.
    resolveStartup = resolve;                                                         // Asignacion: actualiza estado o salida calculada.
    rejectStartup = reject;                                                           // Asignacion: actualiza estado o salida calculada.
  });

  const child = spawn("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, port, String(baud)], { // Constante child: constante usada en child.
    cwd: root,                                                                        // Campo cwd: campo de datos para cwd.
    windowsHide: true,                                                                // Campo windowsHide: campo de datos para comunicaciones y puertos.
    stdio: ["pipe", "pipe", "pipe"]                                                   // Campo stdio: arreglo de configuracion.
  });

  serialBridge = {                                                                    // Asignacion: actualiza estado o salida calculada.
    child,
    port,
    baud,
    scriptPath,
    startup,
    ready: false,                                                                     // Campo ready: campo de datos para ready.
    buffer: ""                                                                        // Campo buffer: campo de datos para buffer.
  };

  child.stdout.setEncoding("utf8");                                                   // Llamada: ejecuta una accion del modulo actual.
  child.stdout.on("data", (chunk) => {                                                // Llamada: ejecuta una accion del modulo actual.
    if (!serialBridge || serialBridge.child !== child) return;                        // Condicion: valida estado antes de continuar el flujo.
    serialBridge.buffer += chunk.replace(/\r/g, "\n");
    const lines = serialBridge.buffer.split("\n");                                    // Constante lines: constante usada en lines.
    serialBridge.buffer = lines.pop() || "";                                          // Asignacion: actualiza estado o salida calculada.
    for (const line of lines) {                                                       // Bucle: recorre datos o reintenta una operacion controlada.
      const trimmed = line.trim();                                                    // Constante trimmed: constante usada en trimmed.
      if (trimmed) broadcastSerial("serial", { line: trimmed, port });                // Condicion: valida estado antes de continuar el flujo.
    }
  });

  child.stderr.setEncoding("utf8");                                                   // Llamada: ejecuta una accion del modulo actual.
  child.stderr.on("data", (chunk) => {                                                // Llamada: ejecuta una accion del modulo actual.
    const lines = chunk.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);    // Constante lines: constante usada en lines.
    for (const line of lines) {                                                       // Bucle: recorre datos o reintenta una operacion controlada.
      if (line === "SERIAL_READY") {                                                  // Condicion: valida estado antes de continuar el flujo.
        if (serialBridge && serialBridge.child === child) serialBridge.ready = true;  // Condicion: valida estado antes de continuar el flujo.
        resolveStartup(serialStatus());                                               // Llamada: ejecuta una accion del modulo actual.
        // Llamada: ejecuta una accion del modulo actual.
        broadcastSerial("status", { ok: true, port, baud, message: `Conectado a ${port}` });
      } else {
        const message = line.replace(/^SERIAL_READ_ERROR:/, "");                      // Constante message: constante usada en message.
        if (!serialBridge?.ready) rejectStartup(new Error(message));                  // Condicion: valida estado antes de continuar el flujo.
        broadcastSerial("serial-error", { port, message });                           // Llamada: ejecuta una accion del modulo actual.
      }
    }
  });

  child.on("exit", (code) => {                                                        // Llamada: ejecuta una accion del modulo actual.
    fs.rm(scriptPath, { force: true }, () => {});                                     // Llamada: ejecuta una accion del modulo actual.
    if (serialBridge?.child === child) serialBridge = null;                           // Condicion: valida estado antes de continuar el flujo.
    // Llamada: ejecuta una accion del modulo actual.
    rejectStartup(new Error(`Serial cerrado antes de estar listo (codigo ${code ?? "desconocido"})`));
    broadcastSerial("status", { ok: false, port, code, message: "Serial cerrado" });  // Llamada: ejecuta una accion del modulo actual.
  });

  child.on("error", (error) => {                                                      // Llamada: ejecuta una accion del modulo actual.
    fs.rm(scriptPath, { force: true }, () => {});                                     // Llamada: ejecuta una accion del modulo actual.
    if (serialBridge?.child === child) serialBridge = null;                           // Condicion: valida estado antes de continuar el flujo.
    rejectStartup(error);                                                             // Llamada: ejecuta una accion del modulo actual.
    broadcastSerial("serial-error", { port, message: error.message });                // Llamada: ejecuta una accion del modulo actual.
  });

  return serialStatus();                                                              // Retorno: entrega el resultado al llamador.
}

async function handleSerialConnect(req, res) {                                        // Funcion handleSerialConnect: atiende serial connect.
  try {                                                                               // Bloque try: ejecuta una operacion que puede fallar.
    const body = await readJsonBody(req);                                             // Constante body: constante usada en body.
    const port = String(body.port || "").trim();                                      // Constante port: constante usada en comunicaciones y puertos.
    const baud = Number(body.baud) || 115200;                                         // Constante baud: constante usada en baud.
    if (!port) return sendJson(res, 400, { ok: false, output: "Puerto requerido" });  // Condicion: valida estado antes de continuar el flujo.
    const selected = await validateSerialPort(port);                                  // Constante selected: constante usada en selected.
    const status = startSerialBridge(selected.address, baud);                         // Constante status: constante usada en status.
    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 2500));  // Constante timeout: constante usada en timeout.
    const ready = await Promise.race([serialBridge.startup, timeout]);                // Constante ready: constante usada en ready.
    return sendJson(res, 200, {                                                       // Retorno: entrega el resultado al llamador.
      ok: true,                                                                       // Campo ok: campo de datos para ok.
      port: selected.address,                                                         // Campo port: campo de datos para comunicaciones y puertos.
      baud,
      ready: Boolean(ready || status.ok),                                             // Campo ready: campo de datos para ready.
      output: ready || status.ok                                                      // Campo output: campo de datos para output.
        ? `Conectado a ${selected.address} a ${baud} baudios`
        : `Abriendo ${selected.address} a ${baud} baudios`
    });
  } catch (error) {
    stopSerialBridge();                                                               // Llamada: ejecuta una accion del modulo actual.
    return sendJson(res, 400, { ok: false, output: error.message });                  // Retorno: entrega el resultado al llamador.
  }
}

async function handleSerialSend(req, res) {                                           // Funcion handleSerialSend: atiende serial send.
  try {                                                                               // Bloque try: ejecuta una operacion que puede fallar.
    const body = await readJsonBody(req);                                             // Constante body: constante usada en body.
    const payload = body.payload;                                                     // Constante payload: constante usada en payload.
    if (!serialBridge?.child?.stdin?.writable) {                                      // Condicion: valida estado antes de continuar el flujo.
      return sendJson(res, 409, { ok: false, output: "Serial no conectado" });        // Retorno: entrega el resultado al llamador.
    }
    const line = typeof payload === "string" ? payload : JSON.stringify(payload || {}); // Constante line: constante usada en line.
    // Llamada: ejecuta una accion del modulo actual.
    serialBridge.child.stdin.write(`${line}\n`);
    return sendJson(res, 200, { ok: true });                                          // Retorno: entrega el resultado al llamador.
  } catch (error) {
    return sendJson(res, 500, { ok: false, output: error.message });                  // Retorno: entrega el resultado al llamador.
  }
}

function handleSerialEvents(req, res) {                                               // Funcion handleSerialEvents: atiende serial events.
  res.writeHead(200, {                                                                // Llamada: ejecuta una accion del modulo actual.
    "Content-Type": "text/event-stream; charset=utf-8",                               // Campo Content-Type: campo de datos para content type.
    "Cache-Control": "no-store",                                                      // Campo Cache-Control: campo de datos para cache control.
    Connection: "keep-alive",                                                         // Campo Connection: campo de datos para connection.
    ...corsHeaders
  });
  res.write("retry: 1000\n\n");                                                       // Llamada: ejecuta una accion del modulo actual.
  serialClients.add(res);                                                             // Llamada: ejecuta una accion del modulo actual.
  sendSse(res, "status", serialStatus());                                             // Llamada: ejecuta una accion del modulo actual.

  // Make sure the watcher is awake whenever someone is listening.
  startPortWatcher();                                                                 // Llamada: ejecuta una accion del modulo actual.
  // Send the current snapshot so the UI can sync its baseline.
  listPorts({ force: false })                                                         // Llamada: ejecuta una accion del modulo actual.
    .then((result) => {
      const ports = Array.isArray(result?.ports) ? result.ports : [];                 // Constante ports: constante usada en comunicaciones y puertos.
      sendSse(res, "port-snapshot", { ports: ports.map(summarizeWatchedPort) });      // Llamada: ejecuta una accion del modulo actual.
    })
    .catch(() => {});

  req.on("close", () => {                                                             // Llamada: ejecuta una accion del modulo actual.
    serialClients.delete(res);                                                        // Llamada: ejecuta una accion del modulo actual.
    setTimeout(() => {                                                                // Llamada: ejecuta una accion del modulo actual.
      if (serialClients.size === 0 && serialBridge?.ready) stopSerialBridge();        // Condicion: valida estado antes de continuar el flujo.
    }, 5000);
  });
}

function normalizeCamStreamUrl(value, fallbackPort = 80) {                            // Funcion normalizeCamStreamUrl: normaliza cam stream url.
  const raw = String(value || "").trim();                                             // Constante raw: constante usada en raw.
  if (!raw) return "";                                                                // Condicion: valida estado antes de continuar el flujo.
  try {                                                                               // Bloque try: ejecuta una operacion que puede fallar.
    const candidate = /^https?:\/\//i.test(raw)
      ? raw
      : `http://${raw.replace(/^\/\//, "")}`;
    const parsed = new URL(candidate);                                                // Constante parsed: constante usada en parsed.
    parsed.protocol = "http:";                                                        // Asignacion: actualiza estado o salida calculada.
    if (!parsed.port && fallbackPort && Number(fallbackPort) !== 80) parsed.port = String(fallbackPort); // Condicion: valida estado antes de continuar el flujo.
    if (!parsed.pathname || parsed.pathname === "/") parsed.pathname = "/stream";     // Condicion: valida estado antes de continuar el flujo.
    return parsed.toString();                                                         // Retorno: entrega el resultado al llamador.
  } catch {
    return "";                                                                        // Retorno: entrega el resultado al llamador.
  }
}

function normalizeS3WsUrl(value, fallbackPort = 81) {                                 // Funcion normalizeS3WsUrl: normaliza s3 ws url.
  const raw = String(value || "").trim();                                             // Constante raw: constante usada en raw.
  if (!raw) return "";                                                                // Condicion: valida estado antes de continuar el flujo.
  try {                                                                               // Bloque try: ejecuta una operacion que puede fallar.
    const candidate = /^wss?:\/\//i.test(raw)
      ? raw
      : `ws://${raw.replace(/^https?:\/\//i, "").replace(/^\/\//, "")}`;
    const parsed = new URL(candidate);                                                // Constante parsed: constante usada en parsed.
    parsed.protocol = parsed.protocol === "wss:" ? "wss:" : "ws:";                    // Asignacion: actualiza estado o salida calculada.
    if (!parsed.hostname) return "";                                                  // Condicion: valida estado antes de continuar el flujo.
    if (!parsed.port) parsed.port = String(fallbackPort || 81);                       // Condicion: valida estado antes de continuar el flujo.
    const pathName = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : ""; // Constante pathName: constante usada en path name.
    return `${parsed.protocol}//${parsed.host}${pathName}${parsed.search || ""}`;
  } catch {
    return "";                                                                        // Retorno: entrega el resultado al llamador.
  }
}

function s3WsFromPacket(packet) {                                                     // Funcion s3WsFromPacket: encapsula la logica de comunicaciones y puertos.
  if (!packet || typeof packet !== "object") return {};                               // Condicion: valida estado antes de continuar el flujo.
  const looksLikeS3 = packet.role === "controller" || packet.type === "ack" || packet.type === "sensors"; // Constante looksLikeS3: constante usada en looks like s3.
  if (!looksLikeS3) return {};                                                        // Condicion: valida estado antes de continuar el flujo.

  const wsPort = Number(packet.wsPort || packet.websocketPort || packet.port || 81) || 81; // Constante wsPort: constante usada en comunicaciones y puertos.
  const direct = normalizeS3WsUrl(                                                    // Constante direct: constante usada en direct.
    packet.wsUrl || packet.websocketUrl || packet.s3Url || packet.urls?.ws,
    wsPort
  );
  const ip = String(packet.ip || packet.wifiIp || packet.address || "").trim();       // Constante ip: constante usada en ip.
  // Constante ws: constante usada en comunicaciones y puertos.
  const ws = direct || (ip && ip !== "0.0.0.0" ? normalizeS3WsUrl(`${ip}:${wsPort}`, wsPort) : "");
  return {                                                                            // Retorno: entrega el resultado al llamador.
    ws,
    ip,
    wsPort,
    ap: packet.ap === true,                                                           // Campo ap: campo de datos para ap.
    apSsid: packet.apSsid || "",                                                      // Campo apSsid: campo de datos para ap ssid.
    mdnsHost: packet.mdnsHost || "",                                                  // Campo mdnsHost: campo de datos para mdns host.
    mdnsUrl: normalizeS3WsUrl(packet.mdnsUrl, wsPort)                                 // Campo mdnsUrl: campo de datos para mdns url.
  };
}

function parseS3DiscoveryOutput(output) {                                             // Funcion parseS3DiscoveryOutput: parsea s3 discovery output.
  const text = String(output || "");                                                  // Constante text: constante usada en text.
  const jsonFragments = text.match(/\{[^\r\n]*\}/g) || [];                            // Constante jsonFragments: constante usada en json fragments.
  for (const fragment of jsonFragments) {                                             // Bucle: recorre datos o reintenta una operacion controlada.
    try {                                                                             // Bloque try: ejecuta una operacion que puede fallar.
      const parsed = JSON.parse(fragment);                                            // Constante parsed: constante usada en parsed.
      const urls = s3WsFromPacket(parsed);                                            // Constante urls: constante usada en urls.
      if (urls.ws || urls.mdnsUrl || urls.ap || urls.ip) return urls;                 // Condicion: valida estado antes de continuar el flujo.
    } catch {}
  }

  const direct = text.match(/\bws:\/\/[^\s"'<>]+/i);                                  // Constante direct: constante usada en direct.
  if (direct) return { ws: normalizeS3WsUrl(direct[0]) };

  const ipMatch = text.match(/\bIP\s*:\s*((?:\d{1,3}\.){3}\d{1,3})\b/i);
  if (!ipMatch) return {};
  const portMatch = text.match(/\b(?:WS|wsPort|port|puerto)\s*:?\s*(\d{2,5})\b/i);
  const wsPort = Number(portMatch?.[1] || 81) || 81;
  return {
    ws: normalizeS3WsUrl(`${ipMatch[1]}:${wsPort}`, wsPort),
    ip: ipMatch[1],
    wsPort
  };
}

function camStreamFromPacket(packet) {                                               // Funcion camStreamFromPacket: extrae URLs de stream desde un paquete CAM JSON.
  if (!packet || typeof packet !== "object") return {};
  const camPacket = packet.type === "cam_bridge" && packet.cam ? packet.cam : packet;
  const looksLikeCam = camPacket.role === "camera" ||
    camPacket.type === "cam_status" ||
    camPacket.type === "cam_hello";
  if (!looksLikeCam) return {};

  const httpPort = Number(camPacket.httpPort || camPacket.port || 80) || 80;
  const stream = normalizeCamStreamUrl(
    camPacket.stream || camPacket.cameraStream || camPacket.urls?.stream || camPacket.mdnsStream,
    httpPort
  ) || (camPacket.ip
    ? normalizeCamStreamUrl(`http://${camPacket.ip}${httpPort === 80 ? "" : `:${httpPort}`}/stream`, httpPort)
    : "");

  return {
    stream,
    ip: camPacket.ip || "",
    wifiMode: camPacket.wifiMode || "",
    apSsid: camPacket.apSsid || "",
    httpPort,
    appWs: camPacket.appWs || camPacket.wsUrl || "",
    statusUrl: camPacket.statusUrl || "",
    capture: camPacket.capture || "",
    mdnsHost: camPacket.mdnsHost || "",
    mdnsStream: camPacket.mdnsStream || "",
    cameraReady: camPacket.cameraReady !== false,
    usbVideo: camPacket.usbVideo === true || camPacket.usbSerialVideo === true,
    usbStreaming: Boolean(camPacket.usbStreaming),
    usbStreamBaud: Number(camPacket.usbStreamBaud || CAM_USB_STREAM_BAUD) || CAM_USB_STREAM_BAUD
  };
}

function parseCamDiscoveryOutput(output) {                                           // Funcion parseCamDiscoveryOutput: extrae URL de stream CAM de la salida serial.
  const text = String(output || "");
  const jsonFragments = text.match(/\{[^\r\n]*\}/g) || [];
  for (const fragment of jsonFragments) {
    try {
      const parsed = JSON.parse(fragment);
      const urls = camStreamFromPacket(parsed);
      if (urls.stream || urls.usbVideo || typeof urls.cameraReady === "boolean") return urls;
    } catch {}
  }

  const direct = text.match(/\bhttps?:\/\/[^\s"'<>]+\/stream\b/i);
  if (direct) return { stream: normalizeCamStreamUrl(direct[0]) };

  const ipMatch = text.match(/\bIP\s*:\s*((?:\d{1,3}\.){3}\d{1,3})\b/i);
  if (!ipMatch) return {};
  const portMatch = text.match(/\b(?:HTTP|httpPort|port|puerto)\s*:?\s*(\d{2,5})\b/);
  const httpPort = Number(portMatch?.[1] || 80) || 80;
  return {
    stream: normalizeCamStreamUrl(`http://${ipMatch[1]}${httpPort === 80 ? "" : `:${httpPort}`}/stream`, httpPort),
    ip: ipMatch[1],
    httpPort
  };
}

function isSerialScanCandidate(port) {                                               // Funcion isSerialScanCandidate: filtra puertos validos para escaneo ESP32.
  return Boolean(port?.address) && port.kind !== "bluetooth" && !isBluetoothPort(port);
}

function camScanPriority(port) {                                                     // Funcion camScanPriority: prioridad de escaneo de puerto para CAM.
  if (port.guess === "cam") return 0;
  if (port.guess === "esp32") return 1;
  if (!port.guess) return 2;
  if (port.guess === "s3") return 3;
  return 4;
}

function describeScannedPorts(attempts) {                                            // Funcion describeScannedPorts: describe los puertos probados en el escaneo.
  const names = attempts.map((item) => item.port).filter(Boolean);
  return names.length ? names.join(", ") : "ningun puerto";
}

function serialOutputLooksLikeCam(output) {                                          // Funcion serialOutputLooksLikeCam: heuristica que detecta firmware CAM en salida serial.
  const text = String(output || "").toLowerCase();
  return text.includes("v.e.s.t.a. esp32-cam") ||
    text.includes("v.e.s.t.a esp32-cam") ||
    text.includes("esp32-cam assistant") ||
    text.includes("vesta-cam") ||
    text.includes("cam_status") ||
    text.includes("[cam] stream") ||
    text.includes("[app-ws]") ||
    text.includes("[http] port") ||
    text.includes("[s3] connected") ||
    text.includes("[s3] disconnected") ||
    text.includes("/stream");
}

function serialOutputLooksLikeEsp32(output) {                                        // Funcion serialOutputLooksLikeEsp32: detecta arranque de ESP32 generico en serial.
  const text = String(output || "").toLowerCase();
  return text.includes("rst:0x") ||
    text.includes("boot:0x") ||
    text.includes("ets jul") ||
    text.includes("esp-rom") ||
    text.includes("load:0x") ||
    text.includes("entry 0x") ||
    text.includes("esp32");
}

function serialOutputLooksLikeS3(output) {                                           // Funcion serialOutputLooksLikeS3: detecta firmware ESP32-S3 en salida serial.
  const text = String(output || "").toLowerCase();
  return text.includes("v.e.s.t.a. esp32-s3") ||
    text.includes("v.e.s.t.a esp32-s3") ||
    text.includes("vesta-s3") ||
    text.includes('"role":"controller"') ||
    text.includes('"type":"ack"') ||
    text.includes('"type":"sensors"') ||
    text.includes("[ws] url:") ||
    text.includes("esp32-s3");
}

function s3ScanPriority(port) {                                                      // Funcion s3ScanPriority: prioridad de escaneo de puerto para el ESP32-S3.
  if (port.guess === "s3") return 0;
  if (port.guess === "esp32") return 1;
  if (!port.guess) return 2;
  if (port.guess === "cam") return 3;
  return 4;
}

function camDiagnosticsFromOutput(output) {                                          // Funcion camDiagnosticsFromOutput: analiza salida serial CAM para extraer diagnostico de WiFi.
  const text = String(output || "");
  const lower = text.toLowerCase();
  const ssidMatch = text.match(/\[WiFi\]\s*Connecting to\s*([^\r\n]+)/i);
  const ssid = ssidMatch ? ssidMatch[1].replace(/\.+$/, "").trim() : "";
  const apMatch = text.match(/\[WiFi\]\s*AP:\s*([^\r\n]+)/i);
  const apSsid = apMatch ? apMatch[1].replace(/\s+(ready|failed).*$/i, "").trim() : "";
  const defaultWifi = ssid === "TU_RED_WIFI" || lower.includes("tu_red_wifi");
  const wifiNotConnected = lower.includes("[wifi] not connected") || lower.includes("check credentials");
  const wifiConnecting = lower.includes("[wifi] connecting to");
  const apFallback = lower.includes("[wifi] ap:") || lower.includes("fallback ap");
  let reason = "";
  if (apFallback) reason = "ap-fallback";
  else if (defaultWifi) reason = "wifi-placeholder";
  else if (wifiNotConnected) reason = "wifi-failed";
  else if (wifiConnecting) reason = "wifi-pending";
  return { ssid, apSsid, defaultWifi, wifiNotConnected, wifiConnecting, apFallback, reason };
}

function camFallbackOutput(port, diagnostics, isCam) {                               // Funcion camFallbackOutput: genera mensaje de ayuda cuando CAM no retorna URL.
  if (diagnostics.apFallback) {
    return `ESP32-CAM detectada en ${port}. Activo hotspot ${diagnostics.apSsid || "VESTA-CAM-SETUP"}; conecta este equipo a esa red para abrir /stream.`;
  }
  if (diagnostics.defaultWifi) {
    return `ESP32-CAM detectada en ${port}. Esta usando WIFI_SSID=TU_RED_WIFI; cambia esp32_cam_config.h y vuelve a subir el firmware.`;
  }
  if (diagnostics.wifiNotConnected) {
    return `ESP32-CAM detectada en ${port}, pero no conecto al WiFi ${diagnostics.ssid || "configurado"}. Revisa SSID/password.`;
  }
  if (diagnostics.wifiConnecting) {
    return `ESP32-CAM detectada en ${port}. Todavia esta conectando al WiFi ${diagnostics.ssid || "configurado"}; aun no hay URL /stream.`;
  }
  return isCam
    ? `ESP32-CAM detectada en ${port}, pero aun no envio la URL /stream. Espera WiFi o revisa credenciales.`
    : `Detecte un ESP32 candidato para CAM en ${port}, pero no envio cam_status ni /stream.`;
}

function isCamApUrl(url) {                                                           // Funcion isCamApUrl: detecta si una URL apunta al AP local de la CAM (192.168.4.1).
  try {
    return new URL(url).hostname === "192.168.4.1";
  } catch {
    return false;
  }
}

function readS3DiscoverySerial(port, baud = 115200, timeoutMs = 5000) {              // Funcion readS3DiscoverySerial: lee serial del S3 buscando respuesta JSON de descubrimiento.
  if (!/^(COM\d+|\/dev\/[\w./-]+)$/i.test(port)) {
    throw new Error("Puerto serial invalido");
  }

  const script = `
param(
  [string]$portName,
  [int]$baudRate,
  [int]$timeoutMs
)
$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($portName)) {
  throw "Puerto serial vacio"
}
$serial = [System.IO.Ports.SerialPort]::new($portName, $baudRate, [System.IO.Ports.Parity]::None, 8, [System.IO.Ports.StopBits]::One)
$serial.NewLine = [string][char]10
$serial.ReadTimeout = 100
$serial.WriteTimeout = 1000
$serial.Encoding = [System.Text.Encoding]::UTF8
$serial.DtrEnable = $false
$serial.RtsEnable = $false
$serial.Open()
$deadline = [DateTime]::UtcNow.AddMilliseconds($timeoutMs)
$nextWrite = [DateTime]::UtcNow
$buffer = ""
try {
  while ([DateTime]::UtcNow -lt $deadline) {
    if ([DateTime]::UtcNow -ge $nextWrite) {
      try { $serial.WriteLine('{"type":"cmd_status"}') } catch {}
      $nextWrite = [DateTime]::UtcNow.AddMilliseconds(800)
    }
    try {
      if ($serial.BytesToRead -gt 0) {
        $chunk = $serial.ReadExisting()
        if ($chunk) {
          $buffer += $chunk
          [Console]::Out.Write($chunk)
          [Console]::Out.Flush()
        }
      }
    } catch {
      [Console]::Error.WriteLine("SERIAL_READ_ERROR:" + $_.Exception.Message)
    }
    if ($buffer -match '"role"\\s*:\\s*"controller"' -or
        $buffer -match '"type"\\s*:\\s*"(ack|sensors)"' -or
        $buffer -match '\\[WS\\]\\s*URL\\s*:') {
      Start-Sleep -Milliseconds 120
      if ($serial.BytesToRead -gt 0) {
        $chunk = $serial.ReadExisting()
        if ($chunk) {
          [Console]::Out.Write($chunk)
          [Console]::Out.Flush()
        }
      }
      break
    }
    Start-Sleep -Milliseconds 50
  }
} finally {
  if ($serial.IsOpen) { $serial.Close() }
}
`;

  const scriptPath = path.join(os.tmpdir(), `vesta-s3-discover-${process.pid}-${Date.now()}.ps1`);
  fs.writeFileSync(scriptPath, script, "utf8");

  return new Promise((resolve) => {
    let output = "";
    let error = "";
    let settled = false;
    const child = spawn("powershell", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      port,
      String(baud),
      String(timeoutMs)
    ], {
      cwd: root,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });

    const timer = setTimeout(() => {
      if (!settled) child.kill();
    }, timeoutMs + 2500);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { error += chunk; });
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fs.rm(scriptPath, { force: true }, () => {});
      resolve({ ok: false, output: output.trim(), error: err.message });
    });
    child.on("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fs.rm(scriptPath, { force: true }, () => {});
      resolve({
        ok: code === 0,
        code,
        output: [output, error].filter(Boolean).join("\n").trim(),
        error: error.trim()
      });
    });
  });
}

async function handleS3Discover(req, res) {                                          // Funcion handleS3Discover: handler API que busca el ESP32-S3 por puertos COM.
  try {
    const body = await readJsonBody(req);
    const port = String(body.port || "").trim();
    const baud = Number(body.baud) || 115200;
    const timeoutMs = Math.min(Math.max(Number(body.timeoutMs) || 12000, 1800), 25000);
    const perPortTimeoutMs = Math.min(
      Math.max(Number(body.perPortTimeoutMs) || (port ? timeoutMs : 4500), 1200),
      15000
    );
    const scan = body.scan !== false;
    const attempts = [];

    const listed = await listPorts({ force: true });
    const allPorts = Array.isArray(listed.ports) ? listed.ports : [];
    let candidates = [];

    if (port) {
      let selected = allPorts.find((item) => String(item.address).toLowerCase() === port.toLowerCase());
      if (!selected && !scan) selected = await validateSerialPort(port);

      if (!selected) {
        attempts.push({ port, skipped: true, reason: "puerto no disponible; escaneando puertos actuales" });
      } else if (!isSerialScanCandidate(selected)) {
        if (scan) {
          attempts.push({ port: selected.address, skipped: true, reason: "no es USB serial valido para ESP32-S3" });
        } else {
          return sendJson(res, 400, { ok: false, output: `${selected.address} no parece un puerto USB serial valido para ESP32-S3` });
        }
      } else {
        candidates.push(selected);
      }
    }

    if (scan) {
      const seen = new Set(candidates.map((item) => item.address.toLowerCase()));
      const extras = allPorts
        .filter(isSerialScanCandidate)
        .filter((item) => !seen.has(item.address.toLowerCase()))
        .sort((a, b) => {
          const priority = s3ScanPriority(a) - s3ScanPriority(b);
          if (priority) return priority;
          return String(a.address).localeCompare(String(b.address), undefined, { numeric: true, sensitivity: "base" });
        });
      candidates.push(...extras);
    }

    if (!candidates.length) {
      return sendJson(res, 200, { ok: false, scanned: attempts, output: "No hay puertos USB serial activos para buscar el ESP32-S3" });
    }

    const activeBridgePort = serialBridge?.port?.toLowerCase() || "";
    const hasBridgeAlternates = Boolean(activeBridgePort) && scan &&
      candidates.some((item) => item.address.toLowerCase() !== activeBridgePort);
    let fallback = null;
    for (const candidate of candidates) {
      const address = candidate.address;
      const explicit = port && address.toLowerCase() === port.toLowerCase();
      if (activeBridgePort && address.toLowerCase() === activeBridgePort) {
        if (!explicit || hasBridgeAlternates) {
          attempts.push({ port: address, skipped: true, reason: "ocupado por conexion serial del S3" });
          continue;
        }
        stopSerialBridge();
        await delay(700);
      }

      const result = await readS3DiscoverySerial(address, baud, explicit ? timeoutMs : perPortTimeoutMs);
      const urls = parseS3DiscoveryOutput(result.output);
      const s3Like = serialOutputLooksLikeS3(result.output);
      const esp32Like = serialOutputLooksLikeEsp32(result.output);
      attempts.push({
        port: address,
        ok: Boolean(urls.ws),
        detected: Boolean(urls.ws || s3Like || esp32Like || candidate.guess === "s3" || candidate.guess === "esp32"),
        s3Like,
        esp32Like,
        ap: Boolean(urls.ap),
        apSsid: urls.apSsid || "",
        guess: candidate.guess || "",
        label: candidate.label || candidate.name || "",
        output: result.output || result.error || ""
      });

      if (!urls.ws) {
        if (!fallback && (s3Like || esp32Like || candidate.guess === "s3" || candidate.guess === "esp32")) {
          fallback = { address, result, s3Like, esp32Like };
        }
        continue;
      }

      return sendJson(res, 200, {
        ok: true,
        detected: true,
        port: address,
        baud,
        scanned: attempts,
        transport: "serial",
        ...urls,
        url: urls.ws,
        output: result.output
      });
    }

    if (fallback) {
      return sendJson(res, 200, {
        ok: false,
        detected: true,
        port: fallback.address,
        baud,
        scanned: attempts,
        output: `Detecte un ESP32-S3 candidato en ${fallback.address}, pero aun no envio wsUrl. Espera WiFi/AP o revisa el firmware.`
      });
    }

    return sendJson(res, 200, {
      ok: false,
      baud,
      scanned: attempts,
      output: `No encontre un ESP32-S3 respondiendo por COM. Puertos probados: ${describeScannedPorts(attempts)}`
    });
  } catch (error) {
    return sendJson(res, 400, { ok: false, output: error.message });
  }
}

function requestText(url, timeoutMs = 5000) {                                        // Funcion requestText: hace GET HTTP y retorna el cuerpo como texto.
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (error) {
      resolve({ ok: false, status: 0, output: "", error: error.message });
      return;
    }

    const client = parsed.protocol === "https:" ? https : http;
    const req = client.get(parsed, { timeout: timeoutMs }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        if (body.length < 256_000) body += chunk;
      });
      response.on("end", () => {
        resolve({
          ok: response.statusCode >= 200 && response.statusCode < 400,
          status: response.statusCode || 0,
          output: body
        });
      });
    });
    req.on("timeout", () => req.destroy(new Error("Tiempo agotado")));
    req.on("error", (error) => {
      resolve({ ok: false, status: 0, output: "", error: error.message });
    });
  });
}

function camStatusUrlFromStream(url) {                                               // Funcion camStatusUrlFromStream: construye la URL /status a partir de una URL de stream.
  const normalized = normalizeCamStreamUrl(url);
  if (!normalized) return "";
  const parsed = new URL(normalized);
  if (parsed.port === "81") parsed.port = "";
  parsed.pathname = "/status";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

function localCamUsbStreamUrl(port, baud = 115200, streamBaud = CAM_USB_STREAM_BAUD) { // Funcion localCamUsbStreamUrl: construye URL del proxy USB-MJPEG local del servidor.
  const params = new URLSearchParams({
    port,
    baud: String(Number(baud) || 115200),
    streamBaud: String(Number(streamBaud) || CAM_USB_STREAM_BAUD)
  });
  return `http://127.0.0.1:${localServerPort}/api/cam/usb-stream?${params.toString()}`;
}

function camUsbStreamInfo(url) {                                                     // Funcion camUsbStreamInfo: parsea una URL de proxy USB y retorna sus parametros.
  try {
    const parsed = new URL(normalizeCamStreamUrl(url));
    const localHost = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
    if (!localHost || parsed.pathname !== "/api/cam/usb-stream") return null;
    const port = String(parsed.searchParams.get("port") || "").trim();
    if (!/^(COM\d+|\/dev\/[\w./-]+)$/i.test(port)) return null;
    return {
      port,
      baud: Number(parsed.searchParams.get("baud") || 115200) || 115200,
      streamBaud: Number(parsed.searchParams.get("streamBaud") || CAM_USB_STREAM_BAUD) || CAM_USB_STREAM_BAUD
    };
  } catch {
    return null;
  }
}

function xmlEscape(value) {                                                          // Funcion xmlEscape: escapa caracteres especiales XML en una cadena.
  return String(value || "").replace(/[<>&'"]/g, (char) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    "\"": "&quot;"
  })[char]);
}

function wifiProfileXml(ssid, password) {                                            // Funcion wifiProfileXml: genera el XML de perfil WiFi para netsh en Windows.
  const safeSsid = xmlEscape(ssid);
  const safePassword = xmlEscape(password);
  return `<?xml version="1.0"?>
<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">
  <name>${safeSsid}</name>
  <SSIDConfig>
    <SSID>
      <name>${safeSsid}</name>
    </SSID>
  </SSIDConfig>
  <connectionType>ESS</connectionType>
  <connectionMode>manual</connectionMode>
  <MSM>
    <security>
      <authEncryption>
        <authentication>WPA2PSK</authentication>
        <encryption>AES</encryption>
        <useOneX>false</useOneX>
      </authEncryption>
      <sharedKey>
        <keyType>passPhrase</keyType>
        <protected>false</protected>
        <keyMaterial>${safePassword}</keyMaterial>
      </sharedKey>
    </security>
  </MSM>
</WLANProfile>
`;
}

function parseWifiInterfaces(output) {                                               // Funcion parseWifiInterfaces: parsea la salida de netsh wlan show interfaces.
  const text = String(output || "").replace(/\r/g, "");
  const blocks = text.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  return blocks.map((block) => {
    const name = block.match(/^\s*(?:Nombre|Name)\s*:\s*(.+)$/im)?.[1]?.trim() || "";
    const state = block.match(/^\s*(?:Estado|State)\s*:\s*(.+)$/im)?.[1]?.trim() || "";
    const ssid = block.match(/^\s*SSID\s*:\s*(.+)$/im)?.[1]?.trim() || "";
    return { name, state, ssid, connected: /conectado|connected/i.test(state) };
  }).filter((item) => item.name || item.ssid || item.state);
}

async function getWifiStatus() {                                                     // Funcion getWifiStatus: obtiene el estado actual de la interfaz WiFi de Windows.
  if (process.platform !== "win32") {
    return { ok: false, interfaces: [], output: "Conexion WiFi automatica solo soportada en Windows por ahora" };
  }
  const result = await run("netsh", ["wlan", "show", "interfaces"], { timeout: 8000 });
  const interfaces = parseWifiInterfaces(result.output || "");
  return {
    ok: result.ok,
    interfaces,
    current: interfaces.find((item) => item.connected) || interfaces[0] || null,
    output: result.output || result.error
  };
}

async function setWifiConnectionMode(ssid, mode) {                                   // Funcion setWifiConnectionMode: cambia el modo de conexion de un perfil WiFi en Windows.
  if (!ssid || process.platform !== "win32") return { ok: false, output: "" };
  return run("netsh", ["wlan", "set", "profileparameter", `name=${ssid}`, `connectionmode=${mode}`], { timeout: 12000 });
}

function stopCamWifiHold() {                                                         // Funcion stopCamWifiHold: cancela el timer que mantiene la conexion al AP de la CAM.
  if (camWifiHoldTimer) {
    clearInterval(camWifiHoldTimer);
    camWifiHoldTimer = null;
  }
}

function startCamWifiHold(ssid, interfaceName) {                                     // Funcion startCamWifiHold: mantiene Windows conectado al AP de la CAM hasta 10 min.
  stopCamWifiHold();
  const until = Date.now() + 10 * 60 * 1000;
  camWifiHoldTimer = setInterval(async () => {
    if (Date.now() > until) {
      stopCamWifiHold();
      return;
    }
    try {
      const status = await getWifiStatus();
      if (status.current?.ssid === ssid) return;
      await run("netsh", ["wlan", "disconnect", `interface=${interfaceName || "Wi-Fi"}`], { timeout: 8000 });
      await delay(600);
      await run("netsh", ["wlan", "connect", `name=${ssid}`, `ssid=${ssid}`, `interface=${interfaceName || "Wi-Fi"}`], { timeout: 12000 });
    } catch {}
  }, 2500);
}

async function connectWindowsWifi(ssid, password) {                                  // Funcion connectWindowsWifi: conecta Windows al SSID indicado via netsh.
  if (process.platform !== "win32") {
    return { ok: false, output: "Conexion WiFi automatica solo soportada en Windows por ahora" };
  }

  const before = await getWifiStatus();
  if (before.current?.ssid === ssid) {
    return { ok: true, ssid, output: `Ya conectado a ${ssid}` };
  }
  const interfaceName = before.current?.name || "Wi-Fi";
  if (before.current?.ssid && before.current.ssid !== ssid) {
    wifiBeforeCam = { ssid: before.current.ssid, interfaceName };
    await setWifiConnectionMode(before.current.ssid, "manual");
  }

  const profilePath = path.join(os.tmpdir(), `vesta-wifi-${process.pid}-${Date.now()}.xml`);
  fs.writeFileSync(profilePath, wifiProfileXml(ssid, password), "utf8");
  try {
    let add = await run("netsh", ["wlan", "add", "profile", `filename=${profilePath}`, "user=current"], { timeout: 12000 });
    if (!add.ok && /ya existe|already exists|cannot overwrite|no se puede sobrescribir/i.test(add.output || add.error)) {
      await run("netsh", ["wlan", "delete", "profile", `name=${ssid}`], { timeout: 12000 });
      add = await run("netsh", ["wlan", "add", "profile", `filename=${profilePath}`, "user=current"], { timeout: 12000 });
    }
    await run("netsh", ["wlan", "set", "profileorder", `name=${ssid}`, `interface=${interfaceName}`, "priority=1"], { timeout: 12000 });
    await run("netsh", ["wlan", "disconnect", `interface=${interfaceName}`], { timeout: 12000 });
    await delay(1200);
    const connect = await run("netsh", ["wlan", "connect", `name=${ssid}`, `ssid=${ssid}`, `interface=${interfaceName}`], { timeout: 12000 });

    let stableHits = 0;
    for (let i = 0; i < 18; i++) {
      await delay(1500);
      const status = await getWifiStatus();
      if (status.current?.ssid === ssid) {
        stableHits += 1;
        if (stableHits >= 2) {
          startCamWifiHold(ssid, interfaceName);
          return {
            ok: true,
            ssid,
            output: `Conectado a ${ssid}. Windows puede mostrar "sin internet"; es normal para la CAM.`
          };
        }
      } else {
        stableHits = 0;
        if (i === 5 || i === 10) {
          await run("netsh", ["wlan", "connect", `name=${ssid}`, `ssid=${ssid}`, `interface=${interfaceName}`], { timeout: 12000 });
        }
      }
    }

    const after = await getWifiStatus();
    return {
      ok: false,
      ssid: after.current?.ssid || "",
      output: [
        `No pude conectar automaticamente a ${ssid}.`,
        add.output || add.error,
        connect.output || connect.error,
        `Red actual: ${after.current?.ssid || "desconocida"}`
      ].filter(Boolean).join("\n")
    };
  } finally {
    fs.rm(profilePath, { force: true }, () => {});
  }
}

async function restoreWindowsWifi() {                                                // Funcion restoreWindowsWifi: restaura el WiFi previo al uso del AP de la CAM.
  if (process.platform !== "win32") {
    return { ok: false, output: "Restauracion WiFi automatica solo soportada en Windows" };
  }
  stopCamWifiHold();
  const previous = wifiBeforeCam;
  wifiBeforeCam = null;
  if (!previous?.ssid) return { ok: true, output: "Sin WiFi previo para restaurar" };
  await setWifiConnectionMode(previous.ssid, "auto");
  const status = await getWifiStatus();
  if (status.current?.ssid === CAM_AP_SSID) {
    await run("netsh", ["wlan", "connect", `name=${previous.ssid}`, `ssid=${previous.ssid}`, `interface=${previous.interfaceName || "Wi-Fi"}`], { timeout: 12000 });
  }
  return { ok: true, ssid: previous.ssid, output: `WiFi anterior restaurado: ${previous.ssid}` };
}

async function handleWifiConnectCam(req, res) {                                      // Funcion handleWifiConnectCam: handler API que conecta Windows al AP de la CAM.
  try {
    const body = await readJsonBody(req, 32_000);
    const ssid = String(body.ssid || CAM_AP_SSID).trim();
    const password = String(body.password || CAM_AP_PASSWORD);
    if (!ssid) return sendJson(res, 400, { ok: false, output: "SSID requerido" });
    const result = await connectWindowsWifi(ssid, password);
    return sendJson(res, 200, result);
  } catch (error) {
    return sendJson(res, 500, { ok: false, output: error.message });
  }
}

async function handleWifiRestore(req, res) {                                         // Funcion handleWifiRestore: handler API que restaura el WiFi previo.
  try {
    const result = await restoreWindowsWifi();
    return sendJson(res, 200, result);
  } catch (error) {
    return sendJson(res, 500, { ok: false, output: error.message });
  }
}

async function handleCamStreamProxy(req, res, parsed) {                               // Funcion handleCamStreamProxy: proxy HTTP que retransmite MJPEG de la CAM al browser.
  const stream = normalizeCamStreamUrl(parsed.searchParams.get("url") || "");
  if (!stream) return sendJson(res, 400, { ok: false, output: "URL de stream requerida" });

  const usbInfo = camUsbStreamInfo(stream);
  if (usbInfo) return handleCamUsbStream(req, res, usbInfo);

  let target;
  try {
    target = new URL(stream);
  } catch (error) {
    return sendJson(res, 400, { ok: false, output: error.message });
  }

  if (!["http:", "https:"].includes(target.protocol)) {
    return sendJson(res, 400, { ok: false, output: "Solo se permite HTTP/HTTPS" });
  }

  const client = target.protocol === "https:" ? https : http;
  let upstream = null;
  let closed = false;
  let headersWritten = false;
  let reconnectTimer = null;
  let reconnects = 0;

  // Funcion local | endWithError: finaliza el proxy MJPEG con un error controlado.
  const endWithError = (status, message) => {
    if (closed || res.destroyed) return;
    closed = true;
    if (!res.headersSent) {
      res.writeHead(status, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        ...corsHeaders
      });
      res.end(message);
    } else {
      res.end();
    }
  };

  // Funcion local | scheduleReconnect: reintenta conexion upstream sin bloquear la respuesta.
  const scheduleReconnect = () => {
    if (closed || res.destroyed) return;
    reconnects += 1;
    if (reconnects > 12) {
      endWithError(504, "Stream CAM sin frames");
      return;
    }
    reconnectTimer = setTimeout(openUpstream, Math.min(300 + reconnects * 150, 1800));
  };

  // Funcion local | openUpstream: abre la conexion HTTP hacia la camara real.
  const openUpstream = () => {
    if (closed || res.destroyed) return;
    upstream = client.get(target, { timeout: 8000 }, (upstreamRes) => {
      if ((upstreamRes.statusCode || 0) >= 400) {
        if (!headersWritten) {
          res.writeHead(upstreamRes.statusCode || 502, {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
            ...corsHeaders
          });
          headersWritten = true;
        }
        upstreamRes.pipe(res);
        closed = true;
        return;
      }

      reconnects = 0;
      if (!headersWritten) {
        res.writeHead(200, {
          "Content-Type": upstreamRes.headers["content-type"] || "multipart/x-mixed-replace",
          "Cache-Control": "no-store",
          "Connection": "close",
          ...corsHeaders
        });
        headersWritten = true;
      }

      upstreamRes.setTimeout(6000, () => upstream.destroy(new Error("Stream CAM sin frames")));
      upstreamRes.on("data", (chunk) => {
        if (!closed && !res.destroyed) res.write(chunk);
      });
      upstreamRes.on("end", scheduleReconnect);
    });

    upstream.on("timeout", () => upstream.destroy(new Error("Tiempo agotado conectando al stream CAM")));
    upstream.on("error", (error) => {
      if (closed || res.destroyed) return;
      if (!headersWritten) {
        endWithError(504, error.message);
      } else {
        scheduleReconnect();
      }
    });
  };

  req.on("close", () => {
    closed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (upstream) upstream.destroy();
  });
  openUpstream();
}

async function serialPortExists(port) {                                               // Funcion serialPortExists: comprueba que un COM aun exista antes de abrirlo.
  const wanted = normalizePortAddress(port);
  if (!wanted) return false;                                                          // Condicion: valida puerto antes de buscarlo.
  const listed = await listPorts({ force: true });                                    // Espera asincrona: consulta snapshot actual de puertos.
  return (listed.ports || []).some((item) => normalizePortAddress(item.address) === wanted);
}

async function handleCamUsbStream(req, res, infoOrParsed) {                           // Funcion handleCamUsbStream: transmite MJPEG de la CAM via puerto serial USB usando un script PowerShell hijo.
  const info = infoOrParsed?.port ? infoOrParsed : {
    port: String(infoOrParsed.searchParams.get("port") || "").trim(),
    baud: Number(infoOrParsed.searchParams.get("baud") || 115200) || 115200,
    streamBaud: Number(infoOrParsed.searchParams.get("streamBaud") || CAM_USB_STREAM_BAUD) || CAM_USB_STREAM_BAUD
  };

  if (!/^(COM\d+|\/dev\/[\w./-]+)$/i.test(info.port)) {
    return sendJson(res, 400, { ok: false, output: "Puerto serial CAM invalido" });
  }
  if (!(await serialPortExists(info.port))) {                                         // Condicion: evita reinicios infinitos contra COM desconectados.
    return sendJson(res, 404, { ok: false, output: `Puerto serial CAM ${info.port} no existe. Pulsa Detectar puertos y elige el COM actual.` });
  }

  const baud = Math.min(Math.max(Number(info.baud) || 115200, 9600), 2000000);
  const streamBaud = Math.min(Math.max(Number(info.streamBaud) || CAM_USB_STREAM_BAUD, 9600), 2000000);
  const stamp = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const scriptPath = path.join(os.tmpdir(), `vesta-cam-usb-stream-${stamp}.ps1`);
  const stopPath = path.join(os.tmpdir(), `vesta-cam-usb-stop-${stamp}.flag`);
  const script = `
param(
  [string]$portName,
  [int]$baudRate,
  [int]$streamBaud,
  [string]$stopPath,
  [int]$markerTimeoutMs,
  [int]$frameTimeoutMs
)
$ErrorActionPreference = "Stop"
$serial = [System.IO.Ports.SerialPort]::new($portName, $baudRate, [System.IO.Ports.Parity]::None, 8, [System.IO.Ports.StopBits]::One)
$serial.NewLine = [string][char]10
$serial.ReadTimeout = 100
$serial.WriteTimeout = 1000
$serial.DtrEnable = $false
$serial.RtsEnable = $false
$serial.Open()
try {
  $cmd = '{"type":"usb_stream_start","baud":' + $streamBaud + '}'
  $serial.WriteLine($cmd)
  Start-Sleep -Milliseconds 120
  if ($streamBaud -ne $baudRate) {
    $serial.BaudRate = $streamBaud
    Start-Sleep -Milliseconds 220
  }

  $stdout = [Console]::OpenStandardOutput()
  $markerText = "${CAM_USB_STREAM_MARKER}" + [string][char]13 + [string][char]10
  $marker = [System.Text.Encoding]::ASCII.GetBytes($markerText)
  $window = [System.Collections.Generic.List[byte]]::new()
  $buffer = [byte[]]::new(8192)
  $deadline = [DateTime]::UtcNow.AddMilliseconds($markerTimeoutMs)
  $found = $false

  while ([DateTime]::UtcNow -lt $deadline -and -not $found) {
    if ($serial.BytesToRead -le 0) {
      Start-Sleep -Milliseconds 10
      continue
    }
    $readLen = [Math]::Min($buffer.Length, $serial.BytesToRead)
    $n = $serial.BaseStream.Read($buffer, 0, $readLen)
    for ($i = 0; $i -lt $n; $i++) {
      $window.Add($buffer[$i])
      if ($window.Count -gt $marker.Length) {
        $window.RemoveAt(0)
      }
      if ($window.Count -eq $marker.Length) {
        $matched = $true
        for ($j = 0; $j -lt $marker.Length; $j++) {
          if ($window[$j] -ne $marker[$j]) {
            $matched = $false
            break
          }
        }
        if ($matched) {
          $found = $true
          $remaining = $n - $i - 1
          if ($remaining -gt 0) {
            $stdout.Write($buffer, $i + 1, $remaining)
            $stdout.Flush()
          }
          break
        }
      }
    }
  }

  if (-not $found) {
    [Console]::Error.WriteLine("USB_STREAM_MARKER_TIMEOUT")
    exit 2
  }

  $lastFrameData = [DateTime]::UtcNow
  while (-not (Test-Path -LiteralPath $stopPath)) {
    if ($serial.BytesToRead -le 0) {
      if (([DateTime]::UtcNow - $lastFrameData).TotalMilliseconds -gt $frameTimeoutMs) {
        [Console]::Error.WriteLine("USB_STREAM_FRAME_TIMEOUT")
        exit 3
      }
      Start-Sleep -Milliseconds 2
      continue
    }
    $readLen = [Math]::Min($buffer.Length, $serial.BytesToRead)
    $n = $serial.BaseStream.Read($buffer, 0, $readLen)
    if ($n -gt 0) {
      $lastFrameData = [DateTime]::UtcNow
      $stdout.Write($buffer, 0, $n)
      $stdout.Flush()
    }
  }
} finally {
  try {
    if ($serial.IsOpen) {
      $serial.WriteLine('{"type":"usb_stream_stop"}')
      Start-Sleep -Milliseconds 250
    }
  } catch {}
  try {
    if ($serial.IsOpen) { $serial.Close() }
  } catch {}
}
`;

  fs.writeFileSync(scriptPath, script, "utf8");

  if (serialBridge?.port?.toLowerCase() === info.port.toLowerCase()) {
    stopSerialBridge();
  }

  res.writeHead(200, {
    "Content-Type": `multipart/x-mixed-replace; boundary=${CAM_USB_STREAM_BOUNDARY}`,
    "Cache-Control": "no-store",
    "Connection": "close",
    ...corsHeaders
  });

  let streamEnded = false;
  let stopping = false;
  let stderr = "";
  let child = null;
  let restartTimer = null;
  let restartCount = 0;

  // Funcion local | cleanup: limpia timers, archivos temporales y procesos de stream USB.
  const cleanup = () => {
    fs.rm(scriptPath, { force: true }, () => {});
    fs.rm(stopPath, { force: true }, () => {});
  };

  // Funcion local | requestStop: solicita cierre ordenado del stream USB.
  const requestStop = () => {
    if (stopping || streamEnded) return;
    stopping = true;
    if (restartTimer) clearTimeout(restartTimer);
    try {
      fs.writeFileSync(stopPath, "stop", "utf8");
    } catch {}
    setTimeout(() => {
      if (!streamEnded && child) child.kill();
    }, 2500);
  };

  // Funcion local | startChild: arranca el proceso PowerShell que lee MJPEG por serial.
  const startChild = () => {
    if (stopping || streamEnded || res.destroyed) return;
    stderr = "";
    try {
      fs.rmSync(stopPath, { force: true });
    } catch {}
    child = spawn("powershell", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      info.port,
      String(baud),
      String(streamBaud),
      stopPath,
      String(CAM_USB_MARKER_TIMEOUT_MS),
      String(CAM_USB_FRAME_TIMEOUT_MS)
    ], {
      cwd: root,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });

    child.stdout.on("data", (chunk) => {
      if (!res.destroyed) res.write(chunk);
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      stderr += error.message;
    });
    child.on("exit", () => {
      if (stderr.trim()) console.warn(`CAM USB stream ${info.port}: ${stderr.trim()}`);
      if (stopping || res.destroyed) {
        streamEnded = true;
        cleanup();
        if (!res.destroyed) res.end();
        return;
      }
      restartCount += 1;
      if (restartCount > 10) {
        streamEnded = true;
        cleanup();
        if (!res.destroyed) res.end();
        return;
      }
      restartTimer = setTimeout(startChild, Math.min(600 + restartCount * 250, 2500));
    });
  };

  req.on("close", requestStop);
  startChild();
}

async function handleCamCheck(req, res) {                                           // Funcion handleCamCheck: verifica si la ESP32-CAM es alcanzable por red o USB y reporta estado.
  try {
    const body = await readJsonBody(req);
    const stream = normalizeCamStreamUrl(body.url || body.stream || "");
    if (!stream) return sendJson(res, 400, { ok: false, output: "URL de CAM requerida" });

    const usbInfo = camUsbStreamInfo(stream);
    if (usbInfo) {
      const result = await readCamDiscoverySerial(usbInfo.port, usbInfo.baud, 2500);
      const status = parseCamDiscoveryOutput(result.output);
      const camLike = serialOutputLooksLikeCam(result.output);
      const usbVideo = status.usbVideo === true || status.usbSerialVideo === true;
      const cameraReady = camLike && status.cameraReady !== false;
      const ok = camLike && cameraReady && usbVideo;
      return sendJson(res, 200, {
        ok,
        reachable: camLike,
        stream,
        transport: "usb",
        status,
        output: !camLike
          ? `El puerto ${usbInfo.port} es ESP32 candidato, pero no responde como ESP32-CAM V.E.S.T.A. Sube el firmware CAM a ese COM y vuelve a detectar.`
          : !cameraReady
            ? "ESP32-CAM responde por USB, pero la camara aun no esta lista"
            : !usbVideo
              ? "ESP32-CAM responde, pero el firmware no anuncia video USB. Sube el firmware CAM actualizado."
              : "ESP32-CAM responde por USB",
        error: camLike && !ok ? (result.error || result.output || "") : ""
      });
    }

    const statusUrl = camStatusUrlFromStream(stream);
    const result = await requestText(statusUrl, 4500);
    if (!result.ok) {
      const apHint = isCamApUrl(stream)
        ? " Conecta esta PC al WiFi VESTA-CAM-SETUP; Windows puede decir sin internet y es normal."
        : "";
      return sendJson(res, 200, {
        ok: false,
        reachable: false,
        stream,
        statusUrl,
        output: `No puedo alcanzar la ESP32-CAM en ${statusUrl}.${apHint}`,
        error: result.error || `HTTP ${result.status || "sin respuesta"}`
      });
    }

    let status = {};
    try {
      status = result.output ? JSON.parse(result.output) : {};
    } catch {}

    const cameraReady = status.cameraReady !== false;
    return sendJson(res, 200, {
      ok: cameraReady,
      reachable: true,
      stream,
      statusUrl,
      status,
      output: cameraReady
        ? "ESP32-CAM responde por red"
        : "ESP32-CAM responde, pero la camara aun no esta lista"
    });
  } catch (error) {
    return sendJson(res, 500, { ok: false, output: error.message });
  }
}

function readCamDiscoverySerial(port, baud = 115200, timeoutMs = 8000) {            // Funcion readCamDiscoverySerial: abre COM via PowerShell, envia cmd_status y devuelve la respuesta serial raw.
  if (!/^(COM\d+|\/dev\/[\w./-]+)$/i.test(port)) {
    throw new Error("Puerto serial invalido");
  }

  const script = `
param(
  [string]$portName,
  [int]$baudRate,
  [int]$timeoutMs
)
$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($portName)) {
  throw "Puerto serial vacio"
}
$serial = [System.IO.Ports.SerialPort]::new($portName, $baudRate, [System.IO.Ports.Parity]::None, 8, [System.IO.Ports.StopBits]::One)
$serial.NewLine = [string][char]10
$serial.ReadTimeout = 100
$serial.WriteTimeout = 1000
$serial.Encoding = [System.Text.Encoding]::UTF8
$serial.DtrEnable = $false
$serial.RtsEnable = $false
$serial.Open()
$deadline = [DateTime]::UtcNow.AddMilliseconds($timeoutMs)
$nextWrite = [DateTime]::UtcNow
$buffer = ""
try {
  while ([DateTime]::UtcNow -lt $deadline) {
    if ([DateTime]::UtcNow -ge $nextWrite) {
      try { $serial.WriteLine('{"type":"cmd_status"}') } catch {}
      $nextWrite = [DateTime]::UtcNow.AddMilliseconds(1000)
    }
    try {
      if ($serial.BytesToRead -gt 0) {
        $chunk = $serial.ReadExisting()
        if ($chunk) {
          $buffer += $chunk
          [Console]::Out.Write($chunk)
          [Console]::Out.Flush()
        }
      }
    } catch {
      [Console]::Error.WriteLine("SERIAL_READ_ERROR:" + $_.Exception.Message)
    }
    if ($buffer -match '"type"\\s*:\\s*"cam_(status|hello)"') {
      Start-Sleep -Milliseconds 150
      if ($serial.BytesToRead -gt 0) {
        $chunk = $serial.ReadExisting()
        if ($chunk) {
          [Console]::Out.Write($chunk)
          [Console]::Out.Flush()
        }
      }
      break
    }
    Start-Sleep -Milliseconds 50
  }
} finally {
  if ($serial.IsOpen) { $serial.Close() }
}
`;

  const scriptPath = path.join(os.tmpdir(), `vesta-cam-discover-${process.pid}-${Date.now()}.ps1`);
  fs.writeFileSync(scriptPath, script, "utf8");

  return new Promise((resolve) => {
    let output = "";
    let error = "";
    let settled = false;
    const child = spawn("powershell", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      port,
      String(baud),
      String(timeoutMs)
    ], {
      cwd: root,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });

    const timer = setTimeout(() => {
      if (!settled) child.kill();
    }, timeoutMs + 2500);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { error += chunk; });
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fs.rm(scriptPath, { force: true }, () => {});
      resolve({ ok: false, output: output.trim(), error: err.message });
    });
    child.on("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fs.rm(scriptPath, { force: true }, () => {});
      resolve({
        ok: code === 0,
        code,
        output: [output, error].filter(Boolean).join("\n").trim(),
        error: error.trim()
      });
    });
  });
}

async function handleCamDiscover(req, res) {                                        // Funcion handleCamDiscover: escanea puertos COM buscando la ESP32-CAM y devuelve URL de stream o diagnostico.
  try {
    const body = await readJsonBody(req);
    const port = String(body.port || "").trim();
    const baud = Number(body.baud) || 115200;
    const timeoutMs = Math.min(Math.max(Number(body.timeoutMs) || 35000, 2500), 45000);
    const perPortTimeoutMs = Math.min(
      Math.max(Number(body.perPortTimeoutMs) || (port ? timeoutMs : 12000), 1200),
      30000
    );
    const scan = body.scan !== false;
    const attempts = [];

    const listed = await listPorts({ force: true });
    const allPorts = Array.isArray(listed.ports) ? listed.ports : [];
    let candidates = [];

    if (port) {
      let selected = allPorts.find((item) => String(item.address).toLowerCase() === port.toLowerCase());
      if (!selected && !scan) selected = await validateSerialPort(port);

      if (!selected) {
        attempts.push({ port, skipped: true, reason: "puerto no disponible; escaneando puertos actuales" });
      } else if (!isSerialScanCandidate(selected)) {
        if (scan) {
          attempts.push({ port: selected.address, skipped: true, reason: "no es USB serial valido para ESP32-CAM" });
        } else {
          return sendJson(res, 400, { ok: false, output: `${selected.address} no parece un puerto USB serial valido para ESP32-CAM` });
        }
      } else {
        candidates.push(selected);
      }
    }

    if (scan) {
      const seen = new Set(candidates.map((item) => item.address.toLowerCase()));
      const extras = allPorts
        .filter(isSerialScanCandidate)
        .filter((item) => !seen.has(item.address.toLowerCase()))
        .sort((a, b) => {
          const priority = camScanPriority(a) - camScanPriority(b);
          if (priority) return priority;
          return String(a.address).localeCompare(String(b.address), undefined, { numeric: true, sensitivity: "base" });
        });
      candidates.push(...extras);
    }

    if (!candidates.length) {
      return sendJson(res, 200, { ok: false, scanned: attempts, output: "No hay puertos USB serial activos para buscar la ESP32-CAM" });
    }

    const activeBridgePort = serialBridge?.port?.toLowerCase() || "";
    const hasBridgeAlternates = Boolean(activeBridgePort) && scan &&
      candidates.some((item) => item.address.toLowerCase() !== activeBridgePort);
    let fallback = null;
    for (const candidate of candidates) {
      const address = candidate.address;
      const explicit = port && address.toLowerCase() === port.toLowerCase();
      if (activeBridgePort && address.toLowerCase() === activeBridgePort) {
        if (!explicit || hasBridgeAlternates) {
          attempts.push({ port: address, skipped: true, reason: "ocupado por conexion serial del S3" });
          continue;
        }
        stopSerialBridge();
        await delay(700);
      }

      const result = await readCamDiscoverySerial(address, baud, explicit ? timeoutMs : perPortTimeoutMs);
      const urls = parseCamDiscoveryOutput(result.output);
      const camLike = serialOutputLooksLikeCam(result.output);
      const esp32Like = serialOutputLooksLikeEsp32(result.output);
      const diagnostics = camDiagnosticsFromOutput(result.output);
      const cameraReady = urls.cameraReady !== false;
      const usbVideo = Boolean(urls.usbVideo);
      const usbBaud = Math.min(Number(urls.usbStreamBaud || CAM_USB_STREAM_BAUD) || CAM_USB_STREAM_BAUD, CAM_USB_STREAM_BAUD);
      const usbStream = usbVideo && cameraReady
        ? localCamUsbStreamUrl(address, baud, usbBaud)
        : "";
      if (!diagnostics.reason && isCamApUrl(urls.stream)) {
        diagnostics.reason = "ap-fallback";
        diagnostics.apFallback = true;
        diagnostics.apSsid = diagnostics.apSsid || urls.apSsid || "VESTA-CAM-SETUP";
      }
      attempts.push({
        port: address,
        ok: Boolean(urls.stream),
        detected: Boolean(urls.stream || camLike || esp32Like || candidate.guess === "cam" || candidate.guess === "esp32"),
        camLike,
        esp32Like,
        usbVideo,
        cameraReady,
        reason: diagnostics.reason,
        ssid: diagnostics.ssid,
        apSsid: diagnostics.apSsid,
        guess: candidate.guess || "",
        label: candidate.label || candidate.name || "",
        output: result.output || result.error || ""
      });

      if (usbStream) {
        return sendJson(res, 200, {
          ok: true,
          detected: true,
          port: address,
          baud,
          streamBaud: usbBaud,
          scanned: attempts,
          transport: "usb",
          usbStream: true,
          stream: usbStream,
          networkStream: urls.stream || "",
          reason: diagnostics.reason,
          ssid: diagnostics.ssid,
          apSsid: diagnostics.apSsid,
          ip: urls.ip || "",
          wifiMode: urls.wifiMode || "",
          output: result.output
        });
      }

      if (!urls.stream) {
        if (!fallback && (camLike || esp32Like || candidate.guess === "cam" || candidate.guess === "esp32")) {
          fallback = { address, candidate, result, camLike, esp32Like, diagnostics };
        }
        continue;
      }

      return sendJson(res, 200, {
        ok: true,
        detected: true,
        port: address,
        baud,
        scanned: attempts,
        transport: "network",
        usbStream: false,
        reason: diagnostics.reason,
        ssid: diagnostics.ssid,
        apSsid: diagnostics.apSsid,
        ...urls,
        output: result.output
      });
    }

    if (fallback) {
      return sendJson(res, 200, {
        ok: false,
        detected: true,
        port: fallback.address,
        baud,
        scanned: attempts,
        reason: fallback.diagnostics.reason,
        ssid: fallback.diagnostics.ssid,
        apSsid: fallback.diagnostics.apSsid,
        output: camFallbackOutput(fallback.address, fallback.diagnostics, fallback.camLike)
      });
    }

    return sendJson(res, 200, {
      ok: false,
      baud,
      scanned: attempts,
      output: `No encontre una ESP32-CAM respondiendo por COM. Puertos probados: ${describeScannedPorts(attempts)}`
    });
  } catch (error) {
    return sendJson(res, 400, { ok: false, output: error.message });
  }
}

function isOldBundledSketch(device, code) {                                         // Funcion isOldBundledSketch: detecta si el codigo recibido es una version desactualizada del firmware bundled.
  if (!code.trim()) return false;
  if (device === "s3") {
    return code.includes("V.E.S.T.A. ESP32-S3 controller firmware") &&
      (!code.includes("SERIAL_CLIENT") ||
        !code.includes("IMU_OUTPUT_EMA_ALPHA") ||
        !code.includes("moveServoTowardTarget") ||
        !code.includes("cmd_tuning") ||
        !code.includes("CONTROL_DIRECT_SERVO_FOLLOW") ||
        code.includes("runBootServoSweep") ||
        code.includes("maxSpeedDegSec = 90.0f") ||
        code.includes("smoothing = 0.25f"));
  }
  if (device === "cam") {
    return code.includes("V.E.S.T.A. ESP32-CAM assistant firmware") &&
      (code.includes("MDNS.update();") ||
        !code.includes("discardCameraFrames") ||
        !code.includes("delayWithServices") ||
        !code.includes("CAMERA_CPU_MHZ"));
  }
  return false;
}

function normalizeSketchCode(code) {                                                // Funcion normalizeSketchCode: envuelve MDNS.update() en guardia ESP8266 para compatibilidad arduino-cli.
  return code.replace(/^[ \t]*MDNS\.update\(\);\s*$/gm, [
    "#if defined(ESP8266)",
    "  MDNS.update();",
    "#endif"
  ].join("\n"));
}

function writeSketchTemp(device, code) {                                            // Funcion writeSketchTemp: copia el sketch y archivos extra a un directorio temporal listo para arduino-cli.
  const safeDevice = /^[a-z0-9_-]+$/i.test(device) ? device : "s3";
  const bundled = bundledFirmware[safeDevice] || bundledFirmware.s3;
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), `vesta-${safeDevice}-`));
  const sketchName = bundled.sketchName;
  const sketchDir = path.join(parent, sketchName);
  const buildDir = path.join(parent, "build");
  fs.mkdirSync(sketchDir, { recursive: true });
  fs.mkdirSync(buildDir, { recursive: true });
  const inoPath = path.join(sketchDir, `${sketchName}.ino`);
  if (code.trim() && !isOldBundledSketch(safeDevice, code)) {
    fs.writeFileSync(inoPath, normalizeSketchCode(code), "utf8");
  } else {
    fs.copyFileSync(bundled.ino, inoPath);
  }
  bundled.extraFiles.forEach((file) => {
    fs.copyFileSync(file, path.join(sketchDir, path.basename(file)));
  });
  return { parent, sketchDir, buildDir, inoPath };
}

async function handleUpload(req, res) {                                             // Funcion handleUpload: compila y sube firmware via arduino-cli de forma sincrona; devuelve JSON con resultado.
  try {
    const body = await readJsonBody(req);
    const device = String(body.device || "esp32");
    const action = body.action === "upload" ? "upload" : "verify";
    const requestedFqbn = String(body.fqbn || "").trim();
    const requestedPort = String(body.port || "").trim();
    const useBundled = Boolean(body.useBundled || body.bundled);
    const code = useBundled ? "" : String(body.code || "");

    if (!code.trim() && !bundledFirmware[device]) return sendJson(res, 400, { ok: false, output: "Codigo requerido" });

    const target = action === "upload"
      ? await detectUploadTarget(device, requestedPort, requestedFqbn)
      : { port: requestedPort, board: requestedFqbn || defaultFqbnForDevice(device) };
    const fqbn = target.board || requestedFqbn || defaultFqbnForDevice(device);
    const port = target.port || requestedPort;

    if (!fqbn) return sendJson(res, 400, { ok: false, output: "FQBN requerido" });

    const tmp = writeSketchTemp(device, code);
    const compile = await run(arduinoCli, ["compile", "--fqbn", fqbn, "--build-path", tmp.buildDir, tmp.sketchDir], { timeout: ARDUINO_COMPILE_TIMEOUT_MS });
    let output = [
      target.autoDetected ? `Puerto detectado automaticamente: ${port}` : port ? `Puerto: ${port}` : "",
      `FQBN: ${fqbn}`,
      `$ arduino-cli compile --fqbn ${fqbn}`,
      compile.output || compile.error
    ].filter(Boolean).join("\n");

    if (!compile.ok || action === "verify") {
      return sendJson(res, compile.ok ? 200 : 500, { ok: compile.ok, output, port, fqbn });
    }

    if (!port) {
      return sendJson(res, 500, {
        ok: false,
        output: `${output}\n\nNo se pudo detectar el puerto COM para subir. Conecta la placa o selecciona un puerto.`,
        port,
        fqbn
      });
    }

    const upload = await run(arduinoCli, ["upload", "-p", port, "--fqbn", fqbn, "--input-dir", tmp.buildDir, tmp.sketchDir], { timeout: ARDUINO_UPLOAD_TIMEOUT_MS });
    output += `\n\n$ arduino-cli upload -p ${port} --fqbn ${fqbn}\n${upload.output || upload.error}`;
    return sendJson(res, upload.ok ? 200 : 500, { ok: upload.ok, output, port, fqbn });
  } catch (error) {
    return sendJson(res, 500, { ok: false, output: error.message });
  }
}

function uploadNeedsBootRetry(output) {                                             // Funcion uploadNeedsBootRetry: detecta fallos tipicos de entrada a modo carga ESP32.
  const text = String(output || "");
  return /failed to connect|timed out waiting for packet|no serial data received|wrong boot mode|serial data stream stopped|invalid head of packet|download mode/i.test(text);
}

async function handleUploadStream(req, res) {                                       // Funcion handleUploadStream: compila y sube firmware emitiendo eventos NDJSON en tiempo real con guias de BOOT.
  try {
    const body = await readJsonBody(req);
    const device = String(body.device || "esp32");
    const action = body.action === "upload" ? "upload" : "verify";
    const requestedFqbn = String(body.fqbn || "").trim();
    const requestedPort = String(body.port || "").trim();
    const useBundled = Boolean(body.useBundled || body.bundled);
    const manualBoot = Boolean(body.manualBoot);
    const code = useBundled ? "" : String(body.code || "");

    if (!code.trim() && !bundledFirmware[device]) return sendJson(res, 400, { ok: false, output: "Codigo requerido" });

    res.writeHead(200, {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders
    });

    // Funcion local | send: emite eventos NDJSON durante compilacion y subida.
    const send = (data) => sendNdjson(res, data);
    const target = action === "upload"
      ? await detectUploadTarget(device, requestedPort, requestedFqbn)
      : { port: requestedPort, board: requestedFqbn || defaultFqbnForDevice(device) };
    const fqbn = target.board || requestedFqbn || defaultFqbnForDevice(device);
    const port = target.port || requestedPort;

    if (!fqbn) {
      send({ type: "final", ok: false, phase: "detect", output: "FQBN requerido" });
      return res.end();
    }

    send({
      type: "phase",
      phase: "detect",
      port,
      fqbn,
      message: port
        ? `${target.autoDetected ? "Puerto detectado automaticamente" : "Puerto seleccionado"}: ${port} | FQBN: ${fqbn}`
        : `Sin puerto detectado todavia | FQBN: ${fqbn}`
    });

    const tmp = writeSketchTemp(device, code);
    send({ type: "phase", phase: "compile", message: `Compilando ${device.toUpperCase()}... puede tardar varios minutos la primera vez.` });
    send({ type: "log", stream: "stdout", text: `$ arduino-cli compile --fqbn ${fqbn}\n` });

    const compile = await runStreaming(
      arduinoCli,
      ["compile", "--fqbn", fqbn, "--build-path", tmp.buildDir, tmp.sketchDir],
      { timeout: ARDUINO_COMPILE_TIMEOUT_MS },
      send
    );

    if (!compile.ok || action === "verify") {
      send({
        type: "final",
        ok: compile.ok,
        phase: action,
        port,
        fqbn,
        output: compile.output || compile.error || ""
      });
      return res.end();
    }

    if (!port) {
      send({
        type: "final",
        ok: false,
        phase: "detect",
        port,
        fqbn,
        output: "No se pudo detectar el puerto COM para subir. Conecta la placa o selecciona un puerto."
      });
      return res.end();
    }

    if (serialBridge?.port?.toLowerCase() === port.toLowerCase()) {
      send({ type: "phase", phase: "serial", message: `Cerrando conexion serial en ${port} para poder subir firmware...` });
      stopSerialBridge();
      await delay(900);
    }

    // Funcion local | runUploadAttempt: ejecuta un intento de carga con guia BOOT opcional.
    const runUploadAttempt = async (guidedBoot) => {
      if (guidedBoot) {
        send({
          type: "boot",
          state: "press",
          message: "Mantén BOOT presionado ahora. Si tu placa tiene EN/RST, tócalo una vez sin soltar BOOT."
        });
        for (let seconds = ARDUINO_BOOT_COUNTDOWN_SECONDS; seconds >= 1; seconds--) {
          send({ type: "phase", phase: "boot-countdown", message: `La subida inicia en ${seconds}... sigue presionando BOOT.` });
          await delay(1000);
        }
      } else {
        send({ type: "phase", phase: "upload-auto", message: `Subiendo a ${port} con reset automatico.` });
      }

      send({
        type: "phase",
        phase: "upload",
        message: guidedBoot
          ? `Subiendo a ${port}. Mantén BOOT hasta que la consola diga que lo sueltes.`
          : `Subiendo a ${port}.`
      });
      send({ type: "log", stream: "stdout", text: `\n$ arduino-cli upload -v -p ${port} --fqbn ${fqbn}\n` });

      let connectingHintSent = false;
      let releaseSent = false;
      const upload = await runStreaming(
        arduinoCli,
        ["upload", "-v", "-p", port, "--fqbn", fqbn, "--input-dir", tmp.buildDir, tmp.sketchDir],
        { timeout: ARDUINO_UPLOAD_TIMEOUT_MS },
        (event) => {
          if (event.type === "log") {
            if (guidedBoot && !connectingHintSent && /connecting/i.test(event.text)) {
              connectingHintSent = true;
              send({
                type: "boot",
                state: "hold",
                message: "Sigue presionando BOOT. Si solo ves puntos, toca EN/RST una vez sin soltar BOOT."
              });
            }
            if (!releaseSent && /(chip is|stub running|changing baud|writing at|compressed)/i.test(event.text)) {
              releaseSent = true;
              send({
                type: "boot",
                state: "release",
                message: guidedBoot
                  ? "Suelta BOOT ahora. La placa ya entró en modo carga."
                  : "Modo carga detectado automaticamente."
              });
            }
          }
          send(event);
        }
      );

      return { upload, releaseSent };
    };

    let attempt = await runUploadAttempt(manualBoot);
    if (!attempt.upload.ok && !manualBoot && uploadNeedsBootRetry(attempt.upload.output || attempt.upload.error)) {
      send({
        type: "boot",
        state: "retry",
        message: "No entro en modo carga automatico. Reintento guiado con BOOT."
      });
      attempt = await runUploadAttempt(true);
    }

    const upload = attempt.upload;
    if (upload.ok && !attempt.releaseSent) {
      send({ type: "boot", state: "release", message: "Subida terminada." });
    } else if (!upload.ok && !attempt.releaseSent) {
      send({
        type: "boot",
        state: "retry",
        message: "No se detectó modo carga. Reintenta: mantén BOOT, toca EN/RST una vez y vuelve a presionar Subir."
      });
    }

    send({
      type: "final",
      ok: upload.ok,
      phase: "upload",
      port,
      fqbn,
      output: upload.output || upload.error || ""
    });
    return res.end();
  } catch (error) {
    if (!res.headersSent) return sendJson(res, 500, { ok: false, output: error.message });
    sendNdjson(res, { type: "final", ok: false, phase: "error", output: error.message });
    return res.end();
  }
}

async function apiHandler(req, res, parsed) {                                       // Funcion apiHandler: enrutador principal de la API REST; despacha cada pathname al handler correspondiente.
  if (req.method === "OPTIONS" && parsed.pathname.startsWith("/api/")) {
    res.writeHead(204, corsHeaders);
    return res.end();
  }

  if (req.method === "GET" && parsed.pathname === "/api/arduino/status") {
    const result = await run(arduinoCli, ["version"], { timeout: 8000 });
    return sendJson(res, 200, {
      ok: result.ok,
      version: result.ok ? result.output : "",
      output: result.output || result.error,
      cli: arduinoCli
    });
  }

  if (req.method === "GET" && parsed.pathname === "/api/arduino/ports") {
    const force = ["1", "true", "yes"].includes(String(parsed.searchParams.get("force") || "").toLowerCase());
    const result = await listPorts({ force });
    return sendJson(res, 200, result);
  }

  if (req.method === "GET" && parsed.pathname === "/api/arduino/detect") {
    const device = String(parsed.searchParams.get("device") || "s3");
    const port = String(parsed.searchParams.get("port") || "").trim();
    const fqbn = String(parsed.searchParams.get("fqbn") || "").trim();
    const target = await detectUploadTarget(device, port, fqbn);
    return sendJson(res, 200, {
      ok: Boolean(target.port),
      port: target.port,
      fqbn: target.board,
      board: target.board,
      name: target.name,
      guess: target.guess,
      autoDetected: target.autoDetected
    });
  }

  if (req.method === "POST" && parsed.pathname === "/api/arduino/upload") {
    return handleUpload(req, res);
  }

  if (req.method === "POST" && parsed.pathname === "/api/arduino/upload-stream") {
    return handleUploadStream(req, res);
  }

  if (req.method === "POST" && parsed.pathname === "/api/s3/discover") {
    return handleS3Discover(req, res);
  }

  if (req.method === "POST" && parsed.pathname === "/api/cam/discover") {
    return handleCamDiscover(req, res);
  }

  if (req.method === "POST" && parsed.pathname === "/api/cam/check") {
    return handleCamCheck(req, res);
  }

  if (req.method === "GET" && parsed.pathname === "/api/cam/stream") {
    return handleCamStreamProxy(req, res, parsed);
  }

  if (req.method === "GET" && parsed.pathname === "/api/cam/usb-stream") {
    return handleCamUsbStream(req, res, parsed);
  }

  if (req.method === "POST" && parsed.pathname === "/api/wifi/connect-cam") {
    return handleWifiConnectCam(req, res);
  }

  if (req.method === "POST" && parsed.pathname === "/api/wifi/restore") {
    return handleWifiRestore(req, res);
  }

  if (req.method === "GET" && parsed.pathname === "/api/serial/status") {
    return sendJson(res, 200, serialStatus());
  }

  if (req.method === "GET" && parsed.pathname === "/api/serial/events") {
    return handleSerialEvents(req, res);
  }

  if (req.method === "POST" && parsed.pathname === "/api/serial/connect") {
    return handleSerialConnect(req, res);
  }

  if (req.method === "POST" && parsed.pathname === "/api/serial/send") {
    return handleSerialSend(req, res);
  }

  if (req.method === "POST" && parsed.pathname === "/api/serial/disconnect") {
    stopSerialBridge();
    return sendJson(res, 200, { ok: true, output: "Serial desconectado" });
  }

  return sendJson(res, 404, { ok: false, output: "Endpoint no encontrado" });
}

function safePath(requestUrl) {                                                     // Funcion safePath: valida y resuelve rutas estaticas evitando path-traversal fuera de root.
  const parsed = new URL(requestUrl, "http://localhost");
  const decoded = decodeURIComponent(parsed.pathname);
  let target = decoded === "/" ? "/index.html" : decoded;
  if (decoded === "/" && !fs.existsSync(path.resolve(root, ".\\index.html"))) {
    target = "/technical_V.E.S.T.A..html";
  }
  const resolved = path.resolve(root, `.${target}`);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return resolved;
}

function handler(req, res) {                                                        // Funcion handler: callback HTTP principal; enruta /api/ al apiHandler y archivos estaticos al sistema de archivos.
  const parsed = new URL(req.url, "http://localhost");
  if (parsed.pathname.startsWith("/api/")) {
    apiHandler(req, res, parsed).catch((error) => {
      if (!res.headersSent) {
        sendJson(res, 500, { ok: false, output: error.message });
      } else {
        res.end();
      }
    });
    return;
  }

  const filePath = safePath(req.url);
  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (statError, stat) => {
    if (statError || !stat.isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mime[ext] || "application/octet-stream",
      "Cache-Control": "no-store",
      "Cross-Origin-Opener-Policy": "same-origin"
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

function start(port) {                                                              // Funcion start: crea el servidor HTTP, escucha en 127.0.0.1 e incrementa puerto si EADDRINUSE.
  const server = http.createServer(handler);
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      start(port + 1);
      return;
    }
    console.error(error);
    process.exitCode = 1;
  });
  server.listen(port, "127.0.0.1", () => {
    localServerPort = port;
    console.log(`V.E.S.T.A Tecnico listo en http://127.0.0.1:${port}`);
    console.log("Ctrl+C para detener.");
    startPortWatcher();
  });
}

start(firstPort);
