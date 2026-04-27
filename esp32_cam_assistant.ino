/*
 * V.E.S.T.A. ESP32-CAM assistant firmware
 *
 * What it does:
 * - Serves MJPEG camera stream for the app and technician page.
 * - Streams I2S microphone audio to the app over WebSocket as PCM16 mono.
 * - Connects to the ESP32-S3 controller and reports camera/microphone status.
 *
 * Libraries:
 * - ArduinoJson by Benoit Blanchon
 * - WebSockets by Markus Sattler
 * - ESP32 board package with esp_camera
 */

#include "esp32_cam_config.h"
#include "esp_camera.h"
#include <WiFi.h>
#include <WebServer.h>
#include <ESPmDNS.h>
#include <ArduinoJson.h>
#include <WebSocketsServer.h>
#include <WebSocketsClient.h>
#include "driver/i2s.h"

#ifndef I2S_COMM_FORMAT_STAND_I2S
#define I2S_COMM_FORMAT_STAND_I2S I2S_COMM_FORMAT_I2S
#endif

WebServer http(HTTP_PORT);
WebSocketsServer appWs(APP_WS_PORT);
WebSocketsClient s3Ws;

bool cameraReady = false;
bool micReady = false;
bool audioStreaming = AUDIO_STREAM_DEFAULT;
bool s3Connected = false;
uint8_t appClientCount = 0;

unsigned long tStatus = 0;
unsigned long framesSent = 0;
unsigned long audioFramesSent = 0;
int lastAudioPeak = 0;

static const char* STREAM_BOUNDARY = "123456789000000000000987654321";

void sendS3Json(JsonDocument& doc) {
  if (!s3Connected) return;
  String out;
  serializeJson(doc, out);
  s3Ws.sendTXT(out);
}

void broadcastAppJson(JsonDocument& doc) {
  String out;
  serializeJson(doc, out);
  appWs.broadcastTXT(out);
}

void sendStatus() {
  JsonDocument doc;
  doc["type"] = "cam_status";
  doc["t"] = millis();
  doc["role"] = "camera";
  doc["fw"] = "VESTA-CAM-1.0";
  doc["cameraReady"] = cameraReady;
  doc["micReady"] = micReady;
  doc["audioStreaming"] = audioStreaming;
  doc["frames"] = framesSent;
  doc["audioFrames"] = audioFramesSent;
  doc["audioPeak"] = lastAudioPeak;
  doc["ip"] = WiFi.localIP().toString();
  sendS3Json(doc);
  broadcastAppJson(doc);
}

bool setupCamera() {
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
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size = CAMERA_FRAME_SIZE;
  config.jpeg_quality = CAMERA_JPEG_QUALITY;
  config.fb_count = psramFound() ? CAMERA_FB_COUNT : 1;
  config.fb_location = psramFound() ? CAMERA_FB_IN_PSRAM : CAMERA_FB_IN_DRAM;
  config.grab_mode = CAMERA_GRAB_LATEST;

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[CAM] init failed: 0x%x\n", err);
    return false;
  }

  sensor_t* s = esp_camera_sensor_get();
  if (s) {
    s->set_brightness(s, 0);
    s->set_contrast(s, 1);
    s->set_saturation(s, 0);
    s->set_whitebal(s, 1);
    s->set_gain_ctrl(s, 1);
    s->set_exposure_ctrl(s, 1);
  }
  return true;
}

bool setupMic() {
  i2s_config_t i2sConfig = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = MIC_SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 4,
    .dma_buf_len = MIC_CHUNK_SAMPLES,
    .use_apll = false,
    .tx_desc_auto_clear = false,
    .fixed_mclk = 0
  };

  i2s_pin_config_t pinConfig = {
    .bck_io_num = MIC_I2S_BCLK,
    .ws_io_num = MIC_I2S_WS,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num = MIC_I2S_DIN
  };

  esp_err_t err = i2s_driver_install(I2S_NUM_0, &i2sConfig, 0, NULL);
  if (err != ESP_OK) {
    Serial.printf("[MIC] driver install failed: 0x%x\n", err);
    return false;
  }

  err = i2s_set_pin(I2S_NUM_0, &pinConfig);
  if (err != ESP_OK) {
    Serial.printf("[MIC] set pin failed: 0x%x\n", err);
    return false;
  }

  i2s_zero_dma_buffer(I2S_NUM_0);
  return true;
}

void handleRoot() {
  String body;
  body += "V.E.S.T.A ESP32-CAM\n";
  body += "Stream: /stream\n";
  body += "Capture: /capture\n";
  body += "Status: /status\n";
  body += "App WebSocket: ws://";
  body += WiFi.localIP().toString();
  body += ":";
  body += String(APP_WS_PORT);
  body += "\n";
  http.send(200, "text/plain", body);
}

void handleStatusHttp() {
  JsonDocument doc;
  doc["type"] = "cam_status";
  doc["cameraReady"] = cameraReady;
  doc["micReady"] = micReady;
  doc["audioStreaming"] = audioStreaming;
  doc["s3Connected"] = s3Connected;
  doc["frames"] = framesSent;
  doc["audioFrames"] = audioFramesSent;
  doc["audioPeak"] = lastAudioPeak;
  doc["ip"] = WiFi.localIP().toString();
  String out;
  serializeJson(doc, out);
  http.send(200, "application/json", out);
}

void handleCapture() {
  if (!cameraReady) {
    http.send(503, "text/plain", "Camera not ready");
    return;
  }
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) {
    http.send(500, "text/plain", "Capture failed");
    return;
  }
  WiFiClient client = http.client();
  client.print("HTTP/1.1 200 OK\r\n");
  client.print("Access-Control-Allow-Origin: *\r\n");
  client.print("Content-Type: image/jpeg\r\n");
  client.printf("Content-Length: %u\r\n", fb->len);
  client.print("Content-Disposition: inline; filename=capture.jpg\r\n\r\n");
  client.write(fb->buf, fb->len);
  esp_camera_fb_return(fb);
}

void handleStream() {
  if (!cameraReady) {
    http.send(503, "text/plain", "Camera not ready");
    return;
  }

  WiFiClient client = http.client();
  String header = "HTTP/1.1 200 OK\r\n";
  header += "Access-Control-Allow-Origin: *\r\n";
  header += "Cache-Control: no-cache\r\n";
  header += "Content-Type: multipart/x-mixed-replace; boundary=";
  header += STREAM_BOUNDARY;
  header += "\r\n\r\n";
  client.print(header);

  while (client.connected()) {
    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb) break;

    client.printf("--%s\r\n", STREAM_BOUNDARY);
    client.printf("Content-Type: image/jpeg\r\n");
    client.printf("Content-Length: %u\r\n\r\n", fb->len);
    client.write(fb->buf, fb->len);
    client.print("\r\n");
    framesSent++;
    esp_camera_fb_return(fb);

    if (!client.connected()) break;
    delay(40);
  }
}

void appWsEvent(uint8_t num, WStype_t type, uint8_t* payload, size_t len) {
  switch (type) {
    case WStype_CONNECTED: {
      appClientCount++;
      Serial.printf("[APP-WS] client %u connected\n", num);
      sendStatus();
      break;
    }
    case WStype_DISCONNECTED:
      if (appClientCount > 0) appClientCount--;
      Serial.printf("[APP-WS] client %u disconnected\n", num);
      break;
    case WStype_TEXT: {
      JsonDocument doc;
      if (deserializeJson(doc, payload, len)) return;
      const char* cmd = doc["type"] | "";
      if (!strcmp(cmd, "mic_start")) {
        audioStreaming = micReady;
      } else if (!strcmp(cmd, "mic_stop")) {
        audioStreaming = false;
      } else if (!strcmp(cmd, "cam_status")) {
        sendStatus();
      } else if (!strcmp(cmd, "assistant_prompt")) {
        JsonDocument bridge;
        bridge["type"] = "audio_event";
        bridge["event"] = "assistant_prompt";
        bridge["text"] = doc["text"] | "";
        sendS3Json(bridge);
      }
      sendStatus();
      break;
    }
    default:
      break;
  }
}

void s3WsEvent(WStype_t type, uint8_t* payload, size_t len) {
  switch (type) {
    case WStype_CONNECTED: {
      s3Connected = true;
      Serial.println("[S3] connected");
      JsonDocument hello;
      hello["type"] = "cam_hello";
      hello["fw"] = "VESTA-CAM-1.0";
      hello["stream"] = String("http://") + WiFi.localIP().toString() + "/stream";
      hello["appWs"] = String("ws://") + WiFi.localIP().toString() + ":" + String(APP_WS_PORT);
      sendS3Json(hello);
      break;
    }
    case WStype_DISCONNECTED:
      s3Connected = false;
      Serial.println("[S3] disconnected");
      break;
    case WStype_TEXT:
      Serial.printf("[S3] %.*s\n", (int)len, (char*)payload);
      break;
    default:
      break;
  }
}

void readAndStreamAudio() {
  if (!micReady) return;

  static int32_t raw[MIC_CHUNK_SAMPLES];
  static int16_t pcm[MIC_CHUNK_SAMPLES];
  size_t bytesRead = 0;
  esp_err_t err = i2s_read(I2S_NUM_0, raw, sizeof(raw), &bytesRead, 0);
  if (err != ESP_OK || bytesRead == 0) return;

  int samples = bytesRead / sizeof(int32_t);
  int peak = 0;
  for (int i = 0; i < samples; i++) {
    int32_t sample = raw[i] >> 14;
    sample = constrain(sample, -32768, 32767);
    pcm[i] = (int16_t)sample;
    int a = abs((int)pcm[i]);
    if (a > peak) peak = a;
  }
  lastAudioPeak = peak;

  if (audioStreaming && appClientCount > 0) {
    appWs.broadcastBIN((uint8_t*)pcm, samples * sizeof(int16_t));
    audioFramesSent++;
  }
}

void setupHttp() {
  http.on("/", HTTP_GET, handleRoot);
  http.on("/status", HTTP_GET, handleStatusHttp);
  http.on("/capture", HTTP_GET, handleCapture);
  http.on("/stream", HTTP_GET, handleStream);
  http.begin();
  Serial.printf("[HTTP] port %d\n", HTTP_PORT);
}

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);
  for (int i = 0; i < 60 && WiFi.status() != WL_CONNECTED; i++) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[WiFi] IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("[WiFi] Not connected. Check credentials.");
  }
}

void setup() {
  Serial.begin(115200);
  delay(400);
  Serial.println("\nV.E.S.T.A. ESP32-CAM assistant v1.0");

  connectWifi();
  cameraReady = setupCamera();
  micReady = setupMic();

  if (MDNS.begin(MDNS_HOST)) {
    MDNS.addService("http", "tcp", HTTP_PORT);
    MDNS.addService("ws", "tcp", APP_WS_PORT);
    Serial.printf("[mDNS] %s.local\n", MDNS_HOST);
  }

  setupHttp();
  appWs.begin();
  appWs.onEvent(appWsEvent);
  Serial.printf("[APP-WS] port %d\n", APP_WS_PORT);

  s3Ws.begin(S3_HOST, S3_WS_PORT, "/");
  s3Ws.onEvent(s3WsEvent);
  s3Ws.setReconnectInterval(3000);
  s3Ws.enableHeartbeat(15000, 3000, 2);

  sendStatus();
}

void loop() {
  http.handleClient();
  appWs.loop();
  s3Ws.loop();
  MDNS.update();

  readAndStreamAudio();

  if (millis() - tStatus > 1000) {
    tStatus = millis();
    sendStatus();
  }
}
