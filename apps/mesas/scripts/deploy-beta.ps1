#!/usr/bin/env pwsh
# Deploy automatizado para ambiente beta
# Uso: .\scripts\deploy-beta.ps1

param(
    [switch]$SkipBuild,
    [switch]$SkipTests
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Iniciando deploy para beta..." -ForegroundColor Cyan

# 1. Validar que estamos na branch dev
Write-Host "`n📋 Validando branch..." -ForegroundColor Yellow
$currentBranch = git branch --show-current
if ($currentBranch -ne "dev") {
    Write-Host "❌ Erro: Deploy para beta deve ser feito a partir da branch 'dev'" -ForegroundColor Red
    Write-Host "   Branch atual: $currentBranch" -ForegroundColor Red
    exit 1
}

# 2. Verificar se há mudanças não commitadas
Write-Host "`n📋 Verificando mudanças locais..." -ForegroundColor Yellow
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "❌ Erro: Há mudanças não commitadas" -ForegroundColor Red
    Write-Host $gitStatus -ForegroundColor Red
    exit 1
}

# 3. Push para origin/dev
Write-Host "`n📤 Fazendo push para origin/dev..." -ForegroundColor Yellow
git push origin dev
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro no git push" -ForegroundColor Red
    exit 1
}

# 4. Copiar arquivos alterados para o servidor
Write-Host "`n📦 Copiando código para servidor..." -ForegroundColor Yellow
ssh -F C:\projetos\config faren "cd /opt/mesas-beta && git fetch origin && git reset --hard origin/dev"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao atualizar código no servidor" -ForegroundColor Red
    exit 1
}

# 5. Build do frontend no servidor
if (-not $SkipBuild) {
    Write-Host "`n🔨 Fazendo build do frontend..." -ForegroundColor Yellow
    ssh -F C:\projetos\config faren "cd /opt/mesas-beta/frontend && npm run build"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erro no build do frontend" -ForegroundColor Red
        exit 1
    }
}

# 6. Copiar build para container
Write-Host "`n📋 Copiando build para container..." -ForegroundColor Yellow
ssh -F C:\projetos\config faren "docker cp /opt/mesas-beta/frontend/dist/. mesas-beta-frontend:/usr/share/nginx/html/"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao copiar build para container" -ForegroundColor Red
    exit 1
}

# 7. Reload do nginx
Write-Host "`n🔄 Recarregando nginx..." -ForegroundColor Yellow
ssh -F C:\projetos\config faren "docker exec mesas-beta-frontend nginx -s reload"
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Aviso: Erro ao recarregar nginx (pode não ser crítico)" -ForegroundColor Yellow
}

# 8. Validar deploy
Write-Host "`n✅ Validando deploy..." -ForegroundColor Yellow
$indexHtml = ssh -F C:\projetos\config faren "docker exec mesas-beta-frontend cat /usr/share/nginx/html/index.html"
if ($indexHtml -match 'index-([A-Za-z0-9]+)\.js') {
    $deployedVersion = $matches[1]
    Write-Host "   Versão deployada: index-$deployedVersion.js" -ForegroundColor Green
} else {
    Write-Host "⚠️  Aviso: Não foi possível validar versão deployada" -ForegroundColor Yellow
}

Write-Host "`n✅ Deploy concluído com sucesso!" -ForegroundColor Green
Write-Host "   URL: https://mesasbeta.artificiorpg.com" -ForegroundColor Cyan
Write-Host "   Nota: Pode levar alguns minutos para o cache do Cloudflare atualizar" -ForegroundColor Yellow
