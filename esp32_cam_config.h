/* Archivo        | esp32_cam_config.h: configuracion de red, pines y perfiles para la ESP32-CAM. */
/*
  V.E.S.T.A. ESP32-CAM realtime configuration

  Defaults target the AI Thinker ESP32-CAM with OV2640.
  Edit WIFI_SSID and WIFI_PASSWORD before uploading if you want STA mode.
  If credentials stay as placeholders or WiFi fails, the camera creates an AP.
*/

#ifndef VESTA_CAM_CONFIG_H
#define VESTA_CAM_CONFIG_H

#include "esp_camera.h"
#include <esp_wifi_types.h>

#define WIFI_SSID       "TU_RED_WIFI"
#define WIFI_PASSWORD   "TU_CONTRASENA"

#define CAM_AP_SSID     "VESTA-CAM-SETUP"
#define CAM_AP_PASSWORD "vesta1234"

#define HTTP_PORT       80
#define CAM_STREAM_PORT 81

// Keep the camera responsive without pushing the module as hot as possible.
#define CAM_CPU_MHZ       160
#define CAM_WIFI_TX_POWER WIFI_POWER_8_5dBm
#define CAM_STA_CONNECT_TRIES 24
#define CAM_STA_CONNECT_DELAY_MS 250
#define CAM_AP_CHANNEL 1
#define CAM_AP_MAX_CLIENTS 1
#define CAM_WIFI_BOOT_SETTLE_MS 140

// AI Thinker ESP32-CAM pins.
#define CAM_PIN_PWDN    32
#define CAM_PIN_RESET   -1
#define CAM_PIN_XCLK    0
#define CAM_PIN_SIOD    26
#define CAM_PIN_SIOC    27
#define CAM_PIN_D7      35
#define CAM_PIN_D6      34
#define CAM_PIN_D5      39
#define CAM_PIN_D4      36
#define CAM_PIN_D3      21
#define CAM_PIN_D2      19
#define CAM_PIN_D1      18
#define CAM_PIN_D0      5
#define CAM_PIN_VSYNC   25
#define CAM_PIN_HREF    23
#define CAM_PIN_PCLK    22
#define CAM_FLASH_LED   4

#define CAM_XCLK_FREQ_HZ 20000000
#define CAM_STATUS_INTERVAL_MS 2500
#define CAM_CLIENT_IDLE_DELAY_MS 5
#define CAM_FRAME_FAIL_RECOVERIES 4

// Estructura    | VestaCamPreset: describe un perfil de resolucion, calidad y ritmo.
struct VestaCamPreset {
  const char *id;
  const char *label;
  framesize_t frameSize;
  uint8_t jpegQuality;
  uint16_t frameIntervalMs;
};

// Constantes    | CAM_PRESET_*: indices usados para elegir perfiles de camara.
const uint8_t CAM_PRESET_FAST = 0;
const uint8_t CAM_PRESET_BALANCED = 1;
const uint8_t CAM_PRESET_QUALITY = 2;

// In ESP32-CAM JPEG quality, lower numbers mean better image and heavier frames.
// Tabla         | CAM_PRESETS: parametros disponibles para el stream de la ESP32-CAM.
const VestaCamPreset CAM_PRESETS[] = {
  {"fast", "Rapido", FRAMESIZE_QQVGA, 21, 70},
  {"balanced", "Equilibrado", FRAMESIZE_QVGA, 15, 90},
  {"quality", "Calidad", FRAMESIZE_QVGA, 11, 140}
};

// Constante     | CAM_DEFAULT_PRESET: perfil inicial usado al arrancar firmware.
const uint8_t CAM_DEFAULT_PRESET = CAM_PRESET_BALANCED;

#endif
