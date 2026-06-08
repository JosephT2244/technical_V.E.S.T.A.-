# Comentarios de programador: identifican variables, pasos y comandos del script.
# Archivo        | setup_github.ps1: automatiza preparacion local, git, remoto y push inicial.

# =============================================================
# setup_github.ps1
# Renombra la carpeta y sube todo a GitHub
# Repo: https://github.com/JosephT2244/technical_V.E.S.T.A.-.git
# =============================================================

$ErrorActionPreference = "Stop"                                                       # Variable de script: parametro o ruta usada por la automatizacion.

$parent       = "C:\VSC\V.E.S.T.A"                                                    # Variable de script: parametro o ruta usada por la automatizacion.
$oldName      = "tecnico_calibracion"                                                 # Variable de script: parametro o ruta usada por la automatizacion.
# OJO: Windows no permite carpetas que terminan en ".".
# Se usa "technical_V.E.S.T.A" (sin punto final). Si quieres forzar el punto,
# puedes editar la variable y usar el prefijo \\?\ (no recomendado).
$newName      = "technical_V.E.S.T.A"                                                 # Variable de script: parametro o ruta usada por la automatizacion.
$repoUrl      = "https://github.com/JosephT2244/technical_V.E.S.T.A.-.git"            # Variable de script: parametro o ruta usada por la automatizacion.
$branch       = "main"                                                                # Variable de script: parametro o ruta usada por la automatizacion.
$commitMsg    = "Initial commit: technical_V.E.S.T.A."                                # Variable de script: parametro o ruta usada por la automatizacion.

$oldPath = Join-Path $parent $oldName                                                 # Variable de script: parametro o ruta usada por la automatizacion.
$newPath = Join-Path $parent $newName                                                 # Variable de script: parametro o ruta usada por la automatizacion.

Write-Host "==> Carpeta origen: $oldPath" -ForegroundColor Cyan                       # Comando PowerShell: ejecuta una accion de setup o git.
Write-Host "==> Carpeta destino: $newPath" -ForegroundColor Cyan                      # Comando PowerShell: ejecuta una accion de setup o git.

# 1) Limpieza del posible .git roto creado en sesion previa
$brokenGit = Join-Path $oldPath ".git"                                                # Variable de script: parametro o ruta usada por la automatizacion.
if (Test-Path $brokenGit) {                                                           # Flujo de control: valida estado antes de continuar.
    Write-Host "==> Eliminando .git previo (si existe)" -ForegroundColor Yellow       # Comando PowerShell: ejecuta una accion de setup o git.
    cmd /c "rmdir /S /Q `"$brokenGit`""                                               # Comando PowerShell: ejecuta una accion de setup o git.
}

# 2) Renombrar carpeta
if (-not (Test-Path $newPath)) {                                                      # Flujo de control: valida estado antes de continuar.
    if (Test-Path $oldPath) {                                                         # Flujo de control: valida estado antes de continuar.
        Write-Host "==> Renombrando carpeta..." -ForegroundColor Cyan                 # Comando PowerShell: ejecuta una accion de setup o git.
        Rename-Item -Path $oldPath -NewName $newName                                  # Comando PowerShell: ejecuta una accion de setup o git.
    } else {
        throw "No existe la carpeta origen: $oldPath"                                 # Flujo de control: valida estado antes de continuar.
    }
} else {
    Write-Host "==> La carpeta destino ya existe, se usara tal cual." -ForegroundColor Yellow # Comando PowerShell: ejecuta una accion de setup o git.
}

Set-Location $newPath                                                                 # Comando PowerShell: ejecuta una accion de setup o git.

# 3) Verificar que el HTML quedo renombrado
$oldHtml = Join-Path $newPath "V.E.S.T.A. Tecnico.html"                               # Variable de script: parametro o ruta usada por la automatizacion.
$newHtml = Join-Path $newPath "technical_V.E.S.T.A..html"                             # Variable de script: parametro o ruta usada por la automatizacion.
if (Test-Path $oldHtml) {                                                             # Flujo de control: valida estado antes de continuar.
    Write-Host "==> Renombrando HTML..." -ForegroundColor Cyan                        # Comando PowerShell: ejecuta una accion de setup o git.
    Rename-Item -Path $oldHtml -NewName "technical_V.E.S.T.A..html"                   # Comando PowerShell: ejecuta una accion de setup o git.
}
if (Test-Path $newHtml) {                                                             # Flujo de control: valida estado antes de continuar.
    Write-Host "    HTML ok: technical_V.E.S.T.A..html" -ForegroundColor Green        # Comando PowerShell: ejecuta una accion de setup o git.
}

# 4) Asegurar .gitignore
$gitignorePath = Join-Path $newPath ".gitignore"                                      # Variable de script: parametro o ruta usada por la automatizacion.
if (-not (Test-Path $gitignorePath)) {                                                # Flujo de control: valida estado antes de continuar.
    @"
node_modules/
*.log
.DS_Store
Thumbs.db
arduino-cli.exe
"@ | Set-Content -Path $gitignorePath -Encoding UTF8
}

# 5) Inicializar git
# Paso          | git init: crea el repositorio local si todavia no existe.
if (-not (Test-Path (Join-Path $newPath ".git"))) {
    Write-Host "==> git init" -ForegroundColor Cyan
    git init -b $branch | Out-Null
}

# 6) Configurar usuario (solo local al repo)
# Paso          | identidad git: configura autor local del repositorio.
git config user.email "josephtrejohernandez@gmail.com"
git config user.name  "Joseph Ubaldo Trejo"

# 7) Remoto
# Paso          | remoto: revisa si origin ya esta configurado.
$existing = git remote 2>$null
# Paso          | origin: actualiza o crea el remoto de GitHub.
if ($existing -match "origin") {
    git remote set-url origin $repoUrl
} else {
    git remote add origin $repoUrl
}

# 8) Add + commit
# Paso          | commit: prepara todos los cambios del proyecto.
git add -A
$status = git status --porcelain
if ($status) {
    Write-Host "==> Haciendo commit..." -ForegroundColor Cyan
    git commit -m $commitMsg
} else {
    Write-Host "==> Nada nuevo que commitear." -ForegroundColor Yellow
}

# 9) Push via HTTPS
# Paso          | push: publica la rama principal por HTTPS.
Write-Host "==> Subiendo a GitHub via HTTPS..." -ForegroundColor Cyan
Write-Host "    Si pide credenciales: usuario = JosephT2244, password = tu Personal Access Token (PAT)" -ForegroundColor Yellow
Write-Host "    Generar PAT en: https://github.com/settings/tokens (scope: repo)" -ForegroundColor Yellow
git push -u origin $branch

Write-Host ""
Write-Host "Listo. Repo: $repoUrl" -ForegroundColor Green
Write-Host "Carpeta local: $newPath" -ForegroundColor Green
