// Comentarios de programador: identifican proposito de bloques, datos y flujo sin alterar la logica.
// Archivo        | app.js: consola tecnica del navegador, firmware embebido, diagnostico y UI.

(() => {                                                                              // Modulo autoejecutable: aisla el alcance del cliente.
  "use strict";                                                                       // Modo estricto de JavaScript para evitar coerciones implicitas.

  const STORAGE_KEY = "vesta-tech-calibration-v1";                                    // Constante STORAGE_KEY: clave de localStorage para el perfil tecnico.
  const PROFILE_SCHEMA = 3;                                                           // Constante PROFILE_SCHEMA: version del esquema persistido para migraciones.
  const S3_BATTERY_AP_WS_URL = "ws://192.168.4.1:81";                                 // Constante S3_BATTERY_AP_WS_URL: URL usada en comunicaciones.
  const S3_MDNS_WS_URL = "ws://vesta-exo.local:81";                                   // Constante S3_MDNS_WS_URL: URL usada en comunicaciones.
  const S3_PLACEHOLDER_WS_URL = "ws://192.168.1.100:81";                              // Constante S3_PLACEHOLDER_WS_URL: URL usada en comunicaciones.
  const FIRMWARE_FILES = {                                                            // Objeto FIRMWARE_FILES: mapa de archivos de firmware incluidos en el proyecto.
    s3: {                                                                             // Campo s3: objeto anidado de configuracion.
      fileName: "esp32_s3_controller.ino",                                            // Campo fileName: campo de datos para file name.
      url: "esp32_s3_controller/esp32_s3_controller.ino"                              // Campo url: campo de datos para url.
    },
    cam: {                                                                            // Campo cam: objeto anidado de configuracion.
      fileName: "esp32_cam_assistant.ino",                                            // Campo fileName: campo de datos para file name.
      url: "esp32_cam_assistant.ino"                                                  // Campo url: campo de datos para url.
    }
  };

  // Objeto FIRMWARE_DEFAULT_CODE: firmware de respaldo para el editor cuando no responde el archivo local.
  // Objeto FIRMWARE_DEFAULT_CODE: firmware de respaldo para el editor cuando no responde el archivo local.
  // Objeto FIRMWARE_DEFAULT_CODE: firmware de respaldo para el editor cuando no responde el archivo local.
  const FIRMWARE_DEFAULT_CODE = {
    // Campo s3: firmware ESP32-S3 incluido como texto sin procesar.
    s3: String.raw`
// Comentarios de programador: identifican hardware, datos y flujo sin alterar la logica.

/*
 * V.E.S.T.A. ESP32-S3 controller firmware
 *
 * Hardware:
 * - ESP32-S3 N16R8 with external antenna
 * - TCA9548A + 4x MPU6050
 * - PCA9685 + 6x DS51150 150kg/cm 270 deg servos
 * - 2x AS5600 magnetic angle sensors for elbows
 * - Remote emergency stop only (cmd_stop / cmd_reset). No physical button.
 *
 * Libraries:
 * - ArduinoJson by Benoit Blanchon
 * - WebSockets by Markus Sattler
 * - Adafruit PWM Servo Driver Library
 * - MPU6050 by Electronic Cats
 */

#include "esp32_s3_config.h"                                                          // Dependencia: incluye "esp32_s3_config.h" para compilar este modulo.
#include <Wire.h>                                                                     // Dependencia: incluye <Wire.h> para compilar este modulo.
#include <WiFi.h>                                                                     // Dependencia: incluye <WiFi.h> para compilar este modulo.
#include <esp_wifi.h>                                                                 // Dependencia: incluye <esp_wifi.h> para compilar este modulo.
#include <esp_log.h>                                                                  // Dependencia: incluye <esp_log.h> para compilar este modulo.
#include <ESPmDNS.h>                                                                  // Dependencia: incluye <ESPmDNS.h> para compilar este modulo.
#include <WebSocketsServer.h>                                                         // Dependencia: incluye <WebSocketsServer.h> para compilar este modulo.
#include <ArduinoJson.h>                                                              // Dependencia: incluye <ArduinoJson.h> para compilar este modulo.
#include <Adafruit_PWMServoDriver.h>                                                  // Dependencia: incluye <Adafruit_PWMServoDriver.h> para compilar este modulo.
#include <MPU6050.h>                                                                  // Dependencia: incluye <MPU6050.h> para compilar este modulo.
#include <Preferences.h>                                                              // Dependencia: incluye <Preferences.h> para compilar este modulo.
#if BLE_ENABLED                                                                       // Directiva de compilacion: activa codigo segun configuracion.
#include <BLEDevice.h>                                                                // Dependencia: incluye <BLEDevice.h> para compilar este modulo.
#include <BLEServer.h>                                                                // Dependencia: incluye <BLEServer.h> para compilar este modulo.
#include <BLEUtils.h>                                                                 // Dependencia: incluye <BLEUtils.h> para compilar este modulo.
#include <BLE2902.h>                                                                  // Dependencia: incluye <BLE2902.h> para compilar este modulo.
#endif                                                                                // Cierre de directiva de compilacion condicional.

WebSocketsServer ws(WS_PORT);                                                         // Declaracion ws: dato de comunicaciones.
Adafruit_PWMServoDriver pca(PCA_ADDR);                                                // Declaracion pca: dato de pca.
Preferences prefs;                                                                    // Declaracion prefs: dato de prefs.

MPU6050 imu[NUM_IMUS] = {                                                             // Arreglo imu: arreglo de datos para lectura de sensores IMU/I2C.
  MPU6050(MPU_ADDR),                                                                  // Llamada: ejecuta API de hardware, red o utilidad local.
  MPU6050(MPU_ADDR),                                                                  // Llamada: ejecuta API de hardware, red o utilidad local.
  MPU6050(MPU_ADDR),                                                                  // Llamada: ejecuta API de hardware, red o utilidad local.
  MPU6050(MPU_ADDR)                                                                   // Llamada: ejecuta API de hardware, red o utilidad local.
};

struct ServoCfg {                                                                     // Estructura ServoCfg: agrupa datos de control angular de servos.
  uint8_t channel;                                                                    // Declaracion channel: dato de channel.
  float minDeg;                                                                       // Declaracion minDeg: dato de control de servos.
  float maxDeg;                                                                       // Declaracion maxDeg: dato de control de servos.
  float homeDeg;                                                                      // Declaracion homeDeg: dato de control de servos.
  int8_t direction;                                                                   // Declaracion direction: dato de direction.
  int pwm0;                                                                           // Declaracion pwm0: dato de control de servos.
  int pwm270;                                                                         // Declaracion pwm270: dato de control de servos.
  float offsetDeg;                                                                    // Declaracion offsetDeg: dato de control de servos.
};

struct ImuCfg {                                                                       // Estructura ImuCfg: agrupa datos de lectura de sensores IMU/I2C.
  float neutralDeg;                                                                   // Declaracion neutralDeg: dato de control de servos.
  float minDeg;                                                                       // Declaracion minDeg: dato de control de servos.
  float maxDeg;                                                                       // Declaracion maxDeg: dato de control de servos.
  bool invert;                                                                        // Declaracion invert: dato de invert.
};

struct As5600Cfg {                                                                    // Estructura As5600Cfg: agrupa calibracion de sensores AS5600.
  int raw0;                                                                           // Declaracion raw0: lectura AS5600 para 0 grados.
  int raw90;                                                                          // Declaracion raw90: lectura AS5600 para 90 grados.
  float neutralDeg;                                                                   // Declaracion neutralDeg: dato de control de servos.
  bool invert;                                                                        // Declaracion invert: dato de invert.
};

struct CompFilter {                                                                   // Estructura CompFilter: agrupa datos de comp filter.
  float angle = 0.0f;                                                                 // Variable angle: estado mutable de control angular de servos.
  float deg = 0.0f;                                                                   // Variable deg: estado mutable de control angular de servos.
  unsigned long lastUs = 0;                                                           // Variable lastUs: estado mutable de last us.
  bool ready = false;                                                                 // Variable ready: estado mutable de ready.
  bool degReady = false;                                                              // Variable degReady: estado mutable de control angular de servos.
};

struct ImuOffset {                                                                    // Estructura ImuOffset: agrupa datos de lectura de sensores IMU/I2C.
  int16_t ax = 0;                                                                     // Variable ax: estado mutable de ax.
  int16_t ay = 0;                                                                     // Variable ay: estado mutable de ay.
  int16_t az = 0;                                                                     // Variable az: estado mutable de az.
  int16_t gx = 0;                                                                     // Variable gx: estado mutable de gx.
  int16_t gy = 0;                                                                     // Variable gy: estado mutable de gy.
  int16_t gz = 0;                                                                     // Variable gz: estado mutable de gz.
};

struct SensorLink {                                                                   // Estructura SensorLink: agrupa datos de sensor link.
  uint8_t servoId;                                                                    // Declaracion servoId: dato de control de servos.
  uint8_t sensorKind;                                                                 // Declaracion sensorKind: dato de sensor kind.
  uint8_t sensorId;                                                                   // Declaracion sensorId: dato de sensor id.
};

ServoCfg servoCfg[N_SERVOS];                                                          // Arreglo servoCfg: coleccion ServoCfg para control de servos.
ImuCfg imuCfg[NUM_IMUS];                                                              // Arreglo imuCfg: coleccion ImuCfg para sensores IMU.
As5600Cfg as5600Cfg[NUM_AS5600];                                                      // Arreglo as5600Cfg: coleccion As5600Cfg para sensores AS5600.
CompFilter cf[NUM_IMUS];                                                              // Arreglo cf: coleccion CompFilter para cf.
ImuOffset imuOff[NUM_IMUS];                                                           // Arreglo imuOff: coleccion ImuOffset para sensores IMU.

float sensorDeg[N_SERVOS] = {0};                                                      // Arreglo sensorDeg: arreglo de datos para control angular de servos.
float targetDeg[N_SERVOS] = {0};                                                      // Arreglo targetDeg: arreglo de datos para control angular de servos.
float currentDeg[N_SERVOS] = {0};                                                     // Arreglo currentDeg: arreglo de datos para control angular de servos.
float as5600Ema[NUM_AS5600] = {0};                                                    // Arreglo as5600Ema: lectura raw suavizada de sensores AS5600.
float as5600BaseRaw[NUM_AS5600] = {0};                                                // Arreglo as5600BaseRaw: baseline de arranque para codos AS5600.
int as5600Raw[NUM_AS5600] = {0};                                                      // Arreglo as5600Raw: lectura raw 0..4095 de sensores AS5600.
bool as5600BaseReady[NUM_AS5600] = {false};                                           // Arreglo as5600BaseReady: baseline disponible para sensores AS5600.
bool as5600EmaReady[NUM_AS5600] = {false};                                            // Arreglo as5600EmaReady: EMA inicializado para sensores AS5600.
bool as5600Online[NUM_AS5600] = {false};                                              // Arreglo as5600Online: estado I2C de sensores AS5600.
uint8_t as5600Faults[NUM_AS5600] = {0};                                               // Arreglo as5600Faults: fallas consecutivas de sensores AS5600.
bool imuOnline[NUM_IMUS] = {false};                                                   // Arreglo imuOnline: arreglo de datos para lectura de sensores IMU/I2C.
uint8_t imuFaults[NUM_IMUS] = {0};                                                    // Arreglo imuFaults: arreglo de datos para lectura de sensores IMU/I2C.
// Por servo: ¿la última lectura del sensor enlazado fue válida?
// Si es false, NO actualizamos el target desde el sensor (mantiene
// posición segura). Esto evita tirones cuando una IMU/AS5600 se cae
// y vuelve, y previene que el codo "se vaya" al energizar mientras
// el EMA del AS5600 se asienta.
bool sensorOnline[N_SERVOS] = {false};                                                // Arreglo sensorOnline: arreglo de datos para sensor online.

String opMode = BOOT_MODE;                                                            // Variable opMode: estado mutable de op mode.
float assistLevel = BOOT_ASSIST_LEVEL;                                                // Variable assistLevel: estado mutable de assist level.
float deadbandDeg = CONTROL_DEADBAND_DEFAULT;                                         // Variable deadbandDeg: estado mutable de control angular de servos.
float maxSpeedDegSec = CONTROL_MAX_SPEED_DEFAULT;                                     // Variable maxSpeedDegSec: estado mutable de control angular de servos.
float smoothing = CONTROL_SMOOTHING_DEFAULT;                                          // Variable smoothing: estado mutable de smoothing.

bool emergency = false;                                                               // Variable emergency: estado mutable de paro de emergencia.
bool camOnline = false;                                                               // Variable camOnline: estado mutable de camara y video.
bool pcaOnline = false;                                                               // Variable pcaOnline: confirma que el PCA9685 responde en el bus I2C.
bool servosArmed = false;                                                             // Compuerta de seguridad: sin armado explicito no se envia PWM.
bool wsStarted = false;                                                               // Variable wsStarted: estado mutable de comunicaciones y puertos.
bool s3ApActive = false;                                                              // Variable s3ApActive: estado mutable de s3 ap active.
unsigned long lastCamMs = 0;                                                          // Variable lastCamMs: estado mutable de lectura de sensores IMU/I2C.
unsigned long tCtrl = 0;                                                              // Variable tCtrl: estado mutable de t ctrl.
unsigned long tSend = 0;                                                              // Variable tSend: estado mutable de t send.
unsigned long tWifiCheck = 0;                                                         // Variable tWifiCheck: estado mutable de comunicaciones y puertos.
unsigned long tWifiRetry = 0;                                                         // Variable tWifiRetry: estado mutable de comunicaciones y puertos.
unsigned long tAs5600Diag = 0;                                                        // Variable tAs5600Diag: estado mutable de sensores AS5600.
bool wifiUp = false;                                                                  // Variable wifiUp: estado mutable de comunicaciones y puertos.
#if BLE_ENABLED                                                                       // Directiva de compilacion: activa codigo segun configuracion.
unsigned long tBleNotify = 0;                                                         // Variable tBleNotify: estado mutable de enlace BLE.
uint8_t bleSeq = 0;                                                                   // Variable bleSeq: estado mutable de enlace BLE.
bool bleConnected = false;                                                            // Variable bleConnected: estado mutable de enlace BLE.
BLEServer* bleServer = nullptr;                                                       // Variable bleServer: estado mutable de enlace BLE.
BLECharacteristic* bleTelemetryChar = nullptr;                                        // Variable bleTelemetryChar: estado mutable de enlace BLE.
BLECharacteristic* bleStatusChar = nullptr;                                           // Variable bleStatusChar: estado mutable de enlace BLE.
#endif                                                                                // Cierre de directiva de compilacion condicional.
const uint8_t SERIAL_CLIENT = 255;                                                    // Variable SERIAL_CLIENT: constante usada en comunicaciones y puertos.
String serialLine;                                                                    // Declaracion serialLine: dato de comunicaciones.

const uint8_t SENSOR_KIND_IMU = 0;                                                    // Variable SENSOR_KIND_IMU: constante usada en lectura de sensores IMU/I2C.
const uint8_t SENSOR_KIND_AS5600 = 1;                                                 // Variable SENSOR_KIND_AS5600: constante usada en sensores AS5600.

#if BLE_ENABLED                                                                       // Directiva de compilacion: activa codigo segun configuracion.
const uint8_t BLE_CMD_ANGLE = 1;                                                      // Variable BLE_CMD_ANGLE: constante usada en control angular de servos.
const uint8_t BLE_CMD_MODE = 2;                                                       // Variable BLE_CMD_MODE: constante usada en enlace BLE.
const uint8_t BLE_CMD_STOP = 3;                                                       // Variable BLE_CMD_STOP: constante usada en enlace BLE.
const uint8_t BLE_CMD_RESET = 4;                                                      // Variable BLE_CMD_RESET: constante usada en enlace BLE.
const uint8_t BLE_CMD_HOME = 5;                                                       // Variable BLE_CMD_HOME: constante usada en enlace BLE.
const uint8_t BLE_CMD_STATUS = 6;                                                     // Variable BLE_CMD_STATUS: constante usada en enlace BLE.
const uint8_t BLE_CMD_ASSIST = 7;                                                     // Variable BLE_CMD_ASSIST: constante usada en enlace BLE.
#endif                                                                                // Cierre de directiva de compilacion condicional.

// 4 shoulder servos follow MPU6050; 2 elbow servos follow AS5600 sensors.
const SensorLink SENSOR_LINKS[N_SERVOS] = {
  { SRV_L_LAT, SENSOR_KIND_IMU,  IMU_L_LAT },                                         // Elemento: entrada de inicializacion estructurada.
  { SRV_L_FRO, SENSOR_KIND_IMU,  IMU_L_FRO },                                         // Elemento: entrada de inicializacion estructurada.
  { SRV_L_ELB, SENSOR_KIND_AS5600, AS5600_L_ELB },                                    // Elemento: entrada de inicializacion estructurada.
  { SRV_R_LAT, SENSOR_KIND_IMU,  IMU_R_LAT },                                         // Elemento: entrada de inicializacion estructurada.
  { SRV_R_FRO, SENSOR_KIND_IMU,  IMU_R_FRO },                                         // Elemento: entrada de inicializacion estructurada.
  { SRV_R_ELB, SENSOR_KIND_AS5600, AS5600_R_ELB }                                     // Elemento: entrada de inicializacion estructurada.
};
const float IMU_DEFAULT_MAX_DEG[NUM_IMUS] = {90, 120, 90, 120};                       // Arreglo IMU_DEFAULT_MAX_DEG: limites angulares por defecto para cada IMU.

float clampServoDeg(int id, float deg);                                               // Funcion clampServoDeg: limita el angulo de servo a rangos seguros.
void setEmergency(bool active, const char* reason);                                   // Funcion setEmergency: activa o limpia el estado de paro de emergencia.
void applyBootBehavior();                                                             // Funcion applyBootBehavior: normaliza modo y asistencia al iniciar.
void savePrefs();                                                                     // Funcion savePrefs: guarda calibracion persistida en memoria no volatil.
void sendAck(uint8_t client);                                                         // Funcion sendAck: envia ack.
void sendData();                                                                      // Funcion sendData: emite telemetria completa del controlador.
void processCmd(const String& json, uint8_t client);                                  // Funcion processCmd: interpreta comandos JSON entrantes.
void sendI2CDiagnostic(uint8_t client);                                               // Funcion sendI2CDiagnostic: envia i2 cdiagnostic.
void syncServoStateToCurrentSensors();                                                // Funcion syncServoStateToCurrentSensors: prepara armado sin salto a home.
void releaseServos();                                                                 // Funcion releaseServos: libera PWM en todos los canales.
void armServos(const char* reason);                                                   // Funcion armServos: habilita PWM por orden explicita.
void disarmServos(const char* reason);                                                // Funcion disarmServos: deshabilita PWM por orden explicita.
void startWebSocketServer();                                                          // Funcion startWebSocketServer: inicia web socket server.
bool setupMpu(uint8_t idx);                                                           // Funcion setupMpu: inicializa y valida una MPU6050.

bool sensorsEnabled() {                                                               // Funcion sensorsEnabled: habilita o aisla lecturas de sensores.
#if SENSORLESS_SERVO_TEST
  return false;                                                                       // Retorno: prueba de servos sin IMU/AS5600.
#else                                                                                 // Directiva de compilacion: activa codigo segun configuracion.
  return true;                                                                        // Retorno: comportamiento normal con sensores.
#endif                                                                                // Cierre de directiva de compilacion condicional.
}

const char* normalizeRequestedMode(const char* requested) {                           // Funcion normalizeRequestedMode: fuerza modo seguro segun configuracion.
#if SENSORLESS_SERVO_TEST
  (void)requested;
  return "manual";                                                                    // Retorno: en prueba sin sensores solo se acepta control manual.
#else                                                                                 // Directiva de compilacion: activa codigo segun configuracion.
  if (!requested) return "manual";                                                     // Condicion: modo vacio cae a manual.
  if (!strcmp(requested, "manual") || !strcmp(requested, "assisted") || !strcmp(requested, "automatic")) {
    return requested;                                                                 // Retorno: informa resultado de la operacion.
  }
  return "manual";                                                                    // Retorno: modo invalido cae a manual.
#endif                                                                                // Cierre de directiva de compilacion condicional.
}

#if BLE_ENABLED                                                                       // Directiva de compilacion: activa codigo segun configuracion.
uint8_t modeCode() {                                                                  // Funcion modeCode: convierte el modo textual a codigo BLE compacto.
  if (opMode == "manual") return 0;                                                   // Condicion: valida estado de hardware o comando.
  if (opMode == "assisted") return 1;                                                 // Condicion: valida estado de hardware o comando.
  if (opMode == "automatic") return 2;                                                // Condicion: valida estado de hardware o comando.
  if (opMode == "emergency") return 3;                                                // Condicion: valida estado de hardware o comando.
  return 255;                                                                         // Retorno: informa resultado de la operacion.
}

const char* modeFromCode(uint8_t code) {                                             // Funcion modeFromCode: convierte codigo BLE de modo a cadena de texto.
#if SENSORLESS_SERVO_TEST
  (void)code;
  return "manual";                                                                    // Retorno: BLE tambien queda aislado de modos con sensores.
#else                                                                                 // Directiva de compilacion: activa codigo segun configuracion.
  switch (code) {                                                                     // Selector: despacha por tipo de evento o comando.
    case 0: return "manual";                                                          // Caso: evento o comando especifico.
    case 1: return "assisted";                                                        // Caso: evento o comando especifico.
    case 2: return "automatic";                                                       // Caso: evento o comando especifico.
    default: return "manual";                                                         // Campo default: dato miembro de estructura o JSON.
  }
#endif                                                                                // Cierre de directiva de compilacion condicional.
}

void appendI16(uint8_t* buffer, size_t& offset, int16_t value) {                      // Funcion appendI16: escribe enteros de 16 bits little-endian en un buffer.
  buffer[offset++] = (uint8_t)(value & 0xff);                                         // Asignacion: actualiza estado del firmware.
  buffer[offset++] = (uint8_t)((value >> 8) & 0xff);                                  // Asignacion: actualiza estado del firmware.
}

int16_t readI16(const uint8_t* buffer, size_t offset) {                               // Funcion readI16: lee enteros de 16 bits little-endian desde un buffer.
  return (int16_t)((uint16_t)buffer[offset] | ((uint16_t)buffer[offset + 1] << 8));   // Retorno: informa resultado de la operacion.
}

void updateBleStatusValue() {                                                         // Funcion updateBleStatusValue: actualiza la caracteristica BLE de estado.
  if (!bleStatusChar) return;                                                         // Condicion: valida estado de hardware o comando.
  JsonDocument doc;                                                                   // Declaracion doc: dato de doc.
  doc["type"] = "ble_status";                                                         // Asignacion: actualiza estado del firmware.
  doc["fw"] = "VESTA-S3-3.3";                                                         // Asignacion: actualiza estado del firmware.
  doc["role"] = "controller";                                                         // Asignacion: actualiza estado del firmware.
  doc["name"] = BLE_DEVICE_NAME;                                                      // Asignacion: actualiza estado del firmware.
  doc["service"] = BLE_SERVICE_UUID;                                                  // Asignacion: actualiza estado del firmware.
  doc["connected"] = bleConnected;                                                    // Asignacion: actualiza estado del firmware.
  doc["mode"] = opMode;                                                               // Asignacion: actualiza estado del firmware.
  doc["emergency"] = emergency;                                                       // Asignacion: actualiza estado del firmware.
  doc["armed"] = servosArmed;                                                         // Asignacion: reporta si el PWM de servos esta habilitado.
  doc["camOnline"] = camOnline;                                                       // Asignacion: actualiza estado del firmware.
  doc["sensorless"] = !sensorsEnabled();                                               // Asignacion: informa si IMU/AS5600 estan aislados.
  String out;                                                                         // Declaracion out: dato de out.
  serializeJson(doc, out);                                                            // Llamada: ejecuta API de hardware, red o utilidad local.
  bleStatusChar->setValue(out.c_str());
}

void sendBleTelemetry(bool force = false) {                                           // Funcion sendBleTelemetry: publica telemetria compacta por BLE.
  if (!bleConnected || !bleTelemetryChar) return;                                     // Condicion: valida estado de hardware o comando.
  const unsigned long now = millis();                                                 // Variable now: constante usada en now.
  if (!force && now - tBleNotify < BLE_NOTIFY_MS) return;                             // Condicion: valida estado de hardware o comando.
  tBleNotify = now;                                                                   // Asignacion: actualiza estado del firmware.

  uint8_t payload[64];                                                                // Arreglo payload: coleccion de payload.
  size_t offset = 0;                                                                  // Variable offset: estado mutable de offset.
  payload[offset++] = 'V';                                                            // Asignacion: actualiza estado del firmware.
  payload[offset++] = 'T';                                                            // Asignacion: actualiza estado del firmware.
  payload[offset++] = 1;                                                              // Asignacion: actualiza estado del firmware.
  payload[offset++] = 0;                                                              // Asignacion: actualiza estado del firmware.
  payload[offset++] = modeCode();                                                     // Asignacion: actualiza estado del firmware.
  payload[offset++] = emergency ? 1 : 0;                                              // Asignacion: actualiza estado del firmware.
  payload[offset++] = camOnline ? 1 : 0;                                              // Asignacion: actualiza estado del firmware.
  payload[offset++] = bleSeq++;                                                       // Asignacion: actualiza estado del firmware.

  for (int i = 0; i < N_SERVOS; i++) appendI16(payload, offset, (int16_t)roundf(currentDeg[i] * 10.0f)); // Bucle: recorre muestras, servos o clientes.
  for (int i = 0; i < N_SERVOS; i++) appendI16(payload, offset, (int16_t)roundf(targetDeg[i] * 10.0f)); // Bucle: recorre muestras, servos o clientes.
  for (int i = 0; i < N_SERVOS; i++) appendI16(payload, offset, (int16_t)roundf(sensorDeg[i] * 10.0f)); // Bucle: recorre muestras, servos o clientes.

  bleTelemetryChar->setValue(payload, offset);
  bleTelemetryChar->notify();
  updateBleStatusValue();                                                             // Llamada: ejecuta API de hardware, red o utilidad local.
}

void processBleBinaryCommand(const uint8_t* data, size_t len) {                       // Funcion processBleBinaryCommand: interpreta comandos BLE binarios.
  if (len < 8 || data[0] != 'V' || data[1] != 'C' || data[2] != 1) return;            // Condicion: valida estado de hardware o comando.
  const uint8_t type = data[3];                                                       // Variable type: constante usada en type.
  const uint8_t id = data[4];                                                         // Variable id: constante usada en id.
  const int16_t value = readI16(data, 6);                                             // Variable value: constante usada en value.

  if (type == BLE_CMD_ANGLE) {                                                        // Condicion: valida estado de hardware o comando.
    if (!emergency && id < N_SERVOS) {                                                // Condicion: valida estado de hardware o comando.
      // Misma logica que el cmd_angle por WS/Serial: control directo de un
      // servo implica modo manual, sino el lazo asistido pisa el target.
      if (opMode != "manual") opMode = "manual";                                      // Condicion: valida estado de hardware o comando.
      targetDeg[id] = clampServoDeg(id, value / 10.0f);                               // Asignacion: actualiza estado del firmware.
      armServos("ble angle");                                                         // Llamada: movimiento manual explicito habilita PWM.
    }
  } else if (type == BLE_CMD_MODE) {
    if (!emergency) {
      opMode = String(modeFromCode((uint8_t)value));                                  // Condicion: valida estado de hardware o comando.
      if (opMode != "manual") {
        syncServoStateToCurrentSensors();                                             // Llamada: evita salto a home al entrar a modo con sensores.
        armServos("ble mode");                                                        // Condicion: assisted/automatic son inicio explicito.
      }
    }
  } else if (type == BLE_CMD_STOP) {
    setEmergency(true, "ble command");                                                // Llamada: ejecuta API de hardware, red o utilidad local.
  } else if (type == BLE_CMD_RESET) {
    // Sin boton fisico de paro: el reset remoto siempre procede.
    setEmergency(false, "ble reset");                                                 // Llamada: ejecuta API de hardware, red o utilidad local.
    applyBootBehavior();                                                              // Llamada: ejecuta API de hardware, red o utilidad local.
    disarmServos("ble reset");                                                        // Llamada: reset vuelve a estado seguro sin mover a home.
  } else if (type == BLE_CMD_HOME) {
    for (int i = 0; i < N_SERVOS; i++) targetDeg[i] = servoCfg[i].homeDeg;            // Bucle: recorre muestras, servos o clientes.
    armServos("ble home");                                                            // Llamada: home es movimiento explicito.
  } else if (type == BLE_CMD_STATUS) {
    sendBleTelemetry(true);                                                           // Llamada: ejecuta API de hardware, red o utilidad local.
  } else if (type == BLE_CMD_ASSIST) {
    assistLevel = constrain(value / 1000.0f, 0.0f, 1.0f);                             // Asignacion: actualiza estado del firmware.
    savePrefs();                                                                      // Llamada: ejecuta API de hardware, red o utilidad local.
  }

  sendBleTelemetry(true);                                                             // Llamada: ejecuta API de hardware, red o utilidad local.
}

void processBleCommand(const uint8_t* data, size_t len) {                             // Funcion processBleCommand: despacha comandos BLE JSON o binarios.
  if (!data || !len) return;                                                          // Condicion: valida estado de hardware o comando.
  if (data[0] == '{') {                                                               // Condicion: valida estado de hardware o comando.
    String json;                                                                      // Declaracion json: dato de json.
    json.reserve(len);                                                                // Llamada: ejecuta API de hardware, red o utilidad local.
    for (size_t i = 0; i < len; i++) json += (char)data[i];                           // Bucle: recorre muestras, servos o clientes.
    processCmd(json, SERIAL_CLIENT);                                                  // Llamada: ejecuta API de hardware, red o utilidad local.
    sendBleTelemetry(true);                                                           // Llamada: ejecuta API de hardware, red o utilidad local.
    return;                                                                           // Retorno: informa resultado de la operacion.
  }
  processBleBinaryCommand(data, len);                                                 // Llamada: ejecuta API de hardware, red o utilidad local.
}

class VestaBleServerCallbacks : public BLEServerCallbacks {                           // Clase VestaBleServerCallbacks: agrupa datos de enlace BLE.
  void onConnect(BLEServer*) override {
    bleConnected = true;                                                              // Asignacion: actualiza estado del firmware.
    updateBleStatusValue();                                                           // Llamada: ejecuta API de hardware, red o utilidad local.
    sendBleTelemetry(true);                                                           // Llamada: ejecuta API de hardware, red o utilidad local.
  }

  void onDisconnect(BLEServer*) override {
    bleConnected = false;                                                             // Asignacion: actualiza estado del firmware.
    updateBleStatusValue();                                                           // Llamada: ejecuta API de hardware, red o utilidad local.
    BLEDevice::startAdvertising();                                                    // Campo BLEDevice: dato miembro de estructura o JSON.
  }
};

class VestaBleCommandCallbacks : public BLECharacteristicCallbacks {                  // Clase VestaBleCommandCallbacks: agrupa datos de enlace BLE.
  void onWrite(BLECharacteristic* characteristic) override {
    String value = characteristic->getValue();                                        // Variable value: estado mutable de value.
    processBleCommand((const uint8_t*)value.c_str(), value.length());                 // Llamada: ejecuta API de hardware, red o utilidad local.
  }
};

void setupBle() {                                                                     // Funcion setupBle: inicializa servicio y caracteristicas BLE.
  BLEDevice::init(BLE_DEVICE_NAME);                                                   // Campo BLEDevice: dato miembro de estructura o JSON.
  BLEDevice::setMTU(BLE_MTU);                                                         // Campo BLEDevice: dato miembro de estructura o JSON.

  bleServer = BLEDevice::createServer();                                              // Asignacion: actualiza estado del firmware.
  bleServer->setCallbacks(new VestaBleServerCallbacks());
  BLEService* service = bleServer->createService(BLE_SERVICE_UUID);

  BLECharacteristic* commandChar = service->createCharacteristic(                     // Variable commandChar: estado mutable de command char.
    BLE_COMMAND_CHAR_UUID,
    BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR          // Campo BLECharacteristic: dato miembro de estructura o JSON.
  );
  commandChar->setCallbacks(new VestaBleCommandCallbacks());

  bleTelemetryChar = service->createCharacteristic(                                   // Asignacion: actualiza estado del firmware.
    BLE_TELEMETRY_CHAR_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY             // Campo BLECharacteristic: dato miembro de estructura o JSON.
  );
  bleTelemetryChar->addDescriptor(new BLE2902());

  bleStatusChar = service->createCharacteristic(                                      // Asignacion: actualiza estado del firmware.
    BLE_STATUS_CHAR_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY             // Campo BLECharacteristic: dato miembro de estructura o JSON.
  );
  bleStatusChar->addDescriptor(new BLE2902());

  updateBleStatusValue();                                                             // Llamada: ejecuta API de hardware, red o utilidad local.
  service->start();

  BLEAdvertising* advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(BLE_SERVICE_UUID);
  advertising->setScanResponse(true);
  advertising->setMinPreferred(BLE_MIN_CONN_INTERVAL);
  advertising->setMaxPreferred(BLE_MAX_CONN_INTERVAL);
  BLEDevice::startAdvertising();                                                      // Campo BLEDevice: dato miembro de estructura o JSON.
  Serial.printf("[BLE] %s advertising service %s\n", BLE_DEVICE_NAME, BLE_SERVICE_UUID); // Llamada: ejecuta API de hardware, red o utilidad local.
}
#endif                                                                                // Cierre de directiva de compilacion condicional.

void setDefaults() {                                                                  // Funcion setDefaults: carga valores base de servos, IMU y AS5600.
  for (int i = 0; i < N_SERVOS; i++) {                                                // Bucle: recorre muestras, servos o clientes.
    servoCfg[i].channel = i;                                                          // Asignacion: actualiza estado del firmware.
    servoCfg[i].minDeg = SRV_HARD_MIN[i];                                             // Asignacion: actualiza estado del firmware.
    servoCfg[i].maxDeg = SRV_HARD_MAX[i];                                             // Asignacion: actualiza estado del firmware.
    servoCfg[i].homeDeg = 0;                                                          // Asignacion: actualiza estado del firmware.
    servoCfg[i].direction = 1;                                                        // Asignacion: actualiza estado del firmware.
    servoCfg[i].pwm0 = PWM_MIN_TICK;                                                  // Asignacion: actualiza estado del firmware.
    servoCfg[i].pwm270 = PWM_MAX_TICK;                                                // Asignacion: actualiza estado del firmware.
    servoCfg[i].offsetDeg = 0;                                                        // Asignacion: actualiza estado del firmware.
  }

  for (int i = 0; i < NUM_IMUS; i++) {                                                // Bucle: recorre muestras, servos o clientes.
    imuCfg[i].neutralDeg = 0;                                                         // Asignacion: actualiza estado del firmware.
    imuCfg[i].minDeg = 0;                                                             // Asignacion: actualiza estado del firmware.
    imuCfg[i].maxDeg = IMU_DEFAULT_MAX_DEG[i];                                        // Asignacion: actualiza estado del firmware.
    imuCfg[i].invert = false;                                                         // Asignacion: actualiza estado del firmware.
  }

  for (int i = 0; i < NUM_AS5600; i++) {                                              // Bucle: recorre muestras, servos o clientes.
    as5600Cfg[i].raw0 = AS5600_RAW_0DEG_DEFAULT;                                      // Asignacion: actualiza estado del firmware.
    as5600Cfg[i].raw90 = AS5600_RAW_90DEG_DEFAULT;                                    // Asignacion: actualiza estado del firmware.
    as5600Cfg[i].neutralDeg = 0;                                                      // Asignacion: actualiza estado del firmware.
    as5600Cfg[i].invert = false;                                                      // Asignacion: actualiza estado del firmware.
  }
}

float finiteOrDefault(float value, float fallback) {                                  // Funcion finiteOrDefault: descarta NaN/inf de perfiles guardados.
  return isfinite(value) ? value : fallback;                                          // Retorno: informa resultado de la operacion.
}

int safePwmTick(int value, int fallback) {                                            // Funcion safePwmTick: limita ticks PWM a una ventana segura de servo.
  if (value < 80 || value > 600) return fallback;                                     // Condicion: evita perfiles corruptos que apaguen la salida PWM.
  return value;                                                                       // Retorno: informa resultado de la operacion.
}

void sanitizeServoConfig(int id) {                                                    // Funcion sanitizeServoConfig: normaliza limites y PWM de un servo.
  if (id < 0 || id >= N_SERVOS) return;                                               // Condicion: valida indice de servo.
  servoCfg[id].channel = (uint8_t)constrain((int)servoCfg[id].channel, 0, 15);        // Asignacion: limita canal PCA9685.
  servoCfg[id].minDeg = constrain(finiteOrDefault(servoCfg[id].minDeg, SRV_HARD_MIN[id]), SRV_HARD_MIN[id], SRV_HARD_MAX[id]);
  servoCfg[id].maxDeg = constrain(finiteOrDefault(servoCfg[id].maxDeg, SRV_HARD_MAX[id]), SRV_HARD_MIN[id], SRV_HARD_MAX[id]);
  if (servoCfg[id].maxDeg <= servoCfg[id].minDeg) {                                  // Condicion: evita rango angular cerrado o invertido.
    servoCfg[id].minDeg = SRV_HARD_MIN[id];                                          // Asignacion: restaura minimo seguro.
    servoCfg[id].maxDeg = SRV_HARD_MAX[id];                                          // Asignacion: restaura maximo seguro.
  }
  servoCfg[id].homeDeg = constrain(finiteOrDefault(servoCfg[id].homeDeg, servoCfg[id].minDeg), servoCfg[id].minDeg, servoCfg[id].maxDeg);
  servoCfg[id].direction = servoCfg[id].direction < 0 ? -1 : 1;                      // Asignacion: normaliza direccion.
  servoCfg[id].pwm0 = safePwmTick(servoCfg[id].pwm0, PWM_MIN_TICK);                  // Asignacion: protege pulso 0 grados.
  servoCfg[id].pwm270 = safePwmTick(servoCfg[id].pwm270, PWM_MAX_TICK);              // Asignacion: protege pulso 270 grados.
  if (abs(servoCfg[id].pwm270 - servoCfg[id].pwm0) < 10) {                           // Condicion: evita pulso fijo que parece servo apagado.
    servoCfg[id].pwm0 = PWM_MIN_TICK;                                                // Asignacion: restaura pulso minimo.
    servoCfg[id].pwm270 = PWM_MAX_TICK;                                              // Asignacion: restaura pulso maximo.
  }
  servoCfg[id].offsetDeg = constrain(finiteOrDefault(servoCfg[id].offsetDeg, 0.0f), -90.0f, 90.0f);
}

void sanitizeTuning() {                                                               // Funcion sanitizeTuning: impide que la rampa deje los servos inmoviles.
  assistLevel = constrain(finiteOrDefault(assistLevel, BOOT_ASSIST_LEVEL), 0.0f, 1.0f);
  deadbandDeg = constrain(finiteOrDefault(deadbandDeg, CONTROL_DEADBAND_DEFAULT), 0.0f, 30.0f);
  smoothing = constrain(finiteOrDefault(smoothing, CONTROL_SMOOTHING_DEFAULT), 0.05f, 1.0f);
  maxSpeedDegSec = constrain(finiteOrDefault(maxSpeedDegSec, CONTROL_MAX_SPEED_DEFAULT), 5.0f, CONTROL_MAX_SPEED_DEFAULT);
  if (assistLevel < BOOT_ASSIST_LEVEL) assistLevel = BOOT_ASSIST_LEVEL;               // Mantiene fuerza aunque existan preferencias viejas.
  if (deadbandDeg > CONTROL_DEADBAND_DEFAULT) deadbandDeg = CONTROL_DEADBAND_DEFAULT; // Mantiene sensibilidad aunque existan preferencias viejas.
  if (smoothing < CONTROL_SMOOTHING_DEFAULT || smoothing > CONTROL_SMOOTHING_DEFAULT) smoothing = CONTROL_SMOOTHING_DEFAULT; // Fuerza respuesta directa aunque existan preferencias viejas.
  if (maxSpeedDegSec < CONTROL_MAX_SPEED_DEFAULT) maxSpeedDegSec = CONTROL_MAX_SPEED_DEFAULT;
}

void sanitizeRuntimeConfig() {                                                        // Funcion sanitizeRuntimeConfig: sanea todo lo cargado desde NVS/app.
  sanitizeTuning();                                                                   // Llamada: normaliza parametros de rampa.
  for (int i = 0; i < N_SERVOS; i++) sanitizeServoConfig(i);                         // Bucle: normaliza todos los servos.
}

void applyTuningObject(JsonObject tuning) {                                           // Funcion applyTuningObject: aplica asistencia, zona muerta, suavizado y velocidad.
  if (tuning.isNull()) return;                                                        // Condicion: ignora comandos sin tuning.
  if (!tuning["assistLevel"].isNull()) assistLevel = tuning["assistLevel"].as<float>();
  else if (!tuning["level"].isNull()) assistLevel = tuning["level"].as<float>();      // Compatibilidad con cmd_assist.
  if (!tuning["deadbandDeg"].isNull()) deadbandDeg = tuning["deadbandDeg"].as<float>();
  if (!tuning["smoothing"].isNull()) smoothing = tuning["smoothing"].as<float>();
  if (!tuning["maxSpeedDegSec"].isNull()) maxSpeedDegSec = tuning["maxSpeedDegSec"].as<float>();
  sanitizeTuning();                                                                   // Llamada: evita valores viejos que vuelvan lenta la rampa.
}

void loadPrefs() {                                                                    // Funcion loadPrefs: lee calibracion persistida en memoria no volatil.
  setDefaults();                                                                      // Llamada: ejecuta API de hardware, red o utilidad local.
  prefs.begin("vesta", true);                                                         // Llamada: ejecuta API de hardware, red o utilidad local.
  assistLevel = prefs.getFloat("assist", assistLevel);                                // Asignacion: actualiza estado del firmware.
  deadbandDeg = prefs.getFloat("deadband", deadbandDeg);                              // Asignacion: actualiza estado del firmware.
  smoothing = prefs.getFloat("smooth", smoothing);                                    // Asignacion: actualiza estado del firmware.
  maxSpeedDegSec = prefs.getFloat("maxspd", maxSpeedDegSec);                          // Asignacion: actualiza estado del firmware.

  for (int i = 0; i < N_SERVOS; i++) {                                                // Bucle: recorre muestras, servos o clientes.
    char key[18];                                                                     // Arreglo key: coleccion de key.
    // Llamada: ejecuta API de hardware, red o utilidad local.
    snprintf(key, sizeof(key), "s%d_ch", i); servoCfg[i].channel = (uint8_t)constrain(prefs.getInt(key, servoCfg[i].channel), 0, 15);
    snprintf(key, sizeof(key), "s%d_min", i); servoCfg[i].minDeg = prefs.getFloat(key, servoCfg[i].minDeg); // Llamada: ejecuta API de hardware, red o utilidad local.
    snprintf(key, sizeof(key), "s%d_max", i); servoCfg[i].maxDeg = prefs.getFloat(key, servoCfg[i].maxDeg); // Llamada: ejecuta API de hardware, red o utilidad local.
    snprintf(key, sizeof(key), "s%d_home", i); servoCfg[i].homeDeg = prefs.getFloat(key, servoCfg[i].homeDeg); // Llamada: ejecuta API de hardware, red o utilidad local.
    snprintf(key, sizeof(key), "s%d_dir", i); servoCfg[i].direction = prefs.getChar(key, servoCfg[i].direction); // Llamada: ejecuta API de hardware, red o utilidad local.
    snprintf(key, sizeof(key), "s%d_p0", i); servoCfg[i].pwm0 = prefs.getInt(key, servoCfg[i].pwm0); // Llamada: ejecuta API de hardware, red o utilidad local.
    snprintf(key, sizeof(key), "s%d_p270", i); servoCfg[i].pwm270 = prefs.getInt(key, servoCfg[i].pwm270); // Llamada: ejecuta API de hardware, red o utilidad local.
    snprintf(key, sizeof(key), "s%d_off", i); servoCfg[i].offsetDeg = prefs.getFloat(key, servoCfg[i].offsetDeg); // Llamada: ejecuta API de hardware, red o utilidad local.
  }

  for (int i = 0; i < NUM_IMUS; i++) {                                                // Bucle: recorre muestras, servos o clientes.
    char key[18];                                                                     // Arreglo key: coleccion de key.
    snprintf(key, sizeof(key), "i%d_neu", i); imuCfg[i].neutralDeg = prefs.getFloat(key, imuCfg[i].neutralDeg); // Llamada: ejecuta API de hardware, red o utilidad local.
    snprintf(key, sizeof(key), "i%d_min", i); imuCfg[i].minDeg = prefs.getFloat(key, imuCfg[i].minDeg); // Llamada: ejecuta API de hardware, red o utilidad local.
    snprintf(key, sizeof(key), "i%d_max", i); imuCfg[i].maxDeg = prefs.getFloat(key, imuCfg[i].maxDeg); // Llamada: ejecuta API de hardware, red o utilidad local.
    snprintf(key, sizeof(key), "i%d_inv", i); imuCfg[i].invert = prefs.getBool(key, imuCfg[i].invert); // Llamada: ejecuta API de hardware, red o utilidad local.
  }

  for (int i = 0; i < NUM_AS5600; i++) {                                              // Bucle: recorre muestras, servos o clientes.
    char key[18];                                                                     // Arreglo key: coleccion de key.
    snprintf(key, sizeof(key), "a%d_r0", i); as5600Cfg[i].raw0 = prefs.getInt(key, as5600Cfg[i].raw0); // Llamada: ejecuta API de hardware, red o utilidad local.
    snprintf(key, sizeof(key), "a%d_r90", i); as5600Cfg[i].raw90 = prefs.getInt(key, as5600Cfg[i].raw90); // Llamada: ejecuta API de hardware, red o utilidad local.
    snprintf(key, sizeof(key), "a%d_neu", i); as5600Cfg[i].neutralDeg = prefs.getFloat(key, as5600Cfg[i].neutralDeg); // Llamada: ejecuta API de hardware, red o utilidad local.
    snprintf(key, sizeof(key), "a%d_inv", i); as5600Cfg[i].invert = prefs.getBool(key, as5600Cfg[i].invert); // Llamada: ejecuta API de hardware, red o utilidad local.
  }
  prefs.end();                                                                        // Llamada: ejecuta API de hardware, red o utilidad local.
  sanitizeRuntimeConfig();                                                            // Llamada: protege contra perfiles corruptos guardados.
}

void savePrefs() {                                                                    // Funcion savePrefs: guarda calibracion persistida en memoria no volatil.
  sanitizeRuntimeConfig();                                                            // Llamada: solo persiste parametros seguros.
  prefs.begin("vesta", false);                                                        // Llamada: ejecuta API de hardware, red o utilidad local.
  prefs.putFloat("assist", assistLevel);                                              // Llamada: ejecuta API de hardware, red o utilidad local.
  prefs.putFloat("deadband", deadbandDeg);                                            // Llamada: ejecuta API de hardware, red o utilidad local.
  prefs.putFloat("smooth", smoothing);                                                // Llamada: ejecuta API de hardware, red o utilidad local.
  prefs.putFloat("maxspd", maxSpeedDegSec);                                           // Llamada: ejecuta API de hardware, red o utilidad local.

  for (int i = 0; i < N_SERVOS; i++) {                                                // Bucle: recorre muestras, servos o clientes.
    char key[18];                                                                     // Arreglo key: coleccion de key.
    snprintf(key, sizeof(key), "s%d_ch", i); prefs.putInt(key, servoCfg[i].channel);  // Llamada: ejecuta API de hardware, red o utilidad local.
    snprintf(key, sizeof(key), "s%d_min", i); prefs.putFloat(key, servoCfg[i].minDeg); // Llamada: ejecuta API de hardware, red o utilidad local.
    snprintf(key, sizeof(key), "s%d_max", i); prefs.putFloat(key, servoCfg[i].maxDeg); // Llamada: ejecuta API de hardware, red o utilidad local.
    snprintf(key, sizeof(key), "s%d_home", i); prefs.putFloat(key, servoCfg[i].homeDeg); // Llamada: ejecuta API de hardware, red o utilidad local.
    snprintf(key, sizeof(key), "s%d_dir", i); prefs.putChar(key, servoCfg[i].direction); // Llamada: ejecuta API de hardware, red o utilidad local.
    snprintf(key, sizeof(key), "s%d_p0", i); prefs.putInt(key, servoCfg[i].pwm0);     // Llamada: ejecuta API de hardware, red o utilidad local.
    snprintf(key, sizeof(key), "s%d_p270", i); prefs.putInt(key, servoCfg[i].pwm270); // Llamada: ejecuta API de hardware, red o utilidad local.
    snprintf(key, sizeof(key), "s%d_off", i); prefs.putFloat(key, servoCfg[i].offsetDeg); // Llamada: ejecuta API de hardware, red o utilidad local.
  }

  for (int i = 0; i < NUM_IMUS; i++) {                                                // Bucle: recorre muestras, servos o clientes.
    char key[18];                                                                     // Arreglo key: coleccion de key.
    snprintf(key, sizeof(key), "i%d_neu", i); prefs.putFloat(key, imuCfg[i].neutralDeg); // Llamada: ejecuta API de hardware, red o utilidad local.
    snprintf(key, sizeof(key), "i%d_min", i); prefs.putFloat(key, imuCfg[i].minDeg);  // Llamada: ejecuta API de hardware, red o utilidad local.
    snprintf(key, sizeof(key), "i%d_max", i); prefs.putFloat(key, imuCfg[i].maxDeg);  // Llamada: ejecuta API de hardware, red o utilidad local.
    snprintf(key, sizeof(key), "i%d_inv", i); prefs.putBool(key, imuCfg[i].invert);   // Llamada: ejecuta API de hardware, red o utilidad local.
  }

  for (int i = 0; i < NUM_AS5600; i++) {                                              // Bucle: recorre muestras, servos o clientes.
    char key[18];                                                                     // Arreglo key: coleccion de key.
    snprintf(key, sizeof(key), "a%d_r0", i); prefs.putInt(key, as5600Cfg[i].raw0);    // Llamada: ejecuta API de hardware, red o utilidad local.
    snprintf(key, sizeof(key), "a%d_r90", i); prefs.putInt(key, as5600Cfg[i].raw90);  // Llamada: ejecuta API de hardware, red o utilidad local.
    snprintf(key, sizeof(key), "a%d_neu", i); prefs.putFloat(key, as5600Cfg[i].neutralDeg); // Llamada: ejecuta API de hardware, red o utilidad local.
    snprintf(key, sizeof(key), "a%d_inv", i); prefs.putBool(key, as5600Cfg[i].invert); // Llamada: ejecuta API de hardware, red o utilidad local.
  }
  prefs.end();                                                                        // Llamada: ejecuta API de hardware, red o utilidad local.
}

void applyBootBehavior() {                                                            // Funcion applyBootBehavior: normaliza modo y asistencia al iniciar.
  opMode = String(normalizeRequestedMode(BOOT_MODE));                                 // Asignacion: arranca manual si la prueba sin sensores esta activa.
  sanitizeTuning();                                                                    // Llamada: normaliza asistencia y rampa.
}

bool i2cPing(uint8_t addr) {                                                          // Funcion i2cPing: comprueba presencia de un dispositivo I2C.
  Wire.beginTransmission(addr);                                                       // Llamada: ejecuta API de hardware, red o utilidad local.
  return Wire.endTransmission() == 0;                                                 // Retorno: informa resultado de la operacion.
}

bool tcaSel(uint8_t ch) {                                                             // Funcion tcaSel: selecciona un canal del multiplexor TCA9548A.
  Wire.beginTransmission(TCA_ADDR);                                                   // Llamada: ejecuta API de hardware, red o utilidad local.
  Wire.write(ch < 8 ? (1 << ch) : 0x00);                                              // Llamada: ejecuta API de hardware, red o utilidad local.
  return Wire.endTransmission() == 0;                                                 // Retorno: informa resultado de la operacion.
}

void tcaOff() {                                                                       // Funcion tcaOff: desactiva todos los canales del TCA9548A.
  Wire.beginTransmission(TCA_ADDR);                                                   // Llamada: ejecuta API de hardware, red o utilidad local.
  Wire.write(0x00);                                                                   // Llamada: ejecuta API de hardware, red o utilidad local.
  Wire.endTransmission();                                                             // Llamada: ejecuta API de hardware, red o utilidad local.
}

// Returns the IMU index (0..NUM_IMUS-1) that is physically wired to the given
// TCA9548A channel, or -1 if no IMU uses that channel.
int imuIndexForChannel(uint8_t ch) {                                                  // Funcion imuIndexForChannel: encapsula la logica de lectura de sensores IMU/I2C.
  for (int i = 0; i < NUM_IMUS; i++) {                                                // Bucle: recorre muestras, servos o clientes.
    if (IMU_TCA_CHANNEL[i] == ch) return i;                                           // Condicion: valida estado de hardware o comando.
  }
  return -1;                                                                          // Retorno: informa resultado de la operacion.
}

int as5600IndexForChannel(uint8_t ch) {                                               // Funcion as5600IndexForChannel: resuelve el AS5600 conectado a un canal TCA.
  for (int i = 0; i < NUM_AS5600; i++) {                                              // Bucle: recorre muestras, servos o clientes.
    if (AS5600_TCA_CHANNEL[i] == ch) return i;                                        // Condicion: valida estado de hardware o comando.
  }
  return -1;                                                                          // Retorno: informa resultado de la operacion.
}

uint8_t scanI2CAddresses(uint8_t* addresses, uint8_t capacity) {                      // Funcion scanI2CAddresses: escanea direcciones I2C disponibles.
  uint8_t found = 0;                                                                  // Variable found: estado mutable de found.
  uint8_t stored = 0;                                                                 // Variable stored: estado mutable de stored.
  for (uint8_t addr = 1; addr < 0x7f; addr++) {                                       // Bucle: recorre muestras, servos o clientes.
    Wire.beginTransmission(addr);                                                     // Llamada: ejecuta API de hardware, red o utilidad local.
    uint8_t err = Wire.endTransmission();                                             // Variable err: estado mutable de err.
    if (err == 0) {                                                                   // Condicion: valida estado de hardware o comando.
      if (addresses && stored < capacity) addresses[stored++] = addr;                 // Condicion: valida estado de hardware o comando.
      found++;
    }
    delayMicroseconds(100);                                                           // Llamada: ejecuta API de hardware, red o utilidad local.
  }
  return found;                                                                       // Retorno: informa resultado de la operacion.
}

void scanI2CDevices(const char* label) {                                              // Funcion scanI2CDevices: reporta dispositivos I2C detectados.
  uint8_t addresses[16] = {0};                                                        // Arreglo addresses: arreglo de datos para addresses.
  uint8_t found = scanI2CAddresses(addresses, sizeof(addresses));                     // Variable found: estado mutable de found.
  Serial.printf("[I2C] scan %s:", label);                                             // Llamada: ejecuta API de hardware, red o utilidad local.
  for (uint8_t i = 0; i < found && i < sizeof(addresses); i++) {                      // Bucle: recorre muestras, servos o clientes.
    Serial.printf(" 0x%02X", addresses[i]);                                           // Llamada: ejecuta API de hardware, red o utilidad local.
  }
  if (found > sizeof(addresses)) Serial.print(" ...");                                // Condicion: valida estado de hardware o comando.
  if (found == 0) Serial.print(" none");                                              // Condicion: valida estado de hardware o comando.
  Serial.println();                                                                   // Llamada: ejecuta API de hardware, red o utilidad local.
}

void diagnoseI2CBus() {                                                               // Funcion diagnoseI2CBus: imprime diagnostico del bus I2C y canales TCA.
  tcaOff();                                                                           // Llamada: ejecuta API de hardware, red o utilidad local.
  scanI2CDevices("root");                                                             // Llamada: ejecuta API de hardware, red o utilidad local.

  if (!i2cPing(TCA_ADDR)) {                                                           // Condicion: valida estado de hardware o comando.
    Serial.printf("[I2C] TCA9548A missing at 0x%02X. Check SDA GPIO%d, SCL GPIO%d, VCC and common GND.\n", // Llamada: ejecuta API de hardware, red o utilidad local.
                  TCA_ADDR, PIN_SDA, PIN_SCL);
    return;                                                                           // Retorno: informa resultado de la operacion.
  }

  const uint8_t altMpuAddr = MPU_ADDR == 0x68 ? 0x69 : 0x68;                          // Variable altMpuAddr: constante usada en lectura de sensores IMU/I2C.
  Serial.printf("[I2C] TCA9548A OK at 0x%02X. Firmware expects MPU at 0x%02X and AS5600 at 0x%02X.\n", // Llamada: ejecuta API de hardware, red o utilidad local.
                TCA_ADDR, MPU_ADDR, AS5600_ADDR);
  for (uint8_t ch = 0; ch < 8; ch++) {                                                // Bucle: recorre muestras, servos o clientes.
    if (!tcaSel(ch)) {                                                                // Condicion: valida estado de hardware o comando.
      Serial.printf("[I2C] TCA ch %u: select failed\n", ch);                          // Llamada: ejecuta API de hardware, red o utilidad local.
      tcaOff();                                                                       // Llamada: ejecuta API de hardware, red o utilidad local.
      continue;
    }
    delayMicroseconds(IMU_READ_SETTLE_US);                                            // Llamada: ejecuta API de hardware, red o utilidad local.
    bool primary = i2cPing(MPU_ADDR);                                                 // Variable primary: estado mutable de primary.
    bool alternate = i2cPing(altMpuAddr);                                             // Variable alternate: estado mutable de alternate.
    bool as5600 = i2cPing(AS5600_ADDR);                                               // Variable as5600: estado mutable de as5600.
    Serial.printf("[I2C] TCA ch %u: 0x%02X %s, 0x%02X %s, AS5600 0x%02X %s",           // Llamada: ejecuta API de hardware, red o utilidad local.
                  ch,
                  MPU_ADDR,
                  primary ? "OK" : "--",
                  altMpuAddr,
                  alternate ? "OK" : "--",
                  AS5600_ADDR,
                  as5600 ? "OK" : "--");
    if (imuIndexForChannel(ch) >= 0 && !primary && alternate) {                       // Condicion: valida estado de hardware o comando.
      Serial.print(" (AD0/address mismatch)");                                        // Llamada: ejecuta API de hardware, red o utilidad local.
    }
    if (as5600IndexForChannel(ch) >= 0 && !as5600) {                                  // Condicion: valida estado de hardware o comando.
      Serial.print(" (AS5600 esperado)");                                             // Llamada: ejecuta API de hardware, red o utilidad local.
    }
    Serial.println();                                                                 // Llamada: ejecuta API de hardware, red o utilidad local.
    tcaOff();                                                                         // Llamada: ejecuta API de hardware, red o utilidad local.
    delay(2);                                                                         // Llamada: ejecuta API de hardware, red o utilidad local.
  }
}

float imuAccelAngleDeg(int idx, int16_t ax, int16_t ay, int16_t az) {                 // Funcion imuAccelAngleDeg: estima angulo desde acelerometro MPU6050.
  const float fax = ax / 16384.0f;                                                    // Variable fax: constante usada en fax.
  const float fay = ay / 16384.0f;                                                    // Variable fay: constante usada en fay.
  const float faz = az / 16384.0f;                                                    // Variable faz: constante usada en faz.
  const float angle = (idx == IMU_L_LAT || idx == IMU_R_LAT)                          // Variable angle: constante usada en control angular de servos.
    ? atan2f(fay, faz) * 180.0f / PI + 90.0f
    : atan2f(fax, faz) * 180.0f / PI + 90.0f;
  return constrain(angle, 0.0f, 180.0f);                                              // Retorno: informa resultado de la operacion.
}

float clampServoDeg(int id, float deg) {                                              // Funcion clampServoDeg: limita el angulo de servo a rangos seguros.
  float mn = max(SRV_HARD_MIN[id], servoCfg[id].minDeg);                              // Variable mn: estado mutable de mn.
  float mx = min(SRV_HARD_MAX[id], servoCfg[id].maxDeg);                              // Variable mx: estado mutable de mx.
  return constrain(deg, mn, mx);                                                      // Retorno: informa resultado de la operacion.
}

uint8_t servoPcaChannel(int id) {                                                     // Funcion servoPcaChannel: resuelve el canal PCA9685 de un servo.
  return (uint8_t)constrain((int)servoCfg[id].channel, 0, 15);                        // Retorno: informa resultado de la operacion.
}

int angleToPwm(int id, float deg) {                                                   // Funcion angleToPwm: convierte grados logicos a pulso PWM.
  deg = clampServoDeg(id, deg);                                                       // Asignacion: actualiza estado del firmware.
  float logical = servoCfg[id].direction < 0                                          // Variable logical: estado mutable de logical.
                    ? 270.0f - deg + servoCfg[id].offsetDeg
                    : deg + servoCfg[id].offsetDeg;
  logical = constrain(logical, 0.0f, 270.0f);                                         // Asignacion: actualiza estado del firmware.
  float span = (float)(servoCfg[id].pwm270 - servoCfg[id].pwm0);                      // Variable span: estado mutable de span.
  int pulse = servoCfg[id].pwm0 + (int)((logical / 270.0f) * span);                   // Variable pulse: estado mutable de pulse.
  return constrain(pulse, min(servoCfg[id].pwm0, servoCfg[id].pwm270), max(servoCfg[id].pwm0, servoCfg[id].pwm270)); // Retorno: informa resultado de la operacion.
}

void writeServo(int id, float deg) {                                                  // Funcion writeServo: aplica el PWM calculado a un servo.
  currentDeg[id] = clampServoDeg(id, deg);                                            // Asignacion: actualiza estado del firmware.
  pca.setPWM(servoPcaChannel(id), 0, angleToPwm(id, currentDeg[id]));                 // Llamada: ejecuta API de hardware, red o utilidad local.
}

void writeAllServos(float deg) {                                                      // Funcion writeAllServos: mueve los 6 canales PCA9685 al mismo angulo.
  for (int i = 0; i < N_SERVOS; i++) {
    targetDeg[i] = clampServoDeg(i, deg);
    writeServo(i, targetDeg[i]);
  }
}

void initializeServosSafely() {                                                       // Funcion initializeServosSafely: arranca sin mover ni energizar servos.
  if (!pcaOnline) {
    servosArmed = false;                                                              // Asignacion: evita salida PWM si el driver no esta disponible.
    Serial.println("[SERVO] Safe startup: PCA9685 offline, PWM not enabled.");
    return;
  }

  servosArmed = false;                                                                // Asignacion: el operador debe armar con comando explicito.
  releaseServos();                                                                    // Llamada: libera los canales PCA9685 sin mover a home.
  Serial.println("[SERVO] Safe startup: servos disarmed, PWM released, no home move or boot sweep.");
}

void releaseServos() {                                                                // Funcion releaseServos: libera la senal PWM de todos los servos.
  if (!pcaOnline) return;                                                             // Condicion: evita escribir al driver si no esta presente.
  for (int i = 0; i < N_SERVOS; i++) {                                                // Bucle: recorre muestras, servos o clientes.
    pca.setPWM(servoPcaChannel(i), 0, 4096);                                          // Llamada: ejecuta API de hardware, red o utilidad local.
  }
}

void armServos(const char* reason) {                                                  // Funcion armServos: habilita PWM solo por orden explicita del operador.
  if (emergency) return;                                                              // Condicion: no arma mientras el paro esta activo.
  if (!pcaOnline) {                                                                   // Condicion: evita asumir control si el PCA no responde.
    Serial.printf("[SERVO] Arm rejected: PCA9685 offline (%s)\n", reason);
    return;
  }
  if (!servosArmed) {
    servosArmed = true;                                                               // Asignacion: permite que updateServos escriba PWM.
    Serial.printf("[SERVO] Armed by %s; first PWM follows current targets.\n", reason);
  }
}

void disarmServos(const char* reason) {                                               // Funcion disarmServos: vuelve al estado seguro sin PWM.
  servosArmed = false;                                                                // Asignacion: bloquea el lazo de control.
  releaseServos();                                                                    // Llamada: libera senal PWM en todos los canales.
  Serial.printf("[SERVO] Disarmed: %s\n", reason);
}

void setEmergency(bool active, const char* reason) {                                  // Funcion setEmergency: activa o limpia el estado de paro de emergencia.
  if (active == emergency) return;                                                    // Condicion: valida estado de hardware o comando.
  const bool wasArmed = servosArmed;                                                  // Variable wasArmed: recuerda si habia PWM activo antes del paro.
  emergency = active;                                                                 // Asignacion: actualiza estado del firmware.
  if (active) {                                                                       // Condicion: valida estado de hardware o comando.
    opMode = "emergency";                                                             // Asignacion: actualiza estado del firmware.
    servosArmed = false;                                                              // Asignacion: bloquea nuevos movimientos durante emergencia.
#if ESTOP_RELEASES_SERVOS                                                             // Directiva de compilacion: activa codigo segun configuracion.
    releaseServos();                                                                  // Llamada: ejecuta API de hardware, red o utilidad local.
#else                                                                                 // Directiva de compilacion: activa codigo segun configuracion.
    if (wasArmed) {
      for (int i = 0; i < N_SERVOS; i++) writeServo(i, currentDeg[i]);                // Bucle: retiene la ultima posicion solo si ya habia PWM activo.
    } else {
      releaseServos();                                                                // Llamada: no energiza servos si el sistema ya estaba desarmado.
    }
#endif                                                                                // Cierre de directiva de compilacion condicional.
    Serial.printf("[ESTOP] ACTIVE: %s\n", reason);                                    // Llamada: ejecuta API de hardware, red o utilidad local.
  } else {
    applyBootBehavior();                                                              // Llamada: ejecuta API de hardware, red o utilidad local.
    Serial.println("[ESTOP] CLEARED");                                                // Llamada: ejecuta API de hardware, red o utilidad local.
  }
}

bool imuPacketLooksValid(int16_t ax, int16_t ay, int16_t az, int16_t gx, int16_t gy, int16_t gz) { // Funcion imuPacketLooksValid: encapsula la logica de lectura de sensores IMU/I2C.
  if (ax == 0 && ay == 0 && az == 0 && gx == 0 && gy == 0 && gz == 0) return false;   // Condicion: valida estado de hardware o comando.
  const float accelG2 =                                                               // Variable accelG2: constante usada en accel g2.
    (float)ax * (float)ax / (16384.0f * 16384.0f) +
    (float)ay * (float)ay / (16384.0f * 16384.0f) +
    (float)az * (float)az / (16384.0f * 16384.0f);
  return accelG2 > 0.04f && accelG2 < 5.0f;                                           // Retorno: informa resultado de la operacion.
}

bool readImuMotion(int idx, int16_t& ax, int16_t& ay, int16_t& az, int16_t& gx, int16_t& gy, int16_t& gz) { // Funcion readImuMotion: lee una muestra cruda valida desde una IMU.
  if (!tcaSel(IMU_TCA_CHANNEL[idx])) {                                                // Condicion: valida estado de hardware o comando.
    tcaOff();                                                                         // Llamada: ejecuta API de hardware, red o utilidad local.
    return false;                                                                     // Retorno: informa resultado de la operacion.
  }
  delayMicroseconds(IMU_READ_SETTLE_US);                                              // Llamada: ejecuta API de hardware, red o utilidad local.
  imu[idx].getMotion6(&ax, &ay, &az, &gx, &gy, &gz);
  tcaOff();                                                                           // Llamada: ejecuta API de hardware, red o utilidad local.

  if (!imuPacketLooksValid(ax, ay, az, gx, gy, gz)) return false;                     // Condicion: valida estado de hardware o comando.
  if (!imuOnline[idx]) Serial.printf("[IMU] bus %d recovered\n", idx);                // Condicion: valida estado de hardware o comando.
  imuOnline[idx] = true;                                                              // Asignacion: actualiza estado del firmware.
  imuFaults[idx] = 0;                                                                 // Asignacion: actualiza estado del firmware.
  return true;                                                                        // Retorno: informa resultado de la operacion.
}

float readImuRawDeg(int idx) {                                                        // Funcion readImuRawDeg: lee imu raw deg.
  int16_t ax, ay, az, gx, gy, gz;
  if (!readImuMotion(idx, ax, ay, az, gx, gy, gz)) {                                  // Condicion: valida estado de hardware o comando.
    if (imuFaults[idx] < 255) imuFaults[idx]++;                                       // Condicion: valida estado de hardware o comando.
    if (imuOnline[idx] && imuFaults[idx] >= IMU_FAIL_LIMIT) {                         // Condicion: valida estado de hardware o comando.
      imuOnline[idx] = false;                                                         // Asignacion: actualiza estado del firmware.
      Serial.printf("[IMU] bus %d lost signal\n", idx);                               // Llamada: ejecuta API de hardware, red o utilidad local.
    }
    return cf[idx].ready ? constrain(cf[idx].angle, 0.0f, 180.0f) : 0.0f;             // Retorno: informa resultado de la operacion.
  }

  // Keep the accelerometer gravity vector intact; neutral angle is handled by
  // imuCfg.neutralDeg, while calibration removes only gyro drift.

  float gyroRate;                                                                     // Declaracion gyroRate: dato de gyro rate.
  if (idx == IMU_L_LAT || idx == IMU_R_LAT) {                                         // Condicion: valida estado de hardware o comando.
    gyroRate = (gy - imuOff[idx].gy) / 131.0f;                                        // Asignacion: actualiza estado del firmware.
  } else {
    gyroRate = (gx - imuOff[idx].gx) / 131.0f;                                        // Asignacion: actualiza estado del firmware.
  }
  gyroRate = constrain(gyroRate, -IMU_GYRO_RATE_LIMIT_DPS, IMU_GYRO_RATE_LIMIT_DPS);  // Asignacion: actualiza estado del firmware.

  float accelAngle = imuAccelAngleDeg(idx, ax, ay, az);                               // Variable accelAngle: estado mutable de control angular de servos.

  unsigned long nowUs = micros();                                                     // Variable nowUs: estado mutable de now us.
  CompFilter& f = cf[idx];
  if (!f.ready) {                                                                     // Condicion: valida estado de hardware o comando.
    f.angle = accelAngle;                                                             // Asignacion: actualiza estado del firmware.
    f.lastUs = nowUs;                                                                 // Asignacion: actualiza estado del firmware.
    f.ready = true;                                                                   // Asignacion: actualiza estado del firmware.
    return accelAngle;                                                                // Retorno: informa resultado de la operacion.
  }

  float dt = (nowUs - f.lastUs) * 1.0e-6f;                                            // Variable dt: estado mutable de dt.
  dt = constrain(dt, 0.001f, IMU_DT_MAX_SEC);                                         // Asignacion: actualiza estado del firmware.
  f.lastUs = nowUs;                                                                   // Asignacion: actualiza estado del firmware.
  if (fabsf(accelAngle - f.angle) > IMU_ACCEL_JUMP_LIMIT_DEG) accelAngle = f.angle;   // Condicion: valida estado de hardware o comando.
  float predicted = constrain(f.angle + gyroRate * dt, 0.0f, 180.0f);                 // Variable predicted: estado mutable de predicted.
  f.angle = COMP_ALPHA * predicted + (1.0f - COMP_ALPHA) * accelAngle;                // Asignacion: actualiza estado del firmware.
  return constrain(f.angle, 0.0f, 180.0f);                                            // Retorno: informa resultado de la operacion.
}

float readImuDeg(int idx) {                                                           // Funcion readImuDeg: filtra y entrega el angulo operativo de una IMU.
  float raw = readImuRawDeg(idx);                                                     // Variable raw: estado mutable de raw.
  float deg = (raw - imuCfg[idx].neutralDeg) * (imuCfg[idx].invert ? -1.0f : 1.0f);   // Variable deg: estado mutable de control angular de servos.
  float lo = min(imuCfg[idx].minDeg, imuCfg[idx].maxDeg);                             // Variable lo: estado mutable de lo.
  float hi = max(imuCfg[idx].minDeg, imuCfg[idx].maxDeg);                             // Variable hi: estado mutable de hi.
#if IMU_USE_ABSOLUTE_DELTA                                                            // Directiva de compilacion: activa codigo segun configuracion.
  deg = fabsf(deg);                                                                   // Asignacion: actualiza estado del firmware.
  lo = 0.0f;                                                                          // Asignacion: actualiza estado del firmware.
  hi = max(fabsf(imuCfg[idx].minDeg), fabsf(imuCfg[idx].maxDeg));                     // Asignacion: actualiza estado del firmware.
  if (hi < 1.0f) hi = IMU_DEFAULT_MAX_DEG[idx];                                       // Condicion: valida estado de hardware o comando.
#endif                                                                                // Cierre de directiva de compilacion condicional.
  deg = constrain(deg, lo, hi);                                                       // Asignacion: actualiza estado del firmware.

  CompFilter& f = cf[idx];
  if (!f.degReady) {                                                                  // Condicion: valida estado de hardware o comando.
    f.deg = deg;                                                                      // Asignacion: actualiza estado del firmware.
    f.degReady = true;                                                                // Asignacion: actualiza estado del firmware.
    return deg;                                                                       // Retorno: informa resultado de la operacion.
  }

  const float alpha = constrain(IMU_OUTPUT_EMA_ALPHA, 0.05f, 1.0f);                   // Variable alpha: constante usada en alpha.
  f.deg += (deg - f.deg) * alpha;
  return constrain(f.deg, lo, hi);                                                    // Retorno: informa resultado de la operacion.
}

const uint8_t AS5600_REG_RAW_ANGLE = 0x0C;                                            // Variable AS5600_REG_RAW_ANGLE: registro raw angle del AS5600.

float as5600WrapCounts(float value) {                                                 // Funcion as5600WrapCounts: normaliza cuentas raw 0..4095.
  while (value < 0.0f) value += AS5600_COUNTS_PER_REV;
  while (value >= AS5600_COUNTS_PER_REV) value -= AS5600_COUNTS_PER_REV;
  return value;                                                                       // Retorno: informa resultado de la operacion.
}

float as5600SignedDelta(float from, float to) {                                       // Funcion as5600SignedDelta: delta corto con envoltura circular.
  float delta = as5600WrapCounts(to) - as5600WrapCounts(from);                        // Variable delta: estado mutable de delta.
  if (delta > AS5600_COUNTS_PER_REV / 2.0f) delta -= AS5600_COUNTS_PER_REV;           // Condicion: valida estado de hardware o comando.
  if (delta < -AS5600_COUNTS_PER_REV / 2.0f) delta += AS5600_COUNTS_PER_REV;          // Condicion: valida estado de hardware o comando.
  return delta;                                                                       // Retorno: informa resultado de la operacion.
}

bool readAs5600Raw(int idx, int& raw) {                                               // Funcion readAs5600Raw: lee RAW_ANGLE del AS5600 por TCA/I2C.
  if (idx < 0 || idx >= NUM_AS5600) return false;                                     // Condicion: valida estado de hardware o comando.
  if (!tcaSel(AS5600_TCA_CHANNEL[idx])) {                                             // Condicion: valida estado de hardware o comando.
    tcaOff();                                                                         // Llamada: ejecuta API de hardware, red o utilidad local.
    return false;                                                                     // Retorno: informa resultado de la operacion.
  }
  delayMicroseconds(IMU_READ_SETTLE_US);                                              // Llamada: ejecuta API de hardware, red o utilidad local.
  Wire.beginTransmission(AS5600_ADDR);                                                // Llamada: ejecuta API de hardware, red o utilidad local.
  Wire.write(AS5600_REG_RAW_ANGLE);                                                   // Llamada: ejecuta API de hardware, red o utilidad local.
  if (Wire.endTransmission(false) != 0) {                                             // Condicion: valida estado de hardware o comando.
    tcaOff();                                                                         // Llamada: ejecuta API de hardware, red o utilidad local.
    return false;                                                                     // Retorno: informa resultado de la operacion.
  }
  if (Wire.requestFrom((uint8_t)AS5600_ADDR, (uint8_t)2) != 2) {                      // Condicion: valida estado de hardware o comando.
    tcaOff();                                                                         // Llamada: ejecuta API de hardware, red o utilidad local.
    return false;                                                                     // Retorno: informa resultado de la operacion.
  }
  uint8_t hi = Wire.read();                                                           // Variable hi: estado mutable de hi.
  uint8_t lo = Wire.read();                                                           // Variable lo: estado mutable de lo.
  tcaOff();                                                                           // Llamada: ejecuta API de hardware, red o utilidad local.
  raw = (((int)hi & 0x0F) << 8) | lo;                                                 // Asignacion: actualiza estado del firmware.
  return raw >= 0 && raw < (int)AS5600_COUNTS_PER_REV;                                // Retorno: informa resultado de la operacion.
}

bool as5600UsesFactoryDefaults(int idx) {                                             // Funcion as5600UsesFactoryDefaults: detecta calibracion AS5600 sin capturar.
  return as5600Cfg[idx].raw0 == AS5600_RAW_0DEG_DEFAULT &&                            // Retorno: informa resultado de la operacion.
         as5600Cfg[idx].raw90 == AS5600_RAW_90DEG_DEFAULT &&                          // Asignacion: actualiza estado del firmware.
         fabsf(as5600Cfg[idx].neutralDeg) < 0.01f &&                                  // Llamada: ejecuta API de hardware, red o utilidad local.
         !as5600Cfg[idx].invert;
}

void resetAs5600Tracking(int idx) {                                                   // Funcion resetAs5600Tracking: reinicia tracking AS5600.
  if (idx < 0 || idx >= NUM_AS5600) return;                                           // Condicion: valida estado de hardware o comando.
  as5600BaseReady[idx] = false;                                                       // Asignacion: actualiza estado del firmware.
  as5600EmaReady[idx] = false;                                                        // Asignacion: actualiza estado del firmware.
  as5600Online[idx] = false;                                                          // Asignacion: actualiza estado del firmware.
  as5600Faults[idx] = 0;                                                              // Asignacion: actualiza estado del firmware.
  int servoId = idx == AS5600_L_ELB ? SRV_L_ELB : SRV_R_ELB;                          // Variable servoId: estado mutable de control angular de servos.
  sensorDeg[servoId] = 0.0f;                                                          // Asignacion: actualiza estado del firmware.
  sensorOnline[servoId] = false;                                                      // Asignacion: actualiza estado del firmware.
}

float readAs5600Deg(int idx) {                                                        // Funcion readAs5600Deg: convierte raw AS5600 a grados de codo.
  int raw = 0;                                                                        // Variable raw: estado mutable de raw.
  int servoId = idx == AS5600_L_ELB ? SRV_L_ELB : SRV_R_ELB;                          // Variable servoId: estado mutable de control angular de servos.
  if (!readAs5600Raw(idx, raw)) {                                                     // Condicion: valida estado de hardware o comando.
    if (as5600Faults[idx] < 255) as5600Faults[idx]++;                                 // Condicion: valida estado de hardware o comando.
    if (as5600Online[idx] && as5600Faults[idx] >= AS5600_FAIL_LIMIT) {                // Condicion: valida estado de hardware o comando.
      as5600Online[idx] = false;                                                      // Asignacion: actualiza estado del firmware.
      Serial.printf("[AS5600] sensor %d lost signal on TCA ch %d\n", idx, AS5600_TCA_CHANNEL[idx]); // Llamada: ejecuta API de hardware, red o utilidad local.
    }
    return sensorDeg[servoId];                                                        // Retorno: informa resultado de la operacion.
  }

  if (!as5600Online[idx]) Serial.printf("[AS5600] sensor %d recovered\n", idx);       // Condicion: valida estado de hardware o comando.
  as5600Online[idx] = true;                                                           // Asignacion: actualiza estado del firmware.
  as5600Faults[idx] = 0;                                                              // Asignacion: actualiza estado del firmware.
  as5600Raw[idx] = raw;                                                               // Asignacion: actualiza estado del firmware.

  if (!as5600EmaReady[idx]) {                                                         // Condicion: valida estado de hardware o comando.
    as5600Ema[idx] = (float)raw;                                                      // Asignacion: actualiza estado del firmware.
    as5600EmaReady[idx] = true;                                                       // Asignacion: actualiza estado del firmware.
  } else {
    float delta = as5600SignedDelta(as5600Ema[idx], (float)raw);                      // Variable delta: estado mutable de delta.
    as5600Ema[idx] = as5600WrapCounts(as5600Ema[idx] + delta * AS5600_EMA_ALPHA);     // Asignacion: actualiza estado del firmware.
  }

  if (!as5600BaseReady[idx]) {                                                        // Condicion: valida estado de hardware o comando.
    as5600BaseRaw[idx] = as5600Ema[idx];                                              // Asignacion: actualiza estado del firmware.
    as5600BaseReady[idx] = true;                                                      // Asignacion: actualiza estado del firmware.
  }

  float bootDelta = max(0.0f, fabsf(as5600SignedDelta(as5600BaseRaw[idx], as5600Ema[idx])) - AS5600_RAW_DEADBAND); // Variable bootDelta: estado mutable de boot delta.
  float autoDeg = constrain((bootDelta / AS5600_COUNTS_90_DEG) * 90.0f, 0.0f, 90.0f); // Variable autoDeg: estado mutable de control angular de servos.

  if (as5600UsesFactoryDefaults(idx)) return autoDeg;                                 // Condicion: valida estado de hardware o comando.

  float span = as5600SignedDelta((float)as5600Cfg[idx].raw0, (float)as5600Cfg[idx].raw90); // Variable span: estado mutable de span.
  if (fabsf(span) < 1.0f) return autoDeg;                                             // Condicion: valida estado de hardware o comando.
  float ratio = as5600SignedDelta((float)as5600Cfg[idx].raw0, as5600Ema[idx]) / span; // Variable ratio: estado mutable de ratio.
  float deg = constrain(ratio * 90.0f, 0.0f, 90.0f);                                  // Variable deg: estado mutable de control angular de servos.
  float delta = (deg - as5600Cfg[idx].neutralDeg) * (as5600Cfg[idx].invert ? -1.0f : 1.0f); // Variable delta: estado mutable de delta.
  return constrain(max(fabsf(delta), autoDeg), 0.0f, 90.0f);                          // Retorno: informa resultado de la operacion.
}

bool as5600IsOnline(int idx) {                                                        // Funcion as5600IsOnline: informa estado de sensores AS5600.
  if (idx < 0 || idx >= NUM_AS5600) return false;                                     // Condicion: valida estado de hardware o comando.
  if (!as5600EmaReady[idx]) return false;                                             // Condicion: valida estado de hardware o comando.
  return as5600Online[idx];                                                           // Retorno: informa resultado de la operacion.
}

float readLinkedSensorDeg(const SensorLink& link) {                                   // Funcion readLinkedSensorDeg: lee linked sensor deg.
  if (link.sensorKind == SENSOR_KIND_IMU) return readImuDeg(link.sensorId);           // Condicion: valida estado de hardware o comando.
  return readAs5600Deg(link.sensorId);                                                // Retorno: informa resultado de la operacion.
}

const char* sensorSourceName(const SensorLink& link) {                              // Funcion sensorSourceName: devuelve nombre legible del sensor enlazado a un servo.
  if (link.sensorKind == SENSOR_KIND_AS5600) {                                        // Condicion: valida estado de hardware o comando.
    return link.sensorId == AS5600_L_ELB ? "AS5600 izquierdo TCA4" : "AS5600 derecho TCA5"; // Retorno: informa resultado de la operacion.
  }
  switch (link.sensorId) {                                                            // Selector: despacha por tipo de evento o comando.
    case IMU_L_LAT: return "MPU TCA0 hombro izquierdo lateral";                       // Caso: evento o comando especifico.
    case IMU_L_FRO: return "MPU TCA1 hombro izquierdo frontal";                       // Caso: evento o comando especifico.
    case IMU_R_LAT: return "MPU TCA2 hombro derecho lateral";                         // Caso: evento o comando especifico.
    case IMU_R_FRO: return "MPU TCA3 hombro derecho frontal";                         // Caso: evento o comando especifico.
    default: return "MPU";                                                            // Campo default: dato miembro de estructura o JSON.
  }
}

const SensorLink& linkForServo(int servoId) {                                        // Funcion linkForServo: retorna el SensorLink correspondiente al ID de servo.
  for (int i = 0; i < N_SERVOS; i++) {                                                // Bucle: recorre muestras, servos o clientes.
    if (SENSOR_LINKS[i].servoId == servoId) return SENSOR_LINKS[i];                   // Condicion: valida estado de hardware o comando.
  }
  return SENSOR_LINKS[0];                                                             // Retorno: informa resultado de la operacion.
}

// Log Serial humano de los AS5600. Util cuando NO hay cliente WS conectado:
// la UI ya muestra raw/sensor por websocket, pero si el usuario solo tiene
// el monitor serial abierto puede ver desde aqui que el raw I2C esta leyendo.
// Pasa solo cuando no hay WS para no romper
// el parser JSON del PC.
void printAs5600Diag() {                                                              // Funcion printAs5600Diag: encapsula la logica de sensores AS5600.
  Serial.printf(                                                                      // Llamada: ejecuta API de hardware, red o utilidad local.
    "[AS5600] L raw=%d ema=%.0f base=%.0f deg=%.1f tgt=%.1f cur=%.1f on=%d | "
    "R raw=%d ema=%.0f base=%.0f deg=%.1f tgt=%.1f cur=%.1f on=%d | mode=%s\n",
    as5600Raw[0], as5600Ema[0], as5600BaseRaw[0],
    sensorDeg[SRV_L_ELB], targetDeg[SRV_L_ELB], currentDeg[SRV_L_ELB],
    as5600Online[0] ? 1 : 0,
    as5600Raw[1], as5600Ema[1], as5600BaseRaw[1],
    sensorDeg[SRV_R_ELB], targetDeg[SRV_R_ELB], currentDeg[SRV_R_ELB],
    as5600Online[1] ? 1 : 0,
    opMode.c_str()                                                                    // Llamada: ejecuta API de hardware, red o utilidad local.
  );
}

void readAllSensors() {                                                               // Funcion readAllSensors: actualiza lecturas de sensores enlazados.
  if (!sensorsEnabled()) return;                                                       // Condicion: en prueba manual no tocar IMU/AS5600.
  for (int i = 0; i < N_SERVOS; i++) {                                                // Bucle: recorre muestras, servos o clientes.
    const SensorLink& link = SENSOR_LINKS[i];
    const int servoId = link.servoId;                                                 // Variable servoId: constante usada en control angular de servos.
    // Leer primero (esto actualiza imuOnline/as5600Online/imuFaults) y
    // luego decidir si el valor es confiable. Si no lo es, NO tocamos
    // sensorDeg: conservamos la ultima lectura buena para que el servo
    // mantenga posicion en vez de saltar.
    float reading = readLinkedSensorDeg(link);                                        // Variable reading: estado mutable de reading.
    bool online = (link.sensorKind == SENSOR_KIND_IMU)                                // Variable online: estado mutable de online.
                    ? imuOnline[link.sensorId]
                    : as5600IsOnline(link.sensorId);
    // El servo debe seguir al sensor "sea como sea": cuando la lectura falla,
    // readImuDeg/readAs5600Deg ya devuelven el ultimo valor bueno retenido, asi
    // que asignar siempre es seguro y evita que un parpadeo del heuristico de
    // "online" congele el target y el servo deje de moverse.
    sensorDeg[servoId] = reading;                                                     // Asignacion: el servo sigue la ultima lectura (retenida si fallo).
    sensorOnline[servoId] = online;                                                   // Asignacion: solo informativo para la telemetria/UI.
  }
}

void updateTargetsFromSensors() {                                                     // Funcion updateTargetsFromSensors: calcula objetivos de servo desde sensores.
  if (!sensorsEnabled()) return;                                                       // Condicion: conserva targets enviados por la pagina manual.
  const bool sensorDrivenMode = opMode == "assisted" || opMode == "automatic";        // Variable sensorDrivenMode: constante usada en sensor driven mode.
#if !AS5600_ELBOW_ALWAYS_ON                                                           // Directiva de compilacion: activa codigo segun configuracion.
  if (!sensorDrivenMode) return;                                                      // Condicion: valida estado de hardware o comando.
#endif                                                                                // Cierre de directiva de compilacion condicional.

  const float modeGain = opMode == "assisted" ? (1.0f + assistLevel) : 1.0f;          // Variable modeGain: constante usada en control angular de servos.
  for (int i = 0; i < N_SERVOS; i++) {                                                // Bucle: recorre muestras, servos o clientes.
    const SensorLink& link = SENSOR_LINKS[i];
    const int servoId = link.servoId;                                                 // Variable servoId: constante usada en control angular de servos.
    const bool as5600Elbow = link.sensorKind == SENSOR_KIND_AS5600 &&                 // Variable as5600Elbow: constante usada en sensores AS5600.
                             (servoId == SRV_L_ELB || servoId == SRV_R_ELB);

#if AS5600_ELBOW_ALWAYS_ON                                                            // Directiva de compilacion: activa codigo segun configuracion.
    if (!sensorDrivenMode && !as5600Elbow) continue;                                  // Condicion: valida estado de hardware o comando.
#else                                                                                 // Directiva de compilacion: activa codigo segun configuracion.
    (void)as5600Elbow;
#endif                                                                                // Cierre de directiva de compilacion condicional.

    // NO bloqueamos por el heuristico "online": sensorDeg ya conserva la
    // ultima lectura buena cuando el sensor falla, asi que el servo sigue al
    // usuario en vez de quedarse congelado si la deteccion de online parpadea.
    // (Antes: if (!sensorOnline[servoId]) continue; -> los servos no se movian.)

    float value = sensorDeg[servoId];                                                 // Variable value: estado mutable de value.
    if (fabsf(value) < deadbandDeg) value = 0;                                        // Condicion: valida estado de hardware o comando.
    float gain = sensorDrivenMode ? modeGain : 1.0f;                                  // Variable gain: estado mutable de gain.
    targetDeg[servoId] = clampServoDeg(servoId, servoCfg[servoId].homeDeg + value * gain); // Asignacion: actualiza estado del firmware.
  }
}

void syncServoStateToCurrentSensors() {                                               // Funcion syncServoStateToCurrentSensors: evita que cmd_arm salte a home.
  if (!sensorsEnabled()) return;                                                       // Condicion: en prueba manual sin sensores conserva targets manuales.
  readAllSensors();                                                                    // Llamada: toma una lectura fresca antes de habilitar PWM.
  const bool sensorDrivenMode = opMode == "assisted" || opMode == "automatic";        // Variable sensorDrivenMode: constante usada en control angular de servos.
  const float modeGain = opMode == "assisted" ? (1.0f + assistLevel) : 1.0f;          // Variable modeGain: ganancia que se aplicara al iniciar movimiento.
  const float gain = sensorDrivenMode ? modeGain : 1.0f;                              // Variable gain: en manual usa postura actual sin asistencia extra.
  for (int i = 0; i < N_SERVOS; i++) {                                                // Bucle: sincroniza todos los canales a la postura medida.
    const SensorLink& link = SENSOR_LINKS[i];
    const int servoId = link.servoId;
    const float value = fabsf(sensorDeg[servoId]) < deadbandDeg ? 0.0f : sensorDeg[servoId];
    const float target = clampServoDeg(servoId, servoCfg[servoId].homeDeg + value * gain);
    targetDeg[servoId] = target;                                                       // Asignacion: primer PWM ira a la postura actual estimada.
    currentDeg[servoId] = target;                                                      // Asignacion: evita que la rampa parta desde home al armar.
  }
}

void moveServoTowardTarget(int id) {                                                  // Funcion moveServoTowardTarget: encapsula la logica de control angular de servos.
  if (CONTROL_DIRECT_SERVO_FOLLOW) {                                                  // Condicion: sin rampa artificial; el PWM persigue el sensor/target real.
    writeServo(id, targetDeg[id]);                                                    // Llamada: envia el objetivo inmediatamente al servo.
    return;                                                                           // Retorno: evita limitar la velocidad por software.
  }

  float maxStep = maxSpeedDegSec * (CTRL_MS / 1000.0f);                               // Variable maxStep: estado mutable de max step.
  maxStep = constrain(maxStep, 0.05f, CONTROL_MAX_STEP_DEG);                          // Asignacion: evita saltos visibles aun si el loop se retrasa.
  float err = targetDeg[id] - currentDeg[id];                                         // Variable err: estado mutable de err.
  if (fabsf(err) < CONTROL_TARGET_EPSILON_DEG) return;                                // Condicion: evita vibrar cuando ya llego al target.

  // Suavizado como filtro pasa-bajos sobre el error (asintotico al target,
  // sin overshoot). Luego clampeamos por velocidad maxima para que el limite
  // configurado en maxSpeedDegSec sea efectivo. Antes el orden inverso hacia
  // que maxSpeedDegSec quedara multiplicado por smoothing (~0.25), dando una
  // velocidad real de ~22 deg/s y el exoesqueleto iba muy atrasado del usuario.
  float desired = err;                                                                // Variable desired: estado mutable de desired.
  if (smoothing > 0.01f) {                                                            // Condicion: valida estado de hardware o comando.
    desired = err * constrain(smoothing, 0.05f, 1.0f);                                // Asignacion: actualiza estado del firmware.
  }
  float step = constrain(desired, -maxStep, maxStep);                                 // Variable step: estado mutable de step.
  if (fabsf(step) > fabsf(err)) step = err;                                           // Condicion: evita pasar de largo al llegar al objetivo.
  writeServo(id, currentDeg[id] + step);                                              // Llamada: ejecuta API de hardware, red o utilidad local.
}

void updateServos() {                                                                 // Funcion updateServos: mueve los servos hacia sus objetivos.
  if (emergency) return;                                                              // Condicion: valida estado de hardware o comando.
  if (!servosArmed) return;                                                           // Condicion: arranque seguro, no escribe PWM hasta armado explicito.
  for (int i = 0; i < N_SERVOS; i++) {                                                // Bucle: recorre muestras, servos o clientes.
    moveServoTowardTarget(i);                                                         // Llamada: ejecuta API de hardware, red o utilidad local.
  }
}

void calibrateIMUs() {                                                                // Funcion calibrateIMUs: captura offsets de IMU en posicion neutral.
  const int N = 300;                                                                  // Variable N: constante usada en n.
  Serial.println("[CAL] IMU calibration: keep arms neutral and still.");              // Llamada: ejecuta API de hardware, red o utilidad local.
  for (int i = 0; i < NUM_IMUS; i++) {                                                // Bucle: recorre muestras, servos o clientes.
    long sgx = 0, sgy = 0, sgz = 0;                                                   // Variable sgx: estado mutable de sgx.
    double sAngle = 0.0;                                                              // Variable sAngle: estado mutable de control angular de servos.
    int good = 0;                                                                     // Variable good: estado mutable de good.
    for (int attempts = 0; good < N && attempts < N * 3; attempts++) {                // Bucle: recorre muestras, servos o clientes.
      int16_t ax, ay, az, gx, gy, gz;
      if (!readImuMotion(i, ax, ay, az, gx, gy, gz)) {                                // Condicion: valida estado de hardware o comando.
        delay(5);                                                                     // Llamada: ejecuta API de hardware, red o utilidad local.
        continue;
      }
      sgx += gx; sgy += gy; sgz += gz;
      sAngle += imuAccelAngleDeg(i, ax, ay, az);
      good++;
      delay(5);                                                                       // Llamada: ejecuta API de hardware, red o utilidad local.
    }

    if (good < N / 2) {                                                               // Condicion: valida estado de hardware o comando.
      imuOnline[i] = false;                                                           // Asignacion: actualiza estado del firmware.
      cf[i].ready = false;                                                            // Asignacion: actualiza estado del firmware.
      Serial.printf("[CAL] IMU bus %d skipped: signal too unstable\n", i);            // Llamada: ejecuta API de hardware, red o utilidad local.
      continue;
    }

    imuOff[i].ax = 0;                                                                 // Asignacion: actualiza estado del firmware.
    imuOff[i].ay = 0;                                                                 // Asignacion: actualiza estado del firmware.
    imuOff[i].az = 0;                                                                 // Asignacion: actualiza estado del firmware.
    imuOff[i].gx = sgx / good;                                                        // Asignacion: actualiza estado del firmware.
    imuOff[i].gy = sgy / good;                                                        // Asignacion: actualiza estado del firmware.
    imuOff[i].gz = sgz / good;                                                        // Asignacion: actualiza estado del firmware.
    imuCfg[i].neutralDeg = constrain((float)(sAngle / good), 0.0f, 180.0f);           // Asignacion: actualiza estado del firmware.
    cf[i].angle = imuCfg[i].neutralDeg;                                               // Asignacion: actualiza estado del firmware.
    cf[i].deg = 0.0f;                                                                 // Asignacion: actualiza estado del firmware.
    cf[i].ready = false;                                                              // Asignacion: actualiza estado del firmware.
    cf[i].degReady = true;                                                            // Asignacion: actualiza estado del firmware.
    for (int j = 0; j < N_SERVOS; j++) {                                              // Bucle: recorre muestras, servos o clientes.
      const SensorLink& link = SENSOR_LINKS[j];
      if (link.sensorKind == SENSOR_KIND_IMU && link.sensorId == i) sensorDeg[link.servoId] = 0.0f; // Condicion: valida estado de hardware o comando.
    }
    Serial.printf("[CAL] IMU bus %d neutral %.1f deg, gyro offset %d/%d/%d\n",        // Llamada: ejecuta API de hardware, red o utilidad local.
                  i, imuCfg[i].neutralDeg, imuOff[i].gx, imuOff[i].gy, imuOff[i].gz);
  }
  savePrefs();                                                                        // Llamada: ejecuta API de hardware, red o utilidad local.
  Serial.println("[CAL] IMU calibration done.");                                      // Llamada: ejecuta API de hardware, red o utilidad local.
}

void sendSerialJson(JsonDocument& doc) {                                              // Funcion sendSerialJson: envia serial json.
  serializeJson(doc, Serial);                                                         // Llamada: ejecuta API de hardware, red o utilidad local.
  Serial.println();                                                                   // Llamada: ejecuta API de hardware, red o utilidad local.
}

void sendI2CDiagnostic(uint8_t client) {                                              // Funcion sendI2CDiagnostic: envia i2 cdiagnostic.
  JsonDocument doc;                                                                   // Declaracion doc: dato de doc.
  doc["type"] = "i2c_diag";                                                           // Asignacion: actualiza estado del firmware.
  doc["t"] = millis();                                                                // Asignacion: actualiza estado del firmware.
  doc["sda"] = PIN_SDA;                                                               // Asignacion: actualiza estado del firmware.
  doc["scl"] = PIN_SCL;                                                               // Asignacion: actualiza estado del firmware.
  doc["clock"] = I2C_CLOCK_HZ;                                                        // Asignacion: actualiza estado del firmware.
  doc["tcaAddr"] = TCA_ADDR;                                                          // Asignacion: actualiza estado del firmware.
  doc["mpuAddr"] = MPU_ADDR;                                                          // Asignacion: actualiza estado del firmware.

  tcaOff();                                                                           // Llamada: ejecuta API de hardware, red o utilidad local.
  uint8_t rootAddresses[16] = {0};                                                    // Arreglo rootAddresses: arreglo de datos para root addresses.
  uint8_t rootCount = scanI2CAddresses(rootAddresses, sizeof(rootAddresses));         // Variable rootCount: estado mutable de root count.
  JsonArray root = doc["root"].to<JsonArray>();
  for (uint8_t i = 0; i < rootCount && i < sizeof(rootAddresses); i++) root.add(rootAddresses[i]); // Bucle: recorre muestras, servos o clientes.

  bool tcaPresent = i2cPing(TCA_ADDR);                                                // Variable tcaPresent: estado mutable de lectura de sensores IMU/I2C.
  doc["tcaPresent"] = tcaPresent;                                                     // Asignacion: actualiza estado del firmware.

  JsonArray channels = doc["channels"].to<JsonArray>();
  const uint8_t altMpuAddr = MPU_ADDR == 0x68 ? 0x69 : 0x68;                          // Variable altMpuAddr: constante usada en lectura de sensores IMU/I2C.
  uint8_t okCount = 0;                                                                // Variable okCount: estado mutable de ok count.
  uint8_t as5600OkCount = 0;                                                          // Variable as5600OkCount: AS5600 detectados en sus canales esperados.
  uint8_t mismatchCount = 0;                                                          // Variable mismatchCount: estado mutable de mismatch count.
  uint8_t missingCount = 0;                                                           // Variable missingCount: estado mutable de missing count.
  uint8_t missingAs5600Count = 0;                                                     // Variable missingAs5600Count: AS5600 esperados pero no detectados.

  if (tcaPresent) {                                                                   // Condicion: valida estado de hardware o comando.
    for (uint8_t ch = 0; ch < 8; ch++) {                                              // Bucle: recorre muestras, servos o clientes.
      JsonObject item = channels.add<JsonObject>();                                   // Variable item: estado mutable de item.
      int imuIdx = imuIndexForChannel(ch);                                            // Variable imuIdx: estado mutable de lectura de sensores IMU/I2C.
      int as5600Idx = as5600IndexForChannel(ch);                                      // Variable as5600Idx: sensor magnetico esperado en este canal.
      bool used = imuIdx >= 0 || as5600Idx >= 0;                                      // Variable used: estado mutable de used.
      item["ch"] = ch;                                                                // Asignacion: actualiza estado del firmware.
      item["used"] = used;                                                            // Asignacion: actualiza estado del firmware.
      if (imuIdx >= 0) item["imuIdx"] = imuIdx;                                       // Condicion: valida estado de hardware o comando.
      if (as5600Idx >= 0) item["as5600Idx"] = as5600Idx;                              // Condicion: valida estado de hardware o comando.
      item["expectedAddr"] = imuIdx >= 0 ? MPU_ADDR : as5600Idx >= 0 ? AS5600_ADDR : 0; // Asignacion: actualiza estado del firmware.

      bool selected = tcaSel(ch);                                                     // Variable selected: estado mutable de selected.
      item["selected"] = selected;                                                    // Asignacion: actualiza estado del firmware.
      if (!selected) {                                                                // Condicion: valida estado de hardware o comando.
        item["status"] = used ? "select_fail" : "unused";                             // Asignacion: actualiza estado del firmware.
        if (used) missingCount++;                                                     // Condicion: valida estado de hardware o comando.
        if (as5600Idx >= 0) missingAs5600Count++;                                     // Condicion: valida estado de hardware o comando.
        tcaOff();                                                                     // Llamada: ejecuta API de hardware, red o utilidad local.
        continue;
      }

      delayMicroseconds(IMU_READ_SETTLE_US);                                          // Llamada: ejecuta API de hardware, red o utilidad local.
      bool primary = i2cPing(MPU_ADDR);                                               // Variable primary: estado mutable de primary.
      bool alternate = i2cPing(altMpuAddr);                                           // Variable alternate: estado mutable de alternate.
      bool as5600 = i2cPing(AS5600_ADDR);                                             // Variable as5600: sensor magnetico detectado en este canal.
      item["mpu"] = primary;                                                          // Asignacion: actualiza estado del firmware.
      item["altMpu"] = alternate;                                                     // Asignacion: actualiza estado del firmware.
      item["altAddr"] = altMpuAddr;                                                   // Asignacion: actualiza estado del firmware.
      item["as5600"] = as5600;                                                        // Asignacion: actualiza estado del firmware.
      if (!used) {                                                                    // Condicion: valida estado de hardware o comando.
        item["status"] = primary || alternate || as5600 ? "extra" : "unused";         // Asignacion: actualiza estado del firmware.
      } else if (imuIdx >= 0 && primary) {
        item["status"] = "ok";                                                        // Asignacion: actualiza estado del firmware.
        okCount++;
      } else if (imuIdx >= 0 && alternate) {
        item["status"] = "addr_mismatch";                                             // Asignacion: actualiza estado del firmware.
        mismatchCount++;
      } else if (imuIdx >= 0) {
        item["status"] = "missing";                                                   // Asignacion: actualiza estado del firmware.
        missingCount++;
      } else if (as5600) {
        item["status"] = "ok_as5600";                                                 // Asignacion: actualiza estado del firmware.
        as5600OkCount++;
      } else {
        item["status"] = "missing_as5600";                                            // Asignacion: actualiza estado del firmware.
        missingAs5600Count++;
      }
      tcaOff();                                                                       // Llamada: ejecuta API de hardware, red o utilidad local.
      delay(2);                                                                       // Llamada: ejecuta API de hardware, red o utilidad local.
    }
  } else {
    missingCount = NUM_IMUS;                                                          // Asignacion: actualiza estado del firmware.
    missingAs5600Count = NUM_AS5600;                                                  // Asignacion: actualiza estado del firmware.
  }

  doc["okCount"] = okCount;                                                           // Asignacion: actualiza estado del firmware.
  doc["as5600OkCount"] = as5600OkCount;                                               // Asignacion: actualiza estado del firmware.
  doc["mismatchCount"] = mismatchCount;                                               // Asignacion: actualiza estado del firmware.
  doc["missingCount"] = missingCount;                                                 // Asignacion: actualiza estado del firmware.
  doc["missingAs5600Count"] = missingAs5600Count;                                     // Asignacion: actualiza estado del firmware.
  doc["summary"] = !tcaPresent                                                        // Asignacion: actualiza estado del firmware.
    ? "TCA9548A no detectado"
    : okCount == NUM_IMUS && as5600OkCount == NUM_AS5600
      ? "4 MPU + 2 AS5600 detectados"
      : okCount == NUM_IMUS && missingAs5600Count > 0
        ? "Faltan AS5600 en canales TCA"
    : mismatchCount > 0
      ? "MPU en direccion alterna"
      : "Faltan MPU en canales TCA";

  String out;                                                                         // Declaracion out: dato de out.
  serializeJson(doc, out);                                                            // Llamada: ejecuta API de hardware, red o utilidad local.
  if (client == SERIAL_CLIENT) {                                                      // Condicion: valida estado de hardware o comando.
    sendSerialJson(doc);                                                              // Llamada: ejecuta API de hardware, red o utilidad local.
  } else {
    ws.sendTXT(client, out);                                                          // Llamada: ejecuta API de hardware, red o utilidad local.
  }
}

bool controlNetworkOnline() {                                                         // Funcion controlNetworkOnline: encapsula la logica de control network online.
  return WiFi.status() == WL_CONNECTED || s3ApActive;                                 // Retorno: informa resultado de la operacion.
}

String controllerIp() {                                                               // Funcion controllerIp: encapsula la logica de controller ip.
  if (WiFi.status() == WL_CONNECTED) return WiFi.localIP().toString();                // Condicion: valida estado de hardware o comando.
  if (s3ApActive) return WiFi.softAPIP().toString();                                  // Condicion: valida estado de hardware o comando.
  return "";                                                                          // Retorno: informa resultado de la operacion.
}

String controllerWsUrl() {                                                            // Funcion controllerWsUrl: encapsula la logica de comunicaciones y puertos.
  String ip = controllerIp();                                                         // Variable ip: estado mutable de ip.
  if (!ip.length() || ip == "0.0.0.0") return "";                                     // Condicion: valida estado de hardware o comando.
  return String("ws://") + ip + ":" + String(WS_PORT);
}

String controllerMdnsUrl() {                                                          // Funcion controllerMdnsUrl: encapsula la logica de controller mdns url.
  return String("ws://") + MDNS_HOST + ".local:" + String(WS_PORT);
}

void sendAck(uint8_t client) {                                                        // Funcion sendAck: envia ack.
  JsonDocument doc;                                                                   // Declaracion doc: dato de doc.
  doc["type"] = "ack";                                                                // Asignacion: actualiza estado del firmware.
  doc["fw"] = "VESTA-S3-3.3";                                                         // Asignacion: actualiza estado del firmware.
  doc["hw"] = "ESP32-S3 N16R8";                                                       // Asignacion: actualiza estado del firmware.
  doc["role"] = "controller";                                                         // Asignacion: actualiza estado del firmware.
  doc["servos"] = N_SERVOS;                                                           // Asignacion: actualiza estado del firmware.
  doc["imus"] = NUM_IMUS;                                                             // Asignacion: actualiza estado del firmware.
  doc["as5600"] = NUM_AS5600;                                                         // Asignacion: actualiza estado del firmware.
  doc["pcaOnline"] = pcaOnline;                                                       // Asignacion: informa si el driver PWM responde por I2C.
  doc["armed"] = servosArmed;                                                         // Asignacion: informa si PWM de servos esta habilitado.
  doc["sensorless"] = !sensorsEnabled();                                               // Asignacion: informa si la prueba manual ignora sensores.
  doc["camOnline"] = camOnline;                                                       // Asignacion: actualiza estado del firmware.
  doc["wifi"] = WiFi.status() == WL_CONNECTED;                                        // Asignacion: actualiza estado del firmware.
  doc["ap"] = s3ApActive;                                                             // Asignacion: actualiza estado del firmware.
  if (s3ApActive) doc["apSsid"] = S3_AP_SSID;                                         // Condicion: valida estado de hardware o comando.
  doc["ip"] = controllerIp();                                                         // Asignacion: actualiza estado del firmware.
  doc["wsPort"] = WS_PORT;                                                            // Asignacion: actualiza estado del firmware.
  doc["mdnsHost"] = String(MDNS_HOST) + ".local";                                     // Asignacion: actualiza estado del firmware.
  doc["wsUrl"] = controllerWsUrl();                                                   // Asignacion: actualiza estado del firmware.
  doc["mdnsUrl"] = controllerMdnsUrl();                                               // Asignacion: actualiza estado del firmware.
  doc["ble"] = BLE_ENABLED != 0;                                                      // Asignacion: actualiza estado del firmware.
#if BLE_ENABLED                                                                       // Directiva de compilacion: activa codigo segun configuracion.
  doc["bleName"] = BLE_DEVICE_NAME;                                                   // Asignacion: actualiza estado del firmware.
  doc["bleService"] = BLE_SERVICE_UUID;                                               // Asignacion: actualiza estado del firmware.
  doc["bleConnected"] = bleConnected;                                                 // Asignacion: actualiza estado del firmware.
#endif                                                                                // Cierre de directiva de compilacion condicional.

  JsonArray links = doc["links"].to<JsonArray>();
  for (int i = 0; i < N_SERVOS; i++) {                                                // Bucle: recorre muestras, servos o clientes.
    const SensorLink& link = SENSOR_LINKS[i];
    JsonObject item = links.add<JsonObject>();                                        // Variable item: estado mutable de item.
    item["servoId"] = link.servoId;                                                   // Asignacion: actualiza estado del firmware.
    item["kind"] = link.sensorKind == SENSOR_KIND_IMU ? "imu" : "as5600";             // Asignacion: actualiza estado del firmware.
    item["sensorId"] = link.sensorId;                                                 // Asignacion: actualiza estado del firmware.
    item["source"] = sensorSourceName(link);                                          // Asignacion: actualiza estado del firmware.
  }

  String out;                                                                         // Declaracion out: dato de out.
  serializeJson(doc, out);                                                            // Llamada: ejecuta API de hardware, red o utilidad local.
  if (client == SERIAL_CLIENT) {                                                      // Condicion: valida estado de hardware o comando.
    sendSerialJson(doc);                                                              // Llamada: ejecuta API de hardware, red o utilidad local.
  } else {
    ws.sendTXT(client, out);                                                          // Llamada: ejecuta API de hardware, red o utilidad local.
  }
}

void broadcastJson(JsonDocument& doc) {                                               // Funcion broadcastJson: encapsula la logica de sensores y comunicaciones.
  String out;                                                                         // Declaracion out: dato de out.
  serializeJson(doc, out);                                                            // Llamada: ejecuta API de hardware, red o utilidad local.
  ws.broadcastTXT(out);                                                               // Llamada: ejecuta API de hardware, red o utilidad local.
  // Only mirror to Serial when no live WS clients are listening; this prevents
  // the 115200-baud UART from stalling the 50 Hz control loop when the app is
  // already connected over WiFi.
  if (ws.connectedClients(false) == 0) sendSerialJson(doc);                           // Condicion: valida estado de hardware o comando.
}

void sendData() {                                                                     // Funcion sendData: emite telemetria completa del controlador.
  JsonDocument doc;                                                                   // Declaracion doc: dato de doc.
  doc["type"] = "sensors";                                                            // Asignacion: actualiza estado del firmware.
  doc["t"] = millis();                                                                // Asignacion: actualiza estado del firmware.
  doc["mode"] = opMode;                                                               // Asignacion: actualiza estado del firmware.
  doc["emergency"] = emergency;                                                       // Asignacion: actualiza estado del firmware.
  doc["estop"] = false;                                                               // Sin boton fisico de paro: el campo se reporta siempre en false.
  doc["armed"] = servosArmed;                                                         // Asignacion: reporta si el PWM de servos esta habilitado.
  doc["assist"] = assistLevel;                                                        // Asignacion: actualiza estado del firmware.
  doc["deadband"] = deadbandDeg;                                                      // Asignacion: actualiza estado del firmware.
  doc["smoothing"] = smoothing;                                                       // Asignacion: reporta suavizado activo de la rampa.
  doc["maxSpeedDegSec"] = maxSpeedDegSec;                                             // Asignacion: reporta velocidad maxima activa.
  doc["pcaOnline"] = pcaOnline;                                                       // Asignacion: reporta presencia del PCA9685.
  doc["sensorless"] = !sensorsEnabled();                                               // Asignacion: reporta que la telemetria viene sin lectura de sensores.
  doc["camOnline"] = camOnline;                                                       // Asignacion: actualiza estado del firmware.

  JsonArray arr = doc["servos"].to<JsonArray>();
  for (int i = 0; i < N_SERVOS; i++) {                                                // Bucle: recorre muestras, servos o clientes.
    const SensorLink& link = linkForServo(i);
    JsonObject s = arr.add<JsonObject>();                                             // Variable s: estado mutable de s.
    s["id"] = i;                                                                      // Asignacion: actualiza estado del firmware.
    s["channel"] = servoCfg[i].channel;                                               // Asignacion: actualiza estado del firmware.
    s["angle"] = round(currentDeg[i] * 10.0f) / 10.0f;                                // Asignacion: actualiza estado del firmware.
    s["target"] = round(targetDeg[i] * 10.0f) / 10.0f;                                // Asignacion: actualiza estado del firmware.
    s["pwm"] = angleToPwm(i, currentDeg[i]);                                          // Asignacion: expone el pulso que se manda al PCA9685.
    s["sensor"] = round(sensorDeg[i] * 10.0f) / 10.0f;                                // Asignacion: actualiza estado del firmware.
    s["sensorKind"] = link.sensorKind == SENSOR_KIND_IMU ? "imu" : "as5600";          // Asignacion: actualiza estado del firmware.
    s["sensorId"] = link.sensorId;                                                    // Asignacion: actualiza estado del firmware.
    s["sensorSource"] = sensorSourceName(link);                                       // Asignacion: actualiza estado del firmware.
    if (link.sensorKind == SENSOR_KIND_IMU) {                                         // Condicion: valida estado de hardware o comando.
      s["raw"] = round(cf[link.sensorId].angle * 10.0f) / 10.0f;                      // Asignacion: actualiza estado del firmware.
      s["neutral"] = round(imuCfg[link.sensorId].neutralDeg * 10.0f) / 10.0f;         // Asignacion: actualiza estado del firmware.
      s["online"] = imuOnline[link.sensorId];                                         // Asignacion: actualiza estado del firmware.
      s["faults"] = imuFaults[link.sensorId];                                         // Asignacion: actualiza estado del firmware.
    } else {
      s["raw"] = as5600Raw[link.sensorId];                                            // Asignacion: actualiza estado del firmware.
      bool online = as5600IsOnline(link.sensorId);                                    // Variable online: estado mutable de online.
      s["online"] = online;                                                           // Asignacion: actualiza estado del firmware.
      s["faults"] = as5600Faults[link.sensorId];                                      // Asignacion: actualiza estado del firmware.
    }
    s["moving"] = servosArmed && fabsf(targetDeg[i] - currentDeg[i]) > 0.5f;          // Asignacion: no reporta movimiento mientras PWM esta desarmado.
    s["amp"] = 0.0f;                                                                  // Asignacion: actualiza estado del firmware.
    s["temp"] = 0.0f;                                                                 // Asignacion: actualiza estado del firmware.
  }

  JsonObject bat = doc["battery"].to<JsonObject>();                                   // Variable bat: estado mutable de bat.
  bat["v"] = 11.1f;                                                                   // Asignacion: actualiza estado del firmware.
  bat["pct"] = 100.0f;                                                                // Asignacion: actualiza estado del firmware.
  bat["amp"] = 0.0f;                                                                  // Asignacion: actualiza estado del firmware.

  broadcastJson(doc);                                                                 // Llamada: ejecuta API de hardware, red o utilidad local.
}

void applyServoConfig(int id, JsonObject s) {                                         // Funcion applyServoConfig: aplica servo config.
  if (id < 0 || id >= N_SERVOS || s.isNull()) return;                                 // Condicion: valida estado de hardware o comando.
  servoCfg[id].channel = (uint8_t)constrain((int)(s["channel"] | servoCfg[id].channel), 0, 15); // Asignacion: actualiza estado del firmware.

  JsonObject angle = s["angle"];                                                      // Variable angle: estado mutable de control angular de servos.
  if (!angle.isNull()) {                                                              // Condicion: valida estado de hardware o comando.
    servoCfg[id].minDeg = angle["min"] | servoCfg[id].minDeg;                         // Asignacion: actualiza estado del firmware.
    servoCfg[id].maxDeg = angle["max"] | servoCfg[id].maxDeg;                         // Asignacion: actualiza estado del firmware.
    servoCfg[id].homeDeg = angle["home"] | servoCfg[id].homeDeg;                      // Asignacion: actualiza estado del firmware.
    int dir = angle["direction"] | servoCfg[id].direction;                            // Variable dir: estado mutable de dir.
    servoCfg[id].direction = dir < 0 ? -1 : 1;                                        // Asignacion: actualiza estado del firmware.
    servoCfg[id].offsetDeg = angle["mechanicalOffset"] | servoCfg[id].offsetDeg;      // Asignacion: actualiza estado del firmware.
  }

  JsonObject pwm = s["pwm"];                                                          // Variable pwm: estado mutable de control angular de servos.
  if (!pwm.isNull()) {                                                                // Condicion: valida estado de hardware o comando.
    servoCfg[id].pwm0 = pwm["at0deg"] | servoCfg[id].pwm0;                            // Asignacion: actualiza estado del firmware.
    servoCfg[id].pwm270 = pwm["at270deg"] | servoCfg[id].pwm270;                      // Asignacion: actualiza estado del firmware.
  }
  sanitizeServoConfig(id);                                                            // Llamada: evita que un perfil invalido apague el PWM.
}

void applyCalibrationProfile(JsonDocument& doc) {                                     // Funcion applyCalibrationProfile: aplica calibration profile.
  JsonVariant root = doc.as<JsonVariant>();
  if (!doc["profile"].isNull()) root = doc["profile"];                                // Condicion: valida estado de hardware o comando.

  JsonArray servos = root["servos"].as<JsonArray>();
  for (JsonObject s : servos) {                                                       // Bucle: recorre muestras, servos o clientes.
    int id = s["id"] | -1;                                                            // Variable id: estado mutable de id.
    applyServoConfig(id, s);                                                          // Llamada: ejecuta API de hardware, red o utilidad local.
  }

  JsonArray imus = root["sensors"]["imus"].as<JsonArray>();
  for (JsonObject item : imus) {                                                      // Bucle: recorre muestras, servos o clientes.
    int bus = item["bus"] | -1;                                                       // Variable bus: estado mutable de bus.
    if (bus < 0 || bus >= NUM_IMUS) continue;                                         // Condicion: valida estado de hardware o comando.
    imuCfg[bus].neutralDeg = item["neutralDeg"] | imuCfg[bus].neutralDeg;             // Asignacion: actualiza estado del firmware.
    imuCfg[bus].minDeg = item["minDeg"] | imuCfg[bus].minDeg;                         // Asignacion: actualiza estado del firmware.
    imuCfg[bus].maxDeg = item["maxDeg"] | imuCfg[bus].maxDeg;                         // Asignacion: actualiza estado del firmware.
    imuCfg[bus].invert = item["invert"] | imuCfg[bus].invert;                         // Asignacion: actualiza estado del firmware.
  }

  JsonArray as5600 = root["sensors"]["as5600"].as<JsonArray>();
  if (as5600.isNull()) as5600 = root["as5600"].as<JsonArray>();                       // Condicion: valida estado de hardware o comando.
  for (JsonObject item : as5600) {                                                    // Bucle: recorre muestras, servos o clientes.
    int servoId = item["servoId"] | -1;                                               // Variable servoId: estado mutable de control angular de servos.
    int idx = servoId == SRV_L_ELB ? 0 : servoId == SRV_R_ELB ? 1 : -1;               // Variable idx: estado mutable de idx.
    if (idx < 0) continue;                                                            // Condicion: valida estado de hardware o comando.
    as5600Cfg[idx].raw0 = item["raw0"] | as5600Cfg[idx].raw0;                         // Asignacion: actualiza estado del firmware.
    as5600Cfg[idx].raw90 = item["raw90"] | as5600Cfg[idx].raw90;                      // Asignacion: actualiza estado del firmware.
    as5600Cfg[idx].neutralDeg = item["neutralDeg"] | as5600Cfg[idx].neutralDeg;       // Asignacion: actualiza estado del firmware.
    as5600Cfg[idx].invert = item["invert"] | as5600Cfg[idx].invert;                   // Asignacion: actualiza estado del firmware.
    resetAs5600Tracking(idx);                                                         // Llamada: ejecuta API de hardware, red o utilidad local.
  }

  JsonObject tuning = root["tuning"];                                                 // Variable tuning: estado mutable de tuning.
  applyTuningObject(tuning);                                                          // Llamada: actualiza rampa de movimiento desde perfil/app.
  sanitizeRuntimeConfig();                                                            // Llamada: normaliza rampa, PWM y limites antes de guardar.
  savePrefs();                                                                        // Llamada: ejecuta API de hardware, red o utilidad local.
}

void processCamPacket(JsonDocument& doc) {                                            // Funcion processCamPacket: procesa cam packet.
  camOnline = true;                                                                   // Asignacion: actualiza estado del firmware.
  lastCamMs = millis();                                                               // Asignacion: actualiza estado del firmware.
  JsonDocument out;                                                                   // Declaracion out: dato de out.
  out["type"] = "cam_bridge";                                                         // Asignacion: actualiza estado del firmware.
  out["t"] = millis();                                                                // Asignacion: actualiza estado del firmware.
  out["cam"] = doc;                                                                   // Asignacion: actualiza estado del firmware.
  broadcastJson(out);                                                                 // Llamada: ejecuta API de hardware, red o utilidad local.
}

void processCmd(const String& json, uint8_t client) {                                 // Funcion processCmd: interpreta comandos JSON entrantes.
  JsonDocument doc;                                                                   // Declaracion doc: dato de doc.
  DeserializationError err = deserializeJson(doc, json);
  if (err) {                                                                          // Condicion: valida estado de hardware o comando.
    Serial.printf("[RX] Bad JSON: %s\n", err.c_str());                                // Llamada: ejecuta API de hardware, red o utilidad local.
    return;                                                                           // Retorno: informa resultado de la operacion.
  }

  const char* type = doc["type"] | "";

  if (!strcmp(type, "cam_hello") || !strcmp(type, "cam_status") || !strcmp(type, "audio_event")) { // Condicion: valida estado de hardware o comando.
    processCamPacket(doc);                                                            // Llamada: ejecuta API de hardware, red o utilidad local.
    return;                                                                           // Retorno: informa resultado de la operacion.
  }

  if (!strcmp(type, "cmd_angle")) {                                                   // Condicion: valida estado de hardware o comando.
    int id = doc["id"] | -1;                                                          // Variable id: estado mutable de id.
    float ang = doc["angle"] | 0.0f;                                                  // Variable ang: estado mutable de ang.
    if (!emergency && id >= 0 && id < N_SERVOS) {                                     // Condicion: valida estado de hardware o comando.
      JsonObject servo = doc["servo"];                                                // Variable servo: estado mutable de control angular de servos.
      applyServoConfig(id, servo);                                                    // Llamada: ejecuta API de hardware, red o utilidad local.
      // El usuario tomo control explicito de un servo: forzar modo manual.
      // Sin esto, en assisted/automatic el updateTargetsFromSensors()
      // sobrescribe el target a los 20 ms y la UI parece "no dejar mover".
      if (opMode != "manual") opMode = "manual";                                      // Condicion: valida estado de hardware o comando.
      targetDeg[id] = clampServoDeg(id, ang);                                         // Asignacion: actualiza estado del firmware.
      armServos("cmd_angle");                                                         // Llamada: movimiento manual explicito habilita PWM.
    }
  } else if (!strcmp(type, "cmd_mode")) {
    const char* m = doc["mode"] | "manual";
    if (!emergency) {
      opMode = String(normalizeRequestedMode(m));                                     // Condicion: evita modos con sensores durante prueba manual.
      if (opMode != "manual") {
        syncServoStateToCurrentSensors();                                             // Llamada: evita salto a home al entrar a modo con sensores.
        armServos("cmd_mode");                                                        // Condicion: assisted/automatic son inicio explicito.
      }
    }
  } else if (!strcmp(type, "cmd_arm")) {
    syncServoStateToCurrentSensors();                                                  // Llamada: primer PWM sigue la postura actual estimada.
    armServos("cmd_arm");                                                             // Llamada: habilita PWM sin cambiar modo.
    sendAck(client);                                                                  // Llamada: confirma estado armed a la consola.
  } else if (!strcmp(type, "cmd_disarm")) {
    disarmServos("cmd_disarm");                                                       // Llamada: libera PWM sin entrar en emergencia.
    sendAck(client);                                                                  // Llamada: confirma estado armed a la consola.
  } else if (!strcmp(type, "cmd_tuning")) {
    JsonObject tuning = doc["tuning"];                                                // Variable tuning: parametros de rampa enviados por la UI.
    if (tuning.isNull()) tuning = doc.as<JsonObject>();                               // Compatibilidad: acepta campos al nivel raiz.
    applyTuningObject(tuning);                                                        // Llamada: acelera manual/sensor sin reenviar perfil completo.
    savePrefs();                                                                      // Llamada: conserva velocidad rapida tras reinicio.
    sendAck(client);                                                                  // Llamada: confirma el cambio a la consola.
  } else if (!strcmp(type, "cmd_assist")) {
    applyTuningObject(doc.as<JsonObject>());                                          // Llamada: cmd_assist queda compatible y normalizado.
    savePrefs();                                                                      // Llamada: ejecuta API de hardware, red o utilidad local.
  } else if (!strcmp(type, "cmd_stop")) {
    setEmergency(true, "remote command");                                             // Llamada: ejecuta API de hardware, red o utilidad local.
  } else if (!strcmp(type, "cmd_reset")) {
    // Sin boton fisico de paro: el reset remoto siempre procede.
    setEmergency(false, "remote reset");                                              // Llamada: ejecuta API de hardware, red o utilidad local.
    applyBootBehavior();                                                              // Llamada: ejecuta API de hardware, red o utilidad local.
    disarmServos("remote reset");                                                     // Llamada: reset vuelve a estado seguro sin mover a home.
  } else if (!strcmp(type, "cmd_calibrate")) {
    if (sensorsEnabled()) {                                                           // Condicion: calibra IMU solo cuando los sensores estan activos.
      calibrateIMUs();                                                                // Llamada: ejecuta API de hardware, red o utilidad local.
    } else {
      Serial.println("[SENSORLESS] IMU calibration skipped.");                        // Llamada: informa que la prueba manual ignora sensores.
    }
  } else if (!strcmp(type, "cmd_i2c_diag")) {
    diagnoseI2CBus();                                                                 // Llamada: ejecuta API de hardware, red o utilidad local.
    sendI2CDiagnostic(client);                                                        // Llamada: ejecuta API de hardware, red o utilidad local.
  } else if (!strcmp(type, "cmd_home")) {
    for (int i = 0; i < N_SERVOS; i++) targetDeg[i] = servoCfg[i].homeDeg;            // Bucle: recorre muestras, servos o clientes.
    armServos("cmd_home");                                                            // Llamada: home es movimiento explicito.
  } else if (!strcmp(type, "cmd_status")) {
    sendAck(client);                                                                  // Llamada: ejecuta API de hardware, red o utilidad local.
    sendData();                                                                       // Llamada: ejecuta API de hardware, red o utilidad local.
  } else if (!strcmp(type, "cmd_calibration_profile")) {
    applyCalibrationProfile(doc);                                                     // Llamada: ejecuta API de hardware, red o utilidad local.
    sendAck(client);                                                                  // Llamada: ejecuta API de hardware, red o utilidad local.
  } else if (!strcmp(type, "cmd_calibration_servos") ||
             !strcmp(type, "cmd_calibration_sensors") ||
             !strcmp(type, "cmd_calibration_mapping")) {
    applyCalibrationProfile(doc);                                                     // Llamada: ejecuta API de hardware, red o utilidad local.
    sendAck(client);                                                                  // Llamada: ejecuta API de hardware, red o utilidad local.
  }
}

void wsEvent(uint8_t num, WStype_t type, uint8_t* payload, size_t len) {              // Funcion wsEvent: atiende eventos WebSocket del controlador.
  switch (type) {                                                                     // Selector: despacha por tipo de evento o comando.
    case WStype_CONNECTED:                                                            // Caso: evento o comando especifico.
      Serial.printf("[WS] Client %u connected from %s\n", num, ws.remoteIP(num).toString().c_str()); // Llamada: ejecuta API de hardware, red o utilidad local.
      sendAck(num);                                                                   // Llamada: ejecuta API de hardware, red o utilidad local.
      break;
    case WStype_DISCONNECTED:                                                         // Caso: evento o comando especifico.
      Serial.printf("[WS] Client %u disconnected\n", num);                            // Llamada: ejecuta API de hardware, red o utilidad local.
      break;
    case WStype_TEXT:                                                                 // Caso: evento o comando especifico.
      processCmd(String((char*)payload, len), num);                                   // Llamada: ejecuta API de hardware, red o utilidad local.
      break;
    default:                                                                          // Campo default: dato miembro de estructura o JSON.
      break;
  }
}

void readSerialCommands() {                                                           // Funcion readSerialCommands: lee comandos JSON desde el puerto serial.
  while (Serial.available()) {                                                        // Bucle: recorre muestras, servos o clientes.
    char c = (char)Serial.read();                                                     // Variable c: estado mutable de c.
    if (c == '\r') continue;                                                          // Condicion: valida estado de hardware o comando.
    if (c == '\n') {                                                                  // Condicion: valida estado de hardware o comando.
      serialLine.trim();                                                              // Llamada: ejecuta API de hardware, red o utilidad local.
      if (serialLine.startsWith("{")) {                                               // Condicion: valida estado de hardware o comando.
        processCmd(serialLine, SERIAL_CLIENT);                                        // Llamada: ejecuta API de hardware, red o utilidad local.
      }
      serialLine = "";                                                                // Asignacion: actualiza estado del firmware.
      continue;
    }
    if (serialLine.length() < 4096) {                                                 // Condicion: valida estado de hardware o comando.
      serialLine += c;
    } else {
      serialLine = "";                                                                // Asignacion: actualiza estado del firmware.
    }
  }
}

void announceWifiUp() {                                                               // Funcion announceWifiUp: encapsula la logica de comunicaciones y puertos.
  String ip = WiFi.localIP().toString();                                              // Variable ip: estado mutable de ip.
  Serial.printf("[WiFi] IP: %s\n", ip.c_str());                                       // Llamada: ejecuta API de hardware, red o utilidad local.
  Serial.printf("[WS] URL: ws://%s:%d\n", ip.c_str(), WS_PORT);
}

void startBatteryAccessPoint() {                                                      // Funcion startBatteryAccessPoint: inicia battery access point.
  if (s3ApActive) return;                                                             // Condicion: valida estado de hardware o comando.
  WiFi.mode(WIFI_AP_STA);                                                             // Llamada: ejecuta API de hardware, red o utilidad local.
  WiFi.setSleep(false);                                                               // Llamada: ejecuta API de hardware, red o utilidad local.
  bool ok = WiFi.softAP(S3_AP_SSID, S3_AP_PASSWORD, S3_AP_CHANNEL, 0, S3_AP_MAX_CLIENTS); // Variable ok: estado mutable de ok.
  s3ApActive = ok;                                                                    // Asignacion: actualiza estado del firmware.
  if (ok) {                                                                           // Condicion: valida estado de hardware o comando.
    Serial.printf("[AP] %s ready at %s\n", S3_AP_SSID, WiFi.softAPIP().toString().c_str()); // Llamada: ejecuta API de hardware, red o utilidad local.
    Serial.printf("[WS] URL: ws://%s:%d\n", WiFi.softAPIP().toString().c_str(), WS_PORT);
  } else {
    Serial.println("[AP] failed to start battery fallback");                          // Llamada: ejecuta API de hardware, red o utilidad local.
  }
}

void startWebSocketServer() {                                                         // Funcion startWebSocketServer: inicia web socket server.
  if (wsStarted) return;                                                              // Condicion: valida estado de hardware o comando.
  if (!controlNetworkOnline()) {                                                      // Condicion: valida estado de hardware o comando.
    Serial.println("[WS] Waiting for WiFi/AP before starting server.");               // Llamada: ejecuta API de hardware, red o utilidad local.
    return;                                                                           // Retorno: informa resultado de la operacion.
  }
  ws.begin();                                                                         // Llamada: ejecuta API de hardware, red o utilidad local.
  ws.onEvent(wsEvent);                                                                // Llamada: ejecuta API de hardware, red o utilidad local.
  // Heartbeat lenient on purpose: a strict ping/pong over WiFi was kicking
  // healthy browser sessions on every signal hiccup and causing reconnect
  // loops. The browser-side auto-reconnect handles real disconnects fast.
  ws.enableHeartbeat(8000, 3000, 3);                                                  // Llamada: ejecuta API de hardware, red o utilidad local.
  wsStarted = true;                                                                   // Asignacion: actualiza estado del firmware.
  Serial.printf("[WS] Server on port %d\n", WS_PORT);                                 // Llamada: ejecuta API de hardware, red o utilidad local.
}

void connectWifi() {                                                                  // Funcion connectWifi: conecta o prepara WiFi para operacion autonoma.
  WiFi.mode(WIFI_STA);                                                                // Llamada: ejecuta API de hardware, red o utilidad local.
  WiFi.setSleep(false);                                                               // Llamada: ejecuta API de hardware, red o utilidad local.
  WiFi.persistent(false);                                                             // Llamada: ejecuta API de hardware, red o utilidad local.
  WiFi.setAutoReconnect(true);                                                        // Llamada: ejecuta API de hardware, red o utilidad local.
  esp_wifi_set_ps(WIFI_PS_NONE);                                                      // Llamada: ejecuta API de hardware, red o utilidad local.
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);                                               // Llamada: ejecuta API de hardware, red o utilidad local.
  Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);                                // Llamada: ejecuta API de hardware, red o utilidad local.
  const int attempts = max(1, WIFI_BOOT_CONNECT_TIMEOUT_MS / 200);                    // Variable attempts: constante usada en attempts.
  // Keep startup short for battery use; loop() keeps retrying in background.
  for (int i = 0; i < attempts && WiFi.status() != WL_CONNECTED; i++) {               // Bucle: recorre muestras, servos o clientes.
    delay(200);                                                                       // Llamada: ejecuta API de hardware, red o utilidad local.
    Serial.print(".");                                                                // Llamada: ejecuta API de hardware, red o utilidad local.
  }
  Serial.println();                                                                   // Llamada: ejecuta API de hardware, red o utilidad local.
  if (WiFi.status() == WL_CONNECTED) {                                                // Condicion: valida estado de hardware o comando.
    wifiUp = true;                                                                    // Asignacion: actualiza estado del firmware.
    announceWifiUp();                                                                 // Llamada: ejecuta API de hardware, red o utilidad local.
  } else {
    Serial.println("[WiFi] Initial connect pending. Starting battery AP fallback.");  // Llamada: ejecuta API de hardware, red o utilidad local.
    startBatteryAccessPoint();                                                        // Llamada: ejecuta API de hardware, red o utilidad local.
    startWebSocketServer();                                                           // Llamada: ejecuta API de hardware, red o utilidad local.
  }
  tWifiRetry = millis();                                                              // Asignacion: actualiza estado del firmware.
}

void wifiKeepalive() {                                                                // Funcion wifiKeepalive: mantiene la conectividad WiFi durante ejecucion.
  unsigned long now = millis();                                                       // Variable now: estado mutable de now.
  if (now - tWifiCheck < 1000) return;                                                // Condicion: valida estado de hardware o comando.
  tWifiCheck = now;                                                                   // Asignacion: actualiza estado del firmware.

  if (WiFi.status() == WL_CONNECTED) {                                                // Condicion: valida estado de hardware o comando.
    if (!wifiUp) {                                                                    // Condicion: valida estado de hardware o comando.
      wifiUp = true;                                                                  // Asignacion: actualiza estado del firmware.
      announceWifiUp();                                                               // Llamada: ejecuta API de hardware, red o utilidad local.
      if (MDNS.begin(MDNS_HOST)) {                                                    // Condicion: valida estado de hardware o comando.
        MDNS.addService("vesta", "tcp", WS_PORT);                                     // Llamada: ejecuta API de hardware, red o utilidad local.
        MDNS.addService("ws", "tcp", WS_PORT);                                        // Llamada: ejecuta API de hardware, red o utilidad local.
      }
      startWebSocketServer();                                                         // Llamada: ejecuta API de hardware, red o utilidad local.
    }
    return;                                                                           // Retorno: informa resultado de la operacion.
  }

  wifiUp = false;                                                                     // Asignacion: actualiza estado del firmware.
  if (!s3ApActive) {                                                                  // Condicion: valida estado de hardware o comando.
    startBatteryAccessPoint();                                                        // Llamada: ejecuta API de hardware, red o utilidad local.
    startWebSocketServer();                                                           // Llamada: ejecuta API de hardware, red o utilidad local.
  }
  // Use non-destructive reconnect() instead of disconnect()+begin(). The latter
  // wipes the association every cycle and was making the link flap. With
  // setAutoReconnect(true) the stack already retries; we only nudge it after
  // ~5s without a successful association.
  //
  // Importante: NO llamar a reconnect() mientras el stack todavia esta en
  // pleno intento de conexion (WL_IDLE_STATUS / WL_DISCONNECTED transitorio).
  // Si lo hacemos, esp_wifi_connect() devuelve ESP_ERR_WIFI_CONN y ESP-IDF
  // imprime "wifi:sta is connecting, return error" en el UART, ensuciando
  // el canal serial JSON. Solo empujamos cuando el intento previo terminado
  // en fallo definitivo (FAILED / NO_SSID / CONNECTION_LOST).
  wl_status_t st = WiFi.status();
  bool intentoFallido = (st == WL_CONNECT_FAILED ||                                   // Variable intentoFallido: estado mutable de intento fallido.
                         st == WL_NO_SSID_AVAIL ||                                    // Asignacion: actualiza estado del firmware.
                         st == WL_CONNECTION_LOST);                                   // Asignacion: actualiza estado del firmware.
  if (intentoFallido && now - tWifiRetry > WIFI_RECONNECT_INTERVAL_MS) {              // Condicion: valida estado de hardware o comando.
    tWifiRetry = now;                                                                 // Asignacion: actualiza estado del firmware.
    Serial.println("[WiFi] Nudging reconnect...");                                    // Llamada: ejecuta API de hardware, red o utilidad local.
    WiFi.reconnect();                                                                 // Llamada: ejecuta API de hardware, red o utilidad local.
  }
}

bool setupMpu(uint8_t idx) {                                                          // Funcion setupMpu: inicializa y valida una MPU6050.
  for (int attempt = 1; attempt <= 3; attempt++) {                                    // Bucle: recorre muestras, servos o clientes.
    if (!tcaSel(IMU_TCA_CHANNEL[idx])) {                                              // Condicion: valida estado de hardware o comando.
      tcaOff();                                                                       // Llamada: ejecuta API de hardware, red o utilidad local.
      delay(40);                                                                      // Llamada: ejecuta API de hardware, red o utilidad local.
      continue;
    }

    bool present = i2cPing(MPU_ADDR);                                                 // Variable present: estado mutable de present.
    if (present) {                                                                    // Condicion: valida estado de hardware o comando.
      imu[idx].reset();
      delay(100);                                                                     // Llamada: ejecuta API de hardware, red o utilidad local.
      imu[idx].initialize();
      imu[idx].setClockSource(MPU6050_CLOCK_PLL_XGYRO);
      imu[idx].setSleepEnabled(false);
      imu[idx].setFullScaleAccelRange(MPU6050_ACCEL_FS_2);
      imu[idx].setFullScaleGyroRange(MPU6050_GYRO_FS_250);
      imu[idx].setDLPFMode(MPU6050_DLPF_BW_42);
      delay(30);                                                                      // Llamada: ejecuta API de hardware, red o utilidad local.
      present = imu[idx].testConnection();                                            // Asignacion: actualiza estado del firmware.
    }
    tcaOff();                                                                         // Llamada: ejecuta API de hardware, red o utilidad local.

    if (present) {                                                                    // Condicion: valida estado de hardware o comando.
      int16_t ax, ay, az, gx, gy, gz;
      if (readImuMotion(idx, ax, ay, az, gx, gy, gz)) {                               // Condicion: valida estado de hardware o comando.
        cf[idx].ready = false;                                                        // Asignacion: actualiza estado del firmware.
        cf[idx].degReady = false;                                                     // Asignacion: actualiza estado del firmware.
        Serial.printf("[IMU] bus %d: OK (try %d)\n", idx, attempt);                   // Llamada: ejecuta API de hardware, red o utilidad local.
        return true;                                                                  // Retorno: informa resultado de la operacion.
      }
    }
    delay(50);                                                                        // Llamada: ejecuta API de hardware, red o utilidad local.
  }

  imuOnline[idx] = false;                                                             // Asignacion: actualiza estado del firmware.
  cf[idx].ready = false;                                                              // Asignacion: actualiza estado del firmware.
  cf[idx].degReady = false;                                                           // Asignacion: actualiza estado del firmware.
  Serial.printf("[IMU] bus %d: FAIL (expected MPU 0x%02X on TCA ch %d)\n", idx, MPU_ADDR, IMU_TCA_CHANNEL[idx]); // Llamada: ejecuta API de hardware, red o utilidad local.
  return false;                                                                       // Retorno: informa resultado de la operacion.
}

void setupI2CAndHardware() {                                                          // Funcion setupI2CAndHardware: prepara bus I2C, servos y sensores.
  Wire.begin(PIN_SDA, PIN_SCL);                                                       // Llamada: ejecuta API de hardware, red o utilidad local.
  Wire.setClock(I2C_CLOCK_HZ);                                                        // Llamada: ejecuta API de hardware, red o utilidad local.
  Wire.setTimeOut(20);                                                                // Llamada: ejecuta API de hardware, red o utilidad local.
  Serial.printf("[I2C] SDA GPIO%d SCL GPIO%d @ %lu Hz\n", PIN_SDA, PIN_SCL, (unsigned long)I2C_CLOCK_HZ); // Llamada: ejecuta API de hardware, red o utilidad local.
  if (sensorsEnabled()) {                                                             // Condicion: diagnostica sensores solo si participan en el control.
    diagnoseI2CBus();                                                                 // Llamada: ejecuta API de hardware, red o utilidad local.
    if (!i2cPing(TCA_ADDR)) {                                                         // Condicion: valida estado de hardware o comando.
      Serial.printf("[I2C] Warning: TCA9548A not found at 0x%02X\n", TCA_ADDR);       // Llamada: ejecuta API de hardware, red o utilidad local.
    }
    tcaOff();                                                                         // Llamada: deja libre el bus raiz antes de buscar el PCA9685.
  } else {
    Serial.println("[SENSORLESS] Sensor init skipped; manual page controls PCA9685 servos only.");
  }
  pcaOnline = i2cPing(PCA_ADDR);                                                      // Asignacion: detecta el driver PWM de servos.
  if (!pcaOnline) {                                                                   // Condicion: alerta si el driver de servos no responde.
    Serial.printf("[I2C] Warning: PCA9685 not found at 0x%02X. Check VCC, SDA GPIO%d, SCL GPIO%d, OE low and common GND.\n",
                  PCA_ADDR, PIN_SDA, PIN_SCL);
  }

  pca.begin();                                                                        // Llamada: ejecuta API de hardware, red o utilidad local.
  pca.setPWMFreq(PWM_FREQ);                                                           // Llamada: ejecuta API de hardware, red o utilidad local.
  delay(10);                                                                          // Llamada: ejecuta API de hardware, red o utilidad local.

  for (int i = 0; i < N_SERVOS; i++) {                                                // Bucle: recorre muestras, servos o clientes.
    currentDeg[i] = servoCfg[i].homeDeg;                                              // Asignacion: actualiza estado del firmware.
    targetDeg[i] = servoCfg[i].homeDeg;                                               // Asignacion: actualiza estado del firmware.
  }
  initializeServosSafely();                                                           // Llamada: arranca sin mover ni energizar servos.

  if (sensorsEnabled()) {                                                             // Condicion: prepara IMU/AS5600 solo fuera de la prueba manual.
    bool imuOk = true;                                                                // Variable imuOk: estado mutable de lectura de sensores IMU/I2C.
    for (int i = 0; i < NUM_IMUS; i++) {                                              // Bucle: recorre muestras, servos o clientes.
      bool ok = setupMpu(i);                                                          // Variable ok: estado mutable de ok.
      if (!ok) imuOk = false;                                                         // Condicion: valida estado de hardware o comando.
    }
    tcaOff();                                                                         // Llamada: ejecuta API de hardware, red o utilidad local.
    if (!imuOk) Serial.println("[IMU] Warning: at least one MPU6050 did not respond."); // Condicion: valida estado de hardware o comando.

    for (int i = 0; i < NUM_AS5600; i++) {                                            // Bucle: recorre muestras, servos o clientes.
      int raw = 0;                                                                    // Variable raw: estado mutable de raw.
      if (readAs5600Raw(i, raw)) {                                                    // Condicion: valida estado de hardware o comando.
        as5600Raw[i] = raw;                                                           // Asignacion: actualiza estado del firmware.
        as5600Ema[i] = raw;                                                           // Asignacion: actualiza estado del firmware.
        as5600BaseRaw[i] = raw;                                                       // Asignacion: actualiza estado del firmware.
        as5600EmaReady[i] = true;                                                     // Asignacion: actualiza estado del firmware.
        as5600BaseReady[i] = true;                                                    // Asignacion: actualiza estado del firmware.
        as5600Online[i] = true;                                                       // Asignacion: actualiza estado del firmware.
        as5600Faults[i] = 0;                                                          // Asignacion: actualiza estado del firmware.
        Serial.printf("[AS5600] sensor %d TCA%d raw %d\n", i, AS5600_TCA_CHANNEL[i], raw); // Llamada: ejecuta API de hardware, red o utilidad local.
      } else {
        as5600Online[i] = false;                                                      // Asignacion: actualiza estado del firmware.
        as5600Faults[i] = AS5600_FAIL_LIMIT;                                          // Asignacion: actualiza estado del firmware.
        Serial.printf("[AS5600] sensor %d FAIL (expected 0x%02X on TCA ch %d)\n", i, AS5600_ADDR, AS5600_TCA_CHANNEL[i]); // Llamada: ejecuta API de hardware, red o utilidad local.
      }
    }
  }
}

// Hook que descarta CUALQUIER salida del sistema de log de ESP-IDF.
// Nuestro protocolo serial es JSON: cualquier "E (1234) wifi:..." que
// emita el IDF rompe el parser del PC ("RX no JSON"). Nuestros propios
// Serial.printf / Serial.println van por Print y NO pasan por este hook,
// asi que se siguen viendo normales.
int vesta_drop_idf_logs(const char* fmt, va_list args) {                              // Funcion vesta_drop_idf_logs: encapsula la logica de vesta drop idf logs.
  (void)fmt; (void)args;
  return 0;                                                                           // Retorno: informa resultado de la operacion.
}

void setup() {                                                                        // Funcion setup: rutina de inicializacion principal.
  Serial.begin(115200);                                                               // Llamada: ejecuta API de hardware, red o utilidad local.
  delay(150);                                                                         // Llamada: ejecuta API de hardware, red o utilidad local.
  // Doble defensa contra logs ruidosos del IDF que contaminan el JSON serial:
  //  1) Bajar el nivel de log del componente wifi (por compatibilidad).
  //  2) Reemplazar el vprintf global para descartar TODO lo que el IDF
  //     intente escribir, incluyendo errores que evitan el filtro por tag
  //     (p.ej. "wifi:sta is connecting, return error" en algunas builds).
  esp_log_level_set("*", ESP_LOG_NONE);                                               // Llamada: ejecuta API de hardware, red o utilidad local.
  esp_log_set_vprintf(vesta_drop_idf_logs);                                           // Llamada: ejecuta API de hardware, red o utilidad local.
  Serial.println("\nV.E.S.T.A. ESP32-S3 controller v3.3");                            // Llamada: ejecuta API de hardware, red o utilidad local.

  // Boton fisico de paro de emergencia retirado: ya no se configura PIN_ESTOP.
  loadPrefs();                                                                        // Llamada: ejecuta API de hardware, red o utilidad local.
  applyBootBehavior();                                                                // Llamada: ejecuta API de hardware, red o utilidad local.
  setupI2CAndHardware();                                                              // Llamada: ejecuta API de hardware, red o utilidad local.

#if BLE_ENABLED                                                                       // Directiva de compilacion: activa codigo segun configuracion.
  setupBle();                                                                         // Llamada: ejecuta API de hardware, red o utilidad local.
#endif                                                                                // Cierre de directiva de compilacion condicional.

  connectWifi();                                                                      // Llamada: ejecuta API de hardware, red o utilidad local.

  if (WiFi.status() == WL_CONNECTED && MDNS.begin(MDNS_HOST)) {                       // Condicion: valida estado de hardware o comando.
    MDNS.addService("vesta", "tcp", WS_PORT);                                         // Llamada: ejecuta API de hardware, red o utilidad local.
    MDNS.addService("ws", "tcp", WS_PORT);                                            // Llamada: ejecuta API de hardware, red o utilidad local.
    Serial.printf("[mDNS] %s.local\n", MDNS_HOST);                                    // Llamada: ejecuta API de hardware, red o utilidad local.
  }

  startWebSocketServer();                                                             // Llamada: ejecuta API de hardware, red o utilidad local.
}

void loop() {                                                                         // Funcion loop: ciclo principal de ejecucion.
  if (wsStarted) ws.loop();                                                           // Condicion: valida estado de hardware o comando.
  readSerialCommands();                                                               // Llamada: ejecuta API de hardware, red o utilidad local.
  wifiKeepalive();                                                                    // Llamada: ejecuta API de hardware, red o utilidad local.
#if defined(ESP8266)                                                                  // Directiva de compilacion: activa codigo segun configuracion.
  MDNS.update();                                                                      // Llamada: ejecuta API de hardware, red o utilidad local.
#endif                                                                                // Cierre de directiva de compilacion condicional.

  // Boton fisico de paro de emergencia retirado: el paro/reset es solo remoto
  // (cmd_stop / cmd_reset por WS/BLE/Serial).

  if (camOnline && millis() - lastCamMs > CAM_TIMEOUT_MS) camOnline = false;          // Condicion: valida estado de hardware o comando.

  unsigned long now = millis();                                                       // Variable now: estado mutable de now.
  if (now - tCtrl >= CTRL_MS) {                                                       // Condicion: valida estado de hardware o comando.
    tCtrl = now;                                                                      // Asignacion: actualiza estado del firmware.
    if (sensorsEnabled()) {                                                           // Condicion: en modo manual sin sensores deja intactos los targets de la pagina.
      readAllSensors();                                                               // Llamada: ejecuta API de hardware, red o utilidad local.
      updateTargetsFromSensors();                                                     // Llamada: ejecuta API de hardware, red o utilidad local.
    }
    updateServos();                                                                   // Llamada: ejecuta API de hardware, red o utilidad local.
  }

  if (now - tSend >= SEND_MS) {                                                       // Condicion: valida estado de hardware o comando.
    tSend = now;                                                                      // Asignacion: actualiza estado del firmware.
    sendData();                                                                       // Llamada: ejecuta API de hardware, red o utilidad local.
  }

  // Diagnostico de AS5600 por Serial cada 1 s, solo si no hay clientes WS.
  // Esto sirve para depurar al bench cuando el usuario tiene unicamente el
  // monitor serial abierto. Con la app conectada se ve por la UI.
  if (now - tAs5600Diag >= 1000) {                                                    // Condicion: valida estado de hardware o comando.
    tAs5600Diag = now;                                                                // Asignacion: actualiza estado del firmware.
    if (sensorsEnabled() && ws.connectedClients(false) == 0) printAs5600Diag();        // Condicion: valida estado de hardware o comando.
  }

#if BLE_ENABLED                                                                       // Directiva de compilacion: activa codigo segun configuracion.
  sendBleTelemetry();                                                                 // Llamada: ejecuta API de hardware, red o utilidad local.
#endif                                                                                // Cierre de directiva de compilacion condicional.
}
`,
    // Campo cam: firmware ESP32-CAM incluido como texto sin procesar.
    cam: String.raw`/*
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

bool hasWifiCredentials()
{
  return strcmp(WIFI_SSID, "TU_RED_WIFI") != 0 &&
    strcmp(WIFI_PASSWORD, "TU_CONTRASENA") != 0 &&
    strlen(WIFI_SSID) > 0;
}

String camIp()
{
  if (WiFi.status() == WL_CONNECTED) return WiFi.localIP().toString();
  IPAddress apIp = WiFi.softAPIP();
  if (apIp != IPAddress(0, 0, 0, 0)) return apIp.toString();
  return "";
}

String httpBase()
{
  String ip = camIp();
  if (!ip.length()) return "";
  String url = "http://" + ip;
  if (HTTP_PORT != 80) url += ":" + String(HTTP_PORT);
  return url;
}

String streamBase()
{
  String ip = camIp();
  if (!ip.length()) return "";
  return "http://" + ip + ":" + String(CAM_STREAM_PORT);
}

String streamUrl()
{
  String base = streamBase();
  return base.length() ? base + "/stream" : "";
}

String statusUrl()
{
  String base = streamBase();
  return base.length() ? base + "/status" : "";
}

String captureUrl()
{
  String base = streamBase();
  return base.length() ? base + "/capture" : "";
}

const VestaCamPreset &currentPreset()
{
  uint8_t index = activePreset;
  if (index > CAM_PRESET_QUALITY) index = CAM_PRESET_BALANCED;
  return CAM_PRESETS[index];
}

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

void printStatusToSerial()
{
  Serial.println(statusJson());
}

void sendCors()
{
  http.sendHeader("Access-Control-Allow-Origin", "*");
  http.sendHeader("Cache-Control", "no-store");
}

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

void handleCapture()
{
  WiFiClient client = http.client();
  client.setNoDelay(true);
  sendCaptureToClient(client);
}

void handleStatus()
{
  sendCors();
  http.send(200, "application/json", statusJson());
}

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

void handleModeFast()
{
  handleMode(CAM_PRESET_FAST);
}

void handleModeBalanced()
{
  handleMode(CAM_PRESET_BALANCED);
}

void handleModeQuality()
{
  handleMode(CAM_PRESET_QUALITY);
}

void handleFlashOn()
{
  flashOn = true;
  digitalWrite(CAM_FLASH_LED, HIGH);
  sendCors();
  http.sendHeader("Location", "/");
  http.send(303);
}

void handleFlashOff()
{
  flashOn = false;
  digitalWrite(CAM_FLASH_LED, LOW);
  sendCors();
  http.sendHeader("Location", "/");
  http.send(303);
}

void handleStreamRedirect()
{
  sendCors();
  http.sendHeader("Location", streamUrl());
  http.send(302, "text/plain", "Redirecting to realtime stream");
}

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
`
  };

  const $ = (selector, root = document) => root.querySelector(selector);              // Funcion flecha $: encapsula la logica de este bloque.
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector)); // Funcion flecha $$: encapsula la logica de este bloque.
  const API_FALLBACK_ORIGIN = "http://127.0.0.1:5177";                                // Constante API_FALLBACK_ORIGIN: URL usada en api fallback origin.
  // Constante S3_DEFAULT_FQBN: placa Arduino por defecto para compilar el ESP32-S3.
  const S3_DEFAULT_FQBN = "esp32:esp32:esp32s3:USBMode=hwcdc,CDCOnBoot=default,FlashSize=16M,PSRAM=opi,PartitionScheme=app3M_fat9M_16MB";
  const CAM_DEFAULT_FQBN = "esp32:esp32:esp32cam";                                    // Constante CAM_DEFAULT_FQBN: placa Arduino por defecto para compilar la ESP32-CAM.
  const S3_LEGACY_FQBNS = new Set(["esp32:esp32:esp32s3", "esp32:esp32:esp32_family"]); // Conjunto S3_LEGACY_FQBNS: FQBN heredados que se normalizan antes de subir firmware.
  function normalizeS3Fqbn(fqbn) {                                                    // Funcion normalizeS3Fqbn: evita compilar Serial hacia USB CDC en placas con CH343.
    const value = String(fqbn || "").trim();                                          // Constante value: cadena FQBN normalizada para ESP32-S3.
    if (!value || S3_LEGACY_FQBNS.has(value)) return S3_DEFAULT_FQBN;                 // Condicion: actualiza configuraciones antiguas a la placa soportada.
    return value.replace(/CDCOnBoot=cdc/g, "CDCOnBoot=default");                     // Retorno: mantiene Serial por UART/CH343 para la pagina tecnica.
  }
  const MODE_LABELS = {                                                               // Objeto MODE_LABELS: etiquetas visibles para los modos de operacion.
    manual: "Manual",                                                                 // Campo manual: campo de datos para manual.
    assisted: "Asistido",                                                             // Campo assisted: campo de datos para assisted.
    automatic: "Automatico",                                                          // Campo automatic: campo de datos para automatic.
    emergency: "Emergencia",                                                          // Campo emergency: campo de datos para paro de emergencia.
    demo: "Demo"                                                                      // Campo demo: campo de datos para demo.
  };
  const MODE_BUTTONS = {                                                              // Objeto MODE_BUTTONS: selectores de botones asociados a cada modo.
    manual: ["#btn-manual-mode", "#btn-mode-manual-diag", "#btn-manual-mode-only"],   // Campo manual: arreglo de configuracion.
    assisted: ["#btn-mode-assisted", "#btn-manual-mode-assisted"],                    // Campo assisted: arreglo de configuracion.
    automatic: ["#btn-mode-automatic", "#btn-manual-mode-automatic"]                  // Campo automatic: arreglo de configuracion.
  };

  function apiUrl(url) {                                                              // Funcion apiUrl: normaliza rutas API hacia el servidor local disponible.
    if (!String(url).startsWith("/api/")) return url;                                 // Condicion: valida estado antes de continuar el flujo.
    const host = window.location.hostname;                                            // Constante host: constante usada en host.
    const servedByLocalApi = window.location.protocol.startsWith("http") &&           // Constante servedByLocalApi: constante usada en served by local api.
      (host === "127.0.0.1" || host === "localhost");
    // Retorno: entrega el resultado al llamador.
    return servedByLocalApi ? url : `${API_FALLBACK_ORIGIN}${url}`;
  }

  const SERVO_DEFAULTS = [                                                            // Arreglo SERVO_DEFAULTS: catalogo base de servos, limites, canales y telemetria UI.
    {                                                                                 // Elemento: entrada de objeto dentro de una lista de datos.
      id: 0,                                                                          // Campo id: campo de datos para id.
      key: "leftLateral",                                                             // Campo key: campo de datos para key.
      channel: 0,                                                                     // Campo channel: campo de datos para channel.
      label: "Hombro izq lateral",                                                    // Campo label: campo de datos para label.
      short: "L.LAT",                                                                 // Campo short: campo de datos para short.
      side: "left",                                                                   // Campo side: campo de datos para side.
      movement: "Levantar a los lados",                                               // Campo movement: campo de datos para movement.
      sensorKey: "imuLeftLateral",                                                    // Campo sensorKey: campo de datos para sensor key.
      sensorLabel: "MPU TCA0",                                                        // Campo sensorLabel: campo de datos para sensor label.
      minAngle: 0,                                                                    // Campo minAngle: campo de datos para control angular de servos.
      maxAngle: 90,                                                                   // Campo maxAngle: campo de datos para control angular de servos.
      homeAngle: 0,                                                                   // Campo homeAngle: campo de datos para control angular de servos.
      direction: 1,                                                                   // Campo direction: campo de datos para direction.
      pwmAt0: 102,                                                                    // Campo pwmAt0: campo de datos para control angular de servos.
      pwmAt270: 512,                                                                  // Campo pwmAt270: campo de datos para control angular de servos.
      mechanicalOffset: 0,                                                            // Campo mechanicalOffset: campo de datos para mechanical offset.
      testAngle: 0,                                                                   // Campo testAngle: campo de datos para control angular de servos.
      liveAngle: 0,                                                                   // Campo liveAngle: campo de datos para control angular de servos.
      liveSensor: 0,                                                                  // Campo liveSensor: campo de datos para live sensor.
      liveSensorSpeed: 0,                                                             // Campo liveSensorSpeed: campo de datos para live sensor speed.
      lastSensorDeg: null,                                                            // Campo lastSensorDeg: campo de datos para control angular de servos.
      lastSensorAt: null,                                                             // Campo lastSensorAt: campo de datos para last sensor at.
      moving: false                                                                   // Campo moving: campo de datos para moving.
    },
    {                                                                                 // Elemento: entrada de objeto dentro de una lista de datos.
      id: 1,                                                                          // Campo id: campo de datos para id.
      key: "leftFrontal",                                                             // Campo key: campo de datos para key.
      channel: 1,                                                                     // Campo channel: campo de datos para channel.
      label: "Hombro izq frontal",                                                    // Campo label: campo de datos para label.
      short: "L.FRO",                                                                 // Campo short: campo de datos para short.
      side: "left",                                                                   // Campo side: campo de datos para side.
      movement: "Levantar al frente",                                                 // Campo movement: campo de datos para movement.
      sensorKey: "imuLeftFrontal",                                                    // Campo sensorKey: campo de datos para sensor key.
      sensorLabel: "MPU TCA1",                                                        // Campo sensorLabel: campo de datos para sensor label.
      minAngle: 0,                                                                    // Campo minAngle: campo de datos para control angular de servos.
      maxAngle: 120,                                                                  // Campo maxAngle: campo de datos para control angular de servos.
      homeAngle: 0,                                                                   // Campo homeAngle: campo de datos para control angular de servos.
      direction: 1,                                                                   // Campo direction: campo de datos para direction.
      pwmAt0: 102,                                                                    // Campo pwmAt0: campo de datos para control angular de servos.
      pwmAt270: 512,                                                                  // Campo pwmAt270: campo de datos para control angular de servos.
      mechanicalOffset: 0,                                                            // Campo mechanicalOffset: campo de datos para mechanical offset.
      testAngle: 0,                                                                   // Campo testAngle: campo de datos para control angular de servos.
      liveAngle: 0,                                                                   // Campo liveAngle: campo de datos para control angular de servos.
      liveSensor: 0,                                                                  // Campo liveSensor: campo de datos para live sensor.
      liveSensorSpeed: 0,                                                             // Campo liveSensorSpeed: campo de datos para live sensor speed.
      lastSensorDeg: null,                                                            // Campo lastSensorDeg: campo de datos para control angular de servos.
      lastSensorAt: null,                                                             // Campo lastSensorAt: campo de datos para last sensor at.
      moving: false                                                                   // Campo moving: campo de datos para moving.
    },
    {                                                                                 // Elemento: entrada de objeto dentro de una lista de datos.
      id: 2,                                                                          // Campo id: campo de datos para id.
      key: "leftElbow",                                                               // Campo key: campo de datos para key.
      channel: 2,                                                                     // Campo channel: campo de datos para channel.
      label: "Codo izquierdo",                                                        // Campo label: campo de datos para label.
      short: "L.ELB",                                                                 // Campo short: campo de datos para short.
      side: "left",                                                                   // Campo side: campo de datos para side.
      movement: "Flexion de codo",                                                    // Campo movement: campo de datos para movement.
      sensorKey: "as5600LeftElbow",                                                   // Campo sensorKey: campo de datos para sensor key.
      sensorLabel: "AS5600 TCA4",                                                     // Campo sensorLabel: campo de datos para sensor label.
      minAngle: 0,                                                                    // Campo minAngle: campo de datos para control angular de servos.
      maxAngle: 90,                                                                   // Campo maxAngle: campo de datos para control angular de servos.
      homeAngle: 0,                                                                   // Campo homeAngle: campo de datos para control angular de servos.
      direction: 1,                                                                   // Campo direction: campo de datos para direction.
      pwmAt0: 102,                                                                    // Campo pwmAt0: campo de datos para control angular de servos.
      pwmAt270: 512,                                                                  // Campo pwmAt270: campo de datos para control angular de servos.
      mechanicalOffset: 0,                                                            // Campo mechanicalOffset: campo de datos para mechanical offset.
      testAngle: 0,                                                                   // Campo testAngle: campo de datos para control angular de servos.
      liveAngle: 0,                                                                   // Campo liveAngle: campo de datos para control angular de servos.
      liveSensor: 0,                                                                  // Campo liveSensor: campo de datos para live sensor.
      liveSensorSpeed: 0,                                                             // Campo liveSensorSpeed: campo de datos para live sensor speed.
      lastSensorDeg: null,                                                            // Campo lastSensorDeg: campo de datos para control angular de servos.
      lastSensorAt: null,                                                             // Campo lastSensorAt: campo de datos para last sensor at.
      moving: false                                                                   // Campo moving: campo de datos para moving.
    },
    {                                                                                 // Elemento: entrada de objeto dentro de una lista de datos.
      id: 3,                                                                          // Campo id: campo de datos para id.
      key: "rightLateral",                                                            // Campo key: campo de datos para key.
      channel: 3,                                                                     // Campo channel: campo de datos para channel.
      label: "Hombro der lateral",                                                    // Campo label: campo de datos para label.
      short: "R.LAT",                                                                 // Campo short: campo de datos para short.
      side: "right",                                                                  // Campo side: campo de datos para side.
      movement: "Levantar a los lados",                                               // Campo movement: campo de datos para movement.
      sensorKey: "imuRightLateral",                                                   // Campo sensorKey: campo de datos para sensor key.
      sensorLabel: "MPU TCA2",                                                        // Campo sensorLabel: campo de datos para sensor label.
      minAngle: 0,                                                                    // Campo minAngle: campo de datos para control angular de servos.
      maxAngle: 90,                                                                   // Campo maxAngle: campo de datos para control angular de servos.
      homeAngle: 0,                                                                   // Campo homeAngle: campo de datos para control angular de servos.
      direction: 1,                                                                   // Campo direction: campo de datos para direction.
      pwmAt0: 102,                                                                    // Campo pwmAt0: campo de datos para control angular de servos.
      pwmAt270: 512,                                                                  // Campo pwmAt270: campo de datos para control angular de servos.
      mechanicalOffset: 0,                                                            // Campo mechanicalOffset: campo de datos para mechanical offset.
      testAngle: 0,                                                                   // Campo testAngle: campo de datos para control angular de servos.
      liveAngle: 0,                                                                   // Campo liveAngle: campo de datos para control angular de servos.
      liveSensor: 0,                                                                  // Campo liveSensor: campo de datos para live sensor.
      liveSensorSpeed: 0,                                                             // Campo liveSensorSpeed: campo de datos para live sensor speed.
      lastSensorDeg: null,                                                            // Campo lastSensorDeg: campo de datos para control angular de servos.
      lastSensorAt: null,                                                             // Campo lastSensorAt: campo de datos para last sensor at.
      moving: false                                                                   // Campo moving: campo de datos para moving.
    },
    {                                                                                 // Elemento: entrada de objeto dentro de una lista de datos.
      id: 4,                                                                          // Campo id: campo de datos para id.
      key: "rightFrontal",                                                            // Campo key: campo de datos para key.
      channel: 4,                                                                     // Campo channel: campo de datos para channel.
      label: "Hombro der frontal",                                                    // Campo label: campo de datos para label.
      short: "R.FRO",                                                                 // Campo short: campo de datos para short.
      side: "right",                                                                  // Campo side: campo de datos para side.
      movement: "Levantar al frente",                                                 // Campo movement: campo de datos para movement.
      sensorKey: "imuRightFrontal",                                                   // Campo sensorKey: campo de datos para sensor key.
      sensorLabel: "MPU TCA3",                                                        // Campo sensorLabel: campo de datos para sensor label.
      minAngle: 0,                                                                    // Campo minAngle: campo de datos para control angular de servos.
      maxAngle: 120,                                                                  // Campo maxAngle: campo de datos para control angular de servos.
      homeAngle: 0,                                                                   // Campo homeAngle: campo de datos para control angular de servos.
      direction: 1,                                                                   // Campo direction: campo de datos para direction.
      pwmAt0: 102,                                                                    // Campo pwmAt0: campo de datos para control angular de servos.
      pwmAt270: 512,                                                                  // Campo pwmAt270: campo de datos para control angular de servos.
      mechanicalOffset: 0,                                                            // Campo mechanicalOffset: campo de datos para mechanical offset.
      testAngle: 0,                                                                   // Campo testAngle: campo de datos para control angular de servos.
      liveAngle: 0,                                                                   // Campo liveAngle: campo de datos para control angular de servos.
      liveSensor: 0,                                                                  // Campo liveSensor: campo de datos para live sensor.
      liveSensorSpeed: 0,                                                             // Campo liveSensorSpeed: campo de datos para live sensor speed.
      lastSensorDeg: null,                                                            // Campo lastSensorDeg: campo de datos para control angular de servos.
      lastSensorAt: null,                                                             // Campo lastSensorAt: campo de datos para last sensor at.
      moving: false                                                                   // Campo moving: campo de datos para moving.
    },
    {                                                                                 // Elemento: entrada de objeto dentro de una lista de datos.
      id: 5,                                                                          // Campo id: campo de datos para id.
      key: "rightElbow",                                                              // Campo key: campo de datos para key.
      channel: 5,                                                                     // Campo channel: campo de datos para channel.
      label: "Codo derecho",                                                          // Campo label: campo de datos para label.
      short: "R.ELB",                                                                 // Campo short: campo de datos para short.
      side: "right",                                                                  // Campo side: campo de datos para side.
      movement: "Flexion de codo",                                                    // Campo movement: campo de datos para movement.
      sensorKey: "as5600RightElbow",                                                  // Campo sensorKey: campo de datos para sensor key.
      sensorLabel: "AS5600 TCA5",                                                     // Campo sensorLabel: campo de datos para sensor label.
      minAngle: 0,                                                                    // Campo minAngle: campo de datos para control angular de servos.
      maxAngle: 90,                                                                   // Campo maxAngle: campo de datos para control angular de servos.
      homeAngle: 0,                                                                   // Campo homeAngle: campo de datos para control angular de servos.
      direction: 1,                                                                   // Campo direction: campo de datos para direction.
      pwmAt0: 102,                                                                    // Campo pwmAt0: campo de datos para control angular de servos.
      pwmAt270: 512,                                                                  // Campo pwmAt270: campo de datos para control angular de servos.
      mechanicalOffset: 0,                                                            // Campo mechanicalOffset: campo de datos para mechanical offset.
      testAngle: 0,                                                                   // Campo testAngle: campo de datos para control angular de servos.
      liveAngle: 0,                                                                   // Campo liveAngle: campo de datos para control angular de servos.
      liveSensor: 0,                                                                  // Campo liveSensor: campo de datos para live sensor.
      liveSensorSpeed: 0,                                                             // Campo liveSensorSpeed: campo de datos para live sensor speed.
      lastSensorDeg: null,                                                            // Campo lastSensorDeg: campo de datos para control angular de servos.
      lastSensorAt: null,                                                             // Campo lastSensorAt: campo de datos para last sensor at.
      moving: false                                                                   // Campo moving: campo de datos para moving.
    }
  ];

  const IMU_DEFAULTS = [                                                              // Arreglo IMU_DEFAULTS: catalogo base de IMU y su enlace con cada servo.
    {                                                                                 // Elemento: entrada de objeto dentro de una lista de datos.
      key: "imuLeftLateral",                                                          // Campo key: campo de datos para key.
      bus: 0,                                                                         // Campo bus: campo de datos para bus.
      servoId: 0,                                                                     // Campo servoId: campo de datos para control angular de servos.
      label: "Hombro izq lateral",                                                    // Campo label: campo de datos para label.
      axis: "GY",                                                                     // Campo axis: campo de datos para axis.
      plane: "YZ",                                                                    // Campo plane: campo de datos para plane.
      neutralDeg: 0,                                                                  // Campo neutralDeg: campo de datos para control angular de servos.
      minDeg: 0,                                                                      // Campo minDeg: campo de datos para control angular de servos.
      maxDeg: 90,                                                                     // Campo maxDeg: campo de datos para control angular de servos.
      invert: false,                                                                  // Campo invert: campo de datos para invert.
      liveDeg: 0,                                                                     // Campo liveDeg: campo de datos para control angular de servos.
      liveSpeed: 0                                                                    // Campo liveSpeed: campo de datos para live speed.
    },
    {                                                                                 // Elemento: entrada de objeto dentro de una lista de datos.
      key: "imuLeftFrontal",                                                          // Campo key: campo de datos para key.
      bus: 1,                                                                         // Campo bus: campo de datos para bus.
      servoId: 1,                                                                     // Campo servoId: campo de datos para control angular de servos.
      label: "Hombro izq frontal",                                                    // Campo label: campo de datos para label.
      axis: "GX",                                                                     // Campo axis: campo de datos para axis.
      plane: "XZ",                                                                    // Campo plane: campo de datos para plane.
      neutralDeg: 0,                                                                  // Campo neutralDeg: campo de datos para control angular de servos.
      minDeg: 0,                                                                      // Campo minDeg: campo de datos para control angular de servos.
      maxDeg: 120,                                                                    // Campo maxDeg: campo de datos para control angular de servos.
      invert: false,                                                                  // Campo invert: campo de datos para invert.
      liveDeg: 0,                                                                     // Campo liveDeg: campo de datos para control angular de servos.
      liveSpeed: 0                                                                    // Campo liveSpeed: campo de datos para live speed.
    },
    {                                                                                 // Elemento: entrada de objeto dentro de una lista de datos.
      key: "imuRightLateral",                                                         // Campo key: campo de datos para key.
      bus: 2,                                                                         // Campo bus: campo de datos para bus.
      servoId: 3,                                                                     // Campo servoId: campo de datos para control angular de servos.
      label: "Hombro der lateral",                                                    // Campo label: campo de datos para label.
      axis: "GY",                                                                     // Campo axis: campo de datos para axis.
      plane: "YZ",                                                                    // Campo plane: campo de datos para plane.
      neutralDeg: 0,                                                                  // Campo neutralDeg: campo de datos para control angular de servos.
      minDeg: 0,                                                                      // Campo minDeg: campo de datos para control angular de servos.
      maxDeg: 90,                                                                     // Campo maxDeg: campo de datos para control angular de servos.
      invert: false,                                                                  // Campo invert: campo de datos para invert.
      liveDeg: 0,                                                                     // Campo liveDeg: campo de datos para control angular de servos.
      liveSpeed: 0                                                                    // Campo liveSpeed: campo de datos para live speed.
    },
    {                                                                                 // Elemento: entrada de objeto dentro de una lista de datos.
      key: "imuRightFrontal",                                                         // Campo key: campo de datos para key.
      bus: 3,                                                                         // Campo bus: campo de datos para bus.
      servoId: 4,                                                                     // Campo servoId: campo de datos para control angular de servos.
      label: "Hombro der frontal",                                                    // Campo label: campo de datos para label.
      axis: "GX",                                                                     // Campo axis: campo de datos para axis.
      plane: "XZ",                                                                    // Campo plane: campo de datos para plane.
      neutralDeg: 0,                                                                  // Campo neutralDeg: campo de datos para control angular de servos.
      minDeg: 0,                                                                      // Campo minDeg: campo de datos para control angular de servos.
      maxDeg: 120,                                                                    // Campo maxDeg: campo de datos para control angular de servos.
      invert: false,                                                                  // Campo invert: campo de datos para invert.
      liveDeg: 0,                                                                     // Campo liveDeg: campo de datos para control angular de servos.
      liveSpeed: 0                                                                    // Campo liveSpeed: campo de datos para live speed.
    }
  ];

  const AS5600_DEFAULTS = [                                                           // Arreglo AS5600_DEFAULTS: catalogo base de sensores AS5600 y su calibracion.
    {                                                                                 // Elemento: entrada de objeto dentro de una lista de datos.
      key: "as5600LeftElbow",                                                         // Campo key: campo de datos para key.
      channel: 4,                                                                     // Campo channel: canal TCA9548A del AS5600.
      servoId: 2,                                                                     // Campo servoId: campo de datos para control angular de servos.
      label: "Codo izquierdo",                                                        // Campo label: campo de datos para label.
      raw0: 0,                                                                        // Campo raw0: lectura AS5600 para 0 grados.
      raw90: 1024,                                                                    // Campo raw90: lectura AS5600 para 90 grados.
      neutralDeg: 0,                                                                  // Campo neutralDeg: campo de datos para control angular de servos.
      invert: false,                                                                  // Campo invert: campo de datos para invert.
      liveRaw: 0,                                                                     // Campo liveRaw: campo de datos para live raw.
      liveDeg: 0,                                                                     // Campo liveDeg: campo de datos para control angular de servos.
      liveSpeed: 0                                                                    // Campo liveSpeed: campo de datos para live speed.
    },
    {                                                                                 // Elemento: entrada de objeto dentro de una lista de datos.
      key: "as5600RightElbow",                                                        // Campo key: campo de datos para key.
      channel: 5,                                                                     // Campo channel: canal TCA9548A del AS5600.
      servoId: 5,                                                                     // Campo servoId: campo de datos para control angular de servos.
      label: "Codo derecho",                                                          // Campo label: campo de datos para label.
      raw0: 0,                                                                        // Campo raw0: lectura AS5600 para 0 grados.
      raw90: 1024,                                                                    // Campo raw90: lectura AS5600 para 90 grados.
      neutralDeg: 0,                                                                  // Campo neutralDeg: campo de datos para control angular de servos.
      invert: false,                                                                  // Campo invert: campo de datos para invert.
      liveRaw: 0,                                                                     // Campo liveRaw: campo de datos para live raw.
      liveDeg: 0,                                                                     // Campo liveDeg: campo de datos para control angular de servos.
      liveSpeed: 0                                                                    // Campo liveSpeed: campo de datos para live speed.
    }
  ];

  const HARDWARE_CHECKS = [                                                           // Arreglo HARDWARE_CHECKS: lista de verificacion fisica del sistema.
    { key: "controller", label: "ESP32-S3 N16R8", detail: "Control" },                // Elemento: entrada de objeto dentro de una lista de datos.
    { key: "camera", label: "ESP32-CAM", detail: "Vision" },                          // Elemento: entrada de objeto dentro de una lista de datos.
    { key: "pca9685", label: "PCA9685 0x40", detail: "Servos" },                      // Elemento: entrada de objeto dentro de una lista de datos.
    { key: "tca9548a", label: "TCA9548A 0x70", detail: "IMU + AS5600" },              // Elemento: entrada de objeto dentro de una lista de datos.
    { key: "imu0", label: "MPU6050 TCA0", detail: "L.LAT" },                          // Elemento: entrada de objeto dentro de una lista de datos.
    { key: "imu1", label: "MPU6050 TCA1", detail: "L.FRO" },                          // Elemento: entrada de objeto dentro de una lista de datos.
    { key: "imu2", label: "MPU6050 TCA2", detail: "R.LAT" },                          // Elemento: entrada de objeto dentro de una lista de datos.
    { key: "imu3", label: "MPU6050 TCA3", detail: "R.FRO" },                          // Elemento: entrada de objeto dentro de una lista de datos.
    { key: "as5600L", label: "AS5600 TCA4", detail: "L.ELB" },                        // Elemento: entrada de objeto dentro de una lista de datos.
    { key: "as5600R", label: "AS5600 TCA5", detail: "R.ELB" },                        // Elemento: entrada de objeto dentro de una lista de datos.
    { key: "servoL", label: "3 servos lado izq", detail: "0-2" },                     // Elemento: entrada de objeto dentro de una lista de datos.
    { key: "servoR", label: "3 servos lado der", detail: "3-5" },                     // Elemento: entrada de objeto dentro de una lista de datos.
    { key: "battery", label: "Bateria y tierra comun", detail: "Poder" }              // Elemento: entrada de objeto dentro de una lista de datos.
  ];

  const BOM = [                                                                       // Arreglo BOM: lista de materiales usada en la fase de armado.
    { key: "esp32s3",   label: "ESP32-S3 N16R8 (antena externa)",        detail: "x1 - controlador principal" }, // Elemento: entrada de objeto dentro de una lista de datos.
    { key: "esp32cam",  label: "ESP32-CAM con OV2640",                   detail: "x1 - vision auxiliar" }, // Elemento: entrada de objeto dentro de una lista de datos.
    { key: "pca9685",   label: "PCA9685 (16 canales PWM)",               detail: "x1 - driver de servos en 0x40" }, // Elemento: entrada de objeto dentro de una lista de datos.
    { key: "tca9548a",  label: "TCA9548A (mux I2C)",                     detail: "x1 - aisla los 4 MPU6050 y 2 AS5600 en 0x70" }, // Elemento: entrada de objeto dentro de una lista de datos.
    { key: "mpu6050",   label: "MPU6050",                                detail: "x4 - hombros lat. y frontal de cada lado" }, // Elemento: entrada de objeto dentro de una lista de datos.
    { key: "as5600",    label: "AS5600",                                 detail: "x2 - sensores magneticos de codo" }, // Elemento: entrada de objeto dentro de una lista de datos.
    { key: "ds51150",   label: "Servo DS51150 150 kg/cm 270 deg",        detail: "x6 - tres por brazo" }, // Elemento: entrada de objeto dentro de una lista de datos.
    { key: "bat",       label: "Bateria LiPo 3S y BMS",                  detail: "x1 - 11.1 V con proteccion" }, // Elemento: entrada de objeto dentro de una lista de datos.
    { key: "buck",      label: "Convertidor 11.1 V -> 6 V para servos",  detail: "x1 - alta corriente, baja caida" }, // Elemento: entrada de objeto dentro de una lista de datos.
    { key: "buck5",     label: "Convertidor 11.1 V -> 5 V para logica",  detail: "x1 - alimenta ESP32, PCA, TCA y MPUs" }, // Elemento: entrada de objeto dentro de una lista de datos.
    { key: "cabling",   label: "Cableado Dupont y silicona AWG14",       detail: "Logica + corriente de servos" }, // Elemento: entrada de objeto dentro de una lista de datos.
    { key: "frame",     label: "Estructura mecanica (correas, soportes)",detail: "Lo necesario para sujetar al usuario" } // Elemento: entrada de objeto dentro de una lista de datos.
  ];

  const BUILD_STEPS = [                                                               // Arreglo BUILD_STEPS: pasos guiados para armar el exoesqueleto.
    {                                                                                 // Elemento: entrada de objeto dentro de una lista de datos.
      key: "step-frame",                                                              // Campo key: campo de datos para key.
      title: "Estructura mecanica del exoesqueleto",                                  // Campo title: campo de datos para title.
      // Campo detail: campo de datos para detail.
      detail: "Monta hombros, codos y arnes. Verifica que cada articulacion gire libremente dentro del rango util (0-90 lateral, 0-120 frontal, 0-90 codo)."
    },
    {                                                                                 // Elemento: entrada de objeto dentro de una lista de datos.
      key: "step-servos",                                                             // Campo key: campo de datos para key.
      title: "Servos DS51150 montados (6 en total)",                                  // Campo title: campo de datos para title.
      // Campo detail: campo de datos para detail.
      detail: "Tres por brazo: lateral de hombro, frontal de hombro y codo. Atornilla a la estructura sin tensar el eje. Marca con cinta el extremo donde el angulo es minimo."
    },
    {                                                                                 // Elemento: entrada de objeto dentro de una lista de datos.
      key: "step-imus",                                                               // Campo key: campo de datos para key.
      title: "MPU6050 alineados (4 en total)",                                        // Campo title: campo de datos para title.
      // Campo detail: campo de datos para detail.
      detail: "Hombro izq lateral, hombro izq frontal, hombro der lateral, hombro der frontal. El eje Z apunta perpendicular a la articulacion. Conectalos al TCA9548A en buses 0,1,2,3."
    },
    {                                                                                 // Elemento: entrada de objeto dentro de una lista de datos.
      key: "step-as5600",                                                             // Campo key: campo de datos para key.
      title: "AS5600 instalados en codos",                                            // Campo title: campo de datos para title.
      // Campo detail: campo de datos para detail.
      detail: "Monta un iman diametral en cada eje de codo y alinea el AS5600 frente al iman. Codo izq -> TCA4, codo der -> TCA5, ambos en direccion I2C 0x36."
    },
    {                                                                                 // Elemento: entrada de objeto dentro de una lista de datos.
      key: "step-pca",                                                                // Campo key: campo de datos para key.
      title: "PCA9685 cableado al ESP32-S3",                                          // Campo title: campo de datos para title.
      // Campo detail: campo de datos para detail.
      detail: "SDA y SCL al I2C principal. V+ a la rama de 6 V (servos). Vcc logica a 3.3 V o 5 V segun version. GND comun con el ESP32."
    },
    {                                                                                 // Elemento: entrada de objeto dentro de una lista de datos.
      key: "step-tca",                                                                // Campo key: campo de datos para key.
      title: "TCA9548A cableado y MPUs en buses",                                     // Campo title: campo de datos para title.
      detail: "SDA/SCL del TCA al ESP32. Cada MPU6050 a un bus distinto (0..3). Direccion 0x68 en todos. Vcc 3.3 V." // Campo detail: campo de datos para detail.
    },
    {                                                                                 // Elemento: entrada de objeto dentro de una lista de datos.
      key: "step-power",                                                              // Campo key: campo de datos para key.
      title: "Bus de potencia con tierra comun",                                      // Campo title: campo de datos para title.
      // Campo detail: campo de datos para detail.
      detail: "Bateria 11.1 V -> buck 6 V (servos) y buck 5 V (logica). Conecta TODAS las tierras al mismo punto. Sin tierra comun los servos saturan o reinician el ESP32."
    },
    {                                                                                 // Elemento: entrada de objeto dentro de una lista de datos.
      key: "step-cam",                                                                // Campo key: campo de datos para key.
      title: "ESP32-CAM en su soporte",                                               // Campo title: campo de datos para title.
      detail: "Montaje rigido apuntando al usuario. Misma red WiFi que el ESP32-S3. Cableado de alimentacion separado de la logica." // Campo detail: campo de datos para detail.
    },
    {                                                                                 // Elemento: entrada de objeto dentro de una lista de datos.
      key: "step-wifi",                                                               // Campo key: campo de datos para key.
      title: "Credenciales WiFi configuradas",                                        // Campo title: campo de datos para title.
      // Campo detail: campo de datos para detail.
      detail: "Edita esp32_s3_config.h y esp32_cam_config.h con SSID y password de la red local. Subiras los firmwares en la siguiente fase."
    },
    {                                                                                 // Elemento: entrada de objeto dentro de una lista de datos.
      key: "step-visual",                                                             // Campo key: campo de datos para key.
      title: "Inspeccion visual final del armado",                                    // Campo title: campo de datos para title.
      // Campo detail: campo de datos para detail.
      detail: "Tornillos al par correcto, cables sin tension, conectores asegurados, no hay corto a tierra accidental, batería desconectada antes del primer encendido controlado."
    }
  ];

  const TEST_DEFS = [                                                                 // Arreglo TEST_DEFS: definiciones de pruebas funcionales de diagnostico.
    {                                                                                 // Elemento: entrada de objeto dentro de una lista de datos.
      key: "ws-link",                                                                 // Campo key: campo de datos para key.
      label: "Enlace WebSocket S3",                                                   // Campo label: campo de datos para label.
      detail: "Confirma que el ESP32-S3 responde con paquete sensors o ack."          // Campo detail: campo de datos para detail.
    },
    {                                                                                 // Elemento: entrada de objeto dentro de una lista de datos.
      key: "ack-firmware",                                                            // Campo key: campo de datos para key.
      label: "ACK con firmware reportado",                                            // Campo label: campo de datos para label.
      detail: "Solicita cmd_status y verifica que el ESP32 envia version y rol."      // Campo detail: campo de datos para detail.
    },
    {                                                                                 // Elemento: entrada de objeto dentro de una lista de datos.
      key: "estop-clear",                                                             // Campo key: campo de datos para key.
      label: "Salida de estado de emergencia",                                        // Campo label: campo de datos para label.
      detail: "Envia cmd_reset y confirma que el modo deja de ser emergency."         // Campo detail: campo de datos para detail.
    },
    {                                                                                 // Elemento: entrada de objeto dentro de una lista de datos.
      key: "mode-manual",                                                             // Campo key: campo de datos para key.
      label: "Cambio a modo manual",                                                  // Campo label: campo de datos para label.
      detail: "Manda cmd_mode manual y espera que la telemetria refleje el cambio."   // Campo detail: campo de datos para detail.
    },
    {                                                                                 // Elemento: entrada de objeto dentro de una lista de datos.
      key: "mode-assisted",                                                           // Campo key: campo de datos para key.
      label: "Cambio a modo asistido",                                                // Campo label: campo de datos para label.
      detail: "Manda cmd_mode assisted y verifica modo en telemetria."                // Campo detail: campo de datos para detail.
    },
    {                                                                                 // Elemento: entrada de objeto dentro de una lista de datos.
      key: "mode-auto",                                                               // Campo key: campo de datos para key.
      label: "Cambio a modo automatico",                                              // Campo label: campo de datos para label.
      detail: "Manda cmd_mode automatic y verifica modo en telemetria."               // Campo detail: campo de datos para detail.
    },
    {                                                                                 // Elemento: entrada de objeto dentro de una lista de datos.
      key: "servo-sweep-l-lat",                                                       // Campo key: campo de datos para key.
      label: "Sweep L.LAT (servo 0)",                                                 // Campo label: campo de datos para label.
      detail: "Manda home, max y home. Verifica respuesta en telemetria."             // Campo detail: campo de datos para detail.
    },
    {                                                                                 // Elemento: entrada de objeto dentro de una lista de datos.
      key: "servo-sweep-l-fro",                                                       // Campo key: campo de datos para key.
      label: "Sweep L.FRO (servo 1)",                                                 // Campo label: campo de datos para label.
      detail: "Mismo procedimiento para el frontal izquierdo."                        // Campo detail: campo de datos para detail.
    },
    {                                                                                 // Elemento: entrada de objeto dentro de una lista de datos.
      key: "servo-sweep-l-elb",                                                       // Campo key: campo de datos para key.
      label: "Sweep L.ELB (servo 2)",                                                 // Campo label: campo de datos para label.
      detail: "Codo izquierdo: home, max, home."                                      // Campo detail: campo de datos para detail.
    },
    {                                                                                 // Elemento: entrada de objeto dentro de una lista de datos.
      key: "servo-sweep-r-lat",                                                       // Campo key: campo de datos para key.
      label: "Sweep R.LAT (servo 3)",                                                 // Campo label: campo de datos para label.
      detail: "Hombro derecho lateral: home, max, home."                              // Campo detail: campo de datos para detail.
    },
    {                                                                                 // Elemento: entrada de objeto dentro de una lista de datos.
      key: "servo-sweep-r-fro",                                                       // Campo key: campo de datos para key.
      label: "Sweep R.FRO (servo 4)",                                                 // Campo label: campo de datos para label.
      detail: "Hombro derecho frontal: home, max, home."                              // Campo detail: campo de datos para detail.
    },
    {                                                                                 // Elemento: entrada de objeto dentro de una lista de datos.
      key: "servo-sweep-r-elb",                                                       // Campo key: campo de datos para key.
      label: "Sweep R.ELB (servo 5)",                                                 // Campo label: campo de datos para label.
      detail: "Codo derecho: home, max, home."                                        // Campo detail: campo de datos para detail.
    },
    {                                                                                 // Elemento: entrada de objeto dentro de una lista de datos.
      key: "imu-live",                                                                // Campo key: campo de datos para key.
      label: "Lectura en vivo de los 4 MPU6050",                                      // Campo label: campo de datos para label.
      detail: "Cada IMU debe reportar valor finito y dentro de su rango."             // Campo detail: campo de datos para detail.
    },
    {                                                                                 // Elemento: entrada de objeto dentro de una lista de datos.
      key: "as5600-live",                                                             // Campo key: campo de datos para key.
      label: "Lectura en vivo de los 2 AS5600",                                       // Campo label: campo de datos para label.
      detail: "Cada AS5600 debe entregar raw I2C 0..4095 dentro del rango calibrado." // Campo detail: campo de datos para detail.
    },
    {                                                                                 // Elemento: entrada de objeto dentro de una lista de datos.
      key: "estop-trigger",                                                           // Campo key: campo de datos para key.
      label: "Parada de emergencia remota",                                           // Campo label: campo de datos para label.
      detail: "Envia cmd_stop y confirma que el modo es emergency."                   // Campo detail: campo de datos para detail.
    }
  ];

  let state = loadState();                                                            // Estado state: estado mutable de estado y perfil persistido.
  let ws = null;                                                                      // Estado ws: estado mutable de comunicaciones y puertos.
  let serialEvents = null;                                                            // Estado serialEvents: estado mutable de comunicaciones y puertos.
  let serialConnected = false;                                                        // Estado serialConnected: estado mutable de comunicaciones y puertos.
  let serialSendQueue = Promise.resolve();                                            // Estado serialSendQueue: estado mutable de comunicaciones y puertos.
  const SERIAL_TELEMETRY_UI_MS = 100;                                                 // Constante SERIAL_TELEMETRY_UI_MS: limita refresco UI cuando COM manda sensores.
  const SERIAL_MONITOR_SENSOR_MS = 750;                                               // Constante SERIAL_MONITOR_SENSOR_MS: evita llenar el monitor con JSON pesado.
  const SERIAL_MONITOR_DUPLICATE_MS = 2000;                                           // Constante SERIAL_MONITOR_DUPLICATE_MS: colapsa rafagas iguales.
  const serialMonitorLines = [];                                                      // Arreglo serialMonitorLines: buffer ligero para el monitor serie.
  let lastSerialTelemetryUiMs = 0;                                                    // Estado lastSerialTelemetryUiMs: ultimo refresco de telemetria serial.
  let pendingSerialTelemetryLine = "";                                                // Estado pendingSerialTelemetryLine: ultima telemetria serial pendiente.
  let serialTelemetryTimer = null;                                                    // Estado serialTelemetryTimer: temporizador de telemetria serial.
  let lastSerialMonitorSensorMs = 0;                                                  // Estado lastSerialMonitorSensorMs: ultimo resumen de sensores en monitor.
  let lastSerialMonitorText = "";                                                     // Estado lastSerialMonitorText: ultimo mensaje pintado en monitor serie.
  let lastSerialMonitorType = "";                                                     // Estado lastSerialMonitorType: tipo del ultimo mensaje serie.
  let lastSerialMonitorAt = 0;                                                        // Estado lastSerialMonitorAt: momento del ultimo mensaje serie.
  let lastSerialMonitorRepeatRenderAt = 0;                                            // Estado lastSerialMonitorRepeatRenderAt: limita repintado de repetidos.
  let serialMonitorRepeatCount = 0;                                                   // Estado serialMonitorRepeatCount: cuenta rafagas repetidas.
  let firmwareAudioCtx = null;                                                        // Estado firmwareAudioCtx: timbre corto para la cuenta regresiva de carga.
  const firmwareBeepDataUris = {};                                                    // Objeto firmwareBeepDataUris: cache de timbres WAV generados en memoria.
  let serialJsonAssembly = "";                                                        // Estado serialJsonAssembly: arma JSON serial si llega cortado por chunks.
  let serialJsonAssemblyAt = 0;                                                       // Estado serialJsonAssemblyAt: inicio del armado de JSON serial.
  let demoTimer = null;                                                               // Estado demoTimer: estado mutable de demo timer.
  let sessionStart = Date.now();                                                      // Estado sessionStart: estado mutable de autenticacion local.
  let drawQueued = false;                                                             // Estado drawQueued: estado mutable de interfaz tecnica.
  let lastPortsSignature = "";                                                        // Estado lastPortsSignature: estado mutable de comunicaciones y puertos.
  let portsRefreshInFlight = null;                                                    // Estado portsRefreshInFlight: estado mutable de comunicaciones y puertos.
  let portsAutoRefreshTimer = null;                                                   // Estado portsAutoRefreshTimer: estado mutable de comunicaciones y puertos.

  // ESP detector state: tracks which ports we've already shown a popup for
  // and which ones the user asked us to leave alone for this session.
  const detectedPortsSeen = new Set();                                                // Conjunto detectedPortsSeen: conjunto de valores para comunicaciones y puertos.
  const detectedPortsIgnored = new Set();                                             // Conjunto detectedPortsIgnored: conjunto de valores para comunicaciones y puertos.
  const autoConnectedS3Ports = new Set();                                             // Conjunto autoConnectedS3Ports: puertos S3 que ya se intentaron conectar solos.
  const detectedPortQueue = [];                                                       // Arreglo detectedPortQueue: arreglo de datos para comunicaciones y puertos.
  let detectedActivePort = null;                                                      // Estado detectedActivePort: estado mutable de comunicaciones y puertos.
  let s3AutoSerialConnecting = false;                                                 // Estado s3AutoSerialConnecting: evita pelear varios COM a la vez.
  let lastResolvedS3Url = "";                                                         // Estado lastResolvedS3Url: estado mutable de last resolved s3 url.
  let lastResolvedCamUrl = "";                                                        // Estado lastResolvedCamUrl: estado mutable de camara y video.
  let s3Detecting = false;                                                            // Estado s3Detecting: estado mutable de s3 detecting.
  let autoConnectS3Url = "";                                                          // Estado autoConnectS3Url: estado mutable de auto connect s3 url.
  let autoConnectS3Timer = null;                                                      // Estado autoConnectS3Timer: estado mutable de auto connect s3 timer.
  let s3ReconnectTimer = null;                                                        // Estado s3ReconnectTimer: estado mutable de s3 reconnect timer.
  let s3ReconnectAttempt = 0;                                                         // Estado s3ReconnectAttempt: estado mutable de s3 reconnect attempt.
  let s3ManualDisconnect = false;                                                     // Estado s3ManualDisconnect: estado mutable de s3 manual disconnect.
  let cameraRetryTimer = null;                                                        // Estado cameraRetryTimer: estado mutable de camara y video.
  let cameraFirstFrameTimer = null;                                                   // Estado cameraFirstFrameTimer: estado mutable de camara y video.
  let cameraActiveUrl = "";                                                           // Estado cameraActiveUrl: estado mutable de camara y video.
  let cameraRunId = 0;                                                                // Estado cameraRunId: estado mutable de camara y video.
  let cameraRecorder = null;
  let cameraRecordChunks = [];
  let cameraRecordCanvas = null;
  let cameraRecordTimer = null;
  const CAM_USB_STREAM_BAUD = 230400;                                                 // Constante CAM_USB_STREAM_BAUD: constante usada en camara y video.
  const CAM_USB_FALLBACK_STREAM_BAUD = 115200;                                        // Constante CAM_USB_FALLBACK_STREAM_BAUD: constante usada en camara y video.
  const CAMERA_RETRY_LIMIT = 4;                                                       // Constante CAMERA_RETRY_LIMIT: constante usada en camara y video.
  const CAMERA_FIRST_FRAME_TIMEOUT_MS = 14000;                                        // Constante CAMERA_FIRST_FRAME_TIMEOUT_MS: constante usada en camara y video.
  const CAMERA_FIRST_FRAME_POLL_MS = 180;                                             // Constante CAMERA_FIRST_FRAME_POLL_MS: constante usada en camara y video.
  const CAMERA_RECORD_FPS = 8;
  const CAMERA_RECORD_MAX_WIDTH = 640;

  function defaultState() {                                                           // Funcion defaultState: construye el estado inicial de la consola tecnica.
    return {                                                                          // Retorno: entrega el resultado al llamador.
      schema: PROFILE_SCHEMA,                                                         // Campo schema: campo de datos para schema.
      connection: {                                                                   // Campo connection: objeto anidado de configuracion.
        s3Url: S3_BATTERY_AP_WS_URL,                                                  // Campo s3Url: campo de datos para s3 url.
        camUrl: "http://192.168.1.101/stream",
        s3Port: "",                                                                   // Campo s3Port: campo de datos para comunicaciones y puertos.
        s3Baud: 115200,                                                               // Campo s3Baud: campo de datos para s3 baud.
        camPort: "",                                                                  // Campo camPort: campo de datos para camara y video.
        camBaud: 115200                                                               // Campo camBaud: campo de datos para camara y video.
      },
      metadata: {                                                                     // Campo metadata: objeto anidado de configuracion.
        serial: "",                                                                   // Campo serial: campo de datos para comunicaciones y puertos.
        technician: "",                                                               // Campo technician: campo de datos para technician.
        client: "",                                                                   // Campo client: campo de datos para client.
        firmware: "",                                                                 // Campo firmware: campo de datos para firmware y compilacion Arduino.
        notes: ""                                                                     // Campo notes: campo de datos para notes.
      },
      hardwareChecks: Object.fromEntries(HARDWARE_CHECKS.map((item) => [item.key, false])), // Campo hardwareChecks: campo de datos para diagnostico y pruebas.
      build: {                                                                        // Campo build: objeto anidado de configuracion.
        bom: Object.fromEntries(BOM.map((item) => [item.key, false])),                // Campo bom: campo de datos para armado y lista de materiales.
        steps: Object.fromEntries(BUILD_STEPS.map((item) => [item.key, false]))       // Campo steps: campo de datos para steps.
      },
      tests: Object.fromEntries(TEST_DEFS.map((item) => [item.key, { status: "idle", at: null, message: "" }])), // Campo tests: campo de datos para diagnostico y pruebas.
      testRuns: 0,                                                                    // Campo testRuns: campo de datos para diagnostico y pruebas.
      lastTestRunAt: null,                                                            // Campo lastTestRunAt: campo de datos para diagnostico y pruebas.
      servos: SERVO_DEFAULTS.map((item) => ({ ...item })),                            // Campo servos: campo de datos para control angular de servos.
      imus: IMU_DEFAULTS.map((item) => ({ ...item })),                                // Campo imus: campo de datos para lectura de sensores IMU/I2C.
      as5600: AS5600_DEFAULTS.map((item) => ({ ...item })),                           // Campo as5600: sensores magneticos de codo.
      tuning: {                                                                       // Campo tuning: objeto anidado de configuracion.
        assistLevel: 0.5,                                                             // Campo assistLevel: campo de datos para assist level.
        deadbandDeg: 2,                                                               // Campo deadbandDeg: campo de datos para control angular de servos.
        smoothing: 1,                                                                 // Campo smoothing: respuesta directa para servos.
        maxSpeedDegSec: 2400                                                          // Campo maxSpeedDegSec: respaldo alto; seguimiento normal es directo.
      },
      firmware: {                                                                     // Campo firmware: objeto anidado de configuracion.
        s3: {                                                                         // Campo s3: objeto anidado de configuracion.
          label: "ESP32-S3 N16R8",                                                    // Campo label: campo de datos para label.
          fqbn: S3_DEFAULT_FQBN,                                                      // Campo fqbn: campo de datos para firmware y compilacion Arduino.
          port: "",                                                                   // Campo port: campo de datos para comunicaciones y puertos.
          fileName: "",                                                               // Campo fileName: campo de datos para file name.
          code: "",                                                                   // Campo code: campo de datos para code.
          source: "bundled"                                                           // Campo source: campo de datos para source.
        },
        cam: {                                                                        // Campo cam: objeto anidado de configuracion.
          label: "ESP32-CAM",                                                         // Campo label: campo de datos para label.
          fqbn: CAM_DEFAULT_FQBN,                                                     // Campo fqbn: campo de datos para firmware y compilacion Arduino.
          port: "",                                                                   // Campo port: campo de datos para comunicaciones y puertos.
          fileName: "",                                                               // Campo fileName: campo de datos para file name.
          code: "",                                                                   // Campo code: campo de datos para code.
          source: "bundled"                                                           // Campo source: campo de datos para source.
        }
      },
      telemetry: {                                                                    // Campo telemetry: objeto anidado de configuracion.
        mode: "manual",                                                               // Campo mode: campo de datos para mode.
        emergency: false,                                                             // Campo emergency: campo de datos para paro de emergencia.
        armed: false,                                                                 // Campo armed: indica si el firmware habilito PWM de servos.
        pcaOnline: null,                                                              // Campo pcaOnline: estado reportado del PCA9685.
        sensorless: true,                                                             // Campo sensorless: prueba manual sin lectura de sensores.
        battery: null,                                                                // Campo battery: campo de datos para battery.
        packets: 0,                                                                   // Campo packets: campo de datos para packets.
        lastPacketAt: null                                                            // Campo lastPacketAt: campo de datos para last packet at.
      },
      savedAt: null                                                                   // Campo savedAt: campo de datos para saved at.
    };
  }

  function loadState() {                                                              // Funcion loadState: lee el perfil persistido desde localStorage.
    const fresh = defaultState();                                                     // Constante fresh: constante usada en fresh.
    try {                                                                             // Bloque try: ejecuta una operacion que puede fallar.
      const raw = localStorage.getItem(STORAGE_KEY);                                  // Constante raw: constante usada en raw.
      if (!raw) return fresh;                                                         // Condicion: valida estado antes de continuar el flujo.
      const compactRaw = raw.length > 180000                                          // Constante compactRaw: poda codigo de firmware guardado antiguo.
        ? raw.replace(/"code":"(?:\\.|[^"\\])*"/g, '"code":""')
        : raw;
      if (compactRaw !== raw) localStorage.setItem(STORAGE_KEY, compactRaw);          // Condicion: sanea almacenamiento pesado heredado.
      const saved = JSON.parse(compactRaw);                                           // Constante saved: constante usada en saved.
      return hydrateState(fresh, saved);                                              // Retorno: entrega el resultado al llamador.
    } catch (error) {
      console.warn(error);                                                            // Llamada: ejecuta una accion del modulo actual.
      return fresh;                                                                   // Retorno: entrega el resultado al llamador.
    }
  }

  function hydrateState(fresh, saved) {                                               // Funcion hydrateState: mezcla datos guardados con el estado base actual.
    const byId = (list, id) => list.find((item) => item.id === id);                   // Funcion flecha byId: encapsula la logica de by id.
    const byKey = (list, key) => list.find((item) => item.key === key);               // Funcion flecha byKey: encapsula la logica de by key.

    const savedTests = saved.tests || {};                                             // Constante savedTests: constante usada en diagnostico y pruebas.
    const savedBuild = saved.build || {};                                             // Constante savedBuild: constante usada en interfaz tecnica.
    const hydrated = {                                                                // Objeto hydrated: objeto de configuracion para hydrated.
      ...fresh,
      connection: { ...fresh.connection, ...(saved.connection || {}) },               // Campo connection: objeto anidado de configuracion.
      metadata: { ...fresh.metadata, ...(saved.metadata || {}) },                     // Campo metadata: objeto anidado de configuracion.
      hardwareChecks: { ...fresh.hardwareChecks, ...(saved.hardwareChecks || {}) },   // Campo hardwareChecks: objeto anidado de configuracion.
      build: {                                                                        // Campo build: objeto anidado de configuracion.
        bom: { ...fresh.build.bom, ...(savedBuild.bom || {}) },                       // Campo bom: objeto anidado de configuracion.
        steps: { ...fresh.build.steps, ...(savedBuild.steps || {}) }                  // Campo steps: objeto anidado de configuracion.
      },
      tests: Object.fromEntries(TEST_DEFS.map((item) => {                             // Campo tests: campo de datos para diagnostico y pruebas.
        const previous = savedTests[item.key];                                        // Constante previous: constante usada en previous.
        const valid = previous && typeof previous === "object" && previous.status !== "run" // Constante valid: constante usada en valid.
          ? previous
          : { status: "idle", at: null, message: "" };
        return [item.key, { ...fresh.tests[item.key], ...valid }];                    // Retorno: entrega el resultado al llamador.
      })),
      testRuns: typeof saved.testRuns === "number" ? saved.testRuns : 0,              // Campo testRuns: campo de datos para diagnostico y pruebas.
      lastTestRunAt: saved.lastTestRunAt || null,                                     // Campo lastTestRunAt: campo de datos para diagnostico y pruebas.
      servos: fresh.servos.map((item) => ({ ...item, ...(byId(saved.servos || [], item.id) || {}) })), // Campo servos: campo de datos para control angular de servos.
      imus: fresh.imus.map((item) => ({ ...item, ...(byKey(saved.imus || [], item.key) || {}) })), // Campo imus: campo de datos para lectura de sensores IMU/I2C.
      as5600: fresh.as5600.map((item) => ({ ...item, ...(byKey(saved.as5600 || [], item.key) || {}) })), // Campo as5600: sensores magneticos de codo.
      tuning: { ...fresh.tuning, ...(saved.tuning || {}) },                           // Campo tuning: objeto anidado de configuracion.
      firmware: {                                                                     // Campo firmware: objeto anidado de configuracion.
        s3: { ...fresh.firmware.s3, ...((saved.firmware || {}).s3 || {}) },           // Campo s3: objeto anidado de configuracion.
        cam: { ...fresh.firmware.cam, ...((saved.firmware || {}).cam || {}) }         // Campo cam: objeto anidado de configuracion.
      },
      savedAt: saved.savedAt || null                                                  // Campo savedAt: campo de datos para saved at.
    };
    hydrated.firmware.s3.fqbn = normalizeS3Fqbn(hydrated.firmware.s3.fqbn);           // Asignacion: corrige FQBN guardados que usaban USB CDC.
    hydrated.firmware.s3.code = "";                                                   // Asignacion: el codigo se recarga desde archivo local, no desde localStorage.
    hydrated.firmware.cam.code = "";                                                  // Asignacion: evita inflar el perfil guardado con firmware completo.
    hydrated.tuning.smoothing = fresh.tuning.smoothing;                               // Asignacion: modo rapido, ignora suavizado viejo guardado.
    hydrated.tuning.maxSpeedDegSec = Math.max(fresh.tuning.maxSpeedDegSec, Number(hydrated.tuning.maxSpeedDegSec) || 0); // Asignacion: evita velocidad vieja de 90/180 deg/s.
    if ((saved.schema || 1) < 3) {                                                    // Condicion: restaura perfiles que fueron migrados por error a 270 grados.
      hydrated.servos = fresh.servos.map((item) => ({ ...item }));
      hydrated.tuning = {
        ...hydrated.tuning,
        smoothing: fresh.tuning.smoothing,
        maxSpeedDegSec: fresh.tuning.maxSpeedDegSec
      };
    }
    if (normalizeS3WsUrl(hydrated.connection.s3Url) === S3_PLACEHOLDER_WS_URL) {      // Condicion: valida estado antes de continuar el flujo.
      hydrated.connection.s3Url = S3_BATTERY_AP_WS_URL;                               // Asignacion: actualiza estado o salida calculada.
    }
    return hydrated;                                                                  // Retorno: entrega el resultado al llamador.
  }

  function clamp(value, min, max) {                                                   // Funcion clamp: limita un numero dentro de un rango cerrado.
    return Math.max(min, Math.min(max, value));                                       // Retorno: entrega el resultado al llamador.
  }

  function numberValue(value, fallback = 0) {                                         // Funcion numberValue: convierte entradas a numero con valor de respaldo.
    const parsed = Number(value);                                                     // Constante parsed: constante usada en parsed.
    return Number.isFinite(parsed) ? parsed : fallback;                               // Retorno: entrega el resultado al llamador.
  }

  function safePwmValue(value, fallback) {                                            // Funcion safePwmValue: protege el perfil PWM enviado al firmware.
    const parsed = Math.round(numberValue(value, fallback));                          // Constante parsed: constante usada en parsed.
    return clamp(parsed, 80, 600);                                                     // Retorno: entrega un tick PWM dentro de ventana segura.
  }

  function round(value, decimals = 1) {                                               // Funcion round: redondea valores numericos para salida y telemetria.
    const factor = 10 ** decimals;                                                    // Constante factor: constante usada en factor.
    return Math.round(value * factor) / factor;                                       // Retorno: entrega el resultado al llamador.
  }

  function formatDeg(value) {                                                         // Funcion formatDeg: formatea angulos en grados para la interfaz.
    // Retorno: entrega el resultado al llamador.
    return `${round(value, 1)} deg`;
  }

  function formatSpeed(value) {                                                       // Funcion formatSpeed: formatea velocidades angulares para lectura humana.
    // Retorno: entrega el resultado al llamador.
    return `${round(Math.abs(numberValue(value, 0)), 1)} deg/s`;
  }

  function modeLabel(mode) {                                                          // Funcion modeLabel: resuelve la etiqueta visible de un modo operativo.
    const key = String(mode || "").toLowerCase();                                     // Constante key: constante usada en key.
    if (MODE_LABELS[key]) return MODE_LABELS[key];                                    // Condicion: valida estado antes de continuar el flujo.
    return key ? key.charAt(0).toUpperCase() + key.slice(1) : "Manual";               // Retorno: entrega el resultado al llamador.
  }

  function armedLabel() {                                                             // Funcion armedLabel: resuelve estado visible de PWM de servos.
    return state.telemetry.armed ? "Armado" : "Libre";                                // Retorno: entrega el resultado al llamador.
  }

  function modeClass(mode) {                                                          // Funcion modeClass: resuelve la clase CSS asociada al modo operativo.
    const key = String(mode || "manual").toLowerCase();                               // Constante key: constante usada en key.
    // Retorno: entrega el resultado al llamador.
    return MODE_LABELS[key] ? `mode-${key}` : "mode-manual";
  }

  function markModeButtons(mode) {                                                    // Funcion markModeButtons: sincroniza el estado visual de botones de modo.
    const active = String(mode || "").toLowerCase();                                  // Constante active: constante usada en active.
    Object.entries(MODE_BUTTONS).forEach(([key, selectors]) => {                      // Llamada: ejecuta una accion del modulo actual.
      selectors.forEach((selector) => {                                               // Llamada: ejecuta una accion del modulo actual.
        const button = $(selector);                                                   // Referencia button: nodo o coleccion DOM usada por la UI.
        if (!button) return;                                                          // Condicion: valida estado antes de continuar el flujo.
        const isActive = key === active;                                              // Constante isActive: constante usada en is active.
        button.classList.toggle("mode-active", isActive);                             // Llamada: ejecuta una accion del modulo actual.
        button.setAttribute("aria-pressed", isActive ? "true" : "false");             // Llamada: ejecuta una accion del modulo actual.
      });
    });
  }

  function setDisplayedMode(mode) {                                                   // Funcion setDisplayedMode: actualiza el modo mostrado en cabecera y pie.
    const key = String(mode || "manual").toLowerCase();                               // Constante key: constante usada en key.
    state.telemetry.mode = MODE_LABELS[key] ? key : state.telemetry.mode || "manual"; // Asignacion: actualiza estado o salida calculada.
    const hudMode = $("#hud-mode");                                                   // Referencia hudMode: nodo o coleccion DOM usada por la UI.
    if (hudMode) hudMode.textContent = modeLabel(state.telemetry.mode);               // Condicion: valida estado antes de continuar el flujo.
    markModeButtons(state.telemetry.mode);                                            // Llamada: ejecuta una accion del modulo actual.
    updateFooterSummary();                                                            // Llamada: ejecuta una accion del modulo actual.
  }

  function requestMode(mode, label) {                                                 // Funcion requestMode: envia al controlador la solicitud de cambio de modo.
    setDisplayedMode(mode);                                                           // Llamada: ejecuta una accion del modulo actual.
    // Retorno: entrega el resultado al llamador.
    return sendCommand({ type: "cmd_mode", mode }, label || `Modo ${modeLabel(mode)}`);
  }

  function escapeHtml(value) {                                                        // Funcion escapeHtml: escapa texto antes de insertarlo como HTML.
    return String(value).replace(/[&<>"']/g, (char) => ({                             // Retorno: entrega el resultado al llamador.
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function setStatus(id, mode, value) {                                               // Funcion setStatus: actualiza una pastilla de estado de la UI.
    const node = $(id);                                                               // Referencia node: nodo o coleccion DOM usada por la UI.
    if (!node) return;                                                                // Condicion: valida estado antes de continuar el flujo.
    node.classList.remove("ok", "warn");                                              // Llamada: ejecuta una accion del modulo actual.
    if (mode) node.classList.add(mode);                                               // Condicion: valida estado antes de continuar el flujo.
    $("b", node).textContent = value;                                                 // Llamada: ejecuta una accion del modulo actual.
    updateFooterSummary();                                                            // Llamada: ejecuta una accion del modulo actual.
  }

  function log(message, type = "sys") {                                               // Funcion log: agrega una entrada al registro visible de eventos.
    const logNode = $("#event-log");                                                  // Referencia logNode: nodo o coleccion DOM usada por la UI.
    if (!logNode) return;                                                             // Condicion: valida estado antes de continuar el flujo.
    const time = new Date().toLocaleTimeString("es-MX", {                             // Constante time: constante usada en time.
      hour: "2-digit",                                                                // Campo hour: campo de datos para hour.
      minute: "2-digit",                                                              // Campo minute: campo de datos para minute.
      second: "2-digit"                                                               // Campo second: campo de datos para second.
    });
    const line = document.createElement("div");                                       // Referencia line: nodo o coleccion DOM usada por la UI.
    // Asignacion: actualiza estado o salida calculada.
    line.className = `log-line ${type}`;
    // Asignacion: actualiza estado o salida calculada.
    line.textContent = `[${time}] ${message}`;
    logNode.prepend(line);                                                            // Llamada: ejecuta una accion del modulo actual.
    while (logNode.children.length > 120) logNode.lastChild.remove();                 // Bucle: recorre datos o reintenta una operacion controlada.
  }

  function formatI2CAddress(value) {                                                  // Funcion formatI2CAddress: formatea i2 caddress.
    const numeric = Number(value);                                                    // Constante numeric: constante usada en numeric.
    if (!Number.isFinite(numeric)) return String(value || "");                        // Condicion: valida estado antes de continuar el flujo.
    // Retorno: entrega el resultado al llamador.
    return `0x${numeric.toString(16).toUpperCase().padStart(2, "0")}`;
  }

  function setI2CDiagnosticStatus(mode, text) {                                       // Funcion setI2CDiagnosticStatus: asigna i2 cdiagnostic status.
    const node = $("#i2c-diag-status");                                               // Referencia node: nodo o coleccion DOM usada por la UI.
    if (!node) return;                                                                // Condicion: valida estado antes de continuar el flujo.
    node.classList.remove("ok", "warn", "err");                                       // Llamada: ejecuta una accion del modulo actual.
    if (mode) node.classList.add(mode);                                               // Condicion: valida estado antes de continuar el flujo.
    node.textContent = text;                                                          // Asignacion: actualiza estado o salida calculada.
  }

  function appendI2CMonitorLine(message, type = "sys") {                              // Funcion appendI2CMonitorLine: encapsula la logica de lectura de sensores IMU/I2C.
    const node = $("#i2c-serial-monitor");                                            // Referencia node: nodo o coleccion DOM usada por la UI.
    if (!node) return;                                                                // Condicion: valida estado antes de continuar el flujo.
    const time = new Date().toLocaleTimeString("es-MX", {                             // Constante time: constante usada en time.
      hour: "2-digit",                                                                // Campo hour: campo de datos para hour.
      minute: "2-digit",                                                              // Campo minute: campo de datos para minute.
      second: "2-digit"                                                               // Campo second: campo de datos para second.
    });
    const prefix = type === "err" ? "!" : type === "ok" ? "+" : type === "warn" ? "*" : ">"; // Constante prefix: constante usada en prefix.
    // Constante lines: constante usada en lines.
    const lines = `${node.textContent || ""}\n[${time}] ${prefix} ${message}`.trim().split("\n");
    node.textContent = lines.slice(-80).join("\n");                                   // Asignacion: actualiza estado o salida calculada.
    node.scrollTop = node.scrollHeight;                                               // Asignacion: actualiza estado o salida calculada.
  }

  function appendSerialMonitorLine(message, type = "rx") {
    const node = $("#serial-monitor");
    if (!node) return;
    const text = String(message ?? "").replace(/\r/g, "").trimEnd();
    if (!text) return;
    const now = Date.now();
    const isRepeat = text === lastSerialMonitorText &&
      type === lastSerialMonitorType &&
      now - lastSerialMonitorAt < SERIAL_MONITOR_DUPLICATE_MS;
    if (isRepeat && serialMonitorLines.length) {
      serialMonitorRepeatCount += 1;
      lastSerialMonitorAt = now;
      if (now - lastSerialMonitorRepeatRenderAt < 250) return;
      lastSerialMonitorRepeatRenderAt = now;
      const previous = serialMonitorLines[serialMonitorLines.length - 1] || "";
      serialMonitorLines[serialMonitorLines.length - 1] = `${previous.replace(/ \(x\d+\)$/, "")} (x${serialMonitorRepeatCount})`;
      node.textContent = serialMonitorLines.join("\n");
      node.scrollTop = node.scrollHeight;
      return;
    }
    const time = new Date().toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
    const prefix = type === "err" ? "!" : type === "tx" ? "<" : type === "ok" ? "+" : ">";
    lastSerialMonitorText = text;
    lastSerialMonitorType = type;
    lastSerialMonitorAt = now;
    lastSerialMonitorRepeatRenderAt = now;
    serialMonitorRepeatCount = 1;
    serialMonitorLines.push(`[${time}] ${prefix} ${text}`);
    if (serialMonitorLines.length > 120) serialMonitorLines.splice(0, serialMonitorLines.length - 120);
    node.textContent = serialMonitorLines.join("\n");
    node.scrollTop = node.scrollHeight;
  }

  function clearSerialMonitor() {
    const node = $("#serial-monitor");
    serialMonitorLines.length = 0;
    lastSerialMonitorText = "";
    lastSerialMonitorType = "";
    serialMonitorRepeatCount = 0;
    if (node) node.textContent = "";
  }

  function isSerialSensorsLine(line) {
    const text = String(line || "").trimStart();
    return text.startsWith('{"type":"sensors"') || text.startsWith('{"servos":');
  }

  function looksLikeSerialJsonFragment(line) {
    const text = String(line || "").trim();
    if (!text) return false;
    if (/^[}\]",]/.test(text)) return true;
    if (/^[A-Za-z0-9_]+":/.test(text)) return true;
    return text.includes('":') && /[{},]/.test(text);
  }

  function resetSerialJsonAssembly() {
    serialJsonAssembly = "";
    serialJsonAssemblyAt = 0;
  }

  function assembleSerialEventLine(line) {
    const text = String(line ?? "").trim();
    if (!text) return "";
    const now = Date.now();

    if (serialJsonAssembly) {
      serialJsonAssembly += text;
      if (serialJsonAssembly.length > 24000 || now - serialJsonAssemblyAt > 1200) {
        resetSerialJsonAssembly();
        return looksLikeSerialJsonFragment(text) ? "" : text;
      }
      try {
        JSON.parse(serialJsonAssembly);
        const out = serialJsonAssembly;
        resetSerialJsonAssembly();
        return out;
      } catch {
        return "";
      }
    }

    if (text.startsWith("{") || text.startsWith("[")) {
      try {
        JSON.parse(text);
        return text;
      } catch {
        serialJsonAssembly = text;
        serialJsonAssemblyAt = now;
        return "";
      }
    }

    return looksLikeSerialJsonFragment(text) ? "" : text;
  }

  function summarizeSerialSensorsLine(line) {
    try {
      const packet = JSON.parse(line);
      const servos = Array.isArray(packet.servos) ? packet.servos : [];
      const moving = servos.filter((servo) => servo?.moving).length;
      const preview = servos.slice(0, 6).map((servo) => {
        const id = Number(servo?.id ?? 0);
        const sensor = Number(servo?.sensor ?? 0);
        const target = Number(servo?.target ?? 0);
        return `s${id}:${sensor.toFixed(1)}>${target.toFixed(1)}`;
      }).join(" ");
      return `sensores ${packet.mode || ""} mov=${moving} ${preview}`.trim();
    } catch {
      return "sensores: paquete recibido";
    }
  }

  function flushPendingSerialTelemetry() {
    serialTelemetryTimer = null;
    if (!pendingSerialTelemetryLine) return;
    const line = pendingSerialTelemetryLine;
    pendingSerialTelemetryLine = "";
    lastSerialTelemetryUiMs = Date.now();
    handleMessage(line, "serial");
  }

  function queueSerialTelemetryLine(line) {
    const now = Date.now();
    pendingSerialTelemetryLine = String(line || "");
    if (now - lastSerialTelemetryUiMs >= SERIAL_TELEMETRY_UI_MS) {
      flushPendingSerialTelemetry();
      return;
    }
    if (!serialTelemetryTimer) {
      serialTelemetryTimer = setTimeout(
        flushPendingSerialTelemetry,
        Math.max(16, SERIAL_TELEMETRY_UI_MS - (now - lastSerialTelemetryUiMs))
      );
    }
  }

  function handleSerialEventLine(line) {
    const text = assembleSerialEventLine(line);
    if (!text) return;
    if (isSerialSensorsLine(text)) {
      const now = Date.now();
      if (now - lastSerialMonitorSensorMs >= SERIAL_MONITOR_SENSOR_MS) {
        lastSerialMonitorSensorMs = now;
        appendSerialMonitorLine(summarizeSerialSensorsLine(text), "rx");
      }
      queueSerialTelemetryLine(text);
      return;
    }
    appendSerialMonitorLine(text, "rx");
    handleMessage(text, "serial");
  }

  function i2cRowMode(channel) {                                                      // Funcion i2cRowMode: encapsula la logica de lectura de sensores IMU/I2C.
    const status = String(channel?.status || "");                                     // Constante status: constante usada en status.
    if (status === "ok") return "ok";                                                 // Condicion: valida estado antes de continuar el flujo.
    if (status === "addr_mismatch" || status === "extra") return "warn";              // Condicion: valida estado antes de continuar el flujo.
    if (status === "missing" || status === "select_fail") return "err";               // Condicion: valida estado antes de continuar el flujo.
    return "";                                                                        // Retorno: entrega el resultado al llamador.
  }

  function i2cRowText(channel) {                                                      // Funcion i2cRowText: encapsula la logica de lectura de sensores IMU/I2C.
    if (!channel) return "Sin datos";                                                 // Condicion: valida estado antes de continuar el flujo.
    const status = String(channel.status || "");                                      // Constante status: constante usada en status.
    // Condicion: valida estado antes de continuar el flujo.
    if (status === "ok") return `OK en ${formatI2CAddress(channel.mpuAddr || channel.expectedAddr || 0x68)}`;
    // Condicion: valida estado antes de continuar el flujo.
    if (status === "addr_mismatch") return `AD0 alto: aparece ${formatI2CAddress(channel.altAddr || 0x69)}`;
    if (status === "missing") return "Sin MPU";                                       // Condicion: valida estado antes de continuar el flujo.
    if (status === "select_fail") return "No selecciona canal";                       // Condicion: valida estado antes de continuar el flujo.
    if (status === "extra") return "Dispositivo extra";                               // Condicion: valida estado antes de continuar el flujo.
    return status === "unused" ? "Libre" : "Sin datos";                               // Retorno: entrega el resultado al llamador.
  }

  function renderI2CChannels(channels = []) {                                         // Funcion renderI2CChannels: renderiza i2 cchannels.
    const list = $("#i2c-channel-list");                                              // Referencia list: nodo o coleccion DOM usada por la UI.
    if (!list) return;                                                                // Condicion: valida estado antes de continuar el flujo.
    // Render only the channels the firmware marks as `used` (i.e. wired to an
    // MPU via IMU_TCA_CHANNEL). Falls back to channels 0..3 if the firmware
    // hasn't sent the `used` flag yet (older builds).
    const usedChannels = channels.filter((item) => item && item.used);                // Constante usedChannels: constante usada en used channels.
    const list2render = usedChannels.length                                           // Constante list2render: constante usada en interfaz tecnica.
      ? usedChannels.slice().sort((a, b) => {
          const ai = a.imuIdx ?? Number(a.ch);                                        // Constante ai: constante usada en ai.
          const bi = b.imuIdx ?? Number(b.ch);                                        // Constante bi: constante usada en bi.
          return ai - bi;                                                             // Retorno: entrega el resultado al llamador.
        })
      : (() => {
          const byChannel = new Map(channels.map((item) => [Number(item.ch), item])); // Mapa byChannel: objeto de configuracion para by channel.
          const out = [];                                                             // Arreglo out: arreglo de datos para out.
          for (let ch = 0; ch < 4; ch++) out.push(byChannel.get(ch) || { ch });       // Bucle: recorre datos o reintenta una operacion controlada.
          return out;                                                                 // Retorno: entrega el resultado al llamador.
        })();
    const rows = list2render.map((channel) => {                                       // Constante rows: constante usada en comunicaciones y puertos.
      const mode = i2cRowMode(channel);                                               // Constante mode: constante usada en mode.
      const ch = Number(channel.ch);                                                  // Constante ch: constante usada en ch.
      const imuIdx = channel.imuIdx;                                                  // Constante imuIdx: constante usada en lectura de sensores IMU/I2C.
      // Constante label: constante usada en label.
      const label = imuIdx != null ? `IMU ${imuIdx} → TCA ch ${ch}` : `TCA ch ${ch}`;
      // Retorno: entrega el resultado al llamador.
      return `
        <div class="i2c-channel-row ${mode}">
          <span>${label}</span>
          <b>${escapeHtml(i2cRowText(channel))}</b>
        </div>
      `;
    });
    list.innerHTML = rows.join("");                                                   // Asignacion: actualiza estado o salida calculada.
  }

  function resetI2CDiagnosticUi() {                                                   // Funcion resetI2CDiagnosticUi: reinicia i2 cdiagnostic ui.
    setI2CDiagnosticStatus("", "Sin datos");                                          // Llamada: ejecuta una accion del modulo actual.
    const root = $("#i2c-root-devices");                                              // Referencia root: nodo o coleccion DOM usada por la UI.
    if (root) root.textContent = "Pendiente";                                         // Condicion: valida estado antes de continuar el flujo.
    renderI2CChannels();                                                              // Llamada: ejecuta una accion del modulo actual.
    const monitor = $("#i2c-serial-monitor");                                         // Referencia monitor: nodo o coleccion DOM usada por la UI.
    if (monitor) monitor.textContent = "";                                            // Condicion: valida estado antes de continuar el flujo.
  }

  function updateI2CDiagnostic(packet) {                                              // Funcion updateI2CDiagnostic: actualiza i2 cdiagnostic.
    const root = $("#i2c-root-devices");                                              // Referencia root: nodo o coleccion DOM usada por la UI.
    const rootDevices = Array.isArray(packet.root) ? packet.root.map(formatI2CAddress) : []; // Constante rootDevices: constante usada en root devices.
    if (root) root.textContent = rootDevices.length ? rootDevices.join(", ") : "Ninguno"; // Condicion: valida estado antes de continuar el flujo.

    const channels = Array.isArray(packet.channels) ? packet.channels : [];           // Constante channels: constante usada en channels.
    renderI2CChannels(channels);                                                      // Llamada: ejecuta una accion del modulo actual.

    const okCount = Number(packet.okCount || 0);                                      // Constante okCount: constante usada en ok count.
    const mismatchCount = Number(packet.mismatchCount || 0);                          // Constante mismatchCount: constante usada en mismatch count.
    const missingCount = Number(packet.missingCount || 0);                            // Constante missingCount: constante usada en missing count.
    if (!packet.tcaPresent) {                                                         // Condicion: valida estado antes de continuar el flujo.
      setI2CDiagnosticStatus("err", "TCA no detectado");                              // Llamada: ejecuta una accion del modulo actual.
    } else if (okCount >= 4) {
      setI2CDiagnosticStatus("ok", "4 MPU OK");                                       // Llamada: ejecuta una accion del modulo actual.
    } else if (mismatchCount > 0) {
      // Llamada: ejecuta una accion del modulo actual.
      setI2CDiagnosticStatus("warn", `${okCount}/4 OK, AD0 alto`);
    } else if (missingCount > 0) {
      // Llamada: ejecuta una accion del modulo actual.
      setI2CDiagnosticStatus("err", `${okCount}/4 MPU`);
    } else {
      setI2CDiagnosticStatus("warn", packet.summary || "Revisar I2C");                // Llamada: ejecuta una accion del modulo actual.
    }

    appendI2CMonitorLine(packet.summary || "Diagnostico I2C recibido", okCount >= 4 ? "ok" : "warn"); // Llamada: ejecuta una accion del modulo actual.
  }

  function handleI2CSerialLine(raw) {                                                 // Funcion handleI2CSerialLine: atiende i2 cserial line.
    const text = String(raw || "").trim();                                            // Constante text: constante usada en text.
    if (!/^\[(I2C|IMU|CAL)\]/.test(text)) return false;                               // Condicion: valida estado antes de continuar el flujo.
    const kind = /(FAIL|missing|lost|Warning|skipped|no detectado)/i.test(text)       // Constante kind: constante usada en kind.
      ? "err"
      : /(OK|recovered|done|detectados)/i.test(text)
        ? "ok"
        : "i2c";
    appendI2CMonitorLine(text, kind === "i2c" ? "sys" : kind);                        // Llamada: ejecuta una accion del modulo actual.
    log(text, kind === "i2c" ? "i2c" : kind);                                         // Llamada: ejecuta una accion del modulo actual.
    return true;                                                                      // Retorno: entrega el resultado al llamador.
  }

  function handleEspBootSerialLine(raw) {                                             // Funcion handleEspBootSerialLine: atiende esp boot serial line.
    const text = String(raw || "").trim();                                            // Constante text: constante usada en text.
    // Condicion: valida estado antes de continuar el flujo.
    if (!/(ESP-ROM|rst:|boot:|waiting for download|load:|entry 0x|Saved PC|Backtrace:|assert failed|Rebooting|ELF file SHA256|mode:DIO|SPIWP:|Build:)/i.test(text)) {
      return false;                                                                   // Retorno: entrega el resultado al llamador.
    }
    const crashed = /(assert failed|Backtrace:|Rebooting)/i.test(text);               // Constante crashed: constante usada en crashed.
    const downloadMode = /(DOWNLOAD\(USB\/UART0\)|waiting for download)/i.test(text); // Constante downloadMode: detecta arranque en modo carga.
    const label = downloadMode ? "Modo descarga ESP32" : crashed ? "Crash ESP32" : "Boot ESP32"; // Constante label: constante usada en label.
    if (downloadMode) {                                                               // Condicion: valida estado antes de continuar el flujo.
      setStatus("#s3-status", "err", "BOOT/IO0");                                     // Llamada: muestra causa probable de S3 sin firmware activo.
    }
    // Llamada: ejecuta una accion del modulo actual.
    appendI2CMonitorLine(`${label}: ${text}`, crashed || downloadMode ? "err" : "sys");
    // Llamada: ejecuta una accion del modulo actual.
    log(`${label}: ${text}`, crashed || downloadMode ? "err" : "sys");
    if (downloadMode) {                                                               // Condicion: valida estado antes de continuar el flujo.
      log("El ESP32-S3 esta en bootloader: suelta BOOT/IO0, revisa que GPIO0 no este a GND y reinicia.", "err"); // Llamada: entrega guia accionable.
    }
    return true;                                                                      // Retorno: entrega el resultado al llamador.
  }

  function serializeForStorage() {                                                    // Funcion serializeForStorage: encapsula la logica de comunicaciones y puertos.
    return {                                                                          // Retorno: entrega el resultado al llamador.
      schema: state.schema,                                                           // Campo schema: campo de datos para schema.
      connection: state.connection,                                                   // Campo connection: campo de datos para connection.
      metadata: state.metadata,                                                       // Campo metadata: campo de datos para metadata.
      hardwareChecks: state.hardwareChecks,                                           // Campo hardwareChecks: campo de datos para diagnostico y pruebas.
      build: state.build,                                                             // Campo build: campo de datos para interfaz tecnica.
      tests: state.tests,                                                             // Campo tests: campo de datos para diagnostico y pruebas.
      testRuns: state.testRuns,                                                       // Campo testRuns: campo de datos para diagnostico y pruebas.
      lastTestRunAt: state.lastTestRunAt,                                             // Campo lastTestRunAt: campo de datos para diagnostico y pruebas.
      servos: state.servos.map(({                                                     // Campo servos: campo de datos para control angular de servos.
        liveAngle,
        liveSensor,
        liveSensorSpeed,
        liveTarget,
        livePwm,
        lastSensorDeg,
        lastSensorAt,
        moving,
        ...servo
      }) => servo),
      imus: state.imus.map(({ liveDeg, liveSpeed, ...imu }) => imu),                  // Campo imus: campo de datos para lectura de sensores IMU/I2C.
      as5600: state.as5600.map(({ liveRaw, liveDeg, liveSpeed, ...sensor }) => sensor), // Campo as5600: sensores magneticos de codo.
      tuning: state.tuning,                                                           // Campo tuning: campo de datos para tuning.
      firmware: Object.fromEntries(Object.entries(state.firmware).map(([key, value]) => [
        key,
        { ...value, code: "" }
      ])),                                                                             // Campo firmware: guarda metadatos, no codigo completo.
      savedAt: state.savedAt                                                          // Campo savedAt: campo de datos para saved at.
    };
  }

  function saveLocal({ quiet = false } = {}) {                                        // Funcion saveLocal: encapsula la logica de save local.
    state.savedAt = new Date().toISOString();                                         // Asignacion: actualiza estado o salida calculada.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeForStorage()));         // Llamada: ejecuta una accion del modulo actual.
    setStatus("#profile-status", "ok", "Guardado");                                   // Llamada: ejecuta una accion del modulo actual.
    updateProfilePreview();                                                           // Llamada: ejecuta una accion del modulo actual.
    if (!quiet) log("Calibracion guardada en este navegador", "ok");                  // Condicion: valida estado antes de continuar el flujo.
  }

  function markDirty() {                                                              // Funcion markDirty: encapsula la logica de mark dirty.
    setStatus("#profile-status", "warn", "Cambios");                                  // Llamada: ejecuta una accion del modulo actual.
    updateProfilePreview();                                                           // Llamada: ejecuta una accion del modulo actual.
  }

  function init() {                                                                   // Funcion init: encapsula la logica de init.
    bindNavigation();                                                                 // Llamada: ejecuta una accion del modulo actual.
    bindConnection();                                                                 // Llamada: ejecuta una accion del modulo actual.
    bindGlobalButtons();                                                              // Llamada: ejecuta una accion del modulo actual.
    bindForms();                                                                      // Llamada: ejecuta una accion del modulo actual.
    renderHardwareChecks();                                                           // Llamada: ejecuta una accion del modulo actual.
    renderBuild();                                                                    // Llamada: ejecuta una accion del modulo actual.
    renderTests();                                                                    // Llamada: ejecuta una accion del modulo actual.
    renderReadiness();                                                                // Llamada: ejecuta una accion del modulo actual.
    renderServoTable();                                                               // Llamada: ejecuta una accion del modulo actual.
    renderManualPanel();                                                              // Llamada: ejecuta una accion del modulo actual.
    bindManualPanel();                                                                // Llamada: ejecuta una accion del modulo actual.
    renderSensorCards();                                                              // Llamada: ejecuta una accion del modulo actual.
    renderMapping();                                                                  // Llamada: ejecuta una accion del modulo actual.
    hydrateInputs();                                                                  // Llamada: ejecuta una accion del modulo actual.
    bindFirmware();                                                                   // Llamada: ejecuta una accion del modulo actual.
    loadBundledFirmware({ force: true });                                             // Llamada: muestra siempre el codigo actual del proyecto.
    updateTuningLabels();                                                             // Llamada: ejecuta una accion del modulo actual.
    updateProfilePreview();                                                           // Llamada: ejecuta una accion del modulo actual.
    updateLive();                                                                     // Llamada: ejecuta una accion del modulo actual.
    updateFooterPanel($(".rail-btn.active"));                                         // Llamada: ejecuta una accion del modulo actual.
    updateFooterSummary();                                                            // Llamada: ejecuta una accion del modulo actual.
    resetI2CDiagnosticUi();                                                           // Llamada: ejecuta una accion del modulo actual.
    const localPort = $("#footer-local-port");                                        // Referencia localPort: nodo o coleccion DOM usada por la UI.
    if (localPort) localPort.textContent = window.location.port || "5177";            // Condicion: valida estado antes de continuar el flujo.
    refreshPorts({ force: true, silent: true });                                      // Llamada: ejecuta una accion del modulo actual.
    startPortsAutoRefresh();                                                          // Llamada: ejecuta una accion del modulo actual.
    bindEspAlert();                                                                   // Llamada: ejecuta una accion del modulo actual.
    ensureSerialEventsOpen();                                                         // Llamada: ejecuta una accion del modulo actual.
    tickClock();                                                                      // Llamada: ejecuta una accion del modulo actual.
    setInterval(tickClock, 1000);                                                     // Llamada: ejecuta una accion del modulo actual.
    log("Herramienta de tecnico lista", "ok");                                        // Llamada: ejecuta una accion del modulo actual.
  }

  function hydrateInputs() {                                                          // Funcion hydrateInputs: encapsula la logica de hydrate inputs.
    $("#s3-url").value = state.connection.s3Url;                                      // Llamada: ejecuta una accion del modulo actual.
    $("#s3-port").value = state.connection.s3Port || "";                              // Llamada: ejecuta una accion del modulo actual.
    $("#cam-url").value = state.connection.camUrl;                                    // Llamada: ejecuta una accion del modulo actual.
    $("#cam-port").value = state.connection.camPort || "";                            // Llamada: ejecuta una accion del modulo actual.
    $("#exo-serial").value = state.metadata.serial;                                   // Llamada: ejecuta una accion del modulo actual.
    $("#tech-name").value = state.metadata.technician;                                // Llamada: ejecuta una accion del modulo actual.
    $("#client-name").value = state.metadata.client;                                  // Llamada: ejecuta una accion del modulo actual.
    $("#firmware-version").value = state.metadata.firmware;                           // Llamada: ejecuta una accion del modulo actual.
    $("#handoff-notes").value = state.metadata.notes;                                 // Llamada: ejecuta una accion del modulo actual.
    $("#assist-level").value = String(state.tuning.assistLevel);                      // Llamada: ejecuta una accion del modulo actual.
    $("#deadband").value = String(state.tuning.deadbandDeg);                          // Llamada: ejecuta una accion del modulo actual.
    $("#smoothing").value = String(state.tuning.smoothing);                           // Llamada: ejecuta una accion del modulo actual.
    $("#max-speed").value = String(state.tuning.maxSpeedDegSec);                      // Llamada: ejecuta una accion del modulo actual.
    ["s3", "cam"].forEach((device) => {
      ensureBundledFirmwareVisible(device);
      // Llamada: ejecuta una accion del modulo actual.
      $(`#fw-fqbn-${device}`).value = state.firmware[device].fqbn;
      // Llamada: ejecuta una accion del modulo actual.
      $(`#fw-code-${device}`).value = state.firmware[device].code;
      setFirmwareCodeName(device);                                                    // Llamada: actualiza el nombre visible del codigo.
      const firmwareLoaded = Boolean(state.firmware[device].code.trim());
      const bundledLoaded = firmwareLoaded && state.firmware[device].source === "bundled";
      setFirmwareBadge(                                                               // Llamada: ejecuta una accion del modulo actual.
        device,
        bundledLoaded ? "ok" : firmwareLoaded ? "warn" : "",
        bundledLoaded ? "Predeterminado" : firmwareLoaded ? "Listo" : "Pendiente"
      );
    });
    if (state.savedAt) setStatus("#profile-status", "ok", "Guardado");                // Condicion: valida estado antes de continuar el flujo.
  }

  function bindNavigation() {                                                         // Funcion bindNavigation: conecta eventos de navigation.
    $$(".rail-btn").forEach((button) => {                                             // Llamada: ejecuta una accion del modulo actual.
      button.addEventListener("click", () => {                                        // Llamada: ejecuta una accion del modulo actual.
        $$(".rail-btn").forEach((node) => node.classList.remove("active"));           // Llamada: ejecuta una accion del modulo actual.
        $$(".work-panel").forEach((node) => node.classList.remove("active"));         // Llamada: ejecuta una accion del modulo actual.
        button.classList.add("active");                                               // Llamada: ejecuta una accion del modulo actual.
        // Llamada: ejecuta una accion del modulo actual.
        $(`#panel-${button.dataset.panel}`).classList.add("active");
        if (button.dataset.panel === "firmware") loadBundledFirmware();              // Condicion: asegura codigo visible al abrir Firmware.
        updateFooterPanel(button);                                                    // Llamada: ejecuta una accion del modulo actual.
        queueDraw();                                                                  // Llamada: ejecuta una accion del modulo actual.
      });
    });
  }

  function updateFooterPanel(button) {                                                // Funcion updateFooterPanel: actualiza footer panel.
    const footerPanel = $("#footer-panel");                                           // Referencia footerPanel: nodo o coleccion DOM usada por la UI.
    if (!footerPanel || !button) return;                                              // Condicion: valida estado antes de continuar el flujo.
    const label = $("b", button)?.textContent || button.dataset.panel || "";          // Referencia label: nodo o coleccion DOM usada por la UI.
    footerPanel.textContent = label;                                                  // Asignacion: actualiza estado o salida calculada.
  }

  function bindConnection() {                                                         // Funcion bindConnection: conecta eventos de connection.
    $("#btn-connect-s3").addEventListener("click", connectS3Auto);                    // Llamada: ejecuta una accion del modulo actual.
    const batteryS3Btn = $("#btn-connect-s3-battery");                                // Referencia batteryS3Btn: nodo o coleccion DOM usada por la UI.
    if (batteryS3Btn) batteryS3Btn.addEventListener("click", connectS3BatteryAp);     // Condicion: valida estado antes de continuar el flujo.
    $("#btn-connect-s3-serial").addEventListener("click", connectS3Serial);           // Llamada: ejecuta una accion del modulo actual.
    $("#btn-disconnect-s3").addEventListener("click", disconnectS3);                  // Llamada: ejecuta una accion del modulo actual.
    $("#btn-refresh-connection-ports").addEventListener("click", () => refreshPorts({ force: true })); // Llamada: ejecuta una accion del modulo actual.
    const clearSerialMonitorBtn = $("#btn-clear-serial-monitor");
    if (clearSerialMonitorBtn) clearSerialMonitorBtn.addEventListener("click", clearSerialMonitor);
    $("#btn-refresh-cam-ports").addEventListener("click", () => {                     // Llamada: ejecuta una accion del modulo actual.
      detectCamSerial({ autoStart: true, useSelected: false }).catch(() => {});       // Llamada: ejecuta una accion del modulo actual.
    });
    $("#btn-connect-cam-serial").addEventListener("click", connectCamSerial);         // Llamada: ejecuta una accion del modulo actual.
    $("#btn-cam-record")?.addEventListener("click", toggleCameraRecording);
    $("#btn-cam-mode-fast")?.addEventListener("click", () => sendCamControl("/mode/fast", "CAM modo rapido"));
    $("#btn-cam-mode-balanced")?.addEventListener("click", () => sendCamControl("/mode/balanced", "CAM modo equilibrado"));
    $("#btn-cam-mode-quality")?.addEventListener("click", () => sendCamControl("/mode/quality", "CAM modo calidad"));
    $("#btn-cam-flash-off")?.addEventListener("click", () => sendCamControl("/flash/off", "CAM flash off"));
    $("#btn-cam-flash-on")?.addEventListener("click", () => sendCamControl("/flash/on", "CAM flash on"));
    const manualCamButton = $("#btn-cam-manual-com");                                 // Referencia manualCamButton: nodo o coleccion DOM usada por la UI.
    if (manualCamButton) manualCamButton.addEventListener("click", connectCamManualCom); // Condicion: valida estado antes de continuar el flujo.
    const manualCamPortList = $("#cam-manual-port-list");                             // Referencia manualCamPortList: nodo o coleccion DOM usada por la UI.
    if (manualCamPortList) {                                                          // Condicion: valida estado antes de continuar el flujo.
      manualCamPortList.addEventListener("click", selectCamManualPortFromList);       // Llamada: ejecuta una accion del modulo actual.
      manualCamPortList.addEventListener("keydown", handleCamManualPortKeydown);      // Llamada: ejecuta una accion del modulo actual.
    }
    const manualCamForm = $("#cam-manual-form");                                      // Referencia manualCamForm: nodo o coleccion DOM usada por la UI.
    if (manualCamForm) manualCamForm.addEventListener("submit", submitManualCamPort); // Condicion: valida estado antes de continuar el flujo.
    document.addEventListener("click", (event) => {                                   // Llamada: ejecuta una accion del modulo actual.
      const menu = $("#cam-manual-menu");                                             // Referencia menu: nodo o coleccion DOM usada por la UI.
      if (!menu || menu.hidden) return;                                               // Condicion: valida estado antes de continuar el flujo.
      if (event.target.closest("#cam-manual-menu") || event.target.closest("#btn-cam-manual-com")) return; // Condicion: valida estado antes de continuar el flujo.
      hideCamManualComMenu();                                                         // Llamada: ejecuta una accion del modulo actual.
    });
    $("#btn-start-cam").addEventListener("click", startCamera);                       // Llamada: ejecuta una accion del modulo actual.
    $("#btn-stop-cam").addEventListener("click", stopCamera);                         // Llamada: ejecuta una accion del modulo actual.
    $("#s3-url").addEventListener("change", (event) => {                              // Llamada: ejecuta una accion del modulo actual.
      state.connection.s3Url = event.target.value.trim();                             // Asignacion: actualiza estado o salida calculada.
      markDirty();                                                                    // Llamada: ejecuta una accion del modulo actual.
    });
    $("#s3-port").addEventListener("change", (event) => {                             // Llamada: ejecuta una accion del modulo actual.
      state.connection.s3Port = event.target.value;                                   // Asignacion: actualiza estado o salida calculada.
      state.firmware.s3.port = event.target.value;                                    // Asignacion: actualiza estado o salida calculada.
      const firmwarePort = $("#fw-port-s3");                                          // Referencia firmwarePort: nodo o coleccion DOM usada por la UI.
      if (firmwarePort) firmwarePort.value = event.target.value;                      // Condicion: valida estado antes de continuar el flujo.
      markDirty();                                                                    // Llamada: ejecuta una accion del modulo actual.
    });
    $("#cam-url").addEventListener("change", (event) => {                             // Llamada: ejecuta una accion del modulo actual.
      state.connection.camUrl = event.target.value.trim();                            // Asignacion: actualiza estado o salida calculada.
      markDirty();                                                                    // Llamada: ejecuta una accion del modulo actual.
    });
    $("#cam-port").addEventListener("change", (event) => {                            // Llamada: ejecuta una accion del modulo actual.
      state.connection.camPort = event.target.value;                                  // Asignacion: actualiza estado o salida calculada.
      state.firmware.cam.port = event.target.value;                                   // Asignacion: actualiza estado o salida calculada.
      const firmwarePort = $("#fw-port-cam");                                         // Referencia firmwarePort: nodo o coleccion DOM usada por la UI.
      if (firmwarePort) firmwarePort.value = event.target.value;                      // Condicion: valida estado antes de continuar el flujo.
      markDirty();                                                                    // Llamada: ejecuta una accion del modulo actual.
    });
  }

  function bindGlobalButtons() {                                                      // Funcion bindGlobalButtons: conecta eventos de global buttons.
    $("#btn-stop").addEventListener("click", () => sendCommand({ type: "cmd_stop" }, "STOP")); // Llamada: ejecuta una accion del modulo actual.
    $("#btn-reset").addEventListener("click", () => sendCommand({ type: "cmd_reset" }, "Reset")); // Llamada: ejecuta una accion del modulo actual.
    $("#btn-status").addEventListener("click", () => sendCommand({ type: "cmd_status" }, "Estado")); // Llamada: ejecuta una accion del modulo actual.
    const armServosBtn = $("#btn-arm-servos");                                        // Referencia armServosBtn: boton de armado seguro de servos.
    if (armServosBtn) armServosBtn.addEventListener("click", () => sendCommand({ type: "cmd_arm" }, "Armar servos")); // Condicion: valida estado antes de continuar el flujo.
    const disarmServosBtn = $("#btn-disarm-servos");                                  // Referencia disarmServosBtn: boton para liberar PWM de servos.
    if (disarmServosBtn) disarmServosBtn.addEventListener("click", () => sendCommand({ type: "cmd_disarm" }, "Desarmar servos")); // Condicion: valida estado antes de continuar el flujo.
    $("#btn-manual-mode").addEventListener("click", () => requestMode("manual", "Modo manual")); // Llamada: ejecuta una accion del modulo actual.
    const modeAssistedBtn = $("#btn-mode-assisted");                                  // Referencia modeAssistedBtn: nodo o coleccion DOM usada por la UI.
    if (modeAssistedBtn) modeAssistedBtn.addEventListener("click", () => requestMode("assisted", "Modo asistido")); // Condicion: valida estado antes de continuar el flujo.
    const modeAutomaticBtn = $("#btn-mode-automatic");                                // Referencia modeAutomaticBtn: nodo o coleccion DOM usada por la UI.
    if (modeAutomaticBtn) modeAutomaticBtn.addEventListener("click", () => requestMode("automatic", "Modo automatico")); // Condicion: valida estado antes de continuar el flujo.
    const modeManualDiagBtn = $("#btn-mode-manual-diag");                             // Referencia modeManualDiagBtn: nodo o coleccion DOM usada por la UI.
    if (modeManualDiagBtn) modeManualDiagBtn.addEventListener("click", () => requestMode("manual", "Modo manual")); // Condicion: valida estado antes de continuar el flujo.
    $("#btn-home-all").addEventListener("click", sendHomes);                          // Llamada: ejecuta una accion del modulo actual.
    $("#btn-calibrate-imu").addEventListener("click", () => sendCommand({ type: "cmd_calibrate" }, "Calibrar IMU")); // Llamada: ejecuta una accion del modulo actual.
    $("#btn-i2c-diag").addEventListener("click", () => {                              // Llamada: ejecuta una accion del modulo actual.
      appendI2CMonitorLine("Solicitando diagnostico I2C...", "sys");                  // Llamada: ejecuta una accion del modulo actual.
      sendCommand({ type: "cmd_i2c_diag" }, "Diagnostico I2C");                       // Llamada: ejecuta una accion del modulo actual.
    });
    $("#btn-capture-neutral").addEventListener("click", captureAllNeutral);           // Llamada: ejecuta una accion del modulo actual.
    $("#btn-test-map").addEventListener("click", sendMappedTargets);                  // Llamada: ejecuta una accion del modulo actual.
    $("#btn-demo").addEventListener("click", toggleDemo);                             // Llamada: ejecuta una accion del modulo actual.
    $("#btn-save-local").addEventListener("click", () => saveLocal());                // Llamada: ejecuta una accion del modulo actual.
    $("#btn-copy-profile").addEventListener("click", copyProfile);                    // Llamada: ejecuta una accion del modulo actual.
    $("#btn-download-profile").addEventListener("click", downloadProfile);            // Llamada: ejecuta una accion del modulo actual.
    $("#btn-send-profile").addEventListener("click", sendFullProfile);                // Llamada: ejecuta una accion del modulo actual.
    $("#btn-send-servo-profile").addEventListener("click", sendServoProfile);         // Llamada: ejecuta una accion del modulo actual.
    $("#btn-send-sensor-profile").addEventListener("click", sendSensorProfile);       // Llamada: ejecuta una accion del modulo actual.
    $("#btn-send-map-profile").addEventListener("click", sendMapProfile);             // Llamada: ejecuta una accion del modulo actual.
    $("#btn-refresh-ports").addEventListener("click", () => refreshPorts({ force: true })); // Llamada: ejecuta una accion del modulo actual.
    $("#btn-arduino-status").addEventListener("click", refreshArduinoStatus);         // Llamada: ejecuta una accion del modulo actual.

    $("#btn-build-reset").addEventListener("click", resetBuild);                      // Llamada: ejecuta una accion del modulo actual.
    $("#btn-build-complete").addEventListener("click", markAllBuild);                 // Llamada: ejecuta una accion del modulo actual.
    $("#btn-tests-reset").addEventListener("click", resetTests);                      // Llamada: ejecuta una accion del modulo actual.
    $("#btn-tests-run-all").addEventListener("click", runAllTests);                   // Llamada: ejecuta una accion del modulo actual.

    ["assist-level", "deadband", "smoothing", "max-speed"].forEach((id) => {
      // Llamada: ejecuta una accion del modulo actual.
      $(`#${id}`).addEventListener("input", updateTuningFromControls);
    });
  }

  function bindFirmware() {                                                           // Funcion bindFirmware: conecta eventos de firmware.
    ["s3", "cam"].forEach((device) => {
      // Llamada: ejecuta una accion del modulo actual.
      $(`#fw-file-${device}`).addEventListener("change", (event) => readFirmwareFile(device, event));
      // Llamada: ejecuta una accion del modulo actual.
      $(`#fw-fqbn-${device}`).addEventListener("input", (event) => {
        state.firmware[device].fqbn = event.target.value.trim();
        markDirty();                                                                  // Llamada: ejecuta una accion del modulo actual.
      });
      // Llamada: ejecuta una accion del modulo actual.
      $(`#fw-port-${device}`).addEventListener("change", (event) => {
        syncFirmwareUploadPort(device, event.target.value);
        markDirty();                                                                  // Llamada: ejecuta una accion del modulo actual.
      });
      // Llamada: ejecuta una accion del modulo actual.
      $(`#fw-code-${device}`).addEventListener("input", (event) => {
        state.firmware[device].code = event.target.value;
        state.firmware[device].source = "manual";
        setFirmwareCodeName(device);                                                  // Llamada: mantiene visible el nombre descargable.
        setFirmwareBadge(device, event.target.value.trim() ? "warn" : "", event.target.value.trim() ? "Listo" : "Pendiente"); // Llamada: ejecuta una accion del modulo actual.
        markDirty();                                                                  // Llamada: ejecuta una accion del modulo actual.
      });
    });

    $("#panel-firmware").addEventListener("click", (event) => {                       // Llamada: ejecuta una accion del modulo actual.
      const button = event.target.closest("button[data-fw-action]");                  // Constante button: constante usada en button.
      if (!button) return;                                                            // Condicion: valida estado antes de continuar el flujo.
      runFirmwareAction(button.dataset.device, button.dataset.fwAction);              // Llamada: ejecuta una accion del modulo actual.
    });

    $("#fw-quick-port-s3")?.addEventListener("change", (event) => {                   // Llamada: ejecuta una accion del modulo actual.
      syncFirmwareUploadPort("s3", event.target.value);                               // Llamada: sincroniza el COM elegido para conexion y firmware.
      markDirty();                                                                    // Llamada: ejecuta una accion del modulo actual.
    });
    $("#fw-quick-port-cam")?.addEventListener("change", (event) => {                  // Llamada: ejecuta una accion del modulo actual.
      syncFirmwareUploadPort("cam", event.target.value);                              // Llamada: sincroniza el COM elegido para conexion y firmware.
      markDirty();                                                                    // Llamada: ejecuta una accion del modulo actual.
    });
    $("#btn-s3-quick-verify")?.addEventListener("click", () => runS3QuickAction("verify")); // Llamada: ejecuta una accion del modulo actual.
    $("#btn-s3-quick-upload")?.addEventListener("click", () => runS3QuickAction("upload")); // Llamada: ejecuta una accion del modulo actual.
    $("#btn-cam-quick-verify")?.addEventListener("click", () => runCamQuickAction("verify"));
    $("#btn-cam-quick-upload")?.addEventListener("click", () => runCamQuickAction("upload"));
  }

  function setFirmwareBadge(device, mode, text) {                                     // Funcion setFirmwareBadge: asigna firmware badge.
    // Referencia badge: nodo o coleccion DOM usada por la UI.
    const badge = $(`#fw-status-${device}`);
    if (!badge) return;                                                               // Condicion: valida estado antes de continuar el flujo.
    badge.classList.remove("ok", "warn", "err");                                      // Llamada: ejecuta una accion del modulo actual.
    if (mode) badge.classList.add(mode);                                              // Condicion: valida estado antes de continuar el flujo.
    badge.textContent = text;                                                         // Asignacion: actualiza estado o salida calculada.
  }

  function firmwareDownloadName(device) {                                             // Funcion firmwareDownloadName: resuelve el nombre .ino a descargar.
    const item = state.firmware[device] || {};                                        // Constante item: constante usada en item.
    const bundled = FIRMWARE_FILES[device] || {};                                     // Constante bundled: archivo local incluido en el proyecto.
    return item.fileName || bundled.fileName || `vesta-${device || "firmware"}.ino`;  // Retorno: entrega el nombre final al navegador.
  }

  function firmwareFetchUrl(firmware) {                                               // Funcion firmwareFetchUrl: arma URL estable para leer .ino actual.
    const relativeUrl = firmware?.url || "";                                          // Constante relativeUrl: ruta del archivo dentro del proyecto.
    if (!relativeUrl) return "";                                                      // Condicion: valida estado antes de continuar el flujo.
    if (/^https?:\/\//i.test(relativeUrl)) return relativeUrl;                        // Condicion: conserva URL absoluta.
    if (window.location.protocol === "file:") {                                       // Condicion: fallback cuando abren el HTML directo.
      const port = window.location.port || "5177";                                    // Constante port: puerto local usado por el servidor tecnico.
      return `http://127.0.0.1:${port}/${relativeUrl.replace(/^\/+/, "")}`;           // Retorno: URL local absoluta.
    }
    return relativeUrl;                                                               // Retorno: ruta relativa normal desde localhost.
  }

  function bundledFirmwareCode(device) {                                              // Funcion bundledFirmwareCode: devuelve firmware embebido para llenar el editor.
    return String(FIRMWARE_DEFAULT_CODE?.[device] || "").replace(/^\s*\n/, "");
  }

  function ensureBundledFirmwareVisible(device) {                                     // Funcion ensureBundledFirmwareVisible: evita editores negros vacios al abrir.
    const item = state.firmware[device];                                              // Constante item: estado firmware del dispositivo.
    const editor = $(`#fw-code-${device}`);                                           // Referencia editor: textarea del firmware.
    if (!item || !editor || item.code.trim()) return false;                           // Condicion: conserva codigo ya cargado o editado.
    const code = bundledFirmwareCode(device);
    if (!code.trim()) return false;                                                   // Condicion: sin respaldo embebido no modifica nada.
    item.code = code;
    item.fileName = FIRMWARE_FILES[device]?.fileName || firmwareDownloadName(device);
    item.source = "bundled";
    editor.value = code;
    setFirmwareCodeName(device);
    setFirmwareBadge(device, "ok", "Predeterminado");
    return true;
  }

  function setFirmwareCodeName(device) {                                              // Funcion setFirmwareCodeName: muestra el archivo actual del editor.
    const node = $(`#fw-code-name-${device}`);                                        // Referencia node: nodo o coleccion DOM usada por la UI.
    if (node) node.textContent = firmwareDownloadName(device);                        // Condicion: valida estado antes de continuar el flujo.
  }

  function setFirmwareQuickStatus(mode, text, device = "s3") {                        // Funcion setFirmwareQuickStatus: actualiza la banda de carga rapida.
    const badge = $(`#fw-quick-status-${device}`);                                    // Referencia badge: nodo o coleccion DOM usada por la UI.
    if (!badge) return;                                                               // Condicion: valida estado antes de continuar el flujo.
    badge.classList.remove("ok", "warn", "err");                                      // Llamada: ejecuta una accion del modulo actual.
    if (mode) badge.classList.add(mode);                                              // Condicion: valida estado antes de continuar el flujo.
    badge.textContent = text;                                                         // Asignacion: actualiza estado o salida calculada.
  }

  function setFirmwareQuickStep(activeStep, mode = "", device = "s3") {               // Funcion setFirmwareQuickStep: pinta el avance de carga rapida.
    const order = ["detect", "compile", "upload"];                                    // Arreglo order: arreglo de datos para order.
    order.forEach((step) => {                                                         // Bucle: recorre datos o reintenta una operacion controlada.
      const node = $(`#fw-step-${step}-${device}`);                                   // Referencia node: nodo o coleccion DOM usada por la UI.
      if (!node) return;                                                              // Condicion: valida estado antes de continuar el flujo.
      node.classList.remove("active", "ok", "err");                                   // Llamada: ejecuta una accion del modulo actual.
      const currentIndex = order.indexOf(step);                                       // Constante currentIndex: constante usada en current index.
      const activeIndex = order.indexOf(activeStep);                                  // Constante activeIndex: constante usada en active index.
      if (mode === "err" && step === activeStep) node.classList.add("err");           // Condicion: valida estado antes de continuar el flujo.
      else if (activeIndex >= 0 && currentIndex < activeIndex) node.classList.add("ok"); // Condicion: valida estado antes de continuar el flujo.
      else if (step === activeStep) node.classList.add(mode === "ok" ? "ok" : "active"); // Condicion: valida estado antes de continuar el flujo.
    });
  }

  function syncFirmwareUploadPort(device, port) {                                     // Funcion syncFirmwareUploadPort: mantiene iguales los selectores COM.
    const value = String(port || "").trim();                                          // Constante value: constante usada en value.
    const isCam = device === "cam";
    state.firmware[device].port = value;                                              // Asignacion: actualiza estado o salida calculada.
    if (isCam) state.connection.camPort = value;                                      // Asignacion: actualiza estado o salida calculada.
    else state.connection.s3Port = value;                                             // Asignacion: actualiza estado o salida calculada.
    const ids = isCam
      ? ["fw-port-cam", "cam-port", "fw-quick-port-cam"]
      : ["fw-port-s3", "s3-port", "fw-quick-port-s3"];
    ids.forEach((id) => {                                                             // Bucle: recorre datos o reintenta una operacion controlada.
      const select = $(`#${id}`);                                                     // Referencia select: nodo o coleccion DOM usada por la UI.
      if (!select) return;                                                            // Condicion: valida estado antes de continuar el flujo.
      if (value) upsertSelectOption(select, value, value);                            // Condicion: valida estado antes de continuar el flujo.
      select.value = value;                                                           // Asignacion: actualiza estado o salida calculada.
    });
  }

  function syncS3UploadPort(port) {                                                   // Funcion syncS3UploadPort: mantiene compatibilidad con llamadas existentes.
    syncFirmwareUploadPort("s3", port);
  }

  function setFirmwareOutput(text) {                                                  // Funcion setFirmwareOutput: asigna firmware output.
    $("#fw-output").textContent = text || "";                                         // Llamada: ejecuta una accion del modulo actual.
    $("#fw-last-action").textContent = new Date().toLocaleTimeString("es-MX", {       // Llamada: ejecuta una accion del modulo actual.
      hour: "2-digit",                                                                // Campo hour: campo de datos para hour.
      minute: "2-digit",                                                              // Campo minute: campo de datos para minute.
      second: "2-digit"                                                               // Campo second: campo de datos para second.
    });
  }

  function appendFirmwareOutput(text) {                                               // Funcion appendFirmwareOutput: encapsula la logica de firmware y compilacion Arduino.
    const output = $("#fw-output");                                                   // Referencia output: nodo o coleccion DOM usada por la UI.
    if (!output) return;                                                              // Condicion: valida estado antes de continuar el flujo.
    output.textContent += text || "";
    output.scrollTop = output.scrollHeight;                                           // Asignacion: actualiza estado o salida calculada.
    const lastAction = $("#fw-last-action");                                          // Referencia lastAction: nodo o coleccion DOM usada por la UI.
    if (lastAction) {                                                                 // Condicion: valida estado antes de continuar el flujo.
      lastAction.textContent = new Date().toLocaleTimeString("es-MX", {               // Asignacion: actualiza estado o salida calculada.
        hour: "2-digit",                                                              // Campo hour: campo de datos para hour.
        minute: "2-digit",                                                            // Campo minute: campo de datos para minute.
        second: "2-digit"                                                             // Campo second: campo de datos para second.
      });
    }
  }

  function readFirmwareFile(device, event) {                                          // Funcion readFirmwareFile: lee firmware file.
    const file = event.target.files?.[0];                                             // Constante file: constante usada en file.
    if (!file) return;                                                                // Condicion: valida estado antes de continuar el flujo.
    const reader = new FileReader();                                                  // Constante reader: constante usada en reader.
    reader.onload = () => {                                                           // Asignacion: actualiza estado o salida calculada.
      state.firmware[device].fileName = file.name;
      state.firmware[device].code = String(reader.result || "");
      state.firmware[device].source = "file";
      // Llamada: ejecuta una accion del modulo actual.
      $(`#fw-code-${device}`).value = state.firmware[device].code;
      setFirmwareCodeName(device);                                                    // Llamada: actualiza el nombre descargable.
      setFirmwareBadge(device, "warn", file.name);                                    // Llamada: ejecuta una accion del modulo actual.
      // Llamada: ejecuta una accion del modulo actual.
      setFirmwareOutput(`${state.firmware[device].label}\nArchivo: ${file.name}\nTamano: ${file.size} bytes`);
      markDirty();                                                                    // Llamada: ejecuta una accion del modulo actual.
      // Llamada: ejecuta una accion del modulo actual.
      log(`${state.firmware[device].label}: codigo cargado`, "ok");
    };
    reader.onerror = () => {                                                          // Asignacion: actualiza estado o salida calculada.
      setFirmwareBadge(device, "err", "Error");                                       // Llamada: ejecuta una accion del modulo actual.
      // Llamada: ejecuta una accion del modulo actual.
      log(`${state.firmware[device].label}: no se pudo leer el archivo`, "err");
    };
    reader.readAsText(file);                                                          // Llamada: ejecuta una accion del modulo actual.
  }

  async function loadBundledFirmware(options = {}) {                                  // Funcion loadBundledFirmware: carga firmware incluido en el editor de la UI.
    const force = Boolean(options.force);                                             // Constante force: constante usada en force.
    const targetDevices = options.device ? [options.device] : Object.keys(FIRMWARE_FILES); // Constante targetDevices: constante usada en target devices.
    const loaded = [];                                                                // Arreglo loaded: arreglo de datos para loaded.

    for (const device of targetDevices) {                                             // Bucle: recorre datos o reintenta una operacion controlada.
      const firmware = FIRMWARE_FILES[device];                                        // Constante firmware: constante usada en firmware y compilacion Arduino.
      const item = state.firmware[device];                                            // Constante item: constante usada en item.
      if (!firmware || !item) continue;                                               // Condicion: valida estado antes de continuar el flujo.
      if (item.code.trim() && !force && item.source !== "bundled") continue;          // Condicion: valida estado antes de continuar el flujo.

      let code = "";                                                                  // Estado code: estado mutable de code.
      let source = "archivo local";                                                   // Estado source: estado mutable de source.
      try {                                                                           // Bloque try: ejecuta una operacion que puede fallar.
        const response = await fetch(firmwareFetchUrl(firmware), { cache: "no-store" }); // Constante response: lee el .ino actual.
        // Condicion: valida estado antes de continuar el flujo.
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        code = await response.text();                                                 // Asignacion: actualiza estado o salida calculada.
        source = "archivo local";                                                     // Asignacion: actualiza estado o salida calculada.
      } catch (error) {
        const fallbackCode = bundledFirmwareCode(device);
        if (fallbackCode.trim()) {
          code = fallbackCode;
          source = "respaldo interno";
        }
        if (!code) {                                                                  // Condicion: valida estado antes de continuar el flujo.
          setFirmwareBadge(device, "err", "No cargado");                              // Llamada: ejecuta una accion del modulo actual.
          // Llamada: ejecuta una accion del modulo actual.
          log(`${item.label}: firmware local no disponible (${error.message})`, "err");
          continue;
        }
      }

      item.code = code;                                                               // Asignacion: actualiza estado o salida calculada.
      item.fileName = firmware.fileName;                                              // Asignacion: actualiza estado o salida calculada.
      item.source = "bundled";                                                        // Asignacion: actualiza estado o salida calculada.
      // Referencia editor: nodo o coleccion DOM usada por la UI.
      const editor = $(`#fw-code-${device}`);
      if (editor) editor.value = item.code;                                           // Condicion: valida estado antes de continuar el flujo.
      setFirmwareCodeName(device);                                                    // Llamada: actualiza el nombre visible del archivo.
      setFirmwareBadge(device, "ok", "Predeterminado");                               // Llamada: ejecuta una accion del modulo actual.
      // Llamada: ejecuta una accion del modulo actual.
      loaded.push(`${item.label}: ${firmware.fileName} (${source})`);
    }

    if (loaded.length) {                                                              // Condicion: valida estado antes de continuar el flujo.
      // Llamada: ejecuta una accion del modulo actual.
      setFirmwareOutput(`Firmware predeterminado cargado en el editor\n${loaded.join("\n")}`);
      saveLocal({ quiet: true });                                                     // Llamada: ejecuta una accion del modulo actual.
    }
  }

  async function refreshArduinoStatus() {                                             // Funcion refreshArduinoStatus: consulta disponibilidad y version de arduino-cli.
    try {                                                                             // Bloque try: ejecuta una operacion que puede fallar.
      $("#fw-cli-status").textContent = "Consultando";                                // Llamada: ejecuta una accion del modulo actual.
      const data = await fetchJson("/api/arduino/status");                            // Constante data: constante usada en data.
      $("#fw-cli-status").textContent = data.ok ? data.version : "No disponible";     // Llamada: ejecuta una accion del modulo actual.
      setFirmwareOutput(data.output || data.version || "Arduino CLI no disponible");  // Llamada: ejecuta una accion del modulo actual.
      log(data.ok ? "arduino-cli disponible" : "arduino-cli no disponible", data.ok ? "ok" : "err"); // Llamada: ejecuta una accion del modulo actual.
    } catch (error) {
      $("#fw-cli-status").textContent = "Error";                                      // Llamada: ejecuta una accion del modulo actual.
      setFirmwareOutput(error.message);                                               // Llamada: ejecuta una accion del modulo actual.
      // Llamada: ejecuta una accion del modulo actual.
      log(`arduino-cli: ${error.message}`, "err");
    }
  }

  function setPortSelectorsState(text) {                                              // Funcion setPortSelectorsState: asigna port selectors state.
    ["s3", "cam"].forEach((device) => {
      // Referencia select: nodo o coleccion DOM usada por la UI.
      const select = $(`#fw-port-${device}`);
      // Condicion: valida estado antes de continuar el flujo.
      if (select) select.innerHTML = `<option value="">${escapeHtml(text)}</option>`;
    });
    ["s3", "cam"].forEach((device) => {
      const quickPort = $(`#fw-quick-port-${device}`);
      if (quickPort) quickPort.innerHTML = `<option value="">${escapeHtml(text)}</option>`;
    });
    ["s3-port", "cam-port"].forEach((id) => {
      // Referencia connectionSelect: nodo o coleccion DOM usada por la UI.
      const connectionSelect = $(`#${id}`);
      // Condicion: valida estado antes de continuar el flujo.
      if (connectionSelect) connectionSelect.innerHTML = `<option value="">${escapeHtml(text)}</option>`;
    });
  }

  function refreshPorts(options = {}) {                                               // Funcion refreshPorts: programa la actualizacion de puertos seriales.
    if (portsRefreshInFlight) return portsRefreshInFlight;                            // Condicion: valida estado antes de continuar el flujo.
    portsRefreshInFlight = refreshPortsNow(options)                                   // Asignacion: actualiza estado o salida calculada.
      .finally(() => {
        portsRefreshInFlight = null;                                                  // Asignacion: actualiza estado o salida calculada.
      });
    return portsRefreshInFlight;                                                      // Retorno: entrega el resultado al llamador.
  }

  function startPortsAutoRefresh() {                                                  // Funcion startPortsAutoRefresh: inicia ports auto refresh.
    if (portsAutoRefreshTimer) return;                                                // Condicion: valida estado antes de continuar el flujo.
    const refresh = () => refreshPorts({ force: true, silent: true });                // Funcion flecha refresh: encapsula la logica de refresh.
    portsAutoRefreshTimer = true;                                                     // Asignacion: actualiza estado o salida calculada.
    if (navigator.serial?.addEventListener) {                                         // Condicion: valida estado antes de continuar el flujo.
      navigator.serial.addEventListener("connect", refresh);                          // Llamada: ejecuta una accion del modulo actual.
      navigator.serial.addEventListener("disconnect", refresh);                       // Llamada: ejecuta una accion del modulo actual.
    }
    if (navigator.usb?.addEventListener) {                                            // Condicion: valida estado antes de continuar el flujo.
      navigator.usb.addEventListener("connect", refresh);                             // Llamada: ejecuta una accion del modulo actual.
      navigator.usb.addEventListener("disconnect", refresh);                          // Llamada: ejecuta una accion del modulo actual.
    }
  }

  async function refreshPortsNow(options = {}) {                                      // Funcion refreshPortsNow: consulta puertos seriales y actualiza selectores.
    const silent = Boolean(options?.silent);                                          // Constante silent: constante usada en silent.
    if (!silent || !lastPortsSignature) setPortSelectorsState("Detectando puertos..."); // Condicion: valida estado antes de continuar el flujo.
    try {                                                                             // Bloque try: ejecuta una operacion que puede fallar.
      const url = options?.force ? "/api/arduino/ports?force=1" : "/api/arduino/ports"; // Constante url: constante usada en url.
      const data = await fetchJson(url, { timeoutMs: 10000 });                        // Constante data: constante usada en data.
      const ports = data.ports || [];                                                 // Constante ports: constante usada en comunicaciones y puertos.
      const signature = JSON.stringify(ports.map((port) => ({                         // Constante signature: constante usada en signature.
        address: port.address || port.port || "",                                     // Campo address: campo de datos para address.
        label: port.label || port.name || "",                                         // Campo label: campo de datos para label.
        guess: port.guess || ""                                                       // Campo guess: campo de datos para guess.
      })));
      const changed = signature !== lastPortsSignature;                               // Constante changed: constante usada en changed.
      lastPortsSignature = signature;                                                 // Asignacion: actualiza estado o salida calculada.
      populatePorts(ports);                                                           // Llamada: ejecuta una accion del modulo actual.
      if (!silent || changed) {                                                       // Condicion: valida estado antes de continuar el flujo.
        setFirmwareOutput(ports.length ? JSON.stringify(ports, null, 2) : "Sin puertos detectados"); // Llamada: ejecuta una accion del modulo actual.
        // Llamada: ejecuta una accion del modulo actual.
        log(`Puertos detectados: ${ports.length}`, ports.length ? "ok" : "sys");
      }
    } catch (error) {
      if (!silent || !lastPortsSignature) setPortSelectorsState("Error detectando puertos"); // Condicion: valida estado antes de continuar el flujo.
      if (!silent) setFirmwareOutput(error.message);                                  // Condicion: valida estado antes de continuar el flujo.
      // Llamada: ejecuta una accion del modulo actual.
      log(`Puertos: ${error.message}`, "err");
    }
  }

  function isBluetoothPortInfo(port) {                                                // Funcion isBluetoothPortInfo: evalua bluetooth port info.
    const text = [port.kind, port.label, port.name, port.pnpId].filter(Boolean).join(" ").toLowerCase(); // Arreglo text: arreglo de datos para text.
    return text.includes("bluetooth") || text.includes("bthenum");                    // Retorno: entrega el resultado al llamador.
  }

  function isDevicePort(port, device) {                                               // Funcion isDevicePort: evalua device port.
    if (device === "s3") return port.guess === "s3" || port.guess === "esp32";        // Condicion: valida estado antes de continuar el flujo.
    if (device === "cam") return port.guess === "cam" || port.guess === "esp32";      // Condicion: valida estado antes de continuar el flujo.
    return port.guess === device;                                                     // Retorno: entrega el resultado al llamador.
  }

  function pickDetectedPort(ports, current, device) {                                 // Funcion pickDetectedPort: encapsula la logica de comunicaciones y puertos.
    const currentPort = current ? ports.find((port) => port.address === current) : null; // Constante currentPort: constante usada en comunicaciones y puertos.
    const guessed = ports.filter((port) => isDevicePort(port, device));               // Constante guessed: constante usada en guessed.
    const serialCandidates = ports.filter((port) =>                                   // Constante serialCandidates: constante usada en comunicaciones y puertos.
      port.kind !== "bluetooth" &&
      !isBluetoothPortInfo(port) &&
      (!port.guess || isDevicePort(port, device))
    );
    if (guessed.length === 1 && (!currentPort || isBluetoothPortInfo(currentPort))) { // Condicion: valida estado antes de continuar el flujo.
      return guessed[0].address;                                                      // Retorno: entrega el resultado al llamador.
    }
    if (!guessed.length && serialCandidates.length === 1 && (!currentPort || isBluetoothPortInfo(currentPort))) { // Condicion: valida estado antes de continuar el flujo.
      return serialCandidates[0].address;                                             // Retorno: entrega el resultado al llamador.
    }
    return currentPort ? currentPort.address : "";                                    // Retorno: entrega el resultado al llamador.
  }

  function populatePorts(ports) {                                                     // Funcion populatePorts: encapsula la logica de comunicaciones y puertos.
    const normalized = ports.map((port) => ({                                         // Constante normalized: constante usada en normalized.
      address: port.address || port.port || "",                                       // Campo address: campo de datos para address.
      label: port.label || port.name || port.board || "Serial",                       // Campo label: campo de datos para label.
      name: port.name || "",                                                          // Campo name: campo de datos para name.
      board: port.board || "",                                                        // Campo board: campo de datos para board.
      guess: port.guess || "",                                                        // Campo guess: campo de datos para guess.
      kind: port.kind || "",                                                          // Campo kind: campo de datos para kind.
      pnpId: port.pnpId || "",                                                        // Campo pnpId: campo de datos para pnp id.
      vendorId: port.vendorId || "",                                                  // Campo vendorId: campo de datos para vendor id.
      productId: port.productId || ""                                                 // Campo productId: campo de datos para product id.
    })).filter((port) => port.address);

    ["s3", "cam"].forEach((device) => {
      // Referencia select: nodo o coleccion DOM usada por la UI.
      const select = $(`#fw-port-${device}`);
      if (!select) return;                                                            // Condicion: valida estado antes de continuar el flujo.
      const current = device === "cam"                                                // Constante current: constante usada en current.
        ? normalizeManualComPort(state.firmware[device].port || state.connection.camPort || "")
        : state.firmware[device].port;
      const devicePorts = normalized;                                                  // Constante devicePorts: solo puertos realmente presentes.
      if (!devicePorts.length) {                                                      // Condicion: valida estado antes de continuar el flujo.
        // Asignacion: actualiza estado o salida calculada.
        select.innerHTML = `<option value="">Sin puertos COM detectados</option>`;
        return;                                                                       // Retorno: entrega el resultado al llamador.
      }
      const detected = pickDetectedPort(devicePorts, current, device);                // Constante detected: constante usada en detected.

      // Asignacion: actualiza estado o salida calculada.
      select.innerHTML = `<option value="">Seleccionar</option>${devicePorts.map((port) => {
        const address = port.address;
        const guess = port.guess === "s3" ? "S3" : port.guess === "cam" ? "CAM" : port.guess === "esp32" ? "ESP32" : "";
        const kind = port.kind === "bluetooth" ? "Bluetooth" : "";
        const label = [address, port.label, guess || kind].filter(Boolean).join(" - ");
        return `<option value="${escapeHtml(address)}">${escapeHtml(label)}</option>`;
      }).join("")}`;
      if (detected) {                                                                 // Condicion: valida estado antes de continuar el flujo.
        select.value = detected;                                                      // Asignacion: actualiza estado o salida calculada.
        state.firmware[device].port = detected;
        setFirmwareBadge(device, "ok", detected);                                     // Llamada: ejecuta una accion del modulo actual.
      }
    });

    populateConnectionPorts(normalized);                                              // Llamada: ejecuta una accion del modulo actual.
    populateCamConnectionPorts(normalized);                                           // Llamada: ejecuta una accion del modulo actual.
    populateQuickFirmwarePort(normalized, "s3");                                      // Llamada: sincroniza selector de carga rapida S3.
    populateQuickFirmwarePort(normalized, "cam");                                     // Llamada: sincroniza selector de carga rapida CAM.
  }

  function populateQuickFirmwarePort(ports, device) {                                 // Funcion populateQuickFirmwarePort: llena el selector COM de carga rapida.
    const select = $(`#fw-quick-port-${device}`);                                     // Referencia select: nodo o coleccion DOM usada por la UI.
    if (!select) return;                                                              // Condicion: valida estado antes de continuar el flujo.
    if (!ports.length) {                                                              // Condicion: valida estado antes de continuar el flujo.
      select.innerHTML = `<option value="">Auto</option>`;                            // Asignacion: actualiza estado o salida calculada.
      setFirmwareQuickStatus("warn", "Sin COM", device);                             // Llamada: ejecuta una accion del modulo actual.
      setFirmwareQuickStep("detect", "", device);                                    // Llamada: ejecuta una accion del modulo actual.
      return;                                                                         // Retorno: entrega el resultado al llamador.
    }

    const current = device === "cam"
      ? normalizeManualComPort(state.firmware.cam.port || state.connection.camPort || select.value || "")
      : state.firmware.s3.port || state.connection.s3Port || select.value || "";
    const detected = pickDetectedPort(ports, current, device);                        // Constante detected: constante usada en detected.
    select.innerHTML = `<option value="">Auto</option>${ports.map((port) => {         // Asignacion: actualiza estado o salida calculada.
      const guess = port.guess === "s3"
        ? "ESP32-S3"
        : port.guess === "cam"
          ? "ESP32-CAM"
          : port.guess === "esp32"
            ? "ESP32"
            : "";
      const kind = port.kind === "bluetooth" ? "Bluetooth" : "";
      const label = [port.address, port.label, guess || kind].filter(Boolean).join(" - ");
      return `<option value="${escapeHtml(port.address)}">${escapeHtml(label)}</option>`;
    }).join("")}`;

    if (detected) {                                                                   // Condicion: valida estado antes de continuar el flujo.
      select.value = detected;                                                        // Asignacion: actualiza estado o salida calculada.
      syncFirmwareUploadPort(device, detected);                                       // Llamada: ejecuta una accion del modulo actual.
      setFirmwareQuickStatus("ok", detected, device);                                // Llamada: ejecuta una accion del modulo actual.
    } else {
      select.value = "";                                                              // Asignacion: actualiza estado o salida calculada.
      setFirmwareQuickStatus("warn", "Auto", device);                                // Llamada: ejecuta una accion del modulo actual.
    }
    setFirmwareQuickStep("detect", "", device);                                      // Llamada: ejecuta una accion del modulo actual.
  }

  function populateConnectionPorts(ports) {                                           // Funcion populateConnectionPorts: encapsula la logica de comunicaciones y puertos.
    const select = $("#s3-port");                                                     // Referencia select: nodo o coleccion DOM usada por la UI.
    if (!select) return;                                                              // Condicion: valida estado antes de continuar el flujo.
    if (!ports.length) {                                                              // Condicion: valida estado antes de continuar el flujo.
      // Asignacion: actualiza estado o salida calculada.
      select.innerHTML = `<option value="">Sin puertos COM detectados</option>`;
      return;                                                                         // Retorno: entrega el resultado al llamador.
    }

    const current = state.connection.s3Port || state.firmware.s3.port || "";          // Constante current: constante usada en current.
    const detected = pickDetectedPort(ports, current, "s3");                          // Constante detected: constante usada en detected.

    // Asignacion: actualiza estado o salida calculada.
    select.innerHTML = `<option value="">Seleccionar ESP</option>${ports.map((port) => {
      const guess = port.guess === "s3"
        ? "ESP32-S3"
        : port.guess === "cam"
          ? "ESP32-CAM"
          : port.guess === "esp32"
            ? "ESP32"
            : "";
      const kind = port.kind === "bluetooth" ? "Bluetooth" : "";
      const label = [port.address, port.label, guess || kind].filter(Boolean).join(" - ");
      return `<option value="${escapeHtml(port.address)}">${escapeHtml(label)}</option>`;
    }).join("")}`;

    if (detected) {                                                                   // Condicion: valida estado antes de continuar el flujo.
      select.value = detected;                                                        // Asignacion: actualiza estado o salida calculada.
      state.connection.s3Port = detected;                                             // Asignacion: actualiza estado o salida calculada.
      state.firmware.s3.port = detected;                                              // Asignacion: actualiza estado o salida calculada.
      const firmwarePort = $("#fw-port-s3");                                          // Referencia firmwarePort: nodo o coleccion DOM usada por la UI.
      if (firmwarePort) firmwarePort.value = detected;                                // Condicion: valida estado antes de continuar el flujo.
    }
  }

  function populateCamConnectionPorts(ports) {                                        // Funcion populateCamConnectionPorts: encapsula la logica de camara y video.
    const select = $("#cam-port");                                                    // Referencia select: nodo o coleccion DOM usada por la UI.
    if (!select) return;                                                              // Condicion: valida estado antes de continuar el flujo.
    const current = normalizeManualComPort(state.connection.camPort || state.firmware.cam.port || ""); // Constante current: constante usada en current.
    const camPorts = ports;                                                           // Constante camPorts: evita reusar COM guardados que ya no existen.
    if (!camPorts.length) {                                                           // Condicion: valida estado antes de continuar el flujo.
      // Asignacion: actualiza estado o salida calculada.
      select.innerHTML = `<option value="">Sin puertos COM detectados</option>`;
      return;                                                                         // Retorno: entrega el resultado al llamador.
    }

    const detected = pickDetectedPort(camPorts, current, "cam");                      // Constante detected: constante usada en detected.

    // Asignacion: actualiza estado o salida calculada.
    select.innerHTML = `<option value="">Seleccionar CAM</option>${camPorts.map((port) => {
      const guess = port.guess === "cam"
        ? "ESP32-CAM"
        : port.guess === "s3"
          ? "ESP32-S3"
          : port.guess === "esp32"
            ? "ESP32"
            : "";
      const kind = port.kind === "bluetooth" ? "Bluetooth" : "";
      const label = [port.address, port.label, guess || kind].filter(Boolean).join(" - ");
      return `<option value="${escapeHtml(port.address)}">${escapeHtml(label)}</option>`;
    }).join("")}`;

    if (detected) {                                                                   // Condicion: valida estado antes de continuar el flujo.
      select.value = detected;                                                        // Asignacion: actualiza estado o salida calculada.
      state.connection.camPort = detected;                                            // Asignacion: actualiza estado o salida calculada.
      state.firmware.cam.port = detected;                                             // Asignacion: actualiza estado o salida calculada.
      const firmwarePort = $("#fw-port-cam");                                         // Referencia firmwarePort: nodo o coleccion DOM usada por la UI.
      if (firmwarePort) firmwarePort.value = detected;                                // Condicion: valida estado antes de continuar el flujo.
    }
  }

  function firmwareBeepSpec(kind = "countdown") {                                     // Funcion firmwareBeepSpec: selecciona tono corto segun fase de carga.
    if (kind === "release") return { frequency: 1180, duration: 0.16, volume: 0.07 };
    if (kind === "retry") return { frequency: 360, duration: 0.22, volume: 0.10 };
    return { frequency: 880, duration: 0.09, volume: 0.07 };
  }

  function firmwareBeepDataUri(kind = "countdown") {                                  // Funcion firmwareBeepDataUri: genera WAV pequeno para fallback sin Web Audio.
    if (firmwareBeepDataUris[kind]) return firmwareBeepDataUris[kind];
    const spec = firmwareBeepSpec(kind);
    const sampleRate = 8000;
    const sampleCount = Math.max(1, Math.round(sampleRate * spec.duration));
    const buffer = new ArrayBuffer(44 + sampleCount * 2);
    const view = new DataView(buffer);
    // Funcion local | writeText: escribe marcas ASCII dentro del buffer WAV.
    const writeText = (offset, text) => {
      for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
    };
    writeText(0, "RIFF");
    view.setUint32(4, 36 + sampleCount * 2, true);
    writeText(8, "WAVE");
    writeText(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeText(36, "data");
    view.setUint32(40, sampleCount * 2, true);
    for (let i = 0; i < sampleCount; i++) {
      const fade = 1 - (i / sampleCount);
      const sample = Math.sin((2 * Math.PI * spec.frequency * i) / sampleRate) * fade * spec.volume;
      view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 32767, true);
    }
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    firmwareBeepDataUris[kind] = `data:audio/wav;base64,${btoa(binary)}`;
    return firmwareBeepDataUris[kind];
  }

  function playFirmwareBeepFallback(kind = "countdown") {                             // Funcion playFirmwareBeepFallback: timbre por elemento audio si no hay Web Audio.
    if (!window.Audio) return;
    try {
      const audio = new Audio(firmwareBeepDataUri(kind));
      audio.volume = kind === "retry" ? 0.7 : 0.55;
      audio.play().catch(() => {});
    } catch {
      // El aviso sonoro es auxiliar; nunca debe bloquear la carga.
    }
  }

  function getFirmwareAudioContext() {                                                // Funcion getFirmwareAudioContext: prepara audio local para avisos de carga.
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!firmwareAudioCtx) firmwareAudioCtx = new AudioCtx();
    return firmwareAudioCtx;
  }

  async function armFirmwareBeep() {                                                  // Funcion armFirmwareBeep: habilita audio desde el click del usuario.
    const ctx = getFirmwareAudioContext();
    if (!ctx) return;
    try {
      if (ctx.state === "suspended") await ctx.resume();
    } catch {
      // Si el navegador bloquea audio, la carga continua sin interrumpirse.
    }
  }

  function playFirmwareBeep(kind = "countdown") {                                     // Funcion playFirmwareBeep: emite un timbre corto sin archivos externos.
    const ctx = getFirmwareAudioContext();
    if (!ctx) {
      playFirmwareBeepFallback(kind);
      return;
    }

    // Funcion local | start: dispara el beep de firmware con Web Audio.
    const start = () => {
      if (ctx.state !== "running") return;
      const now = ctx.currentTime;
      const spec = firmwareBeepSpec(kind);
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(spec.frequency, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(spec.volume, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + spec.duration);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(now);
      oscillator.stop(now + spec.duration + 0.03);
    };

    if (ctx.state === "suspended") {
      ctx.resume().then(start).catch(() => {});
      return;
    }
    start();
  }

  async function runQuickFirmwareAction(device, action) {                             // Funcion runQuickFirmwareAction: ejecuta verificacion/subida rapida.
    const item = state.firmware[device];                                              // Constante item: constante usada en item.
    if (!item) return;                                                                // Condicion: valida estado antes de continuar el flujo.

    item.fqbn = device === "s3"
      ? normalizeS3Fqbn($(`#fw-fqbn-${device}`)?.value || item.fqbn || S3_DEFAULT_FQBN)
      : $(`#fw-fqbn-${device}`)?.value.trim() || item.fqbn || CAM_DEFAULT_FQBN;
    const fqbnInput = $(`#fw-fqbn-${device}`);                                        // Referencia fqbnInput: nodo o coleccion DOM usada por la UI.
    if (fqbnInput) fqbnInput.value = item.fqbn;                                       // Condicion: valida estado antes de continuar el flujo.

    const selectedPort = $(`#fw-quick-port-${device}`)?.value || $(`#fw-port-${device}`)?.value || "";
    syncFirmwareUploadPort(device, selectedPort);                                     // Llamada: sincroniza el puerto elegido.
    item.fileName = FIRMWARE_FILES[device].fileName;                                  // Asignacion: actualiza estado o salida calculada.
    item.source = "bundled";                                                          // Asignacion: actualiza estado o salida calculada.

    const label = action === "upload" ? "Subiendo" : "Verificando";                  // Constante label: constante usada en label.
    setFirmwareQuickStatus("warn", label, device);                                   // Llamada: actualiza la banda de carga rapida.
    setFirmwareQuickStep(action === "upload" ? "detect" : "compile", "", device);    // Llamada: actualiza la banda de carga rapida.
    setFirmwareBadge(device, "warn", label);                                         // Llamada: actualiza badge avanzado.
    setFirmwareOutput([                                                               // Llamada: escribe estado inicial de firmware.
      device === "cam" ? "ESP32-CAM" : "ESP32-S3 N16R8",
      `${label} firmware actual`,
      selectedPort ? `Puerto: ${selectedPort}` : "Puerto: deteccion automatica",
      `Archivo: ${FIRMWARE_FILES[device].fileName}`,
      `FQBN: ${item.fqbn}`
    ].join("\n"));

    try {                                                                             // Bloque try: ejecuta una operacion que puede fallar.
      if (action === "upload") {
        const result = await runFirmwareUploadStream(device, item, { useBundled: true, quick: true }); // Espera asincrona: sube firmware por streaming.
        setFirmwareQuickStatus(result.ok ? "ok" : "err", result.ok ? "Subido" : "Error", device);
        setFirmwareQuickStep("upload", result.ok ? "ok" : "err", device);
        setFirmwareBadge(device, result.ok ? "ok" : "err", result.ok ? "Subido" : "Error");
        log(`${item.label}: subida rapida ${result.ok ? "OK" : "fallo"}`, result.ok ? "ok" : "err");
        markDirty();                                                                  // Llamada: ejecuta una accion del modulo actual.
        return;                                                                       // Retorno: entrega el resultado al llamador.
      }

      const data = await fetchJson("/api/arduino/upload", {                           // Constante data: constante usada en data.
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device,
          action: "verify",
          fqbn: item.fqbn,
          port: item.port,
          code: "",
          useBundled: true
        })
      });
      setFirmwareOutput(data.output || JSON.stringify(data, null, 2));                // Llamada: ejecuta una accion del modulo actual.
      setFirmwareQuickStatus(data.ok ? "ok" : "err", data.ok ? "OK" : "Error", device); // Llamada: actualiza la banda de carga rapida.
      setFirmwareQuickStep("compile", data.ok ? "ok" : "err", device);               // Llamada: actualiza la banda de carga rapida.
      setFirmwareBadge(device, data.ok ? "ok" : "err", data.ok ? "OK" : "Error");    // Llamada: actualiza badge avanzado.
      log(`${item.label}: verificacion rapida ${data.ok ? "OK" : "fallo"}`, data.ok ? "ok" : "err");
    } catch (error) {
      setFirmwareQuickStatus("err", "Error", device);                                // Llamada: actualiza la banda de carga rapida.
      setFirmwareQuickStep(action === "upload" ? "upload" : "compile", "err", device); // Llamada: actualiza la banda de carga rapida.
      setFirmwareBadge(device, "err", "Error");                                      // Llamada: actualiza badge avanzado.
      setFirmwareOutput(error.message);                                               // Llamada: ejecuta una accion del modulo actual.
      log(`${item.label}: ${error.message}`, "err");                                  // Llamada: ejecuta una accion del modulo actual.
    }
  }

  async function runS3QuickAction(action) {                                           // Funcion runS3QuickAction: ejecuta verificacion/subida S3 usando el sketch actual del proyecto.
    return runQuickFirmwareAction("s3", action);
  }

  async function runCamQuickAction(action) {                                          // Funcion runCamQuickAction: ejecuta verificacion/subida CAM usando el sketch actual del proyecto.
    return runQuickFirmwareAction("cam", action);
  }

  async function downloadFirmwareCode(device) {                                       // Funcion downloadFirmwareCode: descarga el codigo visible del editor.
    const item = state.firmware[device];                                              // Constante item: constante usada en item.
    if (!item) return;                                                                // Condicion: valida estado antes de continuar el flujo.

    const editor = $(`#fw-code-${device}`);                                           // Referencia editor: nodo o coleccion DOM usada por la UI.
    let code = editor?.value || item.code || "";                                      // Estado code: contenido actual a guardar.
    if (!code.trim() && FIRMWARE_FILES[device]) {                                     // Condicion: si no hay codigo visible, recarga el .ino del proyecto.
      await loadBundledFirmware({ force: true, device });                             // Espera asincrona: carga firmware incluido.
      code = editor?.value || state.firmware[device].code || "";                      // Asignacion: lee el codigo cargado.
    }
    if (!code.trim()) {                                                               // Condicion: valida estado antes de continuar el flujo.
      setFirmwareBadge(device, "err", "Sin codigo");                                  // Llamada: ejecuta una accion del modulo actual.
      setFirmwareOutput(`${item.label}\nNo hay codigo para descargar`);               // Llamada: ejecuta una accion del modulo actual.
      log(`${item.label}: no hay codigo para descargar`, "err");                     // Llamada: ejecuta una accion del modulo actual.
      return;                                                                         // Retorno: entrega el resultado al llamador.
    }

    item.code = code;                                                                 // Asignacion: sincroniza el estado con el editor.
    if (!item.fileName) item.fileName = firmwareDownloadName(device);                 // Condicion: asegura nombre de archivo.
    setFirmwareCodeName(device);                                                      // Llamada: actualiza el nombre visible del archivo.
    const blob = new Blob([code.endsWith("\n") ? code : `${code}\n`], { type: "text/plain;charset=utf-8" }); // Constante blob: archivo .ino descargable.
    const url = URL.createObjectURL(blob);                                            // Constante url: constante usada en url.
    const anchor = document.createElement("a");                                       // Referencia anchor: nodo temporal de descarga.
    anchor.href = url;                                                                // Asignacion: actualiza estado o salida calculada.
    anchor.download = firmwareDownloadName(device);                                   // Asignacion: nombre final de descarga.
    document.body.append(anchor);                                                     // Llamada: ejecuta una accion del modulo actual.
    anchor.click();                                                                   // Llamada: ejecuta una accion del modulo actual.
    anchor.remove();                                                                  // Llamada: ejecuta una accion del modulo actual.
    URL.revokeObjectURL(url);                                                         // Llamada: libera memoria del blob.
    setFirmwareOutput(`${item.label}\nDescargado: ${anchor.download}\nTamano: ${code.length} bytes`); // Llamada: ejecuta una accion del modulo actual.
    log(`${item.label}: codigo descargado como ${anchor.download}`, "ok");           // Llamada: ejecuta una accion del modulo actual.
  }

  async function ensureFirmwareCodeInEditor(device) {                                 // Funcion ensureFirmwareCodeInEditor: garantiza codigo visible antes de compilar/subir.
    const item = state.firmware[device];                                              // Constante item: constante usada en item.
    const editor = $(`#fw-code-${device}`);                                           // Referencia editor: nodo o coleccion DOM usada por la UI.
    if (!item || !editor) return false;                                               // Condicion: valida estado antes de continuar el flujo.
    if (editor.value.trim()) {                                                        // Condicion: usa el codigo ya insertado o modificado.
      item.code = editor.value;                                                       // Asignacion: sincroniza estado desde el textarea.
      if (!item.fileName) item.fileName = firmwareDownloadName(device);               // Condicion: asegura nombre descargable.
      setFirmwareCodeName(device);                                                    // Llamada: actualiza UI del nombre.
      return true;                                                                    // Retorno: entrega el resultado al llamador.
    }
    await loadBundledFirmware({ device });                                            // Espera asincrona: rellena la caja negra desde el .ino local.
    item.code = editor.value || item.code || "";                                      // Asignacion: sincroniza tras cargar.
    setFirmwareCodeName(device);                                                      // Llamada: actualiza UI del nombre.
    return Boolean(item.code.trim());                                                 // Retorno: confirma si hay codigo real.
  }

  async function runFirmwareAction(device, action) {                                  // Funcion runFirmwareAction: verifica, limpia, carga o sube firmware segun accion.
    const item = state.firmware[device];                                              // Constante item: constante usada en item.
    if (!item) return;                                                                // Condicion: valida estado antes de continuar el flujo.

    if (action === "download") {                                                      // Condicion: guarda el codigo visible como archivo .ino.
      await downloadFirmwareCode(device);                                             // Espera asincrona: descarga firmware.
      return;                                                                         // Retorno: entrega el resultado al llamador.
    }

    if (action === "bundled") {                                                       // Condicion: valida estado antes de continuar el flujo.
      await loadBundledFirmware({ force: true, device });                             // Espera asincrona: inserta el firmware actual en la caja negra.
      return;                                                                         // Retorno: entrega el resultado al llamador.
    }

    if (action === "clear") {                                                         // Condicion: valida estado antes de continuar el flujo.
      item.code = "";                                                                 // Asignacion: actualiza estado o salida calculada.
      item.fileName = "";                                                             // Asignacion: actualiza estado o salida calculada.
      item.source = "";                                                               // Asignacion: actualiza estado o salida calculada.
      // Llamada: ejecuta una accion del modulo actual.
      $(`#fw-code-${device}`).value = "";
      // Llamada: ejecuta una accion del modulo actual.
      $(`#fw-file-${device}`).value = "";
      setFirmwareCodeName(device);                                                    // Llamada: restaura el nombre descargable.
      setFirmwareBadge(device, "", "Pendiente");                                      // Llamada: ejecuta una accion del modulo actual.
      // Llamada: ejecuta una accion del modulo actual.
      setFirmwareOutput(`${item.label}\nEditor limpio`);
      markDirty();                                                                    // Llamada: ejecuta una accion del modulo actual.
      return;                                                                         // Retorno: entrega el resultado al llamador.
    }

    if (!(await ensureFirmwareCodeInEditor(device))) {                                // Condicion: no compila/sube si no pudo insertar codigo.
      setFirmwareBadge(device, "err", "Sin codigo");                                  // Llamada: ejecuta una accion del modulo actual.
      setFirmwareOutput(`${item.label}\nNo se pudo cargar codigo en el editor`);      // Llamada: ejecuta una accion del modulo actual.
      log(`${item.label}: editor sin codigo`, "err");                                // Llamada: ejecuta una accion del modulo actual.
      return;                                                                         // Retorno: entrega el resultado al llamador.
    }

    // Asignacion: actualiza estado o salida calculada.
    item.fqbn = $(`#fw-fqbn-${device}`).value.trim();
    // Asignacion: actualiza estado o salida calculada.
    item.port = $(`#fw-port-${device}`).value;
    // Asignacion: actualiza estado o salida calculada.
    item.code = $(`#fw-code-${device}`).value;

    if (!item.code.trim() && FIRMWARE_FILES[device]) {                                // Condicion: valida estado antes de continuar el flujo.
      item.source = "bundled";                                                        // Asignacion: actualiza estado o salida calculada.
      setFirmwareBadge(device, "warn", "Incluido");                                   // Llamada: ejecuta una accion del modulo actual.
      // Llamada: ejecuta una accion del modulo actual.
      log(`${item.label}: editor vacio; usare el firmware incluido`, "sys");
    } else if (!item.code.trim()) {
      setFirmwareBadge(device, "err", "Sin codigo");                                  // Llamada: ejecuta una accion del modulo actual.
      // Llamada: ejecuta una accion del modulo actual.
      log(`${item.label}: falta codigo`, "err");
      return;                                                                         // Retorno: entrega el resultado al llamador.
    }
    if (device === "s3") {                                                            // Condicion: conserva Serial en el COM CH343 antes de compilar/subir.
      item.fqbn = normalizeS3Fqbn(item.fqbn);                                         // Asignacion: reemplaza CDCOnBoot=cdc por CDCOnBoot=default.
      const fqbnInput = $(`#fw-fqbn-${device}`);                                      // Referencia fqbnInput: nodo o coleccion DOM usada por la UI.
      if (fqbnInput) fqbnInput.value = item.fqbn;                                     // Condicion: sincroniza el input con el valor efectivo.
    }
    if (!item.fqbn) {                                                                 // Condicion: valida estado antes de continuar el flujo.
      item.fqbn = device === "cam" ? CAM_DEFAULT_FQBN : S3_DEFAULT_FQBN;              // Asignacion: actualiza estado o salida calculada.
      // Referencia fqbnInput: nodo o coleccion DOM usada por la UI.
      const fqbnInput = $(`#fw-fqbn-${device}`);
      if (fqbnInput) fqbnInput.value = item.fqbn;                                     // Condicion: valida estado antes de continuar el flujo.
      // Llamada: ejecuta una accion del modulo actual.
      log(`${item.label}: FQBN automatico ${item.fqbn}`, "sys");
    }

    const label = action === "upload" ? (item.port ? "Subiendo" : "Auto COM") : "Verificando"; // Constante label: constante usada en label.
    setFirmwareBadge(device, "warn", label);                                          // Llamada: ejecuta una accion del modulo actual.
    // Llamada: ejecuta una accion del modulo actual.
    setFirmwareOutput(`${item.label}\n${label}...\n${item.port ? `Puerto: ${item.port}` : "Puerto: deteccion automatica"}`);

    try {                                                                             // Bloque try: ejecuta una operacion que puede fallar.
      if (action === "upload") {                                                      // Condicion: valida estado antes de continuar el flujo.
        const result = await runFirmwareUploadStream(device, item);                   // Constante result: constante usada en result.
        setFirmwareBadge(device, result.ok ? "ok" : "err", result.ok ? "Subido" : "Error"); // Llamada: ejecuta una accion del modulo actual.
        // Llamada: ejecuta una accion del modulo actual.
        log(`${item.label}: subida ${result.ok ? "OK" : "fallo"}`, result.ok ? "ok" : "err");
        markDirty();                                                                  // Llamada: ejecuta una accion del modulo actual.
        return;                                                                       // Retorno: entrega el resultado al llamador.
      }

      const data = await fetchJson("/api/arduino/upload", {                           // Constante data: constante usada en data.
        method: "POST",                                                               // Campo method: campo de datos para method.
        headers: { "Content-Type": "application/json" },                              // Campo headers: objeto anidado de configuracion.
        body: JSON.stringify({                                                        // Campo body: campo de datos para body.
          device,
          action,
          fqbn: item.fqbn,                                                            // Campo fqbn: campo de datos para firmware y compilacion Arduino.
          port: item.port,                                                            // Campo port: campo de datos para comunicaciones y puertos.
          code: item.code                                                             // Campo code: campo de datos para code.
        })
      });
      setFirmwareBadge(device, data.ok ? "ok" : "err", data.ok ? "OK" : "Error");     // Llamada: ejecuta una accion del modulo actual.
      setFirmwareOutput(data.output || JSON.stringify(data, null, 2));                // Llamada: ejecuta una accion del modulo actual.
      // Llamada: ejecuta una accion del modulo actual.
      log(`${item.label}: ${action === "upload" ? "subida" : "verificacion"} ${data.ok ? "OK" : "fallo"}`, data.ok ? "ok" : "err");
    } catch (error) {
      setFirmwareBadge(device, "err", "Error");                                       // Llamada: ejecuta una accion del modulo actual.
      setFirmwareOutput(error.message);                                               // Llamada: ejecuta una accion del modulo actual.
      // Llamada: ejecuta una accion del modulo actual.
      log(`${item.label}: ${error.message}`, "err");
    }
    markDirty();                                                                      // Llamada: ejecuta una accion del modulo actual.
  }

  async function runFirmwareUploadStream(device, item, options = {}) {                // Funcion runFirmwareUploadStream: encapsula la logica de firmware y compilacion Arduino.
    await armFirmwareBeep();                                                          // Espera asincrona: habilita timbre desde el click de subir firmware.
    const useBundled = Boolean(options.useBundled);                                   // Constante useBundled: indica que el servidor debe usar el sketch actual del disco.
    const quick = Boolean(options.quick && (device === "s3" || device === "cam"));    // Constante quick: actualiza la banda de carga rapida.
    let final = { ok: false, output: "" };                                            // Objeto final: objeto de configuracion para final.
    setFirmwareOutput([                                                               // Llamada: ejecuta una accion del modulo actual.
      item.label,
      "Subiendo...",
      item.port ? `Puerto: ${item.port}` : "Puerto: deteccion automatica",
      useBundled ? `Codigo: ${FIRMWARE_FILES[device]?.fileName || "firmware incluido"}` : item.code.trim() ? "Codigo: editor actual" : "Codigo: firmware incluido",
      "[BOOT] La pagina intentara carga automatica y avisara si hace falta BOOT."
    ].join("\n"));

    await fetchNdjson("/api/arduino/upload-stream", {                                 // Espera asincrona: coordina una operacion externa.
      method: "POST",                                                                 // Campo method: campo de datos para method.
      headers: { "Content-Type": "application/json" },                                // Campo headers: objeto anidado de configuracion.
      body: JSON.stringify({                                                          // Campo body: campo de datos para body.
        device,
        action: "upload",                                                             // Campo action: campo de datos para action.
        fqbn: item.fqbn,                                                              // Campo fqbn: campo de datos para firmware y compilacion Arduino.
        port: item.port,                                                              // Campo port: campo de datos para comunicaciones y puertos.
        code: useBundled ? "" : item.code,                                            // Campo code: campo de datos para code.
        useBundled
      })
    }, (event) => {
      if (event.type === "log") {                                                     // Condicion: valida estado antes de continuar el flujo.
        appendFirmwareOutput(event.text || "");                                       // Llamada: ejecuta una accion del modulo actual.
        return;                                                                       // Retorno: entrega el resultado al llamador.
      }

      if (event.type === "phase") {                                                   // Condicion: valida estado antes de continuar el flujo.
        if (event.phase === "boot-countdown") playFirmwareBeep("countdown");          // Condicion: timbre corto en cada segundo de cuenta regresiva.
        if (quick) {                                                                  // Condicion: actualiza estado visual de carga rapida.
          if (event.phase === "detect") setFirmwareQuickStep("detect", "", device);
          else if (event.phase === "compile") setFirmwareQuickStep("compile", "", device);
          else if (String(event.phase || "").startsWith("upload")) setFirmwareQuickStep("upload", "", device);
          if (event.message) setFirmwareQuickStatus("warn", event.phase === "compile" ? "Compilando" : event.phase === "upload" ? "Subiendo" : "Trabajando", device);
        }
        if (event.port) {                                                             // Condicion: valida estado antes de continuar el flujo.
          item.port = event.port;                                                     // Asignacion: actualiza estado o salida calculada.
          // Referencia portSelect: nodo o coleccion DOM usada por la UI.
          const portSelect = $(`#fw-port-${device}`);
          if (portSelect) {                                                           // Condicion: valida estado antes de continuar el flujo.
            upsertSelectOption(portSelect, event.port, event.port);                   // Llamada: ejecuta una accion del modulo actual.
            portSelect.value = event.port;                                            // Asignacion: actualiza estado o salida calculada.
          }
          if (device === "s3") {                                                      // Condicion: valida estado antes de continuar el flujo.
            state.connection.s3Port = event.port;                                     // Asignacion: actualiza estado o salida calculada.
            const connectionPort = $("#s3-port");                                     // Referencia connectionPort: nodo o coleccion DOM usada por la UI.
            if (connectionPort) {                                                     // Condicion: valida estado antes de continuar el flujo.
              upsertSelectOption(connectionPort, event.port, event.port);             // Llamada: ejecuta una accion del modulo actual.
              connectionPort.value = event.port;                                      // Asignacion: actualiza estado o salida calculada.
            }
            const quickPort = $("#fw-quick-port-s3");                                 // Referencia quickPort: nodo o coleccion DOM usada por la UI.
            if (quickPort) {                                                          // Condicion: valida estado antes de continuar el flujo.
              upsertSelectOption(quickPort, event.port, event.port);                  // Llamada: ejecuta una accion del modulo actual.
              quickPort.value = event.port;                                           // Asignacion: actualiza estado o salida calculada.
            }
          } else if (device === "cam") {
            state.connection.camPort = event.port;                                    // Asignacion: actualiza estado o salida calculada.
            const connectionPort = $("#cam-port");                                    // Referencia connectionPort: nodo o coleccion DOM usada por la UI.
            if (connectionPort) {                                                     // Condicion: valida estado antes de continuar el flujo.
              upsertSelectOption(connectionPort, event.port, event.port);             // Llamada: ejecuta una accion del modulo actual.
              connectionPort.value = event.port;                                      // Asignacion: actualiza estado o salida calculada.
            }
            const quickPort = $("#fw-quick-port-cam");                                // Referencia quickPort: nodo o coleccion DOM usada por la UI.
            if (quickPort) {                                                          // Condicion: valida estado antes de continuar el flujo.
              upsertSelectOption(quickPort, event.port, event.port);                  // Llamada: ejecuta una accion del modulo actual.
              quickPort.value = event.port;                                           // Asignacion: actualiza estado o salida calculada.
            }
          }
        }
        if (event.fqbn) {                                                             // Condicion: valida estado antes de continuar el flujo.
          item.fqbn = event.fqbn;                                                     // Asignacion: actualiza estado o salida calculada.
          // Referencia fqbnInput: nodo o coleccion DOM usada por la UI.
          const fqbnInput = $(`#fw-fqbn-${device}`);
          if (fqbnInput) fqbnInput.value = event.fqbn;                                // Condicion: valida estado antes de continuar el flujo.
        }
        // Llamada: ejecuta una accion del modulo actual.
        appendFirmwareOutput(`\n[FASE] ${event.message || event.phase || ""}\n`);
        log(event.message || event.phase || "Firmware", "sys");                       // Llamada: ejecuta una accion del modulo actual.
        return;                                                                       // Retorno: entrega el resultado al llamador.
      }

      if (event.type === "boot") {                                                    // Condicion: valida estado antes de continuar el flujo.
        if (event.state === "release") playFirmwareBeep("release");
        else if (event.state === "retry") playFirmwareBeep("retry");
        else playFirmwareBeep("countdown");
        if (quick) setFirmwareQuickStatus(event.state === "release" ? "ok" : event.state === "retry" ? "warn" : "warn", event.state === "release" ? "Cargando" : "BOOT", device); // Condicion: actualiza estado visual de carga rapida.
        // Llamada: ejecuta una accion del modulo actual.
        appendFirmwareOutput(`\n[BOOT] ${event.message || ""}\n`);
        log(event.message || "BOOT", event.state === "release" ? "ok" : event.state === "retry" ? "err" : "warn"); // Llamada: ejecuta una accion del modulo actual.
        return;                                                                       // Retorno: entrega el resultado al llamador.
      }

      if (event.type === "final") {                                                   // Condicion: valida estado antes de continuar el flujo.
        final = event;                                                                // Asignacion: actualiza estado o salida calculada.
        if (event.port) item.port = event.port;                                       // Condicion: valida estado antes de continuar el flujo.
        if (event.fqbn) item.fqbn = event.fqbn;                                       // Condicion: valida estado antes de continuar el flujo.
        if (quick) {                                                                  // Condicion: actualiza estado visual de carga rapida.
          setFirmwareQuickStatus(event.ok ? "ok" : "err", event.ok ? "Subido" : "Error", device);
          setFirmwareQuickStep("upload", event.ok ? "ok" : "err", device);
        }
        // Condicion: valida estado antes de continuar el flujo.
        if (!event.ok && event.output) appendFirmwareOutput(`\n[ERROR] ${event.output}\n`);
      }
    });

    return final;                                                                     // Retorno: entrega el resultado al llamador.
  }

  async function fetchNdjson(url, options, onEvent) {                                 // Funcion fetchNdjson: consume respuestas NDJSON de procesos en streaming.
    const response = await fetch(apiUrl(url), options);                               // Constante response: constante usada en response.
    if (!response.ok) {                                                               // Condicion: valida estado antes de continuar el flujo.
      const text = await response.text();                                             // Constante text: constante usada en text.
      let data = {};                                                                  // Objeto data: objeto de configuracion para data.
      try {                                                                           // Bloque try: ejecuta una operacion que puede fallar.
        data = text ? JSON.parse(text) : {};                                          // Asignacion: actualiza estado o salida calculada.
      } catch {
        data = { output: text };                                                      // Asignacion: actualiza estado o salida calculada.
      }
      throw new Error(data.output || data.error || `HTTP ${response.status}`);
    }

    if (!response.body) {                                                             // Condicion: valida estado antes de continuar el flujo.
      const text = await response.text();                                             // Constante text: constante usada en text.
      text.split(/\r?\n/).filter(Boolean).forEach((line) => onEvent(JSON.parse(line))); // Llamada: ejecuta una accion del modulo actual.
      return;                                                                         // Retorno: entrega el resultado al llamador.
    }

    const reader = response.body.getReader();                                         // Constante reader: constante usada en reader.
    const decoder = new TextDecoder();                                                // Constante decoder: constante usada en decoder.
    let buffer = "";                                                                  // Estado buffer: estado mutable de buffer.
    while (true) {                                                                    // Bucle: recorre datos o reintenta una operacion controlada.
      const { done, value } = await reader.read();
      if (done) break;                                                                // Condicion: valida estado antes de continuar el flujo.
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);                                            // Constante lines: constante usada en lines.
      buffer = lines.pop() || "";                                                     // Asignacion: actualiza estado o salida calculada.
      for (const line of lines) {                                                     // Bucle: recorre datos o reintenta una operacion controlada.
        if (!line.trim()) continue;                                                   // Condicion: valida estado antes de continuar el flujo.
        onEvent(JSON.parse(line));                                                    // Llamada: ejecuta una accion del modulo actual.
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) onEvent(JSON.parse(buffer));                                   // Condicion: valida estado antes de continuar el flujo.
  }

  async function fetchJson(url, options = {}) {                                       // Funcion fetchJson: ejecuta una peticion JSON contra la API local.
    const { timeoutMs = 0, ...fetchOptions } = options || {};
    const controller = timeoutMs ? new AbortController() : null;                      // Constante controller: constante usada en controller.
    const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null; // Constante timer: constante usada en timer.
    let response;
    try {                                                                             // Bloque try: ejecuta una operacion que puede fallar.
      response = await fetch(apiUrl(url), {                                           // Asignacion: actualiza estado o salida calculada.
        ...fetchOptions,
        signal: controller?.signal || fetchOptions.signal                             // Campo signal: campo de datos para signal.
      });
    } catch (error) {
      if (error.name === "AbortError") {                                              // Condicion: valida estado antes de continuar el flujo.
        throw new Error(`Tiempo agotado consultando ${url}`);
      }
      throw error;
    } finally {
      if (timer) clearTimeout(timer);                                                 // Condicion: valida estado antes de continuar el flujo.
    }
    const text = await response.text();                                               // Constante text: constante usada en text.
    let data = {};                                                                    // Objeto data: objeto de configuracion para data.
    try {                                                                             // Bloque try: ejecuta una operacion que puede fallar.
      data = text ? JSON.parse(text) : {};                                            // Asignacion: actualiza estado o salida calculada.
    } catch {
      data = { ok: false, output: text };                                             // Asignacion: actualiza estado o salida calculada.
    }
    if (!response.ok) {                                                               // Condicion: valida estado antes de continuar el flujo.
      throw new Error(data.output || data.error || `HTTP ${response.status}`);
    }
    return data;                                                                      // Retorno: entrega el resultado al llamador.
  }

  function bindForms() {                                                              // Funcion bindForms: conecta eventos de forms.
    const fields = [                                                                  // Arreglo fields: arreglo de datos para fields.
      ["#exo-serial", "serial"],
      ["#tech-name", "technician"],
      ["#client-name", "client"],
      ["#firmware-version", "firmware"],
      ["#handoff-notes", "notes"]
    ];
    fields.forEach(([selector, key]) => {                                             // Llamada: ejecuta una accion del modulo actual.
      $(selector).addEventListener("input", (event) => {                              // Llamada: ejecuta una accion del modulo actual.
        state.metadata[key] = event.target.value;
        markDirty();                                                                  // Llamada: ejecuta una accion del modulo actual.
      });
    });
  }

  function renderHardwareChecks() {                                                   // Funcion renderHardwareChecks: renderiza hardware checks.
    const wrap = $("#hardware-checks");                                               // Referencia wrap: nodo o coleccion DOM usada por la UI.
    wrap.innerHTML = HARDWARE_CHECKS.map((item) => {                                  // Asignacion: actualiza estado o salida calculada.
      const checked = state.hardwareChecks[item.key] ? "checked" : "";                // Constante checked: constante usada en diagnostico y pruebas.
      // Retorno: entrega el resultado al llamador.
      return `
        <label class="check-row">
          <input type="checkbox" data-check="${item.key}" ${checked}>
          <strong>${item.label}</strong>
          <small>${item.detail}</small>
        </label>
      `;
    }).join("");
    wrap.addEventListener("change", (event) => {                                      // Llamada: ejecuta una accion del modulo actual.
      const key = event.target.dataset.check;                                         // Constante key: constante usada en key.
      if (!key) return;                                                               // Condicion: valida estado antes de continuar el flujo.
      state.hardwareChecks[key] = event.target.checked;
      updateCheckCount();                                                             // Llamada: ejecuta una accion del modulo actual.
      markDirty();                                                                    // Llamada: ejecuta una accion del modulo actual.
    });
    updateCheckCount();                                                               // Llamada: ejecuta una accion del modulo actual.
  }

  function updateCheckCount() {                                                       // Funcion updateCheckCount: actualiza check count.
    const total = HARDWARE_CHECKS.length;                                             // Constante total: constante usada en total.
    const done = HARDWARE_CHECKS.filter((item) => state.hardwareChecks[item.key]).length; // Constante done: constante usada en done.
    // Llamada: ejecuta una accion del modulo actual.
    $("#check-count").textContent = `${done}/${total}`;
  }

  /* ── Armado (build) panel ──────────────────────────────────────── */
  function renderBuild() {                                                            // Funcion renderBuild: renderiza build.
    const bomList = $("#bom-list");                                                   // Referencia bomList: nodo o coleccion DOM usada por la UI.
    bomList.innerHTML = BOM.map((item) => {                                           // Asignacion: actualiza estado o salida calculada.
      const checked = state.build.bom[item.key] ? "checked" : "";                     // Constante checked: constante usada en diagnostico y pruebas.
      // Retorno: entrega el resultado al llamador.
      return `
        <label class="check-row">
          <input type="checkbox" data-bom="${item.key}" ${checked}>
          <strong>${escapeHtml(item.label)}</strong>
          <small>${escapeHtml(item.detail)}</small>
        </label>
      `;
    }).join("");
    bomList.addEventListener("change", (event) => {                                   // Llamada: ejecuta una accion del modulo actual.
      const key = event.target.dataset.bom;                                           // Constante key: constante usada en key.
      if (!key) return;                                                               // Condicion: valida estado antes de continuar el flujo.
      state.build.bom[key] = event.target.checked;
      markDirty();                                                                    // Llamada: ejecuta una accion del modulo actual.
      renderReadiness();                                                              // Llamada: ejecuta una accion del modulo actual.
      updateBuildCounts();                                                            // Llamada: ejecuta una accion del modulo actual.
    });

    const stepsList = $("#build-steps");                                              // Referencia stepsList: nodo o coleccion DOM usada por la UI.
    stepsList.innerHTML = BUILD_STEPS.map((step) => {                                 // Asignacion: actualiza estado o salida calculada.
      const checked = state.build.steps[step.key] ? "checked" : "";                   // Constante checked: constante usada en diagnostico y pruebas.
      const done = state.build.steps[step.key] ? "done" : "";                         // Constante done: constante usada en done.
      // Retorno: entrega el resultado al llamador.
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
    stepsList.addEventListener("change", (event) => {                                 // Llamada: ejecuta una accion del modulo actual.
      const key = event.target.dataset.stepInput;                                     // Constante key: constante usada en key.
      if (!key) return;                                                               // Condicion: valida estado antes de continuar el flujo.
      state.build.steps[key] = event.target.checked;
      // Constante li: constante usada en li.
      const li = stepsList.querySelector(`[data-step="${key}"]`);
      if (li) li.classList.toggle("done", event.target.checked);                      // Condicion: valida estado antes de continuar el flujo.
      markDirty();                                                                    // Llamada: ejecuta una accion del modulo actual.
      renderReadiness();                                                              // Llamada: ejecuta una accion del modulo actual.
      updateBuildCounts();                                                            // Llamada: ejecuta una accion del modulo actual.
    });

    updateBuildCounts();                                                              // Llamada: ejecuta una accion del modulo actual.
  }

  function updateBuildCounts() {                                                      // Funcion updateBuildCounts: actualiza build counts.
    const bomDone = BOM.filter((item) => state.build.bom[item.key]).length;           // Constante bomDone: constante usada en armado y lista de materiales.
    const stepsDone = BUILD_STEPS.filter((item) => state.build.steps[item.key]).length; // Constante stepsDone: constante usada en steps done.
    // Llamada: ejecuta una accion del modulo actual.
    $("#bom-count").textContent = `${bomDone}/${BOM.length}`;
    // Llamada: ejecuta una accion del modulo actual.
    $("#build-step-count").textContent = `${stepsDone}/${BUILD_STEPS.length}`;

    const summary = $("#armado-summary");                                             // Referencia summary: nodo o coleccion DOM usada por la UI.
    if (!summary) return;                                                             // Condicion: valida estado antes de continuar el flujo.
    const totalDone = bomDone + stepsDone;                                            // Constante totalDone: constante usada en total done.
    const totalAll = BOM.length + BUILD_STEPS.length;                                 // Constante totalAll: constante usada en total all.
    const ready = totalDone === totalAll;                                             // Constante ready: constante usada en ready.
    summary.classList.toggle("ok", ready);                                            // Llamada: ejecuta una accion del modulo actual.
    summary.classList.toggle("warn", !ready && totalDone > 0);                        // Llamada: ejecuta una accion del modulo actual.
    summary.innerHTML = ready                                                         // Asignacion: actualiza estado o salida calculada.
      ? `<b>Armado completo.</b> Pasa a la fase Firmware.`
      : `Avance del armado: <b>${totalDone}/${totalAll}</b> elementos. Termina BOM y pasos antes de subir firmware.`;
  }

  function resetBuild() {                                                             // Funcion resetBuild: reinicia build.
    BOM.forEach((item) => { state.build.bom[item.key] = false; });                    // Llamada: ejecuta una accion del modulo actual.
    BUILD_STEPS.forEach((item) => { state.build.steps[item.key] = false; });          // Llamada: ejecuta una accion del modulo actual.
    renderBuild();                                                                    // Llamada: ejecuta una accion del modulo actual.
    renderReadiness();                                                                // Llamada: ejecuta una accion del modulo actual.
    markDirty();                                                                      // Llamada: ejecuta una accion del modulo actual.
    log("Progreso de armado reiniciado", "sys");                                      // Llamada: ejecuta una accion del modulo actual.
  }

  function markAllBuild() {                                                           // Funcion markAllBuild: encapsula la logica de interfaz tecnica.
    BOM.forEach((item) => { state.build.bom[item.key] = true; });                     // Llamada: ejecuta una accion del modulo actual.
    BUILD_STEPS.forEach((item) => { state.build.steps[item.key] = true; });           // Llamada: ejecuta una accion del modulo actual.
    renderBuild();                                                                    // Llamada: ejecuta una accion del modulo actual.
    renderReadiness();                                                                // Llamada: ejecuta una accion del modulo actual.
    markDirty();                                                                      // Llamada: ejecuta una accion del modulo actual.
    log("Armado marcado como completo", "ok");                                        // Llamada: ejecuta una accion del modulo actual.
  }

  /* ── Pruebas (tests) panel ─────────────────────────────────────── */
  function renderTests() {                                                            // Funcion renderTests: renderiza tests.
    const list = $("#test-list");                                                     // Referencia list: nodo o coleccion DOM usada por la UI.
    list.innerHTML = TEST_DEFS.map((item) => {                                        // Asignacion: actualiza estado o salida calculada.
      const result = state.tests[item.key] || { status: "idle" };                     // Constante result: constante usada en result.
      const klass = result.status === "pass" ? "pass"                                 // Constante klass: constante usada en klass.
                  : result.status === "fail" ? "fail"
                  : result.status === "run"  ? "run"
                  : "";
      const resultText = result.status === "pass" ? "PASA"                            // Constante resultText: constante usada en result text.
                       : result.status === "fail" ? "FALLA"
                       : result.status === "run"  ? "EN CURSO"
                       : "SIN CORRER";
      // Retorno: entrega el resultado al llamador.
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
    list.addEventListener("click", (event) => {                                       // Llamada: ejecuta una accion del modulo actual.
      const button = event.target.closest("button[data-test-key]");                   // Constante button: constante usada en button.
      if (!button) return;                                                            // Condicion: valida estado antes de continuar el flujo.
      runTest(button.dataset.testKey);                                                // Llamada: ejecuta una accion del modulo actual.
    });
    updateTestSummary();                                                              // Llamada: ejecuta una accion del modulo actual.
  }

  function updateTestSummary() {                                                      // Funcion updateTestSummary: actualiza test summary.
    const total = TEST_DEFS.length;                                                   // Constante total: constante usada en total.
    const passed = TEST_DEFS.filter((item) => state.tests[item.key]?.status === "pass").length; // Constante passed: constante usada en passed.
    const failed = TEST_DEFS.filter((item) => state.tests[item.key]?.status === "fail").length; // Constante failed: constante usada en failed.
    // Llamada: ejecuta una accion del modulo actual.
    $("#tests-summary").textContent = `${passed}/${total}${failed ? ` (${failed} fallan)` : ""}`;
    $("#tests-last-run").textContent = state.lastTestRunAt                            // Llamada: ejecuta una accion del modulo actual.
      ? `Ultima corrida ${new Date(state.lastTestRunAt).toLocaleTimeString("es-MX")}`
      : "Sin ejecuciones";
    renderReadiness();                                                                // Llamada: ejecuta una accion del modulo actual.
  }

  function setTestState(key, status, message = "") {                                  // Funcion setTestState: asigna test state.
    const previous = state.tests[key] || {};                                          // Constante previous: constante usada en previous.
    state.tests[key] = {
      status,
      at: status === "idle" ? null : new Date().toISOString(),                        // Campo at: campo de datos para at.
      message: message || previous.message || ""                                      // Campo message: campo de datos para message.
    };
    // Referencia row: nodo o coleccion DOM usada por la UI.
    const row = $(`[data-test-row="${key}"]`);
    if (row) {                                                                        // Condicion: valida estado antes de continuar el flujo.
      row.classList.remove("pass", "fail", "run");                                    // Llamada: ejecuta una accion del modulo actual.
      if (status === "pass" || status === "fail" || status === "run") row.classList.add(status); // Condicion: valida estado antes de continuar el flujo.
    }
    // Referencia result: nodo o coleccion DOM usada por la UI.
    const result = $(`#test-result-${key}`);
    if (result) {                                                                     // Condicion: valida estado antes de continuar el flujo.
      result.textContent = status === "pass" ? "PASA"                                 // Asignacion: actualiza estado o salida calculada.
                         : status === "fail" ? "FALLA"
                         : status === "run"  ? "EN CURSO"
                         : "SIN CORRER";
    }
    if (status !== "run") updateTestSummary();                                        // Condicion: valida estado antes de continuar el flujo.
  }

  function appendTestLog(line) {                                                      // Funcion appendTestLog: encapsula la logica de diagnostico y pruebas.
    const node = $("#test-log");                                                      // Referencia node: nodo o coleccion DOM usada por la UI.
    if (!node) return;                                                                // Condicion: valida estado antes de continuar el flujo.
    const stamp = new Date().toLocaleTimeString("es-MX");                             // Constante stamp: constante usada en stamp.
    node.textContent += `[${stamp}] ${line}\n`;
    node.scrollTop = node.scrollHeight;                                               // Asignacion: actualiza estado o salida calculada.
  }

  function resetTests() {                                                             // Funcion resetTests: reinicia tests.
    TEST_DEFS.forEach((item) => setTestState(item.key, "idle"));                      // Llamada: ejecuta una accion del modulo actual.
    state.lastTestRunAt = null;                                                       // Asignacion: actualiza estado o salida calculada.
    $("#test-log").textContent = "";                                                  // Llamada: ejecuta una accion del modulo actual.
    appendTestLog("Resultados borrados");                                             // Llamada: ejecuta una accion del modulo actual.
    markDirty();                                                                      // Llamada: ejecuta una accion del modulo actual.
    updateTestSummary();                                                              // Llamada: ejecuta una accion del modulo actual.
  }

  async function runAllTests() {                                                      // Funcion runAllTests: encapsula la logica de diagnostico y pruebas.
    if (!ws || ws.readyState !== WebSocket.OPEN) {                                    // Condicion: valida estado antes de continuar el flujo.
      appendTestLog("ESP32-S3 offline. Conecta antes de correr la suite.");           // Llamada: ejecuta una accion del modulo actual.
      log("Suite cancelada: ESP32-S3 offline", "err");                                // Llamada: ejecuta una accion del modulo actual.
      return;                                                                         // Retorno: entrega el resultado al llamador.
    }
    state.testRuns += 1;
    state.lastTestRunAt = new Date().toISOString();                                   // Asignacion: actualiza estado o salida calculada.
    // Llamada: ejecuta una accion del modulo actual.
    appendTestLog(`Suite ${state.testRuns}: inicio`);
    for (const def of TEST_DEFS) {                                                    // Bucle: recorre datos o reintenta una operacion controlada.
      // eslint-disable-next-line no-await-in-loop
      await runTest(def.key, { silent: true });                                       // Espera asincrona: coordina una operacion externa.
    }
    // Llamada: ejecuta una accion del modulo actual.
    appendTestLog(`Suite ${state.testRuns}: fin`);
    markDirty();                                                                      // Llamada: ejecuta una accion del modulo actual.
    updateTestSummary();                                                              // Llamada: ejecuta una accion del modulo actual.
  }

  async function runTest(key, options = {}) {                                         // Funcion runTest: encapsula la logica de diagnostico y pruebas.
    const def = TEST_DEFS.find((item) => item.key === key);                           // Constante def: constante usada en def.
    if (!def) return;                                                                 // Condicion: valida estado antes de continuar el flujo.
    if (!ws || ws.readyState !== WebSocket.OPEN) {                                    // Condicion: valida estado antes de continuar el flujo.
      setTestState(key, "fail", "ESP32-S3 offline");                                  // Llamada: ejecuta una accion del modulo actual.
      // Llamada: ejecuta una accion del modulo actual.
      appendTestLog(`${def.label}: ESP32-S3 offline`);
      return;                                                                         // Retorno: entrega el resultado al llamador.
    }
    setTestState(key, "run");                                                         // Llamada: ejecuta una accion del modulo actual.
    // Llamada: ejecuta una accion del modulo actual.
    appendTestLog(`${def.label}: ejecutando`);
    try {                                                                             // Bloque try: ejecuta una operacion que puede fallar.
      const detail = await executeTest(key);                                          // Constante detail: constante usada en detail.
      setTestState(key, "pass", detail);                                              // Llamada: ejecuta una accion del modulo actual.
      // Llamada: ejecuta una accion del modulo actual.
      appendTestLog(`${def.label}: OK${detail ? ` (${detail})` : ""}`);
    } catch (error) {
      setTestState(key, "fail", error.message || String(error));                      // Llamada: ejecuta una accion del modulo actual.
      // Llamada: ejecuta una accion del modulo actual.
      appendTestLog(`${def.label}: FALLA — ${error.message || error}`);
    }
    if (!options.silent) {                                                            // Condicion: valida estado antes de continuar el flujo.
      markDirty();                                                                    // Llamada: ejecuta una accion del modulo actual.
      updateTestSummary();                                                            // Llamada: ejecuta una accion del modulo actual.
    }
  }

  function awaitPacket(predicate, { timeoutMs = 1500 } = {}) {                        // Funcion awaitPacket: encapsula la logica de await packet.
    return new Promise((resolve, reject) => {                                         // Retorno: entrega el resultado al llamador.
      let resolved = false;                                                           // Estado resolved: estado mutable de resolved.
      const timer = setTimeout(() => {                                                // Constante timer: constante usada en timer.
        if (resolved) return;                                                         // Condicion: valida estado antes de continuar el flujo.
        resolved = true;                                                              // Asignacion: actualiza estado o salida calculada.
        document.removeEventListener("vesta-rx", listener);                           // Llamada: ejecuta una accion del modulo actual.
        reject(new Error("timeout"));                                                 // Llamada: ejecuta una accion del modulo actual.
      }, timeoutMs);
      const listener = (event) => {                                                   // Funcion flecha listener: encapsula la logica de listener.
        if (resolved) return;                                                         // Condicion: valida estado antes de continuar el flujo.
        const packet = event.detail;                                                  // Constante packet: constante usada en packet.
        if (!predicate(packet)) return;                                               // Condicion: valida estado antes de continuar el flujo.
        resolved = true;                                                              // Asignacion: actualiza estado o salida calculada.
        clearTimeout(timer);                                                          // Llamada: ejecuta una accion del modulo actual.
        document.removeEventListener("vesta-rx", listener);                           // Llamada: ejecuta una accion del modulo actual.
        resolve(packet);                                                              // Llamada: ejecuta una accion del modulo actual.
      };
      document.addEventListener("vesta-rx", listener);                                // Llamada: ejecuta una accion del modulo actual.
    });
  }

  function delay(ms) {                                                                // Funcion delay: encapsula la logica de delay.
    return new Promise((resolve) => setTimeout(resolve, ms));                         // Retorno: entrega el resultado al llamador.
  }

  async function executeTest(key) {                                                   // Funcion executeTest: encapsula la logica de diagnostico y pruebas.
    if (key === "ws-link") {                                                          // Condicion: valida estado antes de continuar el flujo.
      sendCommand({ type: "cmd_status" }, "Status");                                  // Llamada: ejecuta una accion del modulo actual.
      const pkt = await awaitPacket((p) => p && (p.type === "ack" || p.type === "sensors"), { timeoutMs: 1500 }); // Constante pkt: constante usada en pkt.
      return pkt.type;                                                                // Retorno: entrega el resultado al llamador.
    }
    if (key === "ack-firmware") {                                                     // Condicion: valida estado antes de continuar el flujo.
      sendCommand({ type: "cmd_status" }, "Status");                                  // Llamada: ejecuta una accion del modulo actual.
      const pkt = await awaitPacket((p) => p && p.type === "ack", { timeoutMs: 1500 }); // Constante pkt: constante usada en pkt.
      if (!pkt.fw) throw new Error("ACK sin campo fw");                               // Condicion: valida estado antes de continuar el flujo.
      return pkt.fw;                                                                  // Retorno: entrega el resultado al llamador.
    }
    if (key === "estop-clear") {                                                      // Condicion: valida estado antes de continuar el flujo.
      sendCommand({ type: "cmd_reset" }, "Reset");                                    // Llamada: ejecuta una accion del modulo actual.
      const pkt = await awaitPacket((p) => p && p.type === "sensors" && !p.emergency, { timeoutMs: 1800 }); // Constante pkt: constante usada en pkt.
      // Retorno: entrega el resultado al llamador.
      return `mode=${pkt.mode || "?"}`;
    }
    if (key === "mode-manual" || key === "mode-assisted" || key === "mode-auto") {    // Condicion: valida estado antes de continuar el flujo.
      const target = key === "mode-manual" ? "manual" : key === "mode-assisted" ? "assisted" : "automatic"; // Constante target: constante usada en target.
      // Llamada: ejecuta una accion del modulo actual.
      sendCommand({ type: "cmd_mode", mode: target }, `Modo ${target}`);
      const pkt = await awaitPacket((p) => p && p.type === "sensors" && p.mode === target, { timeoutMs: 1800 }); // Constante pkt: constante usada en pkt.
      // Retorno: entrega el resultado al llamador.
      return `mode=${pkt.mode}`;
    }
    if (key.startsWith("servo-sweep-")) {                                             // Condicion: valida estado antes de continuar el flujo.
      const map = {                                                                   // Objeto map: objeto de configuracion para map.
        "servo-sweep-l-lat": 0,                                                       // Campo servo-sweep-l-lat: campo de datos para control angular de servos.
        "servo-sweep-l-fro": 1,                                                       // Campo servo-sweep-l-fro: campo de datos para control angular de servos.
        "servo-sweep-l-elb": 2,                                                       // Campo servo-sweep-l-elb: campo de datos para control angular de servos.
        "servo-sweep-r-lat": 3,                                                       // Campo servo-sweep-r-lat: campo de datos para control angular de servos.
        "servo-sweep-r-fro": 4,                                                       // Campo servo-sweep-r-fro: campo de datos para control angular de servos.
        "servo-sweep-r-elb": 5                                                        // Campo servo-sweep-r-elb: campo de datos para control angular de servos.
      };
      const id = map[key];                                                            // Constante id: constante usada en id.
      const servo = state.servos.find((item) => item.id === id);                      // Constante servo: constante usada en control angular de servos.
      // Condicion: valida estado antes de continuar el flujo.
      if (!servo) throw new Error(`servo ${id} ausente`);
      sendCommand({ type: "cmd_mode", mode: "manual" }, "Modo manual");               // Llamada: ejecuta una accion del modulo actual.
      sendAngle(servo.id, servo.homeAngle);                                           // Llamada: ejecuta una accion del modulo actual.
      await delay(220);                                                               // Espera asincrona: coordina una operacion externa.
      sendAngle(servo.id, servo.maxAngle);                                            // Llamada: ejecuta una accion del modulo actual.
      const reachedMax = await awaitPacket((p) => {                                   // Constante reachedMax: constante usada en reached max.
        if (!p || p.type !== "sensors") return false;                                 // Condicion: valida estado antes de continuar el flujo.
        const live = (p.servos || []).find((s) => Number(s.id) === id);               // Constante live: constante usada en live.
        return live && Math.abs((live.target ?? live.angle ?? 0) - servo.maxAngle) < 2.5; // Retorno: entrega el resultado al llamador.
      }, { timeoutMs: 2000 }).catch(() => null);
      sendAngle(servo.id, servo.homeAngle);                                           // Llamada: ejecuta una accion del modulo actual.
      const reachedHome = await awaitPacket((p) => {                                  // Constante reachedHome: constante usada en reached home.
        if (!p || p.type !== "sensors") return false;                                 // Condicion: valida estado antes de continuar el flujo.
        const live = (p.servos || []).find((s) => Number(s.id) === id);               // Constante live: constante usada en live.
        return live && Math.abs((live.target ?? live.angle ?? 0) - servo.homeAngle) < 2.5; // Retorno: entrega el resultado al llamador.
      }, { timeoutMs: 2000 }).catch(() => null);
      if (!reachedMax && !reachedHome) throw new Error("sin respuesta de telemetria"); // Condicion: valida estado antes de continuar el flujo.
      // Retorno: entrega el resultado al llamador.
      return `home<->max ${formatDeg(servo.maxAngle)}`;
    }
    if (key === "imu-live") {                                                         // Condicion: valida estado antes de continuar el flujo.
      const pkt = await awaitPacket((p) => p && p.type === "sensors" && Array.isArray(p.servos), { timeoutMs: 1800 }); // Constante pkt: constante usada en pkt.
      const expectedIds = state.imus.map((imu) => imu.servoId);                       // Constante expectedIds: constante usada en expected ids.
      const issues = [];                                                              // Arreglo issues: arreglo de datos para issues.
      for (const imu of state.imus) {                                                 // Bucle: recorre datos o reintenta una operacion controlada.
        const live = (pkt.servos || []).find((s) => Number(s.id) === imu.servoId);    // Constante live: constante usada en live.
        const sensor = Number(live?.sensor);                                          // Constante sensor: constante usada en sensor.
        // Condicion: valida estado antes de continuar el flujo.
        if (!Number.isFinite(sensor)) issues.push(`${imu.label} sin valor`);
      }
      if (issues.length) throw new Error(issues.join(" | "));                         // Condicion: valida estado antes de continuar el flujo.
      // Retorno: entrega el resultado al llamador.
      return `${expectedIds.length} IMUs activos`;
    }
    if (key === "as5600-live") {                                                      // Condicion: valida estado antes de continuar el flujo.
      const pkt = await awaitPacket((p) => p && p.type === "sensors" && Array.isArray(p.servos), { timeoutMs: 1800 }); // Constante pkt: constante usada en pkt.
      const issues = [];                                                              // Arreglo issues: arreglo de datos para issues.
      for (const sensor of state.as5600) {                                            // Bucle: recorre datos o reintenta una operacion controlada.
        const live = (pkt.servos || []).find((s) => Number(s.id) === sensor.servoId); // Constante live: constante usada en live.
        const sensorValue = Number(live?.sensor);                                     // Constante sensorValue: lectura reportada por telemetria.
        // Condicion: valida estado antes de continuar el flujo.
        if (!Number.isFinite(sensorValue)) issues.push(`${sensor.label} sin valor`);
      }
      if (issues.length) throw new Error(issues.join(" | "));                         // Condicion: valida estado antes de continuar el flujo.
      return "2 AS5600 activos";                                                      // Retorno: entrega el resultado al llamador.
    }
    if (key === "estop-trigger") {                                                    // Condicion: valida estado antes de continuar el flujo.
      sendCommand({ type: "cmd_stop" }, "STOP");                                      // Llamada: ejecuta una accion del modulo actual.
      const pkt = await awaitPacket((p) => p && p.type === "sensors" && p.emergency, { timeoutMs: 1800 }); // Constante pkt: constante usada en pkt.
      // dejar el sistema en estado seguro despues
      sendCommand({ type: "cmd_reset" }, "Reset post-test");                          // Llamada: ejecuta una accion del modulo actual.
      // Retorno: entrega el resultado al llamador.
      return `emergency=${pkt.emergency}`;
    }
    throw new Error("test no implementado");
  }

  /* ── Readiness gate (Entrega) ──────────────────────────────────── */
  function renderReadiness() {                                                        // Funcion renderReadiness: renderiza readiness.
    const wrap = $("#readiness-gate");                                                // Referencia wrap: nodo o coleccion DOM usada por la UI.
    if (!wrap) return;                                                                // Condicion: valida estado antes de continuar el flujo.

    const bomDone = BOM.filter((item) => state.build.bom[item.key]).length;           // Constante bomDone: constante usada en armado y lista de materiales.
    const stepsDone = BUILD_STEPS.filter((item) => state.build.steps[item.key]).length; // Constante stepsDone: constante usada en steps done.
    const buildOk = bomDone === BOM.length && stepsDone === BUILD_STEPS.length;       // Constante buildOk: constante usada en interfaz tecnica.

    const fwS3 = Boolean(state.firmware?.s3?.code);                                   // Constante fwS3: constante usada en comunicaciones y puertos.
    const fwCam = Boolean(state.firmware?.cam?.code);                                 // Constante fwCam: constante usada en camara y video.
    const fwOk = fwS3 && fwCam;                                                       // Constante fwOk: constante usada en fw ok.

    const hwDone = HARDWARE_CHECKS.filter((item) => state.hardwareChecks[item.key]).length; // Constante hwDone: constante usada en hw done.
    const hwOk = hwDone === HARDWARE_CHECKS.length;                                   // Constante hwOk: constante usada en hw ok.

    const servosOk = state.servos.every((servo) => servo.maxAngle > servo.minAngle && servo.pwmAt0 !== servo.pwmAt270); // Constante servosOk: constante usada en control angular de servos.
    const sensorsOk = state.imus.every((imu) => imu.maxDeg > imu.minDeg) &&           // Constante sensorsOk: constante usada en sensors ok.
      state.as5600.every((sensor) => sensor.raw0 !== sensor.raw90);                   // Llamada: ejecuta una accion del modulo actual.

    // Constante testsRun: constante usada en diagnostico y pruebas.
    const testsRun = TEST_DEFS.filter((item) => state.tests[item.key]?.status === "pass" || state.tests[item.key]?.status === "fail").length;
    const testsPass = TEST_DEFS.filter((item) => state.tests[item.key]?.status === "pass").length; // Constante testsPass: constante usada en diagnostico y pruebas.
    const testsFail = TEST_DEFS.filter((item) => state.tests[item.key]?.status === "fail").length; // Constante testsFail: constante usada en diagnostico y pruebas.
    const testsOk = testsPass === TEST_DEFS.length;                                   // Constante testsOk: constante usada en diagnostico y pruebas.

    const metaOk = Boolean(state.metadata.serial && state.metadata.technician);       // Constante metaOk: constante usada en meta ok.

    const phases = [                                                                  // Arreglo phases: arreglo de datos para phases.
      // Elemento: entrada de objeto dentro de una lista de datos.
      { label: "Armado", value: buildOk ? "OK" : `${bomDone + stepsDone}/${BOM.length + BUILD_STEPS.length}`, ok: buildOk },
      { label: "Firmware", value: fwOk ? "Cargado" : fwS3 ? "Falta CAM" : fwCam ? "Falta S3" : "Pendiente", ok: fwOk }, // Elemento: entrada de objeto dentro de una lista de datos.
      // Elemento: entrada de objeto dentro de una lista de datos.
      { label: "Diagnostico", value: hwOk ? "OK" : `${hwDone}/${HARDWARE_CHECKS.length}`, ok: hwOk },
      { label: "Servos", value: servosOk ? "Calibrados" : "Revisar", ok: servosOk },  // Elemento: entrada de objeto dentro de una lista de datos.
      { label: "Sensores", value: sensorsOk ? "Calibrados" : "Revisar", ok: sensorsOk }, // Elemento: entrada de objeto dentro de una lista de datos.
      {                                                                               // Elemento: entrada de objeto dentro de una lista de datos.
        label: "Pruebas",                                                             // Campo label: campo de datos para label.
        // Campo value: campo de datos para value.
        value: testsRun === 0 ? "Sin correr" : testsOk ? "Todas OK" : `${testsPass}/${TEST_DEFS.length}${testsFail ? ` (${testsFail} fallan)` : ""}`,
        ok: testsOk,                                                                  // Campo ok: campo de datos para ok.
        warn: testsRun > 0 && !testsOk                                                // Campo warn: campo de datos para warn.
      },
      { label: "Metadatos", value: metaOk ? "Serie y tecnico" : "Falta serie o tecnico", ok: metaOk } // Elemento: entrada de objeto dentro de una lista de datos.
    ];

    const allOk = phases.every((p) => p.ok);                                          // Constante allOk: constante usada en all ok.
    const someFail = phases.some((p) => !p.ok && (p.warn === true || p.label === "Pruebas")); // Constante someFail: constante usada en some fail.

    const tiles = phases.map((phase) => {                                             // Constante tiles: constante usada en tiles.
      const klass = phase.ok ? "ok" : phase.warn ? "warn" : "fail";                   // Constante klass: constante usada en klass.
      // Retorno: entrega el resultado al llamador.
      return `
        <div class="readiness-tile ${klass}">
          <span class="label">${escapeHtml(phase.label)}</span>
          <span class="value">${escapeHtml(phase.value)}</span>
        </div>
      `;
    }).join("");

    const banner = allOk                                                              // Constante banner: constante usada en banner.
      ? `<div class="readiness-banner ok">Listo para entrega. Genera y envia el perfil.</div>`
      : someFail
        ? `<div class="readiness-banner warn">Corrige las pruebas que fallan antes de entregar.</div>`
        : `<div class="readiness-banner fail">Termina las fases pendientes antes de generar el perfil.</div>`;

    // Asignacion: actualiza estado o salida calculada.
    wrap.innerHTML = `${tiles}${banner}`;

    const sendBtn = $("#btn-send-profile");                                           // Referencia sendBtn: nodo o coleccion DOM usada por la UI.
    if (sendBtn) {                                                                    // Condicion: valida estado antes de continuar el flujo.
      sendBtn.classList.toggle("primary", allOk);                                     // Llamada: ejecuta una accion del modulo actual.
      sendBtn.disabled = !allOk;                                                      // Asignacion: actualiza estado o salida calculada.
      sendBtn.title = allOk ? "Enviar perfil al ESP32-S3" : "Termina todas las fases para enviar"; // Asignacion: actualiza estado o salida calculada.
    }
  }

  function renderServoTable() {                                                       // Funcion renderServoTable: renderiza servo table.
    const body = $("#servo-table-body");                                              // Referencia body: nodo o coleccion DOM usada por la UI.
    // Asignacion: actualiza estado o salida calculada.
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

    body.addEventListener("input", onServoInput);                                     // Llamada: ejecuta una accion del modulo actual.
    body.addEventListener("change", onServoInput);                                    // Llamada: ejecuta una accion del modulo actual.
    body.addEventListener("click", onServoAction);                                    // Llamada: ejecuta una accion del modulo actual.
  }

  function onServoInput(event) {                                                      // Funcion onServoInput: encapsula la logica de control angular de servos.
    const servoId = Number(event.target.dataset.servo);                               // Constante servoId: constante usada en control angular de servos.
    const field = event.target.dataset.field;                                         // Constante field: constante usada en field.
    if (!Number.isFinite(servoId) || !field) return;                                  // Condicion: valida estado antes de continuar el flujo.
    const servo = state.servos.find((item) => item.id === servoId);                   // Constante servo: constante usada en control angular de servos.
    if (!servo) return;                                                               // Condicion: valida estado antes de continuar el flujo.
    const value = field === "direction" ? Number(event.target.value) : numberValue(event.target.value, servo[field]); // Constante value: constante usada en value.
    servo[field] = value;
    if (field === "minAngle" || field === "maxAngle") updateServoRange(servo);        // Condicion: valida estado antes de continuar el flujo.
    if (field === "testAngle") {                                                      // Condicion: valida estado antes de continuar el flujo.
      applyManualTarget(servo, servo.testAngle, true);                                // Llamada: ejecuta una accion del modulo actual.
    }
    markDirty();                                                                      // Llamada: ejecuta una accion del modulo actual.
    updateLive();                                                                     // Llamada: ejecuta una accion del modulo actual.
  }

  function updateServoRange(servo) {                                                  // Funcion updateServoRange: actualiza servo range.
    servo.minAngle = clamp(servo.minAngle, 0, 270);                                   // Asignacion: actualiza estado o salida calculada.
    servo.maxAngle = clamp(servo.maxAngle, servo.minAngle + 1, 270);                  // Asignacion: actualiza estado o salida calculada.
    servo.homeAngle = clamp(servo.homeAngle, servo.minAngle, servo.maxAngle);         // Asignacion: actualiza estado o salida calculada.
    servo.testAngle = clamp(servo.testAngle, servo.minAngle, servo.maxAngle);         // Asignacion: actualiza estado o salida calculada.
    // Referencia slider: nodo o coleccion DOM usada por la UI.
    const slider = $(`input[data-servo="${servo.id}"][data-field="testAngle"]`);
    if (slider) {                                                                     // Condicion: valida estado antes de continuar el flujo.
      slider.min = String(servo.minAngle);                                            // Asignacion: actualiza estado o salida calculada.
      slider.max = String(servo.maxAngle);                                            // Asignacion: actualiza estado o salida calculada.
      slider.value = String(servo.testAngle);                                         // Asignacion: actualiza estado o salida calculada.
    }
    syncManualSlider(servo);                                                          // Llamada: ejecuta una accion del modulo actual.
  }

  function onServoAction(event) {                                                     // Funcion onServoAction: encapsula la logica de control angular de servos.
    const action = event.target.closest("button")?.dataset.servoAction;               // Constante action: constante usada en action.
    if (!action) return;                                                              // Condicion: valida estado antes de continuar el flujo.
    const servoId = Number(event.target.closest("button").dataset.servoId);           // Constante servoId: constante usada en control angular de servos.
    const servo = state.servos.find((item) => item.id === servoId);                   // Constante servo: constante usada en control angular de servos.
    if (!servo) return;                                                               // Condicion: valida estado antes de continuar el flujo.
    if (action === "test") {                                                          // Condicion: valida estado antes de continuar el flujo.
      sendAngle(servo.id, servo.testAngle);                                           // Llamada: ejecuta una accion del modulo actual.
    } else if (action === "home") {
      sendAngle(servo.id, servo.homeAngle);                                           // Llamada: ejecuta una accion del modulo actual.
    }
  }

  /* === Manual panel: live per-servo control =========================== */

  function renderManualPanel() {                                                      // Funcion renderManualPanel: renderiza manual panel.
    const wrap = $("#manual-controls");                                               // Referencia wrap: nodo o coleccion DOM usada por la UI.
    if (!wrap) return;                                                                // Condicion: valida estado antes de continuar el flujo.
    // Asignacion: actualiza estado o salida calculada.
    wrap.innerHTML = state.servos.map((servo) => `
      <div class="manual-card" data-manual-card="${servo.id}">
        <div class="manual-card-head">
          <div class="meta">
            <strong>${servo.label}</strong>
            <small>${servo.short} &middot; canal ${servo.channel} &middot; ${servo.movement}</small>
          </div>
          <div class="manual-card-actions">
            <button class="btn" data-manual-action="home" data-manual-id="${servo.id}" title="Llevar a home">Home</button>
            <button class="btn" data-manual-action="min" data-manual-id="${servo.id}" title="Ir al limite inferior">Min</button>
            <button class="btn" data-manual-action="max" data-manual-id="${servo.id}" title="Ir al limite superior">Max</button>
          </div>
        </div>
        <input type="range" class="manual-slider"
               data-manual-id="${servo.id}"
               min="${servo.minAngle}" max="${servo.maxAngle}" step="1"
               value="${servo.testAngle}"
               aria-label="Angulo objetivo ${servo.short}">
        <div class="manual-readout">
          <div>
            <span>Objetivo</span>
            <b id="manual-target-${servo.id}">${formatDeg(servo.testAngle)}</b>
          </div>
          <div>
            <span>Real</span>
            <b id="manual-live-${servo.id}">${formatDeg(servo.liveAngle)}</b>
          </div>
          <div class="delta" id="manual-delta-wrap-${servo.id}">
            <span>Delta</span>
            <b id="manual-delta-${servo.id}">0</b>
          </div>
          <div>
            <span>Rango</span>
            <b id="manual-range-${servo.id}">${servo.minAngle}-${servo.maxAngle}</b>
          </div>
        </div>
      </div>
    `).join("");
  }

  function bindManualPanel() {                                                        // Funcion bindManualPanel: conecta eventos de manual panel.
    const wrap = $("#manual-controls");                                               // Referencia wrap: nodo o coleccion DOM usada por la UI.
    if (wrap) {                                                                       // Condicion: valida estado antes de continuar el flujo.
      wrap.addEventListener("input", onManualSlider);                                 // Llamada: ejecuta una accion del modulo actual.
      wrap.addEventListener("change", onManualSlider);                                // Llamada: ejecuta una accion del modulo actual.
      wrap.addEventListener("click", onManualAction);                                 // Llamada: ejecuta una accion del modulo actual.
    }
    const stopBtn = $("#btn-manual-stop");                                            // Referencia stopBtn: nodo o coleccion DOM usada por la UI.
    if (stopBtn) stopBtn.addEventListener("click", () => sendCommand({ type: "cmd_stop" }, "STOP manual")); // Condicion: valida estado antes de continuar el flujo.
    const manualArmBtn = $("#btn-manual-arm");                                        // Referencia manualArmBtn: boton de armado seguro en panel manual.
    if (manualArmBtn) manualArmBtn.addEventListener("click", () => sendCommand({ type: "cmd_arm" }, "Armar servos")); // Condicion: valida estado antes de continuar el flujo.
    const manualDisarmBtn = $("#btn-manual-disarm");                                  // Referencia manualDisarmBtn: boton para liberar PWM en panel manual.
    if (manualDisarmBtn) manualDisarmBtn.addEventListener("click", () => sendCommand({ type: "cmd_disarm" }, "Desarmar servos")); // Condicion: valida estado antes de continuar el flujo.
    const modeBtn = $("#btn-manual-mode-only");                                       // Referencia modeBtn: nodo o coleccion DOM usada por la UI.
    if (modeBtn) modeBtn.addEventListener("click", () => requestMode("manual", "Modo manual")); // Condicion: valida estado antes de continuar el flujo.
    const modeAssistedManualBtn = $("#btn-manual-mode-assisted");                     // Referencia modeAssistedManualBtn: nodo o coleccion DOM usada por la UI.
    if (modeAssistedManualBtn) modeAssistedManualBtn.addEventListener("click", () => requestMode("assisted", "Modo asistido")); // Condicion: valida estado antes de continuar el flujo.
    const modeAutoManualBtn = $("#btn-manual-mode-automatic");                        // Referencia modeAutoManualBtn: nodo o coleccion DOM usada por la UI.
    if (modeAutoManualBtn) modeAutoManualBtn.addEventListener("click", () => requestMode("automatic", "Modo automatico")); // Condicion: valida estado antes de continuar el flujo.
    const homeAllBtn = $("#btn-manual-home-all");                                     // Referencia homeAllBtn: nodo o coleccion DOM usada por la UI.
    if (homeAllBtn) homeAllBtn.addEventListener("click", manualHomeAll);              // Condicion: valida estado antes de continuar el flujo.
    const sweepBtn = $("#btn-manual-sweep-all");                                      // Referencia sweepBtn: nodo o coleccion DOM usada por la UI.
    if (sweepBtn) sweepBtn.addEventListener("click", manualSweepAll);                 // Condicion: valida estado antes de continuar el flujo.
  }

  function onManualSlider(event) {                                                    // Funcion onManualSlider: encapsula la logica de on manual slider.
    const slider = event.target.closest(".manual-slider");                            // Constante slider: constante usada en slider.
    if (!slider) return;                                                              // Condicion: valida estado antes de continuar el flujo.
    const id = Number(slider.dataset.manualId);                                       // Constante id: constante usada en id.
    const servo = state.servos.find((item) => item.id === id);                        // Constante servo: constante usada en control angular de servos.
    if (!servo) return;                                                               // Condicion: valida estado antes de continuar el flujo.
    const value = clamp(numberValue(slider.value, servo.testAngle), servo.minAngle, servo.maxAngle); // Constante value: constante usada en value.
    applyManualTarget(servo, value, true);                                            // Llamada: ejecuta una accion del modulo actual.
  }

  function onManualAction(event) {                                                    // Funcion onManualAction: encapsula la logica de on manual action.
    const btn = event.target.closest("[data-manual-action]");                         // Constante btn: constante usada en btn.
    if (!btn) return;                                                                 // Condicion: valida estado antes de continuar el flujo.
    const id = Number(btn.dataset.manualId);                                          // Constante id: constante usada en id.
    const servo = state.servos.find((item) => item.id === id);                        // Constante servo: constante usada en control angular de servos.
    if (!servo) return;                                                               // Condicion: valida estado antes de continuar el flujo.
    const action = btn.dataset.manualAction;                                          // Constante action: constante usada en action.
    if (action === "home") applyManualTarget(servo, servo.homeAngle, true);           // Condicion: valida estado antes de continuar el flujo.
    else if (action === "min") applyManualTarget(servo, servo.minAngle, true);        // Condicion alternativa: cubre una variante del flujo.
    else if (action === "max") applyManualTarget(servo, servo.maxAngle, true);        // Condicion alternativa: cubre una variante del flujo.
  }

  const manualSendThrottle = new Map();                                               // Mapa manualSendThrottle: objeto de configuracion para manual send throttle.

  function applyManualTarget(servo, value, send) {                                    // Funcion applyManualTarget: aplica manual target.
    const safe = clamp(value, servo.minAngle, servo.maxAngle);                        // Constante safe: constante usada en safe.
    servo.testAngle = round(safe, 1);                                                 // Asignacion: actualiza estado o salida calculada.

    // Update the manual UI (slider + readouts).
    const slider = $(`input.manual-slider[data-manual-id="${servo.id}"]`);
    if (slider && Number(slider.value) !== safe) slider.value = String(safe);         // Condicion: valida estado antes de continuar el flujo.
    // Referencia tgt: nodo o coleccion DOM usada por la UI.
    const tgt = $(`#manual-target-${servo.id}`);
    if (tgt) tgt.textContent = formatDeg(safe);                                       // Condicion: valida estado antes de continuar el flujo.
    refreshManualReadout(servo);                                                      // Llamada: ejecuta una accion del modulo actual.

    // Keep the Servos calibration table in sync.
    const tableSlider = $(`input[data-servo="${servo.id}"][data-field="testAngle"]`);
    if (tableSlider) tableSlider.value = String(safe);                                // Condicion: valida estado antes de continuar el flujo.
    // Referencia tableLabel: nodo o coleccion DOM usada por la UI.
    const tableLabel = $(`#test-label-${servo.id}`);
    if (tableLabel) tableLabel.textContent = formatDeg(safe);                         // Condicion: valida estado antes de continuar el flujo.

    if (send) {                                                                       // Condicion: valida estado antes de continuar el flujo.
      // Throttle network sends to ~25Hz per servo to avoid flooding the link
      // while the slider is being dragged. Always send the latest value.
      const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now(); // Constante now: constante usada en now.
      const entry = manualSendThrottle.get(servo.id) || { last: 0, pending: null };   // Constante entry: constante usada en entry.
      const minGap = 40;                                                              // Constante minGap: constante usada en min gap.
      if (now - entry.last >= minGap) {                                               // Condicion: valida estado antes de continuar el flujo.
        entry.last = now;                                                             // Asignacion: actualiza estado o salida calculada.
        if (entry.pending) { clearTimeout(entry.pending); entry.pending = null; }     // Condicion: valida estado antes de continuar el flujo.
        sendAngle(servo.id, safe);                                                    // Llamada: ejecuta una accion del modulo actual.
      } else {
        if (entry.pending) clearTimeout(entry.pending);                               // Condicion: valida estado antes de continuar el flujo.
        entry.pending = setTimeout(() => {                                            // Asignacion: actualiza estado o salida calculada.
          entry.last = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now(); // Asignacion: actualiza estado o salida calculada.
          entry.pending = null;                                                       // Asignacion: actualiza estado o salida calculada.
          sendAngle(servo.id, servo.testAngle);                                       // Llamada: ejecuta una accion del modulo actual.
        }, minGap - (now - entry.last));
      }
      manualSendThrottle.set(servo.id, entry);                                        // Llamada: ejecuta una accion del modulo actual.
      const last = $("#manual-hud-last");                                             // Referencia last: nodo o coleccion DOM usada por la UI.
      // Condicion: valida estado antes de continuar el flujo.
      if (last) last.textContent = `${servo.short} ${formatDeg(safe)}`;
    }
    queueDraw();                                                                      // Llamada: ejecuta una accion del modulo actual.
  }

  function syncManualSlider(servo) {                                                  // Funcion syncManualSlider: encapsula la logica de sync manual slider.
    // Referencia slider: nodo o coleccion DOM usada por la UI.
    const slider = $(`input.manual-slider[data-manual-id="${servo.id}"]`);
    if (slider) {                                                                     // Condicion: valida estado antes de continuar el flujo.
      slider.min = String(servo.minAngle);                                            // Asignacion: actualiza estado o salida calculada.
      slider.max = String(servo.maxAngle);                                            // Asignacion: actualiza estado o salida calculada.
      slider.value = String(servo.testAngle);                                         // Asignacion: actualiza estado o salida calculada.
    }
    // Referencia range: nodo o coleccion DOM usada por la UI.
    const range = $(`#manual-range-${servo.id}`);
    // Condicion: valida estado antes de continuar el flujo.
    if (range) range.textContent = `${servo.minAngle}-${servo.maxAngle}`;
    // Referencia tgt: nodo o coleccion DOM usada por la UI.
    const tgt = $(`#manual-target-${servo.id}`);
    if (tgt) tgt.textContent = formatDeg(servo.testAngle);                            // Condicion: valida estado antes de continuar el flujo.
    refreshManualReadout(servo);                                                      // Llamada: ejecuta una accion del modulo actual.
  }

  function refreshManualReadout(servo) {                                              // Funcion refreshManualReadout: encapsula la logica de refresh manual readout.
    // Referencia liveEl: nodo o coleccion DOM usada por la UI.
    const liveEl = $(`#manual-live-${servo.id}`);
    if (liveEl) liveEl.textContent = formatDeg(servo.liveAngle);                      // Condicion: valida estado antes de continuar el flujo.
    // Referencia deltaEl: nodo o coleccion DOM usada por la UI.
    const deltaEl = $(`#manual-delta-${servo.id}`);
    // Referencia deltaWrap: nodo o coleccion DOM usada por la UI.
    const deltaWrap = $(`#manual-delta-wrap-${servo.id}`);
    if (deltaEl) {                                                                    // Condicion: valida estado antes de continuar el flujo.
      const diff = round((servo.liveAngle ?? 0) - (servo.testAngle ?? 0), 1);         // Constante diff: constante usada en diff.
      // Asignacion: actualiza estado o salida calculada.
      deltaEl.textContent = `${diff > 0 ? "+" : ""}${diff}`;
      if (deltaWrap) {                                                                // Condicion: valida estado antes de continuar el flujo.
        deltaWrap.classList.remove("ok", "warn", "fail");                             // Llamada: ejecuta una accion del modulo actual.
        const abs = Math.abs(diff);                                                   // Constante abs: constante usada en abs.
        if (abs <= 1.5) deltaWrap.classList.add("ok");                                // Condicion: valida estado antes de continuar el flujo.
        else if (abs <= 5) deltaWrap.classList.add("warn");                           // Condicion alternativa: cubre una variante del flujo.
        else deltaWrap.classList.add("fail");                                         // Rama alternativa: maneja el caso restante del flujo.
      }
    }
    // Referencia card: nodo o coleccion DOM usada por la UI.
    const card = $(`[data-manual-card="${servo.id}"]`);
    if (card) card.classList.toggle("moving", Boolean(servo.moving));                 // Condicion: valida estado antes de continuar el flujo.
  }

  function updateManualLive() {                                                       // Funcion updateManualLive: actualiza manual live.
    if (!$("#manual-controls")) return;                                               // Condicion: valida estado antes de continuar el flujo.
    state.servos.forEach((servo) => refreshManualReadout(servo));                     // Llamada: ejecuta una accion del modulo actual.
  }

  function manualHomeAll() {                                                          // Funcion manualHomeAll: encapsula la logica de manual home all.
    sendCommand({ type: "cmd_mode", mode: "manual" }, "Modo manual");                 // Llamada: ejecuta una accion del modulo actual.
    state.servos.forEach((servo) => applyManualTarget(servo, servo.homeAngle, true)); // Llamada: ejecuta una accion del modulo actual.
  }

  function manualSweepAll() {                                                         // Funcion manualSweepAll: encapsula la logica de manual sweep all.
    sendCommand({ type: "cmd_mode", mode: "manual" }, "Modo manual");                 // Llamada: ejecuta una accion del modulo actual.
    state.servos.forEach((servo, idx) => {                                            // Llamada: ejecuta una accion del modulo actual.
      setTimeout(() => applyManualTarget(servo, servo.maxAngle, true), idx * 350);    // Llamada: ejecuta una accion del modulo actual.
      setTimeout(() => applyManualTarget(servo, servo.minAngle, true), idx * 350 + 1100); // Llamada: ejecuta una accion del modulo actual.
      setTimeout(() => applyManualTarget(servo, servo.homeAngle, true), idx * 350 + 2200); // Llamada: ejecuta una accion del modulo actual.
    });
  }

  function renderSensorCards() {                                                      // Funcion renderSensorCards: renderiza sensor cards.
    const imuGrid = $("#imu-grid");                                                   // Referencia imuGrid: nodo o coleccion DOM usada por la UI.
    // Asignacion: actualiza estado o salida calculada.
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

    const as5600Grid = $("#as5600-grid");                                             // Referencia as5600Grid: nodo o coleccion DOM usada por la UI.
    // Asignacion: actualiza estado o salida calculada.
    as5600Grid.innerHTML = state.as5600.map((sensor) => `
      <div class="sensor-card" data-sensor-card="${sensor.key}">
        <div class="sensor-title">
          <b>${sensor.label}</b>
          <span>AS5600 TCA ${sensor.channel}</span>
        </div>
        <div class="sensor-fields">
          <label><span class="small-label">Raw 0</span><input type="number" step="1" min="0" max="4095" data-as5600="${sensor.key}" data-field="raw0" value="${sensor.raw0}"></label>
          <label><span class="small-label">Raw 90</span><input type="number" step="1" min="0" max="4095" data-as5600="${sensor.key}" data-field="raw90" value="${sensor.raw90}"></label>
          <label><span class="small-label">Neutral</span><input type="number" step="0.1" data-as5600="${sensor.key}" data-field="neutralDeg" value="${sensor.neutralDeg}"></label>
          <label><span class="small-label">Dir</span><select data-as5600="${sensor.key}" data-field="invert"><option value="false" ${!sensor.invert ? "selected" : ""}>Normal</option><option value="true" ${sensor.invert ? "selected" : ""}>Invert</option></select></label>
        </div>
        <div class="action-row">
          <button class="btn" data-sensor-action="as5600-0" data-key="${sensor.key}">0 deg</button>
          <button class="btn" data-sensor-action="as5600-90" data-key="${sensor.key}">90 deg</button>
          <button class="btn" data-sensor-action="as5600-neutral" data-key="${sensor.key}">Neutral</button>
          <span class="small-label" id="live-${sensor.key}">Raw ${round(sensor.liveRaw, 0)}</span>
        </div>
      </div>
    `).join("");

    imuGrid.addEventListener("input", onImuInput);                                    // Llamada: ejecuta una accion del modulo actual.
    imuGrid.addEventListener("change", onImuInput);                                   // Llamada: ejecuta una accion del modulo actual.
    as5600Grid.addEventListener("input", onAs5600Input);                              // Llamada: ejecuta una accion del modulo actual.
    as5600Grid.addEventListener("change", onAs5600Input);                             // Llamada: ejecuta una accion del modulo actual.
    $("#panel-sensores").addEventListener("click", onSensorAction);                   // Llamada: ejecuta una accion del modulo actual.
  }

  function onImuInput(event) {                                                        // Funcion onImuInput: encapsula la logica de lectura de sensores IMU/I2C.
    const key = event.target.dataset.imu;                                             // Constante key: constante usada en key.
    const field = event.target.dataset.field;                                         // Constante field: constante usada en field.
    if (!key || !field) return;                                                       // Condicion: valida estado antes de continuar el flujo.
    const imu = state.imus.find((item) => item.key === key);                          // Constante imu: constante usada en lectura de sensores IMU/I2C.
    if (!imu) return;                                                                 // Condicion: valida estado antes de continuar el flujo.
    imu[field] = field === "invert" ? event.target.value === "true" : numberValue(event.target.value, imu[field]);
    markDirty();                                                                      // Llamada: ejecuta una accion del modulo actual.
    updateLive();                                                                     // Llamada: ejecuta una accion del modulo actual.
  }

  function onAs5600Input(event) {                                                     // Funcion onAs5600Input: encapsula la logica de sensores AS5600.
    const key = event.target.dataset.as5600;                                          // Constante key: constante usada en key.
    const field = event.target.dataset.field;                                         // Constante field: constante usada en field.
    if (!key || !field) return;                                                       // Condicion: valida estado antes de continuar el flujo.
    const sensor = state.as5600.find((item) => item.key === key);                     // Constante sensor: sensor AS5600 seleccionado.
    if (!sensor) return;                                                              // Condicion: valida estado antes de continuar el flujo.
    sensor[field] = field === "invert" ? event.target.value === "true" : numberValue(event.target.value, sensor[field]);
    markDirty();                                                                      // Llamada: ejecuta una accion del modulo actual.
    updateLive();                                                                     // Llamada: ejecuta una accion del modulo actual.
  }

  function onSensorAction(event) {                                                    // Funcion onSensorAction: encapsula la logica de on sensor action.
    const button = event.target.closest("button[data-sensor-action]");                // Constante button: constante usada en button.
    if (!button) return;                                                              // Condicion: valida estado antes de continuar el flujo.
    const action = button.dataset.sensorAction;                                       // Constante action: constante usada en action.
    const key = button.dataset.key;                                                   // Constante key: constante usada en key.
    const imu = state.imus.find((item) => item.key === key);                          // Constante imu: constante usada en lectura de sensores IMU/I2C.
    const as5600 = state.as5600.find((item) => item.key === key);                     // Constante as5600: sensor magnetico de codo.

    if (imu) {                                                                        // Condicion: valida estado antes de continuar el flujo.
      if (action === "imu-neutral") imu.neutralDeg = round(imu.liveDeg, 1);           // Condicion: valida estado antes de continuar el flujo.
      if (action === "imu-min") imu.minDeg = round(imu.liveDeg, 1);                   // Condicion: valida estado antes de continuar el flujo.
      if (action === "imu-max") imu.maxDeg = round(imu.liveDeg, 1);                   // Condicion: valida estado antes de continuar el flujo.
      updateSensorInputs(key);                                                        // Llamada: ejecuta una accion del modulo actual.
      // Llamada: ejecuta una accion del modulo actual.
      log(`${imu.label}: captura ${action.replace("imu-", "")}`, "ok");
    }

    if (as5600) {                                                                     // Condicion: valida estado antes de continuar el flujo.
      if (action === "as5600-0") as5600.raw0 = Math.round(as5600.liveRaw);            // Condicion: valida estado antes de continuar el flujo.
      if (action === "as5600-90") as5600.raw90 = Math.round(as5600.liveRaw);          // Condicion: valida estado antes de continuar el flujo.
      if (action === "as5600-neutral") as5600.neutralDeg = round(as5600.liveDeg, 1);  // Condicion: valida estado antes de continuar el flujo.
      updateSensorInputs(key);                                                        // Llamada: ejecuta una accion del modulo actual.
      // Llamada: ejecuta una accion del modulo actual.
      log(`${as5600.label}: captura ${action.replace("as5600-", "")}`, "ok");
    }

    markDirty();                                                                      // Llamada: ejecuta una accion del modulo actual.
    updateLive();                                                                     // Llamada: ejecuta una accion del modulo actual.
  }

  function updateSensorInputs(key) {                                                  // Funcion updateSensorInputs: actualiza sensor inputs.
    // Llamada: ejecuta una accion del modulo actual.
    $$(`[data-imu="${key}"], [data-as5600="${key}"]`).forEach((input) => {
      const source = state.imus.find((item) => item.key === key) || state.as5600.find((item) => item.key === key); // Constante source: constante usada en source.
      if (!source) return;                                                            // Condicion: valida estado antes de continuar el flujo.
      const field = input.dataset.field;                                              // Constante field: constante usada en field.
      if (!field) return;                                                             // Condicion: valida estado antes de continuar el flujo.
      if (input.tagName === "SELECT") {                                               // Condicion: valida estado antes de continuar el flujo.
        input.value = String(source[field]);                                          // Asignacion: actualiza estado o salida calculada.
      } else {
        input.value = String(source[field]);                                          // Asignacion: actualiza estado o salida calculada.
      }
    });
  }

  function captureAllNeutral() {                                                      // Funcion captureAllNeutral: encapsula la logica de capture all neutral.
    state.imus.forEach((imu) => {                                                     // Llamada: ejecuta una accion del modulo actual.
      imu.neutralDeg = round(imu.liveDeg, 1);                                         // Asignacion: actualiza estado o salida calculada.
      updateSensorInputs(imu.key);                                                    // Llamada: ejecuta una accion del modulo actual.
    });
    state.as5600.forEach((sensor) => {                                                // Llamada: ejecuta una accion del modulo actual.
      sensor.neutralDeg = round(sensor.liveDeg, 1);                                   // Asignacion: actualiza estado o salida calculada.
      updateSensorInputs(sensor.key);                                                 // Llamada: ejecuta una accion del modulo actual.
    });
    markDirty();                                                                      // Llamada: ejecuta una accion del modulo actual.
    log("Neutral capturado para todos los sensores", "ok");                           // Llamada: ejecuta una accion del modulo actual.
  }

  function renderMapping() {                                                          // Funcion renderMapping: renderiza mapping.
    const list = $("#mapping-list");                                                  // Referencia list: nodo o coleccion DOM usada por la UI.
    // Asignacion: actualiza estado o salida calculada.
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

  function updateTuningFromControls() {                                               // Funcion updateTuningFromControls: actualiza tuning from controls.
    state.tuning.assistLevel = clamp(numberValue($("#assist-level").value, 0.5), 0, 1); // Asignacion: actualiza estado o salida calculada.
    state.tuning.deadbandDeg = clamp(numberValue($("#deadband").value, 2), 0, 30);    // Asignacion: actualiza estado o salida calculada.
    state.tuning.smoothing = clamp(numberValue($("#smoothing").value, 1), 0.05, 1);   // Asignacion: actualiza estado o salida calculada.
    state.tuning.maxSpeedDegSec = clamp(numberValue($("#max-speed").value, 2400), 5, 2400); // Asignacion: actualiza estado o salida calculada.
    updateTuningLabels();                                                             // Llamada: ejecuta una accion del modulo actual.
    sendCommand({ type: "cmd_tuning", tuning: { ...state.tuning } }, "Movimiento");   // Llamada: aplica velocidad, suavizado y zona muerta en vivo.
    markDirty();                                                                      // Llamada: ejecuta una accion del modulo actual.
    updateLive();                                                                     // Llamada: ejecuta una accion del modulo actual.
  }

  function updateTuningLabels() {                                                     // Funcion updateTuningLabels: actualiza tuning labels.
    // Llamada: ejecuta una accion del modulo actual.
    $("#assist-label").textContent = `${Math.round(state.tuning.assistLevel * 100)}%`;
    // Llamada: ejecuta una accion del modulo actual.
    $("#deadband-label").textContent = `${state.tuning.deadbandDeg} deg`;
    $("#smoothing-label").textContent = String(state.tuning.smoothing);               // Llamada: ejecuta una accion del modulo actual.
    // Llamada: ejecuta una accion del modulo actual.
    $("#speed-label").textContent = `${state.tuning.maxSpeedDegSec} deg/s`;
    // Llamada: ejecuta una accion del modulo actual.
    $("#hud-assist").textContent = `${Math.round(state.tuning.assistLevel * 100)}%`;
  }

  function updateServoSensorReading(servo, sensorDeg, sampledAt = Date.now()) {       // Funcion updateServoSensorReading: actualiza servo sensor reading.
    const next = numberValue(sensorDeg, servo.liveSensor);                            // Constante next: constante usada en next.
    const prev = Number(servo.lastSensorDeg);                                         // Constante prev: constante usada en prev.
    const prevAt = Number(servo.lastSensorAt);                                        // Constante prevAt: constante usada en prev at.
    let speed = 0;                                                                    // Estado speed: estado mutable de speed.

    if (Number.isFinite(prev) && Number.isFinite(prevAt) && sampledAt > prevAt) {     // Condicion: valida estado antes de continuar el flujo.
      const dt = (sampledAt - prevAt) / 1000;                                         // Constante dt: constante usada en dt.
      if (dt > 0.015 && dt < 2) speed = (next - prev) / dt;                           // Condicion: valida estado antes de continuar el flujo.
    }

    if (Math.abs(speed) < 0.05) speed = 0;                                            // Condicion: valida estado antes de continuar el flujo.
    const oldSpeed = numberValue(servo.liveSensorSpeed, 0);                           // Constante oldSpeed: constante usada en old speed.
    servo.liveSensorSpeed = oldSpeed * 0.55 + speed * 0.45;                           // Asignacion: actualiza estado o salida calculada.
    if (Math.abs(servo.liveSensorSpeed) < 0.05) servo.liveSensorSpeed = 0;            // Condicion: valida estado antes de continuar el flujo.
    servo.liveSensor = next;                                                          // Asignacion: actualiza estado o salida calculada.
    servo.lastSensorDeg = next;                                                       // Asignacion: actualiza estado o salida calculada.
    servo.lastSensorAt = sampledAt;                                                   // Asignacion: actualiza estado o salida calculada.
  }

  function syncLinkedSensorState(servo, item = {}) {                                  // Funcion syncLinkedSensorState: encapsula la logica de estado y perfil persistido.
    const linkedImu = state.imus.find((imu) => imu.servoId === servo.id);             // Constante linkedImu: constante usada en lectura de sensores IMU/I2C.
    if (linkedImu) {                                                                  // Condicion: valida estado antes de continuar el flujo.
      linkedImu.liveDeg = servo.liveSensor;                                           // Asignacion: actualiza estado o salida calculada.
      linkedImu.liveSpeed = servo.liveSensorSpeed;                                    // Asignacion: actualiza estado o salida calculada.
      linkedImu.online = item.online !== false;                                       // Asignacion: actualiza estado o salida calculada.
    }
    const linkedAs5600 = state.as5600.find((sensor) => sensor.servoId === servo.id);  // Constante linkedAs5600: sensor AS5600 enlazado al servo.
    if (linkedAs5600) {                                                               // Condicion: valida estado antes de continuar el flujo.
      linkedAs5600.liveDeg = servo.liveSensor;                                        // Asignacion: actualiza estado o salida calculada.
      linkedAs5600.liveSpeed = servo.liveSensorSpeed;                                 // Asignacion: actualiza estado o salida calculada.
      linkedAs5600.online = item.online !== false;                                    // Asignacion: actualiza estado o salida calculada.
      if (typeof item.raw === "number") linkedAs5600.liveRaw = item.raw;              // Condicion: valida estado antes de continuar el flujo.
    }
  }

  function updateFooterSummary() {                                                    // Funcion updateFooterSummary: actualiza footer summary.
    const footer = $(".app-footer");                                                  // Referencia footer: nodo o coleccion DOM usada por la UI.
    const footerS3 = $("#footer-s3");                                                 // Referencia footerS3: nodo o coleccion DOM usada por la UI.
    const footerCam = $("#footer-cam");                                               // Referencia footerCam: nodo o coleccion DOM usada por la UI.
    const footerProfile = $("#footer-profile");                                       // Referencia footerProfile: nodo o coleccion DOM usada por la UI.
    const footerMode = $("#footer-mode");                                             // Referencia footerMode: nodo o coleccion DOM usada por la UI.
    const footerPackets = $("#footer-packets");                                       // Referencia footerPackets: nodo o coleccion DOM usada por la UI.
    const mode = state.telemetry.mode || "manual";                                    // Constante mode: constante usada en mode.

    if (footerS3) footerS3.textContent = $("#s3-status b")?.textContent || "Offline"; // Condicion: valida estado antes de continuar el flujo.
    if (footerCam) footerCam.textContent = $("#cam-status b")?.textContent || "Offline"; // Condicion: valida estado antes de continuar el flujo.
    if (footerProfile) footerProfile.textContent = $("#profile-status b")?.textContent || "Sin guardar"; // Condicion: valida estado antes de continuar el flujo.
    if (footerMode) footerMode.textContent = modeLabel(mode);                         // Condicion: valida estado antes de continuar el flujo.
    if (footerPackets) footerPackets.textContent = String(state.telemetry.packets || 0); // Condicion: valida estado antes de continuar el flujo.
    if (footer) {                                                                     // Condicion: valida estado antes de continuar el flujo.
      footer.classList.remove("mode-manual", "mode-assisted", "mode-automatic", "mode-emergency", "mode-demo"); // Llamada: ejecuta una accion del modulo actual.
      footer.classList.add(modeClass(mode));                                          // Llamada: ejecuta una accion del modulo actual.
    }
    markModeButtons(mode);                                                            // Llamada: ejecuta una accion del modulo actual.

    const manualConn = $("#manual-hud-conn");                                         // Referencia manualConn: nodo o coleccion DOM usada por la UI.
    if (manualConn) manualConn.textContent = $("#s3-status b")?.textContent || "Offline"; // Condicion: valida estado antes de continuar el flujo.
    const manualMode = $("#manual-hud-mode");                                         // Referencia manualMode: nodo o coleccion DOM usada por la UI.
    if (manualMode) manualMode.textContent = modeLabel(mode);                         // Condicion: valida estado antes de continuar el flujo.
    const manualArmed = $("#manual-hud-armed");                                       // Referencia manualArmed: estado PWM en panel manual.
    if (manualArmed) manualArmed.textContent = armedLabel();                          // Condicion: valida estado antes de continuar el flujo.
  }

  function normalizeS3WsUrl(value, fallbackPort = 81) {                               // Funcion normalizeS3WsUrl: normaliza s3 ws url.
    const raw = String(value || "").trim();                                           // Constante raw: constante usada en raw.
    if (!raw) return "";                                                              // Condicion: valida estado antes de continuar el flujo.
    try {                                                                             // Bloque try: ejecuta una operacion que puede fallar.
      const candidate = /^wss?:\/\//i.test(raw)
        ? raw
        : `ws://${raw.replace(/^https?:\/\//i, "").replace(/^\/\//, "")}`;
      const parsed = new URL(candidate);                                              // Constante parsed: constante usada en parsed.
      parsed.protocol = parsed.protocol === "wss:" ? "wss:" : "ws:";                  // Asignacion: actualiza estado o salida calculada.
      if (!parsed.hostname) return "";                                                // Condicion: valida estado antes de continuar el flujo.
      if (!parsed.port) parsed.port = String(fallbackPort || 81);                     // Condicion: valida estado antes de continuar el flujo.
      const path = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : ""; // Constante path: constante usada en path.
      return `${parsed.protocol}//${parsed.host}${path}${parsed.search || ""}`;
    } catch {
      return "";                                                                      // Retorno: entrega el resultado al llamador.
    }
  }

  function isS3ControllerPacket(packet) {                                             // Funcion isS3ControllerPacket: evalua s3 controller packet.
    if (!packet || typeof packet !== "object") return false;                          // Condicion: valida estado antes de continuar el flujo.
    return packet.role === "controller" || packet.type === "ack" || packet.type === "sensors"; // Retorno: entrega el resultado al llamador.
  }

  function packetS3WsUrl(packet) {                                                    // Funcion packetS3WsUrl: encapsula la logica de comunicaciones y puertos.
    if (!isS3ControllerPacket(packet)) return "";                                     // Condicion: valida estado antes de continuar el flujo.

    const port = Number(packet.wsPort || packet.websocketPort || packet.port || 81) || 81; // Constante port: constante usada en comunicaciones y puertos.
    const direct = packet.wsUrl || packet.websocketUrl || packet.s3Url || packet.mdnsUrl || packet.urls?.ws; // Constante direct: constante usada en direct.
    if (direct) return normalizeS3WsUrl(direct, port);                                // Condicion: valida estado antes de continuar el flujo.

    const ip = String(packet.ip || packet.wifiIp || packet.address || "").trim();     // Constante ip: constante usada en ip.
    // Condicion: valida estado antes de continuar el flujo.
    if (ip && ip !== "0.0.0.0") return normalizeS3WsUrl(`${ip}:${port}`, port);
    return "";                                                                        // Retorno: entrega el resultado al llamador.
  }

  function serialTextS3WsUrl(text) {                                                  // Funcion serialTextS3WsUrl: encapsula la logica de comunicaciones y puertos.
    const raw = String(text || "");                                                   // Constante raw: constante usada en raw.
    const direct = raw.match(/\bws:\/\/[^\s"'<>]+/i);                                 // Constante direct: constante usada en direct.
    if (direct) return normalizeS3WsUrl(direct[0]);

    const ipMatch = raw.match(/\bIP\s*:\s*((?:\d{1,3}\.){3}\d{1,3})\b/i);
    if (!ipMatch) return "";
    const portMatch = raw.match(/\b(?:port|puerto)\s*:?\s*(\d{2,5})\b/i);
    const port = Number(portMatch?.[1] || 81) || 81;
    return normalizeS3WsUrl(`${ipMatch[1]}:${port}`, port);
  }

  function normalizeCamStreamUrl(value, fallbackPort = 80) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      const candidate = /^https?:\/\//i.test(raw)
        ? raw
        : `http://${raw.replace(/^\/\//, "")}`;
      const parsed = new URL(candidate);
      parsed.protocol = "http:";
      if (!parsed.hostname) return "";
      if (!parsed.port && fallbackPort && Number(fallbackPort) !== 80) parsed.port = String(fallbackPort);
      if (!parsed.pathname || parsed.pathname === "/") parsed.pathname = "/stream";
      return `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search || ""}`;
    } catch {
      return "";
    }
  }

  function packetCamStreamUrl(packet) {
    if (!packet || typeof packet !== "object") return "";
    const camPacket = packet.type === "cam_bridge" && packet.cam ? packet.cam : packet;
    const looksLikeCam = camPacket.role === "camera" ||
      camPacket.type === "cam_status" ||
      camPacket.type === "cam_hello";
    if (!looksLikeCam) return "";

    const port = Number(camPacket.httpPort || camPacket.port || 80) || 80;
    const direct = camPacket.stream || camPacket.cameraStream || camPacket.urls?.stream || camPacket.mdnsStream;
    if (direct) return normalizeCamStreamUrl(direct, port);

    const ip = String(camPacket.ip || camPacket.address || "").trim();
    if (ip && ip !== "0.0.0.0") {
      return normalizeCamStreamUrl(`http://${ip}${port === 80 ? "" : `:${port}`}/stream`, port);
    }
    return "";
  }

  function serialTextCamStreamUrl(text) {
    const raw = String(text || "");
    const direct = raw.match(/\bhttps?:\/\/[^\s"'<>]+\/stream\b/i);
    if (direct) return normalizeCamStreamUrl(direct[0]);
    return "";
  }

  function websocketActive() {
    return ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN);
  }

  function clearAutoS3Connect() {
    if (autoConnectS3Timer) {
      clearTimeout(autoConnectS3Timer);
      autoConnectS3Timer = null;
    }
    autoConnectS3Url = "";
  }

  function scheduleAutoS3Connect(url) {
    if (!serialConnected || websocketActive()) return;
    if (autoConnectS3Timer && autoConnectS3Url === url) return;
    if (autoConnectS3Timer) clearTimeout(autoConnectS3Timer);

    autoConnectS3Url = url;
    log(`Conectando por URL detectada: ${url}`, "sys");
    autoConnectS3Timer = setTimeout(() => {
      autoConnectS3Timer = null;
      if (!serialConnected || websocketActive() || state.connection.s3Url !== url) return;
      connectS3({ fromAuto: true });
    }, 250);
  }

  function applyDetectedS3Url(url, source = "serial", options = {}) {
    const normalized = normalizeS3WsUrl(url);
    if (!normalized) return "";

    const input = $("#s3-url");
    const changed = normalized !== state.connection.s3Url || normalized !== input?.value;
    state.connection.s3Url = normalized;
    if (input) input.value = normalized;

    if (changed || lastResolvedS3Url !== normalized) {
      lastResolvedS3Url = normalized;
      log(`URL ESP32-S3 detectada por ${source}: ${normalized}`, "ok");
      markDirty();
    }

    if (options.autoConnect) scheduleAutoS3Connect(normalized);
    return normalized;
  }

  function uniqueS3Urls(values) {
    const seen = new Set();
    const urls = [];
    values.forEach((value) => {
      const normalized = normalizeS3WsUrl(value);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      urls.push(normalized);
    });
    return urls;
  }

  function s3CandidateUrls() {
    const inputUrl = $("#s3-url")?.value || "";
    const storedUrl = state.connection.s3Url || "";
    const placeholderUrl = normalizeS3WsUrl(S3_PLACEHOLDER_WS_URL);
    const savedUrls = [lastResolvedS3Url, inputUrl, storedUrl].filter((url) => {
      const normalized = normalizeS3WsUrl(url);
      return normalized && normalized !== placeholderUrl;
    });

    return uniqueS3Urls([
      ...savedUrls,
      S3_BATTERY_AP_WS_URL,
      S3_MDNS_WS_URL,
      S3_PLACEHOLDER_WS_URL,
      inputUrl,
      storedUrl
    ]);
  }

  function s3ScanLabel(item) {
    if (!item) return "";
    const kind = item.s3Like ? "S3" : item.esp32Like ? "ESP32" : item.guess ? item.guess.toUpperCase() : "";
    return [item.port, item.label, kind].filter(Boolean).join(" - ");
  }

  function applyScannedS3Ports(scanned) {
    if (!Array.isArray(scanned)) return;
    const connectionPort = $("#s3-port");
    const firmwarePort = $("#fw-port-s3");
    scanned.forEach((item) => {
      if (!item?.port || item.skipped) return;
      const label = s3ScanLabel(item) || item.port;
      upsertSelectOption(connectionPort, item.port, label);
      upsertSelectOption(firmwarePort, item.port, label);
    });
  }

  function applyDetectedS3Port(port, label = "") {
    if (!port) return;
    state.connection.s3Port = port;
    state.firmware.s3.port = port;
    const connectionPort = $("#s3-port");
    if (connectionPort) {
      upsertSelectOption(connectionPort, port, label || port);
      connectionPort.value = port;
    }
    const firmwarePort = $("#fw-port-s3");
    if (firmwarePort) {
      upsertSelectOption(firmwarePort, port, label || port);
      firmwarePort.value = port;
    }
  }

  async function detectS3UrlFromSerial() {
    const selectedPort = $("#s3-port")?.value || state.connection.s3Port || state.firmware.s3.port || "";
    const baud = Number(state.connection.s3Baud || 115200) || 115200;

    try {
      setStatus("#s3-status", "warn", selectedPort ? "Leyendo COM" : "Buscando COM");
      const data = await fetchJson("/api/s3/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          port: selectedPort,
          baud,
          scan: true,
          timeoutMs: selectedPort ? 8000 : 12000,
          perPortTimeoutMs: selectedPort ? 8000 : 3500
        }),
        timeoutMs: selectedPort ? 12000 : 18000
      });
      if (Array.isArray(data.scanned)) applyScannedS3Ports(data.scanned);
      if (data.port) {
        const scanned = data.scanned?.find((item) => item.port === data.port);
        applyDetectedS3Port(data.port, scanned ? s3ScanLabel(scanned) : data.port);
      }

      const detectedUrl = data.url || data.ws || data.wsUrl || data.s3Url;
      if (detectedUrl) {
        log(`ESP32-S3 detectado por COM ${data.port || selectedPort || ""}`.trim(), "ok");
        return applyDetectedS3Url(detectedUrl, data.port ? `COM ${data.port}` : "COM");
      }
      if (data.detected && data.port) {
        log(`ESP32-S3 detectado por USB en ${data.port}; abriendo control serial`, "ok");
        await connectS3Serial();
        return "";
      }
      if (data.detected && data.output) log(data.output, "warn");
    } catch (error) {
      log(`Deteccion COM S3: ${error.message}`, "warn");
    }
    return "";
  }

  function probeS3Url(url, timeoutMs = 1300) {
    const normalized = normalizeS3WsUrl(url);
    if (!normalized) return Promise.resolve("");

    return new Promise((resolve) => {
      let probe = null;
      let done = false;
      // Funcion local | finish: cierra deteccion automatica y aplica la URL encontrada.
      const finish = (foundUrl = "") => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try {
          if (probe && probe.readyState !== WebSocket.CLOSED) probe.close();
        } catch {}
        resolve(foundUrl ? normalizeS3WsUrl(foundUrl) || normalized : "");
      };
      const timer = setTimeout(() => finish(""), timeoutMs);

      try {
        probe = new WebSocket(normalized);
      } catch {
        finish("");
        return;
      }

      probe.addEventListener("open", () => {
        try {
          probe.send(JSON.stringify({ type: "cmd_status" }));
        } catch {}
      });
      probe.addEventListener("message", (event) => {
        let packet = null;
        try {
          packet = JSON.parse(event.data);
        } catch {
          finish("");
          return;
        }
        if (!isS3ControllerPacket(packet)) return;
        finish(packetS3WsUrl(packet) || normalized);
      });
      probe.addEventListener("error", () => finish(""));
      probe.addEventListener("close", () => finish(""));
    });
  }

  async function detectS3Url() {
    const serialDetected = await detectS3UrlFromSerial();
    if (serialDetected) return serialDetected;
    if (serialConnected) return "";

    const candidates = s3CandidateUrls();
    if (!candidates.length) return "";

    setStatus("#s3-status", "warn", "Buscando URL");
    log(`Buscando ESP32-S3 en ${candidates.length} URL(s)...`, "sys");
    for (const candidate of candidates) {
      const detected = await probeS3Url(candidate);
      if (detected) {
        return applyDetectedS3Url(detected, "deteccion automatica");
      }
    }
    return "";
  }

  function applyDetectedCamUrl(url, source = "COM", options = {}) {
    const normalized = normalizeCamStreamUrl(url);
    if (!normalized) return "";

    const input = $("#cam-url");
    const changed = normalized !== state.connection.camUrl || normalized !== input?.value;
    state.connection.camUrl = normalized;
    if (input) input.value = normalized;

    if (changed || lastResolvedCamUrl !== normalized) {
      lastResolvedCamUrl = normalized;
      const action = options.manual ? "configurada" : "detectada";
      log(`URL ESP32-CAM ${action} por ${source}: ${normalized}`, "ok");
      markDirty();
    }

    if (options.autoStart) startCamera();
    return normalized;
  }

  function isCamFallbackApUrl(url) {
    try {
      return new URL(url).hostname === "192.168.4.1";
    } catch {
      return false;
    }
  }

  function isCamUsbStreamUrl(url) {
    try {
      return new URL(url, window.location.origin).pathname === "/api/cam/usb-stream";
    } catch {
      return false;
    }
  }

  function isCamUsbFirmwareBlocked(url, message) {
    return isCamUsbStreamUrl(url) &&
      /no responde como ESP32-CAM|firmware CAM|no anuncia video USB/i.test(String(message || ""));
  }

  function camUsbStableFallbackUrl(url) {
    if (!isCamUsbStreamUrl(url)) return "";
    try {
      const parsed = new URL(url, window.location.origin);
      const currentBaud = Number(parsed.searchParams.get("streamBaud") || CAM_USB_STREAM_BAUD) || CAM_USB_STREAM_BAUD;
      if (currentBaud <= CAM_USB_FALLBACK_STREAM_BAUD) return "";
      parsed.searchParams.set("streamBaud", String(CAM_USB_FALLBACK_STREAM_BAUD));
      parsed.searchParams.delete("_");
      return parsed.toString();
    } catch {
      return "";
    }
  }

  function camStreamProxyUrl(url) {
    if (isCamUsbStreamUrl(url)) {
      const parsed = new URL(url, window.location.origin);
      parsed.searchParams.set("_", String(Date.now()));
      return parsed.toString();
    }
    return apiUrl(`/api/cam/stream?url=${encodeURIComponent(url)}&_=${Date.now()}`);
  }

  function camControlUrl(path) {
    const raw = $("#cam-url")?.value || state.connection.camUrl || "";
    const normalized = normalizeCamStreamUrl(raw);
    if (!normalized || isCamUsbStreamUrl(normalized)) return "";
    try {
      const parsed = new URL(normalized);
      if (parsed.port === "81") parsed.port = "";
      parsed.pathname = path;
      parsed.search = "";
      parsed.hash = "";
      return parsed.toString();
    } catch {
      return "";
    }
  }

  async function sendCamControl(path, label) {
    const url = camControlUrl(path);
    if (!url) {
      log("CAM: primero detecta o inicia una URL de red", "warn");
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    try {
      setStatus("#cam-status", "warn", "Ajustando");
      const response = await fetch(url, {
        cache: "no-store",
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setStatus("#cam-status", "ok", "Online");
      log(`${label}: OK`, "ok");
    } catch (error) {
      setStatus("#cam-status", "warn", "Control CAM");
      log(`${label}: ${error.name === "AbortError" ? "tiempo agotado" : error.message}`, "warn");
    } finally {
      clearTimeout(timer);
    }
  }

  function connectSerialEvents() {
    if (serialEvents) serialEvents.close();
    serialEvents = new EventSource(apiUrl("/api/serial/events"));

    serialEvents.addEventListener("serial", (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.line) handleSerialEventLine(data.line);
      } catch (error) {
        appendSerialMonitorLine(`Serial RX: ${error.message}`, "err");
        log(`Serial RX: ${error.message}`, "err");
      }
    });

    serialEvents.addEventListener("status", (event) => {
      const data = JSON.parse(event.data);
      serialConnected = Boolean(data.ok);
      if (data.ok) {
        autoConnectS3Url = "";
        setStatus("#s3-status", "ok", data.port || "COM");
        appendSerialMonitorLine(data.message || `Serial conectado a ${data.port}`, "ok");
        log(data.message || `Serial conectado a ${data.port}`, "ok");
        sendCommand({ type: "cmd_status" }, "Estado");
      } else if (data.message) {
        clearAutoS3Connect();
        setStatus("#s3-status", "", "Offline");
        appendSerialMonitorLine(data.message, "sys");
        log(data.message, "sys");
      }
    });

    serialEvents.addEventListener("serial-error", (event) => {
      let message = "Error serial";
      try {
        const data = JSON.parse(event.data);
        message = data.message || message;
      } catch {}
      setStatus("#s3-status", "", "Error");
      appendSerialMonitorLine(message, "err");
      log(message, "err");
    });

    serialEvents.addEventListener("port-added", (event) => {
      try {
        const payload = JSON.parse(event.data);
        handleDetectedPort(payload?.port || null);
      } catch (error) {
        log(`Detector COM: ${error.message}`, "err");
      }
    });

    serialEvents.addEventListener("port-snapshot", (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (Array.isArray(payload?.ports)) {
          handlePortSnapshot(payload.ports);
        }
      } catch {}
    });

    serialEvents.onerror = () => {
      if (!serialConnected) setStatus("#s3-status", "", "Offline");
    };
  }

  // Keep the SSE channel open from startup so detection events arrive even
  // before the user has connected anything.
  function ensureSerialEventsOpen() {
    if (!serialEvents || serialEvents.readyState === 2 /* CLOSED */) {
      connectSerialEvents();
    }
  }

  // -------------------------------------------------------------------
  //  New COM port detection popup
  // -------------------------------------------------------------------

  function describeGuess(guess) {
    if (guess === "s3") return "ESP32-S3";
    if (guess === "cam") return "ESP32-CAM";
    if (guess === "esp32") return "ESP32";
    if (guess === "esp8266") return "ESP8266";
    if (guess === "arduino") return "Arduino";
    return "Desconocido";
  }

  function describeKind(kind) {
    if (kind === "bluetooth") return "Bluetooth";
    if (kind === "serial") return "Serial (USB)";
    return kind || "Serial";
  }

  function isLikelyEspPort(port) {
    if (!port) return false;
    if (port.isEsp === true) return true;
    if (port.guess === "s3" || port.guess === "cam" || port.guess === "esp32") return true;
    const text = [
      port.address,
      port.label,
      port.name,
      port.board,
      port.pnpId,
      port.vendorId,
      port.productId
    ].filter(Boolean).join(" ").toLowerCase();
    return text.includes("esp32") ||
      text.includes("espressif") ||
      text.includes("cp210") ||
      text.includes("ch340") ||
      text.includes("ch341") ||
      text.includes("ch343") ||
      text.includes("ch910") ||
      text.includes("wch") ||
      text.includes("qinheng") ||
      text.includes("ftdi") ||
      text.includes("usb jtag") ||
      text.includes("usb-enhanced-serial");
  }

  function handlePortSnapshot(ports) {
    const normalized = (Array.isArray(ports) ? ports : []).filter((port) => port?.address);
    const espCandidates = normalized.filter((port) => !isBluetoothPortInfo(port) && isLikelyEspPort(port));
    const serialCandidates = normalized.filter((port) => port.kind !== "bluetooth" && !isBluetoothPortInfo(port));
    const promptCandidates = espCandidates.length
      ? espCandidates
      : serialCandidates.length === 1
        ? serialCandidates
        : [];
    const promptKeys = new Set(promptCandidates.map((port) => String(port.address).toUpperCase()));

    promptCandidates.forEach((port) => {
      handleDetectedPort({
        ...port,
        isEsp: isLikelyEspPort(port),
        suggestedDevice: port.suggestedDevice || (port.guess === "cam" ? "cam" : "s3")
      });
    });

    normalized.forEach((port) => {
      const key = String(port.address).toUpperCase();
      if (!promptKeys.has(key)) detectedPortsSeen.add(key);
    });
  }

  function handleDetectedPort(port) {
    if (!port || !port.address) return;
    const key = String(port.address).toUpperCase();
    if (detectedPortsSeen.has(key)) return;
    if (detectedPortsIgnored.has(key)) return;
    detectedPortsSeen.add(key);

    // If this is a brand-new port, also refresh the dropdowns so the user
    // sees it immediately in every selector.
    refreshPorts({ force: true, silent: true }).catch(() => {});

    if (shouldAutoConnectS3Port(port)) {
      autoConnectDetectedS3Port(port);
      return;
    }

    queueDetectedPort(port);
  }

  function shouldAutoConnectS3Port(port) {                                            // Funcion shouldAutoConnectS3Port: decide si un COM nuevo debe abrirse como S3.
    if (!port?.address || isBluetoothPortInfo(port)) return false;                    // Condicion: descarta puertos no cableados por USB.
    if (serialConnected || s3AutoSerialConnecting) return false;                      // Condicion: evita quitar una conexion activa.
    const key = String(port.address).toUpperCase();                                   // Constante key: constante usada en comunicaciones y puertos.
    if (autoConnectedS3Ports.has(key)) return false;                                  // Condicion: evita intentos repetidos al mismo COM.
    const device = port.suggestedDevice || (port.guess === "cam" ? "cam" : "s3");    // Constante device: tipo sugerido por el detector.
    if (device !== "s3" || port.guess === "cam") return false;                       // Condicion: protege la ESP32-CAM.
    return isLikelyEspPort(port) || port.guess === "s3" || port.guess === "esp32";    // Retorno: permite ESP32-S3 y USB-serial compatibles.
  }

  async function autoConnectDetectedS3Port(port) {                                    // Funcion autoConnectDetectedS3Port: abre automaticamente la S3 al conectar USB.
    const key = String(port.address || "").toUpperCase();                             // Constante key: constante usada en comunicaciones y puertos.
    if (!key) return;                                                                 // Condicion: valida estado antes de continuar el flujo.
    autoConnectedS3Ports.add(key);                                                    // Llamada: recuerda el intento para esta sesion.
    s3AutoSerialConnecting = true;                                                    // Asignacion: actualiza estado de autoconexion.
    try {                                                                             // Bloque try: ejecuta una operacion que puede fallar.
      await refreshPorts({ force: true, silent: true });                              // Espera asincrona: actualiza selectores COM.
      const label = port.label || port.name || port.address;                          // Constante label: etiqueta visible del puerto.
      applyDetectedS3Port(port.address, label);                                       // Llamada: sincroniza selector de conexion y firmware.
      syncS3UploadPort(port.address);                                                 // Llamada: sincroniza selector de carga rapida si existe.
      setStatus("#s3-status", "warn", "Auto COM");                                   // Llamada: informa autoconexion en cabecera.
      log(`ESP32-S3 detectada en ${port.address}; conectando por USB...`, "sys");     // Llamada: ejecuta una accion del modulo actual.
      await connectS3Serial();                                                        // Espera asincrona: abre puente serial y pide estado.
    } catch (error) {
      log(`Auto COM ${port.address}: ${error.message}`, "warn");                     // Llamada: deja aviso para diagnostico.
      queueDetectedPort(port);                                                        // Llamada: deja al usuario elegir conectar o subir firmware.
    } finally {
      s3AutoSerialConnecting = false;                                                 // Asignacion: libera nuevos intentos.
    }
  }

  function queueDetectedPort(port) {
    detectedPortQueue.push(port);
    drainDetectedQueue();
  }

  function drainDetectedQueue() {
    if (detectedActivePort) return;
    const next = detectedPortQueue.shift();
    if (!next) return;
    detectedActivePort = next;
    showEspAlert(next);
  }

  function showEspAlert(port) {
    const backdrop = $("#esp-alert-backdrop");
    if (!backdrop) {
      detectedActivePort = null;
      return;
    }

    const portText = port.address || "COM?";
    const guessText = describeGuess(port.guess);
    const kindText = describeKind(port.kind);
    const descPieces = [port.label, port.name, port.board, port.pnpId]
      .filter(Boolean)
      .filter((value, index, array) => array.indexOf(value) === index);
    const description = descPieces.join(" · ") || "Sin descripción adicional";

    $("#esp-alert-port").textContent = portText;
    $("#esp-alert-guess").textContent = port.isEsp ? guessText : `${guessText} (no identificado como ESP)`;
    $("#esp-alert-kind").textContent = kindText;
    $("#esp-alert-desc").textContent = description;

    const sub = $("#esp-alert-sub");
    if (sub) {
      sub.textContent = port.isEsp
        ? `Detectado en ${portText}. ¿Qué deseas hacer?`
        : `Nuevo dispositivo serial en ${portText}.`;
    }

    const rememberCheckbox = $("#esp-alert-remember");
    if (rememberCheckbox) rememberCheckbox.checked = false;

    backdrop.hidden = false;
    document.body.classList.add("esp-alert-open");

    // Log every detection so it shows in the event log too.
    log(`Nuevo COM detectado: ${portText} (${guessText})`, "ok");

    // Focus the first action button for keyboard users.
    setTimeout(() => $("#esp-alert-connect")?.focus(), 30);
  }

  function closeEspAlert({ remember = false } = {}) {
    const backdrop = $("#esp-alert-backdrop");
    if (!backdrop) return;
    const port = detectedActivePort;
    backdrop.hidden = true;
    document.body.classList.remove("esp-alert-open");
    detectedActivePort = null;
    if (remember && port?.address) {
      detectedPortsIgnored.add(String(port.address).toUpperCase());
    }
    // Show the next queued popup, if any.
    setTimeout(drainDetectedQueue, 120);
  }

  function shouldRememberIgnore() {
    return Boolean($("#esp-alert-remember")?.checked);
  }

  async function actionConnectDetected(port) {
    if (!port?.address) return;
    const device = port.suggestedDevice || (port.guess === "cam" ? "cam" : "s3");

    closeEspAlert({ remember: shouldRememberIgnore() });

    try {
      await refreshPorts({ force: true, silent: true });
    } catch {}

    if (device === "cam") {
      const camSelect = $("#cam-port");
      if (camSelect) {
        upsertSelectOption(camSelect, port.address, port.label || port.address);
        camSelect.value = port.address;
      }
      state.connection.camPort = port.address;
      log(`Conectando ESP32-CAM en ${port.address}...`, "sys");
      try {
        await connectCamSerial();
      } catch (error) {
        log(`CAM: ${error.message}`, "err");
      }
      return;
    }

    const s3Select = $("#s3-port");
    if (s3Select) {
      upsertSelectOption(s3Select, port.address, port.label || port.address);
      s3Select.value = port.address;
    }
    state.connection.s3Port = port.address;
    log(`Conectando ESP32-S3 en ${port.address}...`, "sys");
    try {
      await connectS3Serial();
    } catch (error) {
      log(`S3: ${error.message}`, "err");
    }
  }

  function switchToFirmwarePanel() {
    const railBtn = document.querySelector('.rail-btn[data-panel="firmware"]');
    if (railBtn) railBtn.click();
  }

  async function actionUploadFirmwareDetected(port) {
    if (!port?.address) return;
    const device = port.suggestedDevice || (port.guess === "cam" ? "cam" : "s3");

    closeEspAlert({ remember: shouldRememberIgnore() });

    try {
      await refreshPorts({ force: true, silent: true });
    } catch {}

    // Make sure the firmware panel is visible.
    switchToFirmwarePanel();

    const fwSelect = $(`#fw-port-${device}`);
    if (fwSelect) {
      upsertSelectOption(fwSelect, port.address, port.label || port.address);
      fwSelect.value = port.address;
    }
    if (state.firmware?.[device]) {
      state.firmware[device].port = port.address;
    }
    setFirmwareBadge(device, "warn", `Preparando ${port.address}`);
    log(`Subiendo firmware ${device.toUpperCase()} a ${port.address}...`, "sys");

    try {
      if (device === "s3") await runS3QuickAction("upload");
      else await runFirmwareAction(device, "upload");
    } catch (error) {
      log(`Firmware ${device.toUpperCase()}: ${error.message}`, "err");
    }
  }

  function actionIgnoreDetected(port) {
    // "Ignorar" always silences the *current* port for this session,
    // regardless of the "remember" checkbox.
    if (port?.address) {
      detectedPortsIgnored.add(String(port.address).toUpperCase());
    }
    log(`Ignorando ${port?.address || "puerto"} en esta sesión`, "sys");
    closeEspAlert({ remember: false });
  }

  function bindEspAlert() {
    const backdrop = $("#esp-alert-backdrop");
    if (!backdrop) return;

    $("#esp-alert-connect")?.addEventListener("click", () => {
      const port = detectedActivePort;
      if (port) actionConnectDetected(port);
    });

    $("#esp-alert-upload")?.addEventListener("click", () => {
      const port = detectedActivePort;
      if (port) actionUploadFirmwareDetected(port);
    });

    $("#esp-alert-ignore")?.addEventListener("click", () => {
      const port = detectedActivePort;
      if (port) actionIgnoreDetected(port);
      else closeEspAlert();
    });

    $("#esp-alert-close")?.addEventListener("click", () => {
      // The X is the same as "decide later" — just close without remembering.
      closeEspAlert({ remember: shouldRememberIgnore() });
    });

    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) {
        closeEspAlert({ remember: shouldRememberIgnore() });
      }
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !backdrop.hidden) {
        closeEspAlert({ remember: shouldRememberIgnore() });
      }
    });
  }

  async function connectS3Serial() {
    let port = $("#s3-port").value;
    if (!port) {
      setStatus("#s3-status", "warn", "Detectando COM");
      await refreshPorts({ force: true, silent: true });
      port = $("#s3-port").value;
    }
    state.connection.s3Port = port;
    if (!port) {
      log("No encontre un puerto COM activo para la ESP32-S3. Revisa que Windows la muestre como COM y vuelve a conectar.", "err");
      return;
    }

    if (ws) {
      ws.close();
      ws = null;
    }
    await disconnectSerialBridge({ silent: true });
    connectSerialEvents();
    setStatus("#s3-status", "warn", "Abriendo COM");
    appendSerialMonitorLine(`Abriendo ${port} a ${state.connection.s3Baud || 115200} baudios`, "sys");

    try {
      const data = await fetchJson(apiUrl("/api/serial/connect"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ port, baud: state.connection.s3Baud || 115200 }),
        timeoutMs: 15000
      });
      log(data.output || `Abriendo ${port}`, "sys");
      markDirty();
    } catch (error) {
      serialConnected = false;
      setStatus("#s3-status", "", "Error");
      log(`COM ${port}: ${error.message}`, "err");
    }
  }

  function upsertSelectOption(select, value, label) {
    if (!select || !value) return;
    const option = Array.from(select.options).find((item) => item.value === value);
    if (option) {
      if (label) option.textContent = label;
      return;
    }
    select.add(new Option(label || value, value));
  }

  function camScanLabel(item) {
    const kind = item.camLike || item.guess === "cam"
      ? "ESP32-CAM"
      : item.esp32Like || item.guess === "esp32"
        ? "ESP32"
        : item.guess === "s3"
          ? "ESP32-S3"
          : "";
    return [item.port, item.label, kind].filter(Boolean).join(" - ");
  }

  function applyScannedCamPorts(scanned) {
    if (!Array.isArray(scanned)) return;
    const connectionPort = $("#cam-port");
    const firmwarePort = $("#fw-port-cam");
    scanned.forEach((item) => {
      if (!item?.port || item.skipped) return;
      const label = camScanLabel(item) || item.port;
      upsertSelectOption(connectionPort, item.port, label);
      upsertSelectOption(firmwarePort, item.port, label);
    });
  }

  function applyDetectedCamPort(port, label = "") {
    if (!port) return;
    state.connection.camPort = port;
    state.firmware.cam.port = port;
    const connectionPort = $("#cam-port");
    if (connectionPort) {
      upsertSelectOption(connectionPort, port, label || port);
      connectionPort.value = port;
    }
    const firmwarePort = $("#fw-port-cam");
    if (firmwarePort) {
      upsertSelectOption(firmwarePort, port, label || port);
      firmwarePort.value = port;
    }
  }

  function normalizeManualComPort(value) {
    const port = String(value || "").trim().replace(/\s+/g, "").toUpperCase();
    if (!port) return "";
    return /^\d+$/.test(port) ? `COM${port}` : port;
  }

  function camUsbStreamUrlForPort(port) {
    const params = new URLSearchParams({
      port,
      baud: String(state.connection.camBaud || 115200),
      streamBaud: String(CAM_USB_STREAM_BAUD)
    });
    return new URL(apiUrl(`/api/cam/usb-stream?${params.toString()}`), window.location.origin).toString();
  }

  function hideCamManualComMenu() {
    const menu = $("#cam-manual-menu");
    if (menu) menu.hidden = true;
  }

  function manualCamPortLabel(port) {
    const address = port.address || port.port || "";
    const label = port.label || port.name || port.board || "Serial";
    const guess = port.guess ? ` - ${port.guess.toUpperCase()}` : "";
    return `${address} - ${label}${guess}`;
  }

  function knownManualCamPorts() {
    const ports = new Map();
    // Funcion local | add: agrega puertos COM unicos a la lista manual.
    const add = (value, label = "") => {
      const address = normalizeManualComPort(value);
      if (!address || ports.has(address)) return;
      const rawLabel = String(label || "").trim();
      const prefixed = `${address} - `;
      const displayLabel = rawLabel.toUpperCase().startsWith(prefixed.toUpperCase())
        ? rawLabel.slice(prefixed.length).trim()
        : rawLabel;
      ports.set(address, {
        address,
        label: displayLabel && displayLabel !== value ? displayLabel : "Serial"
      });
    };

    [$("#cam-port"), $("#fw-port-cam")].forEach((select) => {
      Array.from(select?.options || []).forEach((option) => add(option.value, option.textContent.trim()));
    });
    add(state.connection.camPort, `${state.connection.camPort} - manual`);
    add(state.firmware.cam.port, `${state.firmware.cam.port} - manual`);
    return Array.from(ports.values());
  }

  function loadManualCamPortList() {
    const list = $("#cam-manual-port-list");
    if (!list) return;
    const ports = knownManualCamPorts();
    if (!ports.length) {
      list.innerHTML = `<div class="cam-manual-empty">Escribe COM</div>`;
      return;
    }

    list.innerHTML = ports.map((port) => `
      <div class="cam-manual-option" role="option" tabindex="0" data-port="${escapeHtml(port.address)}">
        <strong>${escapeHtml(port.address)}</strong>
        <span>${escapeHtml(manualCamPortLabel(port).replace(`${port.address} - `, ""))}</span>
      </div>
    `).join("");
  }

  async function connectCamManualCom() {
    const menu = $("#cam-manual-menu");
    if (!menu) return;
    if (!menu.hidden) {
      hideCamManualComMenu();
      return;
    }

    menu.hidden = false;
    loadManualCamPortList();
    const input = $("#cam-manual-port-input");
    if (input) {
      input.value = normalizeManualComPort($("#cam-port")?.value || state.connection.camPort || input.value);
      input.focus();
      input.select();
    }
  }

  async function useManualCamPort(port) {
    port = normalizeManualComPort(port);
    if (!port) return;

    applyDetectedCamPort(port, `${port} - manual`);
    setStatus("#cam-status", "warn", "Leyendo COM");
    try {
      await detectCamSerial({ autoStart: true, useSelected: true, scan: false });
      return;
    } catch {}

    applyDetectedCamUrl(camUsbStreamUrlForPort(port), `COM manual ${port}`, { manual: true });
    setStatus("#cam-status", "warn", "COM manual");
    log(`CAM USB manual: usando ${port} sin detector automatico`, "sys");
    markDirty();
    startCamera();
  }

  function selectCamManualPortFromList(event) {
    const option = event.target.closest(".cam-manual-option");
    const port = option?.dataset.port || "";
    if (!port) return;
    hideCamManualComMenu();
    useManualCamPort(port);
  }

  function submitManualCamPort(event) {
    event.preventDefault();
    const port = normalizeManualComPort($("#cam-manual-port-input")?.value || "");
    if (!port) {
      setStatus("#cam-status", "", "Sin COM");
      log("COM manual: escribe un puerto como COM7", "err");
      return;
    }
    hideCamManualComMenu();
    useManualCamPort(port);
  }

  function handleCamManualPortKeydown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    selectCamManualPortFromList(event);
  }

  async function detectCamSerial(options = {}) {
    const selectedPort = $("#cam-port").value;
    const useSelected = options.useSelected !== false;
    const port = useSelected ? selectedPort : "";
    const autoStart = Boolean(options.autoStart);
    const scan = options.scan !== undefined ? Boolean(options.scan) : !port;

    if (useSelected && !port) {
      log("Primero pulsa Detectar CAM y selecciona un puerto COM", "err");
      setStatus("#cam-status", "", "Sin COM");
      return null;
    }

    if (port) applyDetectedCamPort(port);
    setStatus("#cam-status", "warn", scan ? "Buscando CAM" : "Leyendo COM");

    try {
      const data = await fetchJson("/api/cam/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          port,
          scan,
          baud: state.connection.camBaud || 115200,
          timeoutMs: port ? 12000 : 25000,
          perPortTimeoutMs: port ? 6000 : 5000
        }),
        timeoutMs: port ? 18000 : 35000
      });

      applyScannedCamPorts(data.scanned);
      const detectedPort = data.port || port || data.scanned?.find((item) => item.detected)?.port || "";
      if (!data.stream) {
        if (data.detected && detectedPort) {
          const detected = data.scanned?.find((item) => item.port === detectedPort);
          applyDetectedCamPort(detectedPort, detected ? camScanLabel(detected) : detectedPort);
          setStatus("#cam-status", detected?.camLike ? "ok" : "warn", detected?.camLike ? "Detectada" : "COM detectado");
          log(data.output || `ESP32-CAM detectada en ${detectedPort}, sin URL /stream`, detected?.camLike ? "ok" : "sys");
          markDirty();
          return data;
        }
        throw new Error(data.output || "La CAM no envio URL /stream");
      }

      const detected = data.scanned?.find((item) => item.port === detectedPort);
      applyDetectedCamPort(detectedPort, detected ? camScanLabel(detected) : detectedPort);
      const apFallback = data.reason === "ap-fallback" || isCamFallbackApUrl(data.stream);
      const shouldAutoStart = autoStart && !(apFallback && !data.usbStream && data.transport !== "usb");
      applyDetectedCamUrl(data.stream, `COM ${data.port || port}`, { autoStart: shouldAutoStart });
      if (!autoStart) setStatus("#cam-status", "ok", detectedPort || "Detectada");
      if (data.usbStream || data.transport === "usb") {
        log(`Video CAM por USB en ${detectedPort || data.port}; no se cambia el WiFi de esta PC`, "ok");
      } else if (apFallback) {
        const apSsid = data.apSsid || "VESTA-CAM-SETUP";
        if (autoStart) {
          setStatus("#cam-status", "warn", "WiFi CAM");
          try {
            const wifi = await connectCamFallbackWifi();
            if (wifi.output) log(wifi.output, "sys");
            log(`Conectado a ${apSsid}; abriendo video CAM`, "ok");
          } catch (wifiError) {
            log(`CAM en hotspot ${apSsid}: conecta Windows manualmente a esa red si no abre el video`, "warn");
          }
          startCamera();
        } else {
          log(`CAM en hotspot ${apSsid}: selecciona Conectar COM para abrir el video`, "sys");
        }
      }
      log(data.ip ? `ESP32-CAM IP: ${data.ip}` : `ESP32-CAM lista en ${detectedPort || "COM"}`, "ok");
      markDirty();
      return data;
    } catch (error) {
      setStatus("#cam-status", "", "Error");
      log(port ? `CAM COM ${port}: ${error.message}` : `CAM auto: ${error.message}`, "err");
      throw error;
    }
  }

  async function connectCamSerial() {
    try {
      const selectedPort = normalizeManualComPort($("#cam-port")?.value || "");
      if (selectedPort) {
        applyDetectedCamPort(selectedPort, selectedPort);
        await detectCamSerial({ autoStart: true, useSelected: true, scan: false });
        return;
      }
      await detectCamSerial({ autoStart: true, useSelected: false, scan: true });
    } catch {}
  }

  async function disconnectSerialBridge({ silent = false } = {}) {
    const hadSerialEvents = Boolean(serialEvents);
    if (serialEvents) {
      serialEvents.close();
      serialEvents = null;
    }
    clearAutoS3Connect();
    if (serialConnected || hadSerialEvents) {
      try {
        await fetchJson(apiUrl("/api/serial/disconnect"), { method: "POST" });
      } catch (error) {
        if (!silent) log(`Serial: ${error.message}`, "err");
      }
    }
    serialConnected = false;
    serialSendQueue = Promise.resolve();
    // Reopen the SSE channel so the ESP detector keeps working even when
    // no device is actively connected.
    ensureSerialEventsOpen();
  }

  function clearS3Reconnect() {
    if (s3ReconnectTimer) {
      clearTimeout(s3ReconnectTimer);
      s3ReconnectTimer = null;
    }
    s3ReconnectAttempt = 0;
  }

  function tryBatteryApFallback(failedUrl, reason = "fallo") {
    const fallbackUrl = normalizeS3WsUrl(S3_BATTERY_AP_WS_URL);
    if (!fallbackUrl || normalizeS3WsUrl(failedUrl) === fallbackUrl) return false;
    applyDetectedS3Url(fallbackUrl, `fallback ${reason}`);
    log(`Probando AP de bateria del S3: ${fallbackUrl}`, "sys");
    connectS3({ fromAuto: true, isRetry: true, triedBatteryAp: true });
    return true;
  }

  function scheduleS3Reconnect(url) {
    if (s3ManualDisconnect) return;
    if (!url) return;
    if (s3ReconnectTimer) return;
    s3ReconnectAttempt += 1;
    // 800ms → 1.2s → 1.8s → 2.7s → 3s (cap). Slow enough that we don't hammer
    // the ESP while its WiFi is still re-associating, fast enough to feel
    // instant from the UI.
    const delay = Math.min(800 * Math.pow(1.5, s3ReconnectAttempt - 1), 3000);        // Constante delay: constante usada en delay.
    // Llamada: ejecuta una accion del modulo actual.
    setStatus("#s3-status", "warn", `Reintentando ${s3ReconnectAttempt}`);
    s3ReconnectTimer = setTimeout(() => {                                             // Asignacion: actualiza estado o salida calculada.
      s3ReconnectTimer = null;                                                        // Asignacion: actualiza estado o salida calculada.
      if (s3ManualDisconnect) return;                                                 // Condicion: valida estado antes de continuar el flujo.
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return; // Condicion: valida estado antes de continuar el flujo.
      connectS3({ fromAuto: true, isRetry: true });                                   // Llamada: ejecuta una accion del modulo actual.
    }, delay);
  }

  async function connectS3Auto() {                                                    // Funcion connectS3Auto: gestiona conexion de s3 auto.
    if (s3Detecting) {                                                                // Condicion: valida estado antes de continuar el flujo.
      log("Ya estoy buscando la URL del ESP32-S3...", "sys");                         // Llamada: ejecuta una accion del modulo actual.
      return;                                                                         // Retorno: entrega el resultado al llamador.
    }

    s3Detecting = true;                                                               // Asignacion: actualiza estado o salida calculada.
    clearAutoS3Connect();                                                             // Llamada: ejecuta una accion del modulo actual.
    try {                                                                             // Bloque try: ejecuta una operacion que puede fallar.
      const detectedUrl = await detectS3Url();                                        // Constante detectedUrl: constante usada en detected url.
      if (detectedUrl) {                                                              // Condicion: valida estado antes de continuar el flujo.
        connectS3({ fromAuto: true });                                                // Llamada: ejecuta una accion del modulo actual.
        return;                                                                       // Retorno: entrega el resultado al llamador.
      }
      if (serialConnected) {                                                          // Condicion: si el firmware respondio por USB, no fuerza WebSocket.
        log("ESP32-S3 conectado por USB serial", "ok");                               // Llamada: ejecuta una accion del modulo actual.
        return;                                                                       // Retorno: entrega el resultado al llamador.
      }
      log("No detecte una URL activa; pruebo la URL escrita en el campo.", "warn");   // Llamada: ejecuta una accion del modulo actual.
      connectS3();                                                                    // Llamada: ejecuta una accion del modulo actual.
    } finally {
      s3Detecting = false;                                                            // Asignacion: actualiza estado o salida calculada.
    }
  }

  function connectS3(options = {}) {                                                  // Funcion connectS3: gestiona conexion de s3.
    const url = normalizeS3WsUrl($("#s3-url").value.trim());                          // Constante url: constante usada en url.
    state.connection.s3Url = url;                                                     // Asignacion: actualiza estado o salida calculada.
    if (!url) {                                                                       // Condicion: valida estado antes de continuar el flujo.
      log("URL del ESP32-S3 vacia", "err");                                           // Llamada: ejecuta una accion del modulo actual.
      return;                                                                         // Retorno: entrega el resultado al llamador.
    }
    $("#s3-url").value = url;                                                         // Llamada: ejecuta una accion del modulo actual.
    s3ManualDisconnect = false;                                                       // Asignacion: actualiza estado o salida calculada.
    if (!options.isRetry) clearS3Reconnect();                                         // Condicion: valida estado antes de continuar el flujo.
    // On user-initiated connect, tear down the serial bridge as before. On
    // auto-retry we want to keep serial state intact so we don't churn the COM
    // port every time WiFi flickers.
    disconnectS3({ silent: true, keepReconnect: Boolean(options.isRetry) });          // Llamada: ejecuta una accion del modulo actual.

    let socket;
    try {                                                                             // Bloque try: ejecuta una operacion que puede fallar.
      socket = new WebSocket(url);                                                    // Asignacion: actualiza estado o salida calculada.
      ws = socket;                                                                    // Asignacion: actualiza estado o salida calculada.
    } catch (error) {
      setStatus("#s3-status", "", "Error");                                           // Llamada: ejecuta una accion del modulo actual.
      // Llamada: ejecuta una accion del modulo actual.
      log(`No se pudo abrir WebSocket: ${error.message}`, "err");
      if (!options.triedBatteryAp && tryBatteryApFallback(url, "constructor")) return; // Condicion: valida estado antes de continuar el flujo.
      scheduleS3Reconnect(url);                                                       // Llamada: ejecuta una accion del modulo actual.
      return;                                                                         // Retorno: entrega el resultado al llamador.
    }

    let openedAt = 0;                                                                 // Estado openedAt: estado mutable de opened at.
    setStatus("#s3-status", "warn", "Conectando");                                    // Llamada: ejecuta una accion del modulo actual.
    socket.addEventListener("open", () => {                                           // Llamada: ejecuta una accion del modulo actual.
      if (ws !== socket) return;                                                      // Condicion: valida estado antes de continuar el flujo.
      openedAt = Date.now();                                                          // Asignacion: actualiza estado o salida calculada.
      setStatus("#s3-status", "ok", "Online");                                        // Llamada: ejecuta una accion del modulo actual.
      // Llamada: ejecuta una accion del modulo actual.
      log(`${options.fromAuto ? "Auto" : "Conectado"} a ${url}`, "ok");
      sendCommand({ type: "cmd_status" }, "Estado");                                  // Llamada: ejecuta una accion del modulo actual.
    });
    socket.addEventListener("message", (event) => {                                   // Llamada: ejecuta una accion del modulo actual.
      // Only consider the connection truly stable after we've actually received
      // data — that proves the round-trip works, not just the TCP handshake.
      if (ws === socket && openedAt && Date.now() - openedAt > 1500) {                // Condicion: valida estado antes de continuar el flujo.
        clearS3Reconnect();                                                           // Llamada: ejecuta una accion del modulo actual.
      }
      handleMessage(event.data, "websocket");                                         // Llamada: ejecuta una accion del modulo actual.
    });
    socket.addEventListener("error", () => {                                          // Llamada: ejecuta una accion del modulo actual.
      if (ws !== socket) return;                                                      // Condicion: valida estado antes de continuar el flujo.
      setStatus("#s3-status", "", "Error");                                           // Llamada: ejecuta una accion del modulo actual.
      log("Error WebSocket con ESP32-S3", "err");                                     // Llamada: ejecuta una accion del modulo actual.
    });
    socket.addEventListener("close", () => {                                          // Llamada: ejecuta una accion del modulo actual.
      if (ws !== socket) return;                                                      // Condicion: valida estado antes de continuar el flujo.
      const lifeMs = openedAt ? Date.now() - openedAt : 0;                            // Constante lifeMs: constante usada en life ms.
      ws = null;                                                                      // Asignacion: actualiza estado o salida calculada.
      if (s3ManualDisconnect) {                                                       // Condicion: valida estado antes de continuar el flujo.
        setStatus("#s3-status", "", "Offline");                                       // Llamada: ejecuta una accion del modulo actual.
        log("ESP32-S3 desconectado", "sys");                                          // Llamada: ejecuta una accion del modulo actual.
        return;                                                                       // Retorno: entrega el resultado al llamador.
      }
      if (!openedAt && !options.triedBatteryAp && tryBatteryApFallback(url, "conexion")) return; // Condicion: valida estado antes de continuar el flujo.
      // If the session died in under 5s, the link is flapping — keep the
      // backoff counter so we don't hammer with constant 800ms retries.
      if (lifeMs > 5000) s3ReconnectAttempt = 0;                                      // Condicion: valida estado antes de continuar el flujo.
      // Llamada: ejecuta una accion del modulo actual.
      log(`ESP32-S3 desconectado tras ${Math.round(lifeMs / 100) / 10}s, reintentando...`, "sys");
      scheduleS3Reconnect(url);                                                       // Llamada: ejecuta una accion del modulo actual.
    });
  }

  function connectS3BatteryAp() {                                                     // Funcion connectS3BatteryAp: gestiona conexion de s3 battery ap.
    applyDetectedS3Url(S3_BATTERY_AP_WS_URL, "Bateria AP");                           // Llamada: ejecuta una accion del modulo actual.
    connectS3();                                                                      // Llamada: ejecuta una accion del modulo actual.
  }

  function disconnectS3({ silent = false, keepReconnect = false } = {}) {             // Funcion disconnectS3: cierra conexion de s3.
    if (!keepReconnect) {                                                             // Condicion: valida estado antes de continuar el flujo.
      s3ManualDisconnect = true;                                                      // Asignacion: actualiza estado o salida calculada.
      clearS3Reconnect();                                                             // Llamada: ejecuta una accion del modulo actual.
    }
    clearAutoS3Connect();                                                             // Llamada: ejecuta una accion del modulo actual.
    if (ws) {                                                                         // Condicion: valida estado antes de continuar el flujo.
      ws.close();                                                                     // Llamada: ejecuta una accion del modulo actual.
      ws = null;                                                                      // Asignacion: actualiza estado o salida calculada.
    }
    if (!keepReconnect) disconnectSerialBridge({ silent });                           // Condicion: valida estado antes de continuar el flujo.
    if (!keepReconnect) setStatus("#s3-status", "", "Offline");                       // Condicion: valida estado antes de continuar el flujo.
    if (!silent && !keepReconnect) log("Conexion ESP32-S3 cerrada", "sys");           // Condicion: valida estado antes de continuar el flujo.
  }

  function sendCommand(payload, label = "Comando") {                                  // Funcion sendCommand: envia comandos JSON al controlador conectado.
    const json = JSON.stringify(payload);                                             // Constante json: constante usada en json.
    const markSent = () => {                                                          // Funcion flecha markSent: encapsula la logica de mark sent.
      if (payload?.type === "cmd_mode" && payload.mode) {                             // Condicion: valida estado antes de continuar el flujo.
        setDisplayedMode(payload.mode);                                               // Llamada: ejecuta una accion del modulo actual.
      }
    };

    if (ws && ws.readyState === WebSocket.OPEN) {                                     // Condicion: valida estado antes de continuar el flujo.
      ws.send(json);                                                                  // Llamada: ejecuta una accion del modulo actual.
      markSent();                                                                     // Llamada: ejecuta una accion del modulo actual.
      // Llamada: ejecuta una accion del modulo actual.
      log(`TX ${label}: ${json.length > 220 ? `${json.slice(0, 220)}...` : json}`, "tx");
      return true;                                                                    // Retorno: entrega el resultado al llamador.
    }

    if (serialConnected) {                                                            // Condicion: valida estado antes de continuar el flujo.
      serialSendQueue = serialSendQueue                                               // Asignacion: actualiza estado o salida calculada.
        .catch(() => {})
        .then(() => fetchJson(apiUrl("/api/serial/send"), {
          method: "POST",                                                             // Campo method: campo de datos para method.
          headers: { "Content-Type": "application/json" },                            // Campo headers: objeto anidado de configuracion.
          body: JSON.stringify({ payload })                                           // Campo body: campo de datos para body.
        }))
        .catch((error) => {
          appendSerialMonitorLine(`${label}: ${error.message}`, "err");
          log(`${label}: ${error.message}`, "err");
        });
      markSent();                                                                     // Llamada: ejecuta una accion del modulo actual.
      appendSerialMonitorLine(`TX ${label}: ${json.length > 220 ? `${json.slice(0, 220)}...` : json}`, "tx");
      // Llamada: ejecuta una accion del modulo actual.
      log(`TX ${label} COM: ${json.length > 220 ? `${json.slice(0, 220)}...` : json}`, "tx");
      return true;                                                                    // Retorno: entrega el resultado al llamador.
    }

    // Llamada: ejecuta una accion del modulo actual.
    log(`${label}: ESP32-S3 offline`, "err");
    return false;                                                                     // Retorno: entrega el resultado al llamador.
  }

  function handleMessage(raw, source = "websocket") {                                 // Funcion handleMessage: procesa paquetes de telemetria desde WebSocket o serial.
    let packet;
    try {                                                                             // Bloque try: ejecuta una operacion que puede fallar.
      packet = JSON.parse(raw);                                                       // Asignacion: actualiza estado o salida calculada.
    } catch {
      if (handleI2CSerialLine(raw)) return;                                           // Condicion: valida estado antes de continuar el flujo.
      if (handleEspBootSerialLine(raw)) return;                                       // Condicion: valida estado antes de continuar el flujo.
      const detectedUrl = serialTextS3WsUrl(raw);                                     // Constante detectedUrl: constante usada en detected url.
      if (detectedUrl) {                                                              // Condicion: valida estado antes de continuar el flujo.
        applyDetectedS3Url(detectedUrl, source, { autoConnect: source === "serial" }); // Llamada: ejecuta una accion del modulo actual.
      }
      const detectedCamUrl = serialTextCamStreamUrl(raw);                             // Constante detectedCamUrl: constante usada en camara y video.
      if (detectedCamUrl) {                                                           // Condicion: valida estado antes de continuar el flujo.
        applyDetectedCamUrl(detectedCamUrl, source, { autoStart: source === "serial" }); // Llamada: ejecuta una accion del modulo actual.
      }
      // Llamada: ejecuta una accion del modulo actual.
      log(`RX no JSON: ${String(raw).slice(0, 160)}`, "rx");
      return;                                                                         // Retorno: entrega el resultado al llamador.
    }

    state.telemetry.packets += 1;
    state.telemetry.lastPacketAt = Date.now();                                        // Asignacion: actualiza estado o salida calculada.

    document.dispatchEvent(new CustomEvent("vesta-rx", { detail: packet }));          // Llamada: ejecuta una accion del modulo actual.

    const detectedUrl = packetS3WsUrl(packet);                                        // Constante detectedUrl: constante usada en detected url.
    if (detectedUrl) {                                                                // Condicion: valida estado antes de continuar el flujo.
      applyDetectedS3Url(detectedUrl, source, { autoConnect: source === "serial" });  // Llamada: ejecuta una accion del modulo actual.
    }

    const detectedCamUrl = packetCamStreamUrl(packet);                                // Constante detectedCamUrl: constante usada en camara y video.
    if (detectedCamUrl) {                                                             // Condicion: valida estado antes de continuar el flujo.
      applyDetectedCamUrl(detectedCamUrl, source);                                    // Llamada: ejecuta una accion del modulo actual.
    }

    if (packet.type === "ack") {                                                      // Condicion: valida estado antes de continuar el flujo.
      if (packet.fw) $("#firmware-version").value = packet.fw;                        // Condicion: valida estado antes de continuar el flujo.
      if (packet.fw) state.metadata.firmware = packet.fw;                             // Condicion: valida estado antes de continuar el flujo.
      if (typeof packet.armed === "boolean") state.telemetry.armed = packet.armed;    // Condicion: sincroniza compuerta de PWM de servos.
      if (typeof packet.sensorless === "boolean") state.telemetry.sensorless = packet.sensorless; // Condicion: sincroniza prueba manual sin sensores.
      if (Array.isArray(packet.links)) updateSensorLinks(packet.links);               // Condicion: valida estado antes de continuar el flujo.
      // Llamada: ejecuta una accion del modulo actual.
      log(`ACK ${packet.fw || ""} ${packet.model || ""}`.trim(), "rx");
    } else if (packet.type === "sensors" || Array.isArray(packet.servos)) {
      updateFromTelemetry(packet);                                                    // Llamada: ejecuta una accion del modulo actual.
    } else if (packet.type === "i2c_diag") {
      updateI2CDiagnostic(packet);                                                    // Llamada: ejecuta una accion del modulo actual.
      log(packet.summary || "Diagnostico I2C recibido", Number(packet.okCount || 0) >= 4 ? "ok" : "warn"); // Llamada: ejecuta una accion del modulo actual.
    } else if (packet.type === "error") {
      log(packet.message || "Error reportado por ESP32", "err");                      // Llamada: ejecuta una accion del modulo actual.
    } else {
      // Llamada: ejecuta una accion del modulo actual.
      log(`RX ${JSON.stringify(packet).slice(0, 220)}`, "rx");
    }

    updateProfilePreview();                                                           // Llamada: ejecuta una accion del modulo actual.
  }

  function updateSensorLinks(links) {                                                 // Funcion updateSensorLinks: actualiza sensor links.
    links.forEach((link) => {                                                         // Llamada: ejecuta una accion del modulo actual.
      const servo = state.servos.find((item) => item.id === Number(link.servoId));    // Constante servo: constante usada en control angular de servos.
      if (!servo || !link.source) return;                                             // Condicion: valida estado antes de continuar el flujo.
      servo.sensorLabel = String(link.source);                                        // Asignacion: actualiza estado o salida calculada.
    });
    renderServoTable();                                                               // Llamada: ejecuta una accion del modulo actual.
    renderManualPanel();                                                              // Llamada: ejecuta una accion del modulo actual.
  }

  function updateFromTelemetry(packet) {                                              // Funcion updateFromTelemetry: sincroniza estado local con la telemetria del S3.
    const sampledAt = Date.now();                                                     // Constante sampledAt: constante usada en sampled at.
    if (packet.mode) setDisplayedMode(packet.mode);                                   // Condicion: valida estado antes de continuar el flujo.
    state.telemetry.emergency = Boolean(packet.emergency);                            // Asignacion: actualiza estado o salida calculada.
    if (typeof packet.armed === "boolean") {                                          // Condicion: sincroniza compuerta de PWM de servos.
      state.telemetry.armed = packet.armed;                                           // Asignacion: actualiza estado o salida calculada.
    }
    if (typeof packet.assist === "number") {                                          // Condicion: valida estado antes de continuar el flujo.
      state.tuning.assistLevel = clamp(packet.assist, 0, 1);                          // Asignacion: actualiza estado o salida calculada.
      $("#assist-level").value = String(state.tuning.assistLevel);                    // Llamada: ejecuta una accion del modulo actual.
      updateTuningLabels();                                                           // Llamada: ejecuta una accion del modulo actual.
    }
    if (typeof packet.smoothing === "number") {                                       // Condicion: sincroniza suavizado confirmado por firmware.
      state.tuning.smoothing = clamp(packet.smoothing, 0.05, 1);                      // Asignacion: actualiza estado o salida calculada.
      $("#smoothing").value = String(state.tuning.smoothing);                         // Llamada: actualiza control de suavizado.
    }
    if (typeof packet.maxSpeedDegSec === "number") {                                  // Condicion: sincroniza velocidad confirmada por firmware.
      state.tuning.maxSpeedDegSec = clamp(packet.maxSpeedDegSec, 5, 2400);            // Asignacion: actualiza estado o salida calculada.
      $("#max-speed").value = String(state.tuning.maxSpeedDegSec);                    // Llamada: actualiza control de velocidad.
    }
    if (typeof packet.pcaOnline === "boolean") {                                      // Condicion: informa presencia del PCA9685.
      const previousPca = state.telemetry.pcaOnline;                                  // Constante previousPca: estado previo del driver PWM.
      state.telemetry.pcaOnline = packet.pcaOnline;                                   // Asignacion: actualiza estado o salida calculada.
      if (packet.pcaOnline === false && previousPca !== false) {                      // Condicion: evita repetir el mismo aviso en cada paquete.
        log("PCA9685 no detectado: revisa VCC, SDA/SCL GPIO8/9, OE a GND y tierra comun con los servos.", "err");
      }
    }
    if (typeof packet.sensorless === "boolean") {                                     // Condicion: sincroniza modo de prueba sin sensores.
      state.telemetry.sensorless = packet.sensorless;                                 // Asignacion: actualiza estado o salida calculada.
    }
    if (packet.battery) state.telemetry.battery = packet.battery;                     // Condicion: valida estado antes de continuar el flujo.

    (packet.servos || []).forEach((item) => {
      const servo = state.servos.find((s) => s.id === Number(item.id));               // Constante servo: constante usada en control angular de servos.
      if (!servo) return;                                                             // Condicion: valida estado antes de continuar el flujo.
      servo.liveAngle = numberValue(item.angle, servo.liveAngle);                     // Asignacion: actualiza estado o salida calculada.
      servo.liveTarget = numberValue(item.target, servo.liveTarget ?? servo.testAngle); // Asignacion: guarda objetivo confirmado por firmware.
      servo.livePwm = numberValue(item.pwm, servo.livePwm ?? 0);                      // Asignacion: guarda pulso PWM confirmado por firmware.
      updateServoSensorReading(servo, item.sensor, sampledAt);                        // Llamada: ejecuta una accion del modulo actual.
      if (item.sensorSource) servo.sensorLabel = String(item.sensorSource);           // Condicion: valida estado antes de continuar el flujo.
      servo.moving = Boolean(item.moving) || Math.abs(servo.liveSensorSpeed) >= 1;    // Asignacion: actualiza estado o salida calculada.
      syncLinkedSensorState(servo, item);                                             // Llamada: ejecuta una accion del modulo actual.
    });
    updateLive();                                                                     // Llamada: ejecuta una accion del modulo actual.
  }

  async function checkCameraReachable(url) {                                          // Funcion checkCameraReachable: encapsula la logica de camara y video.
    return fetchJson("/api/cam/check", {                                              // Retorno: entrega el resultado al llamador.
      method: "POST",                                                                 // Campo method: campo de datos para method.
      headers: { "Content-Type": "application/json" },                                // Campo headers: objeto anidado de configuracion.
      body: JSON.stringify({ url }),                                                  // Campo body: campo de datos para body.
      timeoutMs: 7000                                                                 // Campo timeoutMs: campo de datos para timeout ms.
    });
  }

  async function connectCamFallbackWifi() {                                           // Funcion connectCamFallbackWifi: gestiona conexion de cam fallback wifi.
    return fetchJson("/api/wifi/connect-cam", {                                       // Retorno: entrega el resultado al llamador.
      method: "POST",                                                                 // Campo method: campo de datos para method.
      headers: { "Content-Type": "application/json" },                                // Campo headers: objeto anidado de configuracion.
      body: JSON.stringify({ ssid: "VESTA-CAM-SETUP", password: "vesta1234" }),       // Campo body: campo de datos para body.
      timeoutMs: 30000                                                                // Campo timeoutMs: campo de datos para timeout ms.
    });
  }

  async function restoreWifiAfterCam() {                                              // Funcion restoreWifiAfterCam: encapsula la logica de camara y video.
    try {                                                                             // Bloque try: ejecuta una operacion que puede fallar.
      const result = await fetchJson("/api/wifi/restore", {                           // Constante result: constante usada en result.
        method: "POST",                                                               // Campo method: campo de datos para method.
        timeoutMs: 15000                                                              // Campo timeoutMs: campo de datos para timeout ms.
      });
      if (result.output) log(result.output, "sys");                                   // Condicion: valida estado antes de continuar el flujo.
    } catch (error) {
      // Llamada: ejecuta una accion del modulo actual.
      log(`WiFi: ${error.message}`, "err");
    }
  }

  function clearCameraTimers() {                                                      // Funcion clearCameraTimers: limpia camera timers.
    if (cameraFirstFrameTimer) {                                                      // Condicion: valida estado antes de continuar el flujo.
      clearTimeout(cameraFirstFrameTimer);                                            // Llamada: ejecuta una accion del modulo actual.
      cameraFirstFrameTimer = null;                                                   // Asignacion: actualiza estado o salida calculada.
    }
    if (cameraRetryTimer) {                                                           // Condicion: valida estado antes de continuar el flujo.
      clearTimeout(cameraRetryTimer);                                                 // Llamada: ejecuta una accion del modulo actual.
      cameraRetryTimer = null;                                                        // Asignacion: actualiza estado o salida calculada.
    }
  }

  function cameraRecordMimeType() {
    if (!window.MediaRecorder?.isTypeSupported) return "";
    return [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm"
    ].find((type) => MediaRecorder.isTypeSupported(type)) || "";
  }

  function updateCameraRecordButton(recording) {
    const button = $("#btn-cam-record");
    if (!button) return;
    button.textContent = recording ? "Detener grab." : "Grabar";
    button.classList.toggle("danger", recording);
    button.setAttribute("aria-pressed", recording ? "true" : "false");
  }

  function cameraRecordFileName() {
    const stamp = new Date().toISOString()
      .replace(/\.\d+Z$/, "")
      .replace(/[-:]/g, "")
      .replace("T", "-");
    return `vesta-cam-${stamp}.webm`;
  }

  function downloadCameraRecording(blob) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = cameraRecordFileName();
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    log(`CAM: grabacion guardada (${Math.round(blob.size / 1024)} KB)`, "ok");
  }

  function drawCameraRecordFrame(img, canvas, ctx) {
    if (!img?.naturalWidth || !img?.naturalHeight) return false;
    try {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return true;
    } catch (error) {
      log(`CAM: no se pudo capturar frame (${error.message})`, "warn");
      return false;
    }
  }

  function stopCameraRecording(save = true) {
    if (cameraRecordTimer) {
      clearInterval(cameraRecordTimer);
      cameraRecordTimer = null;
    }

    const recorder = cameraRecorder;
    const chunks = cameraRecordChunks;
    cameraRecorder = null;
    cameraRecordChunks = [];
    cameraRecordCanvas = null;
    updateCameraRecordButton(false);
    if (!recorder) return;

    recorder.onstop = () => {
      recorder.stream?.getTracks?.().forEach((track) => track.stop());
      if (save && chunks.length) {
        const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
        downloadCameraRecording(blob);
      } else if (save) {
        log("CAM: no hubo frames para guardar", "warn");
      }
      setStatus("#cam-status", cameraActiveUrl ? "ok" : "", cameraActiveUrl ? "Online" : "Offline");
    };

    try {
      if (recorder.state === "recording") recorder.requestData();
      if (recorder.state !== "inactive") recorder.stop();
      else recorder.onstop();
    } catch (error) {
      log(`CAM: no se pudo detener grabacion (${error.message})`, "warn");
      recorder.onstop();
    }
  }

  function startCameraRecording() {
    const img = $("#cam-stream");
    if (!cameraActiveUrl || !img?.naturalWidth || !img?.naturalHeight) {
      log("CAM: inicia el video antes de grabar", "warn");
      return;
    }
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
      log("CAM: este navegador no soporta grabacion WebM", "warn");
      return;
    }

    const scale = Math.min(1, CAMERA_RECORD_MAX_WIDTH / img.naturalWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx || !drawCameraRecordFrame(img, canvas, ctx)) return;

    const chunks = [];
    const stream = canvas.captureStream(CAMERA_RECORD_FPS);
    const mimeType = cameraRecordMimeType();
    let recorder;
    try {
      recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: 900000
      });
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      log(`CAM: no se pudo iniciar grabacion (${error.message})`, "warn");
      return;
    }

    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunks.push(event.data);
    };
    recorder.onerror = (event) => {
      log(`CAM: grabacion detenida (${event.error?.message || "error"})`, "warn");
      stopCameraRecording(false);
    };

    cameraRecorder = recorder;
    cameraRecordChunks = chunks;
    cameraRecordCanvas = canvas;
    cameraRecordTimer = setInterval(() => {
      if (!cameraActiveUrl) {
        stopCameraRecording(false);
        return;
      }
      drawCameraRecordFrame(img, canvas, ctx);
    }, Math.round(1000 / CAMERA_RECORD_FPS));

    recorder.start(1000);
    updateCameraRecordButton(true);
    setStatus("#cam-status", "warn", "Grabando");
    log("CAM: grabando en el navegador", "ok");
  }

  function toggleCameraRecording() {
    if (cameraRecorder) stopCameraRecording(true);
    else startCameraRecording();
  }

  function markCameraFrameVisible(url, img, box, placeholder) {                       // Funcion markCameraFrameVisible: encapsula la logica de camara y video.
    if (cameraActiveUrl !== url) return false;                                        // Condicion: valida estado antes de continuar el flujo.
    if (!img.naturalWidth || !img.naturalHeight) return false;                        // Condicion: valida estado antes de continuar el flujo.
    img.dataset.camLastFrameAt = String(Date.now());
    if (cameraFirstFrameTimer) {                                                      // Condicion: valida estado antes de continuar el flujo.
      clearTimeout(cameraFirstFrameTimer);                                            // Llamada: ejecuta una accion del modulo actual.
      cameraFirstFrameTimer = null;                                                   // Asignacion: actualiza estado o salida calculada.
    }
    img.dataset.retryCount = "0";                                                     // Asignacion: actualiza estado o salida calculada.
    delete img.dataset.camLastError;
    if (placeholder) placeholder.textContent = "CAM";                                 // Condicion: valida estado antes de continuar el flujo.
    box.classList.remove("loading");                                                  // Llamada: ejecuta una accion del modulo actual.
    box.classList.add("active");                                                      // Llamada: ejecuta una accion del modulo actual.
    if (!cameraRecorder) setStatus("#cam-status", "ok", "Online");                    // Llamada: ejecuta una accion del modulo actual.
    return true;                                                                      // Retorno: entrega el resultado al llamador.
  }

  function watchCameraFirstFrame(url, img, box, placeholder, startedAt = Date.now()) { // Funcion watchCameraFirstFrame: encapsula la logica de camara y video.
    if (cameraActiveUrl !== url) return;                                              // Condicion: valida estado antes de continuar el flujo.
    if (markCameraFrameVisible(url, img, box, placeholder)) return;                    // Condicion: valida estado antes de continuar el flujo.
    if (Date.now() - startedAt >= CAMERA_FIRST_FRAME_TIMEOUT_MS) {                    // Condicion: valida estado antes de continuar el flujo.
      if (placeholder) placeholder.textContent = "RECONECTANDO";                      // Condicion: valida estado antes de continuar el flujo.
      setStatus("#cam-status", "warn", "Reconectando");                               // Llamada: ejecuta una accion del modulo actual.
      log(                                                                            // Llamada: ejecuta una accion del modulo actual.
        isCamUsbStreamUrl(url)                                                        // Llamada: ejecuta una accion del modulo actual.
          ? "CAM USB: no llego el primer frame, reabriendo el stream"
          : "CAM: no llego el primer frame, reabriendo el stream",
        "sys"
      );
      recoverCamStreamAfterImageError(url, img, box, placeholder);                    // Llamada: ejecuta una accion del modulo actual.
      return;                                                                         // Retorno: entrega el resultado al llamador.
    }
    cameraFirstFrameTimer = setTimeout(                                               // Asignacion: actualiza estado o salida calculada.
      () => watchCameraFirstFrame(url, img, box, placeholder, startedAt),
      CAMERA_FIRST_FRAME_POLL_MS
    );
  }

  function openCameraStream(url, img, box, placeholder) {                             // Funcion openCameraStream: encapsula la logica de camara y video.
    if (cameraActiveUrl !== url) return;                                              // Condicion: valida estado antes de continuar el flujo.
    if (placeholder) placeholder.textContent = "CARGANDO";                            // Condicion: valida estado antes de continuar el flujo.
    box.classList.remove("active");                                                   // Llamada: ejecuta una accion del modulo actual.
    box.classList.add("loading");                                                     // Llamada: ejecuta una accion del modulo actual.
    setStatus("#cam-status", "warn", "Cargando");                                     // Llamada: ejecuta una accion del modulo actual.
    img.removeAttribute("src");                                                       // Llamada: ejecuta una accion del modulo actual.
    img.dataset.camLastFrameAt = "0";                                                 // Asignacion: actualiza estado o salida calculada.
    if (cameraFirstFrameTimer) {                                                      // Condicion: valida estado antes de continuar el flujo.
      clearTimeout(cameraFirstFrameTimer);                                            // Llamada: ejecuta una accion del modulo actual.
      cameraFirstFrameTimer = null;                                                   // Asignacion: actualiza estado o salida calculada.
    }
    const source = camStreamProxyUrl(url);                                            // Constante source: constante usada en source.
    img.src = source;                                                                 // Asignacion: el navegador decodifica MJPEG directamente.
    watchCameraFirstFrame(url, img, box, placeholder);                                // Llamada: ejecuta una accion del modulo actual.
  }

  async function finishCameraFailure(url, img, box, placeholder) {                    // Funcion finishCameraFailure: encapsula la logica de camara y video.
    if (cameraActiveUrl !== url) return;                                              // Condicion: valida estado antes de continuar el flujo.
    const runId = img.dataset.cameraRun || "";                                        // Constante runId: constante usada en run id.
    let statusText = "Sin imagen";                                                    // Estado statusText: estado mutable de status text.
    let message = isCamFallbackApUrl(url)                                             // Estado message: estado mutable de message.
      ? "No se pudo cargar stream ESP32-CAM: usa USB/COM o conecta esta PC a VESTA-CAM-SETUP."
      : "No se pudo cargar stream ESP32-CAM";

    try {                                                                             // Bloque try: ejecuta una operacion que puede fallar.
      const check = await checkCameraReachable(url);                                  // Constante check: constante usada en diagnostico y pruebas.
      if (cameraActiveUrl !== url || img.dataset.cameraRun !== runId) return;         // Condicion: valida estado antes de continuar el flujo.
      if (check?.output) message = check.output;                                      // Condicion: valida estado antes de continuar el flujo.
      if (isCamUsbFirmwareBlocked(url, message)) statusText = "Firmware CAM";         // Condicion: valida estado antes de continuar el flujo.
    } catch (error) {
      if (error?.message) message = error.message;                                    // Condicion: valida estado antes de continuar el flujo.
    }
    if (cameraActiveUrl !== url || img.dataset.cameraRun !== runId) return;           // Condicion: valida estado antes de continuar el flujo.

    box.classList.remove("active", "loading");                                        // Llamada: ejecuta una accion del modulo actual.
    img.removeAttribute("src");                                                       // Llamada: ejecuta una accion del modulo actual.
    if (placeholder) placeholder.textContent = "SIN VIDEO";                           // Condicion: valida estado antes de continuar el flujo.
    setStatus("#cam-status", "warn", statusText);                                     // Llamada: ejecuta una accion del modulo actual.
    if (img.dataset.camLastError !== message) log(message, "err");                    // Condicion: valida estado antes de continuar el flujo.
    img.dataset.camLastError = message;                                               // Asignacion: actualiza estado o salida calculada.
  }

  async function recoverCamStreamAfterImageError(url, img, box, placeholder) {        // Funcion recoverCamStreamAfterImageError: encapsula la logica de camara y video.
    if (cameraActiveUrl !== url) return;                                              // Condicion: valida estado antes de continuar el flujo.
    if (cameraRetryTimer) return;                                                     // Condicion: valida estado antes de continuar el flujo.
    if (cameraFirstFrameTimer) {                                                      // Condicion: valida estado antes de continuar el flujo.
      clearTimeout(cameraFirstFrameTimer);                                            // Llamada: ejecuta una accion del modulo actual.
      cameraFirstFrameTimer = null;                                                   // Asignacion: actualiza estado o salida calculada.
    }

    const retries = Number(img.dataset.retryCount || 0) + 1;                          // Constante retries: constante usada en retries.
    img.dataset.retryCount = String(retries);                                         // Asignacion: actualiza estado o salida calculada.
    const fallbackUrl = retries >= 2 ? camUsbStableFallbackUrl(url) : "";             // Constante fallbackUrl: constante usada en fallback url.
    if (fallbackUrl) {                                                                // Condicion: valida estado antes de continuar el flujo.
      cameraActiveUrl = fallbackUrl;                                                  // Asignacion: actualiza estado o salida calculada.
      state.connection.camUrl = fallbackUrl;                                          // Asignacion: actualiza estado o salida calculada.
      const input = $("#cam-url");                                                    // Referencia input: nodo o coleccion DOM usada por la UI.
      if (input) input.value = fallbackUrl;                                           // Condicion: valida estado antes de continuar el flujo.
      img.dataset.retryCount = "0";                                                   // Asignacion: actualiza estado o salida calculada.
      // Llamada: ejecuta una accion del modulo actual.
      log(`CAM USB: bajando a ${CAM_USB_FALLBACK_STREAM_BAUD} baud para estabilizar video`, "sys");
      markDirty();                                                                    // Llamada: ejecuta una accion del modulo actual.
      cameraRetryTimer = setTimeout(() => {                                           // Asignacion: actualiza estado o salida calculada.
        cameraRetryTimer = null;                                                      // Asignacion: actualiza estado o salida calculada.
        if (cameraActiveUrl !== fallbackUrl) return;                                  // Condicion: valida estado antes de continuar el flujo.
        openCameraStream(fallbackUrl, img, box, placeholder);                         // Llamada: ejecuta una accion del modulo actual.
      }, 450);
      return;                                                                         // Retorno: entrega el resultado al llamador.
    }
    if (retries > CAMERA_RETRY_LIMIT) {                                               // Condicion: valida estado antes de continuar el flujo.
      await finishCameraFailure(url, img, box, placeholder);                          // Espera asincrona: coordina una operacion externa.
      return;                                                                         // Retorno: entrega el resultado al llamador.
    }

    img.removeAttribute("src");                                                       // Llamada: ejecuta una accion del modulo actual.
    box.classList.remove("active");                                                   // Llamada: ejecuta una accion del modulo actual.
    box.classList.add("loading");                                                     // Llamada: ejecuta una accion del modulo actual.
    if (placeholder) placeholder.textContent = "RECONECTANDO";                        // Condicion: valida estado antes de continuar el flujo.
    // Llamada: ejecuta una accion del modulo actual.
    setStatus("#cam-status", "warn", `Reintento ${retries}`);

    cameraRetryTimer = setTimeout(() => {                                             // Asignacion: actualiza estado o salida calculada.
      cameraRetryTimer = null;                                                        // Asignacion: actualiza estado o salida calculada.
      if (cameraActiveUrl !== url) return;                                            // Condicion: valida estado antes de continuar el flujo.
      openCameraStream(url, img, box, placeholder);                                   // Llamada: ejecuta una accion del modulo actual.
    }, Math.min(700 + retries * 650, 3200));
  }

  async function startCamera() {                                                      // Funcion startCamera: abre el flujo de video de la ESP32-CAM.
    const url = normalizeCamStreamUrl($("#cam-url").value.trim());                    // Constante url: constante usada en url.
    state.connection.camUrl = url;                                                    // Asignacion: actualiza estado o salida calculada.
    if (!url) {                                                                       // Condicion: valida estado antes de continuar el flujo.
      log("URL de ESP32-CAM vacia", "err");                                           // Llamada: ejecuta una accion del modulo actual.
      return;                                                                         // Retorno: entrega el resultado al llamador.
    }
    $("#cam-url").value = url;                                                        // Llamada: ejecuta una accion del modulo actual.
    if (cameraRecorder) stopCameraRecording(true);
    const img = $("#cam-stream");                                                     // Referencia img: nodo o coleccion DOM usada por la UI.
    const box = $(".camera-box");                                                     // Referencia box: nodo o coleccion DOM usada por la UI.
    const placeholder = $("#cam-placeholder");                                        // Referencia placeholder: nodo o coleccion DOM usada por la UI.
    clearCameraTimers();                                                              // Llamada: ejecuta una accion del modulo actual.
    cameraActiveUrl = url;                                                            // Asignacion: actualiza estado o salida calculada.
    img.dataset.cameraRun = String(++cameraRunId);                                    // Asignacion: actualiza estado o salida calculada.
    img.dataset.retryCount = "0";                                                     // Asignacion: actualiza estado o salida calculada.
    delete img.dataset.camLastError;
    img.crossOrigin = "anonymous";                                                    // Asignacion: actualiza estado o salida calculada.
    img.decoding = "async";                                                           // Asignacion: actualiza estado o salida calculada.
    img.onload = () => {                                                              // Asignacion: actualiza estado o salida calculada.
      markCameraFrameVisible(url, img, box, placeholder);                             // Llamada: ejecuta una accion del modulo actual.
    };
    img.onerror = () => {                                                             // Asignacion: actualiza estado o salida calculada.
      if (cameraActiveUrl !== url) return;                                            // Condicion: valida estado antes de continuar el flujo.
      if (cameraFirstFrameTimer) {                                                    // Condicion: valida estado antes de continuar el flujo.
        clearTimeout(cameraFirstFrameTimer);                                          // Llamada: ejecuta una accion del modulo actual.
        cameraFirstFrameTimer = null;                                                 // Asignacion: actualiza estado o salida calculada.
      }
      recoverCamStreamAfterImageError(url, img, box, placeholder);                    // Llamada: ejecuta una accion del modulo actual.
    };
    // Llamada: ejecuta una accion del modulo actual.
    log(`Stream CAM: ${url}`, "sys");
    markDirty();                                                                      // Llamada: ejecuta una accion del modulo actual.
    openCameraStream(url, img, box, placeholder);                                     // Llamada: ejecuta una accion del modulo actual.
  }

  function stopCamera() {                                                             // Funcion stopCamera: detiene timers, conexiones y recursos del video.
    clearCameraTimers();                                                              // Llamada: ejecuta una accion del modulo actual.
    stopCameraRecording(true);
    cameraActiveUrl = "";                                                             // Asignacion: actualiza estado o salida calculada.
    const img = $("#cam-stream");                                                     // Referencia img: nodo o coleccion DOM usada por la UI.
    img.onload = null;                                                                // Asignacion: actualiza estado o salida calculada.
    img.onerror = null;                                                               // Asignacion: actualiza estado o salida calculada.
    img.removeAttribute("src");                                                       // Llamada: ejecuta una accion del modulo actual.
    delete img.dataset.cameraRun;
    delete img.dataset.camLastFrameAt;
    $(".camera-box").classList.remove("active", "loading");                           // Llamada: ejecuta una accion del modulo actual.
    $("#cam-placeholder").textContent = "CAM";                                        // Llamada: ejecuta una accion del modulo actual.
    setStatus("#cam-status", "", "Offline");                                          // Llamada: ejecuta una accion del modulo actual.
    log("Stream CAM detenido", "sys");                                                // Llamada: ejecuta una accion del modulo actual.
  }

  function sendAngle(id, angle) {                                                     // Funcion sendAngle: envia un objetivo angular para un servo.
    const servo = state.servos.find((item) => item.id === id);                        // Constante servo: constante usada en control angular de servos.
    if (!servo) return;                                                               // Condicion: valida estado antes de continuar el flujo.
    const safeAngle = clamp(angle, servo.minAngle, servo.maxAngle);                   // Constante safeAngle: constante usada en control angular de servos.
    if (state.telemetry.mode !== "manual") {                                          // Condicion: valida estado antes de continuar el flujo.
      sendCommand({ type: "cmd_mode", mode: "manual" }, "Modo manual");               // Llamada: ejecuta una accion del modulo actual.
    }
    sendCommand(                                                                      // Llamada: ejecuta una accion del modulo actual.
      { type: "cmd_angle", id, angle: round(safeAngle, 2), servo: servoCommandProfile(servo) }, // Elemento: entrada de objeto dentro de una lista de datos.
      `${servo.short} ${round(safeAngle, 1)} deg`
    );
  }

  function servoCommandProfile(servo) {                                               // Funcion servoCommandProfile: encapsula la logica de control angular de servos.
    const minAngle = clamp(numberValue(servo.minAngle, 0), 0, 270);                  // Constante minAngle: limite inferior seguro del servo.
    const maxAngle = clamp(numberValue(servo.maxAngle, minAngle + 1), minAngle + 1, 270); // Constante maxAngle: limite superior seguro del servo.
    const pwm0 = safePwmValue(servo.pwmAt0, 102);                                    // Constante pwm0: pulso seguro para 0 grados.
    let pwm270 = safePwmValue(servo.pwmAt270, 512);                                  // Estado pwm270: pulso seguro para 270 grados.
    if (Math.abs(pwm270 - pwm0) < 10) pwm270 = pwm0 <= 350 ? 512 : 102;              // Condicion: evita rango PWM plano.
    return {                                                                          // Retorno: entrega el resultado al llamador.
      id: servo.id,                                                                   // Campo id: campo de datos para id.
      channel: Math.round(clamp(numberValue(servo.channel, servo.id), 0, 15)),        // Campo channel: campo de datos para channel.
      angle: {                                                                        // Campo angle: objeto anidado de configuracion.
        min: minAngle,                                                                // Campo min: campo de datos para min.
        max: maxAngle,                                                                // Campo max: campo de datos para max.
        home: clamp(numberValue(servo.homeAngle, minAngle), minAngle, maxAngle),      // Campo home: campo de datos para home.
        direction: servo.direction,                                                   // Campo direction: campo de datos para direction.
        mechanicalOffset: clamp(numberValue(servo.mechanicalOffset, 0), -90, 90)      // Campo mechanicalOffset: campo de datos para mechanical offset.
      },
      pwm: {                                                                          // Campo pwm: objeto anidado de configuracion.
        at0deg: pwm0,                                                                 // Campo at0deg: campo de datos para control angular de servos.
        at270deg: pwm270                                                              // Campo at270deg: campo de datos para control angular de servos.
      }
    };
  }

  function sendHomes() {                                                              // Funcion sendHomes: envia homes.
    sendCommand({ type: "cmd_mode", mode: "manual" }, "Modo manual");                 // Llamada: ejecuta una accion del modulo actual.
    state.servos.forEach((servo) => sendAngle(servo.id, servo.homeAngle));            // Llamada: ejecuta una accion del modulo actual.
  }

  function mappedTarget(servo) {                                                      // Funcion mappedTarget: encapsula la logica de mapped target.
    const sensor = getSensorForServo(servo);                                          // Constante sensor: constante usada en sensor.
    const live = servo.liveSensor;                                                    // Constante live: constante usada en live.
    const neutral = sensor?.neutralDeg || 0;                                          // Constante neutral: constante usada en neutral.
    const invert = sensor?.invert ? -1 : 1;                                           // Constante invert: constante usada en invert.
    let delta = (live - neutral) * invert;                                            // Estado delta: estado mutable de delta.
    if (Math.abs(delta) < state.tuning.deadbandDeg) delta = 0;                        // Condicion: valida estado antes de continuar el flujo.
    const assisted = delta * (1 + state.tuning.assistLevel);                          // Constante assisted: constante usada en assisted.
    const target = servo.homeAngle + assisted * servo.direction + servo.mechanicalOffset; // Constante target: constante usada en target.
    return clamp(target, servo.minAngle, servo.maxAngle);                             // Retorno: entrega el resultado al llamador.
  }

  function getSensorForServo(servo) {                                                 // Funcion getSensorForServo: obtiene sensor for servo.
    return state.imus.find((item) => item.key === servo.sensorKey) ||                 // Retorno: entrega el resultado al llamador.
      state.as5600.find((item) => item.key === servo.sensorKey) ||                      // Llamada: ejecuta una accion del modulo actual.
      null;
  }

  function sendMappedTargets() {                                                      // Funcion sendMappedTargets: envia mapped targets.
    sendCommand({ type: "cmd_mode", mode: "manual" }, "Modo manual");                 // Llamada: ejecuta una accion del modulo actual.
    state.servos.forEach((servo) => sendAngle(servo.id, mappedTarget(servo)));        // Llamada: ejecuta una accion del modulo actual.
  }

  function sendServoProfile() {                                                       // Funcion sendServoProfile: envia servo profile.
    sendCommand({ type: "cmd_calibration_servos", servos: profileServos() }, "Perfil servos"); // Llamada: ejecuta una accion del modulo actual.
  }

  function sendSensorProfile() {                                                      // Funcion sendSensorProfile: envia sensor profile.
    sendCommand({ type: "cmd_calibration_sensors", imus: profileImus(), as5600: profileAs5600() }, "Perfil sensores"); // Llamada: ejecuta una accion del modulo actual.
  }

  function sendMapProfile() {                                                         // Funcion sendMapProfile: envia map profile.
    sendCommand({ type: "cmd_calibration_mapping", tuning: { ...state.tuning } }, "Perfil mapeo"); // Llamada: ejecuta una accion del modulo actual.
  }

  function sendFullProfile() {                                                        // Funcion sendFullProfile: envia full profile.
    sendCommand({ type: "cmd_calibration_profile", profile: buildProfile() }, "Perfil completo"); // Llamada: ejecuta una accion del modulo actual.
  }

  function profileServos() {                                                          // Funcion profileServos: encapsula la logica de control angular de servos.
    return state.servos.map((servo) => {                                              // Retorno: entrega el resultado al llamador.
      const command = servoCommandProfile(servo);                                     // Constante command: perfil saneado que acepta el firmware.
      return {                                                                        // Retorno: entrega el resultado al llamador.
        id: servo.id,                                                                 // Campo id: campo de datos para id.
        key: servo.key,                                                               // Campo key: campo de datos para key.
        channel: command.channel,                                                     // Campo channel: campo de datos para channel.
        label: servo.label,                                                           // Campo label: campo de datos para label.
        side: servo.side,                                                             // Campo side: campo de datos para side.
        movement: servo.movement,                                                     // Campo movement: campo de datos para movement.
        sensorKey: servo.sensorKey,                                                   // Campo sensorKey: campo de datos para sensor key.
        angle: command.angle,                                                         // Campo angle: objeto anidado de configuracion.
        pwm: {                                                                        // Campo pwm: objeto anidado de configuracion.
          unit: "pca9685_ticks",                                                      // Campo unit: campo de datos para unit.
          ...command.pwm                                                              // Elemento: reutiliza PWM saneado.
        }
      };
    });
  }

  function profileImus() {                                                            // Funcion profileImus: encapsula la logica de lectura de sensores IMU/I2C.
    return state.imus.map((imu) => ({                                                 // Retorno: entrega el resultado al llamador.
      key: imu.key,                                                                   // Campo key: campo de datos para key.
      bus: imu.bus,                                                                   // Campo bus: campo de datos para bus.
      servoId: imu.servoId,                                                           // Campo servoId: campo de datos para control angular de servos.
      label: imu.label,                                                               // Campo label: campo de datos para label.
      axis: imu.axis,                                                                 // Campo axis: campo de datos para axis.
      plane: imu.plane,                                                               // Campo plane: campo de datos para plane.
      neutralDeg: imu.neutralDeg,                                                     // Campo neutralDeg: campo de datos para control angular de servos.
      minDeg: imu.minDeg,                                                             // Campo minDeg: campo de datos para control angular de servos.
      maxDeg: imu.maxDeg,                                                             // Campo maxDeg: campo de datos para control angular de servos.
      invert: imu.invert                                                              // Campo invert: campo de datos para invert.
    }));
  }

  function profileAs5600() {                                                          // Funcion profileAs5600: encapsula la calibracion de sensores AS5600.
    return state.as5600.map((sensor) => ({                                            // Retorno: entrega el resultado al llamador.
      key: sensor.key,                                                                // Campo key: campo de datos para key.
      channel: sensor.channel,                                                        // Campo channel: canal TCA9548A del AS5600.
      servoId: sensor.servoId,                                                        // Campo servoId: campo de datos para control angular de servos.
      label: sensor.label,                                                            // Campo label: campo de datos para label.
      raw0: sensor.raw0,                                                              // Campo raw0: lectura AS5600 para 0 grados.
      raw90: sensor.raw90,                                                            // Campo raw90: lectura AS5600 para 90 grados.
      neutralDeg: sensor.neutralDeg,                                                  // Campo neutralDeg: campo de datos para control angular de servos.
      invert: sensor.invert                                                           // Campo invert: campo de datos para invert.
    }));
  }

  function buildProfile() {                                                           // Funcion buildProfile: arma el perfil JSON completo para firmware y entrega.
    return {                                                                          // Retorno: entrega el resultado al llamador.
      type: "vesta_calibration_profile",                                              // Campo type: campo de datos para type.
      schema: PROFILE_SCHEMA,                                                         // Campo schema: campo de datos para schema.
      createdAt: new Date().toISOString(),                                            // Campo createdAt: campo de datos para created at.
      metadata: {                                                                     // Campo metadata: objeto anidado de configuracion.
        exoskeletonSerial: state.metadata.serial || null,                             // Campo exoskeletonSerial: campo de datos para comunicaciones y puertos.
        technician: state.metadata.technician || null,                                // Campo technician: campo de datos para technician.
        localClient: state.metadata.client || null,                                   // Campo localClient: campo de datos para local client.
        firmware: state.metadata.firmware || null,                                    // Campo firmware: campo de datos para firmware y compilacion Arduino.
        notes: state.metadata.notes || ""                                             // Campo notes: campo de datos para notes.
      },
      hardware: {                                                                     // Campo hardware: objeto anidado de configuracion.
        controller: "ESP32-S3 N16R8 external antenna",                                // Campo controller: campo de datos para controller.
        camera: "ESP32-CAM",                                                          // Campo camera: campo de datos para camara y video.
        servos: "6x DS51150 150kg/cm 270deg",                                         // Campo servos: campo de datos para control angular de servos.
        imu: "4x MPU6050 via TCA9548A",                                               // Campo imu: campo de datos para lectura de sensores IMU/I2C.
        as5600: "2x AS5600 via TCA9548A",                                             // Campo as5600: campo de datos para sensores de codo.
        servoDriver: "PCA9685"                                                        // Campo servoDriver: campo de datos para control angular de servos.
      },
      connection: {                                                                   // Campo connection: objeto anidado de configuracion.
        s3WebSocket: state.connection.s3Url,                                          // Campo s3WebSocket: campo de datos para comunicaciones y puertos.
        s3SerialPort: state.connection.s3Port || null,                                // Campo s3SerialPort: campo de datos para comunicaciones y puertos.
        s3SerialBaud: state.connection.s3Baud || 115200,                              // Campo s3SerialBaud: campo de datos para comunicaciones y puertos.
        cameraStream: state.connection.camUrl,                                        // Campo cameraStream: campo de datos para camara y video.
        cameraSerialPort: state.connection.camPort || null,                           // Campo cameraSerialPort: campo de datos para camara y video.
        cameraSerialBaud: state.connection.camBaud || 115200,                         // Campo cameraSerialBaud: campo de datos para camara y video.
        consumerAppBundled: false                                                     // Campo consumerAppBundled: campo de datos para consumer app bundled.
      },
      safety: {                                                                       // Campo safety: objeto anidado de configuracion.
        consumerVisible: false,                                                       // Campo consumerVisible: campo de datos para enlace BLE.
        installOnly: true,                                                            // Campo installOnly: campo de datos para install only.
        servoOutputRequiresTechnician: true                                           // Campo servoOutputRequiresTechnician: campo de datos para control angular de servos.
      },
      servos: profileServos(),                                                        // Campo servos: campo de datos para control angular de servos.
      sensors: {                                                                      // Campo sensors: objeto anidado de configuracion.
        imus: profileImus(),                                                          // Campo imus: campo de datos para lectura de sensores IMU/I2C.
        as5600: profileAs5600()                                                       // Campo as5600: campo de datos para sensores AS5600.
      },
      tuning: {                                                                       // Campo tuning: objeto anidado de configuracion.
        assistLevel: state.tuning.assistLevel,                                        // Campo assistLevel: campo de datos para assist level.
        deadbandDeg: state.tuning.deadbandDeg,                                        // Campo deadbandDeg: campo de datos para control angular de servos.
        smoothing: state.tuning.smoothing,                                            // Campo smoothing: campo de datos para smoothing.
        maxSpeedDegSec: state.tuning.maxSpeedDegSec                                   // Campo maxSpeedDegSec: campo de datos para control angular de servos.
      },
      firmwareUpload: {                                                               // Campo firmwareUpload: objeto anidado de configuracion.
        s3: {                                                                         // Campo s3: objeto anidado de configuracion.
          fqbn: state.firmware.s3.fqbn,                                               // Campo fqbn: campo de datos para firmware y compilacion Arduino.
          port: state.firmware.s3.port || null,                                       // Campo port: campo de datos para comunicaciones y puertos.
          fileName: state.firmware.s3.fileName || null,                               // Campo fileName: campo de datos para file name.
          codeLoaded: Boolean(state.firmware.s3.code)                                 // Campo codeLoaded: campo de datos para code loaded.
        },
        cam: {                                                                        // Campo cam: objeto anidado de configuracion.
          fqbn: state.firmware.cam.fqbn,                                              // Campo fqbn: campo de datos para firmware y compilacion Arduino.
          port: state.firmware.cam.port || null,                                      // Campo port: campo de datos para comunicaciones y puertos.
          fileName: state.firmware.cam.fileName || null,                              // Campo fileName: campo de datos para file name.
          codeLoaded: Boolean(state.firmware.cam.code)                                // Campo codeLoaded: campo de datos para code loaded.
        }
      },
      checks: { ...state.hardwareChecks },                                            // Campo checks: objeto anidado de configuracion.
      assembly: {                                                                     // Campo assembly: objeto anidado de configuracion.
        bom: BOM.map((item) => ({ key: item.key, label: item.label, done: Boolean(state.build.bom[item.key]) })), // Campo bom: campo de datos para armado y lista de materiales.
        steps: BUILD_STEPS.map((item) => ({ key: item.key, title: item.title, done: Boolean(state.build.steps[item.key]) })) // Campo steps: campo de datos para steps.
      },
      tests: {                                                                        // Campo tests: objeto anidado de configuracion.
        runs: state.testRuns,                                                         // Campo runs: campo de datos para runs.
        lastRunAt: state.lastTestRunAt,                                               // Campo lastRunAt: campo de datos para last run at.
        results: TEST_DEFS.map((def) => ({                                            // Campo results: campo de datos para results.
          key: def.key,                                                               // Campo key: campo de datos para key.
          label: def.label,                                                           // Campo label: campo de datos para label.
          status: state.tests[def.key]?.status || "idle",                             // Campo status: campo de datos para status.
          at: state.tests[def.key]?.at || null,                                       // Campo at: campo de datos para at.
          message: state.tests[def.key]?.message || ""                                // Campo message: campo de datos para message.
        }))
      }
    };
  }

  function updateProfilePreview() {                                                   // Funcion updateProfilePreview: refresca la vista previa del perfil exportable.
    const profile = buildProfile();                                                   // Constante profile: constante usada en estado y perfil persistido.
    const text = JSON.stringify(profile, null, 2);                                    // Constante text: constante usada en text.
    $("#profile-preview").textContent = text;                                         // Llamada: ejecuta una accion del modulo actual.
    // Llamada: ejecuta una accion del modulo actual.
    $("#profile-size").textContent = `${Math.max(1, Math.round(text.length / 1024))} KB`;
    $("#profile-updated").textContent = new Date().toLocaleTimeString("es-MX", {      // Llamada: ejecuta una accion del modulo actual.
      hour: "2-digit",                                                                // Campo hour: campo de datos para hour.
      minute: "2-digit",                                                              // Campo minute: campo de datos para minute.
      second: "2-digit"                                                               // Campo second: campo de datos para second.
    });
    renderReadiness();                                                                // Llamada: ejecuta una accion del modulo actual.
  }

  async function copyProfile() {                                                      // Funcion copyProfile: encapsula la logica de estado y perfil persistido.
    const text = JSON.stringify(buildProfile(), null, 2);                             // Constante text: constante usada en text.
    try {                                                                             // Bloque try: ejecuta una operacion que puede fallar.
      await navigator.clipboard.writeText(text);                                      // Espera asincrona: coordina una operacion externa.
      log("Perfil copiado al portapapeles", "ok");                                    // Llamada: ejecuta una accion del modulo actual.
    } catch {
      log("El navegador bloqueo el portapapeles", "err");                             // Llamada: ejecuta una accion del modulo actual.
    }
  }

  function downloadProfile() {                                                        // Funcion downloadProfile: encapsula la logica de estado y perfil persistido.
    const profile = buildProfile();                                                   // Constante profile: constante usada en estado y perfil persistido.
    const serial = profile.metadata.exoskeletonSerial || "vesta-exo";                 // Constante serial: constante usada en comunicaciones y puertos.
    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: "application/json" }); // Constante blob: constante usada en blob.
    const url = URL.createObjectURL(blob);                                            // Constante url: constante usada en url.
    const anchor = document.createElement("a");                                       // Referencia anchor: nodo o coleccion DOM usada por la UI.
    anchor.href = url;                                                                // Asignacion: actualiza estado o salida calculada.
    // Asignacion: actualiza estado o salida calculada.
    anchor.download = `${serial}-calibration-profile.json`;
    document.body.append(anchor);                                                     // Llamada: ejecuta una accion del modulo actual.
    anchor.click();                                                                   // Llamada: ejecuta una accion del modulo actual.
    anchor.remove();                                                                  // Llamada: ejecuta una accion del modulo actual.
    URL.revokeObjectURL(url);                                                         // Llamada: ejecuta una accion del modulo actual.
    log("Perfil JSON descargado", "ok");                                              // Llamada: ejecuta una accion del modulo actual.
  }

  function toggleDemo() {                                                             // Funcion toggleDemo: encapsula la logica de toggle demo.
    if (demoTimer) {                                                                  // Condicion: valida estado antes de continuar el flujo.
      clearInterval(demoTimer);                                                       // Llamada: ejecuta una accion del modulo actual.
      demoTimer = null;                                                               // Asignacion: actualiza estado o salida calculada.
      $("#btn-demo").textContent = "Demo";                                            // Llamada: ejecuta una accion del modulo actual.
      log("Demo detenido", "sys");                                                    // Llamada: ejecuta una accion del modulo actual.
      return;                                                                         // Retorno: entrega el resultado al llamador.
    }
    const start = Date.now();                                                         // Constante start: constante usada en start.
    demoTimer = setInterval(() => {                                                   // Asignacion: actualiza estado o salida calculada.
      const t = (Date.now() - start) / 1000;                                          // Constante t: constante usada en t.
      const sampledAt = Date.now();                                                   // Constante sampledAt: constante usada en sampled at.
      state.servos.forEach((servo, idx) => {                                          // Llamada: ejecuta una accion del modulo actual.
        const span = servo.maxAngle - servo.minAngle;                                 // Constante span: constante usada en span.
        const base = idx % 3 === 0 ? 0.8 : idx % 3 === 1 ? 1.1 : 1.4;                 // Constante base: constante usada en base.
        const value = servo.minAngle + span * (0.15 + 0.55 * (Math.sin(t * base + idx) * 0.5 + 0.5)); // Constante value: constante usada en value.
        updateServoSensorReading(servo, round(value, 1), sampledAt);                  // Llamada: ejecuta una accion del modulo actual.
        servo.moving = Math.abs(Math.sin(t * base + idx)) > 0.12 || Math.abs(servo.liveSensorSpeed) >= 1; // Asignacion: actualiza estado o salida calculada.
        syncLinkedSensorState(servo, { raw: as5600RawFromDeg(getSensorForServo(servo) || {}, servo.liveSensor) }); // Llamada: ejecuta una accion del modulo actual.
      });
      state.telemetry.mode = "demo";                                                  // Asignacion: actualiza estado o salida calculada.
      state.telemetry.battery = { v: 11.6, pct: 82, amp: 0.0 };                       // Asignacion: actualiza estado o salida calculada.
      state.telemetry.packets += 1;
      updateLive();                                                                   // Llamada: ejecuta una accion del modulo actual.
    }, 100);
    $("#btn-demo").textContent = "Detener";                                           // Llamada: ejecuta una accion del modulo actual.
    log("Demo iniciado", "ok");                                                       // Llamada: ejecuta una accion del modulo actual.
  }

  function as5600RawFromDeg(sensor, deg) {                                            // Funcion as5600RawFromDeg: estima raw AS5600 desde grados para demo.
    const ratio = clamp(deg / 90, 0, 1);                                              // Constante ratio: constante usada en ratio.
    return Math.round((sensor.raw0 ?? 0) + ((sensor.raw90 ?? 1024) - (sensor.raw0 ?? 0)) * ratio); // Retorno: entrega el resultado al llamador.
  }

  function updateLive() {                                                             // Funcion updateLive: actualiza live.
    $("#hud-mode").textContent = modeLabel(state.telemetry.mode || "manual");         // Llamada: ejecuta una accion del modulo actual.
    const hudArmed = $("#hud-armed");                                                 // Referencia hudArmed: estado PWM de servos.
    if (hudArmed) hudArmed.textContent = armedLabel();                                // Condicion: valida estado antes de continuar el flujo.
    const battery = state.telemetry.battery;                                          // Constante battery: constante usada en battery.
    // Llamada: ejecuta una accion del modulo actual.
    $("#hud-battery").textContent = battery ? `${round(battery.v || 0, 1)} V` : "--";
    updateTuningLabels();                                                             // Llamada: ejecuta una accion del modulo actual.
    renderLiveMetrics();                                                              // Llamada: ejecuta una accion del modulo actual.
    updateSensorLiveLabels();                                                         // Llamada: ejecuta una accion del modulo actual.
    updateMappingPreview();                                                           // Llamada: ejecuta una accion del modulo actual.
    updateManualLive();                                                               // Llamada: ejecuta una accion del modulo actual.
    updateFooterSummary();                                                            // Llamada: ejecuta una accion del modulo actual.
    queueDraw();                                                                      // Llamada: ejecuta una accion del modulo actual.
  }

  function renderLiveMetrics() {                                                      // Funcion renderLiveMetrics: renderiza live metrics.
    const grid = $("#live-metrics");                                                  // Referencia grid: nodo o coleccion DOM usada por la UI.
    grid.innerHTML = state.servos.map((servo) => {                                    // Asignacion: actualiza estado o salida calculada.
      const pct = ((servo.liveAngle - servo.minAngle) / Math.max(1, servo.maxAngle - servo.minAngle)) * 100; // Constante pct: constante usada en pct.
      // Retorno: entrega el resultado al llamador.
      return `
        <div class="metric-card">
          <div class="metric-label">${servo.short}</div>
          <div class="metric-value">${formatDeg(servo.liveAngle)}</div>
          <div class="small-label">${servo.moving ? "Moviendo" : "Estable"} | target ${formatDeg(servo.liveTarget ?? servo.testAngle)} | pwm ${Math.round(numberValue(servo.livePwm, 0))} | sensor ${formatDeg(servo.liveSensor)}</div>
          <div class="metric-bar"><div class="metric-fill" style="width:${clamp(pct, 0, 100)}%"></div></div>
        </div>
      `;
    }).join("");
  }

  function updateSensorLiveLabels() {                                                 // Funcion updateSensorLiveLabels: actualiza sensor live labels.
    state.imus.forEach((imu) => {                                                     // Llamada: ejecuta una accion del modulo actual.
      // Referencia label: nodo o coleccion DOM usada por la UI.
      const label = $(`#live-${imu.key}`);
      // Condicion: valida estado antes de continuar el flujo.
      if (label) label.textContent = `${formatDeg(imu.liveDeg)} | ${formatSpeed(imu.liveSpeed)}`;
    });
    state.as5600.forEach((sensor) => {                                                // Llamada: ejecuta una accion del modulo actual.
      // Referencia label: nodo o coleccion DOM usada por la UI.
      const label = $(`#live-${sensor.key}`);
      // Condicion: valida estado antes de continuar el flujo.
      if (label) label.textContent = `Raw ${Math.round(sensor.liveRaw)} | ${formatDeg(sensor.liveDeg)} | ${formatSpeed(sensor.liveSpeed)}`;
    });
  }

  function updateMappingPreview() {                                                   // Funcion updateMappingPreview: actualiza mapping preview.
    state.servos.forEach((servo) => {                                                 // Llamada: ejecuta una accion del modulo actual.
      const target = mappedTarget(servo);                                             // Constante target: constante usada en target.
      const range = Math.max(1, servo.maxAngle - servo.minAngle);                     // Constante range: constante usada en range.
      const sensorPct = ((servo.liveSensor - servo.minAngle) / range) * 100;          // Constante sensorPct: constante usada en sensor pct.
      const servoPct = ((target - servo.minAngle) / range) * 100;                     // Constante servoPct: constante usada en control angular de servos.
      // Llamada: ejecuta una accion del modulo actual.
      $(`#map-target-${servo.id}`).textContent = formatDeg(target);
      // Llamada: ejecuta una accion del modulo actual.
      $(`#map-sensor-${servo.id}`).textContent = formatDeg(servo.liveSensor);
      // Llamada: ejecuta una accion del modulo actual.
      $(`#map-servo-${servo.id}`).textContent = formatDeg(target);
      // Llamada: ejecuta una accion del modulo actual.
      $(`#map-sensor-bar-${servo.id}`).style.width = `${clamp(sensorPct, 0, 100)}%`;
      // Llamada: ejecuta una accion del modulo actual.
      $(`#map-servo-bar-${servo.id}`).style.width = `${clamp(servoPct, 0, 100)}%`;
    });
  }

  function queueDraw() {                                                              // Funcion queueDraw: encapsula la logica de interfaz tecnica.
    if (drawQueued) return;                                                           // Condicion: valida estado antes de continuar el flujo.
    drawQueued = true;                                                                // Asignacion: actualiza estado o salida calculada.
    requestAnimationFrame(() => {                                                     // Llamada: ejecuta una accion del modulo actual.
      drawQueued = false;                                                             // Asignacion: actualiza estado o salida calculada.
      drawExoskeleton();                                                              // Llamada: ejecuta una accion del modulo actual.
    });
  }

  function drawExoskeleton() {                                                        // Funcion drawExoskeleton: dibuja la vista tecnica principal del exoesqueleto.
    drawExoCanvas("#exo-canvas");                                                     // Llamada: ejecuta una accion del modulo actual.
    drawExoCanvas("#exo-canvas-manual");                                              // Llamada: ejecuta una accion del modulo actual.
  }

  function drawExoCanvas(selector) {                                                  // Funcion drawExoCanvas: renderiza una escena canvas del exoesqueleto.
    const canvas = $(selector);                                                       // Referencia canvas: nodo o coleccion DOM usada por la UI.
    if (!canvas) return;                                                              // Condicion: valida estado antes de continuar el flujo.
    const rect = canvas.getBoundingClientRect();                                      // Constante rect: constante usada en rect.
    if (rect.width === 0 || rect.height === 0) return;                                // Condicion: valida estado antes de continuar el flujo.
    const ratio = window.devicePixelRatio || 1;                                       // Constante ratio: constante usada en ratio.
    canvas.width = Math.max(640, Math.floor(rect.width * ratio));                     // Asignacion: actualiza estado o salida calculada.
    canvas.height = Math.max(420, Math.floor(rect.height * ratio));                   // Asignacion: actualiza estado o salida calculada.
    const ctx = canvas.getContext("2d");                                              // Constante ctx: constante usada en ctx.
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);                                       // Llamada: ejecuta una accion del modulo actual.
    const w = rect.width;                                                             // Constante w: constante usada en w.
    const h = rect.height;                                                            // Constante h: constante usada en h.
    ctx.clearRect(0, 0, w, h);                                                        // Llamada: ejecuta una accion del modulo actual.

    ctx.fillStyle = "#fbfdff";                                                        // Asignacion: actualiza estado o salida calculada.
    ctx.fillRect(0, 0, w, h);                                                         // Llamada: ejecuta una accion del modulo actual.
    drawGrid(ctx, w, h);                                                              // Llamada: ejecuta una accion del modulo actual.

    const cx = w / 2;                                                                 // Constante cx: constante usada en cx.
    const shoulderY = h * 0.32;                                                       // Constante shoulderY: constante usada en shoulder y.
    const hipY = h * 0.66;                                                            // Constante hipY: constante usada en hip y.

    ctx.lineCap = "round";                                                            // Asignacion: actualiza estado o salida calculada.
    ctx.lineJoin = "round";                                                           // Asignacion: actualiza estado o salida calculada.

    ctx.strokeStyle = "#04111f";                                                      // Asignacion: actualiza estado o salida calculada.
    ctx.lineWidth = 16;                                                               // Asignacion: actualiza estado o salida calculada.
    ctx.beginPath();                                                                  // Llamada: ejecuta una accion del modulo actual.
    ctx.moveTo(cx, shoulderY - 48);                                                   // Llamada: ejecuta una accion del modulo actual.
    ctx.lineTo(cx, hipY);                                                             // Llamada: ejecuta una accion del modulo actual.
    ctx.stroke();                                                                     // Llamada: ejecuta una accion del modulo actual.

    ctx.fillStyle = "#04111f";                                                        // Asignacion: actualiza estado o salida calculada.
    roundedRect(ctx, cx - 66, shoulderY - 30, 132, 38, 8);                            // Llamada: ejecuta una accion del modulo actual.
    ctx.fill();                                                                       // Llamada: ejecuta una accion del modulo actual.
    roundedRect(ctx, cx - 44, hipY - 8, 88, 28, 8);                                   // Llamada: ejecuta una accion del modulo actual.
    ctx.fill();                                                                       // Llamada: ejecuta una accion del modulo actual.

    drawArm(ctx, cx - 70, shoulderY, "left");                                         // Llamada: ejecuta una accion del modulo actual.
    drawArm(ctx, cx + 70, shoulderY, "right");                                        // Llamada: ejecuta una accion del modulo actual.

    ctx.fillStyle = "#0b5ea8";                                                        // Asignacion: actualiza estado o salida calculada.
    ctx.font = "700 12px Segoe UI, Arial";                                            // Asignacion: actualiza estado o salida calculada.
    ctx.fillText("ESP32-S3", cx - 28, hipY + 54);                                     // Llamada: ejecuta una accion del modulo actual.
    ctx.strokeStyle = "#0b5ea8";                                                      // Asignacion: actualiza estado o salida calculada.
    ctx.lineWidth = 2;                                                                // Asignacion: actualiza estado o salida calculada.
    ctx.beginPath();                                                                  // Llamada: ejecuta una accion del modulo actual.
    ctx.moveTo(cx, hipY + 25);                                                        // Llamada: ejecuta una accion del modulo actual.
    ctx.lineTo(cx, hipY + 44);                                                        // Llamada: ejecuta una accion del modulo actual.
    ctx.stroke();                                                                     // Llamada: ejecuta una accion del modulo actual.
  }

  function drawGrid(ctx, w, h) {                                                      // Funcion drawGrid: encapsula la logica de interfaz tecnica.
    ctx.save();                                                                       // Llamada: ejecuta una accion del modulo actual.
    ctx.strokeStyle = "#e6eef6";                                                      // Asignacion: actualiza estado o salida calculada.
    ctx.lineWidth = 1;                                                                // Asignacion: actualiza estado o salida calculada.
    for (let x = 24; x < w; x += 36) {                                                // Bucle: recorre datos o reintenta una operacion controlada.
      ctx.beginPath();                                                                // Llamada: ejecuta una accion del modulo actual.
      ctx.moveTo(x, 0);                                                               // Llamada: ejecuta una accion del modulo actual.
      ctx.lineTo(x, h);                                                               // Llamada: ejecuta una accion del modulo actual.
      ctx.stroke();                                                                   // Llamada: ejecuta una accion del modulo actual.
    }
    for (let y = 24; y < h; y += 36) {                                                // Bucle: recorre datos o reintenta una operacion controlada.
      ctx.beginPath();                                                                // Llamada: ejecuta una accion del modulo actual.
      ctx.moveTo(0, y);                                                               // Llamada: ejecuta una accion del modulo actual.
      ctx.lineTo(w, y);                                                               // Llamada: ejecuta una accion del modulo actual.
      ctx.stroke();                                                                   // Llamada: ejecuta una accion del modulo actual.
    }
    ctx.restore();                                                                    // Llamada: ejecuta una accion del modulo actual.
  }

  function drawArm(ctx, shoulderX, shoulderY, side) {                                 // Funcion drawArm: encapsula la logica de interfaz tecnica.
    const sign = side === "left" ? -1 : 1;                                            // Constante sign: constante usada en sign.
    const lateral = servoBy(side, "Lateral").liveAngle;                               // Constante lateral: constante usada en lateral.
    const frontal = servoBy(side, "Frontal").liveAngle;                               // Constante frontal: constante usada en frontal.
    const elbow = servoBy(side, "Elbow").liveAngle;                                   // Constante elbow: constante usada en elbow.
    const upper = 116;                                                                // Constante upper: constante usada en upper.
    const fore = 108;                                                                 // Constante fore: constante usada en fore.
    const sideLift = lateral / 90;                                                    // Constante sideLift: constante usada en side lift.
    const frontLift = frontal / 120;                                                  // Constante frontLift: constante usada en front lift.
    const elbowBend = elbow / 90;                                                     // Constante elbowBend: constante usada en elbow bend.

    const elbowX = shoulderX + sign * (34 + upper * (0.35 + sideLift * 0.65));        // Constante elbowX: constante usada en elbow x.
    const elbowY = shoulderY + upper * (0.95 - frontLift * 0.78);                     // Constante elbowY: constante usada en elbow y.
    const wristX = elbowX + sign * fore * (0.22 + sideLift * 0.34 + elbowBend * 0.26); // Constante wristX: constante usada en wrist x.
    const wristY = elbowY + fore * (0.95 - frontLift * 0.35 - elbowBend * 0.62);      // Constante wristY: constante usada en wrist y.

    ctx.strokeStyle = "#c6d2de";                                                      // Asignacion: actualiza estado o salida calculada.
    ctx.lineWidth = 28;                                                               // Asignacion: actualiza estado o salida calculada.
    ctx.beginPath();                                                                  // Llamada: ejecuta una accion del modulo actual.
    ctx.moveTo(shoulderX, shoulderY);                                                 // Llamada: ejecuta una accion del modulo actual.
    ctx.lineTo(elbowX, elbowY);                                                       // Llamada: ejecuta una accion del modulo actual.
    ctx.lineTo(wristX, wristY);                                                       // Llamada: ejecuta una accion del modulo actual.
    ctx.stroke();                                                                     // Llamada: ejecuta una accion del modulo actual.

    ctx.strokeStyle = side === "left" ? "#06345b" : "#2489e6";                        // Asignacion: actualiza estado o salida calculada.
    ctx.lineWidth = 11;                                                               // Asignacion: actualiza estado o salida calculada.
    ctx.beginPath();                                                                  // Llamada: ejecuta una accion del modulo actual.
    ctx.moveTo(shoulderX, shoulderY);                                                 // Llamada: ejecuta una accion del modulo actual.
    ctx.lineTo(elbowX, elbowY);                                                       // Llamada: ejecuta una accion del modulo actual.
    ctx.lineTo(wristX, wristY);                                                       // Llamada: ejecuta una accion del modulo actual.
    ctx.stroke();                                                                     // Llamada: ejecuta una accion del modulo actual.

    drawJoint(ctx, shoulderX, shoulderY, "H");                                        // Llamada: ejecuta una accion del modulo actual.
    drawJoint(ctx, elbowX, elbowY, "C");                                              // Llamada: ejecuta una accion del modulo actual.
    drawJoint(ctx, wristX, wristY, "F");                                              // Llamada: ejecuta una accion del modulo actual.

    ctx.fillStyle = "#04111f";                                                        // Asignacion: actualiza estado o salida calculada.
    ctx.font = "700 12px Segoe UI, Arial";                                            // Asignacion: actualiza estado o salida calculada.
    ctx.textAlign = side === "left" ? "right" : "left";                               // Asignacion: actualiza estado o salida calculada.
    const labelX = shoulderX + sign * 12;                                             // Constante labelX: constante usada en label x.
    ctx.fillText(side === "left" ? "IZQ" : "DER", labelX, shoulderY - 26);            // Llamada: ejecuta una accion del modulo actual.
    ctx.font = "700 11px Segoe UI, Arial";                                            // Asignacion: actualiza estado o salida calculada.
    ctx.fillStyle = "#4c6073";                                                        // Asignacion: actualiza estado o salida calculada.
    // Llamada: ejecuta una accion del modulo actual.
    ctx.fillText(`LAT ${round(lateral, 0)} | FRO ${round(frontal, 0)} | ELB ${round(elbow, 0)}`, labelX, shoulderY - 10);
    ctx.textAlign = "start";                                                          // Asignacion: actualiza estado o salida calculada.
  }

  function servoBy(side, type) {                                                      // Funcion servoBy: encapsula la logica de control angular de servos.
    const match = state.servos.find((servo) => servo.side === side && servo.key.toLowerCase().includes(type.toLowerCase())); // Constante match: constante usada en match.
    return match || state.servos[0];                                                  // Retorno: entrega el resultado al llamador.
  }

  function drawJoint(ctx, x, y, text) {                                               // Funcion drawJoint: encapsula la logica de interfaz tecnica.
    ctx.fillStyle = "#ffffff";                                                        // Asignacion: actualiza estado o salida calculada.
    ctx.strokeStyle = "#04111f";                                                      // Asignacion: actualiza estado o salida calculada.
    ctx.lineWidth = 2;                                                                // Asignacion: actualiza estado o salida calculada.
    ctx.beginPath();                                                                  // Llamada: ejecuta una accion del modulo actual.
    ctx.arc(x, y, 15, 0, Math.PI * 2);                                                // Llamada: ejecuta una accion del modulo actual.
    ctx.fill();                                                                       // Llamada: ejecuta una accion del modulo actual.
    ctx.stroke();                                                                     // Llamada: ejecuta una accion del modulo actual.
    ctx.fillStyle = "#04111f";                                                        // Asignacion: actualiza estado o salida calculada.
    ctx.font = "800 10px Segoe UI, Arial";                                            // Asignacion: actualiza estado o salida calculada.
    ctx.textAlign = "center";                                                         // Asignacion: actualiza estado o salida calculada.
    ctx.textBaseline = "middle";                                                      // Asignacion: actualiza estado o salida calculada.
    ctx.fillText(text, x, y + 0.5);                                                   // Llamada: ejecuta una accion del modulo actual.
    ctx.textAlign = "start";                                                          // Asignacion: actualiza estado o salida calculada.
    ctx.textBaseline = "alphabetic";                                                  // Asignacion: actualiza estado o salida calculada.
  }

  function roundedRect(ctx, x, y, width, height, radius) {                            // Funcion roundedRect: encapsula la logica de rounded rect.
    ctx.beginPath();                                                                  // Llamada: ejecuta una accion del modulo actual.
    ctx.moveTo(x + radius, y);                                                        // Llamada: ejecuta una accion del modulo actual.
    ctx.lineTo(x + width - radius, y);                                                // Llamada: ejecuta una accion del modulo actual.
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);                        // Llamada: ejecuta una accion del modulo actual.
    ctx.lineTo(x + width, y + height - radius);                                       // Llamada: ejecuta una accion del modulo actual.
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);      // Llamada: ejecuta una accion del modulo actual.
    ctx.lineTo(x + radius, y + height);                                               // Llamada: ejecuta una accion del modulo actual.
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);                      // Llamada: ejecuta una accion del modulo actual.
    ctx.lineTo(x, y + radius);                                                        // Llamada: ejecuta una accion del modulo actual.
    ctx.quadraticCurveTo(x, y, x + radius, y);                                        // Llamada: ejecuta una accion del modulo actual.
  }

  function tickClock() {                                                              // Funcion tickClock: encapsula la logica de tick clock.
    const elapsed = Math.floor((Date.now() - sessionStart) / 1000);                   // Constante elapsed: constante usada en elapsed.
    const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");                // Constante minutes: constante usada en minutes.
    const seconds = String(elapsed % 60).padStart(2, "0");                            // Constante seconds: constante usada en seconds.
    // Llamada: ejecuta una accion del modulo actual.
    $("#session-clock").textContent = `${minutes}:${seconds}`;
    const footerSession = $("#footer-session");                                       // Referencia footerSession: nodo o coleccion DOM usada por la UI.
    // Condicion: valida estado antes de continuar el flujo.
    if (footerSession) footerSession.textContent = `${minutes}:${seconds}`;
  }

  window.addEventListener("resize", queueDraw);                                       // Llamada: ejecuta una accion del modulo actual.
  document.addEventListener("DOMContentLoaded", init);                                // Llamada: ejecuta una accion del modulo actual.
})();
