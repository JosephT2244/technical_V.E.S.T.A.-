#ifndef VESTA_CAM_CONFIG_H
#define VESTA_CAM_CONFIG_H

// V.E.S.T.A. ESP32-CAM assistant bridge.
// Defaults target the AI Thinker ESP32-CAM board.

#define WIFI_SSID       "TU_RED_WIFI"
#define WIFI_PASSWORD   "TU_CONTRASENA"

#define MDNS_HOST       "vesta-cam"
#define HTTP_PORT       80
#define APP_WS_PORT     82

// ESP32-S3 controller bridge. mDNS usually resolves this as vesta-exo.local.
#define S3_HOST         "vesta-exo.local"
#define S3_WS_PORT      81

// AI Thinker camera pins.
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

// I2S microphone, e.g. INMP441.
// These pins use the SD-card pins on AI Thinker boards. Do not use the SD card
// at the same time unless you remap the microphone.
#define MIC_I2S_BCLK    14
#define MIC_I2S_WS      15
#define MIC_I2S_DIN     13
#define MIC_SAMPLE_RATE 16000
#define MIC_CHUNK_SAMPLES 512

// Camera stream quality.
#define CAMERA_FRAME_SIZE FRAMESIZE_VGA
#define CAMERA_JPEG_QUALITY 12
#define CAMERA_FB_COUNT 2

// Audio stream to app over WebSocket as raw 16-bit mono PCM binary frames.
#define AUDIO_STREAM_DEFAULT false

#endif
