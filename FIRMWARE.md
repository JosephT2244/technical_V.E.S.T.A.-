# V.E.S.T.A Firmware

Dos sketches Arduino separados para las placas del sistema. Todos los archivos
estan en la misma carpeta que la pagina tecnica.

## 1. ESP32-S3 controller

Archivo principal:

```text
esp32_s3_controller.ino
esp32_s3_config.h
```

Responsabilidades:

- Lee 4 MPU6050 por TCA9548A.
- Lee 2 flex sensors de 4.5 in.
- Controla 6 servos DS51150 por PCA9685.
- Atiende el boton fisico de paro en `PIN_ESTOP`.
- Publica WebSocket en `ws://vesta-exo.local:81`.
- Recibe perfil de calibracion desde la pagina tecnica.
- Recibe estado de la ESP32-CAM y lo reenvia a app/tecnico.

Librerias:

- ArduinoJson
- WebSockets
- Adafruit PWM Servo Driver Library
- MPU6050 by Electronic Cats

FQBN inicial:

```text
esp32:esp32:esp32s3
```

## 2. ESP32-CAM assistant

Archivo principal:

```text
esp32_cam_assistant.ino
esp32_cam_config.h
```

Responsabilidades:

- Sirve video MJPEG en `http://vesta-cam.local/stream`.
- Sirve captura JPEG en `http://vesta-cam.local/capture`.
- Publica WebSocket de app en `ws://vesta-cam.local:82`.
- Lee microfono I2S, pensado para INMP441 o equivalente.
- Envia audio PCM16 mono a la app por WebSocket.
- Se conecta al S3 en `ws://vesta-exo.local:81` y reporta estado.

FQBN inicial:

```text
esp32:esp32:esp32cam
```

## Interconexion

La interconexion entre placas es por WiFi:

```text
App/tecnico <---- WebSocket ----> ESP32-S3
App/tecnico <---- HTTP/WS ------> ESP32-CAM
ESP32-CAM  <---- WebSocket ----> ESP32-S3
```

El S3 es la autoridad de seguridad y movimiento. La CAM no mueve servos; solo
entrega vision/audio y reporta su estado al S3.

## Paro fisico

El boton de paro va entre `PIN_ESTOP` y `GND`; el firmware usa `INPUT_PULLUP`.
Cuando se presiona, el S3 entra en modo emergencia, ignora movimiento y congela
los servos en su ultima posicion. Si quieres que suelte la senal PWM, cambia:

```cpp
#define ESTOP_RELEASES_SERVOS 1
```

en `esp32_s3_config.h`.

## Microfono

El sketch de CAM asume microfono I2S:

```text
BCLK -> GPIO14
WS   -> GPIO15
DOUT -> GPIO13
3V3  -> 3.3V
GND  -> GND
```

Esos pines comparten lineas con la SD en muchos modulos ESP32-CAM. No uses SD al
mismo tiempo, o cambia los pines en `esp32_cam_config.h`.
