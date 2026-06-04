#!/bin/bash
set -e

# Script de deploy para produção
# Garante que o código sempre seja reconstruído sem cache

echo "🚀 Iniciando deploy para produção..."

# Navegar para o diretório do projeto
cd /opt/mesas

# Fazer pull das mudanças
echo "📥 Fazendo pull das mudanças..."
git fetch origin
git pull origin main

# Parar containers
echo "⏸️  Parando containers..."
docker compose -f docker-compose.prod.yml down

# Remover imagens antigas para forçar rebuild
echo "🗑️  Removendo imagens antigas..."
docker rmi mesas-mesas-api mesas-mesas-app mesas-mesas-cron 2>/dev/null || true

# Rebuild sem cache
echo "🔨 Reconstruindo imagens sem cache..."
docker compose -f docker-compose.prod.yml build --no-cache --pull

# Subir containers
echo "▶️  Iniciando containers..."
docker compose -f docker-compose.prod.yml up -d

# Aguardar healthcheck
echo "⏳ Aguardando containers ficarem saudáveis..."
sleep 10

# Verificar status
echo "✅ Status dos containers:"
docker compose -f docker-compose.prod.yml ps

echo "🎉 Deploy concluído com sucesso!"
