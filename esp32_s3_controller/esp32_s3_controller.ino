// Archivo        | esp32_s3_controller.ino: firmware simple de sensores I2C y servos del exoesqueleto.
#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>
#include <math.h>
const int I2C_SDA = 8;
const int I2C_SCL = 9;
const int PCA9685_ADDR = 0x40;
const int TCA9548A_ADDR = 0x70;
const int MPU6050_ADDR = 0x68;
const byte MPU_REG_SMPLRT_DIV = 0x19;
const byte MPU_REG_CONFIG = 0x1A;
const byte MPU_REG_GYRO_CONFIG = 0x1B;
const byte MPU_REG_ACCEL_CONFIG = 0x1C;
const byte MPU_REG_ACCEL_XOUT_H = 0x3B;
const byte MPU_REG_PWR_MGMT_1 = 0x6B;
const byte MPU_REG_WHO_AM_I = 0x75;
Adafruit_PWMServoDriver pca = Adafruit_PWMServoDriver(PCA9685_ADDR);
const byte MPU_COUNT = 4;
const byte ELBOW_COUNT = 2;
const byte BUTTON_COUNT = 4;
const byte MPU_ADDR_OPTIONS[] = {0x68, 0x69};
const byte MPU_ADDR_OPTION_COUNT = sizeof(MPU_ADDR_OPTIONS) / sizeof(MPU_ADDR_OPTIONS[0]);
const byte TCA_CHANNELS[MPU_COUNT] = {0, 1, 2, 3};
const byte CONTROLLED_SERVO_IDS[MPU_COUNT] = {0, 1, 3, 4};      // id logico del servo (orden de la app/telemetria, no cambia).
const byte CONTROLLED_SERVO_CHANNELS[MPU_COUNT] = {10, 11, 13, 14}; // canal fisico PCA9685 reubicado al rango 10-15.
const byte BUTTON_PINS[BUTTON_COUNT] = {4, 5, 6, 7};
const byte BUTTON_ELBOW_INDEX[BUTTON_COUNT] = {0, 0, 1, 1};
const int BUTTON_DIRECTIONS[BUTTON_COUNT] = {1, -1, 1, -1};
const byte BUTTON_SERVO_IDS[ELBOW_COUNT] = {2, 5};             // id logico del codo (orden de la app/telemetria, no cambia).
const byte BUTTON_SERVO_CHANNELS[ELBOW_COUNT] = {12, 15};      // canal fisico PCA9685 reubicado al rango 10-15.
const bool INVERT_BUTTON[BUTTON_COUNT] = {false, false, false, false};
const int MIN_ANGLE = 0;
const int MAX_ANGLE = 270;
const int SERVO_CENTER_ANGLE = 135;
const int SHOULDER_SERVO_MIN_ANGLE = 45;
const int SHOULDER_SERVO_MAX_ANGLE = 225;
const int BUTTON_OPEN_ANGLE = 0;
const int BUTTON_PRESSED_ANGLE = 90;
const int BUTTON_STEP_ANGLE = 1;
const unsigned long BUTTON_HOLD_START_MS = 250;
const unsigned long BUTTON_STEP_INTERVAL_MS = 45;
const int SERVO_MIN_US = 500;
const int SERVO_MAX_US = 2500;
const float SENSOR_MIN_DEG = -45.0;
const float SENSOR_MAX_DEG = 45.0;
const float FILTER_ALPHA = 1.00;
const int LOOP_DELAY_MS = 20;
const unsigned long STATUS_INTERVAL_MS = 1000;
const unsigned long TELEMETRY_INTERVAL_MS = 100;
const float RAD_TO_DEG_F = 57.2957795;
enum SensorAxis {
  AXIS_ROLL,
  AXIS_PITCH
};
const SensorAxis SENSOR_AXES[MPU_COUNT] = {
  AXIS_ROLL,
  AXIS_PITCH,
  AXIS_ROLL,
  AXIS_PITCH
};
const bool INVERT_SENSOR[MPU_COUNT] = {
  false,
  false,
  true,
  true
};
bool mpuReady[MPU_COUNT] = {false, false, false, false};
bool buttonReady[BUTTON_COUNT] = {false, false, false, false};
bool buttonPressed[BUTTON_COUNT] = {false, false, false, false};
bool buttonWasPressed[BUTTON_COUNT] = {false, false, false, false};
byte detectedMpuAddresses[MPU_COUNT] = {
  MPU6050_ADDR,
  MPU6050_ADDR,
  MPU6050_ADDR,
  MPU6050_ADDR
};
float filteredServoAngles[MPU_COUNT] = {
  SERVO_CENTER_ANGLE,
  SERVO_CENTER_ANGLE,
  SERVO_CENTER_ANGLE,
  SERVO_CENTER_ANGLE
};
float filteredButtonServoAngles[ELBOW_COUNT] = {
  BUTTON_OPEN_ANGLE,
  BUTTON_OPEN_ANGLE
};
float lastMpuTiltDeg[MPU_COUNT] = {0, 0, 0, 0};
float mpuZeroTiltDeg[MPU_COUNT] = {0, 0, 0, 0};
int lastMpuServoAngles[MPU_COUNT] = {
  SERVO_CENTER_ANGLE,
  SERVO_CENTER_ANGLE,
  SERVO_CENTER_ANGLE,
  SERVO_CENTER_ANGLE
};
int buttonServoAngles[ELBOW_COUNT] = {BUTTON_OPEN_ANGLE, BUTTON_OPEN_ANGLE};
unsigned long buttonLastStepMs[BUTTON_COUNT] = {0, 0, 0, 0};
unsigned long lastStatusMs = 0;
unsigned long lastTelemetryMs = 0;

// =====================================================================
// Verificaciones de subida (adaptadas del firmware S3 completo).
// Bloque agregado: NO altera la logica del sketch nuevo, solo suma
// rutinas de arranque (diagnostico I2C, inicio seguro sin PWM, resumen
// PASS/FALLO) y re-deteccion de sensores caidos durante el loop.
// =====================================================================
const char* FW_VERSION = "VESTA-S3-buttons-1.1";             // Identifica el firmware subido en el resumen serial.
const byte SAFE_ARM_PRIME_SAMPLES = 12;                      // Muestras de referencia tomadas sin PWM antes de permitir movimiento.
const unsigned long SAFE_ARM_SETTLE_MS = 1200;               // Espera tras cmd_arm para estabilizar sensores antes de energizar.
const uint8_t SENSOR_FAULT_LIMIT = 5;                        // Lecturas fallidas seguidas antes de marcar un sensor offline.
const unsigned long SENSOR_RECHECK_INTERVAL_MS = 3000;       // Periodo para reintentar re-detectar sensores caidos.
const unsigned long IDENTITY_INTERVAL_MS = 1000;             // Periodo de la baliza de identidad para que "Detectar" siempre encuentre la placa.
unsigned long lastIdentityMs = 0;                            // Marca de tiempo de la ultima baliza de identidad enviada.
String serialCmdBuffer = "";                                 // Acumula la linea de comando recibida por Serial desde la pagina tecnica.
bool pcaOnline = false;                                      // Confirma que el PCA9685 respondio en el bus.
bool servosArmed = false;                                    // Compuerta de seguridad: sin armado explicito no se envia PWM.
bool servoArmPending = false;                                // cmd_arm recibido; se esta esperando estabilizacion antes de activar PWM.
unsigned long servoArmStartMs = 0;                           // Marca de tiempo del inicio de armado seguro.
uint8_t mpuFaults[MPU_COUNT] = {0, 0, 0, 0};                 // Contador de fallos de lectura por MPU.
unsigned long lastSensorRecheckMs = 0;                       // Marca de tiempo de la ultima re-deteccion.

// Funcion       | deviceFound: comprueba si un dispositivo I2C responde en una direccion.
bool deviceFound(int address) {
  Wire.beginTransmission(address);
  return Wire.endTransmission() == 0;
}
// Funcion       | printHexAddress: imprime direcciones I2C en formato hexadecimal legible.
void printHexAddress(byte address) {
  Serial.print("0x");
  if (address < 16) {
    Serial.print("0");
  }
  Serial.print(address, HEX);
}
// Funcion       | isKnownMpuId: valida identificadores conocidos de sensores MPU.
bool isKnownMpuId(byte id) {
  return id == 0x68 || id == 0x70 || id == 0x71;
}
// Funcion       | printMpuIdName: traduce el identificador MPU a texto de diagnostico.
void printMpuIdName(byte id) {
  if (id == 0x68) {
    Serial.print("MPU6050");
  } else if (id == 0x70) {
    Serial.print("MPU6500 compatible");
  } else if (id == 0x71) {
    Serial.print("MPU9250 compatible");
  } else {
    Serial.print("chip compatible no identificado");
  }
}
// Funcion       | tcaSelect: habilita un canal especifico del multiplexor TCA9548A.
bool tcaSelect(byte channel) {
  if (channel > 7) {
    return false;
  }
  Wire.beginTransmission(TCA9548A_ADDR);
  Wire.write(1 << channel);
  return Wire.endTransmission() == 0;
}
// Agregado: desactiva todos los canales del TCA9548A para escanear el bus raiz.
// Funcion       | tcaDisableAll: apaga todos los canales del TCA9548A.
void tcaDisableAll() {
  Wire.beginTransmission(TCA9548A_ADDR);
  Wire.write(0x00);
  Wire.endTransmission();
}
// Funcion       | writeMpuRegister: escribe un registro de configuracion del MPU.
bool writeMpuRegister(byte address, byte reg, byte value) {
  Wire.beginTransmission(address);
  Wire.write(reg);
  Wire.write(value);
  return Wire.endTransmission() == 0;
}
// Funcion       | readMpuRegister: lee un registro individual del MPU.
bool readMpuRegister(byte address, byte reg, byte *value) {
  Wire.beginTransmission(address);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) {
    return false;
  }
  if (Wire.requestFrom((int)address, 1) != 1) {
    return false;
  }
  *value = Wire.read();
  return true;
}
// Funcion       | readMpuBytes: lee bloques de bytes consecutivos del MPU.
bool readMpuBytes(byte address, byte reg, byte *buffer, byte length) {
  Wire.beginTransmission(address);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) {
    return false;
  }
  if (Wire.requestFrom((int)address, (int)length) != length) {
    return false;
  }
  for (byte i = 0; i < length; i++) {
    buffer[i] = Wire.read();
  }
  return true;
}
// Funcion       | initMpuRegisters: inicializa rango y filtros basicos del MPU.
bool initMpuRegisters(byte address) {
  if (!writeMpuRegister(address, MPU_REG_PWR_MGMT_1, 0x80)) {
    return false;
  }
  delay(100);
  return writeMpuRegister(address, MPU_REG_PWR_MGMT_1, 0x01) &&
         writeMpuRegister(address, MPU_REG_SMPLRT_DIV, 0x00) &&
         writeMpuRegister(address, MPU_REG_CONFIG, 0x03) &&
         writeMpuRegister(address, MPU_REG_GYRO_CONFIG, 0x08) &&
         writeMpuRegister(address, MPU_REG_ACCEL_CONFIG, 0x08);
}
// Funcion       | scanSelectedTcaChannel: lista dispositivos encontrados en un canal I2C.
void scanSelectedTcaChannel(byte channel) {
  bool foundAny = false;
  Serial.print("Escaneo I2C en TCA canal ");
  Serial.print(channel);
  Serial.print(": ");
  for (byte address = 1; address < 127; address++) {
    if (address == PCA9685_ADDR || address == TCA9548A_ADDR) {
      continue;
    }
    if (deviceFound(address)) {
      printHexAddress(address);
      Serial.print(" ");
      foundAny = true;
    }
  }
  if (!foundAny) {
    Serial.print("sin dispositivos");
  }
  Serial.println();
}
// Funcion       | angleToPwmTicks: convierte grados de servo a ticks PWM del PCA9685.
uint16_t angleToPwmTicks(int angle) {
  angle = constrain(angle, MIN_ANGLE, MAX_ANGLE);
  int pulseUs = map(angle, MIN_ANGLE, MAX_ANGLE, SERVO_MIN_US, SERVO_MAX_US);
  return (uint16_t)((pulseUs * 4096L) / 20000L);
}
// Funcion       | setServoAngle: aplica un angulo limitado al canal de servo indicado.
void setServoAngle(byte channel, int angle) {
  if (!pcaOnline) {
    return;
  }
  pca.setPWM(channel, 0, angleToPwmTicks(angle));
}
// Funcion       | disableServo: corta PWM en un canal del PCA9685.
void disableServo(byte channel) {
  if (!pcaOnline) {
    return;
  }
  pca.setPWM(channel, 0, 4096);
}
// Funcion       | releaseControlledServos: libera todos los servos controlados por sensores.
void releaseControlledServos() {
  for (byte i = 0; i < MPU_COUNT; i++) {
    disableServo(CONTROLLED_SERVO_CHANNELS[i]);
  }
  for (byte i = 0; i < ELBOW_COUNT; i++) {
    disableServo(BUTTON_SERVO_CHANNELS[i]);
  }
}
// Funcion       | centerControlledServos: lleva servos controlados a su posicion central.
void centerControlledServos() {
  for (byte i = 0; i < MPU_COUNT; i++) {
    setServoAngle(CONTROLLED_SERVO_CHANNELS[i], SERVO_CENTER_ANGLE);
  }
  for (byte i = 0; i < ELBOW_COUNT; i++) {
    setServoAngle(BUTTON_SERVO_CHANNELS[i], SERVO_CENTER_ANGLE);
  }
}
// Funcion       | mapFloat: remapea valores flotantes entre rangos.
float mapFloat(float value, float inMin, float inMax, float outMin, float outMax) {
  return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}
// Funcion       | tiltToServoAngle: convierte inclinacion de IMU a angulo de servo.
int tiltToServoAngle(float tiltDeg) {
  tiltDeg = constrain(tiltDeg, SENSOR_MIN_DEG, SENSOR_MAX_DEG);
  float mapped = mapFloat(tiltDeg, SENSOR_MIN_DEG, SENSOR_MAX_DEG, SHOULDER_SERVO_MIN_ANGLE, SHOULDER_SERVO_MAX_ANGLE);
  return constrain((int)(mapped + 0.5), SHOULDER_SERVO_MIN_ANGLE, SHOULDER_SERVO_MAX_ANGLE);
}
// Funcion       | getTiltDeg: calcula roll o pitch segun eje configurado.
float getTiltDeg(byte index, float x, float y, float z) {
  float rollDeg = atan2f(y, z) * RAD_TO_DEG_F;
  float pitchDeg = atan2f(-x, sqrtf(y * y + z * z)) * RAD_TO_DEG_F;
  float tiltDeg = SENSOR_AXES[index] == AXIS_ROLL ? rollDeg : pitchDeg;
  if (INVERT_SENSOR[index]) {
    tiltDeg = -tiltDeg;
  }
  return tiltDeg;
}
// Funcion       | setupMpu: detecta e inicializa un MPU en su canal asignado.
void setupMpu(byte index) {
  Serial.print("Iniciando MPU6050 ");
  Serial.print(index + 1);
  Serial.print(" en TCA canal ");
  Serial.print(TCA_CHANNELS[index]);
  Serial.print("...");
  if (!tcaSelect(TCA_CHANNELS[index])) {
    Serial.println(" ERROR: no se pudo seleccionar el canal.");
    return;
  }
  byte detectedAddress = 0;
  byte whoAmI = 0xFF;
  bool whoAmIRead = false;
  for (byte i = 0; i < MPU_ADDR_OPTION_COUNT; i++) {
    byte address = MPU_ADDR_OPTIONS[i];
    if (deviceFound(address)) {
      detectedAddress = address;
      whoAmIRead = readMpuRegister(address, MPU_REG_WHO_AM_I, &whoAmI);
      break;
    }
  }
  if (detectedAddress == 0) {
    Serial.println(" ERROR: no detectado en 0x68 ni 0x69.");
    scanSelectedTcaChannel(TCA_CHANNELS[index]);
    return;
  }
  if (!initMpuRegisters(detectedAddress)) {
    Serial.println(" ERROR: responde, pero no acepta configuracion.");
    scanSelectedTcaChannel(TCA_CHANNELS[index]);
    return;
  }
  detectedMpuAddresses[index] = detectedAddress;
  mpuReady[index] = true;
  mpuFaults[index] = 0;
  Serial.print(" OK direccion ");
  printHexAddress(detectedAddress);
  Serial.print(", WHO_AM_I ");
  if (whoAmIRead) {
    printHexAddress(whoAmI);
    Serial.print(" (");
    printMpuIdName(whoAmI);
    Serial.print(")");
    if (!isKnownMpuId(whoAmI)) {
      Serial.print(" - se intentara leer igual");
    }
  } else {
    Serial.print("no leido - se intentara leer igual");
  }
  Serial.println(".");
}
// Funcion       | setupButtons: inicializa botones normalmente abiertos de codo.
void setupButtons() {
  for (byte elbow = 0; elbow < ELBOW_COUNT; elbow++) {
    buttonServoAngles[elbow] = BUTTON_OPEN_ANGLE;
    filteredButtonServoAngles[elbow] = BUTTON_OPEN_ANGLE;
  }
  for (byte i = 0; i < BUTTON_COUNT; i++) {
    pinMode(BUTTON_PINS[i], INPUT_PULLUP);
    buttonReady[i] = true;
    buttonPressed[i] = digitalRead(BUTTON_PINS[i]) == LOW;
    buttonWasPressed[i] = false;
    buttonLastStepMs[i] = millis();
    Serial.print("Boton N.A. ");
    Serial.print(i + 1);
    Serial.print(" en GPIO");
    Serial.print(BUTTON_PINS[i]);
    Serial.print(BUTTON_DIRECTIONS[i] > 0 ? " (+)" : " (-)");
    Serial.print(" para servo canal ");
    Serial.print(BUTTON_SERVO_CHANNELS[BUTTON_ELBOW_INDEX[i]]);
    Serial.print(": ");
    Serial.println(buttonPressed[i] ? "presionado" : "abierto");
  }
}
// Funcion       | setupMpus: inicializa todos los sensores MPU configurados.
void setupMpus() {
  if (!deviceFound(TCA9548A_ADDR)) {
    Serial.println("ERROR: No se detecta el TCA9548A en direccion 0x70.");
    Serial.println("Para usar 4 MPU6050 en el mismo bus I2C necesitas multiplexor o conmutar direcciones.");
    return;
  }
  for (byte i = 0; i < MPU_COUNT; i++) {
    setupMpu(i);
  }
}
// Funcion       | readMpuAccel: obtiene aceleracion normalizada de un MPU listo.
bool readMpuAccel(byte index, float *x, float *y, float *z) {
  if (!tcaSelect(TCA_CHANNELS[index])) {
    return false;
  }
  byte buffer[6];
  if (!readMpuBytes(detectedMpuAddresses[index], MPU_REG_ACCEL_XOUT_H, buffer, 6)) {
    return false;
  }
  int16_t rawX = (int16_t)((buffer[0] << 8) | buffer[1]);
  int16_t rawY = (int16_t)((buffer[2] << 8) | buffer[3]);
  int16_t rawZ = (int16_t)((buffer[4] << 8) | buffer[5]);
  *x = (float)rawX;
  *y = (float)rawY;
  *z = (float)rawZ;
  return true;
}

// Funcion       | calibrateMpuZeros: captura la postura neutral de cada MPU sin mover servos.
void calibrateMpuZeros() {
  Serial.println("Calibrando neutral MPU: manten los brazos quietos...");
  for (byte i = 0; i < MPU_COUNT; i++) {
    if (!mpuReady[i]) {
      mpuZeroTiltDeg[i] = 0;
      continue;
    }
    float sum = 0;
    byte good = 0;
    for (byte sample = 0; sample < 60; sample++) {
      float accelX = 0;
      float accelY = 0;
      float accelZ = 0;
      if (readMpuAccel(i, &accelX, &accelY, &accelZ)) {
        sum += getTiltDeg(i, accelX, accelY, accelZ);
        good++;
      }
      delay(10);
    }
    if (good > 0) {
      mpuZeroTiltDeg[i] = sum / good;
      lastMpuTiltDeg[i] = 0;
      lastMpuServoAngles[i] = SERVO_CENTER_ANGLE;
      filteredServoAngles[i] = SERVO_CENTER_ANGLE;
      Serial.print("MPU ");
      Serial.print(i + 1);
      Serial.print(" neutral ");
      Serial.print(mpuZeroTiltDeg[i], 1);
      Serial.println(" deg.");
    } else {
      mpuReady[i] = false;
      Serial.print("MPU ");
      Serial.print(i + 1);
      Serial.println(" sin muestras validas para neutral.");
    }
  }
  tcaDisableAll();
  Serial.println("Calibracion neutral MPU lista.");
}

// Funcion       | updateServoFromButton: actualiza codo con boton N.A. filtrado.
void updateServoFromButton(byte index, bool showStatus) {
  if (!buttonReady[index]) {
    return;
  }
  bool pressed = digitalRead(BUTTON_PINS[index]) == LOW;
  if (INVERT_BUTTON[index]) {
    pressed = !pressed;
  }
  buttonPressed[index] = pressed;

  unsigned long now = millis();
  byte elbow = BUTTON_ELBOW_INDEX[index];
  if (pressed) {
    unsigned long steps = 0;
    if (!buttonWasPressed[index]) {
      steps = 1;
      buttonLastStepMs[index] = now + BUTTON_HOLD_START_MS;
    } else if ((long)(now - buttonLastStepMs[index]) >= 0) {
      unsigned long elapsed = now - buttonLastStepMs[index];
      steps = 1 + (elapsed / BUTTON_STEP_INTERVAL_MS);
      buttonLastStepMs[index] += (unsigned long)steps * BUTTON_STEP_INTERVAL_MS;
    }
    if (steps > 0) {
      buttonServoAngles[elbow] += BUTTON_DIRECTIONS[index] * BUTTON_STEP_ANGLE * steps;
    }
  } else {
    buttonLastStepMs[index] = now;
  }
  buttonWasPressed[index] = pressed;
  buttonServoAngles[elbow] = constrain(buttonServoAngles[elbow], BUTTON_OPEN_ANGLE, BUTTON_PRESSED_ANGLE);
  filteredButtonServoAngles[elbow] = buttonServoAngles[elbow];
  int servoAngle = constrain(buttonServoAngles[elbow], BUTTON_OPEN_ANGLE, BUTTON_PRESSED_ANGLE);
  if (servosArmed) {
    setServoAngle(BUTTON_SERVO_CHANNELS[elbow], servoAngle);
  }
  if (showStatus) {
    Serial.print("Boton N.A. ");
    Serial.print(index + 1);
    Serial.print(" -> servo canal ");
    Serial.print(BUTTON_SERVO_CHANNELS[elbow]);
    Serial.print(BUTTON_DIRECTIONS[index] > 0 ? " sube" : " baja");
    Serial.print(": ");
    Serial.print(pressed ? "presionado" : "abierto");
    Serial.print(", angulo ");
    Serial.println(servoAngle);
  }
}
// Funcion       | updateServoFromMpu: actualiza servo desde inclinacion IMU filtrada.
void updateServoFromMpu(byte index, bool showStatus) {
  if (!mpuReady[index]) {
    return;
  }
  if (!tcaSelect(TCA_CHANNELS[index])) {
    if (showStatus) {
      Serial.print("MPU6050 ");
      Serial.print(index + 1);
      Serial.println(": no se pudo seleccionar el canal TCA.");
    }
    // Agregado: un canal TCA que no responde tambien cuenta como fallo.
    if (++mpuFaults[index] >= SENSOR_FAULT_LIMIT) {
      mpuReady[index] = false;
      Serial.print("MPU6050 ");
      Serial.print(index + 1);
      Serial.println(": marcado offline tras fallos repetidos.");
    }
    return;
  }
  float accelX = 0;
  float accelY = 0;
  float accelZ = 0;
  if (!readMpuAccel(index, &accelX, &accelY, &accelZ)) {
    if (showStatus) {
      Serial.print("MPU6050 ");
      Serial.print(index + 1);
      Serial.println(": lectura fallida.");
    }
    // Agregado: tras varios fallos seguidos se marca offline para que el loop lo re-detecte.
    if (++mpuFaults[index] >= SENSOR_FAULT_LIMIT) {
      mpuReady[index] = false;
      Serial.print("MPU6050 ");
      Serial.print(index + 1);
      Serial.println(": marcado offline tras fallos repetidos.");
    }
    return;
  }
  mpuFaults[index] = 0;
  float tiltDeg = getTiltDeg(index, accelX, accelY, accelZ) - mpuZeroTiltDeg[index];
  int targetAngle = tiltToServoAngle(tiltDeg);
  filteredServoAngles[index] = FILTER_ALPHA * targetAngle + (1.0 - FILTER_ALPHA) * filteredServoAngles[index];
  int servoAngle = constrain((int)(filteredServoAngles[index] + 0.5), MIN_ANGLE, MAX_ANGLE);
  lastMpuTiltDeg[index] = tiltDeg;
  lastMpuServoAngles[index] = servoAngle;
  if (servosArmed) {
    setServoAngle(CONTROLLED_SERVO_CHANNELS[index], servoAngle);
  }
  if (showStatus) {
    Serial.print("MPU ");
    Serial.print(index + 1);
    Serial.print(" -> servo canal ");
    Serial.print(CONTROLLED_SERVO_CHANNELS[index]);
    Serial.print(": inclinacion ");
    Serial.print(tiltDeg, 1);
    Serial.print(" deg, angulo ");
    Serial.println(servoAngle);
  }
}

// =====================================================================
// Rutinas de verificacion de subida (agregadas).
// =====================================================================

// Diagnostico I2C de arranque: escanea el bus raiz y cada canal del TCA.
// Funcion       | bootI2CDiagnostic: imprime diagnostico de bus raiz y canales TCA al arrancar.
void bootI2CDiagnostic() {
  Serial.println("=== Verificacion de subida: diagnostico I2C ===");
  tcaDisableAll();
  Serial.print("Escaneo I2C raiz (sin TCA):");
  bool any = false;
  for (byte a = 1; a < 127; a++) {
    if (deviceFound(a)) {
      Serial.print(" ");
      printHexAddress(a);
      any = true;
    }
  }
  if (!any) {
    Serial.print(" sin dispositivos");
  }
  Serial.println();
  if (deviceFound(TCA9548A_ADDR)) {
    Serial.println("TCA9548A OK en 0x70. Escaneando canales 0-7:");
    for (byte ch = 0; ch < 8; ch++) {
      if (tcaSelect(ch)) {
        scanSelectedTcaChannel(ch);
      } else {
        Serial.print("Canal ");
        Serial.print(ch);
        Serial.println(": no se pudo seleccionar.");
      }
    }
    tcaDisableAll();
  } else {
    Serial.println("ERROR: TCA9548A no detectado en 0x70.");
  }
}

// Inicio seguro: no centra ni barre los servos al arrancar.
// Funcion       | initializeServosSafely: inicializa PCA sin mover servos automaticamente.
void initializeServosSafely() {
  servosArmed = false;
  servoArmPending = false;
  if (!pcaOnline) {
    Serial.println("Inicio seguro: PCA9685 no responde, no se envia PWM a servos.");
    return;
  }
  releaseControlledServos();
  Serial.println("Inicio seguro: servos DESARMADOS, PWM liberado, sin centrado ni barrido.");
  Serial.println("Para habilitar movimiento envia cmd_arm / armar; cmd_stop, cmd_reset o cmd_disarm vuelven a desarmar.");
}

// Funcion       | primeServoFilters: precarga filtros con posiciones neutras seguras.
void primeServoFilters() {
  Serial.println("Tomando referencia de sensores sin mover servos...");
  for (byte sample = 0; sample < SAFE_ARM_PRIME_SAMPLES; sample++) {
    for (byte i = 0; i < MPU_COUNT; i++) {
      updateServoFromMpu(i, false);
    }
    for (byte i = 0; i < BUTTON_COUNT; i++) {
      updateServoFromButton(i, false);
    }
    delay(LOOP_DELAY_MS);
  }
  Serial.println("Referencia lista: los servos siguen desarmados hasta cmd_arm.");
}

// Funcion       | requestServoArm: inicia el armado seguro tras comando serial.
void requestServoArm() {
  if (!pcaOnline) {
    Serial.println("Armado rechazado: PCA9685 no responde.");
    return;
  }
  releaseControlledServos();
  servosArmed = false;
  servoArmPending = true;
  servoArmStartMs = millis();
  Serial.println("Armado solicitado: estabilizando sensores antes de activar PWM.");
}

// Funcion       | disarmServos: desarma servos y registra la causa.
void disarmServos(const char* reason) {
  servosArmed = false;
  servoArmPending = false;
  releaseControlledServos();
  Serial.print("Servos desarmados: ");
  Serial.println(reason);
}

// Funcion       | serviceServoArming: completa armado tras tiempo de estabilizacion.
void serviceServoArming() {
  if (!servoArmPending) {
    return;
  }
  if (millis() - servoArmStartMs < SAFE_ARM_SETTLE_MS) {
    return;
  }
  servoArmPending = false;
  if (!pcaOnline) {
    Serial.println("Armado cancelado: PCA9685 no responde.");
    return;
  }
  servosArmed = true;
  Serial.println("Servos ARMADOS: PWM habilitado siguiendo la postura actual de sensores.");
}

// Resumen PASS/FALLO de la verificacion de subida.
// Funcion       | printBootSummary: resume estado de sensores, PCA y seguridad al arrancar.
void printBootSummary() {
  byte mpuOk = 0;
  byte buttonOk = 0;
  for (byte i = 0; i < MPU_COUNT; i++) {
    if (mpuReady[i]) mpuOk++;
  }
  for (byte i = 0; i < BUTTON_COUNT; i++) {
    if (buttonReady[i]) buttonOk++;
  }
  bool tcaOk = deviceFound(TCA9548A_ADDR);
  Serial.println("=== Resumen de verificacion de subida ===");
  Serial.print("Firmware: ");
  Serial.println(FW_VERSION);
  Serial.print("PCA9685: ");
  Serial.println(pcaOnline ? "OK" : "FALLO");
  Serial.print("TCA9548A: ");
  Serial.println(tcaOk ? "OK" : "FALLO");
  Serial.print("MPU6050: ");
  Serial.print(mpuOk);
  Serial.print("/");
  Serial.print(MPU_COUNT);
  Serial.println(mpuOk == MPU_COUNT ? " OK" : " (revisar fallidos)");
  Serial.print("Botones N.A.: ");
  Serial.print(buttonOk);
  Serial.print("/");
  Serial.print(BUTTON_COUNT);
  Serial.println(buttonOk == BUTTON_COUNT ? " OK" : " (revisar GPIO/GND)");
  bool allOk = pcaOnline && tcaOk && mpuOk == MPU_COUNT && buttonOk == BUTTON_COUNT;
  Serial.println(allOk ? ">> VERIFICACION OK: sensores listos, servos desarmados." : ">> VERIFICACION CON ADVERTENCIAS: revisar conexiones antes de armar.");
  Serial.println("==========================================");
}

// Re-deteccion en loop: reintenta inicializar sensores que estan offline.
// Funcion       | recheckOfflineSensors: reintenta detectar sensores marcados offline.
void recheckOfflineSensors() {
  for (byte i = 0; i < MPU_COUNT; i++) {
    if (!mpuReady[i]) {
      setupMpu(i);
      if (mpuReady[i]) {
        Serial.print("MPU6050 ");
        Serial.print(i + 1);
        Serial.println(" recuperado.");
      }
    }
  }
  tcaDisableAll();
}

// Funcion       | setup: prepara serial, bus I2C, sensores y servos.
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.print("Firmware ");
  Serial.println(FW_VERSION);
  Serial.println("Iniciando PCA9685 con ESP32...");
  Serial.print("SDA: GPIO ");
  Serial.println(I2C_SDA);
  Serial.print("SCL: GPIO ");
  Serial.println(I2C_SCL);
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(100000);
  bootI2CDiagnostic();
  if (deviceFound(PCA9685_ADDR)) {
    pcaOnline = true;
    Serial.println("PCA9685 detectado en direccion 0x40.");
  } else {
    pcaOnline = false;
    Serial.println("ERROR: No se detecta el PCA9685 en direccion 0x40.");
    Serial.println("Revisa SDA, SCL, VCC, GND y que la direccion sea 0x40.");
  }
  pca.begin();
  pca.setPWMFreq(50);
  initializeServosSafely();
  setupMpus();
  setupButtons();
  calibrateMpuZeros();
  primeServoFilters();
  printBootSummary();
  delay(500);
}
// Envia una linea JSON de identidad que la pagina tecnica reconoce como
// controlador ESP32-S3 valido (campos "role":"controller" / "type").
// Esto es lo que permite que "Detectar" encuentre la placa en cualquier
// momento, no solo en el instante posterior a subir el firmware.
// Funcion       | sendIdentity: envia balizas seriales para descubrimiento automatico.
void sendIdentity(const char* type) {
  Serial.print("{\"role\":\"controller\",\"type\":\"");
  Serial.print(type);
  Serial.print("\",\"fw\":\"");
  Serial.print(FW_VERSION);
  Serial.print("\",\"pca\":");
  Serial.print(pcaOnline ? "true" : "false");
  Serial.print(",\"armed\":");
  Serial.print(servosArmed ? "true" : "false");
  Serial.print(",\"armPending\":");
  Serial.print(servoArmPending ? "true" : "false");
  Serial.println("}");
}

// Funcion       | printJsonBool: imprime booleanos validos para JSON.
void printJsonBool(bool value) {
  Serial.print(value ? "true" : "false");
}

// Funcion       | printButtonTelemetryDetail: imprime estado de un boton fisico.
void printButtonTelemetryDetail(byte index) {
  Serial.print("{\"pin\":");
  Serial.print(BUTTON_PINS[index]);
  Serial.print(",\"pressed\":");
  printJsonBool(buttonPressed[index]);
  Serial.print(",\"direction\":");
  Serial.print(BUTTON_DIRECTIONS[index]);
  Serial.print(",\"limitDeg\":");
  Serial.print(BUTTON_DIRECTIONS[index] > 0 ? BUTTON_PRESSED_ANGLE : BUTTON_OPEN_ANGLE);
  Serial.print("}");
}

// Funcion       | printMpuServoTelemetry: imprime un servo enlazado a MPU en el formato de la pagina.
void printMpuServoTelemetry(byte index, bool first) {
  if (!first) {
    Serial.print(",");
  }
  int angle = lastMpuServoAngles[index];
  Serial.print("{\"id\":");
  Serial.print(CONTROLLED_SERVO_IDS[index]);
  Serial.print(",\"channel\":");
  Serial.print(CONTROLLED_SERVO_CHANNELS[index]);
  Serial.print(",\"angle\":");
  Serial.print(angle);
  Serial.print(",\"target\":");
  Serial.print(angle);
  Serial.print(",\"pwm\":");
  Serial.print(angleToPwmTicks(angle));
  Serial.print(",\"sensor\":");
  Serial.print(lastMpuTiltDeg[index], 1);
  Serial.print(",\"sensorKind\":\"imu\",\"sensorId\":");
  Serial.print(index);
  Serial.print(",\"sensorSource\":\"MPU ");
  Serial.print(index + 1);
  Serial.print(" TCA");
  Serial.print(TCA_CHANNELS[index]);
  Serial.print("\",\"raw\":");
  Serial.print(lastMpuTiltDeg[index], 1);
  Serial.print(",\"neutral\":0,\"online\":");
  printJsonBool(mpuReady[index]);
  Serial.print(",\"faults\":");
  Serial.print(mpuFaults[index]);
  Serial.print(",\"moving\":");
  printJsonBool(servosArmed);
  Serial.print(",\"amp\":0,\"temp\":0}");
}

// Funcion       | printButtonServoTelemetry: imprime un codo controlado por dos botones N.A.
void printButtonServoTelemetry(byte elbow, bool first) {
  if (!first) {
    Serial.print(",");
  }
  byte firstButton = elbow == 0 ? 0 : 2;
  byte secondButton = firstButton + 1;
  bool pressed = buttonPressed[firstButton] || buttonPressed[secondButton];
  bool online = buttonReady[firstButton] || buttonReady[secondButton];
  int angle = constrain(buttonServoAngles[elbow], BUTTON_OPEN_ANGLE, BUTTON_PRESSED_ANGLE);
  Serial.print("{\"id\":");
  Serial.print(BUTTON_SERVO_IDS[elbow]);
  Serial.print(",\"channel\":");
  Serial.print(BUTTON_SERVO_CHANNELS[elbow]);
  Serial.print(",\"angle\":");
  Serial.print(angle);
  Serial.print(",\"target\":");
  Serial.print(angle);
  Serial.print(",\"pwm\":");
  Serial.print(angleToPwmTicks(angle));
  Serial.print(",\"sensor\":");
  Serial.print(angle);
  Serial.print(",\"sensorKind\":\"button\",\"sensorId\":");
  Serial.print(firstButton);
  Serial.print(",\"sensorSource\":\"Botones codo ");
  Serial.print(elbow == 0 ? "izquierdo" : "derecho");
  Serial.print("\",\"raw\":");
  Serial.print(pressed ? 1 : 0);
  Serial.print(",\"pressed\":");
  printJsonBool(pressed);
  Serial.print(",\"pin\":");
  Serial.print(BUTTON_PINS[firstButton]);
  Serial.print(",\"openDeg\":");
  Serial.print(BUTTON_OPEN_ANGLE);
  Serial.print(",\"pressedDeg\":");
  Serial.print(BUTTON_PRESSED_ANGLE);
  Serial.print(",\"online\":");
  printJsonBool(online);
  Serial.print(",\"faults\":0,\"buttons\":[");
  printButtonTelemetryDetail(firstButton);
  Serial.print(",");
  printButtonTelemetryDetail(secondButton);
  Serial.print("],\"moving\":");
  printJsonBool(servosArmed && pressed);
  Serial.print(",\"amp\":0,\"temp\":0}");
}

// Funcion       | sendSensorTelemetry: manda lecturas en vivo en JSON para la pagina tecnica.
void sendSensorTelemetry() {
  Serial.print("{\"role\":\"controller\",\"type\":\"sensors\",\"fw\":\"");
  Serial.print(FW_VERSION);
  Serial.print("\",\"t\":");
  Serial.print(millis());
  Serial.print(",\"mode\":\"manual\",\"emergency\":false,\"estop\":false,\"armed\":");
  printJsonBool(servosArmed);
  Serial.print(",\"pcaOnline\":");
  printJsonBool(pcaOnline);
  Serial.print(",\"sensorless\":false,\"servos\":[");
  printMpuServoTelemetry(0, true);
  printMpuServoTelemetry(1, false);
  printButtonServoTelemetry(0, false);
  printMpuServoTelemetry(2, false);
  printMpuServoTelemetry(3, false);
  printButtonServoTelemetry(1, false);
  Serial.println("]}");
}

// Lee comandos que envia la pagina tecnica por Serial. La deteccion manda
// {"type":"cmd_status"}; respondemos de inmediato con la identidad para que
// el descubrimiento sea rapido y fiable.
// Funcion       | handleSerialCommands: procesa comandos de armado, paro e identidad.
void handleSerialCommands() {
  while (Serial.available() > 0) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (serialCmdBuffer.length() > 0) {
        String cmd = serialCmdBuffer;
        cmd.toLowerCase();
        if (cmd.indexOf("cmd_disarm") >= 0 ||
            cmd.indexOf("cmd_stop") >= 0 ||
            cmd.indexOf("cmd_reset") >= 0 ||
            cmd.indexOf("disable_servos") >= 0 ||
            cmd.indexOf("desarmar") >= 0) {
          disarmServos("comando remoto");
          sendIdentity("ack");
          lastIdentityMs = millis();
        } else if (cmd.indexOf("cmd_arm") >= 0 ||
                   cmd.indexOf("arm_servos") >= 0 ||
                   cmd.indexOf("enable_servos") >= 0 ||
                   cmd.indexOf("armar") >= 0) {
          requestServoArm();
          sendIdentity("ack");
          lastIdentityMs = millis();
        } else if (cmd.indexOf("cmd_calibrate") >= 0 ||
                   cmd.indexOf("calibrate") >= 0 ||
                   cmd.indexOf("calibrar") >= 0) {
          bool wasArmed = servosArmed;
          disarmServos("calibracion neutral");
          calibrateMpuZeros();
          if (wasArmed) {
            requestServoArm();
          }
          sendIdentity("ack");
          lastIdentityMs = millis();
        } else if (cmd.indexOf("cmd_status") >= 0 ||
                   cmd.indexOf("status") >= 0 ||
                   cmd.indexOf("ping") >= 0) {
          sendIdentity("ack");
          lastIdentityMs = millis();
        }
        serialCmdBuffer = "";
      }
    } else if (serialCmdBuffer.length() < 200) {
      serialCmdBuffer += c;
    }
  }
}

// Funcion       | loop: atiende comandos, sensores y actualizacion periodica de servos.
void loop() {
  // Atiende la deteccion/handshake de la pagina tecnica en cada vuelta.
  handleSerialCommands();
  if (millis() - lastIdentityMs >= IDENTITY_INTERVAL_MS) {
    lastIdentityMs = millis();
    sendIdentity("status");
  }
  bool showStatus = millis() - lastStatusMs >= STATUS_INTERVAL_MS;
  for (byte i = 0; i < MPU_COUNT; i++) {
    updateServoFromMpu(i, showStatus);
  }
  for (byte i = 0; i < BUTTON_COUNT; i++) {
    updateServoFromButton(i, showStatus);
  }
  serviceServoArming();
  if (millis() - lastTelemetryMs >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryMs = millis();
    sendSensorTelemetry();
  }
  if (showStatus) {
    lastStatusMs = millis();
  }
  // Agregado: re-detecta periodicamente cualquier sensor que se haya caido.
  if (millis() - lastSensorRecheckMs >= SENSOR_RECHECK_INTERVAL_MS) {
    lastSensorRecheckMs = millis();
    recheckOfflineSensors();
  }
  delay(LOOP_DELAY_MS);
}
