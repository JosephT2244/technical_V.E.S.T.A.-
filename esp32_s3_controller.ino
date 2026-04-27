/*
 * V.E.S.T.A. ESP32-S3 controller firmware
 *
 * Hardware:
 * - ESP32-S3 N16R8 with external antenna
 * - TCA9548A + 4x MPU6050
 * - PCA9685 + 6x DS51150 150kg/cm 270 deg servos
 * - 2x flex sensors 4.5 in
 * - Physical emergency stop button
 *
 * Libraries:
 * - ArduinoJson by Benoit Blanchon
 * - WebSockets by Markus Sattler
 * - Adafruit PWM Servo Driver Library
 * - MPU6050 by Electronic Cats
 */

#include "esp32_s3_config.h"
#include <Wire.h>
#include <WiFi.h>
#include <ESPmDNS.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>
#include <Adafruit_PWMServoDriver.h>
#include <MPU6050.h>
#include <Preferences.h>

WebSocketsServer ws(WS_PORT);
Adafruit_PWMServoDriver pca(PCA_ADDR);
Preferences prefs;

MPU6050 imu[NUM_IMUS] = {
  MPU6050(MPU_ADDR),
  MPU6050(MPU_ADDR),
  MPU6050(MPU_ADDR),
  MPU6050(MPU_ADDR)
};

struct ServoCfg {
  float minDeg;
  float maxDeg;
  float homeDeg;
  int8_t direction;
  int pwm0;
  int pwm270;
  float offsetDeg;
};

struct ImuCfg {
  float neutralDeg;
  float minDeg;
  float maxDeg;
  bool invert;
};

struct FlexCfg {
  int adc0;
  int adc90;
  float neutralDeg;
  bool invert;
};

struct CompFilter {
  float angle = 0.0f;
  unsigned long lastUs = 0;
  bool ready = false;
};

struct ImuOffset {
  int16_t ax = 0;
  int16_t ay = 0;
  int16_t az = 0;
  int16_t gx = 0;
  int16_t gy = 0;
  int16_t gz = 0;
};

ServoCfg servoCfg[N_SERVOS];
ImuCfg imuCfg[NUM_IMUS];
FlexCfg flexCfg[2];
CompFilter cf[NUM_IMUS];
ImuOffset imuOff[NUM_IMUS];

float sensorDeg[N_SERVOS] = {0};
float targetDeg[N_SERVOS] = {0};
float currentDeg[N_SERVOS] = {0};
float flexEma[2] = {0};

String opMode = "assisted";
float assistLevel = 0.5f;
float deadbandDeg = 2.0f;
float maxSpeedDegSec = 90.0f;
float smoothing = 0.25f;

bool emergency = false;
bool estopLatched = false;
bool camOnline = false;
unsigned long lastCamMs = 0;
unsigned long tCtrl = 0;
unsigned long tSend = 0;

void setDefaults() {
  for (int i = 0; i < N_SERVOS; i++) {
    servoCfg[i].minDeg = SRV_HARD_MIN[i];
    servoCfg[i].maxDeg = SRV_HARD_MAX[i];
    servoCfg[i].homeDeg = 0;
    servoCfg[i].direction = 1;
    servoCfg[i].pwm0 = PWM_MIN_TICK;
    servoCfg[i].pwm270 = PWM_MAX_TICK;
    servoCfg[i].offsetDeg = 0;
  }

  const float imuMax[NUM_IMUS] = {90, 120, 90, 120};
  for (int i = 0; i < NUM_IMUS; i++) {
    imuCfg[i].neutralDeg = 0;
    imuCfg[i].minDeg = 0;
    imuCfg[i].maxDeg = imuMax[i];
    imuCfg[i].invert = false;
  }

  for (int i = 0; i < 2; i++) {
    flexCfg[i].adc0 = FLEX_ADC_0DEG_DEFAULT;
    flexCfg[i].adc90 = FLEX_ADC_90DEG_DEFAULT;
    flexCfg[i].neutralDeg = 0;
    flexCfg[i].invert = false;
  }
}

void loadPrefs() {
  setDefaults();
  prefs.begin("vesta", true);
  assistLevel = prefs.getFloat("assist", assistLevel);
  deadbandDeg = prefs.getFloat("deadband", deadbandDeg);
  smoothing = prefs.getFloat("smooth", smoothing);
  maxSpeedDegSec = prefs.getFloat("maxspd", maxSpeedDegSec);

  for (int i = 0; i < N_SERVOS; i++) {
    char key[18];
    snprintf(key, sizeof(key), "s%d_min", i); servoCfg[i].minDeg = prefs.getFloat(key, servoCfg[i].minDeg);
    snprintf(key, sizeof(key), "s%d_max", i); servoCfg[i].maxDeg = prefs.getFloat(key, servoCfg[i].maxDeg);
    snprintf(key, sizeof(key), "s%d_home", i); servoCfg[i].homeDeg = prefs.getFloat(key, servoCfg[i].homeDeg);
    snprintf(key, sizeof(key), "s%d_dir", i); servoCfg[i].direction = prefs.getChar(key, servoCfg[i].direction);
    snprintf(key, sizeof(key), "s%d_p0", i); servoCfg[i].pwm0 = prefs.getInt(key, servoCfg[i].pwm0);
    snprintf(key, sizeof(key), "s%d_p270", i); servoCfg[i].pwm270 = prefs.getInt(key, servoCfg[i].pwm270);
    snprintf(key, sizeof(key), "s%d_off", i); servoCfg[i].offsetDeg = prefs.getFloat(key, servoCfg[i].offsetDeg);
  }

  for (int i = 0; i < NUM_IMUS; i++) {
    char key[18];
    snprintf(key, sizeof(key), "i%d_neu", i); imuCfg[i].neutralDeg = prefs.getFloat(key, imuCfg[i].neutralDeg);
    snprintf(key, sizeof(key), "i%d_min", i); imuCfg[i].minDeg = prefs.getFloat(key, imuCfg[i].minDeg);
    snprintf(key, sizeof(key), "i%d_max", i); imuCfg[i].maxDeg = prefs.getFloat(key, imuCfg[i].maxDeg);
    snprintf(key, sizeof(key), "i%d_inv", i); imuCfg[i].invert = prefs.getBool(key, imuCfg[i].invert);
  }

  for (int i = 0; i < 2; i++) {
    char key[18];
    snprintf(key, sizeof(key), "f%d_a0", i); flexCfg[i].adc0 = prefs.getInt(key, flexCfg[i].adc0);
    snprintf(key, sizeof(key), "f%d_a90", i); flexCfg[i].adc90 = prefs.getInt(key, flexCfg[i].adc90);
    snprintf(key, sizeof(key), "f%d_neu", i); flexCfg[i].neutralDeg = prefs.getFloat(key, flexCfg[i].neutralDeg);
    snprintf(key, sizeof(key), "f%d_inv", i); flexCfg[i].invert = prefs.getBool(key, flexCfg[i].invert);
  }
  prefs.end();
}

void savePrefs() {
  prefs.begin("vesta", false);
  prefs.putFloat("assist", assistLevel);
  prefs.putFloat("deadband", deadbandDeg);
  prefs.putFloat("smooth", smoothing);
  prefs.putFloat("maxspd", maxSpeedDegSec);

  for (int i = 0; i < N_SERVOS; i++) {
    char key[18];
    snprintf(key, sizeof(key), "s%d_min", i); prefs.putFloat(key, servoCfg[i].minDeg);
    snprintf(key, sizeof(key), "s%d_max", i); prefs.putFloat(key, servoCfg[i].maxDeg);
    snprintf(key, sizeof(key), "s%d_home", i); prefs.putFloat(key, servoCfg[i].homeDeg);
    snprintf(key, sizeof(key), "s%d_dir", i); prefs.putChar(key, servoCfg[i].direction);
    snprintf(key, sizeof(key), "s%d_p0", i); prefs.putInt(key, servoCfg[i].pwm0);
    snprintf(key, sizeof(key), "s%d_p270", i); prefs.putInt(key, servoCfg[i].pwm270);
    snprintf(key, sizeof(key), "s%d_off", i); prefs.putFloat(key, servoCfg[i].offsetDeg);
  }

  for (int i = 0; i < NUM_IMUS; i++) {
    char key[18];
    snprintf(key, sizeof(key), "i%d_neu", i); prefs.putFloat(key, imuCfg[i].neutralDeg);
    snprintf(key, sizeof(key), "i%d_min", i); prefs.putFloat(key, imuCfg[i].minDeg);
    snprintf(key, sizeof(key), "i%d_max", i); prefs.putFloat(key, imuCfg[i].maxDeg);
    snprintf(key, sizeof(key), "i%d_inv", i); prefs.putBool(key, imuCfg[i].invert);
  }

  for (int i = 0; i < 2; i++) {
    char key[18];
    snprintf(key, sizeof(key), "f%d_a0", i); prefs.putInt(key, flexCfg[i].adc0);
    snprintf(key, sizeof(key), "f%d_a90", i); prefs.putInt(key, flexCfg[i].adc90);
    snprintf(key, sizeof(key), "f%d_neu", i); prefs.putFloat(key, flexCfg[i].neutralDeg);
    snprintf(key, sizeof(key), "f%d_inv", i); prefs.putBool(key, flexCfg[i].invert);
  }
  prefs.end();
}

void tcaSel(uint8_t ch) {
  Wire.beginTransmission(TCA_ADDR);
  Wire.write(ch < 8 ? (1 << ch) : 0x00);
  Wire.endTransmission();
}

void tcaOff() {
  Wire.beginTransmission(TCA_ADDR);
  Wire.write(0x00);
  Wire.endTransmission();
}

float clampServoDeg(int id, float deg) {
  float mn = max(SRV_HARD_MIN[id], servoCfg[id].minDeg);
  float mx = min(SRV_HARD_MAX[id], servoCfg[id].maxDeg);
  return constrain(deg, mn, mx);
}

int angleToPwm(int id, float deg) {
  deg = clampServoDeg(id, deg);
  float logical = deg * servoCfg[id].direction + servoCfg[id].offsetDeg;
  logical = constrain(logical, 0.0f, 270.0f);
  float span = (float)(servoCfg[id].pwm270 - servoCfg[id].pwm0);
  int pulse = servoCfg[id].pwm0 + (int)((logical / 270.0f) * span);
  return constrain(pulse, min(servoCfg[id].pwm0, servoCfg[id].pwm270), max(servoCfg[id].pwm0, servoCfg[id].pwm270));
}

void writeServo(int id, float deg) {
  currentDeg[id] = clampServoDeg(id, deg);
  pca.setPWM(id, 0, angleToPwm(id, currentDeg[id]));
}

void releaseServos() {
  for (int i = 0; i < N_SERVOS; i++) {
    pca.setPWM(i, 0, 4096);
  }
}

void setEmergency(bool active, const char* reason) {
  if (active == emergency) return;
  emergency = active;
  if (active) {
    opMode = "emergency";
#if ESTOP_RELEASES_SERVOS
    releaseServos();
#else
    for (int i = 0; i < N_SERVOS; i++) writeServo(i, currentDeg[i]);
#endif
    Serial.printf("[ESTOP] ACTIVE: %s\n", reason);
  } else {
    opMode = "manual";
    Serial.println("[ESTOP] CLEARED");
  }
}

float readImuRawDeg(int idx) {
  tcaSel(idx);
  delayMicroseconds(300);

  int16_t ax, ay, az, gx, gy, gz;
  imu[idx].getMotion6(&ax, &ay, &az, &gx, &gy, &gz);
  tcaOff();

  ax -= imuOff[idx].ax;
  ay -= imuOff[idx].ay;
  az -= imuOff[idx].az;

  float fax = ax / 16384.0f;
  float fay = ay / 16384.0f;
  float faz = az / 16384.0f;

  float accelAngle;
  float gyroRate;
  if (idx == IMU_L_LAT || idx == IMU_R_LAT) {
    accelAngle = atan2f(fay, faz) * 180.0f / PI + 90.0f;
    gyroRate = (gy - imuOff[idx].gy) / 131.0f;
  } else {
    accelAngle = atan2f(fax, faz) * 180.0f / PI + 90.0f;
    gyroRate = (gx - imuOff[idx].gx) / 131.0f;
  }
  accelAngle = constrain(accelAngle, 0.0f, 180.0f);

  unsigned long nowUs = micros();
  CompFilter& f = cf[idx];
  if (!f.ready) {
    f.angle = accelAngle;
    f.lastUs = nowUs;
    f.ready = true;
    return accelAngle;
  }

  float dt = (nowUs - f.lastUs) * 1.0e-6f;
  f.lastUs = nowUs;
  f.angle = COMP_ALPHA * (f.angle + gyroRate * dt) + (1.0f - COMP_ALPHA) * accelAngle;
  return constrain(f.angle, 0.0f, 180.0f);
}

float readImuDeg(int idx) {
  float raw = readImuRawDeg(idx);
  float deg = (raw - imuCfg[idx].neutralDeg) * (imuCfg[idx].invert ? -1.0f : 1.0f);
  return constrain(deg, imuCfg[idx].minDeg, imuCfg[idx].maxDeg);
}

int readFlexRaw(int idx) {
  int pin = idx == 0 ? PIN_FLEX_L : PIN_FLEX_R;
  long sum = 0;
  for (int i = 0; i < 5; i++) {
    sum += analogRead(pin);
    delayMicroseconds(50);
  }
  return (int)(sum / 5);
}

float readFlexDeg(int idx) {
  int raw = readFlexRaw(idx);
  flexEma[idx] = FLEX_EMA_ALPHA * raw + (1.0f - FLEX_EMA_ALPHA) * flexEma[idx];

  float denom = (float)(flexCfg[idx].adc90 - flexCfg[idx].adc0);
  float ratio = fabsf(denom) < 1.0f ? 0.0f : (flexEma[idx] - flexCfg[idx].adc0) / denom;
  float deg = constrain(ratio * 90.0f, 0.0f, 90.0f);
  deg = (deg - flexCfg[idx].neutralDeg) * (flexCfg[idx].invert ? -1.0f : 1.0f);
  return constrain(deg, 0.0f, 90.0f);
}

void readAllSensors() {
  sensorDeg[SRV_L_LAT] = readImuDeg(IMU_L_LAT);
  sensorDeg[SRV_L_FRO] = readImuDeg(IMU_L_FRO);
  sensorDeg[SRV_R_LAT] = readImuDeg(IMU_R_LAT);
  sensorDeg[SRV_R_FRO] = readImuDeg(IMU_R_FRO);
  sensorDeg[SRV_L_ELB] = readFlexDeg(0);
  sensorDeg[SRV_R_ELB] = readFlexDeg(1);
}

void updateTargetsFromSensors() {
  if (opMode == "assisted") {
    for (int i = 0; i < N_SERVOS; i++) {
      float value = sensorDeg[i];
      if (fabsf(value) < deadbandDeg) value = 0;
      targetDeg[i] = clampServoDeg(i, servoCfg[i].homeDeg + value * (1.0f + assistLevel));
    }
  } else if (opMode == "automatic") {
    for (int i = 0; i < N_SERVOS; i++) targetDeg[i] = clampServoDeg(i, sensorDeg[i]);
  }
}

void updateServos() {
  if (emergency) return;
  float maxStep = maxSpeedDegSec * (CTRL_MS / 1000.0f);
  for (int i = 0; i < N_SERVOS; i++) {
    float err = targetDeg[i] - currentDeg[i];
    if (fabsf(err) < 0.25f) continue;
    float step = constrain(err, -maxStep, maxStep);
    float next = currentDeg[i] + step;
    if (smoothing > 0.01f) next = currentDeg[i] + (next - currentDeg[i]) * constrain(smoothing, 0.05f, 1.0f);
    writeServo(i, next);
  }
}

void calibrateIMUs() {
  const int N = 300;
  Serial.println("[CAL] IMU calibration: keep arms neutral and still.");
  for (int i = 0; i < NUM_IMUS; i++) {
    tcaSel(i);
    long sax = 0, say = 0, saz = 0, sgx = 0, sgy = 0, sgz = 0;
    for (int s = 0; s < N; s++) {
      int16_t ax, ay, az, gx, gy, gz;
      imu[i].getMotion6(&ax, &ay, &az, &gx, &gy, &gz);
      sax += ax; say += ay; saz += az; sgx += gx; sgy += gy; sgz += gz;
      delay(5);
    }
    tcaOff();
    imuOff[i].ax = sax / N;
    imuOff[i].ay = say / N;
    imuOff[i].az = saz / N;
    imuOff[i].gx = sgx / N;
    imuOff[i].gy = sgy / N;
    imuOff[i].gz = sgz / N;
    cf[i].ready = false;
  }
  Serial.println("[CAL] IMU calibration done.");
}

void sendAck(uint8_t client) {
  JsonDocument doc;
  doc["type"] = "ack";
  doc["fw"] = "VESTA-S3-3.0";
  doc["hw"] = "ESP32-S3 N16R8";
  doc["role"] = "controller";
  doc["servos"] = N_SERVOS;
  doc["imus"] = NUM_IMUS;
  doc["flex"] = 2;
  doc["camOnline"] = camOnline;
  String out;
  serializeJson(doc, out);
  ws.sendTXT(client, out);
}

void broadcastJson(JsonDocument& doc) {
  String out;
  serializeJson(doc, out);
  ws.broadcastTXT(out);
}

void sendData() {
  JsonDocument doc;
  doc["type"] = "sensors";
  doc["t"] = millis();
  doc["mode"] = opMode;
  doc["emergency"] = emergency;
  doc["estop"] = estopLatched;
  doc["assist"] = assistLevel;
  doc["deadband"] = deadbandDeg;
  doc["camOnline"] = camOnline;

  JsonArray arr = doc["servos"].to<JsonArray>();
  for (int i = 0; i < N_SERVOS; i++) {
    JsonObject s = arr.add<JsonObject>();
    s["id"] = i;
    s["angle"] = round(currentDeg[i] * 10.0f) / 10.0f;
    s["target"] = round(targetDeg[i] * 10.0f) / 10.0f;
    s["sensor"] = round(sensorDeg[i] * 10.0f) / 10.0f;
    s["moving"] = fabsf(targetDeg[i] - currentDeg[i]) > 0.5f;
    s["amp"] = 0.0f;
    s["temp"] = 0.0f;
  }

  JsonObject bat = doc["battery"].to<JsonObject>();
  bat["v"] = 11.1f;
  bat["pct"] = 100.0f;
  bat["amp"] = 0.0f;

  broadcastJson(doc);
}

void applyCalibrationProfile(JsonDocument& doc) {
  JsonVariant root = doc.as<JsonVariant>();
  if (!doc["profile"].isNull()) root = doc["profile"];

  JsonArray servos = root["servos"].as<JsonArray>();
  for (JsonObject s : servos) {
    int id = s["id"] | -1;
    if (id < 0 || id >= N_SERVOS) continue;
    JsonObject angle = s["angle"];
    JsonObject pwm = s["pwm"];
    servoCfg[id].minDeg = angle["min"] | servoCfg[id].minDeg;
    servoCfg[id].maxDeg = angle["max"] | servoCfg[id].maxDeg;
    servoCfg[id].homeDeg = angle["home"] | servoCfg[id].homeDeg;
    servoCfg[id].direction = angle["direction"] | servoCfg[id].direction;
    servoCfg[id].offsetDeg = angle["mechanicalOffset"] | servoCfg[id].offsetDeg;
    servoCfg[id].pwm0 = pwm["at0deg"] | servoCfg[id].pwm0;
    servoCfg[id].pwm270 = pwm["at270deg"] | servoCfg[id].pwm270;
  }

  JsonArray imus = root["sensors"]["imus"].as<JsonArray>();
  for (JsonObject item : imus) {
    int bus = item["bus"] | -1;
    if (bus < 0 || bus >= NUM_IMUS) continue;
    imuCfg[bus].neutralDeg = item["neutralDeg"] | imuCfg[bus].neutralDeg;
    imuCfg[bus].minDeg = item["minDeg"] | imuCfg[bus].minDeg;
    imuCfg[bus].maxDeg = item["maxDeg"] | imuCfg[bus].maxDeg;
    imuCfg[bus].invert = item["invert"] | imuCfg[bus].invert;
  }

  JsonArray flex = root["sensors"]["flex"].as<JsonArray>();
  for (JsonObject item : flex) {
    int servoId = item["servoId"] | -1;
    int idx = servoId == SRV_L_ELB ? 0 : servoId == SRV_R_ELB ? 1 : -1;
    if (idx < 0) continue;
    flexCfg[idx].adc0 = item["adc0"] | flexCfg[idx].adc0;
    flexCfg[idx].adc90 = item["adc90"] | flexCfg[idx].adc90;
    flexCfg[idx].neutralDeg = item["neutralDeg"] | flexCfg[idx].neutralDeg;
    flexCfg[idx].invert = item["invert"] | flexCfg[idx].invert;
  }

  JsonObject tuning = root["tuning"];
  assistLevel = tuning["assistLevel"] | assistLevel;
  deadbandDeg = tuning["deadbandDeg"] | deadbandDeg;
  smoothing = tuning["smoothing"] | smoothing;
  maxSpeedDegSec = tuning["maxSpeedDegSec"] | maxSpeedDegSec;
  savePrefs();
}

void processCamPacket(JsonDocument& doc) {
  camOnline = true;
  lastCamMs = millis();
  JsonDocument out;
  out["type"] = "cam_bridge";
  out["t"] = millis();
  out["cam"] = doc;
  broadcastJson(out);
}

void processCmd(const String& json, uint8_t client) {
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, json);
  if (err) {
    Serial.printf("[WS] Bad JSON: %s\n", err.c_str());
    return;
  }

  const char* type = doc["type"] | "";

  if (!strcmp(type, "cam_hello") || !strcmp(type, "cam_status") || !strcmp(type, "audio_event")) {
    processCamPacket(doc);
    return;
  }

  if (!strcmp(type, "cmd_angle")) {
    int id = doc["id"] | -1;
    float ang = doc["angle"] | 0.0f;
    if (!emergency && id >= 0 && id < N_SERVOS) targetDeg[id] = clampServoDeg(id, ang);
  } else if (!strcmp(type, "cmd_mode")) {
    const char* m = doc["mode"] | "manual";
    if (!emergency) opMode = String(m);
  } else if (!strcmp(type, "cmd_assist")) {
    assistLevel = constrain((float)(doc["level"] | assistLevel), 0.0f, 1.0f);
    savePrefs();
  } else if (!strcmp(type, "cmd_stop")) {
    setEmergency(true, "remote command");
  } else if (!strcmp(type, "cmd_reset")) {
    if (digitalRead(PIN_ESTOP) == HIGH) {
      setEmergency(false, "remote reset");
      for (int i = 0; i < N_SERVOS; i++) targetDeg[i] = servoCfg[i].homeDeg;
    }
  } else if (!strcmp(type, "cmd_calibrate")) {
    calibrateIMUs();
  } else if (!strcmp(type, "cmd_home")) {
    for (int i = 0; i < N_SERVOS; i++) targetDeg[i] = servoCfg[i].homeDeg;
  } else if (!strcmp(type, "cmd_status")) {
    sendAck(client);
    sendData();
  } else if (!strcmp(type, "cmd_calibration_profile")) {
    applyCalibrationProfile(doc);
    sendAck(client);
  } else if (!strcmp(type, "cmd_calibration_servos") ||
             !strcmp(type, "cmd_calibration_sensors") ||
             !strcmp(type, "cmd_calibration_mapping")) {
    applyCalibrationProfile(doc);
    sendAck(client);
  }
}

void wsEvent(uint8_t num, WStype_t type, uint8_t* payload, size_t len) {
  switch (type) {
    case WStype_CONNECTED:
      Serial.printf("[WS] Client %u connected from %s\n", num, ws.remoteIP(num).toString().c_str());
      sendAck(num);
      break;
    case WStype_DISCONNECTED:
      Serial.printf("[WS] Client %u disconnected\n", num);
      break;
    case WStype_TEXT:
      processCmd(String((char*)payload, len), num);
      break;
    default:
      break;
  }
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

void setupI2CAndHardware() {
  Wire.begin(PIN_SDA, PIN_SCL);
  Wire.setClock(400000);

  pca.begin();
  pca.setOscillatorFrequency(27000000);
  pca.setPWMFreq(PWM_FREQ);
  delay(10);

  for (int i = 0; i < N_SERVOS; i++) {
    currentDeg[i] = servoCfg[i].homeDeg;
    targetDeg[i] = servoCfg[i].homeDeg;
    writeServo(i, currentDeg[i]);
    delay(40);
  }

  bool imuOk = true;
  for (int i = 0; i < NUM_IMUS; i++) {
    tcaSel(i);
    delay(10);
    imu[i].initialize();
    imu[i].setFullScaleAccelRange(MPU6050_ACCEL_FS_2);
    imu[i].setFullScaleGyroRange(MPU6050_GYRO_FS_250);
    imu[i].setDLPFMode(MPU6050_DLPF_BW_42);
    bool ok = imu[i].testConnection();
    Serial.printf("[IMU] bus %d: %s\n", i, ok ? "OK" : "FAIL");
    if (!ok) imuOk = false;
  }
  tcaOff();
  if (!imuOk) Serial.println("[IMU] Warning: at least one MPU6050 did not respond.");

  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);
  flexEma[0] = readFlexRaw(0);
  flexEma[1] = readFlexRaw(1);
}

void setup() {
  Serial.begin(115200);
  delay(400);
  Serial.println("\nV.E.S.T.A. ESP32-S3 controller v3.0");

  pinMode(PIN_ESTOP, INPUT_PULLUP);
  loadPrefs();
  setupI2CAndHardware();
  connectWifi();

  if (MDNS.begin(MDNS_HOST)) {
    MDNS.addService("vesta", "tcp", WS_PORT);
    MDNS.addService("ws", "tcp", WS_PORT);
    Serial.printf("[mDNS] %s.local\n", MDNS_HOST);
  }

  ws.begin();
  ws.onEvent(wsEvent);
  Serial.printf("[WS] Server on port %d\n", WS_PORT);
}

void loop() {
  ws.loop();
  MDNS.update();

  bool buttonPressed = digitalRead(PIN_ESTOP) == LOW;
  if (buttonPressed && !estopLatched) {
    estopLatched = true;
    setEmergency(true, "physical button");
  } else if (!buttonPressed && estopLatched) {
    estopLatched = false;
  }

  if (camOnline && millis() - lastCamMs > CAM_TIMEOUT_MS) camOnline = false;

  unsigned long now = millis();
  if (now - tCtrl >= CTRL_MS) {
    tCtrl = now;
    readAllSensors();
    updateTargetsFromSensors();
    updateServos();
  }

  if (now - tSend >= SEND_MS) {
    tSend = now;
    sendData();
  }
}
