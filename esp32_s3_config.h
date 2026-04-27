#ifndef VESTA_S3_CONFIG_H
#define VESTA_S3_CONFIG_H

// V.E.S.T.A. ESP32-S3 controller.
// Edit this file before uploading.

#define WIFI_SSID      "TU_RED_WIFI"
#define WIFI_PASSWORD  "TU_CONTRASENA"

#define MDNS_HOST      "vesta-exo"
#define WS_PORT        81

// ESP32-S3 N16R8 pins.
#define PIN_SDA        8
#define PIN_SCL        9
#define PIN_FLEX_L     34
#define PIN_FLEX_R     35
#define PIN_ESTOP      4      // Emergency button to GND. Uses INPUT_PULLUP.

// I2C devices.
#define TCA_ADDR       0x70
#define PCA_ADDR       0x40
#define MPU_ADDR       0x68

// TCA9548A channels for the four MPU6050 sensors.
#define IMU_L_LAT      0
#define IMU_L_FRO      1
#define IMU_R_LAT      2
#define IMU_R_FRO      3
#define NUM_IMUS       4

// PCA9685 servo channels. Keep this in the same order used by the app.
#define SRV_L_LAT      0
#define SRV_L_FRO      1
#define SRV_L_ELB      2
#define SRV_R_LAT      3
#define SRV_R_FRO      4
#define SRV_R_ELB      5
#define N_SERVOS       6

// DS51150: 150 kg/cm, 270 deg, standard servo PWM.
#define PWM_FREQ       50
#define PWM_MIN_TICK   102    // approx 500 us
#define PWM_MAX_TICK   512    // approx 2500 us

// Hard safe limits for the exoskeleton joints, not for the bare servo.
static const float SRV_HARD_MIN[N_SERVOS] = { 0,   0,  0,  0,   0,  0 };
static const float SRV_HARD_MAX[N_SERVOS] = {90, 120, 90, 90, 120, 90 };

// Flex sensor defaults for a 4.5 in sensor with 10k pull-down.
#define FLEX_ADC_0DEG_DEFAULT    2162
#define FLEX_ADC_90DEG_DEFAULT   1705

// Filters and timing.
#define COMP_ALPHA               0.96f
#define FLEX_EMA_ALPHA           0.20f
#define CTRL_MS                  20
#define SEND_MS                  50
#define CAM_TIMEOUT_MS           4000

// Emergency behavior.
// 0 = freeze/hold last PWM; 1 = release PWM signal.
#define ESTOP_RELEASES_SERVOS    0

#endif
