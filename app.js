(() => {
  "use strict";

  const STORAGE_KEY = "vesta-tech-calibration-v1";
  const PROFILE_SCHEMA = 1;
  const FIRMWARE_FILES = {
    s3: {
      fileName: "esp32_s3_controller.ino",
      url: "esp32_s3_controller.ino"
    },
    cam: {
      fileName: "esp32_cam_assistant.ino",
      url: "esp32_cam_assistant.ino"
    }
  };

  const FIRMWARE_DEFAULT_CODE = {
    s3: "/*\n * V.E.S.T.A. ESP32-S3 controller firmware\n *\n * Hardware:\n * - ESP32-S3 N16R8 with external antenna\n * - TCA9548A + 4x MPU6050\n * - PCA9685 + 6x DS51150 150kg/cm 270 deg servos\n * - 2x flex sensors 4.5 in\n * - Physical emergency stop button\n *\n * Libraries:\n * - ArduinoJson by Benoit Blanchon\n * - WebSockets by Markus Sattler\n * - Adafruit PWM Servo Driver Library\n * - MPU6050 by Electronic Cats\n */\n\n#include \"esp32_s3_config.h\"\n#include <Wire.h>\n#include <WiFi.h>\n#include <ESPmDNS.h>\n#include <WebSocketsServer.h>\n#include <ArduinoJson.h>\n#include <Adafruit_PWMServoDriver.h>\n#include <MPU6050.h>\n#include <Preferences.h>\n\nWebSocketsServer ws(WS_PORT);\nAdafruit_PWMServoDriver pca(PCA_ADDR);\nPreferences prefs;\n\nMPU6050 imu[NUM_IMUS] = {\n  MPU6050(MPU_ADDR),\n  MPU6050(MPU_ADDR),\n  MPU6050(MPU_ADDR),\n  MPU6050(MPU_ADDR)\n};\n\nstruct ServoCfg {\n  float minDeg;\n  float maxDeg;\n  float homeDeg;\n  int8_t direction;\n  int pwm0;\n  int pwm270;\n  float offsetDeg;\n};\n\nstruct ImuCfg {\n  float neutralDeg;\n  float minDeg;\n  float maxDeg;\n  bool invert;\n};\n\nstruct FlexCfg {\n  int adc0;\n  int adc90;\n  float neutralDeg;\n  bool invert;\n};\n\nstruct CompFilter {\n  float angle = 0.0f;\n  unsigned long lastUs = 0;\n  bool ready = false;\n};\n\nstruct ImuOffset {\n  int16_t ax = 0;\n  int16_t ay = 0;\n  int16_t az = 0;\n  int16_t gx = 0;\n  int16_t gy = 0;\n  int16_t gz = 0;\n};\n\nServoCfg servoCfg[N_SERVOS];\nImuCfg imuCfg[NUM_IMUS];\nFlexCfg flexCfg[2];\nCompFilter cf[NUM_IMUS];\nImuOffset imuOff[NUM_IMUS];\n\nfloat sensorDeg[N_SERVOS] = {0};\nfloat targetDeg[N_SERVOS] = {0};\nfloat currentDeg[N_SERVOS] = {0};\nfloat flexEma[2] = {0};\n\nString opMode = \"assisted\";\nfloat assistLevel = 0.5f;\nfloat deadbandDeg = 2.0f;\nfloat maxSpeedDegSec = 90.0f;\nfloat smoothing = 0.25f;\n\nbool emergency = false;\nbool estopLatched = false;\nbool camOnline = false;\nunsigned long lastCamMs = 0;\nunsigned long tCtrl = 0;\nunsigned long tSend = 0;\n\nvoid setDefaults() {\n  for (int i = 0; i < N_SERVOS; i++) {\n    servoCfg[i].minDeg = SRV_HARD_MIN[i];\n    servoCfg[i].maxDeg = SRV_HARD_MAX[i];\n    servoCfg[i].homeDeg = 0;\n    servoCfg[i].direction = 1;\n    servoCfg[i].pwm0 = PWM_MIN_TICK;\n    servoCfg[i].pwm270 = PWM_MAX_TICK;\n    servoCfg[i].offsetDeg = 0;\n  }\n\n  const float imuMax[NUM_IMUS] = {90, 120, 90, 120};\n  for (int i = 0; i < NUM_IMUS; i++) {\n    imuCfg[i].neutralDeg = 0;\n    imuCfg[i].minDeg = 0;\n    imuCfg[i].maxDeg = imuMax[i];\n    imuCfg[i].invert = false;\n  }\n\n  for (int i = 0; i < 2; i++) {\n    flexCfg[i].adc0 = FLEX_ADC_0DEG_DEFAULT;\n    flexCfg[i].adc90 = FLEX_ADC_90DEG_DEFAULT;\n    flexCfg[i].neutralDeg = 0;\n    flexCfg[i].invert = false;\n  }\n}\n\nvoid loadPrefs() {\n  setDefaults();\n  prefs.begin(\"vesta\", true);\n  assistLevel = prefs.getFloat(\"assist\", assistLevel);\n  deadbandDeg = prefs.getFloat(\"deadband\", deadbandDeg);\n  smoothing = prefs.getFloat(\"smooth\", smoothing);\n  maxSpeedDegSec = prefs.getFloat(\"maxspd\", maxSpeedDegSec);\n\n  for (int i = 0; i < N_SERVOS; i++) {\n    char key[18];\n    snprintf(key, sizeof(key), \"s%d_min\", i); servoCfg[i].minDeg = prefs.getFloat(key, servoCfg[i].minDeg);\n    snprintf(key, sizeof(key), \"s%d_max\", i); servoCfg[i].maxDeg = prefs.getFloat(key, servoCfg[i].maxDeg);\n    snprintf(key, sizeof(key), \"s%d_home\", i); servoCfg[i].homeDeg = prefs.getFloat(key, servoCfg[i].homeDeg);\n    snprintf(key, sizeof(key), \"s%d_dir\", i); servoCfg[i].direction = prefs.getChar(key, servoCfg[i].direction);\n    snprintf(key, sizeof(key), \"s%d_p0\", i); servoCfg[i].pwm0 = prefs.getInt(key, servoCfg[i].pwm0);\n    snprintf(key, sizeof(key), \"s%d_p270\", i); servoCfg[i].pwm270 = prefs.getInt(key, servoCfg[i].pwm270);\n    snprintf(key, sizeof(key), \"s%d_off\", i); servoCfg[i].offsetDeg = prefs.getFloat(key, servoCfg[i].offsetDeg);\n  }\n\n  for (int i = 0; i < NUM_IMUS; i++) {\n    char key[18];\n    snprintf(key, sizeof(key), \"i%d_neu\", i); imuCfg[i].neutralDeg = prefs.getFloat(key, imuCfg[i].neutralDeg);\n    snprintf(key, sizeof(key), \"i%d_min\", i); imuCfg[i].minDeg = prefs.getFloat(key, imuCfg[i].minDeg);\n    snprintf(key, sizeof(key), \"i%d_max\", i); imuCfg[i].maxDeg = prefs.getFloat(key, imuCfg[i].maxDeg);\n    snprintf(key, sizeof(key), \"i%d_inv\", i); imuCfg[i].invert = prefs.getBool(key, imuCfg[i].invert);\n  }\n\n  for (int i = 0; i < 2; i++) {\n    char key[18];\n    snprintf(key, sizeof(key), \"f%d_a0\", i); flexCfg[i].adc0 = prefs.getInt(key, flexCfg[i].adc0);\n    snprintf(key, sizeof(key), \"f%d_a90\", i); flexCfg[i].adc90 = prefs.getInt(key, flexCfg[i].adc90);\n    snprintf(key, sizeof(key), \"f%d_neu\", i); flexCfg[i].neutralDeg = prefs.getFloat(key, flexCfg[i].neutralDeg);\n    snprintf(key, sizeof(key), \"f%d_inv\", i); flexCfg[i].invert = prefs.getBool(key, flexCfg[i].invert);\n  }\n  prefs.end();\n}\n\nvoid savePrefs() {\n  prefs.begin(\"vesta\", false);\n  prefs.putFloat(\"assist\", assistLevel);\n  prefs.putFloat(\"deadband\", deadbandDeg);\n  prefs.putFloat(\"smooth\", smoothing);\n  prefs.putFloat(\"maxspd\", maxSpeedDegSec);\n\n  for (int i = 0; i < N_SERVOS; i++) {\n    char key[18];\n    snprintf(key, sizeof(key), \"s%d_min\", i); prefs.putFloat(key, servoCfg[i].minDeg);\n    snprintf(key, sizeof(key), \"s%d_max\", i); prefs.putFloat(key, servoCfg[i].maxDeg);\n    snprintf(key, sizeof(key), \"s%d_home\", i); prefs.putFloat(key, servoCfg[i].homeDeg);\n    snprintf(key, sizeof(key), \"s%d_dir\", i); prefs.putChar(key, servoCfg[i].direction);\n    snprintf(key, sizeof(key), \"s%d_p0\", i); prefs.putInt(key, servoCfg[i].pwm0);\n    snprintf(key, sizeof(key), \"s%d_p270\", i); prefs.putInt(key, servoCfg[i].pwm270);\n    snprintf(key, sizeof(key), \"s%d_off\", i); prefs.putFloat(key, servoCfg[i].offsetDeg);\n  }\n\n  for (int i = 0; i < NUM_IMUS; i++) {\n    char key[18];\n    snprintf(key, sizeof(key), \"i%d_neu\", i); prefs.putFloat(key, imuCfg[i].neutralDeg);\n    snprintf(key, sizeof(key), \"i%d_min\", i); prefs.putFloat(key, imuCfg[i].minDeg);\n    snprintf(key, sizeof(key), \"i%d_max\", i); prefs.putFloat(key, imuCfg[i].maxDeg);\n    snprintf(key, sizeof(key), \"i%d_inv\", i); prefs.putBool(key, imuCfg[i].invert);\n  }\n\n  for (int i = 0; i < 2; i++) {\n    char key[18];\n    snprintf(key, sizeof(key), \"f%d_a0\", i); prefs.putInt(key, flexCfg[i].adc0);\n    snprintf(key, sizeof(key), \"f%d_a90\", i); prefs.putInt(key, flexCfg[i].adc90);\n    snprintf(key, sizeof(key), \"f%d_neu\", i); prefs.putFloat(key, flexCfg[i].neutralDeg);\n    snprintf(key, sizeof(key), \"f%d_inv\", i); prefs.putBool(key, flexCfg[i].invert);\n  }\n  prefs.end();\n}\n\nvoid tcaSel(uint8_t ch) {\n  Wire.beginTransmission(TCA_ADDR);\n  Wire.write(ch < 8 ? (1 << ch) : 0x00);\n  Wire.endTransmission();\n}\n\nvoid tcaOff() {\n  Wire.beginTransmission(TCA_ADDR);\n  Wire.write(0x00);\n  Wire.endTransmission();\n}\n\nfloat clampServoDeg(int id, float deg) {\n  float mn = max(SRV_HARD_MIN[id], servoCfg[id].minDeg);\n  float mx = min(SRV_HARD_MAX[id], servoCfg[id].maxDeg);\n  return constrain(deg, mn, mx);\n}\n\nint angleToPwm(int id, float deg) {\n  deg = clampServoDeg(id, deg);\n  float logical = deg * servoCfg[id].direction + servoCfg[id].offsetDeg;\n  logical = constrain(logical, 0.0f, 270.0f);\n  float span = (float)(servoCfg[id].pwm270 - servoCfg[id].pwm0);\n  int pulse = servoCfg[id].pwm0 + (int)((logical / 270.0f) * span);\n  return constrain(pulse, min(servoCfg[id].pwm0, servoCfg[id].pwm270), max(servoCfg[id].pwm0, servoCfg[id].pwm270));\n}\n\nvoid writeServo(int id, float deg) {\n  currentDeg[id] = clampServoDeg(id, deg);\n  pca.setPWM(id, 0, angleToPwm(id, currentDeg[id]));\n}\n\nvoid releaseServos() {\n  for (int i = 0; i < N_SERVOS; i++) {\n    pca.setPWM(i, 0, 4096);\n  }\n}\n\nvoid setEmergency(bool active, const char* reason) {\n  if (active == emergency) return;\n  emergency = active;\n  if (active) {\n    opMode = \"emergency\";\n#if ESTOP_RELEASES_SERVOS\n    releaseServos();\n#else\n    for (int i = 0; i < N_SERVOS; i++) writeServo(i, currentDeg[i]);\n#endif\n    Serial.printf(\"[ESTOP] ACTIVE: %s\\n\", reason);\n  } else {\n    opMode = \"manual\";\n    Serial.println(\"[ESTOP] CLEARED\");\n  }\n}\n\nfloat readImuRawDeg(int idx) {\n  tcaSel(idx);\n  delayMicroseconds(300);\n\n  int16_t ax, ay, az, gx, gy, gz;\n  imu[idx].getMotion6(&ax, &ay, &az, &gx, &gy, &gz);\n  tcaOff();\n\n  ax -= imuOff[idx].ax;\n  ay -= imuOff[idx].ay;\n  az -= imuOff[idx].az;\n\n  float fax = ax / 16384.0f;\n  float fay = ay / 16384.0f;\n  float faz = az / 16384.0f;\n\n  float accelAngle;\n  float gyroRate;\n  if (idx == IMU_L_LAT || idx == IMU_R_LAT) {\n    accelAngle = atan2f(fay, faz) * 180.0f / PI + 90.0f;\n    gyroRate = (gy - imuOff[idx].gy) / 131.0f;\n  } else {\n    accelAngle = atan2f(fax, faz) * 180.0f / PI + 90.0f;\n    gyroRate = (gx - imuOff[idx].gx) / 131.0f;\n  }\n  accelAngle = constrain(accelAngle, 0.0f, 180.0f);\n\n  unsigned long nowUs = micros();\n  CompFilter& f = cf[idx];\n  if (!f.ready) {\n    f.angle = accelAngle;\n    f.lastUs = nowUs;\n    f.ready = true;\n    return accelAngle;\n  }\n\n  float dt = (nowUs - f.lastUs) * 1.0e-6f;\n  f.lastUs = nowUs;\n  f.angle = COMP_ALPHA * (f.angle + gyroRate * dt) + (1.0f - COMP_ALPHA) * accelAngle;\n  return constrain(f.angle, 0.0f, 180.0f);\n}\n\nfloat readImuDeg(int idx) {\n  float raw = readImuRawDeg(idx);\n  float deg = (raw - imuCfg[idx].neutralDeg) * (imuCfg[idx].invert ? -1.0f : 1.0f);\n  return constrain(deg, imuCfg[idx].minDeg, imuCfg[idx].maxDeg);\n}\n\nint readFlexRaw(int idx) {\n  int pin = idx == 0 ? PIN_FLEX_L : PIN_FLEX_R;\n  long sum = 0;\n  for (int i = 0; i < 5; i++) {\n    sum += analogRead(pin);\n    delayMicroseconds(50);\n  }\n  return (int)(sum / 5);\n}\n\nfloat readFlexDeg(int idx) {\n  int raw = readFlexRaw(idx);\n  flexEma[idx] = FLEX_EMA_ALPHA * raw + (1.0f - FLEX_EMA_ALPHA) * flexEma[idx];\n\n  float denom = (float)(flexCfg[idx].adc90 - flexCfg[idx].adc0);\n  float ratio = fabsf(denom) < 1.0f ? 0.0f : (flexEma[idx] - flexCfg[idx].adc0) / denom;\n  float deg = constrain(ratio * 90.0f, 0.0f, 90.0f);\n  deg = (deg - flexCfg[idx].neutralDeg) * (flexCfg[idx].invert ? -1.0f : 1.0f);\n  return constrain(deg, 0.0f, 90.0f);\n}\n\nvoid readAllSensors() {\n  sensorDeg[SRV_L_LAT] = readImuDeg(IMU_L_LAT);\n  sensorDeg[SRV_L_FRO] = readImuDeg(IMU_L_FRO);\n  sensorDeg[SRV_R_LAT] = readImuDeg(IMU_R_LAT);\n  sensorDeg[SRV_R_FRO] = readImuDeg(IMU_R_FRO);\n  sensorDeg[SRV_L_ELB] = readFlexDeg(0);\n  sensorDeg[SRV_R_ELB] = readFlexDeg(1);\n}\n\nvoid updateTargetsFromSensors() {\n  if (opMode == \"assisted\") {\n    for (int i = 0; i < N_SERVOS; i++) {\n      float value = sensorDeg[i];\n      if (fabsf(value) < deadbandDeg) value = 0;\n      targetDeg[i] = clampServoDeg(i, servoCfg[i].homeDeg + value * (1.0f + assistLevel));\n    }\n  } else if (opMode == \"automatic\") {\n    for (int i = 0; i < N_SERVOS; i++) targetDeg[i] = clampServoDeg(i, sensorDeg[i]);\n  }\n}\n\nvoid updateServos() {\n  if (emergency) return;\n  float maxStep = maxSpeedDegSec * (CTRL_MS / 1000.0f);\n  for (int i = 0; i < N_SERVOS; i++) {\n    float err = targetDeg[i] - currentDeg[i];\n    if (fabsf(err) < 0.25f) continue;\n    float step = constrain(err, -maxStep, maxStep);\n    float next = currentDeg[i] + step;\n    if (smoothing > 0.01f) next = currentDeg[i] + (next - currentDeg[i]) * constrain(smoothing, 0.05f, 1.0f);\n    writeServo(i, next);\n  }\n}\n\nvoid calibrateIMUs() {\n  const int N = 300;\n  Serial.println(\"[CAL] IMU calibration: keep arms neutral and still.\");\n  for (int i = 0; i < NUM_IMUS; i++) {\n    tcaSel(i);\n    long sax = 0, say = 0, saz = 0, sgx = 0, sgy = 0, sgz = 0;\n    for (int s = 0; s < N; s++) {\n      int16_t ax, ay, az, gx, gy, gz;\n      imu[i].getMotion6(&ax, &ay, &az, &gx, &gy, &gz);\n      sax += ax; say += ay; saz += az; sgx += gx; sgy += gy; sgz += gz;\n      delay(5);\n    }\n    tcaOff();\n    imuOff[i].ax = sax / N;\n    imuOff[i].ay = say / N;\n    imuOff[i].az = saz / N;\n    imuOff[i].gx = sgx / N;\n    imuOff[i].gy = sgy / N;\n    imuOff[i].gz = sgz / N;\n    cf[i].ready = false;\n  }\n  Serial.println(\"[CAL] IMU calibration done.\");\n}\n\nvoid sendAck(uint8_t client) {\n  JsonDocument doc;\n  doc[\"type\"] = \"ack\";\n  doc[\"fw\"] = \"VESTA-S3-3.0\";\n  doc[\"hw\"] = \"ESP32-S3 N16R8\";\n  doc[\"role\"] = \"controller\";\n  doc[\"servos\"] = N_SERVOS;\n  doc[\"imus\"] = NUM_IMUS;\n  doc[\"flex\"] = 2;\n  doc[\"camOnline\"] = camOnline;\n  String out;\n  serializeJson(doc, out);\n  ws.sendTXT(client, out);\n}\n\nvoid broadcastJson(JsonDocument& doc) {\n  String out;\n  serializeJson(doc, out);\n  ws.broadcastTXT(out);\n}\n\nvoid sendData() {\n  JsonDocument doc;\n  doc[\"type\"] = \"sensors\";\n  doc[\"t\"] = millis();\n  doc[\"mode\"] = opMode;\n  doc[\"emergency\"] = emergency;\n  doc[\"estop\"] = estopLatched;\n  doc[\"assist\"] = assistLevel;\n  doc[\"deadband\"] = deadbandDeg;\n  doc[\"camOnline\"] = camOnline;\n\n  JsonArray arr = doc[\"servos\"].to<JsonArray>();\n  for (int i = 0; i < N_SERVOS; i++) {\n    JsonObject s = arr.add<JsonObject>();\n    s[\"id\"] = i;\n    s[\"angle\"] = round(currentDeg[i] * 10.0f) / 10.0f;\n    s[\"target\"] = round(targetDeg[i] * 10.0f) / 10.0f;\n    s[\"sensor\"] = round(sensorDeg[i] * 10.0f) / 10.0f;\n    s[\"moving\"] = fabsf(targetDeg[i] - currentDeg[i]) > 0.5f;\n    s[\"amp\"] = 0.0f;\n    s[\"temp\"] = 0.0f;\n  }\n\n  JsonObject bat = doc[\"battery\"].to<JsonObject>();\n  bat[\"v\"] = 11.1f;\n  bat[\"pct\"] = 100.0f;\n  bat[\"amp\"] = 0.0f;\n\n  broadcastJson(doc);\n}\n\nvoid applyCalibrationProfile(JsonDocument& doc) {\n  JsonVariant root = doc.as<JsonVariant>();\n  if (!doc[\"profile\"].isNull()) root = doc[\"profile\"];\n\n  JsonArray servos = root[\"servos\"].as<JsonArray>();\n  for (JsonObject s : servos) {\n    int id = s[\"id\"] | -1;\n    if (id < 0 || id >= N_SERVOS) continue;\n    JsonObject angle = s[\"angle\"];\n    JsonObject pwm = s[\"pwm\"];\n    servoCfg[id].minDeg = angle[\"min\"] | servoCfg[id].minDeg;\n    servoCfg[id].maxDeg = angle[\"max\"] | servoCfg[id].maxDeg;\n    servoCfg[id].homeDeg = angle[\"home\"] | servoCfg[id].homeDeg;\n    servoCfg[id].direction = angle[\"direction\"] | servoCfg[id].direction;\n    servoCfg[id].offsetDeg = angle[\"mechanicalOffset\"] | servoCfg[id].offsetDeg;\n    servoCfg[id].pwm0 = pwm[\"at0deg\"] | servoCfg[id].pwm0;\n    servoCfg[id].pwm270 = pwm[\"at270deg\"] | servoCfg[id].pwm270;\n  }\n\n  JsonArray imus = root[\"sensors\"][\"imus\"].as<JsonArray>();\n  for (JsonObject item : imus) {\n    int bus = item[\"bus\"] | -1;\n    if (bus < 0 || bus >= NUM_IMUS) continue;\n    imuCfg[bus].neutralDeg = item[\"neutralDeg\"] | imuCfg[bus].neutralDeg;\n    imuCfg[bus].minDeg = item[\"minDeg\"] | imuCfg[bus].minDeg;\n    imuCfg[bus].maxDeg = item[\"maxDeg\"] | imuCfg[bus].maxDeg;\n    imuCfg[bus].invert = item[\"invert\"] | imuCfg[bus].invert;\n  }\n\n  JsonArray flex = root[\"sensors\"][\"flex\"].as<JsonArray>();\n  for (JsonObject item : flex) {\n    int servoId = item[\"servoId\"] | -1;\n    int idx = servoId == SRV_L_ELB ? 0 : servoId == SRV_R_ELB ? 1 : -1;\n    if (idx < 0) continue;\n    flexCfg[idx].adc0 = item[\"adc0\"] | flexCfg[idx].adc0;\n    flexCfg[idx].adc90 = item[\"adc90\"] | flexCfg[idx].adc90;\n    flexCfg[idx].neutralDeg = item[\"neutralDeg\"] | flexCfg[idx].neutralDeg;\n    flexCfg[idx].invert = item[\"invert\"] | flexCfg[idx].invert;\n  }\n\n  JsonObject tuning = root[\"tuning\"];\n  assistLevel = tuning[\"assistLevel\"] | assistLevel;\n  deadbandDeg = tuning[\"deadbandDeg\"] | deadbandDeg;\n  smoothing = tuning[\"smoothing\"] | smoothing;\n  maxSpeedDegSec = tuning[\"maxSpeedDegSec\"] | maxSpeedDegSec;\n  savePrefs();\n}\n\nvoid processCamPacket(JsonDocument& doc) {\n  camOnline = true;\n  lastCamMs = millis();\n  JsonDocument out;\n  out[\"type\"] = \"cam_bridge\";\n  out[\"t\"] = millis();\n  out[\"cam\"] = doc;\n  broadcastJson(out);\n}\n\nvoid processCmd(const String& json, uint8_t client) {\n  JsonDocument doc;\n  DeserializationError err = deserializeJson(doc, json);\n  if (err) {\n    Serial.printf(\"[WS] Bad JSON: %s\\n\", err.c_str());\n    return;\n  }\n\n  const char* type = doc[\"type\"] | \"\";\n\n  if (!strcmp(type, \"cam_hello\") || !strcmp(type, \"cam_status\") || !strcmp(type, \"audio_event\")) {\n    processCamPacket(doc);\n    return;\n  }\n\n  if (!strcmp(type, \"cmd_angle\")) {\n    int id = doc[\"id\"] | -1;\n    float ang = doc[\"angle\"] | 0.0f;\n    if (!emergency && id >= 0 && id < N_SERVOS) targetDeg[id] = clampServoDeg(id, ang);\n  } else if (!strcmp(type, \"cmd_mode\")) {\n    const char* m = doc[\"mode\"] | \"manual\";\n    if (!emergency) opMode = String(m);\n  } else if (!strcmp(type, \"cmd_assist\")) {\n    assistLevel = constrain((float)(doc[\"level\"] | assistLevel), 0.0f, 1.0f);\n    savePrefs();\n  } else if (!strcmp(type, \"cmd_stop\")) {\n    setEmergency(true, \"remote command\");\n  } else if (!strcmp(type, \"cmd_reset\")) {\n    if (digitalRead(PIN_ESTOP) == HIGH) {\n      setEmergency(false, \"remote reset\");\n      for (int i = 0; i < N_SERVOS; i++) targetDeg[i] = servoCfg[i].homeDeg;\n    }\n  } else if (!strcmp(type, \"cmd_calibrate\")) {\n    calibrateIMUs();\n  } else if (!strcmp(type, \"cmd_home\")) {\n    for (int i = 0; i < N_SERVOS; i++) targetDeg[i] = servoCfg[i].homeDeg;\n  } else if (!strcmp(type, \"cmd_status\")) {\n    sendAck(client);\n    sendData();\n  } else if (!strcmp(type, \"cmd_calibration_profile\")) {\n    applyCalibrationProfile(doc);\n    sendAck(client);\n  } else if (!strcmp(type, \"cmd_calibration_servos\") ||\n             !strcmp(type, \"cmd_calibration_sensors\") ||\n             !strcmp(type, \"cmd_calibration_mapping\")) {\n    applyCalibrationProfile(doc);\n    sendAck(client);\n  }\n}\n\nvoid wsEvent(uint8_t num, WStype_t type, uint8_t* payload, size_t len) {\n  switch (type) {\n    case WStype_CONNECTED:\n      Serial.printf(\"[WS] Client %u connected from %s\\n\", num, ws.remoteIP(num).toString().c_str());\n      sendAck(num);\n      break;\n    case WStype_DISCONNECTED:\n      Serial.printf(\"[WS] Client %u disconnected\\n\", num);\n      break;\n    case WStype_TEXT:\n      processCmd(String((char*)payload, len), num);\n      break;\n    default:\n      break;\n  }\n}\n\nvoid connectWifi() {\n  WiFi.mode(WIFI_STA);\n  WiFi.setSleep(false);\n  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);\n  Serial.printf(\"[WiFi] Connecting to %s\", WIFI_SSID);\n  for (int i = 0; i < 60 && WiFi.status() != WL_CONNECTED; i++) {\n    delay(500);\n    Serial.print(\".\");\n  }\n  Serial.println();\n  if (WiFi.status() == WL_CONNECTED) {\n    Serial.printf(\"[WiFi] IP: %s\\n\", WiFi.localIP().toString().c_str());\n  } else {\n    Serial.println(\"[WiFi] Not connected. Check credentials.\");\n  }\n}\n\nvoid setupI2CAndHardware() {\n  Wire.begin(PIN_SDA, PIN_SCL);\n  Wire.setClock(400000);\n\n  pca.begin();\n  pca.setOscillatorFrequency(27000000);\n  pca.setPWMFreq(PWM_FREQ);\n  delay(10);\n\n  for (int i = 0; i < N_SERVOS; i++) {\n    currentDeg[i] = servoCfg[i].homeDeg;\n    targetDeg[i] = servoCfg[i].homeDeg;\n    writeServo(i, currentDeg[i]);\n    delay(40);\n  }\n\n  bool imuOk = true;\n  for (int i = 0; i < NUM_IMUS; i++) {\n    tcaSel(i);\n    delay(10);\n    imu[i].initialize();\n    imu[i].setFullScaleAccelRange(MPU6050_ACCEL_FS_2);\n    imu[i].setFullScaleGyroRange(MPU6050_GYRO_FS_250);\n    imu[i].setDLPFMode(MPU6050_DLPF_BW_42);\n    bool ok = imu[i].testConnection();\n    Serial.printf(\"[IMU] bus %d: %s\\n\", i, ok ? \"OK\" : \"FAIL\");\n    if (!ok) imuOk = false;\n  }\n  tcaOff();\n  if (!imuOk) Serial.println(\"[IMU] Warning: at least one MPU6050 did not respond.\");\n\n  analogReadResolution(12);\n  analogSetAttenuation(ADC_11db);\n  flexEma[0] = readFlexRaw(0);\n  flexEma[1] = readFlexRaw(1);\n}\n\nvoid setup() {\n  Serial.begin(115200);\n  delay(400);\n  Serial.println(\"\\nV.E.S.T.A. ESP32-S3 controller v3.0\");\n\n  pinMode(PIN_ESTOP, INPUT_PULLUP);\n  loadPrefs();\n  setupI2CAndHardware();\n  connectWifi();\n\n  if (MDNS.begin(MDNS_HOST)) {\n    MDNS.addService(\"vesta\", \"tcp\", WS_PORT);\n    MDNS.addService(\"ws\", \"tcp\", WS_PORT);\n    Serial.printf(\"[mDNS] %s.local\\n\", MDNS_HOST);\n  }\n\n  ws.begin();\n  ws.onEvent(wsEvent);\n  Serial.printf(\"[WS] Server on port %d\\n\", WS_PORT);\n}\n\nvoid loop() {\n  ws.loop();\n  MDNS.update();\n\n  bool buttonPressed = digitalRead(PIN_ESTOP) == LOW;\n  if (buttonPressed && !estopLatched) {\n    estopLatched = true;\n    setEmergency(true, \"physical button\");\n  } else if (!buttonPressed && estopLatched) {\n    estopLatched = false;\n  }\n\n  if (camOnline && millis() - lastCamMs > CAM_TIMEOUT_MS) camOnline = false;\n\n  unsigned long now = millis();\n  if (now - tCtrl >= CTRL_MS) {\n    tCtrl = now;\n    readAllSensors();\n    updateTargetsFromSensors();\n    updateServos();\n  }\n\n  if (now - tSend >= SEND_MS) {\n    tSend = now;\n    sendData();\n  }\n}\n",
    cam: "/*\n * V.E.S.T.A. ESP32-CAM assistant firmware\n *\n * What it does:\n * - Serves MJPEG camera stream for the app and technician page.\n * - Streams I2S microphone audio to the app over WebSocket as PCM16 mono.\n * - Connects to the ESP32-S3 controller and reports camera/microphone status.\n *\n * Libraries:\n * - ArduinoJson by Benoit Blanchon\n * - WebSockets by Markus Sattler\n * - ESP32 board package with esp_camera\n */\n\n#include \"esp32_cam_config.h\"\n#include \"esp_camera.h\"\n#include <WiFi.h>\n#include <WebServer.h>\n#include <ESPmDNS.h>\n#include <ArduinoJson.h>\n#include <WebSocketsServer.h>\n#include <WebSocketsClient.h>\n#include \"driver/i2s.h\"\n\n#ifndef I2S_COMM_FORMAT_STAND_I2S\n#define I2S_COMM_FORMAT_STAND_I2S I2S_COMM_FORMAT_I2S\n#endif\n\nWebServer http(HTTP_PORT);\nWebSocketsServer appWs(APP_WS_PORT);\nWebSocketsClient s3Ws;\n\nbool cameraReady = false;\nbool micReady = false;\nbool audioStreaming = AUDIO_STREAM_DEFAULT;\nbool s3Connected = false;\nuint8_t appClientCount = 0;\n\nunsigned long tStatus = 0;\nunsigned long framesSent = 0;\nunsigned long audioFramesSent = 0;\nint lastAudioPeak = 0;\n\nstatic const char* STREAM_BOUNDARY = \"123456789000000000000987654321\";\n\nvoid sendS3Json(JsonDocument& doc) {\n  if (!s3Connected) return;\n  String out;\n  serializeJson(doc, out);\n  s3Ws.sendTXT(out);\n}\n\nvoid broadcastAppJson(JsonDocument& doc) {\n  String out;\n  serializeJson(doc, out);\n  appWs.broadcastTXT(out);\n}\n\nvoid sendStatus() {\n  JsonDocument doc;\n  doc[\"type\"] = \"cam_status\";\n  doc[\"t\"] = millis();\n  doc[\"role\"] = \"camera\";\n  doc[\"fw\"] = \"VESTA-CAM-1.0\";\n  doc[\"cameraReady\"] = cameraReady;\n  doc[\"micReady\"] = micReady;\n  doc[\"audioStreaming\"] = audioStreaming;\n  doc[\"frames\"] = framesSent;\n  doc[\"audioFrames\"] = audioFramesSent;\n  doc[\"audioPeak\"] = lastAudioPeak;\n  doc[\"ip\"] = WiFi.localIP().toString();\n  sendS3Json(doc);\n  broadcastAppJson(doc);\n}\n\nbool setupCamera() {\n  camera_config_t config;\n  config.ledc_channel = LEDC_CHANNEL_0;\n  config.ledc_timer = LEDC_TIMER_0;\n  config.pin_d0 = CAM_PIN_D0;\n  config.pin_d1 = CAM_PIN_D1;\n  config.pin_d2 = CAM_PIN_D2;\n  config.pin_d3 = CAM_PIN_D3;\n  config.pin_d4 = CAM_PIN_D4;\n  config.pin_d5 = CAM_PIN_D5;\n  config.pin_d6 = CAM_PIN_D6;\n  config.pin_d7 = CAM_PIN_D7;\n  config.pin_xclk = CAM_PIN_XCLK;\n  config.pin_pclk = CAM_PIN_PCLK;\n  config.pin_vsync = CAM_PIN_VSYNC;\n  config.pin_href = CAM_PIN_HREF;\n  config.pin_sccb_sda = CAM_PIN_SIOD;\n  config.pin_sccb_scl = CAM_PIN_SIOC;\n  config.pin_pwdn = CAM_PIN_PWDN;\n  config.pin_reset = CAM_PIN_RESET;\n  config.xclk_freq_hz = 20000000;\n  config.pixel_format = PIXFORMAT_JPEG;\n  config.frame_size = CAMERA_FRAME_SIZE;\n  config.jpeg_quality = CAMERA_JPEG_QUALITY;\n  config.fb_count = psramFound() ? CAMERA_FB_COUNT : 1;\n  config.fb_location = psramFound() ? CAMERA_FB_IN_PSRAM : CAMERA_FB_IN_DRAM;\n  config.grab_mode = CAMERA_GRAB_LATEST;\n\n  esp_err_t err = esp_camera_init(&config);\n  if (err != ESP_OK) {\n    Serial.printf(\"[CAM] init failed: 0x%x\\n\", err);\n    return false;\n  }\n\n  sensor_t* s = esp_camera_sensor_get();\n  if (s) {\n    s->set_brightness(s, 0);\n    s->set_contrast(s, 1);\n    s->set_saturation(s, 0);\n    s->set_whitebal(s, 1);\n    s->set_gain_ctrl(s, 1);\n    s->set_exposure_ctrl(s, 1);\n  }\n  return true;\n}\n\nbool setupMic() {\n  i2s_config_t i2sConfig = {\n    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),\n    .sample_rate = MIC_SAMPLE_RATE,\n    .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT,\n    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,\n    .communication_format = I2S_COMM_FORMAT_STAND_I2S,\n    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,\n    .dma_buf_count = 4,\n    .dma_buf_len = MIC_CHUNK_SAMPLES,\n    .use_apll = false,\n    .tx_desc_auto_clear = false,\n    .fixed_mclk = 0\n  };\n\n  i2s_pin_config_t pinConfig = {\n    .bck_io_num = MIC_I2S_BCLK,\n    .ws_io_num = MIC_I2S_WS,\n    .data_out_num = I2S_PIN_NO_CHANGE,\n    .data_in_num = MIC_I2S_DIN\n  };\n\n  esp_err_t err = i2s_driver_install(I2S_NUM_0, &i2sConfig, 0, NULL);\n  if (err != ESP_OK) {\n    Serial.printf(\"[MIC] driver install failed: 0x%x\\n\", err);\n    return false;\n  }\n\n  err = i2s_set_pin(I2S_NUM_0, &pinConfig);\n  if (err != ESP_OK) {\n    Serial.printf(\"[MIC] set pin failed: 0x%x\\n\", err);\n    return false;\n  }\n\n  i2s_zero_dma_buffer(I2S_NUM_0);\n  return true;\n}\n\nvoid handleRoot() {\n  String body;\n  body += \"V.E.S.T.A ESP32-CAM\\n\";\n  body += \"Stream: /stream\\n\";\n  body += \"Capture: /capture\\n\";\n  body += \"Status: /status\\n\";\n  body += \"App WebSocket: ws://\";\n  body += WiFi.localIP().toString();\n  body += \":\";\n  body += String(APP_WS_PORT);\n  body += \"\\n\";\n  http.send(200, \"text/plain\", body);\n}\n\nvoid handleStatusHttp() {\n  JsonDocument doc;\n  doc[\"type\"] = \"cam_status\";\n  doc[\"cameraReady\"] = cameraReady;\n  doc[\"micReady\"] = micReady;\n  doc[\"audioStreaming\"] = audioStreaming;\n  doc[\"s3Connected\"] = s3Connected;\n  doc[\"frames\"] = framesSent;\n  doc[\"audioFrames\"] = audioFramesSent;\n  doc[\"audioPeak\"] = lastAudioPeak;\n  doc[\"ip\"] = WiFi.localIP().toString();\n  String out;\n  serializeJson(doc, out);\n  http.send(200, \"application/json\", out);\n}\n\nvoid handleCapture() {\n  if (!cameraReady) {\n    http.send(503, \"text/plain\", \"Camera not ready\");\n    return;\n  }\n  camera_fb_t* fb = esp_camera_fb_get();\n  if (!fb) {\n    http.send(500, \"text/plain\", \"Capture failed\");\n    return;\n  }\n  WiFiClient client = http.client();\n  client.print(\"HTTP/1.1 200 OK\\r\\n\");\n  client.print(\"Access-Control-Allow-Origin: *\\r\\n\");\n  client.print(\"Content-Type: image/jpeg\\r\\n\");\n  client.printf(\"Content-Length: %u\\r\\n\", fb->len);\n  client.print(\"Content-Disposition: inline; filename=capture.jpg\\r\\n\\r\\n\");\n  client.write(fb->buf, fb->len);\n  esp_camera_fb_return(fb);\n}\n\nvoid handleStream() {\n  if (!cameraReady) {\n    http.send(503, \"text/plain\", \"Camera not ready\");\n    return;\n  }\n\n  WiFiClient client = http.client();\n  String header = \"HTTP/1.1 200 OK\\r\\n\";\n  header += \"Access-Control-Allow-Origin: *\\r\\n\";\n  header += \"Cache-Control: no-cache\\r\\n\";\n  header += \"Content-Type: multipart/x-mixed-replace; boundary=\";\n  header += STREAM_BOUNDARY;\n  header += \"\\r\\n\\r\\n\";\n  client.print(header);\n\n  while (client.connected()) {\n    camera_fb_t* fb = esp_camera_fb_get();\n    if (!fb) break;\n\n    client.printf(\"--%s\\r\\n\", STREAM_BOUNDARY);\n    client.printf(\"Content-Type: image/jpeg\\r\\n\");\n    client.printf(\"Content-Length: %u\\r\\n\\r\\n\", fb->len);\n    client.write(fb->buf, fb->len);\n    client.print(\"\\r\\n\");\n    framesSent++;\n    esp_camera_fb_return(fb);\n\n    if (!client.connected()) break;\n    delay(40);\n  }\n}\n\nvoid appWsEvent(uint8_t num, WStype_t type, uint8_t* payload, size_t len) {\n  switch (type) {\n    case WStype_CONNECTED: {\n      appClientCount++;\n      Serial.printf(\"[APP-WS] client %u connected\\n\", num);\n      sendStatus();\n      break;\n    }\n    case WStype_DISCONNECTED:\n      if (appClientCount > 0) appClientCount--;\n      Serial.printf(\"[APP-WS] client %u disconnected\\n\", num);\n      break;\n    case WStype_TEXT: {\n      JsonDocument doc;\n      if (deserializeJson(doc, payload, len)) return;\n      const char* cmd = doc[\"type\"] | \"\";\n      if (!strcmp(cmd, \"mic_start\")) {\n        audioStreaming = micReady;\n      } else if (!strcmp(cmd, \"mic_stop\")) {\n        audioStreaming = false;\n      } else if (!strcmp(cmd, \"cam_status\")) {\n        sendStatus();\n      } else if (!strcmp(cmd, \"assistant_prompt\")) {\n        JsonDocument bridge;\n        bridge[\"type\"] = \"audio_event\";\n        bridge[\"event\"] = \"assistant_prompt\";\n        bridge[\"text\"] = doc[\"text\"] | \"\";\n        sendS3Json(bridge);\n      }\n      sendStatus();\n      break;\n    }\n    default:\n      break;\n  }\n}\n\nvoid s3WsEvent(WStype_t type, uint8_t* payload, size_t len) {\n  switch (type) {\n    case WStype_CONNECTED: {\n      s3Connected = true;\n      Serial.println(\"[S3] connected\");\n      JsonDocument hello;\n      hello[\"type\"] = \"cam_hello\";\n      hello[\"fw\"] = \"VESTA-CAM-1.0\";\n      hello[\"stream\"] = String(\"http://\") + WiFi.localIP().toString() + \"/stream\";\n      hello[\"appWs\"] = String(\"ws://\") + WiFi.localIP().toString() + \":\" + String(APP_WS_PORT);\n      sendS3Json(hello);\n      break;\n    }\n    case WStype_DISCONNECTED:\n      s3Connected = false;\n      Serial.println(\"[S3] disconnected\");\n      break;\n    case WStype_TEXT:\n      Serial.printf(\"[S3] %.*s\\n\", (int)len, (char*)payload);\n      break;\n    default:\n      break;\n  }\n}\n\nvoid readAndStreamAudio() {\n  if (!micReady) return;\n\n  static int32_t raw[MIC_CHUNK_SAMPLES];\n  static int16_t pcm[MIC_CHUNK_SAMPLES];\n  size_t bytesRead = 0;\n  esp_err_t err = i2s_read(I2S_NUM_0, raw, sizeof(raw), &bytesRead, 0);\n  if (err != ESP_OK || bytesRead == 0) return;\n\n  int samples = bytesRead / sizeof(int32_t);\n  int peak = 0;\n  for (int i = 0; i < samples; i++) {\n    int32_t sample = raw[i] >> 14;\n    sample = constrain(sample, -32768, 32767);\n    pcm[i] = (int16_t)sample;\n    int a = abs((int)pcm[i]);\n    if (a > peak) peak = a;\n  }\n  lastAudioPeak = peak;\n\n  if (audioStreaming && appClientCount > 0) {\n    appWs.broadcastBIN((uint8_t*)pcm, samples * sizeof(int16_t));\n    audioFramesSent++;\n  }\n}\n\nvoid setupHttp() {\n  http.on(\"/\", HTTP_GET, handleRoot);\n  http.on(\"/status\", HTTP_GET, handleStatusHttp);\n  http.on(\"/capture\", HTTP_GET, handleCapture);\n  http.on(\"/stream\", HTTP_GET, handleStream);\n  http.begin();\n  Serial.printf(\"[HTTP] port %d\\n\", HTTP_PORT);\n}\n\nvoid connectWifi() {\n  WiFi.mode(WIFI_STA);\n  WiFi.setSleep(false);\n  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);\n  Serial.printf(\"[WiFi] Connecting to %s\", WIFI_SSID);\n  for (int i = 0; i < 60 && WiFi.status() != WL_CONNECTED; i++) {\n    delay(500);\n    Serial.print(\".\");\n  }\n  Serial.println();\n  if (WiFi.status() == WL_CONNECTED) {\n    Serial.printf(\"[WiFi] IP: %s\\n\", WiFi.localIP().toString().c_str());\n  } else {\n    Serial.println(\"[WiFi] Not connected. Check credentials.\");\n  }\n}\n\nvoid setup() {\n  Serial.begin(115200);\n  delay(400);\n  Serial.println(\"\\nV.E.S.T.A. ESP32-CAM assistant v1.0\");\n\n  connectWifi();\n  cameraReady = setupCamera();\n  micReady = setupMic();\n\n  if (MDNS.begin(MDNS_HOST)) {\n    MDNS.addService(\"http\", \"tcp\", HTTP_PORT);\n    MDNS.addService(\"ws\", \"tcp\", APP_WS_PORT);\n    Serial.printf(\"[mDNS] %s.local\\n\", MDNS_HOST);\n  }\n\n  setupHttp();\n  appWs.begin();\n  appWs.onEvent(appWsEvent);\n  Serial.printf(\"[APP-WS] port %d\\n\", APP_WS_PORT);\n\n  s3Ws.begin(S3_HOST, S3_WS_PORT, \"/\");\n  s3Ws.onEvent(s3WsEvent);\n  s3Ws.setReconnectInterval(3000);\n  s3Ws.enableHeartbeat(15000, 3000, 2);\n\n  sendStatus();\n}\n\nvoid loop() {\n  http.handleClient();\n  appWs.loop();\n  s3Ws.loop();\n  MDNS.update();\n\n  readAndStreamAudio();\n\n  if (millis() - tStatus > 1000) {\n    tStatus = millis();\n    sendStatus();\n  }\n}\n"
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const SERVO_DEFAULTS = [
    {
      id: 0,
      key: "leftLateral",
      channel: 0,
      label: "Hombro izq lateral",
      short: "L.LAT",
      side: "left",
      movement: "Levantar a los lados",
      sensorKey: "imuLeftLateral",
      sensorLabel: "MPU TCA0",
      minAngle: 0,
      maxAngle: 90,
      homeAngle: 0,
      direction: 1,
      pwmAt0: 102,
      pwmAt270: 512,
      mechanicalOffset: 0,
      testAngle: 0,
      liveAngle: 0,
      liveSensor: 0,
      moving: false
    },
    {
      id: 1,
      key: "leftFrontal",
      channel: 1,
      label: "Hombro izq frontal",
      short: "L.FRO",
      side: "left",
      movement: "Levantar al frente",
      sensorKey: "imuLeftFrontal",
      sensorLabel: "MPU TCA1",
      minAngle: 0,
      maxAngle: 120,
      homeAngle: 0,
      direction: 1,
      pwmAt0: 102,
      pwmAt270: 512,
      mechanicalOffset: 0,
      testAngle: 0,
      liveAngle: 0,
      liveSensor: 0,
      moving: false
    },
    {
      id: 2,
      key: "leftElbow",
      channel: 2,
      label: "Codo izquierdo",
      short: "L.ELB",
      side: "left",
      movement: "Flexion de codo",
      sensorKey: "flexLeftElbow",
      sensorLabel: "Flex GPIO34",
      minAngle: 0,
      maxAngle: 90,
      homeAngle: 0,
      direction: 1,
      pwmAt0: 102,
      pwmAt270: 512,
      mechanicalOffset: 0,
      testAngle: 0,
      liveAngle: 0,
      liveSensor: 0,
      moving: false
    },
    {
      id: 3,
      key: "rightLateral",
      channel: 3,
      label: "Hombro der lateral",
      short: "R.LAT",
      side: "right",
      movement: "Levantar a los lados",
      sensorKey: "imuRightLateral",
      sensorLabel: "MPU TCA2",
      minAngle: 0,
      maxAngle: 90,
      homeAngle: 0,
      direction: 1,
      pwmAt0: 102,
      pwmAt270: 512,
      mechanicalOffset: 0,
      testAngle: 0,
      liveAngle: 0,
      liveSensor: 0,
      moving: false
    },
    {
      id: 4,
      key: "rightFrontal",
      channel: 4,
      label: "Hombro der frontal",
      short: "R.FRO",
      side: "right",
      movement: "Levantar al frente",
      sensorKey: "imuRightFrontal",
      sensorLabel: "MPU TCA3",
      minAngle: 0,
      maxAngle: 120,
      homeAngle: 0,
      direction: 1,
      pwmAt0: 102,
      pwmAt270: 512,
      mechanicalOffset: 0,
      testAngle: 0,
      liveAngle: 0,
      liveSensor: 0,
      moving: false
    },
    {
      id: 5,
      key: "rightElbow",
      channel: 5,
      label: "Codo derecho",
      short: "R.ELB",
      side: "right",
      movement: "Flexion de codo",
      sensorKey: "flexRightElbow",
      sensorLabel: "Flex GPIO35",
      minAngle: 0,
      maxAngle: 90,
      homeAngle: 0,
      direction: 1,
      pwmAt0: 102,
      pwmAt270: 512,
      mechanicalOffset: 0,
      testAngle: 0,
      liveAngle: 0,
      liveSensor: 0,
      moving: false
    }
  ];

  const IMU_DEFAULTS = [
    {
      key: "imuLeftLateral",
      bus: 0,
      servoId: 0,
      label: "Hombro izq lateral",
      axis: "GY",
      plane: "YZ",
      neutralDeg: 0,
      minDeg: 0,
      maxDeg: 90,
      invert: false,
      liveDeg: 0
    },
    {
      key: "imuLeftFrontal",
      bus: 1,
      servoId: 1,
      label: "Hombro izq frontal",
      axis: "GX",
      plane: "XZ",
      neutralDeg: 0,
      minDeg: 0,
      maxDeg: 120,
      invert: false,
      liveDeg: 0
    },
    {
      key: "imuRightLateral",
      bus: 2,
      servoId: 3,
      label: "Hombro der lateral",
      axis: "GY",
      plane: "YZ",
      neutralDeg: 0,
      minDeg: 0,
      maxDeg: 90,
      invert: false,
      liveDeg: 0
    },
    {
      key: "imuRightFrontal",
      bus: 3,
      servoId: 4,
      label: "Hombro der frontal",
      axis: "GX",
      plane: "XZ",
      neutralDeg: 0,
      minDeg: 0,
      maxDeg: 120,
      invert: false,
      liveDeg: 0
    }
  ];

  const FLEX_DEFAULTS = [
    {
      key: "flexLeftElbow",
      pin: 34,
      servoId: 2,
      label: "Codo izquierdo",
      adc0: 2162,
      adc90: 1705,
      neutralDeg: 0,
      invert: false,
      liveRaw: 2162,
      liveDeg: 0
    },
    {
      key: "flexRightElbow",
      pin: 35,
      servoId: 5,
      label: "Codo derecho",
      adc0: 2162,
      adc90: 1705,
      neutralDeg: 0,
      invert: false,
      liveRaw: 2162,
      liveDeg: 0
    }
  ];

  const HARDWARE_CHECKS = [
    { key: "controller", label: "ESP32-S3 N16R8", detail: "Control" },
    { key: "camera", label: "ESP32-CAM", detail: "Vision" },
    { key: "pca9685", label: "PCA9685 0x40", detail: "Servos" },
    { key: "tca9548a", label: "TCA9548A 0x70", detail: "IMU" },
    { key: "imu0", label: "MPU6050 TCA0", detail: "L.LAT" },
    { key: "imu1", label: "MPU6050 TCA1", detail: "L.FRO" },
    { key: "imu2", label: "MPU6050 TCA2", detail: "R.LAT" },
    { key: "imu3", label: "MPU6050 TCA3", detail: "R.FRO" },
    { key: "flexL", label: "Flex 4.5 in GPIO34", detail: "L.ELB" },
    { key: "flexR", label: "Flex 4.5 in GPIO35", detail: "R.ELB" },
    { key: "servoL", label: "3 servos lado izq", detail: "0-2" },
    { key: "servoR", label: "3 servos lado der", detail: "3-5" },
    { key: "battery", label: "Bateria y tierra comun", detail: "Poder" }
  ];

  const BOM = [
    { key: "esp32s3",   label: "ESP32-S3 N16R8 (antena externa)",        detail: "x1 - controlador principal" },
    { key: "esp32cam",  label: "ESP32-CAM con OV2640",                   detail: "x1 - vision auxiliar" },
    { key: "pca9685",   label: "PCA9685 (16 canales PWM)",               detail: "x1 - driver de servos en 0x40" },
    { key: "tca9548a",  label: "TCA9548A (mux I2C)",                     detail: "x1 - aisla los 4 MPU6050 en 0x70" },
    { key: "mpu6050",   label: "MPU6050",                                detail: "x4 - hombros lat. y frontal de cada lado" },
    { key: "flex45",    label: "Flex sensor 4.5 in",                     detail: "x2 - codos izquierdo y derecho" },
    { key: "ds51150",   label: "Servo DS51150 150 kg/cm 270 deg",        detail: "x6 - tres por brazo" },
    { key: "estop",     label: "Boton de paro fisico",                   detail: "x1 - normalmente abierto, GPIO ESTOP" },
    { key: "bat",       label: "Bateria LiPo 3S y BMS",                  detail: "x1 - 11.1 V con proteccion" },
    { key: "buck",      label: "Convertidor 11.1 V -> 6 V para servos",  detail: "x1 - alta corriente, baja caida" },
    { key: "buck5",     label: "Convertidor 11.1 V -> 5 V para logica",  detail: "x1 - alimenta ESP32, PCA, TCA y MPUs" },
    { key: "cabling",   label: "Cableado Dupont y silicona AWG14",       detail: "Logica + corriente de servos" },
    { key: "frame",     label: "Estructura mecanica (correas, soportes)",detail: "Lo necesario para sujetar al usuario" }
  ];

  const BUILD_STEPS = [
    {
      key: "step-frame",
      title: "Estructura mecanica del exoesqueleto",
      detail: "Monta hombros, codos y arnes. Verifica que cada articulacion gire libremente dentro del rango util (0-90 lateral, 0-120 frontal, 0-90 codo)."
    },
    {
      key: "step-servos",
      title: "Servos DS51150 montados (6 en total)",
      detail: "Tres por brazo: lateral de hombro, frontal de hombro y codo. Atornilla a la estructura sin tensar el eje. Marca con cinta el extremo donde el angulo es minimo."
    },
    {
      key: "step-imus",
      title: "MPU6050 alineados (4 en total)",
      detail: "Hombro izq lateral, hombro izq frontal, hombro der lateral, hombro der frontal. El eje Z apunta perpendicular a la articulacion. Conectalos al TCA9548A en buses 0,1,2,3."
    },
    {
      key: "step-flex",
      title: "Flex sensors instalados en codos",
      detail: "El flex pegado a la cara externa del codo, con divisor pull-down 10 kohm a GND. Codo izq -> GPIO34, codo der -> GPIO35."
    },
    {
      key: "step-pca",
      title: "PCA9685 cableado al ESP32-S3",
      detail: "SDA y SCL al I2C principal. V+ a la rama de 6 V (servos). Vcc logica a 3.3 V o 5 V segun version. GND comun con el ESP32."
    },
    {
      key: "step-tca",
      title: "TCA9548A cableado y MPUs en buses",
      detail: "SDA/SCL del TCA al ESP32. Cada MPU6050 a un bus distinto (0..3). Direccion 0x68 en todos. Vcc 3.3 V."
    },
    {
      key: "step-power",
      title: "Bus de potencia con tierra comun",
      detail: "Bateria 11.1 V -> buck 6 V (servos) y buck 5 V (logica). Conecta TODAS las tierras al mismo punto. Sin tierra comun los servos saturan o reinician el ESP32."
    },
    {
      key: "step-estop",
      title: "Boton de paro fisico",
      detail: "Boton normalmente abierto a GPIO ESTOP con pull-up interno. Al presionar, el firmware corta los pulsos PWM. Probar antes de la primera energizada con servos."
    },
    {
      key: "step-cam",
      title: "ESP32-CAM en su soporte",
      detail: "Montaje rigido apuntando al usuario. Misma red WiFi que el ESP32-S3. Cableado de alimentacion separado de la logica."
    },
    {
      key: "step-wifi",
      title: "Credenciales WiFi configuradas",
      detail: "Edita esp32_s3_config.h y esp32_cam_config.h con SSID y password de la red local. Subiras los firmwares en la siguiente fase."
    },
    {
      key: "step-visual",
      title: "Inspeccion visual final del armado",
      detail: "Tornillos al par correcto, cables sin tension, conectores asegurados, no hay corto a tierra accidental, batería desconectada antes del primer encendido controlado."
    }
  ];

  const TEST_DEFS = [
    {
      key: "ws-link",
      label: "Enlace WebSocket S3",
      detail: "Confirma que el ESP32-S3 responde con paquete sensors o ack."
    },
    {
      key: "ack-firmware",
      label: "ACK con firmware reportado",
      detail: "Solicita cmd_status y verifica que el ESP32 envia version y rol."
    },
    {
      key: "estop-clear",
      label: "Salida de estado de emergencia",
      detail: "Envia cmd_reset y confirma que el modo deja de ser emergency."
    },
    {
      key: "mode-manual",
      label: "Cambio a modo manual",
      detail: "Manda cmd_mode manual y espera que la telemetria refleje el cambio."
    },
    {
      key: "mode-assisted",
      label: "Cambio a modo asistido",
      detail: "Manda cmd_mode assisted y verifica modo en telemetria."
    },
    {
      key: "mode-auto",
      label: "Cambio a modo automatico",
      detail: "Manda cmd_mode automatic y verifica modo en telemetria."
    },
    {
      key: "servo-sweep-l-lat",
      label: "Sweep L.LAT (servo 0)",
      detail: "Manda home, max y home. Verifica respuesta en telemetria."
    },
    {
      key: "servo-sweep-l-fro",
      label: "Sweep L.FRO (servo 1)",
      detail: "Mismo procedimiento para el frontal izquierdo."
    },
    {
      key: "servo-sweep-l-elb",
      label: "Sweep L.ELB (servo 2)",
      detail: "Codo izquierdo: home, max, home."
    },
    {
      key: "servo-sweep-r-lat",
      label: "Sweep R.LAT (servo 3)",
      detail: "Hombro derecho lateral: home, max, home."
    },
    {
      key: "servo-sweep-r-fro",
      label: "Sweep R.FRO (servo 4)",
      detail: "Hombro derecho frontal: home, max, home."
    },
    {
      key: "servo-sweep-r-elb",
      label: "Sweep R.ELB (servo 5)",
      detail: "Codo derecho: home, max, home."
    },
    {
      key: "imu-live",
      label: "Lectura en vivo de los 4 MPU6050",
      detail: "Cada IMU debe reportar valor finito y dentro de su rango."
    },
    {
      key: "flex-live",
      label: "Lectura en vivo de los 2 flex",
      detail: "Cada flex debe entregar ADC dentro del rango calibrado."
    },
    {
      key: "estop-trigger",
      label: "Parada de emergencia remota",
      detail: "Envia cmd_stop y confirma que el modo es emergency."
    }
  ];

  let state = loadState();
  let ws = null;
  let demoTimer = null;
  let sessionStart = Date.now();
  let drawQueued = false;
  let lastPortsSignature = "";

  function defaultState() {
    return {
      schema: PROFILE_SCHEMA,
      connection: {
        s3Url: "ws://192.168.1.100:81",
        camUrl: "http://192.168.1.101:81/stream"
      },
      metadata: {
        serial: "",
        technician: "",
        client: "",
        firmware: "",
        notes: ""
      },
      hardwareChecks: Object.fromEntries(HARDWARE_CHECKS.map((item) => [item.key, false])),
      build: {
        bom: Object.fromEntries(BOM.map((item) => [item.key, false])),
        steps: Object.fromEntries(BUILD_STEPS.map((item) => [item.key, false]))
      },
      tests: Object.fromEntries(TEST_DEFS.map((item) => [item.key, { status: "idle", at: null, message: "" }])),
      testRuns: 0,
      lastTestRunAt: null,
      servos: SERVO_DEFAULTS.map((item) => ({ ...item })),
      imus: IMU_DEFAULTS.map((item) => ({ ...item })),
      flex: FLEX_DEFAULTS.map((item) => ({ ...item })),
      tuning: {
        assistLevel: 0.5,
        deadbandDeg: 2,
        smoothing: 0.25,
        maxSpeedDegSec: 90
      },
      firmware: {
        s3: {
          label: "ESP32-S3 N16R8",
          fqbn: "esp32:esp32:esp32s3",
          port: "",
          fileName: "",
          code: "",
          source: "bundled"
        },
        cam: {
          label: "ESP32-CAM",
          fqbn: "esp32:esp32:esp32cam",
          port: "",
          fileName: "",
          code: "",
          source: "bundled"
        }
      },
      telemetry: {
        mode: "assisted",
        emergency: false,
        battery: null,
        packets: 0,
        lastPacketAt: null
      },
      savedAt: null
    };
  }

  function loadState() {
    const fresh = defaultState();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return fresh;
      const saved = JSON.parse(raw);
      return hydrateState(fresh, saved);
    } catch (error) {
      console.warn(error);
      return fresh;
    }
  }

  function hydrateState(fresh, saved) {
    const byId = (list, id) => list.find((item) => item.id === id);
    const byKey = (list, key) => list.find((item) => item.key === key);

    const savedTests = saved.tests || {};
    const savedBuild = saved.build || {};
    return {
      ...fresh,
      connection: { ...fresh.connection, ...(saved.connection || {}) },
      metadata: { ...fresh.metadata, ...(saved.metadata || {}) },
      hardwareChecks: { ...fresh.hardwareChecks, ...(saved.hardwareChecks || {}) },
      build: {
        bom: { ...fresh.build.bom, ...(savedBuild.bom || {}) },
        steps: { ...fresh.build.steps, ...(savedBuild.steps || {}) }
      },
      tests: Object.fromEntries(TEST_DEFS.map((item) => {
        const previous = savedTests[item.key];
        const valid = previous && typeof previous === "object" && previous.status !== "run"
          ? previous
          : { status: "idle", at: null, message: "" };
        return [item.key, { ...fresh.tests[item.key], ...valid }];
      })),
      testRuns: typeof saved.testRuns === "number" ? saved.testRuns : 0,
      lastTestRunAt: saved.lastTestRunAt || null,
      servos: fresh.servos.map((item) => ({ ...item, ...(byId(saved.servos || [], item.id) || {}) })),
      imus: fresh.imus.map((item) => ({ ...item, ...(byKey(saved.imus || [], item.key) || {}) })),
      flex: fresh.flex.map((item) => ({ ...item, ...(byKey(saved.flex || [], item.key) || {}) })),
      tuning: { ...fresh.tuning, ...(saved.tuning || {}) },
      firmware: {
        s3: { ...fresh.firmware.s3, ...((saved.firmware || {}).s3 || {}) },
        cam: { ...fresh.firmware.cam, ...((saved.firmware || {}).cam || {}) }
      },
      savedAt: saved.savedAt || null
    };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function numberValue(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function round(value, decimals = 1) {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  }

  function formatDeg(value) {
    return `${round(value, 1)} deg`;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function setStatus(id, mode, value) {
    const node = $(id);
    if (!node) return;
    node.classList.remove("ok", "warn");
    if (mode) node.classList.add(mode);
    $("b", node).textContent = value;
    updateFooterSummary();
  }

  function log(message, type = "sys") {
    const logNode = $("#event-log");
    if (!logNode) return;
    const time = new Date().toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    const line = document.createElement("div");
    line.className = `log-line ${type}`;
    line.textContent = `[${time}] ${message}`;
    logNode.prepend(line);
    while (logNode.children.length > 120) logNode.lastChild.remove();
  }

  function serializeForStorage() {
    return {
      schema: state.schema,
      connection: state.connection,
      metadata: state.metadata,
      hardwareChecks: state.hardwareChecks,
      build: state.build,
      tests: state.tests,
      testRuns: state.testRuns,
      lastTestRunAt: state.lastTestRunAt,
      servos: state.servos.map(({ liveAngle, liveSensor, moving, ...servo }) => servo),
      imus: state.imus.map(({ liveDeg, ...imu }) => imu),
      flex: state.flex.map(({ liveRaw, liveDeg, ...flex }) => flex),
      tuning: state.tuning,
      firmware: state.firmware,
      savedAt: state.savedAt
    };
  }

  function saveLocal({ quiet = false } = {}) {
    state.savedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeForStorage()));
    setStatus("#profile-status", "ok", "Guardado");
    updateProfilePreview();
    if (!quiet) log("Calibracion guardada en este navegador", "ok");
  }

  function markDirty() {
    setStatus("#profile-status", "warn", "Cambios");
    updateProfilePreview();
  }

  function init() {
    bindNavigation();
    bindConnection();
    bindGlobalButtons();
    bindForms();
    renderHardwareChecks();
    renderBuild();
    renderTests();
    renderReadiness();
    renderServoTable();
    renderSensorCards();
    renderMapping();
    hydrateInputs();
    bindFirmware();
    loadBundledFirmware();
    refreshPorts({ silent: true });
    updateTuningLabels();
    updateProfilePreview();
    updateLive();
    updateFooterPanel($(".rail-btn.active"));
    updateFooterSummary();
    tickClock();
    setInterval(tickClock, 1000);
    setInterval(() => refreshPorts({ silent: true }), 3000);
    log("Herramienta de tecnico lista", "ok");
  }

  function hydrateInputs() {
    $("#s3-url").value = state.connection.s3Url;
    $("#cam-url").value = state.connection.camUrl;
    $("#exo-serial").value = state.metadata.serial;
    $("#tech-name").value = state.metadata.technician;
    $("#client-name").value = state.metadata.client;
    $("#firmware-version").value = state.metadata.firmware;
    $("#handoff-notes").value = state.metadata.notes;
    $("#assist-level").value = String(state.tuning.assistLevel);
    $("#deadband").value = String(state.tuning.deadbandDeg);
    $("#smoothing").value = String(state.tuning.smoothing);
    $("#max-speed").value = String(state.tuning.maxSpeedDegSec);
    ["s3", "cam"].forEach((device) => {
      $(`#fw-fqbn-${device}`).value = state.firmware[device].fqbn;
      $(`#fw-code-${device}`).value = state.firmware[device].code;
      setFirmwareBadge(
        device,
        state.firmware[device].code ? "warn" : "",
        state.firmware[device].code ? "Listo" : "Pendiente"
      );
    });
    if (state.savedAt) setStatus("#profile-status", "ok", "Guardado");
  }

  function bindNavigation() {
    $$(".rail-btn").forEach((button) => {
      button.addEventListener("click", () => {
        $$(".rail-btn").forEach((node) => node.classList.remove("active"));
        $$(".work-panel").forEach((node) => node.classList.remove("active"));
        button.classList.add("active");
        $(`#panel-${button.dataset.panel}`).classList.add("active");
        updateFooterPanel(button);
        queueDraw();
      });
    });
  }

  function updateFooterPanel(button) {
    const footerPanel = $("#footer-panel");
    if (!footerPanel || !button) return;
    const label = $("b", button)?.textContent || button.dataset.panel || "";
    footerPanel.textContent = label;
  }

  function bindConnection() {
    $("#btn-connect-s3").addEventListener("click", connectS3);
    $("#btn-disconnect-s3").addEventListener("click", disconnectS3);
    $("#btn-start-cam").addEventListener("click", startCamera);
    $("#btn-stop-cam").addEventListener("click", stopCamera);
    $("#s3-url").addEventListener("change", (event) => {
      state.connection.s3Url = event.target.value.trim();
      markDirty();
    });
    $("#cam-url").addEventListener("change", (event) => {
      state.connection.camUrl = event.target.value.trim();
      markDirty();
    });
  }

  function bindGlobalButtons() {
    $("#btn-stop").addEventListener("click", () => sendCommand({ type: "cmd_stop" }, "STOP"));
    $("#btn-reset").addEventListener("click", () => sendCommand({ type: "cmd_reset" }, "Reset"));
    $("#btn-status").addEventListener("click", () => sendCommand({ type: "cmd_status" }, "Estado"));
    $("#btn-manual-mode").addEventListener("click", () => sendCommand({ type: "cmd_mode", mode: "manual" }, "Modo manual"));
    $("#btn-home-all").addEventListener("click", sendHomes);
    $("#btn-calibrate-imu").addEventListener("click", () => sendCommand({ type: "cmd_calibrate" }, "Calibrar IMU"));
    $("#btn-capture-neutral").addEventListener("click", captureAllNeutral);
    $("#btn-test-map").addEventListener("click", sendMappedTargets);
    $("#btn-demo").addEventListener("click", toggleDemo);
    $("#btn-save-local").addEventListener("click", () => saveLocal());
    $("#btn-copy-profile").addEventListener("click", copyProfile);
    $("#btn-download-profile").addEventListener("click", downloadProfile);
    $("#btn-send-profile").addEventListener("click", sendFullProfile);
    $("#btn-send-servo-profile").addEventListener("click", sendServoProfile);
    $("#btn-send-sensor-profile").addEventListener("click", sendSensorProfile);
    $("#btn-send-map-profile").addEventListener("click", sendMapProfile);
    $("#btn-refresh-ports").addEventListener("click", refreshPorts);
    $("#btn-arduino-status").addEventListener("click", refreshArduinoStatus);

    $("#btn-build-reset").addEventListener("click", resetBuild);
    $("#btn-build-complete").addEventListener("click", markAllBuild);
    $("#btn-tests-reset").addEventListener("click", resetTests);
    $("#btn-tests-run-all").addEventListener("click", runAllTests);

    ["assist-level", "deadband", "smoothing", "max-speed"].forEach((id) => {
      $(`#${id}`).addEventListener("input", updateTuningFromControls);
    });
  }

  function bindFirmware() {
    ["s3", "cam"].forEach((device) => {
      $(`#fw-file-${device}`).addEventListener("change", (event) => readFirmwareFile(device, event));
      $(`#fw-fqbn-${device}`).addEventListener("input", (event) => {
        state.firmware[device].fqbn = event.target.value.trim();
        markDirty();
      });
      $(`#fw-port-${device}`).addEventListener("change", (event) => {
        state.firmware[device].port = event.target.value;
        markDirty();
      });
      $(`#fw-code-${device}`).addEventListener("input", (event) => {
        state.firmware[device].code = event.target.value;
        state.firmware[device].source = "manual";
        setFirmwareBadge(device, event.target.value.trim() ? "warn" : "", event.target.value.trim() ? "Listo" : "Pendiente");
        markDirty();
      });
    });

    $("#panel-firmware").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-fw-action]");
      if (!button) return;
      runFirmwareAction(button.dataset.device, button.dataset.fwAction);
    });
  }

  function setFirmwareBadge(device, mode, text) {
    const badge = $(`#fw-status-${device}`);
    if (!badge) return;
    badge.classList.remove("ok", "warn", "err");
    if (mode) badge.classList.add(mode);
    badge.textContent = text;
  }

  function setFirmwareOutput(text) {
    $("#fw-output").textContent = text || "";
    $("#fw-last-action").textContent = new Date().toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }

  function readFirmwareFile(device, event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      state.firmware[device].fileName = file.name;
      state.firmware[device].code = String(reader.result || "");
      state.firmware[device].source = "file";
      $(`#fw-code-${device}`).value = state.firmware[device].code;
      setFirmwareBadge(device, "warn", file.name);
      setFirmwareOutput(`${state.firmware[device].label}\nArchivo: ${file.name}\nTamano: ${file.size} bytes`);
      markDirty();
      log(`${state.firmware[device].label}: codigo cargado`, "ok");
    };
    reader.onerror = () => {
      setFirmwareBadge(device, "err", "Error");
      log(`${state.firmware[device].label}: no se pudo leer el archivo`, "err");
    };
    reader.readAsText(file);
  }

  async function loadBundledFirmware(options = {}) {
    const force = Boolean(options.force);
    const targetDevices = options.device ? [options.device] : Object.keys(FIRMWARE_FILES);
    const loaded = [];

    for (const device of targetDevices) {
      const firmware = FIRMWARE_FILES[device];
      const item = state.firmware[device];
      if (!firmware || !item) continue;
      if (item.code.trim() && !force && item.source !== "bundled") continue;

      let code = FIRMWARE_DEFAULT_CODE[device] || "";
      let source = "predeterminado";
      try {
        const response = await fetch(firmware.url, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        code = await response.text();
        source = "archivo local";
      } catch (error) {
        if (!code) {
          setFirmwareBadge(device, "err", "No cargado");
          log(`${item.label}: firmware local no disponible (${error.message})`, "err");
          continue;
        }
      }

      item.code = code;
      item.fileName = firmware.fileName;
      item.source = "bundled";
      const editor = $(`#fw-code-${device}`);
      if (editor) editor.value = item.code;
      setFirmwareBadge(device, "ok", "Predeterminado");
      loaded.push(`${item.label}: ${firmware.fileName} (${source})`);
    }

    if (loaded.length) {
      setFirmwareOutput(`Firmware predeterminado cargado en el editor\n${loaded.join("\n")}`);
      saveLocal({ quiet: true });
    }
  }

  async function refreshArduinoStatus() {
    try {
      $("#fw-cli-status").textContent = "Consultando";
      const data = await fetchJson("/api/arduino/status");
      $("#fw-cli-status").textContent = data.ok ? data.version : "No disponible";
      setFirmwareOutput(data.output || data.version || "Arduino CLI no disponible");
      log(data.ok ? "arduino-cli disponible" : "arduino-cli no disponible", data.ok ? "ok" : "err");
    } catch (error) {
      $("#fw-cli-status").textContent = "Error";
      setFirmwareOutput(error.message);
      log(`arduino-cli: ${error.message}`, "err");
    }
  }

  async function refreshPorts(options = {}) {
    const silent = Boolean(options.silent);
    try {
      const data = await fetchJson("/api/arduino/ports");
      const ports = data.ports || [];
      const signature = JSON.stringify(ports.map((port) => ({
        address: port.address || port.port || "",
        label: port.label || port.name || "",
        guess: port.guess || ""
      })));
      const changed = signature !== lastPortsSignature;
      lastPortsSignature = signature;
      populatePorts(ports);
      if (!silent || changed) {
        setFirmwareOutput(ports.length ? JSON.stringify(ports, null, 2) : "Sin puertos detectados");
        log(`Puertos detectados: ${ports.length}`, ports.length ? "ok" : "sys");
      }
    } catch (error) {
      if (!silent) setFirmwareOutput(error.message);
      log(`Puertos: ${error.message}`, "err");
    }
  }

  function populatePorts(ports) {
    ["s3", "cam"].forEach((device) => {
      const select = $(`#fw-port-${device}`);
      const current = state.firmware[device].port;
      const normalized = ports.map((port) => ({
        address: port.address || port.port || "",
        label: port.label || port.name || port.board || "Serial",
        board: port.board || "",
        guess: port.guess || ""
      })).filter((port) => port.address);
      const guessed = normalized.filter((port) => port.guess === device);
      const detected = current && normalized.some((port) => port.address === current)
        ? current
        : guessed.length === 1
          ? guessed[0].address
          : "";

      select.innerHTML = `<option value="">Seleccionar</option>${ports.map((port) => {
        const address = port.address || port.port || "";
        const guess = port.guess === "s3" ? "S3" : port.guess === "cam" ? "CAM" : "";
        const label = [address, port.label || port.name || port.board, guess].filter(Boolean).join(" - ");
        return `<option value="${escapeHtml(address)}">${escapeHtml(label)}</option>`;
      }).join("")}`;
      if (detected) {
        select.value = detected;
        state.firmware[device].port = detected;
        setFirmwareBadge(device, "ok", detected);
      }
    });
  }

  async function runFirmwareAction(device, action) {
    const item = state.firmware[device];
    if (!item) return;

    if (action === "bundled") {
      loadBundledFirmware({ force: true, device });
      return;
    }

    if (action === "clear") {
      item.code = "";
      item.fileName = "";
      item.source = "";
      $(`#fw-code-${device}`).value = "";
      $(`#fw-file-${device}`).value = "";
      setFirmwareBadge(device, "", "Pendiente");
      setFirmwareOutput(`${item.label}\nEditor limpio`);
      markDirty();
      return;
    }

    item.fqbn = $(`#fw-fqbn-${device}`).value.trim();
    item.port = $(`#fw-port-${device}`).value;
    item.code = $(`#fw-code-${device}`).value;

    if (!item.code.trim() && !FIRMWARE_FILES[device]) {
      setFirmwareBadge(device, "err", "Sin codigo");
      log(`${item.label}: falta codigo`, "err");
      return;
    }
    if (!item.fqbn) {
      setFirmwareBadge(device, "err", "Sin FQBN");
      log(`${item.label}: falta FQBN`, "err");
      return;
    }
    if (action === "upload" && !item.port) {
      setFirmwareBadge(device, "err", "Sin puerto");
      log(`${item.label}: selecciona puerto`, "err");
      return;
    }

    const label = action === "upload" ? "Subiendo" : "Verificando";
    setFirmwareBadge(device, "warn", label);
    setFirmwareOutput(`${item.label}\n${label}...`);

    try {
      const data = await fetchJson("/api/arduino/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device,
          action,
          fqbn: item.fqbn,
          port: item.port,
          code: item.code
        })
      });
      setFirmwareBadge(device, data.ok ? "ok" : "err", data.ok ? "OK" : "Error");
      setFirmwareOutput(data.output || JSON.stringify(data, null, 2));
      log(`${item.label}: ${action === "upload" ? "subida" : "verificacion"} ${data.ok ? "OK" : "fallo"}`, data.ok ? "ok" : "err");
    } catch (error) {
      setFirmwareBadge(device, "err", "Error");
      setFirmwareOutput(error.message);
      log(`${item.label}: ${error.message}`, "err");
    }
    markDirty();
  }

  async function fetchJson(url, options) {
    const response = await fetch(url, options);
    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { ok: false, output: text };
    }
    if (!response.ok) {
      throw new Error(data.output || data.error || `HTTP ${response.status}`);
    }
    return data;
  }

  function bindForms() {
    const fields = [
      ["#exo-serial", "serial"],
      ["#tech-name", "technician"],
      ["#client-name", "client"],
      ["#firmware-version", "firmware"],
      ["#handoff-notes", "notes"]
    ];
    fields.forEach(([selector, key]) => {
      $(selector).addEventListener("input", (event) => {
        state.metadata[key] = event.target.value;
        markDirty();
      });
    });
  }

  function renderHardwareChecks() {
    const wrap = $("#hardware-checks");
    wrap.innerHTML = HARDWARE_CHECKS.map((item) => {
      const checked = state.hardwareChecks[item.key] ? "checked" : "";
      return `
        <label class="check-row">
          <input type="checkbox" data-check="${item.key}" ${checked}>
          <strong>${item.label}</strong>
          <small>${item.detail}</small>
        </label>
      `;
    }).join("");
    wrap.addEventListener("change", (event) => {
      const key = event.target.dataset.check;
      if (!key) return;
      state.hardwareChecks[key] = event.target.checked;
      updateCheckCount();
      markDirty();
    });
    updateCheckCount();
  }

  function updateCheckCount() {
    const total = HARDWARE_CHECKS.length;
    const done = HARDWARE_CHECKS.filter((item) => state.hardwareChecks[item.key]).length;
    $("#check-count").textContent = `${done}/${total}`;
  }

  /* ── Armado (build) panel ──────────────────────────────────────── */
  function renderBuild() {
    const bomList = $("#bom-list");
    bomList.innerHTML = BOM.map((item) => {
      const checked = state.build.bom[item.key] ? "checked" : "";
      return `
        <label class="check-row">
          <input type="checkbox" data-bom="${item.key}" ${checked}>
          <strong>${escapeHtml(item.label)}</strong>
          <small>${escapeHtml(item.detail)}</small>
        </label>
      `;
    }).join("");
    bomList.addEventListener("change", (event) => {
      const key = event.target.dataset.bom;
      if (!key) return;
      state.build.bom[key] = event.target.checked;
      markDirty();
      renderReadiness();
      updateBuildCounts();
    });

    const stepsList = $("#build-steps");
    stepsList.innerHTML = BUILD_STEPS.map((step) => {
      const checked = state.build.steps[step.key] ? "checked" : "";
      const done = state.build.steps[step.key] ? "done" : "";
      return `
        <li class="build-step ${done}" data-step="${step.key}">
          <input type="checkbox" data-step-input="${step.key}" ${checked}>
          <div>
            <strong>${escapeHtml(step.title)}</strong>
            <small>${escapeHtml(step.detail)}</small>
          </div>
        </li>
      `;
    }).join("");
    stepsList.addEventListener("change", (event) => {
      const key = event.target.dataset.stepInput;
      if (!key) return;
      state.build.steps[key] = event.target.checked;
      const li = stepsList.querySelector(`[data-step="${key}"]`);
      if (li) li.classList.toggle("done", event.target.checked);
      markDirty();
      renderReadiness();
      updateBuildCounts();
    });

    updateBuildCounts();
  }

  function updateBuildCounts() {
    const bomDone = BOM.filter((item) => state.build.bom[item.key]).length;
    const stepsDone = BUILD_STEPS.filter((item) => state.build.steps[item.key]).length;
    $("#bom-count").textContent = `${bomDone}/${BOM.length}`;
    $("#build-step-count").textContent = `${stepsDone}/${BUILD_STEPS.length}`;

    const summary = $("#armado-summary");
    if (!summary) return;
    const totalDone = bomDone + stepsDone;
    const totalAll = BOM.length + BUILD_STEPS.length;
    const ready = totalDone === totalAll;
    summary.classList.toggle("ok", ready);
    summary.classList.toggle("warn", !ready && totalDone > 0);
    summary.innerHTML = ready
      ? `<b>Armado completo.</b> Pasa a la fase Firmware.`
      : `Avance del armado: <b>${totalDone}/${totalAll}</b> elementos. Termina BOM y pasos antes de subir firmware.`;
  }

  function resetBuild() {
    BOM.forEach((item) => { state.build.bom[item.key] = false; });
    BUILD_STEPS.forEach((item) => { state.build.steps[item.key] = false; });
    renderBuild();
    renderReadiness();
    markDirty();
    log("Progreso de armado reiniciado", "sys");
  }

  function markAllBuild() {
    BOM.forEach((item) => { state.build.bom[item.key] = true; });
    BUILD_STEPS.forEach((item) => { state.build.steps[item.key] = true; });
    renderBuild();
    renderReadiness();
    markDirty();
    log("Armado marcado como completo", "ok");
  }

  /* ── Pruebas (tests) panel ─────────────────────────────────────── */
  function renderTests() {
    const list = $("#test-list");
    list.innerHTML = TEST_DEFS.map((item) => {
      const result = state.tests[item.key] || { status: "idle" };
      const klass = result.status === "pass" ? "pass"
                  : result.status === "fail" ? "fail"
                  : result.status === "run"  ? "run"
                  : "";
      const resultText = result.status === "pass" ? "PASA"
                       : result.status === "fail" ? "FALLA"
                       : result.status === "run"  ? "EN CURSO"
                       : "SIN CORRER";
      return `
        <div class="test-row ${klass}" data-test-row="${item.key}">
          <span class="dot-status"></span>
          <div class="test-meta">
            <strong>${escapeHtml(item.label)}</strong>
            <small>${escapeHtml(item.detail)}</small>
          </div>
          <span class="test-result" id="test-result-${item.key}">${resultText}</span>
          <button class="btn" data-test-key="${item.key}">Probar</button>
        </div>
      `;
    }).join("");
    list.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-test-key]");
      if (!button) return;
      runTest(button.dataset.testKey);
    });
    updateTestSummary();
  }

  function updateTestSummary() {
    const total = TEST_DEFS.length;
    const passed = TEST_DEFS.filter((item) => state.tests[item.key]?.status === "pass").length;
    const failed = TEST_DEFS.filter((item) => state.tests[item.key]?.status === "fail").length;
    $("#tests-summary").textContent = `${passed}/${total}${failed ? ` (${failed} fallan)` : ""}`;
    $("#tests-last-run").textContent = state.lastTestRunAt
      ? `Ultima corrida ${new Date(state.lastTestRunAt).toLocaleTimeString("es-MX")}`
      : "Sin ejecuciones";
    renderReadiness();
  }

  function setTestState(key, status, message = "") {
    const previous = state.tests[key] || {};
    state.tests[key] = {
      status,
      at: status === "idle" ? null : new Date().toISOString(),
      message: message || previous.message || ""
    };
    const row = $(`[data-test-row="${key}"]`);
    if (row) {
      row.classList.remove("pass", "fail", "run");
      if (status === "pass" || status === "fail" || status === "run") row.classList.add(status);
    }
    const result = $(`#test-result-${key}`);
    if (result) {
      result.textContent = status === "pass" ? "PASA"
                         : status === "fail" ? "FALLA"
                         : status === "run"  ? "EN CURSO"
                         : "SIN CORRER";
    }
    if (status !== "run") updateTestSummary();
  }

  function appendTestLog(line) {
    const node = $("#test-log");
    if (!node) return;
    const stamp = new Date().toLocaleTimeString("es-MX");
    node.textContent += `[${stamp}] ${line}\n`;
    node.scrollTop = node.scrollHeight;
  }

  function resetTests() {
    TEST_DEFS.forEach((item) => setTestState(item.key, "idle"));
    state.lastTestRunAt = null;
    $("#test-log").textContent = "";
    appendTestLog("Resultados borrados");
    markDirty();
    updateTestSummary();
  }

  async function runAllTests() {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      appendTestLog("ESP32-S3 offline. Conecta antes de correr la suite.");
      log("Suite cancelada: ESP32-S3 offline", "err");
      return;
    }
    state.testRuns += 1;
    state.lastTestRunAt = new Date().toISOString();
    appendTestLog(`Suite ${state.testRuns}: inicio`);
    for (const def of TEST_DEFS) {
      // eslint-disable-next-line no-await-in-loop
      await runTest(def.key, { silent: true });
    }
    appendTestLog(`Suite ${state.testRuns}: fin`);
    markDirty();
    updateTestSummary();
  }

  async function runTest(key, options = {}) {
    const def = TEST_DEFS.find((item) => item.key === key);
    if (!def) return;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setTestState(key, "fail", "ESP32-S3 offline");
      appendTestLog(`${def.label}: ESP32-S3 offline`);
      return;
    }
    setTestState(key, "run");
    appendTestLog(`${def.label}: ejecutando`);
    try {
      const detail = await executeTest(key);
      setTestState(key, "pass", detail);
      appendTestLog(`${def.label}: OK${detail ? ` (${detail})` : ""}`);
    } catch (error) {
      setTestState(key, "fail", error.message || String(error));
      appendTestLog(`${def.label}: FALLA — ${error.message || error}`);
    }
    if (!options.silent) {
      markDirty();
      updateTestSummary();
    }
  }

  function awaitPacket(predicate, { timeoutMs = 1500 } = {}) {
    return new Promise((resolve, reject) => {
      let resolved = false;
      const timer = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        document.removeEventListener("vesta-rx", listener);
        reject(new Error("timeout"));
      }, timeoutMs);
      const listener = (event) => {
        if (resolved) return;
        const packet = event.detail;
        if (!predicate(packet)) return;
        resolved = true;
        clearTimeout(timer);
        document.removeEventListener("vesta-rx", listener);
        resolve(packet);
      };
      document.addEventListener("vesta-rx", listener);
    });
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function executeTest(key) {
    if (key === "ws-link") {
      sendCommand({ type: "cmd_status" }, "Status");
      const pkt = await awaitPacket((p) => p && (p.type === "ack" || p.type === "sensors"), { timeoutMs: 1500 });
      return pkt.type;
    }
    if (key === "ack-firmware") {
      sendCommand({ type: "cmd_status" }, "Status");
      const pkt = await awaitPacket((p) => p && p.type === "ack", { timeoutMs: 1500 });
      if (!pkt.fw) throw new Error("ACK sin campo fw");
      return pkt.fw;
    }
    if (key === "estop-clear") {
      sendCommand({ type: "cmd_reset" }, "Reset");
      const pkt = await awaitPacket((p) => p && p.type === "sensors" && !p.emergency, { timeoutMs: 1800 });
      return `mode=${pkt.mode || "?"}`;
    }
    if (key === "mode-manual" || key === "mode-assisted" || key === "mode-auto") {
      const target = key === "mode-manual" ? "manual" : key === "mode-assisted" ? "assisted" : "automatic";
      sendCommand({ type: "cmd_mode", mode: target }, `Modo ${target}`);
      const pkt = await awaitPacket((p) => p && p.type === "sensors" && p.mode === target, { timeoutMs: 1800 });
      return `mode=${pkt.mode}`;
    }
    if (key.startsWith("servo-sweep-")) {
      const map = {
        "servo-sweep-l-lat": 0,
        "servo-sweep-l-fro": 1,
        "servo-sweep-l-elb": 2,
        "servo-sweep-r-lat": 3,
        "servo-sweep-r-fro": 4,
        "servo-sweep-r-elb": 5
      };
      const id = map[key];
      const servo = state.servos.find((item) => item.id === id);
      if (!servo) throw new Error(`servo ${id} ausente`);
      sendCommand({ type: "cmd_mode", mode: "manual" }, "Modo manual");
      sendAngle(servo.id, servo.homeAngle);
      await delay(220);
      sendAngle(servo.id, servo.maxAngle);
      const reachedMax = await awaitPacket((p) => {
        if (!p || p.type !== "sensors") return false;
        const live = (p.servos || []).find((s) => Number(s.id) === id);
        return live && Math.abs((live.target ?? live.angle ?? 0) - servo.maxAngle) < 2.5;
      }, { timeoutMs: 2000 }).catch(() => null);
      sendAngle(servo.id, servo.homeAngle);
      const reachedHome = await awaitPacket((p) => {
        if (!p || p.type !== "sensors") return false;
        const live = (p.servos || []).find((s) => Number(s.id) === id);
        return live && Math.abs((live.target ?? live.angle ?? 0) - servo.homeAngle) < 2.5;
      }, { timeoutMs: 2000 }).catch(() => null);
      if (!reachedMax && !reachedHome) throw new Error("sin respuesta de telemetria");
      return `home<->max ${formatDeg(servo.maxAngle)}`;
    }
    if (key === "imu-live") {
      const pkt = await awaitPacket((p) => p && p.type === "sensors" && Array.isArray(p.servos), { timeoutMs: 1800 });
      const expectedIds = state.imus.map((imu) => imu.servoId);
      const issues = [];
      for (const imu of state.imus) {
        const live = (pkt.servos || []).find((s) => Number(s.id) === imu.servoId);
        const sensor = Number(live?.sensor);
        if (!Number.isFinite(sensor)) issues.push(`${imu.label} sin valor`);
      }
      if (issues.length) throw new Error(issues.join(" | "));
      return `${expectedIds.length} IMUs activos`;
    }
    if (key === "flex-live") {
      const pkt = await awaitPacket((p) => p && p.type === "sensors" && Array.isArray(p.servos), { timeoutMs: 1800 });
      const issues = [];
      for (const flex of state.flex) {
        const live = (pkt.servos || []).find((s) => Number(s.id) === flex.servoId);
        const sensor = Number(live?.sensor);
        if (!Number.isFinite(sensor)) issues.push(`${flex.label} sin valor`);
      }
      if (issues.length) throw new Error(issues.join(" | "));
      return "2 flex activos";
    }
    if (key === "estop-trigger") {
      sendCommand({ type: "cmd_stop" }, "STOP");
      const pkt = await awaitPacket((p) => p && p.type === "sensors" && p.emergency, { timeoutMs: 1800 });
      // dejar el sistema en estado seguro despues
      sendCommand({ type: "cmd_reset" }, "Reset post-test");
      return `emergency=${pkt.emergency}`;
    }
    throw new Error("test no implementado");
  }

  /* ── Readiness gate (Entrega) ──────────────────────────────────── */
  function renderReadiness() {
    const wrap = $("#readiness-gate");
    if (!wrap) return;

    const bomDone = BOM.filter((item) => state.build.bom[item.key]).length;
    const stepsDone = BUILD_STEPS.filter((item) => state.build.steps[item.key]).length;
    const buildOk = bomDone === BOM.length && stepsDone === BUILD_STEPS.length;

    const fwS3 = Boolean(state.firmware?.s3?.code);
    const fwCam = Boolean(state.firmware?.cam?.code);
    const fwOk = fwS3 && fwCam;

    const hwDone = HARDWARE_CHECKS.filter((item) => state.hardwareChecks[item.key]).length;
    const hwOk = hwDone === HARDWARE_CHECKS.length;

    const servosOk = state.servos.every((servo) => servo.maxAngle > servo.minAngle && servo.pwmAt0 !== servo.pwmAt270);
    const sensorsOk = state.imus.every((imu) => imu.maxDeg > imu.minDeg) &&
      state.flex.every((flex) => flex.adc0 !== flex.adc90);

    const testsRun = TEST_DEFS.filter((item) => state.tests[item.key]?.status === "pass" || state.tests[item.key]?.status === "fail").length;
    const testsPass = TEST_DEFS.filter((item) => state.tests[item.key]?.status === "pass").length;
    const testsFail = TEST_DEFS.filter((item) => state.tests[item.key]?.status === "fail").length;
    const testsOk = testsPass === TEST_DEFS.length;

    const metaOk = Boolean(state.metadata.serial && state.metadata.technician);

    const phases = [
      { label: "Armado", value: buildOk ? "OK" : `${bomDone + stepsDone}/${BOM.length + BUILD_STEPS.length}`, ok: buildOk },
      { label: "Firmware", value: fwOk ? "Cargado" : fwS3 ? "Falta CAM" : fwCam ? "Falta S3" : "Pendiente", ok: fwOk },
      { label: "Diagnostico", value: hwOk ? "OK" : `${hwDone}/${HARDWARE_CHECKS.length}`, ok: hwOk },
      { label: "Servos", value: servosOk ? "Calibrados" : "Revisar", ok: servosOk },
      { label: "Sensores", value: sensorsOk ? "Calibrados" : "Revisar", ok: sensorsOk },
      {
        label: "Pruebas",
        value: testsRun === 0 ? "Sin correr" : testsOk ? "Todas OK" : `${testsPass}/${TEST_DEFS.length}${testsFail ? ` (${testsFail} fallan)` : ""}`,
        ok: testsOk,
        warn: testsRun > 0 && !testsOk
      },
      { label: "Metadatos", value: metaOk ? "Serie y tecnico" : "Falta serie o tecnico", ok: metaOk }
    ];

    const allOk = phases.every((p) => p.ok);
    const someFail = phases.some((p) => !p.ok && (p.warn === true || p.label === "Pruebas"));

    const tiles = phases.map((phase) => {
      const klass = phase.ok ? "ok" : phase.warn ? "warn" : "fail";
      return `
        <div class="readiness-tile ${klass}">
          <span class="label">${escapeHtml(phase.label)}</span>
          <span class="value">${escapeHtml(phase.value)}</span>
        </div>
      `;
    }).join("");

    const banner = allOk
      ? `<div class="readiness-banner ok">Listo para entrega. Genera y envia el perfil.</div>`
      : someFail
        ? `<div class="readiness-banner warn">Corrige las pruebas que fallan antes de entregar.</div>`
        : `<div class="readiness-banner fail">Termina las fases pendientes antes de generar el perfil.</div>`;

    wrap.innerHTML = `${tiles}${banner}`;

    const sendBtn = $("#btn-send-profile");
    if (sendBtn) {
      sendBtn.classList.toggle("primary", allOk);
      sendBtn.disabled = !allOk;
      sendBtn.title = allOk ? "Enviar perfil al ESP32-S3" : "Termina todas las fases para enviar";
    }
  }

  function renderServoTable() {
    const body = $("#servo-table-body");
    body.innerHTML = state.servos.map((servo) => `
      <tr data-servo-row="${servo.id}">
        <td><b>${servo.id}</b></td>
        <td><input class="tiny-input" type="number" min="0" max="15" step="1" data-servo="${servo.id}" data-field="channel" value="${servo.channel}"></td>
        <td class="joint-name">
          <strong>${servo.label}</strong>
          <small>${servo.movement}</small>
        </td>
        <td>${servo.sensorLabel}</td>
        <td><input class="tiny-input" type="number" min="0" max="270" step="1" data-servo="${servo.id}" data-field="minAngle" value="${servo.minAngle}"></td>
        <td><input class="tiny-input" type="number" min="0" max="270" step="1" data-servo="${servo.id}" data-field="maxAngle" value="${servo.maxAngle}"></td>
        <td><input class="tiny-input" type="number" min="0" max="270" step="1" data-servo="${servo.id}" data-field="homeAngle" value="${servo.homeAngle}"></td>
        <td>
          <select data-servo="${servo.id}" data-field="direction">
            <option value="1" ${servo.direction === 1 ? "selected" : ""}>Normal</option>
            <option value="-1" ${servo.direction === -1 ? "selected" : ""}>Invert</option>
          </select>
        </td>
        <td><input class="medium-input" type="number" min="80" max="540" step="1" data-servo="${servo.id}" data-field="pwmAt0" value="${servo.pwmAt0}"></td>
        <td><input class="medium-input" type="number" min="80" max="540" step="1" data-servo="${servo.id}" data-field="pwmAt270" value="${servo.pwmAt270}"></td>
        <td><input class="tiny-input" type="number" min="-90" max="90" step="0.5" data-servo="${servo.id}" data-field="mechanicalOffset" value="${servo.mechanicalOffset}"></td>
        <td class="test-cell">
          <input class="servo-slider" type="range" min="${servo.minAngle}" max="${servo.maxAngle}" step="1" data-servo="${servo.id}" data-field="testAngle" value="${servo.testAngle}">
          <div class="action-row">
            <button class="btn" data-servo-action="test" data-servo-id="${servo.id}">Test <span id="test-label-${servo.id}">${formatDeg(servo.testAngle)}</span></button>
            <button class="btn" data-servo-action="home" data-servo-id="${servo.id}">Home</button>
          </div>
        </td>
      </tr>
    `).join("");

    body.addEventListener("input", onServoInput);
    body.addEventListener("change", onServoInput);
    body.addEventListener("click", onServoAction);
  }

  function onServoInput(event) {
    const servoId = Number(event.target.dataset.servo);
    const field = event.target.dataset.field;
    if (!Number.isFinite(servoId) || !field) return;
    const servo = state.servos.find((item) => item.id === servoId);
    if (!servo) return;
    const value = field === "direction" ? Number(event.target.value) : numberValue(event.target.value, servo[field]);
    servo[field] = value;
    if (field === "minAngle" || field === "maxAngle") updateServoRange(servo);
    if (field === "testAngle") {
      const label = $(`#test-label-${servo.id}`);
      if (label) label.textContent = formatDeg(servo.testAngle);
    }
    markDirty();
    updateLive();
  }

  function updateServoRange(servo) {
    servo.minAngle = clamp(servo.minAngle, 0, 270);
    servo.maxAngle = clamp(servo.maxAngle, servo.minAngle + 1, 270);
    servo.homeAngle = clamp(servo.homeAngle, servo.minAngle, servo.maxAngle);
    servo.testAngle = clamp(servo.testAngle, servo.minAngle, servo.maxAngle);
    const slider = $(`input[data-servo="${servo.id}"][data-field="testAngle"]`);
    if (slider) {
      slider.min = String(servo.minAngle);
      slider.max = String(servo.maxAngle);
      slider.value = String(servo.testAngle);
    }
  }

  function onServoAction(event) {
    const action = event.target.closest("button")?.dataset.servoAction;
    if (!action) return;
    const servoId = Number(event.target.closest("button").dataset.servoId);
    const servo = state.servos.find((item) => item.id === servoId);
    if (!servo) return;
    if (action === "test") {
      sendAngle(servo.id, servo.testAngle);
    } else if (action === "home") {
      sendAngle(servo.id, servo.homeAngle);
    }
  }

  function renderSensorCards() {
    const imuGrid = $("#imu-grid");
    imuGrid.innerHTML = state.imus.map((imu) => `
      <div class="sensor-card" data-sensor-card="${imu.key}">
        <div class="sensor-title">
          <b>${imu.label}</b>
          <span>Bus ${imu.bus} | ${imu.axis}/${imu.plane}</span>
        </div>
        <div class="sensor-fields">
          <label><span class="small-label">Neutral</span><input type="number" step="0.1" data-imu="${imu.key}" data-field="neutralDeg" value="${imu.neutralDeg}"></label>
          <label><span class="small-label">Min</span><input type="number" step="0.1" data-imu="${imu.key}" data-field="minDeg" value="${imu.minDeg}"></label>
          <label><span class="small-label">Max</span><input type="number" step="0.1" data-imu="${imu.key}" data-field="maxDeg" value="${imu.maxDeg}"></label>
          <label><span class="small-label">Dir</span><select data-imu="${imu.key}" data-field="invert"><option value="false" ${!imu.invert ? "selected" : ""}>Normal</option><option value="true" ${imu.invert ? "selected" : ""}>Invert</option></select></label>
        </div>
        <div class="action-row">
          <button class="btn" data-sensor-action="imu-neutral" data-key="${imu.key}">Neutral</button>
          <button class="btn" data-sensor-action="imu-min" data-key="${imu.key}">Min</button>
          <button class="btn" data-sensor-action="imu-max" data-key="${imu.key}">Max</button>
          <span class="small-label" id="live-${imu.key}">${formatDeg(imu.liveDeg)}</span>
        </div>
      </div>
    `).join("");

    const flexGrid = $("#flex-grid");
    flexGrid.innerHTML = state.flex.map((flex) => `
      <div class="sensor-card" data-sensor-card="${flex.key}">
        <div class="sensor-title">
          <b>${flex.label}</b>
          <span>GPIO ${flex.pin}</span>
        </div>
        <div class="sensor-fields">
          <label><span class="small-label">ADC 0</span><input type="number" step="1" data-flex="${flex.key}" data-field="adc0" value="${flex.adc0}"></label>
          <label><span class="small-label">ADC 90</span><input type="number" step="1" data-flex="${flex.key}" data-field="adc90" value="${flex.adc90}"></label>
          <label><span class="small-label">Neutral</span><input type="number" step="0.1" data-flex="${flex.key}" data-field="neutralDeg" value="${flex.neutralDeg}"></label>
          <label><span class="small-label">Dir</span><select data-flex="${flex.key}" data-field="invert"><option value="false" ${!flex.invert ? "selected" : ""}>Normal</option><option value="true" ${flex.invert ? "selected" : ""}>Invert</option></select></label>
        </div>
        <div class="action-row">
          <button class="btn" data-sensor-action="flex-0" data-key="${flex.key}">0 deg</button>
          <button class="btn" data-sensor-action="flex-90" data-key="${flex.key}">90 deg</button>
          <button class="btn" data-sensor-action="flex-neutral" data-key="${flex.key}">Neutral</button>
          <span class="small-label" id="live-${flex.key}">ADC ${round(flex.liveRaw, 0)}</span>
        </div>
      </div>
    `).join("");

    imuGrid.addEventListener("input", onImuInput);
    imuGrid.addEventListener("change", onImuInput);
    flexGrid.addEventListener("input", onFlexInput);
    flexGrid.addEventListener("change", onFlexInput);
    $("#panel-sensores").addEventListener("click", onSensorAction);
  }

  function onImuInput(event) {
    const key = event.target.dataset.imu;
    const field = event.target.dataset.field;
    if (!key || !field) return;
    const imu = state.imus.find((item) => item.key === key);
    if (!imu) return;
    imu[field] = field === "invert" ? event.target.value === "true" : numberValue(event.target.value, imu[field]);
    markDirty();
    updateLive();
  }

  function onFlexInput(event) {
    const key = event.target.dataset.flex;
    const field = event.target.dataset.field;
    if (!key || !field) return;
    const flex = state.flex.find((item) => item.key === key);
    if (!flex) return;
    flex[field] = field === "invert" ? event.target.value === "true" : numberValue(event.target.value, flex[field]);
    markDirty();
    updateLive();
  }

  function onSensorAction(event) {
    const button = event.target.closest("button[data-sensor-action]");
    if (!button) return;
    const action = button.dataset.sensorAction;
    const key = button.dataset.key;
    const imu = state.imus.find((item) => item.key === key);
    const flex = state.flex.find((item) => item.key === key);

    if (imu) {
      if (action === "imu-neutral") imu.neutralDeg = round(imu.liveDeg, 1);
      if (action === "imu-min") imu.minDeg = round(imu.liveDeg, 1);
      if (action === "imu-max") imu.maxDeg = round(imu.liveDeg, 1);
      updateSensorInputs(key);
      log(`${imu.label}: captura ${action.replace("imu-", "")}`, "ok");
    }

    if (flex) {
      if (action === "flex-0") flex.adc0 = Math.round(flex.liveRaw);
      if (action === "flex-90") flex.adc90 = Math.round(flex.liveRaw);
      if (action === "flex-neutral") flex.neutralDeg = round(flex.liveDeg, 1);
      updateSensorInputs(key);
      log(`${flex.label}: captura ${action.replace("flex-", "")}`, "ok");
    }

    markDirty();
    updateLive();
  }

  function updateSensorInputs(key) {
    $$(`[data-imu="${key}"], [data-flex="${key}"]`).forEach((input) => {
      const source = state.imus.find((item) => item.key === key) || state.flex.find((item) => item.key === key);
      if (!source) return;
      const field = input.dataset.field;
      if (!field) return;
      if (input.tagName === "SELECT") {
        input.value = String(source[field]);
      } else {
        input.value = String(source[field]);
      }
    });
  }

  function captureAllNeutral() {
    state.imus.forEach((imu) => {
      imu.neutralDeg = round(imu.liveDeg, 1);
      updateSensorInputs(imu.key);
    });
    state.flex.forEach((flex) => {
      flex.neutralDeg = round(flex.liveDeg, 1);
      updateSensorInputs(flex.key);
    });
    markDirty();
    log("Neutral capturado para todos los sensores", "ok");
  }

  function renderMapping() {
    const list = $("#mapping-list");
    list.innerHTML = state.servos.map((servo) => `
      <div class="map-card" data-map-card="${servo.id}">
        <div class="map-top">
          <div>
            <b>${servo.label}</b>
            <div class="small-label">${servo.sensorLabel}</div>
          </div>
          <div class="map-target" id="map-target-${servo.id}">0 deg</div>
        </div>
        <div class="map-row">
          <span>Sensor</span>
          <div class="map-bar"><i id="map-sensor-bar-${servo.id}"></i></div>
          <b id="map-sensor-${servo.id}">0</b>
        </div>
        <div class="map-row">
          <span>Servo</span>
          <div class="map-bar"><i id="map-servo-bar-${servo.id}"></i></div>
          <b id="map-servo-${servo.id}">0</b>
        </div>
      </div>
    `).join("");
  }

  function updateTuningFromControls() {
    state.tuning.assistLevel = numberValue($("#assist-level").value, 0.5);
    state.tuning.deadbandDeg = numberValue($("#deadband").value, 2);
    state.tuning.smoothing = numberValue($("#smoothing").value, 0.25);
    state.tuning.maxSpeedDegSec = numberValue($("#max-speed").value, 90);
    updateTuningLabels();
    sendCommand({ type: "cmd_assist", level: state.tuning.assistLevel }, "Asistencia");
    markDirty();
    updateLive();
  }

  function updateTuningLabels() {
    $("#assist-label").textContent = `${Math.round(state.tuning.assistLevel * 100)}%`;
    $("#deadband-label").textContent = `${state.tuning.deadbandDeg} deg`;
    $("#smoothing-label").textContent = String(state.tuning.smoothing);
    $("#speed-label").textContent = `${state.tuning.maxSpeedDegSec} deg/s`;
    $("#hud-assist").textContent = `${Math.round(state.tuning.assistLevel * 100)}%`;
  }

  function updateFooterSummary() {
    const footerS3 = $("#footer-s3");
    const footerCam = $("#footer-cam");
    const footerProfile = $("#footer-profile");
    const footerMode = $("#footer-mode");
    const footerPackets = $("#footer-packets");

    if (footerS3) footerS3.textContent = $("#s3-status b")?.textContent || "Offline";
    if (footerCam) footerCam.textContent = $("#cam-status b")?.textContent || "Offline";
    if (footerProfile) footerProfile.textContent = $("#profile-status b")?.textContent || "Sin guardar";
    if (footerMode) footerMode.textContent = state.telemetry.mode || "assisted";
    if (footerPackets) footerPackets.textContent = String(state.telemetry.packets || 0);
  }

  function connectS3() {
    const url = $("#s3-url").value.trim();
    state.connection.s3Url = url;
    if (!url) {
      log("URL del ESP32-S3 vacia", "err");
      return;
    }
    disconnectS3({ silent: true });
    try {
      ws = new WebSocket(url);
    } catch (error) {
      setStatus("#s3-status", "", "Error");
      log(`No se pudo abrir WebSocket: ${error.message}`, "err");
      return;
    }

    setStatus("#s3-status", "warn", "Conectando");
    ws.addEventListener("open", () => {
      setStatus("#s3-status", "ok", "Online");
      log(`Conectado a ${url}`, "ok");
      sendCommand({ type: "cmd_status" }, "Estado");
    });
    ws.addEventListener("message", (event) => handleMessage(event.data));
    ws.addEventListener("error", () => {
      setStatus("#s3-status", "", "Error");
      log("Error WebSocket con ESP32-S3", "err");
    });
    ws.addEventListener("close", () => {
      setStatus("#s3-status", "", "Offline");
      log("ESP32-S3 desconectado", "sys");
      ws = null;
    });
  }

  function disconnectS3({ silent = false } = {}) {
    if (ws) {
      ws.close();
      ws = null;
    }
    setStatus("#s3-status", "", "Offline");
    if (!silent) log("Conexion ESP32-S3 cerrada", "sys");
  }

  function sendCommand(payload, label = "Comando") {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      log(`${label}: ESP32-S3 offline`, "err");
      return false;
    }
    const json = JSON.stringify(payload);
    ws.send(json);
    log(`TX ${label}: ${json.length > 220 ? `${json.slice(0, 220)}...` : json}`, "tx");
    return true;
  }

  function handleMessage(raw) {
    let packet;
    try {
      packet = JSON.parse(raw);
    } catch {
      log(`RX no JSON: ${String(raw).slice(0, 160)}`, "rx");
      return;
    }

    state.telemetry.packets += 1;
    state.telemetry.lastPacketAt = Date.now();

    document.dispatchEvent(new CustomEvent("vesta-rx", { detail: packet }));

    if (packet.type === "ack") {
      if (packet.fw) $("#firmware-version").value = packet.fw;
      if (packet.fw) state.metadata.firmware = packet.fw;
      log(`ACK ${packet.fw || ""} ${packet.model || ""}`.trim(), "rx");
    } else if (packet.type === "sensors" || Array.isArray(packet.servos)) {
      updateFromTelemetry(packet);
    } else if (packet.type === "error") {
      log(packet.message || "Error reportado por ESP32", "err");
    } else {
      log(`RX ${JSON.stringify(packet).slice(0, 220)}`, "rx");
    }

    updateProfilePreview();
  }

  function updateFromTelemetry(packet) {
    state.telemetry.mode = packet.mode || state.telemetry.mode;
    state.telemetry.emergency = Boolean(packet.emergency);
    if (typeof packet.assist === "number") {
      state.tuning.assistLevel = clamp(packet.assist, 0, 1);
      $("#assist-level").value = String(state.tuning.assistLevel);
      updateTuningLabels();
    }
    if (packet.battery) state.telemetry.battery = packet.battery;

    (packet.servos || []).forEach((item) => {
      const servo = state.servos.find((s) => s.id === Number(item.id));
      if (!servo) return;
      servo.liveAngle = numberValue(item.angle, servo.liveAngle);
      servo.liveSensor = numberValue(item.sensor, servo.liveSensor);
      servo.moving = Boolean(item.moving);
      const linkedImu = state.imus.find((imu) => imu.servoId === servo.id);
      if (linkedImu) linkedImu.liveDeg = servo.liveSensor;
      const linkedFlex = state.flex.find((flex) => flex.servoId === servo.id);
      if (linkedFlex) {
        linkedFlex.liveDeg = servo.liveSensor;
        if (typeof item.raw === "number") linkedFlex.liveRaw = item.raw;
      }
    });
    updateLive();
  }

  function startCamera() {
    const url = $("#cam-url").value.trim();
    state.connection.camUrl = url;
    if (!url) {
      log("URL de ESP32-CAM vacia", "err");
      return;
    }
    const img = $("#cam-stream");
    const box = $(".camera-box");
    img.onload = () => {
      box.classList.add("active");
      setStatus("#cam-status", "ok", "Online");
    };
    img.onerror = () => {
      box.classList.remove("active");
      setStatus("#cam-status", "warn", "Sin imagen");
      log("No se pudo cargar stream ESP32-CAM", "err");
    };
    img.src = url;
    box.classList.add("active");
    setStatus("#cam-status", "warn", "Cargando");
    log(`Stream CAM: ${url}`, "sys");
    markDirty();
  }

  function stopCamera() {
    $("#cam-stream").removeAttribute("src");
    $(".camera-box").classList.remove("active");
    setStatus("#cam-status", "", "Offline");
    log("Stream CAM detenido", "sys");
  }

  function sendAngle(id, angle) {
    const servo = state.servos.find((item) => item.id === id);
    if (!servo) return;
    const safeAngle = clamp(angle, servo.minAngle, servo.maxAngle);
    sendCommand({ type: "cmd_angle", id, angle: round(safeAngle, 2) }, `${servo.short} ${round(safeAngle, 1)} deg`);
  }

  function sendHomes() {
    sendCommand({ type: "cmd_mode", mode: "manual" }, "Modo manual");
    state.servos.forEach((servo) => sendAngle(servo.id, servo.homeAngle));
  }

  function mappedTarget(servo) {
    const sensor = getSensorForServo(servo);
    const live = servo.liveSensor;
    const neutral = sensor?.neutralDeg || 0;
    const invert = sensor?.invert ? -1 : 1;
    let delta = (live - neutral) * invert;
    if (Math.abs(delta) < state.tuning.deadbandDeg) delta = 0;
    const assisted = delta * (1 + state.tuning.assistLevel);
    const target = servo.homeAngle + assisted * servo.direction + servo.mechanicalOffset;
    return clamp(target, servo.minAngle, servo.maxAngle);
  }

  function getSensorForServo(servo) {
    return state.imus.find((item) => item.key === servo.sensorKey) ||
      state.flex.find((item) => item.key === servo.sensorKey) ||
      null;
  }

  function sendMappedTargets() {
    sendCommand({ type: "cmd_mode", mode: "manual" }, "Modo manual");
    state.servos.forEach((servo) => sendAngle(servo.id, mappedTarget(servo)));
  }

  function sendServoProfile() {
    sendCommand({ type: "cmd_calibration_servos", servos: profileServos() }, "Perfil servos");
  }

  function sendSensorProfile() {
    sendCommand({ type: "cmd_calibration_sensors", imus: profileImus(), flex: profileFlex() }, "Perfil sensores");
  }

  function sendMapProfile() {
    sendCommand({ type: "cmd_calibration_mapping", tuning: { ...state.tuning } }, "Perfil mapeo");
  }

  function sendFullProfile() {
    sendCommand({ type: "cmd_calibration_profile", profile: buildProfile() }, "Perfil completo");
  }

  function profileServos() {
    return state.servos.map((servo) => ({
      id: servo.id,
      key: servo.key,
      channel: servo.channel,
      label: servo.label,
      side: servo.side,
      movement: servo.movement,
      sensorKey: servo.sensorKey,
      angle: {
        min: servo.minAngle,
        max: servo.maxAngle,
        home: servo.homeAngle,
        direction: servo.direction,
        mechanicalOffset: servo.mechanicalOffset
      },
      pwm: {
        unit: "pca9685_ticks",
        at0deg: servo.pwmAt0,
        at270deg: servo.pwmAt270
      }
    }));
  }

  function profileImus() {
    return state.imus.map((imu) => ({
      key: imu.key,
      bus: imu.bus,
      servoId: imu.servoId,
      label: imu.label,
      axis: imu.axis,
      plane: imu.plane,
      neutralDeg: imu.neutralDeg,
      minDeg: imu.minDeg,
      maxDeg: imu.maxDeg,
      invert: imu.invert
    }));
  }

  function profileFlex() {
    return state.flex.map((flex) => ({
      key: flex.key,
      pin: flex.pin,
      servoId: flex.servoId,
      label: flex.label,
      adc0: flex.adc0,
      adc90: flex.adc90,
      neutralDeg: flex.neutralDeg,
      invert: flex.invert
    }));
  }

  function buildProfile() {
    return {
      type: "vesta_calibration_profile",
      schema: PROFILE_SCHEMA,
      createdAt: new Date().toISOString(),
      metadata: {
        exoskeletonSerial: state.metadata.serial || null,
        technician: state.metadata.technician || null,
        localClient: state.metadata.client || null,
        firmware: state.metadata.firmware || null,
        notes: state.metadata.notes || ""
      },
      hardware: {
        controller: "ESP32-S3 N16R8 external antenna",
        camera: "ESP32-CAM",
        servos: "6x DS51150 150kg/cm 270deg",
        imu: "4x MPU6050 via TCA9548A",
        flex: "2x flex sensor 4.5 in",
        servoDriver: "PCA9685"
      },
      connection: {
        s3WebSocket: state.connection.s3Url,
        cameraStream: state.connection.camUrl,
        consumerAppBundled: false
      },
      safety: {
        consumerVisible: false,
        installOnly: true,
        servoOutputRequiresTechnician: true
      },
      servos: profileServos(),
      sensors: {
        imus: profileImus(),
        flex: profileFlex()
      },
      tuning: {
        assistLevel: state.tuning.assistLevel,
        deadbandDeg: state.tuning.deadbandDeg,
        smoothing: state.tuning.smoothing,
        maxSpeedDegSec: state.tuning.maxSpeedDegSec
      },
      firmwareUpload: {
        s3: {
          fqbn: state.firmware.s3.fqbn,
          port: state.firmware.s3.port || null,
          fileName: state.firmware.s3.fileName || null,
          codeLoaded: Boolean(state.firmware.s3.code)
        },
        cam: {
          fqbn: state.firmware.cam.fqbn,
          port: state.firmware.cam.port || null,
          fileName: state.firmware.cam.fileName || null,
          codeLoaded: Boolean(state.firmware.cam.code)
        }
      },
      checks: { ...state.hardwareChecks },
      assembly: {
        bom: BOM.map((item) => ({ key: item.key, label: item.label, done: Boolean(state.build.bom[item.key]) })),
        steps: BUILD_STEPS.map((item) => ({ key: item.key, title: item.title, done: Boolean(state.build.steps[item.key]) }))
      },
      tests: {
        runs: state.testRuns,
        lastRunAt: state.lastTestRunAt,
        results: TEST_DEFS.map((def) => ({
          key: def.key,
          label: def.label,
          status: state.tests[def.key]?.status || "idle",
          at: state.tests[def.key]?.at || null,
          message: state.tests[def.key]?.message || ""
        }))
      }
    };
  }

  function updateProfilePreview() {
    const profile = buildProfile();
    const text = JSON.stringify(profile, null, 2);
    $("#profile-preview").textContent = text;
    $("#profile-size").textContent = `${Math.max(1, Math.round(text.length / 1024))} KB`;
    $("#profile-updated").textContent = new Date().toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    renderReadiness();
  }

  async function copyProfile() {
    const text = JSON.stringify(buildProfile(), null, 2);
    try {
      await navigator.clipboard.writeText(text);
      log("Perfil copiado al portapapeles", "ok");
    } catch {
      log("El navegador bloqueo el portapapeles", "err");
    }
  }

  function downloadProfile() {
    const profile = buildProfile();
    const serial = profile.metadata.exoskeletonSerial || "vesta-exo";
    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${serial}-calibration-profile.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    log("Perfil JSON descargado", "ok");
  }

  function toggleDemo() {
    if (demoTimer) {
      clearInterval(demoTimer);
      demoTimer = null;
      $("#btn-demo").textContent = "Demo";
      log("Demo detenido", "sys");
      return;
    }
    const start = Date.now();
    demoTimer = setInterval(() => {
      const t = (Date.now() - start) / 1000;
      state.servos.forEach((servo, idx) => {
        const span = servo.maxAngle - servo.minAngle;
        const base = idx % 3 === 0 ? 0.8 : idx % 3 === 1 ? 1.1 : 1.4;
        const value = servo.minAngle + span * (0.15 + 0.55 * (Math.sin(t * base + idx) * 0.5 + 0.5));
        servo.liveSensor = round(value, 1);
        servo.liveAngle = round(clamp(value * (1 + state.tuning.assistLevel * 0.35), servo.minAngle, servo.maxAngle), 1);
        servo.moving = Math.abs(Math.sin(t * base + idx)) > 0.12;
        const linkedImu = state.imus.find((imu) => imu.servoId === servo.id);
        if (linkedImu) linkedImu.liveDeg = servo.liveSensor;
        const linkedFlex = state.flex.find((flex) => flex.servoId === servo.id);
        if (linkedFlex) {
          linkedFlex.liveDeg = servo.liveSensor;
          linkedFlex.liveRaw = flexRawFromDeg(linkedFlex, servo.liveSensor);
        }
      });
      state.telemetry.mode = "demo";
      state.telemetry.battery = { v: 11.6, pct: 82, amp: 0.0 };
      state.telemetry.packets += 1;
      updateLive();
    }, 100);
    $("#btn-demo").textContent = "Detener";
    log("Demo iniciado", "ok");
  }

  function flexRawFromDeg(flex, deg) {
    const ratio = clamp(deg / 90, 0, 1);
    return Math.round(flex.adc0 + (flex.adc90 - flex.adc0) * ratio);
  }

  function updateLive() {
    $("#hud-mode").textContent = state.telemetry.mode || "assisted";
    const battery = state.telemetry.battery;
    $("#hud-battery").textContent = battery ? `${round(battery.v || 0, 1)} V` : "--";
    updateTuningLabels();
    renderLiveMetrics();
    updateSensorLiveLabels();
    updateMappingPreview();
    updateFooterSummary();
    queueDraw();
  }

  function renderLiveMetrics() {
    const grid = $("#live-metrics");
    grid.innerHTML = state.servos.map((servo) => {
      const pct = ((servo.liveAngle - servo.minAngle) / Math.max(1, servo.maxAngle - servo.minAngle)) * 100;
      return `
        <div class="metric-card">
          <div class="metric-label">${servo.short}</div>
          <div class="metric-value">${formatDeg(servo.liveAngle)}</div>
          <div class="small-label">${servo.moving ? "Moviendo" : "Estable"} | sensor ${formatDeg(servo.liveSensor)}</div>
          <div class="metric-bar"><div class="metric-fill" style="width:${clamp(pct, 0, 100)}%"></div></div>
        </div>
      `;
    }).join("");
  }

  function updateSensorLiveLabels() {
    state.imus.forEach((imu) => {
      const label = $(`#live-${imu.key}`);
      if (label) label.textContent = formatDeg(imu.liveDeg);
    });
    state.flex.forEach((flex) => {
      const label = $(`#live-${flex.key}`);
      if (label) label.textContent = `ADC ${Math.round(flex.liveRaw)} | ${formatDeg(flex.liveDeg)}`;
    });
  }

  function updateMappingPreview() {
    state.servos.forEach((servo) => {
      const target = mappedTarget(servo);
      const range = Math.max(1, servo.maxAngle - servo.minAngle);
      const sensorPct = ((servo.liveSensor - servo.minAngle) / range) * 100;
      const servoPct = ((target - servo.minAngle) / range) * 100;
      $(`#map-target-${servo.id}`).textContent = formatDeg(target);
      $(`#map-sensor-${servo.id}`).textContent = formatDeg(servo.liveSensor);
      $(`#map-servo-${servo.id}`).textContent = formatDeg(target);
      $(`#map-sensor-bar-${servo.id}`).style.width = `${clamp(sensorPct, 0, 100)}%`;
      $(`#map-servo-bar-${servo.id}`).style.width = `${clamp(servoPct, 0, 100)}%`;
    });
  }

  function queueDraw() {
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(() => {
      drawQueued = false;
      drawExoskeleton();
    });
  }

  function drawExoskeleton() {
    const canvas = $("#exo-canvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(640, Math.floor(rect.width * ratio));
    canvas.height = Math.max(420, Math.floor(rect.height * ratio));
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "#fbfdff";
    ctx.fillRect(0, 0, w, h);
    drawGrid(ctx, w, h);

    const cx = w / 2;
    const shoulderY = h * 0.32;
    const hipY = h * 0.66;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.strokeStyle = "#04111f";
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(cx, shoulderY - 48);
    ctx.lineTo(cx, hipY);
    ctx.stroke();

    ctx.fillStyle = "#04111f";
    roundedRect(ctx, cx - 66, shoulderY - 30, 132, 38, 8);
    ctx.fill();
    roundedRect(ctx, cx - 44, hipY - 8, 88, 28, 8);
    ctx.fill();

    drawArm(ctx, cx - 70, shoulderY, "left");
    drawArm(ctx, cx + 70, shoulderY, "right");

    ctx.fillStyle = "#0b5ea8";
    ctx.font = "700 12px Segoe UI, Arial";
    ctx.fillText("ESP32-S3", cx - 28, hipY + 54);
    ctx.strokeStyle = "#0b5ea8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, hipY + 25);
    ctx.lineTo(cx, hipY + 44);
    ctx.stroke();
  }

  function drawGrid(ctx, w, h) {
    ctx.save();
    ctx.strokeStyle = "#e6eef6";
    ctx.lineWidth = 1;
    for (let x = 24; x < w; x += 36) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 24; y < h; y += 36) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawArm(ctx, shoulderX, shoulderY, side) {
    const sign = side === "left" ? -1 : 1;
    const lateral = servoBy(side, "Lateral").liveAngle;
    const frontal = servoBy(side, "Frontal").liveAngle;
    const elbow = servoBy(side, "Elbow").liveAngle;
    const upper = 116;
    const fore = 108;
    const sideLift = lateral / 90;
    const frontLift = frontal / 120;
    const elbowBend = elbow / 90;

    const elbowX = shoulderX + sign * (34 + upper * (0.35 + sideLift * 0.65));
    const elbowY = shoulderY + upper * (0.95 - frontLift * 0.78);
    const wristX = elbowX + sign * fore * (0.22 + sideLift * 0.34 + elbowBend * 0.26);
    const wristY = elbowY + fore * (0.95 - frontLift * 0.35 - elbowBend * 0.62);

    ctx.strokeStyle = "#c6d2de";
    ctx.lineWidth = 28;
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(elbowX, elbowY);
    ctx.lineTo(wristX, wristY);
    ctx.stroke();

    ctx.strokeStyle = side === "left" ? "#06345b" : "#2489e6";
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(elbowX, elbowY);
    ctx.lineTo(wristX, wristY);
    ctx.stroke();

    drawJoint(ctx, shoulderX, shoulderY, "H");
    drawJoint(ctx, elbowX, elbowY, "C");
    drawJoint(ctx, wristX, wristY, "F");

    ctx.fillStyle = "#04111f";
    ctx.font = "700 12px Segoe UI, Arial";
    ctx.textAlign = side === "left" ? "right" : "left";
    const labelX = shoulderX + sign * 12;
    ctx.fillText(side === "left" ? "IZQ" : "DER", labelX, shoulderY - 26);
    ctx.font = "700 11px Segoe UI, Arial";
    ctx.fillStyle = "#4c6073";
    ctx.fillText(`LAT ${round(lateral, 0)} | FRO ${round(frontal, 0)} | ELB ${round(elbow, 0)}`, labelX, shoulderY - 10);
    ctx.textAlign = "start";
  }

  function servoBy(side, type) {
    const match = state.servos.find((servo) => servo.side === side && servo.key.toLowerCase().includes(type.toLowerCase()));
    return match || state.servos[0];
  }

  function drawJoint(ctx, x, y, text) {
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#04111f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#04111f";
    ctx.font = "800 10px Segoe UI, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y + 0.5);
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
  }

  function tickClock() {
    const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
    const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const seconds = String(elapsed % 60).padStart(2, "0");
    $("#session-clock").textContent = `${minutes}:${seconds}`;
    const footerSession = $("#footer-session");
    if (footerSession) footerSession.textContent = `${minutes}:${seconds}`;
  }

  window.addEventListener("resize", queueDraw);
  document.addEventListener("DOMContentLoaded", init);
})();
