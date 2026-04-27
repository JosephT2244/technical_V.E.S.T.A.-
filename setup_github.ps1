# =============================================================
# setup_github.ps1
# Renombra la carpeta y sube todo a GitHub
# Repo: https://github.com/JosephT2244/technical_V.E.S.T.A.-.git
# =============================================================

$ErrorActionPreference = "Stop"

$parent       = "C:\VSC\V.E.S.T.A"
$oldName      = "tecnico_calibracion"
# OJO: Windows no permite carpetas que terminan en ".".
# Se usa "technical_V.E.S.T.A" (sin punto final). Si quieres forzar el punto,
# puedes editar la variable y usar el prefijo \\?\ (no recomendado).
$newName      = "technical_V.E.S.T.A"
$repoUrl      = "https://github.com/JosephT2244/technical_V.E.S.T.A.-.git"
$branch       = "main"
$commitMsg    = "Initial commit: technical_V.E.S.T.A."

$oldPath = Join-Path $parent $oldName
$newPath = Join-Path $parent $newName

Write-Host "==> Carpeta origen: $oldPath" -ForegroundColor Cyan
Write-Host "==> Carpeta destino: $newPath" -ForegroundColor Cyan

# 1) Limpieza del posible .git roto creado en sesion previa
$brokenGit = Join-Path $oldPath ".git"
if (Test-Path $brokenGit) {
    Write-Host "==> Eliminando .git previo (si existe)" -ForegroundColor Yellow
    cmd /c "rmdir /S /Q `"$brokenGit`""
}

# 2) Renombrar carpeta
if (-not (Test-Path $newPath)) {
    if (Test-Path $oldPath) {
        Write-Host "==> Renombrando carpeta..." -ForegroundColor Cyan
        Rename-Item -Path $oldPath -NewName $newName
    } else {
        throw "No existe la carpeta origen: $oldPath"
    }
} else {
    Write-Host "==> La carpeta destino ya existe, se usara tal cual." -ForegroundColor Yellow
}

Set-Location $newPath

# 3) Verificar que el HTML quedo renombrado
$oldHtml = Join-Path $newPath "V.E.S.T.A. Tecnico.html"
$newHtml = Join-Path $newPath "technical_V.E.S.T.A..html"
if (Test-Path $oldHtml) {
    Write-Host "==> Renombrando HTML..." -ForegroundColor Cyan
    Rename-Item -Path $oldHtml -NewName "technical_V.E.S.T.A..html"
}
if (Test-Path $newHtml) {
    Write-Host "    HTML ok: technical_V.E.S.T.A..html" -ForegroundColor Green
}

# 4) Asegurar .gitignore
$gitignorePath = Join-Path $newPath ".gitignore"
if (-not (Test-Path $gitignorePath)) {
    @"
node_modules/
*.log
.DS_Store
Thumbs.db
arduino-cli.exe
"@ | Set-Content -Path $gitignorePath -Encoding UTF8
}

# 5) Inicializar git
if (-not (Test-Path (Join-Path $newPath ".git"))) {
    Write-Host "==> git init" -ForegroundColor Cyan
    git init -b $branch | Out-Null
}

# 6) Configurar usuario (solo local al repo)
git config user.email "josephtrejohernandez@gmail.com"
git config user.name  "Joseph Ubaldo Trejo"

# 7) Remoto
$existing = git remote 2>$null
if ($existing -match "origin") {
    git remote set-url origin $repoUrl
} else {
    git remote add origin $repoUrl
}

# 8) Add + commit
git add -A
$status = git status --porcelain
if ($status) {
    Write-Host "==> Haciendo commit..." -ForegroundColor Cyan
    git commit -m $commitMsg
} else {
    Write-Host "==> Nada nuevo que commitear." -ForegroundColor Yellow
}

# 9) Push via HTTPS
Write-Host "==> Subiendo a GitHub via HTTPS..." -ForegroundColor Cyan
Write-Host "    Si pide credenciales: usuario = JosephT2244, password = tu Personal Access Token (PAT)" -ForegroundColor Yellow
Write-Host "    Generar PAT en: https://github.com/settings/tokens (scope: repo)" -ForegroundColor Yellow
git push -u origin $branch

Write-Host ""
Write-Host "Listo. Repo: $repoUrl" -ForegroundColor Green
Write-Host "Carpeta local: $newPath" -ForegroundColor Green
