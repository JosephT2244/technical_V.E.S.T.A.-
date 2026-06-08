REM Comentarios de programador: identifican comandos del lanzador local.
REM Archivo      | start-server.bat: lanzador local del servidor Node en el puerto tecnico.
REM Configuracion de salida: evita imprimir comandos en consola.
@echo off
REM Cambio de directorio: ejecuta el servidor desde la carpeta del proyecto.
cd /d "%~dp0"
REM Arranque Node: inicia la API local en el puerto tecnico.
node server.js 5177
REM Pausa final: deja visible la consola despues de cerrar el servidor.
pause
