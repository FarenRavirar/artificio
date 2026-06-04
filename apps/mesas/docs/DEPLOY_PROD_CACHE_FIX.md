# Problema: Deploy em Produção com Cache do Docker

## Sintoma
Após fazer merge para `main` e criar release, a produção continua rodando código antigo mesmo após `docker compose restart`.

## Causa Raiz
O Docker reutiliza layers em cache mesmo quando o código-fonte muda. Isso acontece porque:
1. O `COPY backend/src/ ./src/` no Dockerfile é cacheado
2. O Docker não detecta mudanças nos arquivos copiados
3. O `docker compose restart` apenas reinicia containers, não rebuilda imagens

## Solução Definitiva

### Opção 1: Script de Deploy Automático (Recomendado)
Usar o script `scripts/deploy/deploy-prod.sh` que:
- Remove imagens antigas
- Rebuilda sem cache (`--no-cache`)
- Garante que sempre usa código mais recente

**Uso:**
```bash
ssh -F C:\projetos\config faren "bash /opt/mesas/scripts/deploy/deploy-prod.sh"
```

### Opção 2: Comando Manual
Se precisar fazer deploy manual:
```bash
cd /opt/mesas
git pull origin main
docker compose -f docker-compose.prod.yml down
docker rmi mesas-mesas-api mesas-mesas-app mesas-mesas-cron
docker compose -f docker-compose.prod.yml build --no-cache --pull
docker compose -f docker-compose.prod.yml up -d
```

### Opção 3: GitHub Actions (Futuro)
Configurar workflow que:
1. Faz SSH na VM
2. Executa script de deploy
3. Valida healthcheck
4. Notifica resultado

## Checklist de Deploy

- [ ] Merge PR para `main`
- [ ] Criar release (ex: v1.2.1)
- [ ] Executar script de deploy OU comando manual
- [ ] Aguardar ~2 minutos para containers ficarem healthy
- [ ] Validar rotas críticas:
  - `GET /api/v1/tables`
  - `GET /api/v1/gm/:slug`
  - `POST /api/v1/profile/me/google-picture`
- [ ] Testar funcionalidades no navegador
- [ ] Verificar logs: `docker logs mesas-api --tail 50`

## Prevenção

**NUNCA usar apenas:**
- ❌ `docker compose restart` (não rebuilda)
- ❌ `docker compose build` sem `--no-cache` (usa cache)
- ❌ `docker compose up -d` sem rebuild prévio

**SEMPRE usar:**
- ✅ Script de deploy completo
- ✅ `--no-cache` ao fazer build
- ✅ Remover imagens antigas antes de rebuild
