/* Archivo        | esp32_cam_assistant.ino: firmware de video, estado y control HTTP de la ESP32-CAM. */
/*
  V.E.S.T.A. ESP32-CAM realtime firmware

  Based on the tested OV2640 realtime sketch.
  Kept intentionally light:
    - MJPEG stream on port 81.
    - Technician/status routes on port 80.
    - Serial cam_status packets for V.E.S.T.A. discovery.
    - No microphone, no WebSocket bridge, no USB MJPEG proxy load.
*/

#include "esp32_cam_config.h"
#include "esp_camera.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include <Arduino.h>
#include <WebServer.h>
#include <WiFi.h>

WebServer http(HTTP_PORT);
WiFiServer streamServer(CAM_STREAM_PORT);
SemaphoreHandle_t cameraMutex = NULL;

static const char STREAM_BOUNDARY[] = "esp32cam";

bool cameraReady = false;
bool flashOn = false;
bool wifiInAp = false;
volatile uint8_t activePreset = CAM_DEFAULT_PRESET;

uint32_t framesSent = 0;
uint32_t frameFailCount = 0;
uint32_t recoverCount = 0;
uint32_t lastFrameMs = 0;
uint32_t lastFrameBytes = 0;
uint32_t lastStatusMs = 0;
uint16_t lastFps = 0;
uint8_t consecutiveFrameFails = 0;

// Funcion       | jsonEscape: escapa caracteres especiales antes de armar JSON.
String jsonEscape(const String &value)
{
  String out;
  out.reserve(value.length() + 8);
  for (size_t i = 0; i < value.length(); i++) {
    char c = value[i];
    switch (c) {
      case '\\': out += "\\\\"; break;
      case '"': out += "\\\""; break;
      case '\n': out += "\\n"; break;
      case '\r': out += "\\r"; break;
      case '\t': out += "\\t"; break;
      default: out += c; break;
    }
  }
  return out;
}

// Funcion       | hasWifiCredentials: verifica si hay credenciales WiFi reales configuradas.
bool hasWifiCredentials()
{
  return strcmp(WIFI_SSID, "TU_RED_WIFI") != 0 &&
    strcmp(WIFI_PASSWORD, "TU_CONTRASENA") != 0 &&
    strlen(WIFI_SSID) > 0;
}

// Funcion       | camIp: resuelve la IP activa de la camara en STA o AP.
String camIp()
{
  if (WiFi.status() == WL_CONNECTED) return WiFi.localIP().toString();
  IPAddress apIp = WiFi.softAPIP();
  if (apIp != IPAddress(0, 0, 0, 0)) return apIp.toString();
  return "";
}

// Funcion       | httpBase: arma la base HTTP para rutas de estado y captura.
String httpBase()
{
  String ip = camIp();
  if (!ip.length()) return "";
  String url = "http://" + ip;
  if (HTTP_PORT != 80) url += ":" + String(HTTP_PORT);
  return url;
}

// Funcion       | streamBase: arma la base del servidor MJPEG.
String streamBase()
{
  String ip = camIp();
  if (!ip.length()) return "";
  return "http://" + ip + ":" + String(CAM_STREAM_PORT);
}

// Funcion       | streamUrl: devuelve la URL directa del stream de video.
String streamUrl()
{
  String base = streamBase();
  return base.length() ? base + "/stream" : "";
}

// Funcion       | statusUrl: devuelve la URL de estado publicada por la camara.
String statusUrl()
{
  String base = streamBase();
  return base.length() ? base + "/status" : "";
}

// Funcion       | captureUrl: devuelve la URL de captura fija.
String captureUrl()
{
  String base = streamBase();
  return base.length() ? base + "/capture" : "";
}

// Funcion       | currentPreset: selecciona el perfil activo de resolucion y calidad.
const VestaCamPreset &currentPreset()
{
  uint8_t index = activePreset;
  if (index > CAM_PRESET_QUALITY) index = CAM_PRESET_BALANCED;
  return CAM_PRESETS[index];
}

// Funcion       | statusJson: serializa estado de red, stream y camara en JSON.
String statusJson()
{
  const VestaCamPreset &preset = currentPreset();
  String ip = camIp();
  String body;
  body.reserve(640);
  body += "{";
  body += "\"type\":\"cam_status\",";
  body += "\"role\":\"camera\",";
  body += "\"fw\":\"VESTA-CAM-RT-2.0\",";
  body += "\"cameraReady\":";
  body += cameraReady ? "true" : "false";
  body += ",\"wifiMode\":\"";
  body += wifiInAp ? "ap" : "sta";
  body += "\",\"ip\":\"";
  body += jsonEscape(ip);
  body += "\",\"apSsid\":\"";
  body += wifiInAp ? jsonEscape(CAM_AP_SSID) : "";
  body += "\",\"httpPort\":";
  body += HTTP_PORT;
  body += ",\"streamPort\":";
  body += CAM_STREAM_PORT;
  body += ",\"stream\":\"";
  body += jsonEscape(streamUrl());
  body += "\",\"capture\":\"";
  body += jsonEscape(captureUrl());
  body += "\",\"statusUrl\":\"";
  body += jsonEscape(statusUrl());
  body += "\",\"activeMode\":\"";
  body += preset.id;
  body += "\",\"activeModeLabel\":\"";
  body += preset.label;
  body += "\",\"frameIntervalMs\":";
  body += preset.frameIntervalMs;
  body += ",\"jpegQuality\":";
  body += preset.jpegQuality;
  body += ",\"frames\":";
  body += framesSent;
  body += ",\"fps\":";
  body += lastFps;
  body += ",\"flashOn\":";
  body += flashOn ? "true" : "false";
  body += ",\"lastFrameBytes\":";
  body += lastFrameBytes;
  body += ",\"lastFrameAgeMs\":";
  body += lastFrameMs ? (millis() - lastFrameMs) : 0;
  body += ",\"frameFails\":";
  body += frameFailCount;
  body += ",\"recoveries\":";
  body += recoverCount;
  body += ",\"rssi\":";
  body += (WiFi.status() == WL_CONNECTED) ? WiFi.RSSI() : 0;
  body += ",\"heapFree\":";
  body += ESP.getFreeHeap();
  body += ",\"psram\":";
  body += psramFound() ? "true" : "false";
  body += ",\"usbVideo\":false";
  body += "}";
  return body;
}

// Funcion       | printStatusToSerial: publica telemetria compacta por puerto serial.
void printStatusToSerial()
{
  Serial.println(statusJson());
}

// Funcion       | sendCors: agrega cabeceras CORS a respuestas HTTP.
void sendCors()
{
  http.sendHeader("Access-Control-Allow-Origin", "*");
  http.sendHeader("Cache-Control", "no-store");
}

// Funcion       | setupCamera: configura pines, buffer y sensor OV2640.
bool setupCamera()
{
  const VestaCamPreset &preset = currentPreset();

  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = CAM_PIN_D0;
  config.pin_d1 = CAM_PIN_D1;
  config.pin_d2 = CAM_PIN_D2;
  config.pin_d3 = CAM_PIN_D3;
  config.pin_d4 = CAM_PIN_D4;
  config.pin_d5 = CAM_PIN_D5;
  config.pin_d6 = CAM_PIN_D6;
  config.pin_d7 = CAM_PIN_D7;
  config.pin_xclk = CAM_PIN_XCLK;
  config.pin_pclk = CAM_PIN_PCLK;
  config.pin_vsync = CAM_PIN_VSYNC;
  config.pin_href = CAM_PIN_HREF;
  config.pin_sccb_sda = CAM_PIN_SIOD;
  config.pin_sccb_scl = CAM_PIN_SIOC;
  config.pin_pwdn = CAM_PIN_PWDN;
  config.pin_reset = CAM_PIN_RESET;
  config.xclk_freq_hz = CAM_XCLK_FREQ_HZ;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size = preset.frameSize;
  config.jpeg_quality = preset.jpegQuality;
  config.fb_count = psramFound() ? 2 : 1;
  config.fb_location = psramFound() ? CAMERA_FB_IN_PSRAM : CAMERA_FB_IN_DRAM;
  config.grab_mode = psramFound() ? CAMERA_GRAB_LATEST : CAMERA_GRAB_WHEN_EMPTY;

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[CAM] init failed: 0x%x\n", err);
    return false;
  }

  sensor_t *sensor = esp_camera_sensor_get();
  sensor->set_framesize(sensor, preset.frameSize);
  sensor->set_quality(sensor, preset.jpegQuality);
  sensor->set_brightness(sensor, 0);
  sensor->set_contrast(sensor, 0);
  sensor->set_saturation(sensor, 0);

  consecutiveFrameFails = 0;
  Serial.print("[CAM] ready mode=");
  Serial.print(preset.id);
  Serial.print(" stream=");
  Serial.println(streamUrl());
  return true;
}

// Funcion       | recoverCamera: reinicia la camara tras fallos consecutivos de frames.
bool recoverCamera()
{
  if (cameraMutex && xSemaphoreTake(cameraMutex, pdMS_TO_TICKS(1500)) != pdTRUE) {
    return false;
  }

  cameraReady = false;
  recoverCount++;
  esp_camera_deinit();
  delay(120);
  cameraReady = setupCamera();

  if (cameraMutex) xSemaphoreGive(cameraMutex);
  return cameraReady;
}

// Funcion       | applyPreset: cambia resolucion, calidad y temporizacion del stream.
bool applyPreset(uint8_t presetIndex)
{
  if (presetIndex > CAM_PRESET_QUALITY) return false;
  if (cameraMutex && xSemaphoreTake(cameraMutex, pdMS_TO_TICKS(1500)) != pdTRUE) {
    return false;
  }

  activePreset = presetIndex;
  const VestaCamPreset &preset = currentPreset();
  sensor_t *sensor = esp_camera_sensor_get();
  if (sensor) {
    sensor->set_framesize(sensor, preset.frameSize);
    sensor->set_quality(sensor, preset.jpegQuality);
  }

  if (cameraMutex) xSemaphoreGive(cameraMutex);

  Serial.print("[CAM] mode ");
  Serial.print(preset.id);
  Serial.print(" interval=");
  Serial.print(preset.frameIntervalMs);
  Serial.print("ms quality=");
  Serial.println(preset.jpegQuality);
  return true;
}

camera_fb_t *takeFrame()
{
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    frameFailCount++;
    if (consecutiveFrameFails < 255) consecutiveFrameFails++;
    if (consecutiveFrameFails >= CAM_FRAME_FAIL_RECOVERIES) {
      consecutiveFrameFails = 0;
      recoverCamera();
    }
    return NULL;
  }

  consecutiveFrameFails = 0;
  framesSent++;
  lastFrameBytes = fb->len;
  lastFrameMs = millis();
  return fb;
}

// Funcion       | sendCaptureToClient: captura un frame JPEG y lo escribe al cliente.
void sendCaptureToClient(WiFiClient &client)
{
  if (!cameraReady) {
    client.print("HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\nCamera not ready");
    return;
  }

  if (xSemaphoreTake(cameraMutex, pdMS_TO_TICKS(1200)) != pdTRUE) {
    client.print("HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\nCamera busy");
    return;
  }

  camera_fb_t *fb = takeFrame();
  if (!fb) {
    xSemaphoreGive(cameraMutex);
    client.print("HTTP/1.1 500 Internal Server Error\r\nConnection: close\r\n\r\nCapture failed");
    return;
  }

  client.print("HTTP/1.1 200 OK\r\n");
  client.print("Content-Type: image/jpeg\r\n");
  client.print("Cache-Control: no-store\r\n");
  client.print("Content-Disposition: inline; filename=capture.jpg\r\n");
  client.print("Content-Length: ");
  client.print(fb->len);
  client.print("\r\nConnection: close\r\n\r\n");
  client.write(fb->buf, fb->len);

  esp_camera_fb_return(fb);
  xSemaphoreGive(cameraMutex);
}

// Funcion       | handleCapture: atiende la ruta HTTP de captura unica.
void handleCapture()
{
  WiFiClient client = http.client();
  client.setNoDelay(true);
  sendCaptureToClient(client);
}

// Funcion       | handleStatus: atiende la ruta HTTP de estado JSON.
void handleStatus()
{
  sendCors();
  http.send(200, "application/json", statusJson());
}

// Funcion       | handleMode: aplica un preset y responde con el nuevo estado.
void handleMode(uint8_t presetIndex)
{
  bool ok = applyPreset(presetIndex);
  sendCors();
  if (!ok) {
    http.send(503, "application/json", "{\"ok\":false,\"error\":\"camera_busy\"}");
    return;
  }
  http.sendHeader("Location", "/");
  http.send(303);
}

// Funcion       | handleModeFast: selecciona el perfil rapido de camara.
void handleModeFast()
{
  handleMode(CAM_PRESET_FAST);
}

// Funcion       | handleModeBalanced: selecciona el perfil equilibrado de camara.
void handleModeBalanced()
{
  handleMode(CAM_PRESET_BALANCED);
}

// Funcion       | handleModeQuality: selecciona el perfil de mayor calidad.
void handleModeQuality()
{
  handleMode(CAM_PRESET_QUALITY);
}

// Funcion       | handleFlashOn: enciende el LED flash y reporta estado.
void handleFlashOn()
{
  flashOn = true;
  digitalWrite(CAM_FLASH_LED, HIGH);
  sendCors();
  http.sendHeader("Location", "/");
  http.send(303);
}

// Funcion       | handleFlashOff: apaga el LED flash y reporta estado.
void handleFlashOff()
{
  flashOn = false;
  digitalWrite(CAM_FLASH_LED, LOW);
  sendCors();
  http.sendHeader("Location", "/");
  http.send(303);
}

// Funcion       | handleStreamRedirect: redirige al stream MJPEG principal.
void handleStreamRedirect()
{
  sendCors();
  http.sendHeader("Location", streamUrl());
  http.send(302, "text/plain", "Redirecting to realtime stream");
}

// Funcion       | handleRoot: entrega una pagina minima de diagnostico de camara.
void handleRoot()
{
  String html;
  html.reserve(1800);
  html +=
    "<!doctype html><html><head>"
    "<meta charset='utf-8'>"
    "<meta name='viewport' content='width=device-width,initial-scale=1'>"
    "<title>V.E.S.T.A ESP32-CAM</title>"
    "<style>"
    "body{margin:0;background:#111820;color:#f4f7f8;font-family:Arial,sans-serif}"
    "header{padding:14px 16px;background:#18232d;border-bottom:1px solid #2b3845}"
    "h1{font-size:20px;margin:0}"
    "main{padding:16px}"
    ".bar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px}"
    "a{background:#30b39c;color:#06100e;border:0;border-radius:6px;padding:10px 14px;font-weight:700;text-decoration:none;font-size:15px}"
    "img{display:block;width:320px;max-width:100%;height:auto;background:#000;border:1px solid #2b3845}"
    "</style></head><body>"
    "<header><h1>V.E.S.T.A ESP32-CAM</h1></header>"
    "<main><div class='bar'>"
    "<a href='/capture' target='_blank'>Foto</a>"
    "<a id='direct' href='#' target='_blank'>Stream directo</a>"
    "<a href='/mode/fast'>Rapido</a>"
    "<a href='/mode/balanced'>Equilibrado</a>"
    "<a href='/mode/quality'>Calidad</a>"
    "<a href='/flash/on'>Flash ON</a>"
    "<a href='/flash/off'>Flash OFF</a>"
    "</div><img id='cam' src=''>"
    "<script>";
  html += "const u='http://'+location.hostname+':";
  html += CAM_STREAM_PORT;
  html += "/stream';";
  html +=
    "document.getElementById('cam').src=u;"
    "document.getElementById('direct').href=u;"
    "</script></main></body></html>";

  sendCors();
  http.send(200, "text/html", html);
}

// Funcion       | startWifi: intenta modo estacion y cae a AP si no conecta.
void startWifi()
{
  WiFi.persistent(false);
  WiFi.setAutoReconnect(false);
  WiFi.mode(WIFI_OFF);
  delay(CAM_WIFI_BOOT_SETTLE_MS);
  yield();

  WiFi.mode(WIFI_STA);
  delay(CAM_WIFI_BOOT_SETTLE_MS);
  yield();
  WiFi.setSleep(false);
  WiFi.setTxPower(CAM_WIFI_TX_POWER);

  if (hasWifiCredentials()) {
    Serial.print("[WIFI] connecting ");
    Serial.println(WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    for (uint8_t i = 0; i < CAM_STA_CONNECT_TRIES && WiFi.status() != WL_CONNECTED; i++) {
      delay(CAM_STA_CONNECT_DELAY_MS);
      yield();
      Serial.print(".");
    }
    Serial.println();

    if (WiFi.status() == WL_CONNECTED) {
      wifiInAp = false;
      Serial.print("[WIFI] connected IP: ");
      Serial.println(WiFi.localIP());
      return;
    }

    Serial.println("[WIFI] STA failed, starting AP");
    WiFi.disconnect(true);
    delay(CAM_WIFI_BOOT_SETTLE_MS);
    yield();
  } else {
    Serial.println("[WIFI] credentials not configured, starting AP");
  }

  WiFi.mode(WIFI_OFF);
  delay(CAM_WIFI_BOOT_SETTLE_MS);
  yield();

  WiFi.mode(WIFI_AP);
  delay(CAM_WIFI_BOOT_SETTLE_MS);
  yield();
  WiFi.setSleep(false);
  bool apReady = WiFi.softAP(CAM_AP_SSID, CAM_AP_PASSWORD, CAM_AP_CHANNEL, 0, CAM_AP_MAX_CLIENTS);
  delay(250);
  yield();
  WiFi.setTxPower(CAM_WIFI_TX_POWER);
  wifiInAp = apReady;

  if (!apReady) {
    Serial.println("[WIFI] AP failed");
    return;
  }

  Serial.print("[WIFI] AP SSID: ");
  Serial.println(CAM_AP_SSID);
  Serial.print("[WIFI] AP IP: ");
  Serial.println(WiFi.softAPIP());
}

// Funcion       | readHttpRequest: lee la primera linea HTTP y extrae la ruta solicitada.
bool readHttpRequest(WiFiClient &client, String &path)
{
  client.setTimeout(250);
  uint32_t deadline = millis() + 1000;
  while (client.connected() && !client.available() && millis() < deadline) {
    delay(1);
  }
  if (!client.available()) return false;

  String requestLine = client.readStringUntil('\n');
  requestLine.trim();

  int firstSpace = requestLine.indexOf(' ');
  int secondSpace = requestLine.indexOf(' ', firstSpace + 1);
  if (firstSpace >= 0 && secondSpace > firstSpace) {
    path = requestLine.substring(firstSpace + 1, secondSpace);
  } else {
    path = "/";
  }

  while (client.available()) {
    String header = client.readStringUntil('\n');
    if (header == "\r" || header.length() <= 1) break;
  }
  return true;
}

// Funcion       | sendJsonToClient: responde JSON crudo por socket WiFi.
void sendJsonToClient(WiFiClient &client, const String &body)
{
  client.print("HTTP/1.1 200 OK\r\n");
  client.print("Content-Type: application/json\r\n");
  client.print("Access-Control-Allow-Origin: *\r\n");
  client.print("Cache-Control: no-store\r\n");
  client.print("Content-Length: ");
  client.print(body.length());
  client.print("\r\nConnection: close\r\n\r\n");
  client.print(body);
}

// Funcion       | serveStream: envia frames MJPEG mientras el cliente siga conectado.
void serveStream(WiFiClient &client)
{
  client.setNoDelay(true);
  client.print("HTTP/1.1 200 OK\r\n");
  client.print("Content-Type: multipart/x-mixed-replace; boundary=");
  client.print(STREAM_BOUNDARY);
  client.print("\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n");

  uint16_t windowFrames = 0;
  uint32_t windowStartMs = millis();

  while (client.connected()) {
    uint32_t frameStartMs = millis();
    const VestaCamPreset &preset = currentPreset();

    if (!cameraReady) {
      delay(100);
      continue;
    }

    if (xSemaphoreTake(cameraMutex, pdMS_TO_TICKS(1200)) != pdTRUE) {
      delay(1);
      continue;
    }

    camera_fb_t *fb = takeFrame();
    if (!fb) {
      xSemaphoreGive(cameraMutex);
      delay(25);
      continue;
    }

    char header[112];
    int headerLength = snprintf(
      header,
      sizeof(header),
      "--%s\r\nContent-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n",
      STREAM_BOUNDARY,
      fb->len
    );

    client.write(reinterpret_cast<const uint8_t *>(header), headerLength);
    client.write(fb->buf, fb->len);
    client.write(reinterpret_cast<const uint8_t *>("\r\n"), 2);

    esp_camera_fb_return(fb);
    xSemaphoreGive(cameraMutex);

    windowFrames++;
    uint32_t now = millis();
    if (now - windowStartMs >= 5000) {
      lastFps = windowFrames / 5;
      windowFrames = 0;
      windowStartMs = now;
    }

    uint32_t elapsedMs = millis() - frameStartMs;
    if (elapsedMs < preset.frameIntervalMs) {
      delay(preset.frameIntervalMs - elapsedMs);
    } else {
      delay(1);
    }
  }
}

// Funcion       | handleStreamClient: decide si un cliente recibe stream, estado o captura.
void handleStreamClient(WiFiClient client)
{
  client.setNoDelay(true);

  String path;
  if (!readHttpRequest(client, path)) {
    client.stop();
    return;
  }

  int queryIndex = path.indexOf('?');
  if (queryIndex >= 0) path = path.substring(0, queryIndex);

  if (path == "/stream" || path == "/") {
    serveStream(client);
  } else if (path == "/status") {
    sendJsonToClient(client, statusJson());
  } else if (path == "/capture" || path == "/jpg") {
    sendCaptureToClient(client);
  } else if (path == "/mode/fast") {
    applyPreset(CAM_PRESET_FAST);
    sendJsonToClient(client, statusJson());
  } else if (path == "/mode/balanced") {
    applyPreset(CAM_PRESET_BALANCED);
    sendJsonToClient(client, statusJson());
  } else if (path == "/mode/quality") {
    applyPreset(CAM_PRESET_QUALITY);
    sendJsonToClient(client, statusJson());
  } else if (path == "/flash/on") {
    flashOn = true;
    digitalWrite(CAM_FLASH_LED, HIGH);
    sendJsonToClient(client, statusJson());
  } else if (path == "/flash/off") {
    flashOn = false;
    digitalWrite(CAM_FLASH_LED, LOW);
    sendJsonToClient(client, statusJson());
  } else {
    client.print("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
  }

  client.stop();
}

// Funcion       | streamTask: acepta clientes del servidor de video en una tarea FreeRTOS.
void streamTask(void *parameter)
{
  (void)parameter;
  while (true) {
    WiFiClient client = streamServer.available();
    if (client) {
      handleStreamClient(client);
    }
    vTaskDelay(pdMS_TO_TICKS(CAM_CLIENT_IDLE_DELAY_MS));
  }
}

// Funcion       | startServers: registra rutas HTTP y levanta servidores web/video.
void startServers()
{
  http.on("/", HTTP_GET, handleRoot);
  http.on("/status", HTTP_GET, handleStatus);
  http.on("/capture", HTTP_GET, handleCapture);
  http.on("/jpg", HTTP_GET, handleCapture);
  http.on("/stream", HTTP_GET, handleStreamRedirect);
  http.on("/mode/fast", HTTP_GET, handleModeFast);
  http.on("/mode/balanced", HTTP_GET, handleModeBalanced);
  http.on("/mode/quality", HTTP_GET, handleModeQuality);
  http.on("/flash/on", HTTP_GET, handleFlashOn);
  http.on("/flash/off", HTTP_GET, handleFlashOff);
  http.begin();

  streamServer.begin();
  xTaskCreatePinnedToCore(streamTask, "vestaCamStream", 8192, NULL, 2, NULL, 1);

  Serial.print("[HTTP] page: ");
  Serial.println(httpBase());
  Serial.print("[HTTP] stream: ");
  Serial.println(streamUrl());
}

// Funcion       | setup: inicializa serial, flash, WiFi, camara y servicios.
void setup()
{
  Serial.begin(115200);
  Serial.setDebugOutput(false);
  delay(500);

  setCpuFrequencyMhz(CAM_CPU_MHZ);

  pinMode(CAM_FLASH_LED, OUTPUT);
  digitalWrite(CAM_FLASH_LED, LOW);

  cameraMutex = xSemaphoreCreateMutex();
  if (!cameraMutex) {
    Serial.println("[CAM] mutex failed");
    while (true) delay(1000);
  }

  Serial.println();
  Serial.println("V.E.S.T.A. ESP32-CAM realtime firmware");

  startWifi();
  delay(100);
  yield();
  cameraReady = setupCamera();
  yield();
  startServers();
  printStatusToSerial();
}

// Funcion       | loop: atiende HTTP y publica estado serial periodicamente.
void loop()
{
  http.handleClient();

  uint32_t now = millis();
  if (now - lastStatusMs >= CAM_STATUS_INTERVAL_MS) {
    lastStatusMs = now;
    printStatusToSerial();
  }

  delay(2);
}
