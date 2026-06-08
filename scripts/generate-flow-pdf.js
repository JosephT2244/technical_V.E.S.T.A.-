/* Comentarios de programador: genera un PDF tecnico con diagramas de flujo del codigo. */
// Archivo        | generate-flow-pdf.js: construye diagramas tecnicos HTML/PDF desde Graphviz.

"use strict";

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const vizJs = require("@viz-js/viz");

const root = path.resolve(__dirname, "..");
const docsDir = path.join(root, "docs");
const htmlPath = path.join(docsDir, "vesta-code-flow-diagram.html");
const pdfPath = path.join(docsDir, "vesta-code-flow-diagram.pdf");

const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
];

// Funcion       | escHtml: escapa texto para insertarlo con seguridad en HTML.
function escHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Funcion       | dotText: prepara cadenas para etiquetas dentro de Graphviz DOT.
function dotText(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");
}

// Funcion       | graph: envuelve nodos y aristas en una definicion DOT completa.
function graph(name, body, options = {}) {
  const rankdir = options.rankdir || "LR";
  return `
digraph "${dotText(name)}" {
  graph [
    rankdir="${rankdir}",
    bgcolor="transparent",
    pad="0.18",
    nodesep="0.42",
    ranksep="0.62",
    splines=ortho,
    outputorder=edgesfirst
  ];
  node [
    shape=box,
    style="rounded,filled",
    fontname="Arial",
    fontsize=10,
    color="#7f91a6",
    penwidth=1.4,
    fillcolor="#ffffff",
    margin="0.12,0.08"
  ];
  edge [
    fontname="Arial",
    fontsize=9,
    color="#315b80",
    arrowsize=0.7,
    penwidth=1.2
  ];
  ${body}
}`;
}

// Funcion       | node: crea la declaracion DOT de un nodo visual.
function node(id, label, opts = {}) {
  const attrs = {
    label,
    fillcolor: opts.fill || "#ffffff",
    color: opts.color || "#7f91a6",
    shape: opts.shape || "box"
  };
  if (opts.width) attrs.width = opts.width;
  if (opts.height) attrs.height = opts.height;
  const attrText = Object.entries(attrs)
    .map(([key, value]) => `${key}="${dotText(value)}"`)
    .join(", ");
  return `${id} [${attrText}];`;
}

// Funcion       | edge: crea una relacion dirigida entre nodos del diagrama.
function edge(from, to, label = "") {
  return `${from} -> ${to}${label ? ` [label="${dotText(label)}"]` : ""};`;
}

// Funcion       | cluster: agrupa nodos relacionados dentro de un subgrafo.
function cluster(name, label, body, color = "#d8e7f5") {
  return `
  subgraph cluster_${name} {
    label="${dotText(label)}";
    color="${color}";
    fontname="Arial";
    fontsize=12;
    penwidth=1.3;
    style="rounded,dashed";
    ${body}
  }`;
}

// Funcion       | legendRows: convierte filas de leyenda en una tabla HTML.
function legendRows(rows) {
  return `
    <table class="matrix">
      <thead><tr><th>Elemento</th><th>Rol dentro del flujo</th><th>Archivo principal</th></tr></thead>
      <tbody>
        ${rows.map((row) => `<tr><td>${escHtml(row[0])}</td><td>${escHtml(row[1])}</td><td><code>${escHtml(row[2])}</code></td></tr>`).join("")}
      </tbody>
    </table>`;
}

const diagrams = [
  {
    title: "1. Arquitectura General Del Sistema",
    intent: "Muestra los contenedores principales y como se comunican la consola tecnica, el servidor local y las dos placas.",
    dot: graph("architecture", `
      ${cluster("browser", "Navegador / UI tecnica", `
        ${node("login", "index.html + login.js\\nAutenticacion local", { fill: "#eef7ff" })}
        ${node("ui", "technical_V.E.S.T.A..html\\napp.js + styles.css\\nConsola de calibracion", { fill: "#eef7ff" })}
      `)}
      ${cluster("server", "Servidor local Node", `
        ${node("srv", "server.js\\nHTTP, API, archivos estaticos", { fill: "#f7fbff" })}
        ${node("arduino", "arduino-cli.exe\\ncompile / upload", { fill: "#fff7e8" })}
        ${node("serial", "Puente serial + SSE\\nCOM 115200 / stream", { fill: "#fff7e8" })}
        ${node("proxy", "Proxy CAM\\nHTTP MJPEG / USB MJPEG", { fill: "#fff7e8" })}
      `)}
      ${cluster("hardware", "Hardware V.E.S.T.A", `
        ${node("s3", "ESP32-S3\\nesp32_s3_controller.ino\\nSensores, servos, BLE, WS", { fill: "#ecfff5" })}
        ${node("cam", "ESP32-CAM\\nesp32_cam_assistant.ino\\nVideo, audio, estado", { fill: "#ecfff5" })}
        ${node("act", "PCA9685 + 6 servos\\nTCA9548A + 4 MPU6050\\n2 AS5600 + estop", { fill: "#f4fff8" })}
      `)}
      ${edge("login", "ui", "sesion _vs")}
      ${edge("ui", "srv", "fetch /api")}
      ${edge("srv", "ui", "JSON / NDJSON / SSE")}
      ${edge("srv", "arduino", "compile/upload")}
      ${edge("srv", "serial", "COM bridge")}
      ${edge("serial", "s3", "cmd_status / JSON")}
      ${edge("serial", "cam", "cmd_status / usb_stream")}
      ${edge("ui", "s3", "WebSocket 81")}
      ${edge("ui", "proxy", "MJPEG local")}
      ${edge("proxy", "cam", "HTTP o USB")}
      ${edge("cam", "s3", "estado CAM por WS")}
      ${edge("s3", "act", "lectura/control")}
    `)
  },
  {
    title: "2. Login, Sesion Y Entrada A La Consola",
    intent: "Resume el flujo de acceso antes de cargar la consola tecnica.",
    dot: graph("login", `
      ${node("start", "Usuario abre index.html", { fill: "#eef7ff" })}
      ${node("loadCreds", "login.js carga CREDENTIALS\\ny parametros SEC")}
      ${node("submit", "Submit loginForm\\ndoLogin(event)")}
      ${node("lock", "getLockout()\\nExiste bloqueo vigente?", { shape: "diamond", fill: "#fff8e8" })}
      ${node("validate", "Validar longitud\\nusuario + password")}
      ${node("hash", "sha256(password)\\nWeb Crypto")}
      ${node("compare", "Comparar hash contra\\nCREDENTIALS[username]", { shape: "diamond", fill: "#fff8e8" })}
      ${node("ok", "clearAttempts()\\ngenerateToken()\\nsessionStorage['_vs']", { fill: "#ebfff4" })}
      ${node("fail", "recordFailure()\\nupdateDots()\\nshowError()", { fill: "#fff0f0" })}
      ${node("blocked", "Bloqueo 15 min\\nstartLockoutTimer()", { fill: "#fff0f0" })}
      ${node("guest", "doGuestLogin()\\nsesion invitado", { fill: "#f4f7ff" })}
      ${node("console", "Redireccion a\\ntechnical_V.E.S.T.A..html", { fill: "#ebfff4" })}
      ${edge("start", "loadCreds")}
      ${edge("loadCreds", "submit")}
      ${edge("submit", "lock")}
      ${edge("lock", "blocked", "si")}
      ${edge("lock", "validate", "no")}
      ${edge("validate", "hash", "datos validos")}
      ${edge("hash", "compare")}
      ${edge("compare", "ok", "match")}
      ${edge("compare", "fail", "no match")}
      ${edge("fail", "blocked", "max intentos")}
      ${edge("ok", "console")}
      ${edge("guest", "console")}
    `)
  },
  {
    title: "3. Inicializacion De La Consola Web",
    intent: "Describe el arranque de app.js, hidratacion de estado, render inicial y enlace de eventos.",
    dot: graph("client_init", `
      ${node("guard", "HTML valida sessionStorage _vs\\nsi falta: index.html")}
      ${node("module", "app.js IIFE\\n'use strict'")}
      ${node("defaults", "SERVO_DEFAULTS\\nIMU_DEFAULTS\\nAS5600_DEFAULTS\\nBOM / TEST_DEFS")}
      ${node("state", "defaultState()\\nloadState()\\nhydrateState()")}
      ${node("hydrate", "hydrateInputs()\\nupdateTuningLabels()\\nsetDisplayedMode()")}
      ${node("renderA", "renderBuild()\\nrenderHardwareChecks()\\nrenderServoTable()")}
      ${node("renderB", "renderManualPanel()\\nrenderSensorCards()\\nrenderMapping()\\nrenderReadiness()")}
      ${node("bind", "bindNavigation()\\nbindConnection()\\nbindFirmware()\\nbindForms()\\nbindGlobalButtons()")}
      ${node("auto", "loadBundledFirmware()\\nrefreshArduinoStatus()\\nrefreshPorts()\\nconnectSerialEvents()")}
      ${node("draw", "queueDraw()\\ndrawExoskeleton()")}
      ${edge("guard", "module")}
      ${edge("module", "defaults")}
      ${edge("defaults", "state")}
      ${edge("state", "hydrate")}
      ${edge("hydrate", "renderA")}
      ${edge("renderA", "renderB")}
      ${edge("renderB", "bind")}
      ${edge("bind", "auto")}
      ${edge("auto", "draw")}
    `)
  },
  {
    title: "4. Navegacion Y Paneles De La Consola",
    intent: "Mapa funcional de los paneles principales y sus salidas hacia firmware, hardware o perfil.",
    dot: graph("panels", `
      ${node("rail", "Rail lateral\\n01..09 fases", { fill: "#eef7ff" })}
      ${node("armado", "Armado\\nBOM + pasos\\nlocalStorage")}
      ${node("firmware", "Firmware\\nleer .ino/.h\\nverify/upload")}
      ${node("diag", "Diagnostico\\nstatus, I2C, hardware checks\\nmodo/stop/reset")}
      ${node("servos", "Servos\\nPWM min/max\\nhome, dir, offset")}
      ${node("manual", "Manual\\nsliders\\nhome/sweep por servo")}
      ${node("sensores", "Sensores\\nIMU neutral/min/max\\nAS5600 raw0/raw90")}
      ${node("mapeo", "Mapeo\\nassist, deadband\\nsmoothing, maxSpeed")}
      ${node("pruebas", "Pruebas\\nrunAllTests()\\nawaitPacket()")}
      ${node("entrega", "Entrega\\nreadiness gate\\nprofile JSON")}
      ${node("commands", "sendCommand()\\ncmd_* hacia S3", { fill: "#ebfff4" })}
      ${node("profile", "buildProfile()\\ncopy/download/send", { fill: "#ebfff4" })}
      ${edge("rail", "armado")}
      ${edge("rail", "firmware")}
      ${edge("rail", "diag")}
      ${edge("rail", "servos")}
      ${edge("rail", "manual")}
      ${edge("rail", "sensores")}
      ${edge("rail", "mapeo")}
      ${edge("rail", "pruebas")}
      ${edge("rail", "entrega")}
      ${edge("diag", "commands", "cmd_status/mode/stop/reset")}
      ${edge("servos", "commands", "cmd_angle/profile")}
      ${edge("manual", "commands", "cmd_angle/cmd_home")}
      ${edge("sensores", "profile")}
      ${edge("mapeo", "profile")}
      ${edge("entrega", "profile")}
      ${edge("profile", "commands", "cmd_calibration_*")}
    `)
  },
  {
    title: "5. Conexion, Descubrimiento Y Telemetria",
    intent: "Flujo de deteccion automatica de S3/CAM, conexion WebSocket, serial y actualizacion de UI.",
    dot: graph("connectivity", `
      ${node("ports", "refreshPortsNow()\\n/api/arduino/ports")}
      ${node("sse", "connectSerialEvents()\\n/api/serial/events")}
      ${node("detect", "handleDetectedPort()\\nshowEspAlert()")}
      ${node("choose", "Usuario elige\\nconectar o subir firmware", { shape: "diamond", fill: "#fff8e8" })}
      ${node("s3serial", "connectS3Serial()\\n/api/serial/connect")}
      ${node("discoverS3", "detectS3UrlFromSerial()\\ncmd_status")}
      ${node("ws", "connectS3()\\nWebSocket ws://...:81")}
      ${node("incoming", "handleMessage(raw, source)")}
      ${node("telemetry", "updateFromTelemetry(packet)\\nservos, sensores, modo, cam")}
      ${node("ui", "updateLive()\\nrenderLiveMetrics()\\nqueueDraw()")}
      ${node("camdetect", "detectCamSerial()\\n/api/cam/discover")}
      ${node("camurl", "applyDetectedCamUrl()\\nUSB stream o HTTP stream")}
      ${node("camera", "startCamera()\\nopenCameraStream()")}
      ${edge("ports", "sse")}
      ${edge("sse", "detect", "port-added")}
      ${edge("detect", "choose")}
      ${edge("choose", "s3serial", "conectar S3")}
      ${edge("s3serial", "discoverS3")}
      ${edge("discoverS3", "ws")}
      ${edge("ws", "incoming", "message")}
      ${edge("incoming", "telemetry")}
      ${edge("telemetry", "ui")}
      ${edge("choose", "camdetect", "conectar CAM")}
      ${edge("camdetect", "camurl")}
      ${edge("camurl", "camera")}
    `)
  },
  {
    title: "6. Servidor Local: Rutas API Y Archivos",
    intent: "Muestra como server.js separa archivos estaticos, API, firmware, serial y camara.",
    dot: graph("server_routes", `
      ${node("http", "HTTP request\\nhandler(req,res)")}
      ${node("api", "URL empieza /api ?", { shape: "diamond", fill: "#fff8e8" })}
      ${node("apiHandler", "apiHandler(req,res,parsed)")}
      ${node("static", "safePath()\\nfs.createReadStream()\\nMIME")}
      ${node("arduinoStatus", "GET /api/arduino/status\\narduino-cli version")}
      ${node("ports", "GET /api/arduino/ports\\nlistPorts()")}
      ${node("upload", "POST /api/arduino/upload\\nhandleUpload()")}
      ${node("uploadStream", "POST /api/arduino/upload-stream\\nhandleUploadStream()")}
      ${node("serial", "/api/serial/*\\nconnect/send/events/disconnect")}
      ${node("s3", "POST /api/s3/discover\\nreadS3DiscoverySerial()")}
      ${node("cam", "/api/cam/*\\ndiscover/check/usb-stream")}
      ${node("wifi", "/api/wifi/*\\nconnect/restore CAM AP")}
      ${node("json", "sendJson()\\nsendNdjson()\\nsendSse()")}
      ${edge("http", "api")}
      ${edge("api", "apiHandler", "si")}
      ${edge("api", "static", "no")}
      ${edge("apiHandler", "arduinoStatus")}
      ${edge("apiHandler", "ports")}
      ${edge("apiHandler", "upload")}
      ${edge("apiHandler", "uploadStream")}
      ${edge("apiHandler", "serial")}
      ${edge("apiHandler", "s3")}
      ${edge("apiHandler", "cam")}
      ${edge("apiHandler", "wifi")}
      ${edge("arduinoStatus", "json")}
      ${edge("ports", "json")}
      ${edge("upload", "json")}
      ${edge("uploadStream", "json")}
      ${edge("serial", "json")}
      ${edge("s3", "json")}
      ${edge("cam", "json")}
      ${edge("wifi", "json")}
    `)
  },
  {
    title: "7. Carga De Firmware Con arduino-cli",
    intent: "Detalle de verificacion/subida para ESP32-S3 y ESP32-CAM desde la pestaña Firmware.",
    dot: graph("firmware_upload", `
      ${node("uiAction", "runFirmwareAction(device, action)")}
      ${node("code", "Codigo editor\\no firmware incluido")}
      ${node("fqbn", "FQBN manual\\no default por placa")}
      ${node("stream", "upload-stream?", { shape: "diamond", fill: "#fff8e8" })}
      ${node("server", "handleUploadStream()\\nreadJsonBody()")}
      ${node("target", "detectUploadTarget()\\nscore puertos COM")}
      ${node("tmp", "writeSketchTemp()\\ncrea sketch temporal\\ncopia .h")}
      ${node("compile", "arduino-cli compile\\ntimeout 900s")}
      ${node("boot", "Fase BOOT\\ninstrucciones al usuario")}
      ${node("upload", "arduino-cli upload\\npuerto detectado")}
      ${node("events", "NDJSON phase/log/done\\nfetchNdjson()")}
      ${node("uiResult", "Badge + consola firmware\\nmarkDirty()")}
      ${edge("uiAction", "code")}
      ${edge("code", "fqbn")}
      ${edge("fqbn", "stream")}
      ${edge("stream", "server", "subir")}
      ${edge("server", "target")}
      ${edge("target", "tmp")}
      ${edge("tmp", "compile")}
      ${edge("compile", "boot", "ok + upload")}
      ${edge("boot", "upload")}
      ${edge("upload", "events")}
      ${edge("events", "uiResult")}
      ${edge("compile", "events", "verify/error")}
    `)
  },
  {
    title: "8. Puente Serial Y Eventos SSE",
    intent: "Explica como server.js abre COM, reenvia texto, detecta dispositivos y mantiene clientes SSE.",
    dot: graph("serial_bridge", `
      ${node("connect", "POST /api/serial/connect\\nhandleSerialConnect()")}
      ${node("validate", "validateSerialPort()\\nCOM existe?")}
      ${node("spawn", "startSerialBridge()\\nspawn arduino-cli monitor")}
      ${node("status", "serialStatus()\\npuerto + baud + activo")}
      ${node("events", "GET /api/serial/events\\nhandleSerialEvents()")}
      ${node("clients", "serialClients Set\\nSSE abiertos")}
      ${node("rx", "stdout/stderr chunks\\nnormaliza lineas")}
      ${node("broadcast", "broadcastSerial()\\nsendSse(client,event,data)")}
      ${node("send", "POST /api/serial/send\\nwrite stdin / JSON")}
      ${node("watcher", "startPortWatcher()\\nrunPortWatcherTick()")}
      ${node("added", "port-added\\nUI muestra alerta")}
      ${node("stop", "stopSerialBridge()\\nlimpia proceso")}
      ${edge("connect", "validate")}
      ${edge("validate", "spawn")}
      ${edge("spawn", "status")}
      ${edge("events", "clients")}
      ${edge("spawn", "rx")}
      ${edge("rx", "broadcast")}
      ${edge("broadcast", "clients")}
      ${edge("send", "spawn")}
      ${edge("watcher", "added")}
      ${edge("added", "clients")}
      ${edge("stop", "status")}
    `)
  },
  {
    title: "9. ESP32-S3: Setup Y Loop Principal",
    intent: "Flujo del firmware principal que controla servos, sensores, BLE, WiFi y seguridad.",
    dot: graph("s3_loop", `
      ${node("boot", "setup()\\nSerial 115200")}
      ${node("estop", "pinMode(PIN_ESTOP)\\nINPUT_PULLUP")}
      ${node("prefs", "loadPrefs()\\nsetDefaults()\\nPreferences NVS")}
      ${node("bootMode", "applyBootBehavior()\\nmodo assisted/manual/automatic")}
      ${node("hw", "setupI2CAndHardware()\\nWire, PCA9685, MPU, AS5600")}
      ${node("ble", "setupBle()\\nGATT service/chars")}
      ${node("wifi", "connectWifi()\\nSTA o AP bateria")}
      ${node("ws", "startWebSocketServer()\\nWebSocket 81")}
      ${node("loop", "loop() cada ciclo")}
      ${node("wsLoop", "ws.loop()\\nreadSerialCommands()\\nwifiKeepalive()")}
      ${node("estopRead", "Leer boton estop\\nsetEmergency()")}
      ${node("ctrl", "cada CTRL_MS\\nreadAllSensors()\\nupdateTargetsFromSensors()\\nupdateServos()")}
      ${node("send", "cada SEND_MS\\nsendData()")}
      ${node("bleSend", "sendBleTelemetry()\\nsi BLE activo")}
      ${edge("boot", "estop")}
      ${edge("estop", "prefs")}
      ${edge("prefs", "bootMode")}
      ${edge("bootMode", "hw")}
      ${edge("hw", "ble")}
      ${edge("ble", "wifi")}
      ${edge("wifi", "ws")}
      ${edge("ws", "loop")}
      ${edge("loop", "wsLoop")}
      ${edge("wsLoop", "estopRead")}
      ${edge("estopRead", "ctrl")}
      ${edge("ctrl", "send")}
      ${edge("send", "bleSend")}
      ${edge("bleSend", "loop", "siguiente ciclo")}
    `)
  },
  {
    title: "10. ESP32-S3: Sensores, Servos Y Seguridad",
    intent: "Ruta de datos desde MPU/AS5600 hasta objetivo de servo y salida PWM segura.",
    dot: graph("s3_control", `
      ${node("readSensors", "readAllSensors()")}
      ${node("link", "SENSOR_LINKS\\nservo -> IMU/AS5600")}
      ${node("imu", "readImuDeg()\\ntcaSel() + getMotion6()\\nfiltro complementario")}
      ${node("as5600", "readAs5600Deg()\\nI2C raw angle + EMA\\nwrap 0..4095")}
      ${node("online", "sensorOnline[]\\nvalidez por servo")}
      ${node("targets", "updateTargetsFromSensors()\\nmanual/asistido/automatico")}
      ${node("deadband", "deadbandDeg\\nassistLevel\\nsmoothing")}
      ${node("limit", "clampServoDeg()\\nSRV_HARD_MIN/MAX\\nservoCfg min/max")}
      ${node("move", "moveServoTowardTarget()\\nmaxSpeedDegSec")}
      ${node("pwm", "angleToPwm()\\nservoPcaChannel()\\npca.setPWM()")}
      ${node("estop", "setEmergency(true)\\nfreeze o release PWM", { fill: "#fff0f0" })}
      ${node("telemetry", "sendData()\\nservos[], sensors[], links[]")}
      ${edge("readSensors", "link")}
      ${edge("link", "imu", "hombros")}
      ${edge("link", "as5600", "codos")}
      ${edge("imu", "online")}
      ${edge("as5600", "online")}
      ${edge("online", "targets")}
      ${edge("targets", "deadband")}
      ${edge("deadband", "limit")}
      ${edge("limit", "move")}
      ${edge("move", "pwm")}
      ${edge("estop", "pwm", "bloquea salida")}
      ${edge("pwm", "telemetry")}
    `)
  },
  {
    title: "11. ESP32-S3: Comandos JSON Y BLE",
    intent: "Unifica entradas por WebSocket, serial y BLE hacia processCmd/processBleBinaryCommand.",
    dot: graph("s3_commands", `
      ${node("wsEvent", "wsEvent()\\nWStype_TEXT")}
      ${node("serial", "readSerialCommands()\\nlinea JSON")}
      ${node("bleJson", "processBleCommand()\\nJSON si inicia con {")}
      ${node("bleBin", "processBleBinaryCommand()\\nVC v1 8 bytes")}
      ${node("cmd", "processCmd(json, client)")}
      ${node("status", "cmd_status\\nsendData()/sendAck()")}
      ${node("mode", "cmd_mode\\nmanual/assisted/automatic")}
      ${node("angle", "cmd_angle\\ntargetDeg[id]")}
      ${node("cal", "cmd_calibration_*\\napplyCalibrationProfile()\\nsavePrefs()")}
      ${node("safety", "cmd_stop/cmd_reset\\nsetEmergency()")}
      ${node("home", "cmd_home\\nhomeDeg por servo")}
      ${node("bleOut", "sendBleTelemetry()\\nnotify compacta")}
      ${edge("wsEvent", "cmd")}
      ${edge("serial", "cmd")}
      ${edge("bleJson", "cmd")}
      ${edge("bleBin", "angle", "type 1")}
      ${edge("bleBin", "mode", "type 2")}
      ${edge("bleBin", "safety", "type 3/4")}
      ${edge("bleBin", "home", "type 5")}
      ${edge("bleBin", "status", "type 6")}
      ${edge("cmd", "status")}
      ${edge("cmd", "mode")}
      ${edge("cmd", "angle")}
      ${edge("cmd", "cal")}
      ${edge("cmd", "safety")}
      ${edge("cmd", "home")}
      ${edge("status", "bleOut")}
      ${edge("angle", "bleOut")}
      ${edge("mode", "bleOut")}
    `)
  },
  {
    title: "12. ESP32-CAM: Setup, Video, Audio Y Puente Al S3",
    intent: "Flujo del firmware de camara y su papel como asistente de vision/audio.",
    dot: graph("cam_loop", `
      ${node("setup", "setup()\\nSerial + power profile")}
      ${node("wifi", "connectWifi()\\nSTA o fallback AP")}
      ${node("camera", "setupCamera()\\nOV2640 + frame settings")}
      ${node("mic", "setupMic()\\nI2S si habilitado")}
      ${node("http", "setupHttp()\\n/ /status /capture /stream")}
      ${node("appWs", "appWs.begin()\\nAPP_WS_PORT 82")}
      ${node("s3Ws", "s3Ws.begin(S3_HOST,81)\\nheartbeat/reconnect")}
      ${node("loop", "loop()")}
      ${node("clients", "http.handleClient()\\nappWs.loop()\\ns3Ws.loop()")}
      ${node("serial", "readSerialCommands()\\ncmd_status / usb_stream_start")}
      ${node("usb", "writeUsbSerialFrame()\\nVESTA_USB_MJPEG_BEGIN\\nJPEG por serial")}
      ${node("mjpeg", "handleStream()\\nHTTP multipart MJPEG")}
      ${node("audio", "readAndStreamAudio()\\nPCM16 mono WebSocket")}
      ${node("status", "sendStatus()\\nCAM -> app y S3")}
      ${edge("setup", "wifi")}
      ${edge("wifi", "camera")}
      ${edge("camera", "mic")}
      ${edge("mic", "http")}
      ${edge("http", "appWs")}
      ${edge("appWs", "s3Ws")}
      ${edge("s3Ws", "loop")}
      ${edge("loop", "clients")}
      ${edge("clients", "serial")}
      ${edge("serial", "usb", "usb_stream_start")}
      ${edge("clients", "mjpeg", "/stream")}
      ${edge("clients", "audio")}
      ${edge("audio", "status")}
      ${edge("usb", "status")}
      ${edge("status", "loop", "cada 1s")}
    `)
  },
  {
    title: "13. Flujo De Video En Banco: USB MJPEG Y Fallback HTTP",
    intent: "Muestra como la consola recibe video sin cambiar el WiFi del equipo tecnico.",
    dot: graph("video_flow", `
      ${node("ui", "Usuario: Conectar CAM COM\\nconnectCamManualCom()")}
      ${node("discover", "POST /api/cam/discover\\nreadCamDiscoverySerial()")}
      ${node("url", "localCamUsbStreamUrl()\\n/api/cam/usb-stream?...")}
      ${node("pump", "startCamera()\\nopenCameraStream()")}
      ${node("server", "handleCamUsbStream()\\nabre proceso serial")}
      ${node("cmd", "usb_stream_start\\ncambia baud a 230400")}
      ${node("cam", "ESP32-CAM\\nwriteUsbSerialFrame()")}
      ${node("frames", "JPEG serial\\nboundary local MJPEG")}
      ${node("extract", "pumpCameraMjpeg()\\nextractJpegFrame()")}
      ${node("img", "renderCameraFrame()\\nobjectURL en <img>")}
      ${node("fallback", "HTTP fallback\\nhttp://<ip>/stream")}
      ${node("recover", "recoverCamStreamAfterImageError()\\nreintentos y proxy")}
      ${edge("ui", "discover")}
      ${edge("discover", "url")}
      ${edge("url", "pump")}
      ${edge("pump", "server")}
      ${edge("server", "cmd")}
      ${edge("cmd", "cam")}
      ${edge("cam", "frames")}
      ${edge("frames", "extract")}
      ${edge("extract", "img")}
      ${edge("pump", "fallback", "si USB falla")}
      ${edge("fallback", "recover")}
      ${edge("recover", "img")}
    `)
  },
  {
    title: "14. Perfil De Calibracion Y Persistencia",
    intent: "Cubre como se construye, guarda, descarga y envia el perfil tecnico.",
    dot: graph("profile", `
      ${node("defaults", "SERVO_DEFAULTS\\nIMU_DEFAULTS\\nAS5600_DEFAULTS")}
      ${node("state", "state.profile + state.tuning\\nlocalStorage STORAGE_KEY")}
      ${node("inputs", "onServoInput()\\nonImuInput()\\nonAs5600Input()\\nupdateTuningFromControls()")}
      ${node("dirty", "markDirty()\\nsaveLocal()")}
      ${node("profileServos", "profileServos()\\nmin/max/home/dir/PWM/offset")}
      ${node("profileImus", "profileImus()\\nneutral/min/max/invert")}
      ${node("profileAs5600", "profileAs5600()\\nraw0/raw90/neutral/invert")}
      ${node("build", "buildProfile()\\nschema + metadata + readiness")}
      ${node("preview", "updateProfilePreview()\\nJSON pretty")}
      ${node("download", "downloadProfile()\\narchivo JSON")}
      ${node("send", "sendFullProfile()\\ncmd_calibration_profile")}
      ${node("nvs", "ESP32-S3 savePrefs()\\nPreferences NVS")}
      ${edge("defaults", "state")}
      ${edge("state", "inputs")}
      ${edge("inputs", "dirty")}
      ${edge("dirty", "profileServos")}
      ${edge("dirty", "profileImus")}
      ${edge("dirty", "profileAs5600")}
      ${edge("profileServos", "build")}
      ${edge("profileImus", "build")}
      ${edge("profileAs5600", "build")}
      ${edge("build", "preview")}
      ${edge("build", "download")}
      ${edge("build", "send")}
      ${edge("send", "nvs")}
    `)
  },
  {
    title: "15. Readiness, Pruebas Y Seguridad Operativa",
    intent: "Relaciona pruebas automaticas, telemetria, paro de emergencia y habilitacion de entrega.",
    dot: graph("readiness", `
      ${node("tests", "runAllTests()\\nTEST_DEFS")}
      ${node("packet", "awaitPacket()\\ntelemetria reciente")}
      ${node("link", "Prueba enlace S3\\ncmd_status")}
      ${node("mode", "Prueba modos\\nmanual/assisted/automatic")}
      ${node("servo", "Prueba sweep servo\\ncmd_angle + lectura")}
      ${node("sensor", "Prueba sensores\\nIMU/AS5600 online")}
      ${node("estop", "Prueba emergencia\\ncmd_stop/cmd_reset", { fill: "#fff0f0" })}
      ${node("summary", "updateTestSummary()\\nsetTestState()")}
      ${node("readiness", "renderReadiness()\\nchecks por fase")}
      ${node("gate", "Enviar perfil habilitado?", { shape: "diamond", fill: "#fff8e8" })}
      ${node("deliver", "sendFullProfile()\\nperfil al S3", { fill: "#ebfff4" })}
      ${node("hold", "Bloqueo visual\\npendientes o fallas", { fill: "#fff0f0" })}
      ${edge("tests", "packet")}
      ${edge("packet", "link")}
      ${edge("packet", "mode")}
      ${edge("packet", "servo")}
      ${edge("packet", "sensor")}
      ${edge("packet", "estop")}
      ${edge("link", "summary")}
      ${edge("mode", "summary")}
      ${edge("servo", "summary")}
      ${edge("sensor", "summary")}
      ${edge("estop", "summary")}
      ${edge("summary", "readiness")}
      ${edge("readiness", "gate")}
      ${edge("gate", "deliver", "todo verde")}
      ${edge("gate", "hold", "pendiente/falla")}
    `)
  }
];

const matrices = [
  {
    title: "Mapa De Archivos Y Responsabilidad",
    rows: [
      ["Login", "Validacion local, bloqueo de intentos y sesion", "index.html, login.js, login.css, credentials.js"],
      ["Consola tecnica", "UI de armado, diagnostico, firmware, servos, sensores, pruebas y entrega", "technical_V.E.S.T.A..html, app.js, styles.css"],
      ["Servidor local", "API HTTP, carga de firmware, serial bridge, proxy CAM y archivos estaticos", "server.js"],
      ["Firmware S3", "Control en tiempo real de sensores, servos, BLE, WebSocket y seguridad", "esp32_s3_controller.ino, esp32_s3_config.h"],
      ["Firmware CAM", "Video MJPEG, USB MJPEG, audio I2S, estado y puente hacia S3", "esp32_cam_assistant.ino, esp32_cam_config.h"],
      ["Documentacion", "Uso, firmware, protocolos y contexto tecnico", "README.md, FIRMWARE.md"]
    ]
  },
  {
    title: "Entradas Y Salidas Principales",
    rows: [
      ["Usuario tecnico", "Cambia paneles, calibra, prueba, sube firmware y envia perfil", "app.js"],
      ["Navegador", "WebSocket, fetch JSON, NDJSON, SSE, localStorage y canvas", "app.js"],
      ["Servidor Node", "Responde API, ejecuta arduino-cli y abre puentes seriales", "server.js"],
      ["ESP32-S3", "Recibe cmd_*, publica telemetria, mueve servos y guarda preferencias", "esp32_s3_controller.ino"],
      ["ESP32-CAM", "Entrega video/audio/estado por HTTP, WS o serial USB", "esp32_cam_assistant.ino"],
      ["Hardware fisico", "MPU6050, AS5600, PCA9685, servos, boton de emergencia y red WiFi/BLE", "*.h, *.ino"]
    ]
  },
  {
    title: "Comandos JSON Relevantes",
    rows: [
      ["cmd_status", "Solicita estado completo, IP, URLs, modo y telemetria", "app.js -> esp32_s3_controller.ino"],
      ["cmd_mode", "Cambia manual/assisted/automatic si no hay emergencia", "app.js -> processCmd()"],
      ["cmd_angle", "Define targetDeg[id] para control manual o prueba", "sendAngle() -> processCmd()"],
      ["cmd_assist", "Ajusta asistencia 0..1 y persiste preferencia", "sendMapProfile() -> savePrefs()"],
      ["cmd_calibration_profile", "Entrega perfil completo de servos, IMU, AS5600 y tuning", "buildProfile() -> applyCalibrationProfile()"],
      ["cmd_stop / cmd_reset / cmd_home", "Seguridad, reset seguro y retorno a home", "sendCommand() -> setEmergency()/writeServo()"]
    ]
  }
];

// Funcion       | renderSvg: renderiza DOT a SVG usando viz.js.
async function renderSvg(viz, dot) {
  const svg = viz.renderString(dot, { format: "svg", engine: "dot" });
  return svg
    .replace(/<\?xml[^>]*>/g, "")
    .replace(/<!DOCTYPE[^>]*>/g, "")
    .replace(/<title>.*?<\/title>/gs, "");
}

// Funcion       | renderMatrix: transforma matrices tecnicas en tablas HTML.
function renderMatrix(matrix) {
  return `
    <section class="page matrix-page">
      <h2>${escHtml(matrix.title)}</h2>
      ${legendRows(matrix.rows)}
    </section>`;
}

// Funcion       | buildHtml: compone el documento HTML completo con diagramas y matrices.
async function buildHtml() {
  const viz = await vizJs.instance();
  const rendered = [];
  for (const item of diagrams) {
    rendered.push({
      ...item,
      svg: await renderSvg(viz, item.dot)
    });
  }

  const generatedAt = new Date().toLocaleString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>V.E.S.T.A - Diagrama de flujo del codigo</title>
  <style>
    @page { size: A4 landscape; margin: 0; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #f4f7fb;
      color: #071421;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      line-height: 1.35;
    }
    .page {
      width: 297mm;
      height: 210mm;
      min-height: 0;
      page-break-after: always;
      padding: 10mm;
      background: #ffffff;
      border: 0;
      border-radius: 0;
      box-shadow: none;
      overflow: hidden;
    }
    .cover {
      display: grid;
      grid-template-columns: 1.1fr .9fr;
      gap: 18px;
      align-items: center;
      background: linear-gradient(135deg, #061424 0%, #0b5ea8 58%, #f8fbff 58%, #fff 100%);
      color: #fff;
    }
    .cover-card {
      background: rgba(255,255,255,.95);
      color: #071421;
      border: 1px solid rgba(255,255,255,.8);
      border-radius: 8px;
      padding: 18px;
    }
    h1 { margin: 0 0 12px; font-size: 30px; line-height: 1.05; }
    h2 { margin: 0 0 8px; font-size: 18px; color: #073a67; }
    h3 { margin: 10px 0 5px; font-size: 13px; color: #0b5ea8; }
    p { margin: 0 0 8px; }
    code { font-family: Consolas, "Courier New", monospace; font-size: 10px; color: #06345b; }
    .subtitle { font-size: 14px; max-width: 560px; color: #d8ecff; }
    .meta { margin-top: 20px; display: grid; gap: 5px; color: #eaf4ff; }
    .badge-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
    .badge {
      display: inline-block;
      border: 1px solid rgba(255,255,255,.42);
      border-radius: 999px;
      padding: 4px 8px;
      background: rgba(255,255,255,.13);
      font-size: 10px;
    }
    .note {
      border-left: 4px solid #0b5ea8;
      background: #eef7ff;
      padding: 8px 10px;
      border-radius: 6px;
      margin: 8px 0 10px;
    }
    .diagram {
      height: 152mm;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #e1e9f2;
      border-radius: 8px;
      background: #fbfdff;
      padding: 6px;
    }
    .diagram svg {
      max-width: 100%;
      max-height: 100%;
      height: auto;
    }
    .matrix {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      table-layout: fixed;
    }
    .matrix th,
    .matrix td {
      border: 1px solid #d9e5ef;
      padding: 7px 8px;
      vertical-align: top;
      text-align: left;
      overflow-wrap: anywhere;
    }
    .matrix th {
      background: #0b5ea8;
      color: #fff;
      font-size: 11px;
    }
    .matrix td:first-child { width: 22%; font-weight: 700; color: #073a67; }
    .matrix td:nth-child(2) { width: 43%; }
    .toc {
      columns: 2;
      column-gap: 22px;
      margin: 10px 0 0;
      padding-left: 16px;
      color: #071421;
    }
    .toc li { break-inside: avoid; margin-bottom: 5px; }
    .legend-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin-top: 12px;
    }
    .legend-box {
      border: 1px solid #dbe5ee;
      border-radius: 8px;
      padding: 10px;
      background: #fbfdff;
    }
    .footer {
      margin-top: 7px;
      color: #5c6f82;
      font-size: 9px;
      text-align: right;
    }
  </style>
</head>
<body>
  <section class="page cover">
    <div>
      <h1>Diagrama De Flujo Del Codigo<br>technical_V.E.S.T.A</h1>
      <p class="subtitle">Mapa completo del flujo entre UI web, servidor local, firmware ESP32-S3, firmware ESP32-CAM, serial, WebSocket, BLE, video y perfil de calibracion.</p>
      <div class="badge-row">
        <span class="badge">app.js</span>
        <span class="badge">server.js</span>
        <span class="badge">login.js</span>
        <span class="badge">ESP32-S3</span>
        <span class="badge">ESP32-CAM</span>
        <span class="badge">WebSocket / Serial / BLE</span>
      </div>
      <div class="meta">
        <span>Proyecto: C:\\VSC\\technical_V.E.S.T.A</span>
        <span>Generado: ${escHtml(generatedAt)}</span>
        <span>Formato: A4 horizontal, diagramas Graphviz renderizados localmente.</span>
      </div>
    </div>
    <div class="cover-card">
      <h2>Contenido</h2>
      <ol class="toc">
        ${diagrams.map((item) => `<li>${escHtml(item.title.replace(/^\\d+\\.\\s*/, ""))}</li>`).join("")}
        ${matrices.map((item) => `<li>${escHtml(item.title)}</li>`).join("")}
      </ol>
      <div class="legend-grid">
        <div class="legend-box"><h3>Lectura rapida</h3><p>Cada pagina tiene un objetivo y un grafo con nodos principales, decisiones y rutas de datos.</p></div>
        <div class="legend-box"><h3>Colores</h3><p>Azul: UI. Naranja: herramientas/servidor. Verde: hardware/estado OK. Rojo: seguridad o fallas.</p></div>
      </div>
    </div>
  </section>

  ${matrices.map(renderMatrix).join("")}

  ${rendered.map((item) => `
  <section class="page">
    <h2>${escHtml(item.title)}</h2>
    <div class="note">${escHtml(item.intent)}</div>
    <div class="diagram">${item.svg}</div>
    <div class="footer">technical_V.E.S.T.A - ${escHtml(item.title)}</div>
  </section>`).join("")}
</body>
</html>`;
}

// Funcion       | main: genera el HTML y exporta el PDF con navegador headless.
async function main() {
  fs.mkdirSync(docsDir, { recursive: true });
  const html = await buildHtml();
  fs.writeFileSync(htmlPath, html, "utf8");

  const executablePath = chromeCandidates.find((candidate) => fs.existsSync(candidate));
  if (!executablePath) {
    throw new Error("No se encontro Chrome o Edge para renderizar el PDF.");
  }

  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
    await page.goto(`file://${htmlPath.replace(/\\/g, "/")}`, { waitUntil: "load" });
    await page.pdf({
      path: pdfPath,
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" }
    });
  } finally {
    await browser.close();
  }

  console.log(pdfPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
