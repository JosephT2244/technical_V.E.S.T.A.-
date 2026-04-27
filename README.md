# technical_V.E.S.T.A. — Banco del instalador

Herramienta local e independiente para armar V.E.S.T.A. **desde cero**,
calibrarlo, probarlo y dejarlo listo para que la app de consumo final
(`C:\VSC\V.E.S.T.A`) sólo tenga que conectarse y operar.

Este folder es el único punto de entrada para:

- Cargar firmware al ESP32-S3 N16R8 y al ESP32-CAM.
- Calibrar servos, IMUs y flex sensors.
- Definir mapeo de asistencia y topes mecánicos.
- Ejecutar pruebas automatizadas de motorización y sensores.
- Generar el perfil de entrega (JSON) y firmarlo en el ESP32.

La app de consumo final **no calibra y no sube código** — esa
responsabilidad vive aquí.

Repo: https://github.com/JosephT2244/technical_V.E.S.T.A.-

---

## Cómo correr

```powershell
cd C:\VSC\technical_V.E.S.T.A
node server.js 5177
```

Abrir:

```text
http://127.0.0.1:5177
```

También se puede usar `start-server.bat`.

---

## Flujo de armado de extremo a extremo

La página está organizada en 8 fases consecutivas:

| # | Panel        | Qué se hace ahí                                                             |
|---|--------------|-----------------------------------------------------------------------------|
| 01| Armado       | BOM + pasos físicos (estructura, cableado, energía, paro físico).           |
| 02| Firmware     | Sube `esp32_s3_controller.ino` y `esp32_cam_assistant.ino` por arduino-cli. |
| 03| Diagnóstico  | Checa hardware vivo (controlador, mux, drivers, sensores, baterías).        |
| 04| Servos       | PWM mín/máx, home, dirección, offset y prueba individual de cada servo.    |
| 05| Sensores     | Captura neutral/min/max para los 4 MPU6050 y los 2 flex.                    |
| 06| Mapeo        | Asistencia, zona muerta, suavizado y velocidad máxima.                      |
| 07| Pruebas      | Suite automatizada que verifica enlace, modos, sweep de servos y emergencia.|
| 08| Entrega      | Readiness gate + generación y envío del perfil JSON al ESP32.               |

El botón **Enviar perfil** del panel Entrega se habilita sólo cuando todas
las fases están en verde.

---

## Electrónica modelada

- ESP32-S3 N16R8 con antena externa: control, sensores y servos.
- ESP32-CAM: stream auxiliar para IA/visión y micrófono I2S.
- 6 servos DS51150 de 150 kg/cm y 270°, por PCA9685.
- 4 MPU6050 por TCA9548A (hombros lateral y frontal de cada lado).
- 2 flex sensors de 4.5 in (codos izquierdo y derecho).
- Botón físico de paro de emergencia.

---

## Identidad visual

La herramienta usa una copia local del logo en `logo_vesta.png` y la
paleta azul/metal de la app principal. La copia evita depender de rutas de
Flutter durante la instalación técnica.

---

## Protocolo WebSocket usado

Comandos básicos de control:

```json
{"type":"cmd_status"}
{"type":"cmd_mode","mode":"manual|assisted|automatic"}
{"type":"cmd_angle","id":0,"angle":30}
{"type":"cmd_assist","level":0.5}
{"type":"cmd_calibrate"}
{"type":"cmd_stop"}
{"type":"cmd_reset"}
{"type":"cmd_home"}
```

Comandos de calibración persistente (sólo desde esta herramienta):

```json
{"type":"cmd_calibration_profile","profile":{}}
{"type":"cmd_calibration_servos","servos":[]}
{"type":"cmd_calibration_sensors","imus":[],"flex":[]}
{"type":"cmd_calibration_mapping","tuning":{}}
```

El firmware de `esp32_s3_controller.ino` los persiste en NVS vía
`Preferences`. Mientras la calibración no esté grabada, también se guarda
en `localStorage` del navegador y se puede descargar como JSON.

---

## Carga de firmware

La pestaña `Firmware` carga por defecto los sketches que están junto a la
página, detecta periódicamente los puertos COM conectados al equipo
técnico y permite preparar o subir código a:

- ESP32-S3 N16R8: control de servos, sensores y WebSocket.
- ESP32-CAM: stream de visión auxiliar.

Requiere `arduino-cli` disponible en el `PATH` del equipo técnico y los
cores de ESP32 instalados. Si `arduino-cli` no está instalado, la página
todavía puede listar puertos seriales de Windows, pero la verificación o
subida no se ejecuta. El servidor local expone:

```text
GET  /api/arduino/status
GET  /api/arduino/ports
POST /api/arduino/upload
```

Valores iniciales de placa:

```text
ESP32-S3  -> esp32:esp32:esp32s3
ESP32-CAM -> esp32:esp32:esp32cam
```

Sketches:

```text
esp32_s3_controller.ino
esp32_s3_config.h
esp32_cam_assistant.ino
esp32_cam_config.h
```

Cada placa tiene su archivo de configuración propio para WiFi, pines y
parámetros. Al verificar o subir, el servidor copia sólo los archivos de
esa placa a una ubicación temporal con la estructura que espera Arduino
CLI.

---

## Suite de pruebas

El panel **Pruebas** corre, sobre el hardware real conectado, una suite que
verifica:

- Enlace WebSocket (paquetes recibidos del S3).
- ACK con firmware reportado.
- Salida de estado de emergencia.
- Cambio entre modos manual / asistido / automático.
- Sweep individual home → max → home en los 6 servos.
- Lectura en vivo de los 4 IMUs y los 2 flex.
- Activación remota de la parada de emergencia.

Cada caso devuelve un mensaje breve al log y queda registrado en el perfil
de entrega bajo la sección `tests` con su timestamp.

---

## Salida de entrega

La pestaña `Entrega` genera un perfil JSON con:

- `metadata`: serie, técnico, cliente y notas.
- `assembly`: BOM y pasos del armado físico.
- `servos`: canales, límites, home, dirección, offsets y PWM.
- `sensors`: buses MPU6050, pines flex, capturas de neutral/min/max.
- `tuning`: asistencia, zona muerta, suavizado y velocidad máxima.
- `tests`: resultado de la suite con timestamps.
- `firmwareUpload`: FQBN, puerto y estado del código en el editor.
- `safety.consumerVisible = false`: marca de herramienta sólo para
  instalador.

El botón **Enviar perfil** envía el JSON al ESP32-S3 vía
`cmd_calibration_profile`. Una vez aplicado y persistido en NVS, la app
del usuario final puede conectarse y operar sin tocar nada de calibración
ni de firmware.
