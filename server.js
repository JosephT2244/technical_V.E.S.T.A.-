"use strict";

const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { URL } = require("url");

const root = __dirname;
const firstPort = Number(process.argv[2]) || 5177;

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ino": "text/plain; charset=utf-8",
  ".h": "text/plain; charset=utf-8",
  ".cpp": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon"
};

function resolveArduinoCli() {
  const candidates = [
    process.env.ARDUINO_CLI,
    path.join(root, "arduino-cli.exe"),
    path.join(root, "arduino-cli"),
    "arduino-cli"
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate === "arduino-cli") return candidate;
    if (fs.existsSync(candidate)) return candidate;
  }
  return "arduino-cli";
}

const arduinoCli = resolveArduinoCli();
const bundledFirmware = {
  s3: {
    sketchName: "esp32_s3_controller",
    ino: path.join(root, "esp32_s3_controller.ino"),
    extraFiles: [path.join(root, "esp32_s3_config.h")]
  },
  cam: {
    sketchName: "esp32_cam_assistant",
    ino: path.join(root, "esp32_cam_assistant.ino"),
    extraFiles: [path.join(root, "esp32_cam_config.h")]
  }
};

function run(file, args, options = {}) {
  return new Promise((resolve) => {
    execFile(file, args, { cwd: root, windowsHide: true, timeout: 120000, ...options }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        code: error?.code ?? 0,
        output: [stdout, stderr].filter(Boolean).join("\n").trim(),
        error: error?.message || ""
      });
    });
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(data));
}

function readJsonBody(req, limit = 3_000_000) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > limit) {
        reject(new Error("Payload demasiado grande"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("JSON invalido"));
      }
    });
    req.on("error", reject);
  });
}

function parseBoardList(stdout) {
  try {
    const data = JSON.parse(stdout);
    const rawPorts = Array.isArray(data)
      ? data
      : Array.isArray(data.detected_ports)
        ? data.detected_ports
        : Array.isArray(data.ports)
          ? data.ports
          : [];

    return rawPorts.map((entry) => {
      const portInfo = entry.port || entry;
      const boards = Array.isArray(entry.matching_boards)
        ? entry.matching_boards
        : Array.isArray(entry.boards)
          ? entry.boards
          : [];
      const board = boards[0] || {};
      const port = {
        address: portInfo.address || entry.address || portInfo.name || "",
        board: board.fqbn || "",
        name: board.name || "",
        label: portInfo.protocol_label || portInfo.protocol || entry.protocol || "Serial"
      };
      port.guess = guessDevice(port);
      return port;
    }).filter((item) => item.address);
  } catch {
    return [];
  }
}

function guessDevice(port) {
  const haystack = [
    port.address,
    port.board,
    port.name,
    port.label,
    port.pnpId
  ].filter(Boolean).join(" ").toLowerCase();

  if (haystack.includes("esp32-s3") || haystack.includes("usb jtag") || haystack.includes("jtag/serial")) {
    return "s3";
  }
  if (haystack.includes("esp32-cam") || haystack.includes("cp210") || haystack.includes("ch340") || haystack.includes("wch")) {
    return "cam";
  }
  if (haystack.includes("silicon labs") || haystack.includes("usb serial")) {
    return "esp32";
  }
  return "";
}

async function systemSerialPorts() {
  if (process.platform !== "win32") return [];
  const script = `
$ports = [System.IO.Ports.SerialPort]::GetPortNames() | Sort-Object
$entities = Get-CimInstance Win32_PnPEntity | Where-Object { $_.Name -match '\\(COM\\d+\\)' }
$out = foreach ($p in $ports) {
  $match = $entities | Where-Object { $_.Name -match "\\($p\\)" } | Select-Object -First 1
  [PSCustomObject]@{
    address = $p
    board = ""
    name = if ($match) { $match.Name } else { "" }
    label = if ($match) { $match.Name } else { "Serial" }
    pnpId = if ($match) { $match.PNPDeviceID } else { "" }
  }
}
$out | ConvertTo-Json -Compress
`;
  const result = await run("powershell", ["-NoProfile", "-Command", script], { timeout: 8000 });
  if (!result.ok || !result.output) return [];
  try {
    const parsed = JSON.parse(result.output);
    return (Array.isArray(parsed) ? parsed : [parsed]).filter(Boolean).map((port) => {
      const normalized = {
        address: port.address || "",
        board: port.board || "",
        name: port.name || "",
        label: port.label || "Serial",
        pnpId: port.pnpId || ""
      };
      normalized.guess = guessDevice(normalized);
      return normalized;
    }).filter((port) => port.address);
  } catch {
    return [];
  }
}

async function listPorts() {
  const result = await run(arduinoCli, ["board", "list", "--json"], { timeout: 12000 });
  const cliPorts = result.ok ? parseBoardList(result.output) : [];
  const fallbackPorts = await systemSerialPorts();
  const merged = [...cliPorts];
  fallbackPorts.forEach((port) => {
    const existing = merged.find((item) => item.address === port.address);
    if (!existing) {
      merged.push(port);
      return;
    }
    ["board", "name", "label", "pnpId"].forEach((key) => {
      if (!existing[key] && port[key]) existing[key] = port[key];
    });
    existing.guess = guessDevice(existing) || existing.guess || port.guess || "";
  });
  return { ok: result.ok || merged.length > 0, ports: merged, output: result.output || result.error };
}

function writeSketchTemp(device, code) {
  const safeDevice = /^[a-z0-9_-]+$/i.test(device) ? device : "s3";
  const bundled = bundledFirmware[safeDevice] || bundledFirmware.s3;
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), `vesta-${safeDevice}-`));
  const sketchName = bundled.sketchName;
  const sketchDir = path.join(parent, sketchName);
  const buildDir = path.join(parent, "build");
  fs.mkdirSync(sketchDir, { recursive: true });
  fs.mkdirSync(buildDir, { recursive: true });
  const inoPath = path.join(sketchDir, `${sketchName}.ino`);
  if (code.trim()) {
    fs.writeFileSync(inoPath, code, "utf8");
  } else {
    fs.copyFileSync(bundled.ino, inoPath);
  }
  bundled.extraFiles.forEach((file) => {
    fs.copyFileSync(file, path.join(sketchDir, path.basename(file)));
  });
  return { parent, sketchDir, buildDir, inoPath };
}

async function handleUpload(req, res) {
  try {
    const body = await readJsonBody(req);
    const device = String(body.device || "esp32");
    const action = body.action === "upload" ? "upload" : "verify";
    const fqbn = String(body.fqbn || "").trim();
    const port = String(body.port || "").trim();
    const code = String(body.code || "");

    if (!fqbn) return sendJson(res, 400, { ok: false, output: "FQBN requerido" });
    if (!code.trim() && !bundledFirmware[device]) return sendJson(res, 400, { ok: false, output: "Codigo requerido" });
    if (action === "upload" && !port) return sendJson(res, 400, { ok: false, output: "Puerto requerido" });

    const tmp = writeSketchTemp(device, code);
    const compile = await run(arduinoCli, ["compile", "--fqbn", fqbn, "--build-path", tmp.buildDir, tmp.sketchDir], { timeout: 180000 });
    let output = [`$ arduino-cli compile --fqbn ${fqbn}`, compile.output || compile.error].filter(Boolean).join("\n");

    if (!compile.ok || action === "verify") {
      return sendJson(res, compile.ok ? 200 : 500, { ok: compile.ok, output });
    }

    const upload = await run(arduinoCli, ["upload", "-p", port, "--fqbn", fqbn, "--input-dir", tmp.buildDir, tmp.sketchDir], { timeout: 180000 });
    output += `\n\n$ arduino-cli upload -p ${port} --fqbn ${fqbn}\n${upload.output || upload.error}`;
    return sendJson(res, upload.ok ? 200 : 500, { ok: upload.ok, output });
  } catch (error) {
    return sendJson(res, 500, { ok: false, output: error.message });
  }
}

async function apiHandler(req, res, parsed) {
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
    const result = await listPorts();
    return sendJson(res, 200, result);
  }

  if (req.method === "POST" && parsed.pathname === "/api/arduino/upload") {
    return handleUpload(req, res);
  }

  return sendJson(res, 404, { ok: false, output: "Endpoint no encontrado" });
}

function safePath(requestUrl) {
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

function handler(req, res) {
  const parsed = new URL(req.url, "http://localhost");
  if (parsed.pathname.startsWith("/api/")) {
    apiHandler(req, res, parsed);
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

function start(port) {
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
    console.log(`V.E.S.T.A Tecnico listo en http://127.0.0.1:${port}`);
    console.log("Ctrl+C para detener.");
  });
}

start(firstPort);
