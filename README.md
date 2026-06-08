<!-- Comentarios de programador: identifican secciones, listas, tablas y ejemplos del documento. -->

<!-- Comentario de seccion: technical V E S T A — Banco del instalador. -->
# technical_V.E.S.T.A. — Banco del instalador

<!-- Comentario de parrafo: Herramienta local e independiente para armar V E S T A desde cero. -->
Herramienta local e independiente para armar V.E.S.T.A. **desde cero**,
<!-- Comentario de parrafo: calibrarlo probarlo y dejarlo listo para que la app de consumo final. -->
calibrarlo, probarlo y dejarlo listo para que la app de consumo final
<!-- Comentario de dato: C \VSC\V E S T A sólo tenga que conectarse y operar. -->
(`C:\VSC\V.E.S.T.A`) sólo tenga que conectarse y operar.

<!-- Comentario de dato: Este folder es el único punto de entrada para. -->
Este folder es el único punto de entrada para:

<!-- Comentario de lista: Cargar firmware al ESP32-S3 N16R8 y al ESP32-CAM. -->
- Cargar firmware al ESP32-S3 N16R8 y al ESP32-CAM.
<!-- Comentario de lista: Calibrar servos IMUs y AS5600. -->
- Calibrar servos, IMUs y AS5600.
<!-- Comentario de lista: Definir mapeo de asistencia y topes mecánicos. -->
- Definir mapeo de asistencia y topes mecánicos.
<!-- Comentario de lista: Ejecutar pruebas automatizadas de motorización y sensores. -->
- Ejecutar pruebas automatizadas de motorización y sensores.
<!-- Comentario de lista: Generar el perfil de entrega JSON y firmarlo en el ESP32. -->
- Generar el perfil de entrega (JSON) y firmarlo en el ESP32.

<!-- Comentario de parrafo: La app de consumo final no calibra y no sube código — esa. -->
La app de consumo final **no calibra y no sube código** — esa
<!-- Comentario de parrafo: responsabilidad vive aquí. -->
responsabilidad vive aquí.

<!-- Comentario de dato: Repo https //github com/JosephT2244/technical V E S T A -. -->
Repo: https://github.com/JosephT2244/technical_V.E.S.T.A.-

<!-- Comentario de separador: divide bloques principales del documento. -->
---

<!-- Comentario de seccion: Cómo correr. -->
## Cómo correr

<!-- Comentario de bloque de codigo: ejemplo literal para copiar o verificar. -->
```powershell
cd C:\VSC\technical_V.E.S.T.A
node server.js 5177
```

<!-- Comentario de dato: Abrir. -->
Abrir:

<!-- Comentario de bloque de codigo: ejemplo literal para copiar o verificar. -->
```text
http://127.0.0.1:5177
```

<!-- Comentario de parrafo: También se puede usar start-server bat. -->
También se puede usar `start-server.bat`.

<!-- Comentario de separador: divide bloques principales del documento. -->
---

<!-- Comentario de seccion: Flujo de armado de extremo a extremo. -->
## Flujo de armado de extremo a extremo

<!-- Comentario de dato: La página está organizada en 8 fases consecutivas. -->
La página está organizada en 8 fases consecutivas:

<!-- Comentario de tabla: fila de referencia tecnica. -->
| # | Panel        | Qué se hace ahí                                                             |
<!-- Comentario de tabla: separador de columnas Markdown. -->
|---|--------------|-----------------------------------------------------------------------------|
<!-- Comentario de tabla: fila de referencia tecnica. -->
| 01| Armado       | BOM + pasos físicos (estructura, cableado, energía, paro físico).           |
<!-- Comentario de tabla: fila de referencia tecnica. -->
| 02| Firmware     | Sube `esp32_s3_controller.ino` y `esp32_cam_assistant.ino` por arduino-cli. |
<!-- Comentario de tabla: fila de referencia tecnica. -->
| 03| Diagnóstico  | Checa hardware vivo (controlador, mux, drivers, sensores, baterías).        |
<!-- Comentario de tabla: fila de referencia tecnica. -->
| 04| Servos       | PWM mín/máx, home, dirección, offset y prueba individual de cada servo.    |
<!-- Comentario de tabla: fila de referencia tecnica. -->
| 05| Sensores     | Captura neutral/min/max para los 4 MPU6050 y raw0/raw90 para 2 AS5600.      |
<!-- Comentario de tabla: fila de referencia tecnica. -->
| 06| Mapeo        | Asistencia, zona muerta, suavizado y velocidad máxima.                      |
<!-- Comentario de tabla: fila de referencia tecnica. -->
| 07| Pruebas      | Suite automatizada que verifica enlace, modos, sweep de servos y emergencia.|
<!-- Comentario de tabla: fila de referencia tecnica. -->
| 08| Entrega      | Readiness gate + generación y envío del perfil JSON al ESP32.               |

<!-- Comentario de parrafo: El botón Enviar perfil del panel Entrega se habilita sólo cuando todas. -->
El botón **Enviar perfil** del panel Entrega se habilita sólo cuando todas
<!-- Comentario de parrafo: las fases están en verde. -->
las fases están en verde.

<!-- Comentario de parrafo: Después de subir el firmware el ESP32-S3 no necesita seguir conectado a la. -->
Después de subir el firmware, el ESP32-S3 no necesita seguir conectado a la
<!-- Comentario de dato: computadora el sketch queda en flash y arranca solo con batería en modo. -->
computadora: el sketch queda en flash y arranca solo con batería en modo
<!-- Comentario de parrafo: manual desarmado El USB se usa para subir código y diagnóstico el control local. -->
`manual` y con los servos desarmados. El USB se usa para subir código y diagnóstico; el control local,
<!-- Comentario de parrafo: BLE y WiFi pueden funcionar sin la PC. -->
BLE y WiFi pueden funcionar sin la PC.

<!-- Comentario de separador: divide bloques principales del documento. -->
---

<!-- Comentario de seccion: Electrónica modelada. -->
## Electrónica modelada

<!-- Comentario de lista: ESP32-S3 N16R8 con antena externa control sensores y servos. -->
- ESP32-S3 N16R8 con antena externa: control, sensores y servos.
<!-- Comentario de lista: ESP32-CAM stream auxiliar para IA/visión y micrófono I2S. -->
- ESP32-CAM: stream auxiliar para IA/visión y micrófono I2S.
<!-- Comentario de lista: 6 servos DS51150 de 150 kg/cm y 270° por PCA9685. -->
- 6 servos DS51150 de 150 kg/cm y 270°, por PCA9685.
<!-- Comentario de lista: 4 MPU6050 por TCA9548A hombros lateral y frontal de cada lado. -->
- 4 MPU6050 por TCA9548A (hombros lateral y frontal de cada lado).
<!-- Comentario de lista: 2 AS5600 para codos por TCA9548A. -->
- 2 AS5600 para codos (izquierdo en TCA4 y derecho en TCA5, direccion I2C 0x36).
<!-- Comentario de lista: Botón físico de paro de emergencia. -->
- Botón físico de paro de emergencia.

<!-- Comentario de separador: divide bloques principales del documento. -->
---

<!-- Comentario de seccion: Identidad visual. -->
## Identidad visual

<!-- Comentario de parrafo: La herramienta usa una copia local del logo en logo vesta png y la. -->
La herramienta usa una copia local del logo en `logo_vesta.png` y la
<!-- Comentario de parrafo: paleta azul/metal de la app principal La copia evita depender de rutas de. -->
paleta azul/metal de la app principal. La copia evita depender de rutas de
<!-- Comentario de parrafo: Flutter durante la instalación técnica. -->
Flutter durante la instalación técnica.

<!-- Comentario de separador: divide bloques principales del documento. -->
---

<!-- Comentario de seccion: Protocolo WebSocket usado. -->
## Protocolo WebSocket usado

<!-- Comentario de dato: Comandos básicos de control. -->
Comandos básicos de control:

<!-- Comentario de bloque de codigo: ejemplo literal para copiar o verificar. -->
```json
{"type":"cmd_status"}
{"type":"cmd_mode","mode":"manual|assisted|automatic"}
{"type":"cmd_angle","id":0,"angle":30}
{"type":"cmd_assist","level":0.5}
{"type":"cmd_tuning","tuning":{"assistLevel":1,"deadbandDeg":0.1,"smoothing":1,"maxSpeedDegSec":2400}}
{"type":"cmd_calibrate"}
{"type":"cmd_arm"}
{"type":"cmd_disarm"}
{"type":"cmd_stop"}
{"type":"cmd_reset"}
{"type":"cmd_home"}
```

<!-- Comentario de dato: Comandos de calibración persistente sólo desde esta herramienta. -->
Comandos de calibración persistente (sólo desde esta herramienta):

<!-- Comentario de bloque de codigo: ejemplo literal para copiar o verificar. -->
```json
{"type":"cmd_calibration_profile","profile":{}}
{"type":"cmd_calibration_servos","servos":[]}
{"type":"cmd_calibration_sensors","imus":[],"as5600":[]}
{"type":"cmd_calibration_mapping","tuning":{}}
```

<!-- Comentario de parrafo: El firmware de esp32 s3 controller ino los persiste en NVS vía. -->
El firmware de `esp32_s3_controller.ino` los persiste en NVS vía
<!-- Comentario de parrafo: Preferences Mientras la calibración no esté grabada también se guarda. -->
`Preferences`. Mientras la calibración no esté grabada, también se guarda
<!-- Comentario de parrafo: en localStorage del navegador y se puede descargar como JSON. -->
en `localStorage` del navegador y se puede descargar como JSON.

<!-- Comentario de separador: divide bloques principales del documento. -->
---

<!-- Comentario de seccion: Carga de firmware. -->
## Carga de firmware

<!-- Comentario de parrafo: La pestaña Firmware carga por defecto los sketches que están junto a la. -->
La pestaña `Firmware` carga por defecto los sketches que están junto a la
<!-- Comentario de parrafo: página detecta periódicamente los puertos COM conectados al equipo. -->
página, detecta periódicamente los puertos COM conectados al equipo
<!-- Comentario de dato: técnico y permite preparar o subir código a. -->
técnico y permite preparar o subir código a:

<!-- Comentario de lista: ESP32-S3 N16R8 control de servos sensores y WebSocket. -->
- ESP32-S3 N16R8: control de servos, sensores y WebSocket.
<!-- Comentario de lista: ESP32-CAM stream de visión auxiliar. -->
- ESP32-CAM: stream de visión auxiliar.

<!-- Comentario de parrafo: Requiere arduino-cli disponible en el PATH del equipo técnico y los. -->
Requiere `arduino-cli` disponible en el `PATH` del equipo técnico y los
<!-- Comentario de parrafo: cores de ESP32 instalados Si arduino-cli no está instalado la página. -->
cores de ESP32 instalados. Si `arduino-cli` no está instalado, la página
<!-- Comentario de parrafo: todavía puede listar puertos seriales de Windows pero la verificación o. -->
todavía puede listar puertos seriales de Windows, pero la verificación o
<!-- Comentario de dato: subida no se ejecuta El servidor local expone. -->
subida no se ejecuta. El servidor local expone:

<!-- Comentario de bloque de codigo: ejemplo literal para copiar o verificar. -->
```text
GET  /api/arduino/status
GET  /api/arduino/ports
POST /api/arduino/upload
GET  /api/serial/status
GET  /api/serial/events
POST /api/serial/connect
POST /api/serial/send
POST /api/serial/disconnect
```

<!-- Comentario de parrafo: El panel lateral del ESP32-S3 tambien muestra esos puertos COM y permite. -->
El panel lateral del ESP32-S3 tambien muestra esos puertos COM y permite
<!-- Comentario de parrafo: conectar la herramienta por USB serial a 115200 baudios cuando se selecciona. -->
conectar la herramienta por USB serial a `115200` baudios cuando se selecciona
<!-- Comentario de parrafo: el puerto de la placa Al conectar por COM la herramienta pide estado al S3. -->
el puerto de la placa. Al conectar por COM, la herramienta pide estado al S3,
<!-- Comentario de parrafo: lee del ACK la IP/URL WebSocket y cambia automaticamente a la URL detectada. -->
lee del ACK la IP/URL WebSocket y cambia automaticamente a la URL detectada.

<!-- Comentario de parrafo: Para telefono sin cables el S3 anuncia BLE como VESTA-S3 La pagina. -->
Para telefono sin cables, el S3 anuncia BLE como `VESTA-S3`. La pagina
<!-- Comentario de parrafo: mobile ble html usa Web Bluetooth y el protocolo binario de baja latencia. -->
`mobile_ble.html` usa Web Bluetooth y el protocolo binario de baja latencia
<!-- Comentario de dato: documentado en FIRMWARE md write-without-response para comandos y. -->
documentado en `FIRMWARE.md`: write-without-response para comandos y
<!-- Comentario de parrafo: notificaciones de telemetria cada BLE NOTIFY MS Este enlace es para control. -->
notificaciones de telemetria cada `BLE_NOTIFY_MS`. Este enlace es para control
<!-- Comentario de parrafo: y sensores el video no va por BLE. -->
y sensores; el video no va por BLE.

<!-- Comentario de parrafo: El panel de ESP32-CAM tambien puede seleccionar su puerto COM El boton. -->
El panel de ESP32-CAM tambien puede seleccionar su puerto COM. El boton
<!-- Comentario de parrafo: Conectar COM pide estado a la CAM y con el firmware actual prefiere video. -->
`Conectar COM` pide estado a la CAM y, con el firmware actual, prefiere video
<!-- Comentario de parrafo: MJPEG por USB serial La pagina rellena una URL local. -->
MJPEG por USB serial. La pagina rellena una URL local
<!-- Comentario de dato: http //127 0 0 1 puerto /api/cam/usb-stream? y no cambia el WiFi de la. -->
`http://127.0.0.1:<puerto>/api/cam/usb-stream?...` y no cambia el WiFi de la
<!-- Comentario de parrafo: PC para que el equipo tecnico conserve internet durante la prueba El stream. -->
PC, para que el equipo tecnico conserve internet durante la prueba. El stream
<!-- Comentario de dato: HTTP http // ip /stream queda como respaldo cuando la PC ya esta en la misma. -->
HTTP `http://<ip>/stream` queda como respaldo cuando la PC ya esta en la misma
<!-- Comentario de parrafo: red que la CAM. -->
red que la CAM.

<!-- Comentario de dato: Endpoints CAM locales. -->
Endpoints CAM locales:

<!-- Comentario de bloque de codigo: ejemplo literal para copiar o verificar. -->
```text
POST /api/cam/discover
POST /api/cam/check
GET  /api/cam/stream
GET  /api/cam/usb-stream
```

<!-- Comentario de dato: Valores iniciales de placa. -->
Valores iniciales de placa:

<!-- Comentario de bloque de codigo: ejemplo literal para copiar o verificar. -->
```text
ESP32-S3  -> esp32:esp32:esp32s3:USBMode=hwcdc,CDCOnBoot=cdc,FlashSize=16M,PSRAM=opi,PartitionScheme=app3M_fat9M_16MB
ESP32-CAM -> esp32:esp32:esp32cam
```

<!-- Comentario de dato: Sketches. -->
Sketches:

<!-- Comentario de bloque de codigo: ejemplo literal para copiar o verificar. -->
```text
esp32_s3_controller.ino
esp32_s3_config.h
esp32_cam_assistant.ino
esp32_cam_config.h
```

<!-- Comentario de parrafo: Cada placa tiene su archivo de configuración propio para WiFi pines y. -->
Cada placa tiene su archivo de configuración propio para WiFi, pines y
<!-- Comentario de parrafo: parámetros Al verificar o subir el servidor copia sólo los archivos de. -->
parámetros. Al verificar o subir, el servidor copia sólo los archivos de
<!-- Comentario de parrafo: esa placa a una ubicación temporal con la estructura que espera Arduino. -->
esa placa a una ubicación temporal con la estructura que espera Arduino
<!-- Comentario de parrafo: CLI. -->
CLI.

<!-- Comentario de separador: divide bloques principales del documento. -->
---

<!-- Comentario de seccion: Suite de pruebas. -->
## Suite de pruebas

<!-- Comentario de parrafo: El panel Pruebas corre sobre el hardware real conectado una suite que. -->
El panel **Pruebas** corre, sobre el hardware real conectado, una suite que
<!-- Comentario de dato: verifica. -->
verifica:

<!-- Comentario de lista: Enlace WebSocket paquetes recibidos del S3. -->
- Enlace WebSocket (paquetes recibidos del S3).
<!-- Comentario de lista: ACK con firmware reportado. -->
- ACK con firmware reportado.
<!-- Comentario de lista: Salida de estado de emergencia. -->
- Salida de estado de emergencia.
<!-- Comentario de lista: Cambio entre modos manual / asistido / automático. -->
- Cambio entre modos manual / asistido / automático.
<!-- Comentario de lista: Sweep individual home → max → home en los 6 servos. -->
- Sweep individual home → max → home en los 6 servos.
<!-- Comentario de lista: Lectura en vivo de los 4 IMUs y los 2 AS5600. -->
- Lectura en vivo de los 4 IMUs y los 2 AS5600.
<!-- Comentario de lista: Activación remota de la parada de emergencia. -->
- Activación remota de la parada de emergencia.

<!-- Comentario de parrafo: Cada caso devuelve un mensaje breve al log y queda registrado en el perfil. -->
Cada caso devuelve un mensaje breve al log y queda registrado en el perfil
<!-- Comentario de parrafo: de entrega bajo la sección tests con su timestamp. -->
de entrega bajo la sección `tests` con su timestamp.

<!-- Comentario de separador: divide bloques principales del documento. -->
---

<!-- Comentario de seccion: Salida de entrega. -->
## Salida de entrega

<!-- Comentario de dato: La pestaña Entrega genera un perfil JSON con. -->
La pestaña `Entrega` genera un perfil JSON con:

<!-- Comentario de lista: metadata serie técnico cliente y notas. -->
- `metadata`: serie, técnico, cliente y notas.
<!-- Comentario de lista: assembly BOM y pasos del armado físico. -->
- `assembly`: BOM y pasos del armado físico.
<!-- Comentario de lista: servos canales límites home dirección offsets y PWM. -->
- `servos`: canales, límites, home, dirección, offsets y PWM.
<!-- Comentario de lista: sensors buses MPU6050 canales AS5600 capturas de neutral/min/max. -->
- `sensors`: buses MPU6050, canales AS5600, capturas de neutral/min/max y raw0/raw90.
<!-- Comentario de lista: tuning asistencia zona muerta suavizado y velocidad máxima. -->
- `tuning`: asistencia, zona muerta, suavizado y velocidad máxima.
<!-- Comentario de lista: tests resultado de la suite con timestamps. -->
- `tests`: resultado de la suite con timestamps.
<!-- Comentario de lista: firmwareUpload FQBN puerto y estado del código en el editor. -->
- `firmwareUpload`: FQBN, puerto y estado del código en el editor.
<!-- Comentario de lista: safety consumerVisible = false marca de herramienta sólo para. -->
- `safety.consumerVisible = false`: marca de herramienta sólo para
<!-- Comentario de parrafo: instalador. -->
  instalador.

<!-- Comentario de parrafo: El botón Enviar perfil envía el JSON al ESP32-S3 vía. -->
El botón **Enviar perfil** envía el JSON al ESP32-S3 vía
<!-- Comentario de parrafo: cmd calibration profile Una vez aplicado y persistido en NVS la app. -->
`cmd_calibration_profile`. Una vez aplicado y persistido en NVS, la app
<!-- Comentario de parrafo: del usuario final puede conectarse y operar sin tocar nada de calibración. -->
del usuario final puede conectarse y operar sin tocar nada de calibración
<!-- Comentario de parrafo: ni de firmware. -->
ni de firmware.
