<!-- Comentarios de programador: identifican secciones, listas, tablas y ejemplos del documento. -->

<!-- Comentario de seccion: V E S T A Firmware. -->
# V.E.S.T.A Firmware

<!-- Comentario de parrafo: Dos sketches Arduino separados para las placas del sistema Todos los archivos. -->
Dos sketches Arduino separados para las placas del sistema. Todos los archivos
<!-- Comentario de parrafo: estan en la misma carpeta que la pagina tecnica. -->
estan en la misma carpeta que la pagina tecnica.

<!-- Comentario de seccion: 1 ESP32-S3 controller. -->
## 1. ESP32-S3 controller

<!-- Comentario de dato: Archivo principal. -->
Archivo principal:

<!-- Comentario de bloque de codigo: ejemplo literal para copiar o verificar. -->
```text
esp32_s3_controller.ino
esp32_s3_config.h
```

<!-- Comentario de dato: Responsabilidades. -->
Responsabilidades:

<!-- Comentario de lista: Lee 4 MPU6050 por TCA9548A. -->
- Lee 4 MPU6050 por TCA9548A.
<!-- Comentario de lista: Lee 4 botones normalmente abiertos de codo. -->
- Lee 4 botones normalmente abiertos de codo por GPIO con `INPUT_PULLUP`.
<!-- Comentario de lista: Controla 6 servos DS51150 por PCA9685. -->
- Controla 6 servos DS51150 por PCA9685.
<!-- Comentario de lista: Atiende paro y reset remotos. -->
- Atiende paro y reset remotos (`cmd_stop` / `cmd_reset`).
<!-- Comentario de lista: Publica WebSocket en ws //vesta-exo local 81. -->
- Publica WebSocket en `ws://vesta-exo.local:81`.
<!-- Comentario de lista: Acepta comandos JSON por USB serial a 115200 baudios para la pagina tecnica. -->
- Acepta comandos JSON por USB serial a `115200` baudios para la pagina tecnica.
<!-- Comentario de lista: Responde cmd status con ip wsPort wsUrl y mdnsUrl para que la. -->
- Responde `cmd_status` con `ip`, `wsPort`, `wsUrl` y `mdnsUrl` para que la
<!-- Comentario de parrafo: pagina tecnica detecte la URL y se conecte sin escribirla a mano. -->
  pagina tecnica detecte la URL y se conecte sin escribirla a mano.
<!-- Comentario de lista: Publica BLE GATT como VESTA-S3 para telefono sin cables El camino rapido. -->
- Publica BLE GATT como `VESTA-S3` para telefono sin cables. El camino rapido
<!-- Comentario de parrafo: usa paquetes binarios de 8 bytes en BLE COMMAND CHAR UUID y notificaciones. -->
  usa paquetes binarios de 8 bytes en `BLE_COMMAND_CHAR_UUID` y notificaciones
<!-- Comentario de parrafo: binarias en BLE TELEMETRY CHAR UUID cada BLE NOTIFY MS. -->
  binarias en `BLE_TELEMETRY_CHAR_UUID` cada `BLE_NOTIFY_MS`.
<!-- Comentario de lista: Recibe perfil de calibracion desde la pagina tecnica. -->
- Recibe perfil de calibracion desde la pagina tecnica.
<!-- Comentario de lista: Recibe estado de la ESP32-CAM y lo reenvia a app/tecnico. -->
- Recibe estado de la ESP32-CAM y lo reenvia a app/tecnico.

<!-- Comentario de dato: Librerias. -->
Librerias:

<!-- Comentario de lista: ArduinoJson. -->
- ArduinoJson
<!-- Comentario de lista: WebSockets. -->
- WebSockets
<!-- Comentario de lista: Adafruit PWM Servo Driver Library. -->
- Adafruit PWM Servo Driver Library
<!-- Comentario de lista: MPU6050 by Electronic Cats. -->
- MPU6050 by Electronic Cats

<!-- Comentario de dato: FQBN inicial. -->
FQBN inicial:

<!-- Comentario de bloque de codigo: ejemplo literal para copiar o verificar. -->
```text
esp32:esp32:esp32s3:USBMode=hwcdc,CDCOnBoot=default,FlashSize=16M,PSRAM=opi,PartitionScheme=app3M_fat9M_16MB
```

<!-- Comentario de parrafo: CDCOnBoot=default deja Serial en el UART del CH343 que usa la pagina tecnica. -->
`CDCOnBoot=default` deja `Serial` en el UART del CH343 que usa la pagina tecnica.

<!-- Comentario de seccion: Arranque autonomo con bateria. -->
### Arranque autonomo con bateria

<!-- Comentario de parrafo: Despues de subir esp32 s3 controller ino el programa queda guardado en la. -->
Despues de subir `esp32_s3_controller.ino`, el programa queda guardado en la
<!-- Comentario de dato: flash del ESP32-S3 No necesita la computadora para arrancar al recibir energia. -->
flash del ESP32-S3. No necesita la computadora para arrancar: al recibir energia
<!-- Comentario de dato: por bateria ejecuta setup y queda en modo manual con servos desarmados. -->
por bateria ejecuta `setup()` y queda en modo `manual`, con PWM de servos desarmado, usando:

<!-- Comentario de bloque de codigo: ejemplo literal para copiar o verificar. -->
```cpp
#define BOOT_MODE      "manual"
#define BOOT_ASSIST_LEVEL 0.5f
#define SENSORLESS_SERVO_TEST 1
```

<!-- Comentario de parrafo: El USB queda solo para cargar firmware diagnostico o comandos seriales En uso. -->
El USB queda solo para cargar firmware, diagnostico o comandos seriales. En uso
<!-- Comentario de parrafo: de prueba con bateria el S3 no mueve servos al iniciar y publica BLE. -->
de prueba con bateria, el S3 no mueve servos al iniciar; publica BLE
<!-- Comentario de parrafo: como VESTA-S3 y el WiFi intenta conectarse en segundo plano si la red esta. -->
como `VESTA-S3`, y el WiFi intenta conectarse en segundo plano si la red esta
<!-- Comentario de parrafo: configurada Si la red no esta disponible el modo manual sigue aceptando comandos por AP BLE o serial. -->
configurada. Si la red no esta disponible, el modo manual sigue disponible
<!-- Comentario de parrafo: por AP BLE o serial sin esperar a sensores. -->
por AP, BLE o serial sin esperar a sensores. Para habilitar PWM despues de
<!-- Comentario de parrafo: montar y verificar al usuario envia cmd arm o un comando de movimiento explicito. -->
montar y verificar al usuario, envia `cmd_arm` o un comando de movimiento explicito
como `cmd_angle`, `cmd_home` o `cmd_mode assisted`.

<!-- Comentario de seccion: 2 ESP32-CAM assistant. -->
## 2. ESP32-CAM assistant

<!-- Comentario de dato: Archivo principal. -->
Archivo principal:

<!-- Comentario de bloque de codigo: ejemplo literal para copiar o verificar. -->
```text
esp32_cam_assistant.ino
esp32_cam_config.h
```

<!-- Comentario de dato: Responsabilidades. -->
Responsabilidades:

<!-- Comentario de lista: Sirve video MJPEG en http //vesta-cam local/stream. -->
- Sirve video MJPEG en `http://vesta-cam.local/stream`.
<!-- Comentario de lista: Sirve captura JPEG en http //vesta-cam local/capture. -->
- Sirve captura JPEG en `http://vesta-cam.local/capture`.
<!-- Comentario de lista: Publica WebSocket de app en ws //vesta-cam local 82. -->
- Publica WebSocket de app en `ws://vesta-cam.local:82`.
<!-- Comentario de lista: Lee microfono I2S pensado para INMP441 o equivalente. -->
- Lee microfono I2S, pensado para INMP441 o equivalente.
<!-- Comentario de lista: Envia audio PCM16 mono a la app por WebSocket. -->
- Envia audio PCM16 mono a la app por WebSocket.
<!-- Comentario de lista: Se conecta al S3 en ws //vesta-exo local 81 y reporta estado. -->
- Se conecta al S3 en `ws://vesta-exo.local:81` y reporta estado.
<!-- Comentario de lista: Acepta cmd status por USB serial a 115200 baudios y responde con ip. -->
- Acepta `cmd_status` por USB serial a `115200` baudios y responde con `ip`,
<!-- Comentario de parrafo: stream capture statusUrl appWs y mdnsStream para que la pagina. -->
  `stream`, `capture`, `statusUrl`, `appWs` y `mdnsStream` para que la pagina
<!-- Comentario de parrafo: tecnica detecte la URL de la camara sin escribirla a mano. -->
  tecnica detecte la URL de la camara sin escribirla a mano.
<!-- Comentario de lista: Acepta usb stream start por USB serial La pagina tecnica abre. -->
- Acepta `usb_stream_start` por USB serial. La pagina tecnica abre
<!-- Comentario de parrafo: /api/cam/usb-stream cambia el enlace serial a USB CAMERA STREAM BAUD y. -->
  `/api/cam/usb-stream`, cambia el enlace serial a `USB_CAMERA_STREAM_BAUD` y
<!-- Comentario de parrafo: convierte los frames JPEG seriales en MJPEG local sin tocar el WiFi de la PC. -->
  convierte los frames JPEG seriales en MJPEG local sin tocar el WiFi de la PC.

<!-- Comentario de dato: FQBN inicial. -->
FQBN inicial:

<!-- Comentario de bloque de codigo: ejemplo literal para copiar o verificar. -->
```text
esp32:esp32:esp32cam
```

<!-- Comentario de seccion: Interconexion. -->
## Interconexion

<!-- Comentario de parrafo: La interconexion normal entre placas es por WiFi y la pagina tecnica tambien. -->
La interconexion normal entre placas es por WiFi, y la pagina tecnica tambien
<!-- Comentario de parrafo: puede usar USB serial directo al S3 o a la CAM cuando el equipo aparece como. -->
puede usar USB serial directo al S3 o a la CAM cuando el equipo aparece como
<!-- Comentario de dato: puerto COM. -->
puerto COM:

<!-- Comentario de bloque de codigo: ejemplo literal para copiar o verificar. -->
```text
App/tecnico <---- WebSocket ----> ESP32-S3
App/tecnico <---- USB serial ---> ESP32-S3
Telefono   <---- BLE GATT -----> ESP32-S3
App/tecnico <---- USB MJPEG ----> ESP32-CAM
App/tecnico <---- HTTP/WS ------> ESP32-CAM
ESP32-CAM  <---- WebSocket ----> ESP32-S3
```

<!-- Comentario de parrafo: Para pruebas de banco usa primero USB MJPEG La ruta WiFi/AP queda disponible. -->
Para pruebas de banco, usa primero USB MJPEG. La ruta WiFi/AP queda disponible
<!-- Comentario de parrafo: como respaldo pero la herramienta ya no intenta conectar Windows. -->
como respaldo, pero la herramienta ya no intenta conectar Windows
<!-- Comentario de parrafo: automaticamente a VESTA-CAM-SETUP. -->
automaticamente a `VESTA-CAM-SETUP`.

<!-- Comentario de seccion: ESP32-CAM video congelado o modulo caliente. -->
### ESP32-CAM: video congelado o modulo caliente

<!-- Comentario de parrafo: El firmware CAM queda configurado para banco con resolucion QQVGA JPEG mas. -->
El firmware CAM queda configurado para banco con resolucion `QQVGA`, JPEG mas
<!-- Comentario de parrafo: ligero CPU a 160 MHz WiFi con menor potencia TX video USB a 230400. -->
ligero, CPU a `160 MHz`, WiFi con menor potencia TX, video USB a `230400`
<!-- Comentario de parrafo: baudios y microfono I2S desactivado por defecto Esto mantiene el consumo bajo. -->
baudios y microfono I2S desactivado por defecto. Esto mantiene el consumo bajo
<!-- Comentario de parrafo: sin dejar el stream clavado en el primer frame cuando el enlace serial/WiFi va. -->
sin dejar el stream clavado en el primer frame cuando el enlace serial/WiFi va
<!-- Comentario de parrafo: justo. -->
justo.

<!-- Comentario de parrafo: Si aun muestra un solo fotograma vuelve a subir el firmware CAM incluido desde. -->
Si aun muestra un solo fotograma, vuelve a subir el firmware CAM incluido desde
<!-- Comentario de parrafo: la pestaña Firmware el servidor descarta copias viejas del editor y compila el. -->
la pestaña Firmware; el servidor descarta copias viejas del editor y compila el
<!-- Comentario de parrafo: sketch local actualizado Para calor excesivo alimenta la ESP32-CAM con 5 V. -->
sketch local actualizado. Para calor excesivo, alimenta la ESP32-CAM con 5 V
<!-- Comentario de parrafo: estable de al menos 1 A evita tomar corriente del pin 3V3 del adaptador USB y. -->
estable de al menos 1 A, evita tomar corriente del pin 3V3 del adaptador USB y
<!-- Comentario de parrafo: revisa que el LED flash no quede encendido. -->
revisa que el LED flash no quede encendido.

<!-- Comentario de parrafo: BLE queda reservado para control y telemetria de baja latencia No se manda. -->
BLE queda reservado para control y telemetria de baja latencia. No se manda
<!-- Comentario de dato: video por BLE la camara debe ir por USB en banco o por un enlace de mayor. -->
video por BLE: la camara debe ir por USB en banco, o por un enlace de mayor
<!-- Comentario de parrafo: ancho de banda cuando el sistema final lo necesite. -->
ancho de banda cuando el sistema final lo necesite.

<!-- Comentario de seccion: Protocolo BLE rapido. -->
### Protocolo BLE rapido

<!-- Comentario de dato: Servicio BLE SERVICE UUID. -->
Servicio: `BLE_SERVICE_UUID`.

<!-- Comentario de dato: Comando BLE COMMAND CHAR UUID write without response 8 bytes. -->
Comando (`BLE_COMMAND_CHAR_UUID`, write without response), 8 bytes:

<!-- Comentario de bloque de codigo: ejemplo literal para copiar o verificar. -->
```text
0    'V'
1    'C'
2    version = 1
3    tipo: 1 angle, 2 mode, 3 stop, 4 reset, 5 home, 6 status, 7 assist
4    id de servo para angle
5    flags = 0
6-7  int16 little-endian
```

<!-- Comentario de dato: Valores angle usa grados x10 mode usa 0 manual 1 assisted 2 automatic. -->
Valores: `angle` usa grados x10, `mode` usa 0 manual, 1 assisted, 2 automatic,
<!-- Comentario de parrafo: y assist usa 0 1000. -->
y `assist` usa 0..1000.

<!-- Comentario de dato: Telemetria BLE TELEMETRY CHAR UUID notify 44 bytes. -->
Telemetria (`BLE_TELEMETRY_CHAR_UUID`, notify), 44 bytes:

<!-- Comentario de bloque de codigo: ejemplo literal para copiar o verificar. -->
```text
0-1  'V' 'T'
2    version = 1
3    flags
4    mode
5    emergency
6    camOnline
7    sequence
8-19   currentDeg[6] x10
20-31  targetDeg[6] x10
32-43  sensorDeg[6] x10
```

<!-- Comentario de parrafo: El S3 es la autoridad de seguridad y movimiento La CAM no mueve servos solo. -->
El S3 es la autoridad de seguridad y movimiento. La CAM no mueve servos; solo
<!-- Comentario de parrafo: entrega vision/audio y reporta su estado al S3. -->
entrega vision/audio y reporta su estado al S3.

<!-- Comentario de seccion: Botones normalmente abiertos. -->
## Botones normalmente abiertos

<!-- Comentario de dato: Los cuatro botones N A de codo se leen por GPIO directo. -->
Los cuatro botones N.A. de codo se leen por GPIO directo con pull-up interno:

<!-- Comentario de bloque de codigo: ejemplo literal para copiar o verificar. -->
```text
Codo izquierdo + -> GPIO4
Codo izquierdo - -> GPIO5
Codo derecho +   -> GPIO6
Codo derecho -   -> GPIO7
```

<!-- Comentario de parrafo: Cada boton N A va entre GPIO y GND. -->
Cada botón normalmente abierto va entre su `GPIO` y `GND`. El firmware usa
<!-- Comentario de parrafo: INPUT PULLUP abierto HIGH presionado LOW. -->
`INPUT_PULLUP`, así que abierto lee `HIGH` y presionado lee `LOW`.

<!-- Comentario de parrafo: Al presionar el boton el codo avanza de grado en grado. -->
Al presionar un botón `+`, el codo avanza 1° inmediato y luego 1° cada
<!-- Comentario de parrafo: BUTTON STEP INTERVAL MS mientras se mantiene presionado. -->
`BUTTON_STEP_INTERVAL_MS` mientras se mantiene presionado, hasta 90°. Al
<!-- Comentario de parrafo: presionar un boton menos baja el mismo angulo acumulado. -->
presionar un botón `-`, baja con la misma cadencia hasta 0°. Al soltar cualquier
<!-- Comentario de parrafo: boton se mantiene el angulo alcanzado. -->
botón se mantiene el ángulo alcanzado.

<!-- Comentario de parrafo: Para que el boton N A mueva servo el S3 debe estar armado y en modo assisted o automatic. -->
Para que el botón mueva el servo, el S3 debe estar armado y en modo `assisted`
<!-- Comentario de parrafo: o automatic. -->
o `automatic`; en modo `manual` la lectura solo se reporta por telemetría. Si el
<!-- Comentario de parrafo: estado cambia pero el codo no se mueve revisa angulos y paro. -->
estado cambia pero el codo no se mueve, confirma que los servos estén armados,
<!-- Comentario de parrafo: que el boton cierre entre GPIO y GND y que el paro de emergencia este limpio. -->
que el botón cierre entre `GPIO` y `GND`, y que el paro de emergencia esté limpio.

<!-- Comentario de seccion: MPU6050 + servos. -->
## MPU6050 + servos

<!-- Comentario de dato: Los 4 MPU6050 controlan solo los servos de hombro lateral y frontal de cada. -->
Los 4 MPU6050 controlan solo los servos de hombro: lateral y frontal de cada
<!-- Comentario de parrafo: lado Los codos no usan MPU los servos de codo izquierdo y derecho siguen los. -->
lado. Los codos no usan MPU; los servos de codo izquierdo y derecho siguen los
<!-- Comentario de parrafo: 4 botones N A. -->
4 botones N.A.

<!-- Comentario de parrafo: El firmware S3 mantiene la ultima lectura MPU valida cuando hay un paquete I2C. -->
El firmware S3 mantiene la ultima lectura MPU valida cuando hay un paquete I2C
<!-- Comentario de parrafo: malo y filtra saltos imposibles del acelerometro antes de actualizar esos 4. -->
malo y filtra saltos imposibles del acelerometro antes de actualizar esos 4
<!-- Comentario de parrafo: servos de hombro La rampa de velocidad se aplica a los 6 servos en modo. -->
servos de hombro. La rampa de velocidad se aplica a los 6 servos en modo
<!-- Comentario de parrafo: manual assisted y automatic asi los codos tambien se mueven suave desde. -->
`manual`, `assisted` y `automatic`, asi los codos tambien se mueven suave desde
<!-- Comentario de parrafo: sus botones N A. -->
sus botones N.A.

<!-- Comentario de parrafo: La consola puede ajustar esa respuesta en vivo con cmd tuning. -->
La consola puede ajustar esa respuesta en vivo con `cmd_tuning`, pero por
<!-- Comentario de parrafo: defecto el PWM sigue directamente al target calculado desde sensor/manual. -->
defecto el PWM sigue directamente al `target` calculado desde sensor/manual.
<!-- Comentario de parrafo: maxSpeedDegSec queda como respaldo alto si se desactiva el seguimiento directo. -->
`maxSpeedDegSec=2400` queda como respaldo alto si se desactiva
<!-- Comentario de parrafo: CONTROL DIRECT SERVO FOLLOW para pruebas con rampa. -->
`CONTROL_DIRECT_SERVO_FOLLOW` para pruebas con rampa.

<!-- Comentario de parrafo: Por defecto el movimiento MPU se interpreta como magnitud desde neutral. -->
Por defecto, el movimiento MPU se interpreta como magnitud desde neutral
<!-- Comentario de parrafo: IMU USE ABSOLUTE DELTA 1 para que el servo responda en banco aunque el MPU. -->
(`IMU_USE_ABSOLUTE_DELTA 1`), para que el servo responda en banco aunque el MPU
<!-- Comentario de parrafo: este montado con la orientacion invertida Si necesitas direccion estricta. -->
este montado con la orientacion invertida. Si necesitas direccion estricta,
<!-- Comentario de parrafo: cambia ese valor a 0 y usa el campo Invert del panel Sensores. -->
cambia ese valor a `0` y usa el campo `Invert` del panel Sensores.

<!-- Comentario de parrafo: El comando cmd calibrate ahora debe ejecutarse con los brazos quietos en la. -->
El comando `cmd_calibrate` ahora debe ejecutarse con los brazos quietos en la
<!-- Comentario de dato: posicion neutral promedia la deriva del giroscopio y guarda el angulo neutral. -->
posicion neutral: promedia la deriva del giroscopio y guarda el angulo neutral
<!-- Comentario de parrafo: de cada MPU en NVS Despues de calibrar el panel debe mostrar los MPU cerca de. -->
de cada MPU en NVS. Despues de calibrar, el panel debe mostrar los MPU cerca de
<!-- Comentario de parrafo: 0 deg cuando el brazo esta en neutral. -->
`0 deg` cuando el brazo esta en neutral.

<!-- Comentario de parrafo: Si ningun MPU da lectura abre el Monitor Serial a 115200 baudios despues de. -->
Si ningun MPU da lectura, abre el Monitor Serial a `115200` baudios despues de
<!-- Comentario de dato: reiniciar el S3 El arranque imprime un diagnostico I2C sin mover servos. -->
reiniciar el S3. El arranque imprime un diagnostico I2C sin mover servos:

<!-- Comentario de lista: scan root debe mostrar 0x70 para el TCA9548A si no aparece revisa. -->
- `scan root` debe mostrar `0x70` para el TCA9548A; si no aparece, revisa
<!-- Comentario de parrafo: SDA GPIO8 SCL GPIO9 alimentacion del TCA y tierra comun. -->
  `SDA GPIO8`, `SCL GPIO9`, alimentacion del TCA y tierra comun.
<!-- Comentario de lista: Cada canal usado TCA ch 0 3 debe mostrar el MPU en 0x68 Si aparece. -->
- Cada canal usado `TCA ch 0..3` debe mostrar el MPU en `0x68`. Si aparece
<!-- Comentario de parrafo: 0x69 el pin AD0 del MPU esta alto o debes cambiar MPU ADDR. -->
  `0x69`, el pin `AD0` del MPU esta alto o debes cambiar `MPU_ADDR`.
<!-- Comentario de lista: Si 0x70 aparece pero todos los canales salen sin 0x68 el problema suele. -->
- Si `0x70` aparece pero todos los canales salen sin `0x68`, el problema suele
<!-- Comentario de parrafo: estar en el cableado/alimentacion entre el TCA y los MPU o en que SDA/SCL de. -->
  estar en el cableado/alimentacion entre el TCA y los MPU, o en que SDA/SCL de
<!-- Comentario de parrafo: los canales estan invertidos. -->
  los canales estan invertidos.

<!-- Comentario de dato: La pagina tecnica tambien puede pedir este diagnostico sin abrir Arduino IDE. -->
La pagina tecnica tambien puede pedir este diagnostico sin abrir Arduino IDE:
<!-- Comentario de parrafo: conecta el ESP32-S3 por Conectar COM o Conectar URL y pulsa. -->
conecta el ESP32-S3 por `Conectar COM` o `Conectar URL` y pulsa
<!-- Comentario de parrafo: Diagnosticar I2C El bloque I2C / MPU muestra el bus raiz los canales. -->
`Diagnosticar I2C`. El bloque `I2C / MPU` muestra el bus raiz, los canales
<!-- Comentario de parrafo: TCA ch 0 3 y las lineas I2C / IMU que lleguen por el monitor serial de. -->
`TCA ch 0..3` y las lineas `[I2C]`/`[IMU]` que lleguen por el monitor serial de
<!-- Comentario de parrafo: la pagina. -->
la pagina.

<!-- Comentario de seccion: Paro fisico. -->
## Paro fisico

<!-- Comentario de parrafo: El boton de paro va entre PIN ESTOP y GND el firmware usa INPUT PULLUP. -->
El boton de paro va entre `PIN_ESTOP` y `GND`; el firmware usa `INPUT_PULLUP`.
<!-- Comentario de parrafo: Cuando se presiona el S3 entra en modo emergencia ignora movimiento y congela. -->
Cuando se presiona, el S3 entra en modo emergencia, ignora movimiento y congela
<!-- Comentario de dato: los servos en su ultima posicion Si quieres que suelte la senal PWM cambia. -->
los servos en su ultima posicion. Si quieres que suelte la senal PWM, cambia:

<!-- Comentario de bloque de codigo: ejemplo literal para copiar o verificar. -->
```cpp
#define ESTOP_RELEASES_SERVOS 1
```

<!-- Comentario de parrafo: en esp32 s3 config h. -->
en `esp32_s3_config.h`.

<!-- Comentario de seccion: Microfono. -->
## Microfono

<!-- Comentario de dato: El sketch de CAM asume microfono I2S. -->
El sketch de CAM asume microfono I2S:

<!-- Comentario de bloque de codigo: ejemplo literal para copiar o verificar. -->
```text
BCLK -> GPIO14
WS   -> GPIO15
DOUT -> GPIO13
3V3  -> 3.3V
GND  -> GND
```

<!-- Comentario de parrafo: Esos pines comparten lineas con la SD en muchos modulos ESP32-CAM No uses SD al. -->
Esos pines comparten lineas con la SD en muchos modulos ESP32-CAM. No uses SD al
<!-- Comentario de parrafo: mismo tiempo o cambia los pines en esp32 cam config h. -->
mismo tiempo, o cambia los pines en `esp32_cam_config.h`.
