// Comentarios de programador: identifican hardware, datos y flujo sin alterar la logica.
// Archivo        | esp32_s3_config.h: configuracion de red, BLE, sensores y servos del ESP32-S3.

#ifndef VESTA_S3_CONFIG_H                                                             // Guarda de cabecera: evita inclusion doble de VESTA_S3_CONFIG_H.
#define VESTA_S3_CONFIG_H                                                             // Macro VESTA_S3_CONFIG_H: macro de configuracion para vesta s3 config h.

// V.E.S.T.A. ESP32-S3 controller.
// Edit this file before uploading.

#define WIFI_SSID      "TU_RED_WIFI"                                                  // Macro WIFI_SSID: macro de configuracion para comunicaciones y puertos.
#define WIFI_PASSWORD  "TU_CONTRASENA"                                                // Macro WIFI_PASSWORD: macro de configuracion para comunicaciones y puertos.

// Battery/standalone fallback. If the S3 cannot join WIFI_SSID at boot, it
// creates this access point so the technician console can still connect to:
//   ws://192.168.4.1:81
#define S3_AP_SSID       "VESTA-S3-BATERIA"                                           // Macro S3_AP_SSID: macro de configuracion para s3 ap ssid.
#define S3_AP_PASSWORD   "vesta1234"                                                  // Macro S3_AP_PASSWORD: macro de configuracion para s3 ap password.
#define S3_AP_CHANNEL    6                                                            // Macro S3_AP_CHANNEL: macro de configuracion para s3 ap channel.
#define S3_AP_MAX_CLIENTS 2                                                           // Macro S3_AP_MAX_CLIENTS: macro de configuracion para s3 ap max clients.

#define MDNS_HOST      "vesta-exo"                                                    // Macro MDNS_HOST: macro de configuracion para mdns host.
#define WS_PORT        81                                                             // Macro WS_PORT: macro de configuracion para comunicaciones y puertos.

// Standalone boot behavior. The S3 starts manual and disarmed: boot must never
// move an exoskeleton joint until the operator sends an explicit command.
#define BOOT_MODE      "manual"                                                       // Macro BOOT_MODE: macro de configuracion para boot mode.
#define BOOT_ASSIST_LEVEL 1.0f                                                        // Macro BOOT_ASSIST_LEVEL: macro de configuracion para boot assist level.
#define WIFI_BOOT_CONNECT_TIMEOUT_MS 1500                                             // Macro WIFI_BOOT_CONNECT_TIMEOUT_MS: macro de configuracion para comunicaciones y puertos.
#define WIFI_RECONNECT_INTERVAL_MS  5000                                              // Macro WIFI_RECONNECT_INTERVAL_MS: macro de configuracion para comunicaciones y puertos.

// 1 = isolate servo/PCA9685 tests from IMU/AS5600 setup and reads.
// Set to 0 when the sensor-assisted behavior is ready to test again.
#define SENSORLESS_SERVO_TEST 0                                                       // Macro SENSORLESS_SERVO_TEST: prueba manual sin sensores.

// Bench-friendly MPU behavior: use movement magnitude from neutral so the
// servos react even if an MPU is mounted in the opposite orientation.
#define IMU_USE_ABSOLUTE_DELTA  1                                                     // Macro IMU_USE_ABSOLUTE_DELTA: macro de configuracion para lectura de sensores IMU/I2C.

// Low-latency phone link. BLE is for control and telemetry, not camera video.
#define BLE_ENABLED    1                                                              // Macro BLE_ENABLED: macro de configuracion para enlace BLE.
#define BLE_DEVICE_NAME "VESTA-S3"                                                    // Macro BLE_DEVICE_NAME: macro de configuracion para enlace BLE.
#define BLE_SERVICE_UUID        "8f7d0001-9828-4f6a-9a1f-5e3f4b7a0001"                // Macro BLE_SERVICE_UUID: macro de configuracion para enlace BLE.
#define BLE_COMMAND_CHAR_UUID   "8f7d0002-9828-4f6a-9a1f-5e3f4b7a0001"                // Macro BLE_COMMAND_CHAR_UUID: macro de configuracion para enlace BLE.
#define BLE_TELEMETRY_CHAR_UUID "8f7d0003-9828-4f6a-9a1f-5e3f4b7a0001"                // Macro BLE_TELEMETRY_CHAR_UUID: macro de configuracion para enlace BLE.
#define BLE_STATUS_CHAR_UUID    "8f7d0004-9828-4f6a-9a1f-5e3f4b7a0001"                // Macro BLE_STATUS_CHAR_UUID: macro de configuracion para enlace BLE.
#define BLE_MTU                 185                                                   // Macro BLE_MTU: macro de configuracion para enlace BLE.
#define BLE_NOTIFY_MS           20                                                    // Macro BLE_NOTIFY_MS: macro de configuracion para enlace BLE.
#define BLE_MIN_CONN_INTERVAL   6     // 7.5 ms units
#define BLE_MAX_CONN_INTERVAL   12    // 15 ms units

// ESP32-S3 N16R8 pins.
#define PIN_SDA        8                                                              // Macro PIN_SDA: macro de configuracion para pin sda.
#define PIN_SCL        9                                                              // Macro PIN_SCL: macro de configuracion para pin scl.
// Boton fisico de paro de emergencia retirado. Pin GPIO4 libre para otro uso.
// (PIN_ESTOP ya no se usa en el firmware; paro/reset es solo remoto.)
#define I2C_CLOCK_HZ   400000 // Mas rapido para que 4 MPU + 2 AS5600 no pausen la rampa de servos.
#define I2C_BOOT_SETTLE_MS 1000                                                       // Macro I2C_BOOT_SETTLE_MS: espera para que PCA/TCA/sensores despierten antes de escanear.

// I2C devices.
#define TCA_ADDR       0x70                                                           // Macro TCA_ADDR: macro de configuracion para lectura de sensores IMU/I2C.
#define PCA_ADDR       0x40                                                           // Macro PCA_ADDR: macro de configuracion para pca addr.
#define MPU_ADDR       0x68                                                           // Macro MPU_ADDR: macro de configuracion para lectura de sensores IMU/I2C.
#define AS5600_ADDR    0x36                                                           // Macro AS5600_ADDR: direccion I2C fija del sensor magnetico AS5600.

// IMU logical indices (used as array indices for imuCfg[], filters, etc.).
// These are NOT the physical TCA9548A channel numbers — see IMU_TCA_CHANNEL
// below for the actual SDx/SCx channel each MPU is wired to.
#define IMU_L_LAT      0                                                              // Macro IMU_L_LAT: macro de configuracion para lectura de sensores IMU/I2C.
#define IMU_L_FRO      1                                                              // Macro IMU_L_FRO: macro de configuracion para lectura de sensores IMU/I2C.
#define IMU_R_LAT      2                                                              // Macro IMU_R_LAT: macro de configuracion para lectura de sensores IMU/I2C.
#define IMU_R_FRO      3                                                              // Macro IMU_R_FRO: macro de configuracion para lectura de sensores IMU/I2C.
#define NUM_IMUS       4                                                              // Macro NUM_IMUS: macro de configuracion para lectura de sensores IMU/I2C.

// Physical TCA9548A channel for each IMU index above.
// MPUs use channels 0..3; the elbow AS5600 sensors use channels 4 and 5.
static const uint8_t IMU_TCA_CHANNEL[NUM_IMUS] = { 0, 1, 2, 3 };                      // Arreglo IMU_TCA_CHANNEL: canales fisicos del multiplexor TCA9548A para cada IMU.

// AS5600 logical indices and physical TCA9548A channels. AS5600 has fixed I2C
// address 0x36, so the two elbow sensors must be isolated on different TCA
// channels.
#define AS5600_L_ELB   0                                                              // Macro AS5600_L_ELB: indice logico del AS5600 del codo izquierdo.
#define AS5600_R_ELB   1                                                              // Macro AS5600_R_ELB: indice logico del AS5600 del codo derecho.
#define NUM_AS5600     2                                                              // Macro NUM_AS5600: cantidad de sensores AS5600 de codo.
static const uint8_t AS5600_TCA_CHANNEL[NUM_AS5600] = { 4, 5 };                       // Arreglo AS5600_TCA_CHANNEL: canales fisicos del TCA para codos izq/der.

// PCA9685 servo channels. Keep this in the same order used by the app.
#define SRV_L_LAT      0                                                              // Macro SRV_L_LAT: macro de configuracion para srv l lat.
#define SRV_L_FRO      1                                                              // Macro SRV_L_FRO: macro de configuracion para srv l fro.
#define SRV_L_ELB      2                                                              // Macro SRV_L_ELB: macro de configuracion para srv l elb.
#define SRV_R_LAT      3                                                              // Macro SRV_R_LAT: macro de configuracion para srv r lat.
#define SRV_R_FRO      4                                                              // Macro SRV_R_FRO: macro de configuracion para srv r fro.
#define SRV_R_ELB      5                                                              // Macro SRV_R_ELB: macro de configuracion para srv r elb.
#define N_SERVOS       6                                                              // Macro N_SERVOS: macro de configuracion para control angular de servos.

// DS51150: 150 kg/cm, 270 deg, standard servo PWM.
#define PWM_FREQ       50                                                             // Macro PWM_FREQ: macro de configuracion para control angular de servos.
#define PWM_MIN_TICK   102    // approx 500 us
#define PWM_MAX_TICK   512    // approx 2500 us

// Boot movement is disabled by default. Keep the legacy sweep macros at 0 so
// older bundled sketches also avoid automatic servo motion during startup.
#define SERVO_BOOT_SWEEP_ENABLED   0
#define SERVO_BOOT_SWEEP_STEP_DEG  10
#define SERVO_BOOT_SWEEP_DELAY_MS  60

// Hard safe limits for the exoskeleton joints, not for the bare servo.
static const float SRV_HARD_MIN[N_SERVOS] = { 0,   0,  0,  0,   0,  0 };              // Arreglo SRV_HARD_MIN: limites mecanicos minimos permitidos por servo.
static const float SRV_HARD_MAX[N_SERVOS] = {90, 120, 90, 90, 120, 90 };              // Arreglo SRV_HARD_MAX: limites mecanicos maximos permitidos por servo.

// AS5600 elbow defaults. RAW_ANGLE is 12-bit: 4096 counts per full turn, so
// 90 degrees equals 1024 counts. If the UI has not captured raw0/raw90 yet,
// the firmware uses the first valid boot reading as the neutral baseline.
#define AS5600_RAW_0DEG_DEFAULT  0                                                    // Macro AS5600_RAW_0DEG_DEFAULT: lectura raw por defecto a 0 grados.
#define AS5600_RAW_90DEG_DEFAULT 1024                                                 // Macro AS5600_RAW_90DEG_DEFAULT: lectura raw por defecto a 90 grados.
#define AS5600_ELBOW_ALWAYS_ON   0                                                    // Macro AS5600_ELBOW_ALWAYS_ON: 0 = en modo manual los codos NO siguen al AS5600, asi el control manual de la app mueve los 6 servos sin ser pisado (los codos siguen al sensor en assisted/automatic).
#define AS5600_COUNTS_PER_REV    4096.0f                                              // Macro AS5600_COUNTS_PER_REV: resolucion del AS5600.
#define AS5600_COUNTS_90_DEG     1024.0f                                              // Macro AS5600_COUNTS_90_DEG: cuentas equivalentes a 90 grados.
#define AS5600_RAW_DEADBAND      1.5f                                                 // Macro AS5600_RAW_DEADBAND: zona muerta minima para que el codo no avance a saltos.
#define AS5600_FAIL_LIMIT        4                                                    // Macro AS5600_FAIL_LIMIT: lecturas I2C fallidas antes de marcar offline.
#define AS5600_RESPONSE_GAIN     4.0f                                                 // Macro AS5600_RESPONSE_GAIN: mas respuesta del iman en movimiento de servo.
#define IMU_RESPONSE_GAIN        3.0f                                                 // Macro IMU_RESPONSE_GAIN: mas respuesta de orientacion 3D de las MPU.
#define CONTROL_DEADBAND_DEFAULT 0.1f                                                 // Macro CONTROL_DEADBAND_DEFAULT: zona muerta casi grado a grado.
#define CONTROL_SMOOTHING_DEFAULT 1.00f                                               // Macro CONTROL_SMOOTHING_DEFAULT: rampa directa; el filtrado vive en sensores.
#define CONTROL_MAX_SPEED_DEFAULT 2400.0f                                             // Macro CONTROL_MAX_SPEED_DEFAULT: techo alto si se desactiva seguimiento directo.
#define CONTROL_MAX_STEP_DEG     270.0f                                               // Macro CONTROL_MAX_STEP_DEG: permite saltar al objetivo sin freno artificial.
#define CONTROL_TARGET_EPSILON_DEG 0.05f                                              // Macro CONTROL_TARGET_EPSILON_DEG: tolerancia fina antes de detener el servo.
#define CONTROL_DIRECT_SERVO_FOLLOW 1                                                 // Macro CONTROL_DIRECT_SERVO_FOLLOW: 1 = PWM sigue target/sensor a velocidad real.

// Filters and timing.
#define COMP_ALPHA               0.97f                                                // Macro COMP_ALPHA: macro de configuracion para comp alpha.
#define AS5600_EMA_ALPHA         1.00f                                                // Macro AS5600_EMA_ALPHA: AS5600 sin retardo para seguir al sensor.
#define IMU_OUTPUT_EMA_ALPHA     1.00f                                                // Macro IMU_OUTPUT_EMA_ALPHA: MPU sin retardo para seguir al sensor.
#define IMU_ACCEL_JUMP_LIMIT_DEG 28.0f                                                // Macro IMU_ACCEL_JUMP_LIMIT_DEG: macro de configuracion para control angular de servos.
#define IMU_GYRO_RATE_LIMIT_DPS  220.0f                                               // Macro IMU_GYRO_RATE_LIMIT_DPS: macro de configuracion para lectura de sensores IMU/I2C.
#define IMU_DT_MAX_SEC           0.05f                                                // Macro IMU_DT_MAX_SEC: macro de configuracion para lectura de sensores IMU/I2C.
#define IMU_FAIL_LIMIT           6                                                    // Macro IMU_FAIL_LIMIT: macro de configuracion para lectura de sensores IMU/I2C.
#define IMU_READ_SETTLE_US       250                                                  // Macro IMU_READ_SETTLE_US: menor pausa al cambiar canal TCA para mejorar fluidez.
#define CTRL_MS                  5                                                    // Macro CTRL_MS: control mas frecuente para movimiento fluido.
#define SENSOR_READ_MS           2                                                    // Macro SENSOR_READ_MS: lee un sensor por turno para evitar pausas largas.
#define SEND_MS                  100                                                  // Macro SEND_MS: telemetria ligera para no competir con el control.
#define CAM_TIMEOUT_MS           4000                                                 // Macro CAM_TIMEOUT_MS: macro de configuracion para camara y video.

// Emergency behavior.
// 0 = freeze/hold last PWM; 1 = release PWM signal.
#define ESTOP_RELEASES_SERVOS    0                                                    // Macro ESTOP_RELEASES_SERVOS: macro de configuracion para control angular de servos.

#endif                                                                                // Cierre de directiva de compilacion condicional.
